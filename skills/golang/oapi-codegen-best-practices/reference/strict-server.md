# Strict Server Pattern

`strict-server: true` is the default recommendation for new APIs. It is inspired by typed RPC stubs: handlers receive a request object and return a response object (+ error).

## Why Strict

| Non-strict | Strict |
|------------|--------|
| Framework-specific signatures (`*gin.Context` or `http.ResponseWriter`) | Framework-agnostic `context.Context` + typed envelopes |
| Manual `json.Encode` / `c.JSON` / status codes | Response object sets status + content-type via `Visit*Response` |
| Easy to return undocumented status codes | Compiler pushes you toward declared responses |
| Body bind scattered in handlers | Request body/params assembled before your code runs |

**Strict does not replace validation middleware.** It reduces marshal boilerplate; schema validation still needs middleware.

## Generated Shapes

For `operationId: pets_list` roughly:

```go
type StrictServerInterface interface {
	PetsList(ctx context.Context, request PetsListRequestObject) (PetsListResponseObject, error)
}

type PetsListRequestObject struct {
	Params PetsListParams
	// Body *… if the operation has a body
}

type PetsListResponseObject interface {
	VisitPetsListResponse(w http.ResponseWriter) error
}

type PetsList200JSONResponse []Pet
// optional: PetsList404JSONResponse, …
```

Your implementation returns concrete response types; the generated strict adapter visits them onto the `http.ResponseWriter`.

## Wiring

1. Implement `StrictServerInterface` in hand-written code.
2. Wrap with `NewStrictHandler` / `NewStrictHandlerWithOptions` → obtains `ServerInterface`.
3. Register that `ServerInterface` with Gin or Chi as usual.

```go
strict := NewServer(deps) // StrictServerInterface
si := api.NewStrictHandlerWithOptions(strict, nil, api.StrictHTTPServerOptions{
	RequestErrorHandlerFunc:  writeRequestError,
	ResponseErrorHandlerFunc: writeResponseError,
})
// Gin:
api.RegisterHandlers(r, si)
// Chi:
h := api.HandlerFromMux(si, r)
```

## Handler Rules

1. **Happy path** → concrete `*200JSONResponse` (or other success type from the spec).
2. **Expected failures** (404/409/422 as documented) → corresponding response type, `error == nil`.
3. **Unexpected failures** → `return nil, err` and let `ResponseErrorHandlerFunc` produce 500.
4. **Do not** write to a raw `http.ResponseWriter` inside strict handlers (you do not receive one).
5. **Map domain → API types** at the edge; services should not depend on generated response types if you want domain purity (optional mapping layer is fine).

### Error sources

| Source | Handling |
|--------|----------|
| Validation middleware | 400/401/403 **before** handler; custom `ErrorHandler` for your error schema |
| `(nil, err)` from handler | `ResponseErrorHandlerFunc` → typically 500 (log, opaque body) |
| Documented business outcomes | Typed responses (`…404JSONResponse`), not `error` |
| Panics | Framework recovery **outside** oapi layer |

```go
func (s *Server) mapErr(err error) (api.UsersGetResponseObject, error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return api.UsersGet404JSONResponse{Message: "not found"}, nil
	case errors.Is(err, domain.ErrConflict):
		return api.UsersGet409JSONResponse{Message: "conflict"}, nil
	default:
		return nil, err
	}
}
```

## Multipart / Form / Streaming

Strict has first-class support for:

- `multipart/form-data` (often as `multipart.Reader` or generated fields)
- `application/x-www-form-urlencoded`
- Multiple content types per operation (discriminated by response/request type names)

Prefer declaring these media types correctly in OpenAPI rather than reading raw bodies ad hoc.

## Middleware Hooks

Strict supports `StrictMiddlewareFunc` chains around the typed handler (operation name string available). Use for:

- Per-operation metrics / tracing
- Authorization that needs the already-bound request object

Prefer **OpenAPI validation middleware** for auth that is already expressed as `security` in the spec.

## Import-Mapping Caveat

When strict code `$ref`s response/requestBody components generated in **another package**, that package must also set `strict-server: true`. Otherwise `*JSONResponse` types are missing and compilation fails.

## When Non-Strict Is Acceptable

- Migrating a large existing Gin/Chi codebase gradually
- Handlers that must stream custom protocols poorly modeled in OpenAPI
- Extreme performance paths where envelope allocation matters (measure first)

Even then, generate models from the spec; avoid hand-rolled parallel DTOs.

## Testing Strict Handlers

Unit-test the implementer **without** Gin/Chi:

```go
resp, err := srv.PetsList(context.Background(), api.PetsListRequestObject{
	Params: api.PetsListParams{Limit: &limit},
})
require.NoError(t, err)
ok, okCast := resp.(api.PetsList200JSONResponse)
require.True(t, okCast)
```

Integration tests hit the real router + validation middleware.
