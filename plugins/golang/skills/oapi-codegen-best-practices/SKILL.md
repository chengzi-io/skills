---
name: oapi-codegen-best-practices
description: >
  Best practices for generating and wiring Go HTTP APIs with oapi-codegen (v2),
  covering strict-server, Gin and Chi integration, validation middleware, auth,
  project layout, and codegen configuration. Use when adding or regenerating
  oapi-codegen stubs, choosing gin-server vs chi-server, implementing
  StrictServerInterface, wiring request validation/auth middleware, writing
  oapi-codegen YAML config, or reviewing OpenAPI→Go server plumbing.
---

# oapi-codegen Best Practices

Contract-first Go APIs with [oapi-codegen](https://github.com/oapi-codegen/oapi-codegen) v2:
**spec is SSOT → generated plumbing → thin adapters → domain services.**

Greenfield ideal practice for **Gin and Chi** only. Not tied to any one repo layout.
OpenAPI document taste → companion skill `writing-openapi-specs`.

## When / Not

**Use when:** regenerate stubs; pick/wire `gin-server` or `chi-server` + `strict-server`; validation/auth middleware; gen layout; oapi config; debug "no matching operation" / unvalidated body / missing auth.

**Not:** OpenAPI prose/style; other generators (ogen, go-swagger); business rules inside `*.gen.go`.

## Principles (must hold)

1. Never hand-edit generated code — fix spec or config, then regenerate.
2. One framework server flag per package (`gin-server` **xor** `chi-server`); `strict-server` is an add-on, not a server.
3. Prefer **strict** handlers; expected HTTP outcomes are typed response objects; `error` means unexpected (usually 500).
4. Generation ≠ full schema validation — production needs middleware + `embedded-spec` (or loaded spec).
5. Commit generated output; CI drift-check; exclude gen files from lint *rewrites*.
6. Module path is `github.com/oapi-codegen/...` (not `deepmap`).

## Default stack

```text
OpenAPI YAML
  → oapi-codegen: models + (gin|chi)-server + strict-server + embedded-spec
  → implement StrictServerInterface  (+ var _ StrictServerInterface = (*T)(nil))
  → NewStrictHandler* → RegisterHandlers (Gin) | HandlerFromMux (Chi)
  → validation middleware (gin-middleware | nethttp-middleware)
  → domain services
```

Decide Gin vs Chi by existing team stack — codegen quality is comparable. Details only in references below.

## Load the right reference (SSOT)

Read **only** what the task needs; do not restate these files into the chat as a dump.

| Task | Read |
|------|------|
| Config YAML, flags, import-mapping, codegen-facing spec rules | [reference/configuration.md](reference/configuration.md) |
| Package layout, multi-file specs, dependency direction | [reference/layout.md](reference/layout.md) |
| Strict request/response, errors, testing handlers | [reference/strict-server.md](reference/strict-server.md) |
| Gin register, middleware order, groups | [reference/gin.md](reference/gin.md) |
| Chi register, mounts, BaseURL | [reference/chi.md](reference/chi.md) |
| Validation, `Servers = nil`, `AuthenticationFunc` | [reference/validation-security.md](reference/validation-security.md) |
| Symptom → fix | [reference/pitfalls.md](reference/pitfalls.md) |

Official upstream: [oapi-codegen](https://github.com/oapi-codegen/oapi-codegen), [gin-middleware](https://github.com/oapi-codegen/gin-middleware), [nethttp-middleware](https://github.com/oapi-codegen/nethttp-middleware).

## Procedure (agent)

### Change an endpoint

1. Edit OpenAPI (`operationId`, path, schemas, responses, security).
2. Regenerate (`go generate` / make) from YAML config — see configuration reference.
3. Fix `StrictServerInterface` implementers; keep handlers thin.
4. Confirm validator still uses current `GetSwagger()`; clear `swagger.Servers` unless Host matching is intentional.
5. Tests: unit-test strict methods; integration through router + validator.
6. Commit **spec + config + generated + hand-written** together.

### Reviewer quick gate

- [ ] No edits under gen output
- [ ] Exactly one server generator flag; strict if new API
- [ ] Public routes behind validation middleware + auth aligned with `security`
- [ ] Documented statuses returned as typed responses, not bare `error`
- [ ] Interface assert present; CI regenerate-and-diff

### If stuck

Open [reference/pitfalls.md](reference/pitfalls.md) first (400 no matching operation, auth never runs, type redeclare, import-mapping strict).
