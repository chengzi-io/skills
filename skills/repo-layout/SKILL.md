---
name: repo-layout
description: >
  When adding a project, module, or file, put it on a capability path
  so directory hierarchy, directory names, and file names express product
  capabilities (package-by-feature / vertical slices), not technical layers.
  Use this skill when creating a new project or service tree, adding a
  feature and choosing its home, deciding where a file or package goes,
  naming folders and files, splitting or merging modules, migrating off
  layered trees (controllers/services, domain/application/infrastructure,
  clean/hexagonal/onion), reviewing or restructuring folder layout,
  designing an agent-friendly or AI-readable codebase, or when the user
  mentions repo layout, project structure, screaming architecture,
  package by feature, feature-first, or vertical slice. Also use when
  adding code and the home must be obvious from the path alone. Not for
  touring a tree with no layout change, cosmetic tidy with no boundary
  problem, domain glossaries, module-depth or seam design, or numbered
  agent-workflow workspaces (01-spec/02-design).
license: MIT
metadata:
  version: "2026.08.26"
---

# Repo Layout

A stranger — human or agent — should find the right code from the tree alone, in the smallest context that suffices, see its boundary, and change it without touching unrelated modules.

If the work needs a repo-wide search, a long briefing, or someone who already knows where things live, the tree is the bug.

**Default:** name the capability and the path, then put **new** code there. Do not move old files unless Track picked Migrate or Cleanup.

## Should this skill run?

Run it when the task is where a file or folder lives, what to name it, or how to reshape the tree. If you are already implementing a feature, still Place the new files first, then write the code at that path.

Stop this skill (and name the other one) when the user wants:

| Ask | Instead |
|-----|---------|
| Tour the tree, no layout change | Explain; do not Place or Migrate |
| Cosmetic tidy, no boundary problem | Stop |
| Domain glossary / CONTEXT.md terms | `domain-modeling` |
| Module depth, seams, testability | `improve-codebase-architecture` |
| ADR | `write-adr` |
| Numbered `01-spec/` job folders as application source | Refuse as layout |

These are not a product layout, even when called AI-friendly: code-root `domain/application/infrastructure`, top-level `controllers/services`, numbered `01-spec/` folders as `src/`.

## Terms

| Term | Meaning |
|------|---------|
| **Slice** | One product capability, owning its code end-to-end. `orders` is a slice; `controllers` is not. |
| **Kernel** | Shared, policy-free, has an owner. Business rules do not live here. |
| **Scream test** | Read only the path (skip language/process shells). A stranger names the product job. Fail if the name is a technical role, filler (`core`, `impl`, a second `internal` inside a slice), an abbreviation (`svc`, `pay`), or only makes sense after a briefing. |

**Layer names — never as directories:** `controller`, `service`, `repository`, `model`, `dto`, `util`, `common`, `helper`, `manager`, `handler`, `domain`, `application`, `infrastructure`, `usecase`, `components`, `hooks`, `views`, `misc`, `temp`. A **file** may still use a role suffix (`refund.service.ts`).

## Track — first match wins

Read the user ask. Take the **first** matching row. One track this turn.

| # | When the user ask is… | Track | Then |
|---|------------------------|-------|------|
| 1 | Audit / review / PR placement, and they did **not** ask to move files | **Review** | Read [references/improve.md](references/improve.md). Do not move. |
| 2 | Full cleanup / complete migration plan / "don't move yet" for the whole tree | **Cleanup** | Read [references/improve.md](references/improve.md). Write `repo-layout-migration.md`. Stop. |
| 3 | Execute / continue a batch, and `repo-layout-migration.md` exists | **Migrate** | Read [references/improve.md](references/improve.md). First `pending` batch only. Do not re-review. |
| 4 | Gather / migrate one capability; OR a shown `shared/` / `utils/` / `common/` already holds business rules and the ask is what to do before adding more | **Migrate** | Read [references/improve.md](references/improve.md). |
| 5 | Anything else (empty repo, new service, new file, "where does this go?") | **Place** | Stay on this file. Create or name paths only. |

If a later step would move existing files but Track is Place, do not move them — name the new home and stop, or tell the user Migrate is the next track.

## Place

Do these steps in order. After the scream test, emit the **Layout decision** block. If the user only asked where it goes, stop after the block. If they also asked you to write the feature, write files at that path next.

### Facts

1. The user ask (capability words).
2. The tree: use a pasted tree as-is; otherwise inspect the repo. If you cannot see an existing tree, go to **Recovery** — do not invent a layered app.
3. `CONTEXT.md` if present (slice names must match; do not edit it).
4. Root `AGENTS.md` if present (index line only when a **top-level** slice is added or renamed).

### Steps

1. **Name the capability** in product language (what the user or system can *do* or *own*). Prefer the `CONTEXT.md` term, else the user's word, else the most specific product noun. Not a layer name.
2. **Pick the code root**
   - Empty repo / new service → language usual root (table below).
   - Existing tree → classify by *contents*, not the folder name (see **Shells**). Keep that root.
   - Do not invent a parallel `src/` or `domains/`. Do not rename a shell to a product noun.
