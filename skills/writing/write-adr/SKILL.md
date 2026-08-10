---
name: write-adr
description: "Draft, review, or slim Architecture Decision Records (ADRs). Trigger on ADR, architecture decision, decision record, tech choice, trade-off, Nygard, MADR, supersede/replace an old decision, or phrases like write an ADR, record why we chose X, document the decision. When the user makes a hard-to-reverse choice (database, framework, protocol, auth, module boundaries, cross-service contracts, external deps) even without naming ADR, suggest and draft a short why-only ADR. Not for long design docs, migration plans, API field specs, or READMEs."
license: MIT
metadata:
  version: "2026.08.10"
---

# Write ADR

When a developer two years from now finds a strange design choice and asks "Why?", the ADR answers that question. Capture the decision while the context is still fresh, in a format that survives team turnover.

**Core principle:** ADRs explain *why* a choice was made, not *how* it is implemented. Specs, design docs, and code own the how; the ADR owns the trade-off.

**Brevity is the product.** Nygard and Fowler both treat a healthy ADR as about one page. A long ADR is almost always a design doc wearing the wrong name—stop, split, and link.

## When to Write an ADR

Write an ADR when the decision meets **any one** of the following:

| # | Criterion | Typical examples |
|---|-----------|------------------|
| 1 | Affects **structure, major non-functionals, dependencies, or interfaces** | Database, message queue, auth architecture, API style |
| 2 | **Multiple viable options** with real trade-offs | SQL vs NoSQL, sync vs async, monolith vs services |
| 3 | **High cost of reversal** (days+, not hours) | Core framework swap, major data model, cross-service contract |
| 4 | **External dependency or hard external constraint** | Vendor lock-in, compliance, data residency |
| 5 | Affects **multiple teams, systems, or components** | Shared event schema, platform capability |
| 6 | **First time** the team makes this class of decision | First event sourcing, first multi-region, new language |
| 7 | Similar past decisions caused **significant pain** | Framework lock-in, frozen data models |

**Do not write an ADR when:**

- Already covered by team standards (formatting, naming, IDE)
- Temporary workaround or PoC
- Internal detail inside one module with cheap reversal
- Low risk and easy to reverse later

Spotify: significant impact on how engineers write software → write an ADR.  
Grady Booch: architectural = costly to change. Days to reverse → write; hours → usually skip.

"Almost always write" only works if each record stays **lightweight**. Many long ADRs is the worst outcome.

## Length and Content Budget (hard rules)

Target before open a PR or hand the file to a human:

| Budget | Limit | If over |
|--------|-------|---------|
| Whole ADR | **~1 page / ≤ ~50 lines** of body | Move detail to a linked spec or design doc |
| Context | **1 short paragraph** (or ≤ ~5 sentences) | Cut history; keep forces and constraints |
| Decision | **2–8 sentences**, one choice only | Enumerations and sub-headings → wrong document |
| Consequences | **3–8 bullets** total (+ / − / neutral) | Drop implementation tips |
| Alternatives | **1–3 rejected options**, one reason each | Do not re-argue the winner |

**Inverted pyramid:** most important sentence first (the choice), then why, then costs. Readers may stop after Decision.

### What belongs in an ADR

- The problem / forces that made a choice necessary
- The single chosen option, stated as policy ("We will …")
- Honest consequences (especially negatives and new constraints)
- Rejected alternatives with one-line rejection reasons
- Optional links: related ADR numbers, specs, design docs, RFCs

### What must not appear in an ADR

Push these to specs, schema docs, design docs, plans, or code—**link, do not paste**:

- Full table / column / field inventories
- Complete package or directory trees, file-by-file move lists
- Migration step sequences, rollout phase plans, PR checklists
- Code snippets, config dumps, OpenAPI fragments, SQL DDL
- Algorithm walkthroughs, state-machine diagrams, sequence details
- API error-code catalogs or wire-level contracts (except naming the chosen style)

Naming one boundary concept is fine ("SQLite is the source of truth for managed objects"). Listing every entity that follows is not.

### Smell tests (stop and rewrite)

If any of these is true, the draft is a design doc, not an ADR:

