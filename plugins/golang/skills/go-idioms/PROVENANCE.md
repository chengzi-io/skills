# Provenance

Distilled. Not a pin. Why: [DECISION.md](DECISION.md).

Runtime `SKILL.md` / `reference/` must not tell the model to load `samber/cc-skills-golang@…`.

| | |
|--|--|
| Upstream | [samber/cc-skills-golang](https://github.com/samber/cc-skills-golang) (MIT) |
| Read at | `147c0679e2442fffd45e8f2275e9417f2991e6f5` (2026-08-26) |
| Refresh | Re-clone that commit or newer main; diff against this table; patch *this skill’s* `reference/`, not a vendor copy |

## Took (traps)

| Our file | Upstream skills |
|----------|-----------------|
| `reference/safety.md` | `golang-safety` (nil interface, append alias, defer-in-loop, defensive copy, integer narrow, bare assert). Remaining error traps from `golang-error-handling` (log xor return, `%w` vs `%v` at boundary, `errors.Is`/`As`) — not the wrapping tutorial |
| `reference/types.md` | `golang-structs-interfaces` (consumer-side interfaces, return concrete, small interfaces, receivers, `var _`) |
| `reference/concurrency.md` | `golang-concurrency` + `golang-context` (exit, errgroup, channel ownership, ctx first / not in struct, `WithoutCancel`) |
| `reference/testing.md` | `golang-testing` (table+`t.Run`, `t.Helper`, parallel isolation, no sleep, goleak, synctest.Test, httptest) |
| `reference/shape.md` | `golang-naming` + `golang-code-style` (stutter, no Get, acronyms, no utils, early return, ctx first, options) |
| `reference/modernize.md` | `golang-modernize` as **old-pattern bans** gated by `go.mod`, not a 1.21–1.26 changelog |

## Dropped

- Mesh / orchestrator: `golang-how-to` (always-load into consumer AGENTS.md)
- Vendor libraries: `golang-samber-*`, cobra, viper, wire, dig, fx, testify-as-a-skill
- Encyclopedias: documentation, benchmark/pprof, observability dashboards, popular-libraries, stay-updated, gopls MCP, pkg.go.dev
- CI YAML dumps: `golang-continuous-integration`
- Persona, ultracode, “community default supersedes…” blocks
- Forcing slog over an existing zap/zerolog stack
- Experimental `encoding/json/v2` as required

## Do not copy

Upstream `SKILL.md` bodies. Rewrite traps in this plugin’s voice (`oapi-codegen-best-practices` style: load table + short examples).
