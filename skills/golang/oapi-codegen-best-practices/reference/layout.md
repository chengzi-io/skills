# Project Layout & Multi-Package Specs

## Goals

1. OpenAPI file(s) are easy to find and review
2. Generated code is isolated and obviously non-editable
3. Hand-written adapters stay thin
4. Domain packages do not import Gin/Chi unless necessary

## Recommended Layout (Single Service)

```text
repo/
  api/
    openapi.yaml                 # SSOT
    oapi-codegen.server.yaml
    oapi-codegen.client.yaml     # optional internal client
  internal/
    httpapi/
      gen/
        server.gen.go            # go:generate output only
      server.go                  # StrictServerInterface impl
      auth.go
      router.go
      errors.go
    user/                        # domain example
      service.go
      repository.go
  cmd/
    server/main.go
```

### Variants

| Style | When |
|-------|------|
| `internal/httpapi/gen` | Default: one delivery edge |
| `internal/api/oapi` + handlers by resource file | Large API surface; split `users.go`, `pets.go` implementing same struct |
| Separate `pkg/openapi` module | Publishing models/client to other services |

## go:generate Placement

Put the generate directive next to the output package:

```go
// internal/httpapi/gen/generate.go
package api

//go:generate go tool oapi-codegen -config ../../../api/oapi-codegen.server.yaml ../../../api/openapi.yaml
```

Or a root `Makefile` / `//go:generate` in `api/` that writes into `internal/…/gen`. Pick one entrypoint so CI has a single `go generate ./...` or `make generate`.

## Split Models vs Server Outputs

When `server.gen.go` is huge, split:

```yaml
# api/oapi-codegen.types.yaml
package: api
output: ../../internal/httpapi/gen/types.gen.go
generate:
  models: true
```

```yaml
# api/oapi-codegen.server.yaml
package: api
output: ../../internal/httpapi/gen/server.gen.go
generate:
  gin-server: true   # or chi-server
  strict-server: true
  embedded-spec: true
# models: false — types already in types.gen.go same package
```

Same `package` name → one Go package, multiple files.

## Multi-File OpenAPI

### Same Go package (`import-mapping: "-"`)

Use when the YAML is split for authoring but the service is one binary/package.

1. One generate call per YAML file
2. Map sibling files to `"-"`
3. Often set `skip-prune: true` on pure model files

### Multiple Go packages

Use when admin/public APIs share models:

```text
internal/httpapi/
  common/   # models only from common/openapi.yaml
  admin/    # admin server + import-mapping to common
  public/   # public server + import-mapping to common
```

```yaml
# admin config
import-mapping:
  ../common/openapi.yaml: example.com/app/internal/httpapi/common
```

Remember: strict `$ref` to foreign `responses` / `requestBodies` requires the foreign package also generate strict types.

## Overlay for Vendor Specs

Do not permanently edit vendor OpenAPI. Use Overlay:

```yaml
output-options:
  overlay:
    path: overlays/vendor.yaml
    strict: true
```

Typical actions: strip `x-internal` paths, inject `x-go-type`, fix `operationId`s.

## Dependency Direction

```text
cmd/server → httpapi (router) → domain services → storage
                │
                └── gen (models, interfaces)
```

- `gen` must not import your domain packages
- Domain should not import `gin` / `chi` / `gen` if you want purity; many codebases allow domain to use `gen` models as DTOs—**decide explicitly**
  - **Stricter:** map gen ↔ domain in the adapter
  - **Pragmatic:** use generated models as API DTOs at the edge only; persistence has its own structs

## What Not to Do

- Edit `*.gen.go` to "just fix this one type"
- Scatter `//go:generate` with conflicting configs
- Put business logic in `router.go`
- Generate client + server into the same file without need (harder reviews)
- Create parallel hand-written request structs that duplicate OpenAPI schemas
