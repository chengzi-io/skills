# oapi-codegen Configuration

Authoritative field docs: GoDoc [`codegen.Configuration`](https://pkg.go.dev/github.com/oapi-codegen/oapi-codegen/v2/pkg/codegen#Configuration) and the repo [JSON Schema](https://github.com/oapi-codegen/oapi-codegen/blob/main/configuration-schema.json).

## Minimal Good Configs

### Gin + strict + models + embedded spec

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/oapi-codegen/oapi-codegen/v2.8.0/configuration-schema.json
package: api
output: gen/server.gen.go
generate:
  models: true
  gin-server: true
  strict-server: true
  embedded-spec: true
```

### Chi + strict + models + embedded spec

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/oapi-codegen/oapi-codegen/v2.8.0/configuration-schema.json
package: api
output: gen/server.gen.go
generate:
  models: true
  chi-server: true
  strict-server: true
  embedded-spec: true
```

### Client only

```yaml
package: apiclient
output: client.gen.go
generate:
  models: true
  client: true
# optional if component schemas collide with *Response names:
# output-options:
#   response-type-suffix: Resp
```

### Models only (shared package)

```yaml
package: api
output: types.gen.go
generate:
  models: true
output-options:
  # only if you need unreferenced components/schemas
  # skip-prune: true
```

## Generate Flags (What to Turn On)

| Flag | Role | Notes |
|------|------|-------|
| `models` | Component + used schemas → Go types | Almost always `true` for servers |
| `gin-server` / `chi-server` | Framework route registration + `ServerInterface` | **Exactly one** server per package/output |
| `strict-server` | `StrictServerInterface` + request/response envelopes | Requires a server flag |
| `embedded-spec` | `GetSwagger()` gzipped base64 | Needed for validation middleware from gen code |
| `client` | HTTP client stubs | Prefer `ClientWithResponses` usage in app code |
| `server-urls` | Constants/helpers from `servers:` | Optional for clients |

If the entire `generate` block is omitted, oapi-codegen defaults to an **Echo** server + models + embedded spec — never rely on that default; be explicit.

## Output Options Worth Knowing

| Option | When to use |
|--------|-------------|
| `skip-prune: true` | Generate types not referenced by paths (shared model specs) |
| `include-tags` / `exclude-tags` | Generate a subset of operations (admin vs public) |
| `include-operation-ids` / `exclude-operation-ids` | Finer filter than tags |
| `response-type-suffix` | Avoid client response type name clashes |
| `nullable-type: true` | Use `nullable.Nullable[T]` for true three-state fields |
| `prefer-skip-optional-pointer` | Prefer non-pointer optionals project-wide (know the trade-offs) |
| `name-normalizer` / `additional-initialisms` | Control identifier style (API, UUID, …) |
| `overlay.path` | Apply OpenAPI Overlay before generation (vendor specs) |
| `user-templates` | Override templates — **unstable**; use sparingly |
| `type-mapping` | Remap OpenAPI type/format → Go types |
| `struct-tags` | Customize `json`/`form`/extra tags |

## Compatibility Options

Prefer **defaults** for new code. Only flip compatibility flags when upgrading and you must freeze old behavior temporarily.

Notable:

| Key | Meaning |
|-----|---------|
| `enable-auth-scopes-on-context` | Re-enable **deprecated** per-operation scope injection into context. Prefer validation middleware instead. |
| `apply-chi-middleware-first-to-last` | Chi middleware application order fix/compat |

## Import Mapping

Keys are the **exact `$ref` document path or URL** as written in the OpenAPI file (not a JSON pointer). Values are Go import paths, or `-` for same-package multi-file generation (v2.4.0+).

```yaml
# admin server references common models
import-mapping:
  ../common/openapi.yaml: example.com/app/internal/httpapi/common
```

Same package multi-file:

```yaml
import-mapping:
  user.yaml: "-"
```

**Strict + import-mapping:** if a strict envelope `$ref`s `components/responses` or `requestBodies` from another package, that package **must also** generate with `strict-server: true` or you get undefined `*JSONResponse` types.

## Tooling Integration

### go tool (recommended, Go 1.24+)

```bash
go get -tool github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
```

```go
package api

//go:generate go tool oapi-codegen -config oapi-codegen.yaml ../../../api/openapi.yaml
```

### Makefile drift gate

```makefile
.PHONY: generate
generate:
	go generate ./...

.PHONY: check-generate
check-generate: generate
	git diff --exit-code -- internal/httpapi/gen/
```

### Schema pin for editors

Pin `yaml-language-server: $schema=.../vX.Y.Z/configuration-schema.json` to the **same major.minor** as the installed oapi-codegen binary. Update both together (Renovate can automate this).

## Extensions (Spec-Side)

Use sparingly; prefer clean OpenAPI. Common ones:

| Extension | Purpose |
|-----------|---------|
| `x-go-name` | Override field/type Go name |
| `x-go-type` / `x-go-type-import` | Use an existing Go type |
| `x-go-type-skip-optional-pointer` | No `*` for one optional field |
| `x-omitempty` / `x-omitzero` | JSON tag control |
| `x-oapi-codegen-extra-tags` | Extra struct tags (`validate`, `db`, …) |

For third-party specs, prefer **Overlay** to inject extensions rather than permanently forking the vendor file.

## What Not to Put in Config

- Multiple server frameworks in one generate pass
- `strict-server` without a server
- Relying on default Echo generation
- `user-templates` as the first resort for small naming issues (fix names in OpenAPI or use extensions first)

## Spec Constraints That Affect Codegen

OpenAPI taste lives in `writing-openapi-specs`. These are **codegen-facing** constraints:

1. Stable `operationId` in `resource_action` form — method and strict envelope names derive from it.
2. Shared shapes in `components/schemas` — inline anonymous objects generate awkward/incomplete types.
3. Avoid component names ending in `Request` / `Response` when also generating a client (clash with envelopes); rename or set `response-type-suffix`.
4. Document every status code you return under strict-server — response unions come from the operation.
5. Optional ≠ null: use `nullable: true` / `type: [T, "null"]` when null is meaningful.
6. Set `additionalProperties: false` on request objects when validation should reject unknown fields.
7. Do not rely on generated auth-scopes-on-context (deprecated); use validation middleware + `AuthenticationFunc`.
