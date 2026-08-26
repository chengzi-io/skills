# Pitfalls & FAQ

## Generation & Tooling

### Still on deepmap imports

Replace `github.com/deepmap/oapi-codegen` → `github.com/oapi-codegen/oapi-codegen/v2` and middleware modules under `github.com/oapi-codegen/*`.

### CLI flags only

Flags are legacy. Prefer YAML config + schema comment for reviewability and IDE completion.

### Accidental Echo default

Omitting `generate` can default to Echo-oriented output. Always set an explicit server flag.

### kin-openapi breakages

`kin-openapi` is pre-v1 and may break transitive builds. Upgrade oapi-codegen + middleware + kin-openapi together; read release notes.

### Linting generated code

Do not require golangci-lint clean on `*.gen.go`. Exclude them. Do commit them.

### Not committing generated code

Official recommendation: **commit** generated output. CI regenerates and fails on diff.

## Spec / Types

### Missing operationId

Leads to ugly or unstable method names. Always set semantic `operationId`s before first generate.

### Request/Response name clash (client)

Schemas named `UpdateFooResponse` collide with client envelopes. Rename components or set:

```yaml
output-options:
  response-type-suffix: Resp
```

### Optional vs nullable confusion

| Intent | Model |
|--------|-------|
| Field may be omitted | not in `required`; usually `*T` |
| Field may be JSON `null` | `nullable: true` / `type: [T,"null"]` |
| Need omit vs null vs value | `output-options.nullable-type: true` → `nullable.Nullable[T]` |

### additionalProperties

Implicit additional properties are **ignored by default** in generation. Set `additionalProperties: false` on request objects when validation should reject unknown fields.

### Pruned types

Unreferenced `components/schemas` are dropped unless `skip-prune: true`.

## Runtime

### 400 "no matching operation was found"

Common causes:

1. `swagger.Servers` still set → clear with `swagger.Servers = nil`
2. Mount prefix / `BaseURL` mismatch with OpenAPI `paths`
3. Method or path not in spec
4. Validator applied to non-API routes only partially matching

### Auth never triggered

Security is not enforced by generated handlers alone. Wire validation middleware + `AuthenticationFunc`.

### Double validation / double bind

Strict already unmarshals JSON. Avoid `c.ShouldBindJSON` / second `Decode` in the same handler unless reading a raw stream intentionally.

### Returning business errors as `error`

Strict maps `error` to **500** via `ResponseErrorHandlerFunc`. Expected 404/409 must be typed response objects.

### Health checks broken after adding validator

Exclude non-spec routes from the validator group.

### Response validation missing

Not supported by current middlewares. Cover with tests or external contract testing.

## Architecture Smells

| Smell | Better |
|-------|--------|
| 200-line methods on `Server` | Delegate to services |
| Domain imports `gin` | Keep gin in `httpapi` only |
| Hand-copied DTOs mirroring OpenAPI | Use generated models |
| Spec lagging implementation | Spec-first PR: YAML before handler |
| One mega `server.gen.go` with 50 hand files mixed | `gen/` directory boundary |
| Custom templates for minor renames | `operationId` / `x-go-name` / Overlay |

## Upgrade Checklist

1. Read oapi-codegen release notes / discussions (v2 migration, strict changes)
2. Bump `oapi-codegen`, runtime, and framework middleware together
3. Pin config JSON schema version to the new release
4. `make generate` and fix implementer compile breaks
5. Run full test suite; smoke auth + validation paths
6. Grep for deprecated APIs (`enable-auth-scopes-on-context` consumers, deepmap paths)

## FAQ (Short)

**Q: Gin or Chi?**  
A: Both first-class. Choose by team standard. Strict handlers are portable.

**Q: Do I need strict-server?**  
A: Strongly recommended for new APIs. Non-strict is migration/legacy-friendly.

**Q: Is OpenAPI 3.1 supported?**  
A: Yes with ongoing limitations tied to kin-openapi. Prefer well-supported 3.0/3.1 constructs; test generate early.

**Q: Should generated code be in `internal` or `pkg`?**  
A: `internal` for a single service; `pkg` only if other modules import the client/models.

**Q: Can I validate responses?**  
A: Not via the official request middleware today. Use tests / external tools.

**Q: How do I version APIs?**  
A: Version in the OpenAPI `servers` or path prefix (`/v1`); regenerate; keep old implementers only if you must run dual surfaces—prefer additive changes within v1 when possible.
