---
name: repo-layout
description: >
  Lay out a repository so directory hierarchy, directory names, and
  file names express product capabilities (package-by-feature / vertical
  slices), not technical layers. Use this skill when creating a new project or
  service tree, adding a feature and choosing its home, deciding where a file
  or package goes, naming folders and files, splitting or merging modules,
  migrating off layered trees (controllers/services,
  domain/application/infrastructure, clean/hexagonal/onion), reviewing or
  restructuring folder layout, designing an agent-friendly or AI-readable
  codebase, or when the user mentions repo layout, project structure,
  screaming architecture, package by feature, feature-first, or vertical
  slice. Also use when adding code and the home must be obvious from the
  path alone. Not for touring a tree with no layout change, cosmetic tidy
  with no boundary problem, domain glossaries, module-depth or seam design,
  or numbered agent-workflow workspaces (01-spec/02-design).
license: MIT
metadata:
  version: "2026.08.24"
---

# Repo Layout

> Can a stranger — human or agent — find the right code from the tree alone, in the smallest context that suffices, see its boundary, and change it without touching unrelated modules?

If yes, the layout is good. If the work needs a repo-wide search, a long briefing, or someone who already knows where things live, fix the tree.

This skill **creates and changes** directories and files. Before writing a feature: name the slice and the path.

## Glossary

| Term | Meaning |
|------|---------|
| **Scream** | The name is a product capability. `orders` screams; `controllers` does not. |
| **Slice** | One capability, owning its code end-to-end. |
| **Nest** | Technical detail lives *inside* the slice. Layers are not top-level. |
| **Kernel** | Shared, policy-free, has an owner. Business rules do not live here. |

**Layer names** — do not use as directories: `controller`, `service`, `repository`, `model`, `dto`, `util`, `common`, `helper`, `manager`, `handler`, `domain`, `application`, `infrastructure`, `usecase`, `components`, `hooks`, `views`, `misc`, `temp`. A **file** may still use a role suffix (`refund.service.ts`).

## Scream test

Read only the path (language/process shells skipped). A stranger names the product job.

**Fail:** technical role, filler (`core`, `impl`, a second `internal` inside a slice), abbreviation (`svc`, `pay`), or it only makes sense after a briefing.

## Modes

One mode at a time.

| Mode | When | Done when |
|------|------|-----------|
| **Greenfield** | Empty repo, new service | Slices at the code root; scream test passes |
| **Place** | New file, new feature, "where does this go?" | Path chosen; names scream |
| **Migrate** | Layered or scattered tree | One slice moved; its tests green |
| **Review** | Audit, PR placement | Current (fact) + findings + target + next 3 moves |

Large rewrite: Review, then Migrate. Batch 1 = first of those three moves.

## Restraint

Do not restructure when the tree is ugly but boundaries are already clear, tests cannot verify a move, the task is unrelated, or a high-risk release is in flight.

Without an explicit ask: no mass-moves, world-renames, dumps into `common/`, extra wrapper layers, README spray, or new abstractions to justify a folder. A move does not also rewrite behaviour, public APIs, dependencies, or the test framework.

"AI-friendly" / "agent-readable" does not change the rules. Not code-root `/domain /application /infrastructure`. Not `controllers/services`. Not numbered `01-spec/` job folders as application source.

---

## Greenfield

1. **Name slices** in product language (what the user/system can *do* or *own*).
2. **Pick the code root.** Empty repo → language usual root (`src/`, `internal/`, project package, `src/main/java`, …). Existing tree → by *contents*, not the folder name (see Shells). Keep the conventional root. Do not invent a parallel `src/` or `domains/`. Do not rename a shell to a product noun.
3. **Create slice folders only.** No layer-named directories. No `shared/` / `utils/` / `helpers/` until policy-free code with an owner already exists.
4. **Keep each slice flat** until a second durable sub-job or variant appears.
5. **Scream test** every top-level slice name.

### Shells

Decide by what is *inside*, not by the name.

- **Shell** — children are mostly process, URL, visibility, or deployable wiring; little product policy.
- **Code root** — already holds product policy, even if named `app/`, `lib/`, or a language default.

| Signal | Treat as |
|--------|----------|
| Binary / process dirs (`cmd/` and kin) | process edge; slices in the language code root |
| Go `internal/` | visibility shell = code root; slices go *inside* (`internal/{slice}/`) |
| Next.js / file-router `app/` | routing shell when children are mostly routes; keep route files; slice inside the existing non-route root (`lib/`, `src/`, …) even if it currently only holds platform; do not add a second code root |
| Monorepo `packages/` / `apps/` | slice inside the owning deployable; shared policy = one package, not a copy per app |
| `tests/`, `__tests__/`, `src/test/` | test shells — not capability segments |

`app/` collision:

- Mostly route/entry files → shell. Keep the routes. Do not rename `app/` to a product noun.
- Already has modules with business rules → `app/` is the code root. Slice inside it.
- Never fork a second policy tree beside a package that already has the rules.

