# Testing

Follow the repo’s existing test stack. Do not add testify (or drop it) to
satisfy this file.

## Shape

- One `_test.go` per source file (`foo.go` → `foo_test.go`).
- Table-driven: named cases, `t.Run(tt.name, ...)`. Subtest names lowercase
  (`"missing id"`, not `"Missing ID"`).
- Assertion helpers call `t.Helper()`.
- `t.Parallel()` only when the test shares no mutable package state.
- Compare errors with `errors.Is` / `errors.As`, not `==` or string contains
  as the primary assert.
- Fixtures in `testdata/`. HTTP: `httptest.NewRecorder` /
  `httptest.NewServer`.

If the repo uses testify: build `assert.New(t)` **inside** each `t.Run`. A
parent `assert.New(t)` attributes failures to the parent; the subtest still
prints PASS.

## Time and goroutines

- Do not `time.Sleep` to wait for a goroutine.
- Go 1.25+ (module `go 1.25` or newer): `testing/synctest.Test` +
  `synctest.Wait`. Do not use Go 1.24 experimental `synctest.Run`.
- Tests that start goroutines: `goleak.VerifyNone(t)` or
  `goleak.VerifyTestMain`. Do not call `t.Fatal` from a child goroutine —
  send the error back to the test goroutine.
- Prefer `t.Context()` (Go 1.24+) over `context.Background()` in tests.

## Integration

Separate with `//go:build integration` (or the repo’s existing tag). Unit
tests stay off the network.

## Race

CI: `go test -race` for the packages that run in CI. Do not skip race to
hide a leak.