- Decision contains a **bullet or numbered inventory** of entities, tables, packages, or endpoints
- Decision uses **sub-headings** (###) for multiple facets of "how"
- You feel the need to say "and also" for a second independent choice → **split ADRs**
- Path strings, generator config, or `just` targets dominate the prose
- Removing all file paths and schema names would leave almost no Decision left → you never stated the policy

**Fix:** keep the boundary and the trade-off in the ADR; move the inventory to the linked document; put the link under Related or in one Decision sentence ("Exact schema lives in …").

## Workflow

### 1. Check if the decision qualifies

Run the criteria above. If none apply, tell the user and stop—do not generate trivia ADRs.

### 2. Resolve location and number

Prefer the project's existing ADR home and rules if present (e.g. `docs/decisions/`, `docs/adr/`, root `ADRS.md`). Otherwise default to:

```text
docs/architecture/decisions/NNNN-kebab-case-title.md
```

```bash
ls docs/architecture/decisions/ 2>/dev/null || ls docs/decisions/ 2>/dev/null
```

Next monotonic 4-digit number from `0001`. Never reuse numbers. Create the directory if missing. Match project language (e.g. Simplified Chinese vs English) when the repo already has a convention.

### 3. Draft the ADR

Clarify options and trade-offs if needed, then use this structure (adapt section titles only if the project template differs; keep the same information density):

```markdown
# ADR-{NNNN}: Short noun phrase title

- **Date**: YYYY-MM-DD
- **Status**: Proposed
- **Related**: optional links to specs, ADRs, design docs

## Context
Forces at play—technical, organizational, project-local.
Value-neutral facts and constraints. Do not prescribe the solution here.

## Decision
We will … (active voice). One decision only. Policy and boundaries, not a build plan.

## Consequences
- **+** …
- **-** …
- **neutral** … (optional)

## Alternatives Considered
- **Option A**: rejected because …
- **Option B**: rejected because …
```

Optional **Follow-ups** only as short links ("update spec X", "add contract test for Y")—never embed the work plan.

### 4. Checklist (all required)

- [ ] Title is a short noun phrase
- [ ] Context is value-neutral and short
- [ ] Decision is "We will …", **one** decision, within the length budget
- [ ] No embedded schema/package/API/migration inventories (links only)
- [ ] Negative consequences are honest
- [ ] Rejected alternatives have clear one-line reasons
- [ ] Body fits ~1 page / ~50 lines unless the project explicitly allows longer
- [ ] Smell tests pass

Rejected alternatives are often the highest-value part: future readers need to know what lost and why.

### 5. Place the file and update the index

Write the file; if the repo has `docs/decisions/README.md` (or similar), add an index line. Do not commit unless the user asks.

## Key Rules

### Accepted ADRs are immutable

Never edit the substance of an accepted ADR. On change, write a **new** ADR and mark the old status:

```text
Status: Superseded by ADR-0005 (see ./0005-use-mysql.md)
```

History is the point. Editing accepted ADRs destroys it.

If an old ADR is already a design-doc blob, do not "clean it up" in place after acceptance—supersede with a short decision record and point detail at the living spec.

### Status lifecycle

```text
Proposed → Accepted → Deprecated
                ↓
             Superseded (link to replacement)
```

| Status | Meaning |
|--------|---------|
| **Proposed** | Under discussion |
| **Accepted** | In effect; immutable |
| **Deprecated** | No longer in effect, no replacement |
| **Superseded by ADR-NNNN** | Replaced; must link the new ADR |

### One decision per ADR

Do not bundle. If A can be superseded while B stays, they need separate records.

### ADR vs other documents

| Document | Owns |
|----------|------|
| **ADR** | Why this option, not the others |
| **Spec / API / schema** | What the system is (contracts, fields, behavior) |
| **Design doc / plan** | How to implement or migrate |
| **RFC** | Discussion before the decision |
| **Code / tests** | Executable truth |

ADR references the others; it does not absorb them.

## Anti-Patterns

| Don't | Do instead |
|-------|------------|
| Edit an accepted ADR | New ADR + supersede the old |
| Record only the winner | List serious alternatives + rejection reasons |
| Hide downsides | Explicit negative consequences |
| Many decisions in one file | Split ADRs |
| Write weeks later | Write while the why is fresh |
| Use ADR as how-to / setup / migration plan | ADR = why; link how elsewhere |
| Paste full table or package lists into Decision | One boundary sentence + link to spec |
| Pad "for completeness" past one page | Cut until a new reader gets the choice in one minute |
| Write alone with no review when a team exists | Treat ADR as a communication tool |

## Sources

- Michael Nygard, "Documenting Architecture Decisions" (2011)
- Martin Fowler, "Architecture Decision Record" (brevity / inverted pyramid)
- adr.github.io / MADR (structure variants; still keep lean)
- Spotify Engineering, "When Should I Write an ADR?" (2020)
- ThoughtWorks Technology Radar — Lightweight ADRs

**Usage note:** Always run Step 1 (qualify) and the length/smell rules before drafting. Prefer a short ADR that forces a link over a long ADR that duplicates a spec.
