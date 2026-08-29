# Types

## Interfaces live on the consumer

Define the interface in the package that **calls** it. The implementer exports
a concrete type and does not import that interface.

Do not create `UserRepositoryInterface` next to a single `userRepository`.
Start concrete. Extract an interface when a second implementation or a test
fake needs it.

Keep interfaces small (1–3 methods). Compose if a larger contract is real.

## Accept interfaces, return structs

```go
func NewService(store Store) *Service { ... } // good

func NewService(store Store) ServiceInterface { ... } // do not
```

Callers get the concrete API. Upstream can still assign to an interface.

Compile-time check next to the type:

```go
var _ Store = (*SQLStore)(nil)
```

Honor stdlib method names: `String()`, not `ToString()`; `Read([]byte)`, not
`ReadData()`.

## Receivers

| Pointer | Value |
|---------|--------|
| Mutates, or contains `sync.Mutex` / not-copyable | Small, immutable |
| Large struct | Basic types |

One choice per type: if any method is pointer, all are. Pass mutex-containing
structs by pointer. `go vet` `copylocks` is the backstop.

## Zero value

`var buf bytes.Buffer` and `var mu sync.Mutex` work. A struct whose first
`map` write panics is a constructor bug — lazy-init or `make` in `New`.

## Generics over `any`

If the type set is known, use `[T comparable]` (or a real constraint), not
`any` plus assert. `any` stays at JSON/reflect boundaries.
