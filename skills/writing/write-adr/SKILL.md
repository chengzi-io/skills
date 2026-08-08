---
name: write-adr
description: Write Architecture Decision Records (ADRs). Use when the user asks to create an ADR, document a technical decision, capture architecture rationale, or mentions ADR, architecture decision record, Nygard format. Also use when the user describes a significant technical choice (database, framework, protocol, auth model, cross-service contract) and you should suggest writing an ADR.
license: MIT
metadata:
  version: "2026.06.29"
---

# Write ADR

When a developer two years from now finds a strange design choice and asks "Why?", the ADR answers that question. Capture the decision while the context is still fresh, in a format that survives team turnover.

**Core Principle:** ADRs explain *why* a decision was made, not *how* it was implemented. Docs and code explain the "how"; ADRs preserve the reasoning.

## When to Write an ADR

Write an ADR when the decision meets **any one** of the following criteria:

| # | Criterion                                                                 | Typical Examples |
|---|---------------------------------------------------------------------------|------------------|
| 1 | The decision affects the system's **structure, major non-functional characteristics, dependencies, or interfaces** | Choosing a database, message queue, authentication architecture, or API style |
| 2 | There are **multiple viable options with meaningful trade-offs**          | SQL vs NoSQL, synchronous vs asynchronous, monolith vs microservices |
| 3 | The **cost of reversal is high** (changing it later would take days or more) | Replacing a core framework, major data model changes, changing cross-service contracts |
| 4 | Involves **uncontrollable external dependencies** or strong external constraints | Must use a specific vendor SDK, compliance or data residency requirements |
| 5 | Affects **multiple teams, systems, or components**                        | Shared event schema, cross-service API contracts, platform-level capabilities |
| 6 | The team is making **this type of decision for the first time**           | First time using event sourcing, first multi-region deployment, adopting a new language for the first time |
| 7 | Similar past decisions have caused **significant problems**               | Previous framework lock-in that made refactoring difficult, data models that resisted evolution |

**Do not write an ADR when**:
- The decision is already covered by existing team standards (IDE choice, formatting, naming conventions, etc.)
- It is a temporary workaround or proof-of-concept (PoC)
- It only affects internal implementation details within a single module
- It is low-risk and can be easily and cheaply reversed later

Spotify's rule: "Have you made a significant decision that impacts how engineers write software? Write an ADR."  
Grady Booch: "An architectural decision is a design decision that is costly to change." If reversal would take days rather than hours, write an ADR.

## Workflow

### 1. Check if the Decision Qualifies
Run through the "When to Write an ADR" criteria above. If none apply, tell the user and explain why. Do **not** generate ADRs for trivia — it dilutes the repository.

### 2. Determine the ADR Number
Find the highest existing number:
```bash
ls docs/architecture/decisions/ | sort | tail -1
```
Use the next sequential 4-digit number (start from `0001`). Never skip or reuse numbers. Create the directory if it does not exist.

### 3. Draft the ADR
Ask clarifying questions if context or trade-offs are unclear. Then write the ADR using this exact structure:

```markdown
# ADR-{NNNN}: Short noun phrase title

## Context
The forces at play — technological, organizational, political, project-local.
Describe the problem without prescribing the solution. What is the issue?
What constraints must any solution satisfy?

## Decision
"We will ..." (active voice, full sentences). State the chosen option clearly and unambiguously.

## Status
Proposed

## Consequences
**Positive:**
- What becomes easier?
- What risks are mitigated?

**Negative:**
- What becomes harder?
- What new constraints are introduced?
- What is the migration cost?

## Alternatives Considered
### [Option A — rejected]
- Why it was rejected

### [Option B — rejected]
- Why it was rejected
```

### 4. Review Against the Checklist
Before writing the file, verify every item:

- [ ] Title is a short noun phrase (not a sentence)
- [ ] Context describes the problem value-neutrally (does not prescribe the fix)
- [ ] Decision is written in "We will ..." active voice
- [ ] Negative consequences are listed honestly (not just upsides)
- [ ] Rejected alternatives are recorded with clear reasons
- [ ] Exactly one decision per ADR (split if you see "and also")

Recording rejected alternatives is the most valuable part. Future readers need to know what was considered and why it lost.

### 5. Place the File
Write to:
`docs/architecture/decisions/{NNNN}-{kebab-case-title}.md`

Example: `docs/architecture/decisions/0001-use-postgresql.md`

## Key Rules

### Accepted ADRs are Immutable
Never edit the content of an accepted ADR. When a decision changes, write a **new** ADR and update the old one's status:

```
Status: Superseded by ADR-0005 (see ./0005-use-mysql.md)
```

The decision history **is** the point. Editing accepted ADRs destroys it.

### Status Lifecycle
```
Proposed → Accepted → Deprecated
                ↓ ↑
             Superseded ───┘ (by new ADR with link)
```

| Status                  | Meaning                                      |
|-------------------------|----------------------------------------------|
| **Proposed**            | Under discussion, not yet agreed             |
| **Accepted**            | In effect, immutable                         |
| **Deprecated**          | No longer in effect (reversed, no replacement) |
| **Superseded by ADR-NNNN** | Replaced — must link to the new ADR       |

### One Decision Per ADR
Do not bundle multiple decisions. If decision A is superseded but B is not, they must live in separate ADRs with their own lifecycles.

### ADR vs Other Documents
- **Docs explain HOW.** ADRs explain **WHY**.
- An ADR references a design doc; it does not embed it.
- An ADR is a snapshot in time; READMEs and wikis change frequently.
- An RFC precedes the decision; the ADR captures the outcome.

## Anti-Patterns

| Don't do this                          | Do this instead                                      |
|----------------------------------------|------------------------------------------------------|
| Editing an accepted ADR                | Write a new ADR and mark the old one as Superseded   |
| Recording only the winner              | List all considered options with rejection reasons   |
| Hiding the trade-offs                  | Explicitly list negative consequences                |
| Combining many decisions in one ADR    | Split into separate ADRs                             |
| Writing ADRs weeks after the fact      | Write while the "why" is still fresh                 |
| Using ADRs as setup / how-to docs      | ADR = why; README/wiki = how                         |
| Writing ADRs alone without review      | Review with the team — ADR is a communication tool   |

## Sources
- Michael Nygard, "Documenting Architecture Decisions" (2011)
- adr.github.io
- Martin Fowler, "Architecture Decision Record"
- Spotify Engineering, "When Should I Write an ADR?" (2020)
- Bool.dev, "10 ADR Anti-Patterns" (2026)
- ThoughtWorks Technology Radar — Lightweight ADRs

**Usage note:** Always start by checking the decision criteria (Step 1). If the decision qualifies, guide the user through drafting while the context is fresh.
