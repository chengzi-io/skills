---
name: write-ears
description: Write and review EARS functional requirements and acceptance criteria. Use when the user asks to write requirements, document system behavior, create an EARS spec, or mentions requirements syntax, the system shall, functional spec, acceptance criteria, or requirement writing or review. Also use when reviewing a requirements document for completeness, ambiguity, or missing error cases.
license: MIT
metadata:
  version: "2026.06.29"
---

# Write EARS

EARS eliminates ambiguity, vagueness, complexity, omission, duplication, wordiness, inappropriate implementation detail, and untestability from functional requirements.

**Core Principle:** Every requirement must be verifiable by a black-box observer at the defined system boundary. Requirements describe *what* the system shall do, not *how* it is built internally.

## When to Use
Use for system-level functional requirements and acceptance criteria **at the system boundary**. Do **not** use for architecture decisions (see `write-adr` skill) or executable BDD scenarios (see `write-bdd` skill).

EARS and BDD are complementary: EARS defines the contract; BDD makes it executable. A `When <trigger>, the <system> shall <response>` maps naturally to Gherkin `When <trigger> Then <outcome>`.

## Workflow (Follow in Order)

### 1. Establish System Boundary
Define precisely what "the system" is and where its boundary lies. External actors, services, and hardware sit outside.

**Observability Test (run last):** Can a tester verify the response using only public interfaces, without reading source code, querying internal databases, or accessing logs?  
If the answer is no → rewrite until it is externally observable. If boundary is unclear, ask the user for clarification before drafting.

### 2. Elicit Raw Statements
Draw out desired behaviors without filtering.  
For **every** normal behavior, immediately ask: "What could go wrong, and how should the system respond?" Most missing requirements hide in error and edge cases.

### 3. Classify Each Statement
Apply this decision tree **in strict order**:

1. Has a trigger expected during normal operation? → **Event-Driven** (`When`)
2. Involves an error or condition that might occur? → **Unwanted Behavior** (`If`)
3. Applies only while in a given state? → **State-Driven** (`While`)
4. Applies only when a feature is enabled? → **Optional Feature** (`Where`)
5. Truly always true with zero preconditions? → **Ubiquitous** (`The system shall`)

Run the **Ubiquitous Triple-Check** before accepting #5:
- Is this really true with no trigger or precondition?
- Is there an unstated event that causes this?
- Could it be expressed more precisely as Event-Driven or State-Driven?

Most candidates that look ubiquitous are actually event- or state-driven.

### 4. Draft in EARS Form
- Assign ID: `FR-<DOMAIN>-NNNN` (functional) or `NFR-<DOMAIN>-NNNN` (non-functional). `DOMAIN` = 2–6 char uppercase domain shorthand (e.g. `AUTH`, `PAYMENT`). `NNNN` starts at `0001` per domain and never reuses numbers.
- Follow the exact pattern for the chosen classification.
- One concern per requirement — split at "and also" or compound logic.
- Use affirmative language: describe what the system *shall* do.
- Response must be observable at the system boundary.
- If > 2–3 preconditions or branching logic, attach a decision table below the sentence.

### 5. Review Against Quality Checklist
Run every requirement through the Quality Checklist below. Any unchecked item is a rewrite signal. Re-verify observability at the boundary.

### 6. Write the Document
Write to `docs/requirements/<domain>.md` (lowercase, e.g. `auth.md` for `FR-AUTH-0001`). The filename mirrors the `DOMAIN` used in requirement IDs. When writing BDD scenarios with `write-bdd` skill, this same domain becomes the feature directory: `features/auth/`. Keep domain consistent across EARS and BDD — they are two views of the same domain concept.

### 7. Output
- If **reviewing** (not authoring): output each finding with the specific requirement ID and a suggested rewrite. Do not write files unless asked.
- If **authoring**: confirm the written file path and provide a concise summary of requirements created (count by type and domain).

## Requirement Patterns

| Pattern          | Template                                      | Example                                                                 | When to Use |
|------------------|-----------------------------------------------|-------------------------------------------------------------------------|-------------|
| Ubiquitous      | `The <system> shall <response>`              | The mobile phone shall have a mass of less than 150 grams.             | Zero preconditions. Run Triple-Check first. |
| Event-Driven    | `When <trigger>, the <system> shall <response>` | When the user clicks Save, the system shall persist the form data.     | Trigger expected in normal operation. |
| State-Driven    | `While <state>, the <system> shall <response>` | While the aircraft is on the ground, the engine control system shall enable reverse thrust. | Behavior only valid in a particular state. `During` is equivalent. |
| Unwanted Behavior | `If <condition>, then the <system> shall <response>` | If the payment service is unavailable, then the system shall queue the order and retry within 5 minutes. | Error, fault, or edge condition that might occur. |
| Optional Feature | `Where <feature>, the <system> shall <response>` | Where dark mode is enabled, the system shall apply the dark color scheme. | Behavior applies only when an optional feature is active. |
| Combined        | `While <state>, When <trigger>, the <system> shall <response>` | While the aircraft is on the ground, when reverse thrust is commanded, the engine control system shall enable reverse thrust. | At most one of each clause type. |

