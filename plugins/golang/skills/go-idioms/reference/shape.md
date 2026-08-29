# Shape (names and control flow)

## Packages and files

- Package: one lowercase word, singular (`http`, not `utils`/`helpers`).
- No `utils`, `helpers`, `common`, `models`, `types` as dumping packages.
  Name the concept (`money`, `clock`, `id`).
- Files: `snake` is fine (`user_handler.go`). Identifiers never use `_`
  except test names like `TestParse_empty`.

## Identifiers

- MixedCaps. Export = capital. Not `ALL_CAPS` constants (`MaxRetries`).
- No stutter: `http.Client` not `http.HTTPClient`; `user.New()` not
  `user.NewUser()` when that type is the package’s one constructor.
- No `Get` on getters: `Name()`, not `GetName()`. Boolean predicates keep
  `Is`/`Has`/`Can`.
- Acronyms stay consistent: `HTTP`, `URL`, `ID` (or all-lower in an
  unexported ident: `httpClient`, `userID`). Not `Http`, `Url`, `Id`.
- Receiver: 1–2 letters, same name on every method (`s *Server`). Not
  `this`/`self`.
- Sentinel errors: `ErrNotFound`. Error types: `PathError`. Error **strings**
  lowercase, no trailing punctuation, including acronyms:
  `"user: unknown id"`.
- iota enums: zero value is `Unknown`/`Invalid`, not a real state.
- Functional options: `WithTimeout`. Option type `Option`, not `FooOption`,
  when the package is already `foo`.

## Control flow

- Guard clauses; happy path at indent 1. No pyramid of `if/else` for
  validation.
- `ctx` is first. More than ~4 params: options struct or `With*` options.
- Named composite literals (`Server{Addr: addr}`), not positional.
- Unexport anything the module boundary does not need. Do not export “for
  later reuse”.
- `switch` for tag dispatch; include `default` when the set is not closed.