3. **Find the home slice.** Reuse the slice that already owns this job. Add a top-level slice only for a new capability. Files that change, test, and ship together live here. If a small change needs six layer folders, the home is wrong.
4. **Choose depth.** Default: a flat file in the slice folder.
   - Sub-capability = a durable second job (`orders/fulfillment`).
   - Variant = interchangeable strategy with a sibling (`payments/stripe`).
   - Do not add a directory that will hold only this file.
   - Do not add layer-named directories.
   - Do not flatten a split that already screams.
5. **Name the file** — see **Names**.
6. **Put only the new files there.** Tests colocate by default (`invoice.ts` + `invoice.test.ts`). Mirror only if the toolchain requires a split test root, and mirror slice names, not layers. Go: the last directory screams; the file can stay short.
7. **Scream-test** the full path (and every new top-level slice name). If it fails, rename before writing.

No layer-named directories. No new `shared/` / `utils/` / `helpers/` / `kernel/` until policy-free code with an owner already exists.

If the rest of the tree is still layered, **leave it**. Only the new files follow Place.

Do not Place into a mixed-duty catch-all (`shared/`, `utils/`, `common/`) that already holds business rules. The new file's home is an owning slice. Kernel only if the code is policy-free **and** that catch-all is not already a junk drawer. Moving the old junk is Migrate (track 4), not Place.

### Layout decision (required)

Emit this block so a human can see why, then stop or write files.

```text
Layout decision
- Track: Place
- Capability: <product noun>
- Code root: <path> — <language usual / existing shell / existing code root>
- Path: <full path of the new file or folder>
- Why: <one sentence: the product job a stranger reads from the path>
- Left alone: <dirs/files not moved>
- Not doing: mass-move, layer directories, extra README
```

If Track was Review / Cleanup / Migrate, use the block in [references/improve.md](references/improve.md) instead.

**Example** — layered tree, new refund, "don't restructure":

```text
Layout decision
- Track: Place
- Capability: refund
- Code root: src/ — existing tree
- Path: src/payments/refund.ts
- Why: refund is a payments job; the path names it without a briefing
- Left alone: src/controllers, src/services, src/repositories, catalog
- Not doing: mass-move, layer directories, extra README
```

Wrong: `src/controllers/refund_controller.ts`, `src/utils/refund.ts`, `src/payments-refund-service.ts`.

### Language usual roots (empty repo)

| Language | Code root |
|----------|-----------|
| TypeScript / JavaScript | `src/` |
| Go | `internal/{slice}/` + `cmd/{binary}/` for mains |
| Java / Kotlin | `src/main/java/...` (keep the conventional package root) |
| Python | existing package dir, else `src/{package}/` |
| Unknown | `src/` — state the assumption |

## Shells

Decide by what is *inside*, not by the name. If mixed, treat as code root and slice inside it.

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

## Names

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

## Recovery

When stuck, take the matching row and **stop or ask**. Do not improvise a different architecture.

| If | Then | Do not |
|----|------|--------|
| Empty / new service, no tree | Propose language usual root + slices | Layer cake, `01-spec/` |
| Existing repo claimed, no tree, cannot inspect | Ask for a snippet. You may propose `{codeRoot}/{capability}/{file}` as an **assumption** | Invent a layered tree to migrate; dump into `utils/` |
| Two possible capability names | `CONTEXT.md` > user's word > most specific product noun. State the pick | A long quiz; a layer name |
| `CONTEXT.md` vs current folders | Slice names follow `CONTEXT.md`. Do not edit it | A parallel glossary |
| Place + mixed `shared/` / `utils/` | New file in an owning slice | Grow the catch-all; move neighbors |
| "Execute batch" but no plan file and no named slice + tree | Stop. Review or Cleanup first | Invent batches; move files |
| Plan file and tree disagree | Re-review; rewrite the plan | Execute |
| Move, tests, or compile fail | Stop this batch. Report the failure | Start the next slice |
| `improve.md` unreadable | Place only; refuse mass-move | Guess a migration |
| Ask mixes layout + glossary/ADR/seams | Do the layout part; name the other skill | Drop layout |

Do not restructure when the tree is ugly but boundaries are already clear, tests cannot verify a move, the task is unrelated, or a high-risk release is in flight.

Without an explicit Review / Migrate / Cleanup ask: no mass-moves, world-renames, dumps into `common/`, extra wrapper layers, README spray, or new abstractions to justify a folder. A move does not also rewrite behaviour, public APIs, dependencies, or the test framework.

## Done when

Every **new** package on the path is a capability / sub-capability / variant a domain person would recognize, a thin platform/edge adapter, or kernel with no policy.

Review, Cleanup, Migrate, drift, or a junk-drawer `shared/`: read [references/improve.md](references/improve.md).

Read [references/sources.md](references/sources.md) only if the user asks why or wants citations.

## Gotchas

- Local `AGENTS.md` / README only when that directory has local rules a stranger would miss. Not every folder gets a README.
- Root `AGENTS.md` = slice index + global rules. Add or edit a line only when a **top-level slice** is added or renamed. Nested files do not get a line. Do not turn it into an encyclopedia.
- Do not copy a framework sample tree as law. Do not replace the source tree with a `docs/` tree.
