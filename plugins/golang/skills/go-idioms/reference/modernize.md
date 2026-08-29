# Modernize (gated by `go.mod`)

Read the module `go` line first. Apply a row only when the module is **at
least** that version. Do not upgrade `go` to unlock a row unless asked.

This is a ban list of patterns models still emit. Not a release-notes dump.
Prefer `golangci-lint` `modernize` / `go fix` when the repo already runs them.

| Ban (old) | Use | Since |
|-----------|-----|--------|
| `interface{}` | `any` | 1.18 |
| hand-rolled min/max | builtins `min`/`max` | 1.21 |
| `for k := range m { delete(m, k) }` | `clear(m)` | 1.21 |
| `sort.Slice` / `sort.Strings` | `slices.Sort` / `slices.SortFunc` + `cmp` | 1.21 |
| manual clone/`Contains` loops | `slices.Clone`, `slices.Contains`, `maps.Clone` | 1.21 |
| `v := v` inside `for` before `go` | drop the copy (`go` directive must be ≥ 1.22) | 1.22 |
| `for i := 0; i < n; i++` when only the index is used | `for i := range n` | 1.22 |
| `math/rand` + `rand.Seed` | `math/rand/v2` (`IntN`, not `Intn`) | 1.22 |
| gorilla-style mux for a new stdlib server | `http.ServeMux` `"GET /users/{id}"` + `r.PathValue` | 1.22 |
| `sql.NullString` in new code | `sql.Null[string]` | 1.22 |
| empty-env default `if s == "" { s = def }` | `cmp.Or(s, def)` | 1.22 |
| `json:",omitempty"` on `time.Time` | `omitzero` | 1.24 |
| `for i := 0; i < b.N; i++` in new benchmarks | `for b.Loop()` | 1.24 |
| `runtime.SetFinalizer` | `runtime.AddCleanup` | 1.24 |
| `tools.go` blank imports | `go.mod` `tool` directive | 1.24 |
| `errors.As(err, &ptr)` when `T` implements `error` | `errors.AsType[T]` | 1.26 |
| `fmt.Sprintf("%s:%d", host, port)` | `net.JoinHostPort` | any |

`log/slog` for **new** logging. Do not migrate zap/logrus/zerolog because this
file exists.

`encoding/json/v2` stays experimental (`GOEXPERIMENT=jsonv2`). Do not adopt
unless the project already opted in.

User-supplied paths under a directory: Go 1.24+ `os.Root` rather than
`Clean`+prefix checks.

After edits that rename stdlib APIs (`rand.Intn` → `IntN`), use gopls rename
or compile the package — do not sed.
