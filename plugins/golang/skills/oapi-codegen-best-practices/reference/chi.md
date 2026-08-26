# Chi Integration

Official guide: [docs/chi-server.md](https://github.com/oapi-codegen/oapi-codegen/blob/main/docs/chi-server.md).

Chi is a thin router over `net/http`. Generated non-strict handlers use standard `http.ResponseWriter` / `*http.Request` signatures. Validation uses **nethttp-middleware** (shared with stdlib / gorilla).

## Generate

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/oapi-codegen/oapi-codegen/v2.8.0/configuration-schema.json
package: api
output: gen/server.gen.go
generate:
  models: true
  chi-server: true
  strict-server: true   # recommended
  embedded-spec: true
```

## What Gets Generated

| Symbol | Role |
|--------|------|
| `ServerInterface` | Non-strict: `func(w, r, …params)` |
| `StrictServerInterface` | Strict: `(ctx, RequestObject) (ResponseObject, error)` |
| `HandlerFromMux` / `HandlerWithOptions` | Mount on `chi.Router` |
| `ChiServerOptions` | `BaseURL`, `BaseRouter`, middlewares, error handler |
| `NewStrictHandler` / `NewStrictHandlerWithOptions` | Strict → `ServerInterface` adapter |
| `GetSwagger` | Embedded spec |

## Non-Strict Implementation

```go
type Server struct{}

var _ api.ServerInterface = (*Server)(nil)

func (Server) GetPing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(api.Pong{Ping: "pong"})
}
```

Register:

```go
r := chi.NewRouter()
r.Use(middleware.RequestID, middleware.Recoverer)

h := api.HandlerFromMux(server, r)

http.ListenAndServe(":8080", h)
```

With options:

```go
h := api.HandlerWithOptions(server, api.ChiServerOptions{
	BaseRouter: r,
	BaseURL:    "/api/v1",
	ErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
		http.Error(w, err.Error(), http.StatusBadRequest)
	},
})
```

## Strict Implementation (Recommended)

```go
type Server struct {
	pets *petservice.Service
}

var _ api.StrictServerInterface = (*Server)(nil)

func (s *Server) PetsList(ctx context.Context, req api.PetsListRequestObject) (api.PetsListResponseObject, error) {
	list, err := s.pets.List(ctx, req.Params)
	if err != nil {
		return nil, err
	}
	return api.PetsList200JSONResponse(list), nil
}
```

Wire-up with validation:

```go
func NewHandler(s *Server) http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RequestID, chimw.RealIP, chimw.Recoverer)

	swagger, err := api.GetSwagger()
	if err != nil {
		panic(err)
	}
	swagger.Servers = nil

	validator := nethttpmiddleware.OapiRequestValidatorWithOptions(swagger, &nethttpmiddleware.Options{
		Options: openapi3filter.Options{
			AuthenticationFunc: authFunc,
		},
		// ErrorHandler / SilenceServersWarning as needed
	})
	r.Use(validator)

	si := api.NewStrictHandlerWithOptions(s, nil, api.StrictHTTPServerOptions{
		ResponseErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			// log err
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(api.Error{Message: "internal error"})
		},
	})

	return api.HandlerFromMux(si, r)
}
```

Dependency:

```bash
go get github.com/oapi-codegen/nethttp-middleware
```

## Middleware Order (Chi)

Chi applies middleware in registration order (outermost first depending on version/options—use project defaults and test). Recommended logical order:

1. RequestID / RealIP / Recoverer
2. Logging
3. **OAPI validator** (schema + security)
4. Route handlers from oapi-codegen

### Non-spec routes (health, metrics)

```go
r := chi.NewRouter()
r.Get("/healthz", healthHandler)

r.Group(func(r chi.Router) {
	r.Use(validator)
	_ = api.HandlerFromMux(si, r)
})
```

Or serve metrics on another listener.

## Subrouters / Mount

When mounting under a prefix:

```go
r.Route("/api/v1", func(r chi.Router) {
	r.Use(validator)
	api.HandlerWithOptions(si, api.ChiServerOptions{
		BaseRouter: r,
		BaseURL:    "", // paths in spec already include /api/v1 OR set BaseURL consistently
	})
})
```

**Rule:** the path the validator sees must match OpenAPI `paths` (plus `servers` if not cleared). Pick one strategy:

- Spec paths = `/pets`, mount at root, `BaseURL: ""`
- Spec paths = `/pets`, mount at `/api/v1` with `BaseURL: "/api/v1"` (generated routes become `/api/v1/pets`)
- Spec paths already = `/api/v1/pets`, no extra BaseURL

Inconsistent prefixes are the #1 cause of "no matching operation was found".

## Chi vs Gin Strict Parity

Strict **handler code is portable**. Only the registration + validation middleware packages differ. Teams can share `StrictServerInterface` implementations across edge adapters if desired (rare; usually one framework per service).

## Testing with Chi

```go
func TestPetsList(t *testing.T) {
	h := NewHandler(NewServer(mockSvc))
	req := httptest.NewRequest(http.MethodGet, "/pets", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
}
```

Prefer unit-testing strict methods for domain mapping; use httptest for middleware + routing.
