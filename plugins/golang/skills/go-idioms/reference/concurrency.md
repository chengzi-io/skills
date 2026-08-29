# Concurrency and context

Every goroutine is a leak until it has an owner and an exit.

## Spawn

- Prefer `errgroup.Group` (with `SetLimit` when bounded) when any worker
  returns `error` or siblings must cancel.
- Fire-and-wait with no error: Go 1.25+ `WaitGroup.Go`. Below 1.25:
  `Add` **before** `go`; `Done` in defer. `Add` inside the goroutine races
  `Wait`.
- Do not `go func` in an HTTP handler using `r.Context()` if the work must
  outlive the request — the context cancels when the handler returns. Detach
  with `context.WithoutCancel` (Go 1.21+) only when that outliving is
  intended (audit log, durable write).
- No `time.Sleep` as synchronization.

## Context

```go
func (s *Service) Create(ctx context.Context, in CreateInput) error
```

- First parameter, named `ctx`.
- **Never** store `Context` on a struct. The struct outlives one request.
- Propagate the caller’s ctx. Do not start `context.Background()` in the
  middle of a request. `Background`/`TODO` only at `main`, init, or when
  the caller truly has none.
- `cancel()` on every `WithCancel`/`WithTimeout` path, or hand ownership to
  the caller.
- `WithValue` only for request-scoped metadata (trace id). Not for required
  function arguments. Keys are unexported types.
- Select on `ctx.Done()` whenever waiting on a channel.

## Shared state

- Maps are not concurrent. Use `mutex+map`, `sync.Map` (read-heavy), or
  don’t share.
- Mutex: short critical section; never hold across I/O. Do not copy a
  struct that embeds a mutex.
- Channels: sender closes; specify direction `chan<-` / `<-chan`; default
  unbuffered. Send values, not pointers, unless ownership is explicit.

## Checklist before `go`

1. How does it exit?
2. Who waits (`errgroup` / `WaitGroup`)?
3. Who owns the channels?
4. Should this stay synchronous?
