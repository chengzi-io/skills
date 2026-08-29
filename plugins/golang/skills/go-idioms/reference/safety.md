# Safety

Bugs, panics, silent corruption. Not attacker models.

## Typed nil in an interface

An interface is nil only when **both** type and value are nil. Returning a
nil pointer variable boxes the type:

```go
func handler() http.Handler {
    var h *MyHandler
    if !enabled {
        return h // non-nil interface, nil pointer — caller `== nil` is false
    }
    return h
}

func handler() http.Handler {
    if !enabled {
        return nil
    }
    return &MyHandler{}
}
```

Same trap for `error`: `var e *MyError; return e` is a non-nil error. Return
untyped `nil` on success.

## Nil map write

Read/range on a nil map is fine. **Write panics.** Initialize in the
constructor or lazy-init on first write. Design `var x T` to be usable.

## Append aliases the backing array

If `cap` allows, `append` reuses storage. Callers of exported APIs must not
observe mutation of internals:

```go
// alias
b := append(a, x)

// force copy
b := append(a[:len(a):len(a)], x)
// or
b := append(slices.Clone(a), x)
```

Exported getters of slices/maps: return `slices.Clone` / `maps.Clone`.
Subslice of a large buffer: clone if the tail would pin the whole array.

## `defer` in a loop

`defer` runs at **function** exit. `defer f.Close()` inside `for` holds every
file until return. Extract the loop body to a function so defer runs per
iteration.

## Bare type assert

`v := x.(T)` panics. Use `v, ok := x.(T)`.

## Integer narrow

`int32(int64)` wraps with no error. Check `math.MinInt32`/`MaxInt32` (or the
target width) first.

## Errors

- Never discard: `_ = err` on I/O, parse, or business calls.
- Wrap internally with `%w` so `errors.Is` / `errors.As` work. At process
  or RPC boundaries, prefer `%v` if the chain must not leak.
- Inspect with `errors.Is` / `errors.As` (Go 1.26+: `errors.AsType[T]` when
  the module allows). Do not `err == ErrNotFound`.
- **Log xor return.** Logging and returning the same error doubles aggregator
  noise. Log at the edge that handles it; below that, only return.
- `errors.Join` for independent failures (Go 1.20+). Do not invent a
  multierror helper.
- `panic` only for impossible states (broken invariant). Recover at
  goroutine / HTTP boundary, not around expected I/O.