Go: `cmd/{binary}/` + `internal/{slice}/`.

```text
src/
  billing/
    invoice.ts
    invoice.test.ts
  identity/
    session.ts
    session.test.ts
```

---

## Place

1. **Name the capability** in product language.
2. **Find the home slice.** Reuse, or add a top-level slice only for a new capability. Files that change, test, and ship together live here. If a small change needs six layer folders, the home is wrong.
3. **Choose depth.** Flat files (default). Sub-capability = durable sub-job (`orders/fulfillment`). Variant = interchangeable strategy (`payments/stripe`). Do not add a directory that will hold only one file. Do not add layer-named directories. Do not flatten a split that already screams.
4. **Name the file** — see Names.
5. **Put it there.** Tests colocate by default (`invoice.ts` + `invoice.test.ts`). Mirror only if the toolchain requires a split test root, and mirror slice names, not layers. Go: the last directory screams; the file can stay short.
6. **Scream test** the full path.

### Names

Directory = capability noun. File = local role, or the thing it owns. Repeating the immediate folder is fine; repeating the full path is not. Spell the word (`payments`, not `pay` / `svc`). `index` / barrel = exports, not the business.

Each capability segment answers one question. Filler levels (`core/`, `impl/`, `payments/internal/`) fail the scream test. Language shells (`src/`, Go `internal/`) do not count as segments.

| Path | File | Verdict |
|------|------|---------|
| `billing/invoices/` | `pdf.go` | OK |
| `payments/refund/` | `refund.service.ts` | OK |
| `payments/refund/` | `service.ts` | OK if it is the only service file |
| `payments/refund/` | `payments-refund-service.ts` | Weak — full path |
| `services/` | `invoice_service.go` | Weak — layer |
| `src/utils/` | `helpers.ts` | Weak |

```text
{slice}/{sub-capability?}/{variant?}/{file}
```

At most three capability segments under the code root. Shells do not count.

Business rules go in one owning slice, never a catch-all `shared/` / `utils/` / `common/`. Slices do not import another slice's internals — if the tree cannot show that, enforce with package / lint / dep-guard, not with DDD layer folders.

---

## Migrate

Destructive. One slice (or sub-capability) per batch. Do not invent a new architecture while moving. Do not split into microservices to escape a messy tree.

1. New files already follow **Place**.
2. Batch 1 is Review's first move if Review just ran; otherwise the slice this change already touches.
3. **Rename + move.** Keep behaviour. Re-export from the old path until callers move; drop the facade in the next batch for that slice.
4. Keep a working vertical path until the slice is together.
5. Delete emptied layer folders last. No `old/` / `legacy/` / `new/` / `tmp/`.
6. Then run that slice's tests, plus the project's compile / lint / import check. No leftover references to the old path.

Example: gather `payments/refund` (handler, logic, persistence, tests) into `payments/refund/`. Leave `catalog/` layered.

Done when that capability can be changed without opening layer-named directories. Other slices may still be layered.

---

## Review

Do not rewrite unless the user asked to migrate. Map **what is**, then **what should be**.

1. **Current (fact).** Label each code-root name: slice, kernel, platform/edge, or layer leak. Note mixed-duty catch-alls.
2. **Layer leaks** — layer-named directories owning business code.
3. **Homeless policy** — business rules in kernel/shared/platform; no owner.
4. **False slices** — capability-shaped pass-throughs, or one concept shattered across layer folders.
5. **Target** — same capabilities, slices first. Default flat inside a slice. Keep a layout that already screams.
6. **Next 3 moves**, lowest risk first: (1) wrong home, dead or mixed-duty dirs (2) ownership, cycles, leaks (3) names and depth. Cosmetics last, usually never.

```text
Scream read: <one sentence from top-level names>
Current:     <fact>
Findings:    <ranked>
Target:      <only what changes>
Next 3:      <concrete moves>
```

On a PR: same block, scoped to the diff. Would this change have stayed inside one slice?

Migration plan only if asked → **Migrate**.

---

## Done when

Every package on the path is a capability / sub-capability / variant a domain person would recognize, a thin platform/edge adapter, or kernel with no policy.

If `CONTEXT.md` exists, slice names match it. Do not write the glossary (`domain-modeling`).

Out of scope: module depth (`improve-codebase-architecture`); ADRs (`write-adr`); numbered job-workspace folders as application source.

Read [references/sources.md](references/sources.md) only if the user asks why or wants citations.

## Gotchas

- Local `AGENTS.md` / README only when that directory has local rules a stranger would miss. Not every folder gets a README.
- Root `AGENTS.md` = slice index + global rules. Add or edit a line only when a **top-level slice** is added or renamed. Nested files do not get a line. Do not turn it into an encyclopedia.
- Do not copy a framework sample tree as law. Do not replace the source tree with a `docs/` tree.
