---
name: go-idioms
description: >
  Write and review idiomatic Go that models still get wrong: typed-nil
  interfaces, append aliasing, defer-in-loop, consumer-side interfaces,
  context not stored in structs, errgroup vs fire-and-forget goroutines,
  table tests, stuttering names, and pre-1.22 patterns. Use when writing,
  reviewing, or refactoring Go (.go, go.mod, tests, packages, goroutines,
  errors, interfaces, receivers). Also trigger on 惯用写法, Go 规范, idiomatic
  Go, gofmt-level design (not formatting). Skip OpenAPI codegen wiring
  (companion skill oapi-codegen-best-practices) and non-Go languages.
license: MIT
metadata:
  version: "2026.08.29"
---

# Go idioms

Traps frontier models still ship. Not a language tutorial. Not a Go changelog.

Obey the module’s `go` directive in `go.mod`. Do not bump it unless asked.
Read **only** the reference the current task needs.

## When / Not

**Use when:** writing or reviewing Go; naming packages/types; interfaces and
receivers; errors; goroutines/context; tests; replacing old stdlib patterns.

**Not:** oapi-codegen generate flags / strict-server wiring (companion skill
`oapi-codegen-best-practices`); OpenAPI prose; other languages.

## Principles (must hold)

1. Fail loud: check every `error`; never `_ = err` on I/O or business paths.
2. Concrete in, abstract at the consumer: accept small interfaces, return `*T`.
3. `ctx context.Context` is the first parameter. Never a struct field.
4. Every goroutine has an owner and an exit (`ctx`, errgroup, or `WaitGroup`).
5. Names: no stutter, no `Get` prefix, no `utils`/`helpers` packages.
6. Zero value useful; typed nil must not leak into `error` or other interfaces.

## Load the right reference (SSOT)

Do not dump these files into the chat.

| Task | Read |
|------|------|
| Panic, aliasing, typed nil, log-xor-return, integer narrow | [reference/safety.md](reference/safety.md) |
| Interfaces, constructors, receivers, `var _` | [reference/types.md](reference/types.md) |
| Goroutines, channels, errgroup, context propagation | [reference/concurrency.md](reference/concurrency.md) |
| Table tests, parallel, synctest, httptest, goleak | [reference/testing.md](reference/testing.md) |
| Packages, stutter, acronyms, early return, options | [reference/shape.md](reference/shape.md) |
| `any`, slices/maps, slog, WaitGroup.Go, t.Context — gated by `go.mod` | [reference/modernize.md](reference/modernize.md) |

## Procedure (agent)

1. Read `go.mod` `go` line. Modernize suggestions must not exceed it.
2. Open only the rows in the table that match the edit.
3. Match existing module layout and test stack (stdlib vs testify). Do not
   add libraries to satisfy this skill.
4. Reviewer: run the gate below on the diff.

### Reviewer quick gate

- [ ] No typed nil into `error` / `http.Handler` (return untyped `nil`)
- [ ] `append` / returned slices do not alias caller memory unsafely
- [ ] No `defer` resource Close in a `for` body
- [ ] Interfaces defined where consumed; `New*` returns concrete `*T`
- [ ] `ctx` first argument; not stored on the struct
- [ ] Goroutines: `WaitGroup.Add` before `go`, or `errgroup` / `WaitGroup.Go`
- [ ] Tests: `t.Run` tables; no `time.Sleep` to wait on goroutines
- [ ] No new `utils`/`helpers` package; no `GetFoo` / `Http`/`Id` identifiers

### If stuck

Safety first (typed nil, append, defer-in-loop), then concurrency (leak + ctx).