### NFR Examples (Non-Functional Requirements)
Non-functional requirements follow the same patterns. Prefer `While` for load/quality attributes and Ubiquitous for absolute constraints.

- **State-Driven NFR**: While under 1,000 concurrent users, the API shall respond within 200 ms at p95.
- **Ubiquitous NFR**: The system shall encrypt all data at rest using AES-256 with keys managed by the platform KMS.

## Quality Checklist
Run every requirement through this list. Treat any unchecked item as a signal to rewrite.

- [ ] **Complete** — Sufficient detail for all normal flows, exceptions, and edge cases. No "TBD", "TBD later", or vague placeholders.
- [ ] **Single sentence / Single concern** — Exactly one behavioral concern. Split at "and", "also", or compound logic.
- [ ] **Observable at system boundary** — A black-box tester can verify the response using only external interfaces, without reading source code, querying internal databases, or inspecting logs.
- [ ] **Unambiguous** — No vague adjectives (fast, robust, scalable, user-friendly, intuitive, reliable, efficient, sufficient, flexible). Replace with measurable criteria or concrete definitions.
- [ ] **Feasible** — Technically and economically achievable within known constraints.
- [ ] **Necessary** — Delivers clear value to identified stakeholders.
- [ ] **Consistent** — Does not conflict with other requirements in the same document or related documents.

## Common Mistakes & How to Avoid Them

1. **Premature Ubiquitous**
   - Before writing `The <system> shall`, ask:
     1. Is this truly always true with absolutely no trigger or precondition?
     2. Is there an unstated event that causes this behavior?
     3. Could it be more precisely expressed as Event-Driven or State-Driven?
   - Most "ubiquitous" statements hide a trigger. Force the implicit condition into a `When` or `While` clause.

2. **Overloading a Single Sentence**
   - 3+ preconditions, multiple independent responses, or complex branching logic → split into multiple requirements **or** attach a decision table immediately below the sentence.
   - Readable prose + decision table beats forcing everything into one EARS sentence.

3. **Skipping or Vague System Boundary**
   - Without a crisp boundary definition, requirements drift into implementation or internal design.
   - Always define the boundary first. Re-verify observability as the final check.

4. **Missing Unwanted Behavior (Error Cases)**
   - For every normal `When` flow, explicitly ask "What if this fails or this condition occurs?"
   - Most omissions live in the error paths. Capture them as `If` requirements.

5. **Writing Design Instead of Requirements**
   - Requirements describe *what* must happen at the boundary.
   - Design describes *how* it is implemented inside.
   - If verification requires looking at code or DB state, rewrite until it is externally observable.

## When Not to Use Pure EARS

| Situation                        | Recommended Alternative                          |
|----------------------------------|--------------------------------------------------|
| Mathematical or algorithmic rules | Formula notation or pseudocode + EARS wrapper   |
| More than 3 independent preconditions | Numbered list or decision table (attach to EARS sentence) |
| Complex logical combinations (AND/OR/XOR across many conditions) | Decision table + short EARS reference sentence |
| Non-behavioral constraints (compliance, policy, legal) | Separate "Constraints" or "Assumptions" section / document |
| UI layout, visual design, branding | Separate style guide or design system docs      |

## Document Template

```markdown
# Requirements: <Feature Name>

## System Context

Briefly define the system boundary and the actors / external systems outside it.
List key assumptions that underpin the requirements below.

## Requirements

### FR-<DOMAIN>-0001 <Brief Title>
When <trigger>, the <system> shall <response>.

### FR-<DOMAIN>-0002 <Brief Title>
While <state>, when <trigger>, the <system> shall <response>.

### FR-<DOMAIN>-0003 <Brief Title>
If <condition>, then the <system> shall <response>.

### NFR-<DOMAIN>-0001 <Brief Title>
While <state>, the <system> shall <response>.

## Decision Table Example (attach below complex requirement)

### FR-AUTH-0003 Rate Limiting
When the rate limiter fires, the system shall return HTTP 429 with a Retry-After header.

| Window | Max Requests | Response                  |
|--------|--------------|---------------------------|
| 60s    | 100          | 429 Too Many Requests     |
| 3600s  | 10,000       | 200 (reset counter)       |
```

## Citation
Mavin et al., "Easy Approach to Requirements Syntax (EARS)", IEEE RE'09, DOI: 10.1109/RE.2009.9

---

**Usage note:** When the user asks for an EARS document, always start by confirming or establishing the system boundary (Step 1). Output the final document using the template above unless the user specifies a different location or format.
