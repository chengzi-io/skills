# Improve layout

Read this file when [SKILL.md](../SKILL.md) Track is **Review**, **Cleanup**, or **Migrate**. Terms, scream test, Place, and Recovery in SKILL.md still apply. This file only inspects and moves **existing** files.

## Size — first match wins

If the user named a scope, take it. Otherwise pick the smallest size that covers the ask.

| # | Signal | Size | Do |
|---|--------|------|-----|
| 1 | One file in the wrong home; PR placement | **Tiny** | Place that file, or Review **scoped to the diff**. Do not migrate neighbors. |
| 2 | One capability scattered; "gather X"; junk-drawer `shared/`; adding a file into mixed `shared/` / `utils/` | **Slice** | **Migrate** homeless policy out of the catch-all. Place the new file in an owning slice, not into the junk drawer. |
| 3 | Layered top-level; "full cleanup"; drift | **Repo** | **Cleanup:** write the complete plan to `repo-layout-migration.md`, then stop. **Migrate** only when asked, first pending batch. |

Tiny and slice: no plan file unless the user asked for one.

Repo: the map lives in the file, not in the chat. After compaction or a new session, read the file — do not re-review unless the tree contradicts it.

---

## Review

Do not rewrite unless the user asked to migrate. Map **what is**, then **what should be**.

1. **Current (fact).** Label each code-root name: slice, kernel, platform/edge, or layer leak. Note mixed-duty catch-alls.
2. **Layer leaks** — layer-named directories owning business code.
3. **Homeless policy** — business rules in kernel/shared/platform; no owner.
4. **False slices** — capability-shaped pass-throughs, or one concept shattered across layer folders.
5. **Target** — same capabilities, slices first. Default flat inside a slice. Keep a layout that already screams.
6. **Moves**, lowest risk first: (1) wrong home, dead or mixed-duty dirs (2) ownership, cycles, leaks (3) names and depth. Cosmetics last, usually never.

### Tiny / PR — required block

Emit this block. Do not move files.

```text
Layout review
- Scream read: <one sentence from top-level names>
- Current:     <fact>
- Findings:    <ranked>
- Target:      <only what changes>
- Next 3:      <concrete file or directory moves>
- Not doing:   mass-move this turn
```

Scoped to the diff. Would this change have stayed inside one slice?

Next 3 is the execution window for tiny/slice. It is **not** the map for a repo cleanup.

### Repo — Cleanup

**Deliverable:** `repo-layout-migration.md` at the repo root (one file, not a `docs/` tree). Name that path in the answer. Chat is not the map — a later session must be able to open the file and execute. Then stop. Do not move files until the user says to migrate.

```text
Layout cleanup plan
- Scream read:
- Current:
- Findings:
- Target:     <complete tree — every slice, not "next 3 only">
- Batches:
  1. <slice>  from: …  to: …  tests: …  done-when: …  status: pending
  2. …
- Not doing:  moving files this turn
```

Write the same content into `repo-layout-migration.md`. One slice (or sub-capability) per batch. New files already follow Place.

If `repo-layout-migration.md` already exists and the tree still matches it: **do not re-review**. Execute the first `pending` batch (when the user asked to migrate).

Re-review only when the tree contradicts the plan (off-plan edits, wrong slice names, a large merge).

---

## Migrate

Destructive. One slice (or sub-capability) per batch. Do not invent a new architecture while moving. Do not split into microservices to escape a messy tree.

If the plan file exists, Batch 1 is the first `pending` row. Otherwise: Review's first move if Review just ran, else the slice this change already touches.

If there is no plan file, no Review just now, and no named slice + tree — **stop** (SKILL.md Recovery). Do not invent batches.

1. New files already follow **Place**.
2. **Rename + move.** Keep behaviour. Re-export from the old path until callers move; drop the facade in the next batch for that slice.
3. Keep a working vertical path until the slice is together.
4. Delete emptied layer folders last. No `old/` / `legacy/` / `new/` / `tmp/`.
5. Then run that slice's tests, plus the project's compile / lint / import check. No leftover references to the old path.
6. Mark that batch `done` in `repo-layout-migration.md` if the file exists.

If tests, compile, or import check fail: **stop this batch**. Report the failure. Do not start the next slice.

Example: gather `payments/refund` (handler, logic, persistence, tests) into `payments/refund/`. Leave `catalog/` layered.

### Layout migrate (required)

```text
Layout migrate
- Batch: <n> <slice>
- From: <paths>
- To: <paths>
- Left alone: <other slices / layered leftovers>
- Tests: <what ran, pass/fail>
- Plan file: <marked done / none>
- Stopped because: <green / test fail / no plan>
```

Done when that capability can be changed without opening layer-named directories. Other slices may still be layered.

When every batch is `done`, delete `repo-layout-migration.md` (or leave all-done if the user wants the record). Do not keep it as standing architecture docs.

---

## Done when

Every package on the path under discussion is a capability / sub-capability / variant a domain person would recognize, a thin platform/edge adapter, or kernel with no policy.

If `CONTEXT.md` exists, slice names match it. Do not write the glossary.
