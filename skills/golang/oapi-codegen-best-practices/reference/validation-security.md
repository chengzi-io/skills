# Validation & Security Middleware

## Mental Model

| Layer | What it enforces |
|-------|------------------|
| Generated parameter binding | Presence/format of path/query/header params (partial) |
| Strict server | Typed body unmarshal; response type → status/content-type |
| **Validation middleware** | Full request vs OpenAPI (schema, required, enum, security, …) |
| Your handler | Business rules not expressible (or not worth expressing) in the schema |

Response body validation via middleware is **not currently supported** by oapi-codegen middleware packages. Document responses in the spec for clients and strict typing; enforce outbound contracts with tests if critical.

## Package Matrix

| Framework | Module |
|-----------|--------|
| Gin | `github.com/oapi-codegen/gin-middleware` |
| Chi / net/http / gorilla | `github.com/oapi-codegen/nethttp-middleware` |

All wrap [kin-openapi](https://github.com/getkin/kin-openapi) `openapi3filter`. Breaking upgrades of `kin-openapi` can affect builds; pin and upgrade with oapi-codegen intentionally.

## Loading the Spec

**Preferred:** generate `embedded-spec: true` and call `GetSwagger()` so runtime matches the generated code.

```go
swagger, err := api.GetSwagger()
if err != nil {
	return err
}
// Critical for most deployments:
swagger.Servers = nil
```

Alternatively load YAML from disk (useful when operators swap specs without rebuild—rare for Go services).

### Why `Servers = nil`?

If `swagger.Servers` is non-empty, the validator checks that the request `Host` (and path base) match a declared server. Behind reverse proxies, local `localhost`, or alternate hostnames this becomes:

- HTTP 400
- message like **no matching operation was found**

Unless you deliberately validate server URLs, clear `Servers` after load. Middleware may log a warning; set `SilenceServersWarning: true` if intentional.

## Gin Setup

```go
import (
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
	"github.com/getkin/kin-openapi/openapi3filter"
)

swagger, _ := api.GetSwagger()
swagger.Servers = nil

r.Use(ginmiddleware.OapiRequestValidatorWithOptions(swagger, &ginmiddleware.Options{
	SilenceServersWarning: true,
	ErrorHandler: func(c *gin.Context, message string, statusCode int) {
		c.AbortWithStatusJSON(statusCode, gin.H{"message": message})
	},
	Options: openapi3filter.Options{
		AuthenticationFunc: authenticate,
		// MultiError: true, // optional: collect all schema errors
	},
}))
```

Helpers: `ginmiddleware.GetGinContext(ctx)`, `GetUserData(ctx)` inside auth callbacks.

## Chi / nethttp Setup

```go
import (
	nethttpmiddleware "github.com/oapi-codegen/nethttp-middleware"
	"github.com/getkin/kin-openapi/openapi3filter"
)

swagger, _ := api.GetSwagger()
swagger.Servers = nil

mw := nethttpmiddleware.OapiRequestValidatorWithOptions(swagger, &nethttpmiddleware.Options{
	Options: openapi3filter.Options{
		AuthenticationFunc: authenticate,
	},
})
r.Use(mw)
```

## AuthenticationFunc Pattern

OpenAPI declares schemes; middleware invokes your function per requirement.

Example scheme:

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
security:
  - BearerAuth: []
```

```go
func authenticate(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
	if input.SecuritySchemeName != "BearerAuth" {
		return fmt.Errorf("unsupported scheme: %s", input.SecuritySchemeName)
	}
	r := input.RequestValidationInput.Request
	auth := r.Header.Get("Authorization")
	// parse JWT / API key; check input.Scopes
	if !valid {
		return fmt.Errorf("unauthorized")
	}
	// stash principal in context for handlers — use a custom context key
	// For Gin, consider ginmiddleware.GetGinContext(ctx).Set("user", principal)
	return nil
}
```

**Scopes:** operations can require `security: [BearerAuth: [things:w]]`. `input.Scopes` lists required scopes for that attempt. Enforce them here.

**Anonymous alternatives:** `security: [{}]` or optional security — ensure your function and global requirements match the intended public routes.

## Do Not Use Deprecated Scopes-on-Context

Older generators put operation scopes into request context (`BearerAuthScopes`, etc.). That mechanism:

- Flattens OR/AND security incorrectly
- Is **off by default** now
- Should not be used for new code

If legacy middleware depends on it:

```yaml
compatibility:
  enable-auth-scopes-on-context: true
```

Plan migration to `AuthenticationFunc`.

## Error Response Shape

Default middleware error bodies are often plain text or generic JSON. For public APIs, set `ErrorHandler` to emit your **component error schema** (`#/components/schemas/Error`) so clients see one shape for validation and business errors.

Map status codes thoughtfully:

| Failure | Typical status |
|---------|----------------|
| Schema / param validation | 400 |
| Missing credentials | 401 |
| Valid credentials, insufficient scope | 403 |
| Path not in spec (if validator covers all traffic) | 404 |

## Routes Outside the Spec

Validator rejects unknown paths. Keep:

- `/healthz`, `/readyz`
- `/metrics`
- OpenAPI UI / raw `openapi.yaml`

on a router group **without** the validator, or add them to the OpenAPI document.

## Client-Side Security

Generated clients do not auto-auth. Use `WithRequestEditorFn` and optionally `pkg/securityprovider`:

```go
bearer, err := securityprovider.NewSecurityProviderBearerToken(token)
client, err := api.NewClientWithResponses(serverURL, api.WithRequestEditorFn(bearer.Intercept))
```

## Testing Validation

- Contract tests: send invalid bodies; expect 400 from middleware before mocks are called
- Auth tests: missing/invalid token → 401; wrong scope → 403
- Golden tests for error JSON shape

Do not disable middleware in production-like integration tests; that hides contract regressions.
