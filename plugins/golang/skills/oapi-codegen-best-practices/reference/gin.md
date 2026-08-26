# Gin Integration

Official guide: [docs/gin-server.md](https://github.com/oapi-codegen/oapi-codegen/blob/main/docs/gin-server.md).

> Gin v1.12+ requires a recent Go toolchain (see current oapi-codegen docs; generated Gin code may require Go 1.25+ depending on Gin version).

## Generate

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/oapi-codegen/oapi-codegen/v2.8.0/configuration-schema.json
package: api
output: gen/server.gen.go
generate:
  models: true
  gin-server: true
  strict-server: true   # recommended
  embedded-spec: true
```

## What Gets Generated

| Symbol | Role |
|--------|------|
| `ServerInterface` | Non-strict: methods take `*gin.Context` (+ params) |
| `StrictServerInterface` | Strict: `(ctx, RequestObject) (ResponseObject, error)` |
| `RegisterHandlers` / `RegisterHandlersWithOptions` | Mount routes on `gin.IRouter` |
| `GinServerOptions` | `BaseURL`, middlewares, error handler |
| `NewStrictHandler` / `NewStrictHandlerWithOptions` | Strict → `ServerInterface` adapter |
| `GetSwagger` | Embedded spec (`embedded-spec: true`) |

## Non-Strict Implementation

```go
type Server struct{ /* deps */ }

var _ api.ServerInterface = (*Server)(nil)

func (s *Server) GetPing(c *gin.Context) {
	c.JSON(http.StatusOK, api.Pong{Ping: "pong"})
}
```

Register:

```go
r := gin.New()
r.Use(gin.Recovery())
// validation middleware here — see validation-security.md
api.RegisterHandlers(r, server)
```

With base path prefix:

```go
api.RegisterHandlersWithOptions(r, server, api.GinServerOptions{
	BaseURL: "/api/v1",
})
```

`BaseURL` must match how the OpenAPI `paths` are written (and how validation middleware resolves routes). Prefer putting the full path in the spec **or** a consistent prefix strategy—not both inconsistently.

## Strict Implementation (Recommended)

```go
type Server struct {
	pets *petservice.Service
}

var _ api.StrictServerInterface = (*Server)(nil)

func (s *Server) PetsList(ctx context.Context, req api.PetsListRequestObject) (api.PetsListResponseObject, error) {
	list, err := s.pets.List(ctx, req.Params)
	if err != nil {
		return nil, err
	}
	return api.PetsList200JSONResponse(list), nil
}
```

Wire-up:

```go
func NewRouter(s *Server) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery(), requestID(), accessLog())

	swagger, err := api.GetSwagger()
	if err != nil {
		panic(err)
	}
	swagger.Servers = nil

	r.Use(ginmiddleware.OapiRequestValidatorWithOptions(swagger, &ginmiddleware.Options{
		Options: openapi3filter.Options{
			AuthenticationFunc: authFunc, // optional
		},
		ErrorHandler: func(c *gin.Context, message string, statusCode int) {
			c.AbortWithStatusJSON(statusCode, api.Error{Message: message})
		},
	}))

	si := api.NewStrictHandlerWithOptions(s, nil, api.StrictHTTPServerOptions{
		ResponseErrorHandlerFunc: func(c *gin.Context, err error) {
			// log err
			c.JSON(http.StatusInternalServerError, api.Error{Message: "internal error"})
		},
	})
	api.RegisterHandlers(r, si)
	return r
}
```

Dependency:

```bash
go get github.com/oapi-codegen/gin-middleware
```

## Middleware Order (Gin)

Recommended order:

1. Recovery / panic
2. Request ID / tracing inject
3. Access log (optional: log after status known)
4. **OAPI request validator** (auth + schema)
5. Registered oapi-codegen routes
6. Non-OpenAPI routes (healthz, metrics, docs) — register **outside** validator or exclude them

Health endpoints that are **not** in the OpenAPI spec will fail validation with "path not found" if they pass through the validator. Patterns:

- Mount health on a separate `gin.Engine` / `RouterGroup` without the validator
- Or include them in the OpenAPI spec
- Or custom `ErrorHandler` that distinguishes infra paths (prefer explicit routes outside the group)

```go
r := gin.New()
r.GET("/healthz", healthHandler)

apiGroup := r.Group("/")
apiGroup.Use(ginmiddleware.OapiRequestValidator(swagger))
api.RegisterHandlers(apiGroup, si)
```

Note: validator uses the full request URL path; group prefixes and `BaseURL` must stay consistent with the spec.

## Gin-Specific Pitfalls

| Issue | Guidance |
|-------|----------|
| Double bind | With strict-server, do **not** also `c.ShouldBindJSON` in the handler — body is already bound |
| `c.Request.Context()` | Strict handlers receive `ctx`; prefer that over re-fetching unless you need Gin values |
| Gin context in auth | `ginmiddleware.GetGinContext(ctx)` from the validation callback context when needed |
| Mixing `gin.Default()` | Prefer explicit middleware list for production (no surprise Logger format) |
| File uploads | Model as `multipart/form-data` in OpenAPI; use strict multipart support |

## Testing with Gin

```go
func TestPetsList(t *testing.T) {
	r := NewRouter(NewServer(mockSvc))
	req := httptest.NewRequest(http.MethodGet, "/pets", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
}
```

For pure business logic, unit-test `StrictServerInterface` methods without spinning Gin.
