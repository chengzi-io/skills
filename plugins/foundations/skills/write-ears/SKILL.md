---
name: write-ears
description: "Write and review EARS functional requirements and acceptance criteria. Use when the user asks to write requirements, document system behavior, create an EARS spec, or mentions requirements syntax, the system shall, functional spec, or acceptance criteria; also when reviewing a requirements document for completeness, ambiguity, or missing error cases. Also use when implementing or testing behavior in a project with docs/requirements/: acceptance tests must carry requirement IDs, and approved requirements must not be changed to make them pass."
license: MIT
metadata:
  version: "2026.11.06"
---

# Write EARS

**Core principle:** every requirement is verifiable by a black-box observer at the system boundary. Requirements state *what* the system shall do, never *how* it is built.

## When to Use

System-level functional requirements and acceptance criteria. Not for architecture decisions (see `write-adr`). EARS defines the contract; acceptance tests make it executable (see After Approval).

## Workflow

### 1. Establish the system boundary
Define what "the system" is. Actors, external services, and hardware sit outside. If the boundary is unclear, ask the user before drafting.

### 2. Elicit statements
Draw out desired behaviors without filtering. For every normal behavior, ask: "What could go wrong, and how should the system respond?" Most missing requirements are error and edge cases.

### 3. Classify each statement, in this order
1. Trigger expected in normal operation → **Event-Driven** (`When`)
2. Error or condition that might occur → **Unwanted Behavior** (`If`)
3. Holds only in a given state → **State-Driven** (`While`)
4. Holds only when a feature is enabled → **Optional Feature** (`Where`)
5. Always true with no precondition → **Ubiquitous**

Before accepting Ubiquitous, look for a hidden trigger or state. Most candidates have one and belong in `When` or `While`.

### 4. Draft
- ID: `FR-<DOMAIN>-NNNN` (functional) or `NFR-<DOMAIN>-NNNN` (non-functional). `DOMAIN` is a short uppercase name, letters only (`AUTH`, `PAY`, `BILLING`); `NNNN` starts at `0001` per domain.
- Use the exact pattern for the class. One concern per requirement: split at "and" or "also".
- The response must be verifiable through public interfaces alone, without reading source code, internal databases, or logs. Otherwise rewrite it.
- More than 2–3 preconditions or any branching: attach a decision table below the sentence.

### 5. Check
Recheck every requirement against step 4, and confirm it is:
- **Complete**: normal, error, and edge flows covered; no "TBD".
- **Unambiguous**: no vague adjectives (fast, robust, scalable, user-friendly, intuitive, reliable, efficient, sufficient, flexible); use measurable criteria.
- **Consistent** with the other requirements.

### 6. Write the document
Write to `docs/requirements/<domain>.md` (lowercase: `auth.md` for `FR-AUTH-0001`) using the template below.

### 7. Output
- **Reviewing**: list each finding with its requirement ID and a suggested rewrite. Do not write files unless asked.
- **Authoring**: confirm the file path, summarize counts by type and domain, and ask the user to approve the requirements.

## After Approval

Approved requirements are the contract the implementation is measured against.

- Never edit, weaken, or delete an approved requirement to make code or a test pass. If one looks wrong, stop and ask the user.
- When the user changes a requirement, keep its ID. IDs of removed requirements are never reused.
- Every FR gets at least one automated acceptance test (NFRs too, where they can be automated), written in the project's existing test framework and exercising the system boundary.
- Start each test name with the requirement ID: `FR-AUTH-0001 logs in with a valid password`, or `test_FR_AUTH_0001_...` / `TestFR_AUTH_0001_...` where names cannot contain hyphens. A test covering several requirements lists each ID.
- Unfinished work is a skipped test, never a deleted one.
- `requirements-status` turns test results into `docs/requirements/STATUS.md`. A requirement is done only when that report shows ✅.

## Patterns

| Pattern | Template | Example |
|---------|----------|---------|
| Event-Driven | `When <trigger>, the <system> shall <response>` | When the user clicks Save, the system shall persist the form data. |
| Unwanted Behavior | `If <condition>, then the <system> shall <response>` | If the payment service is unavailable, then the system shall queue the order and retry within 5 minutes. |
| State-Driven | `While <state>, the <system> shall <response>` | While a sync is running, the system shall disable the Sync button. |
| Optional Feature | `Where <feature>, the <system> shall <response>` | Where dark mode is enabled, the system shall apply the dark color scheme. |
| Ubiquitous | `The <system> shall <response>` | The API shall return all timestamps in ISO 8601 UTC. |
| Combined | `While <state>, when <trigger>, the <system> shall <response>` | While offline, when the user saves, the system shall mark the change as pending sync. |

`During` is equivalent to `While`. A combined requirement has at most one clause of each type.

NFRs use the same patterns: `While` for load or quality attributes, Ubiquitous for absolute constraints.
- While under 1,000 concurrent users, the API shall respond within 200 ms at p95.
- The system shall serve every endpoint over TLS 1.2 or later.

## Beyond Plain EARS

| Situation | Use instead |
|-----------|-------------|
| Mathematical or algorithmic rules | Formula or pseudocode, wrapped in an EARS sentence |
| Compliance, policy, or legal constraints | A separate Constraints section |
| UI layout, visual design, branding | Style guide or design-system docs |

## Document Template

```markdown
# Requirements: <Feature Name>

## System Context
The system boundary, the actors and external systems outside it, and key assumptions.

## Requirements

### FR-<DOMAIN>-0001 <Brief Title>
When <trigger>, the <system> shall <response>.

### FR-<DOMAIN>-0002 <Brief Title>
If <condition>, then the <system> shall <response>.

### FR-AUTH-0003 Rate limiting
When a client exceeds its request limit, the system shall return HTTP 429 with a Retry-After header.

| Window | Max requests |
|--------|--------------|
| 60 s   | 100          |
| 1 h    | 10,000       |

### NFR-<DOMAIN>-0001 <Brief Title>
While <state>, the <system> shall <response>.
```
