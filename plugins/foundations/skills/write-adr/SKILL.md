---
name: write-adr
description: "Draft, review, or slim Architecture Decision Records (ADRs). Trigger on ADR, architecture decision, decision record, MADR, supersede an old decision, or phrases like write an ADR, record why we chose X, document the decision. When the user settles a hard-to-reverse choice between real alternatives (language, framework, database, auth, deployment target, module boundaries, cross-service contracts) even without naming ADR, offer to record a one-paragraph ADR. Not for design docs, migration plans, API specs, or READMEs."
license: MIT
metadata:
  version: "2026.11.06"
---

# Write ADR

An ADR answers one question for a future reader: **why did we choose this?** It owns the trade-off; specs, design docs, and code own the how. Most ADRs are one paragraph, and none should exceed a page. A longer one is a design doc wearing the wrong name: split it and link.

## When to Write

Both must be true:

1. **Hard to reverse**: changing it later costs days, not hours.
2. **A real trade-off**: there were viable alternatives and one was picked for a reason.

Record it even when the choice is the default or recommended option; the ADR is what explains it to someone who never saw the recommendation. One decision per ADR: a tech stack is several ADRs (language, database, deployment target), not one.

Typical qualifiers:

- Technology with lock-in: language, framework, database, message bus, auth provider, deployment target
- Architectural shape and integration patterns ("Ordering and Billing talk via events, not HTTP")
- Boundaries, including explicit no's ("Other contexts reference customers by ID only")
- Constraints invisible in code (compliance, a partner's latency contract)
- Deliberate deviations a future reader would otherwise "fix"

Skip libraries swappable in hours, de facto standards with no real alternative, PoCs, and temporary workarounds. If nothing qualifies, tell the user and stop.

## Template

```markdown
# Short title of the decision

{1–3 sentences: the forces, the decision ("We will …"), and why.}

Rejected: {Option} — {reason}; {Option} — {reason}.
```

Add these only when they carry something non-obvious:

- `status` frontmatter when not simply accepted: `proposed`, `deprecated`, `superseded by ADR-NNNN`
- `Related:` links to specs, other ADRs, design docs
- `## Consequences`: downstream costs and new constraints
- `## Considered Options`: when a rejection needs more than one line

**Link, never paste:** schema or field inventories, package or file trees, migration and rollout steps, code / config / SQL / OpenAPI, algorithm or sequence walkthroughs. Naming one boundary ("SQLite is the source of truth for managed objects") is fine; listing every entity behind it is not. If the decision needs a bullet inventory, sub-headings, or a second independent choice ("and also …"), it is a design doc or two ADRs.

## Workflow

1. **Qualify** against "When to Write".
2. **Locate**: follow the project's existing ADR home and conventions (`docs/adr/`, `docs/decisions/`, document language). Otherwise use `docs/adr/NNNN-kebab-case-title.md`, creating the directory on first use. Take the next 4-digit number after the highest existing one; never reuse one.
3. **Draft** with the template. If the user named no alternative, ask for one; without it the decision fails criterion 2.
4. **Index**: add a line to the repo's ADR index if one exists. Do not commit unless asked.

## Lifecycle

Accepted ADRs are immutable. To change a decision, write a new ADR and change only the old one's status to `superseded by ADR-NNNN`, linking the new file. A bloated accepted ADR gets the same treatment: supersede it with a short one and move the detail into a spec.
