---
name: screaming-architecture
description: >
  Organise and review package structure so directories scream business capabilities
  (package-by-feature / vertical slices), not technical layers. Use when placing new
  code, adding packages or modules, restructuring an existing tree, reviewing folder
  layout, planning a feature-first migration, or when the user mentions screaming
  architecture, package by feature, feature-first, vertical slice, or "where does
  this code go".
---

# Screaming Architecture

Make the tree **scream** what the product does. Package by **slice** (capability), and **nest** technical detail under the slice that owns it.

A glance at top-level packages should answer: *what is this software?* — not *which framework is this?*

## Glossary

Use these terms exactly.

| Term | Meaning |
|------|---------|
| **Scream** | Package names communicate product capability. `orders`, `billing`, `auth` scream; `controllers`, `services`, `utils` do not. |
| **Slice** | A vertical unit of capability that owns its code end-to-end. Scale-agnostic: package, module, or folder cluster. |
| **Nest** | Put delivery detail and strategy variants *inside* the owning slice. Layers are local, not top-level. |
| **Kernel** | Truly shared, policy-free utilities only. If it encodes business rules, it belongs in a slice. |

## Modes

Infer mode from the task. Run one mode fully before switching.

| Mode | When | Done when |
|------|------|-----------|
| **Place** | New code, new package, "where does this go?" | Path chosen; scream test passes for every new name |
| **Review** | Existing tree, refactor, migration plan | Findings ranked; target tree sketched; next moves concrete |

---

## Place

### Steps

1. **Name the capability** in product language (what the user/system can *do* or *own*), not a technical role.
2. **Find the home slice** — match an existing top-level slice, or justify a new one (new capability, not a new layer).
3. **Decide depth** inside the slice:
   - same slice, flat files — default when small
   - **sub-capability** folder — a durable sub-job of the slice (`orders/fulfillment`)
   - **variant** folder — interchangeable strategies/adapters for one job (`payments/stripe`, `payments/paypal`)
4. **Put the file there.** Local layering (handler next to service next to repo *inside* the slice) is fine. Promoting those names to the top level is not.
5. **Scream test** the full path: a newcomer reading only the path can say what this code is for.

### Placement rules

- Top-level names are **slices** (capabilities). Technical roles nest under them.
- Multiple implementations of one job → sibling **variant** packages under that job, not a top-level dump of formats/engines.
- Prefer growing an existing slice over inventing a peer named for a technique (`parsers/`, `helpers/`, `managers/`).
- **Kernel** only for cross-slice utilities with no domain policy. When in doubt, keep it in the slice.
- A new top-level package needs a capability story. "It felt crowded" is not enough — nest first.

### Path shape

```text
{slice}/[{sub-capability}/][{variant}/]{file}
```

Good: `billing/invoices/pdf.go`, `auth/oauth/google/`, `catalog/search/`  
Weak: `services/invoice_service.go`, `utils/pdf.go`, `controllers/auth_controller.go`

---

## Review

### Steps

1. **Map screams** — list top-level packages; label each *slice*, *kernel*, *platform/edge*, or *layer leak*.
2. **Find layer leaks** — top-level (or near-top) names that are roles/tools (`controller`, `service`, `repository`, `model`, `dto`, `util`, `common`, `helper`) owning business code.
3. **Find homeless policy** — business rules living in kernel/shared/platform instead of a slice.
4. **Find false slices** — packages named like capabilities but only holding pass-throughs, or one concept shattered across many layer folders.
5. **Sketch the target tree** — same capabilities, slices first, detail nested. Keep platform/edge thin if the stack requires it.
6. **Sequence moves** — small batches: move by slice (or by sub-capability), keep behaviour green, delete emptied layer packages last.

### Review output (default)

Keep it short:

1. **Scream read** — one sentence: what a stranger thinks this app is, from top-level names alone.
2. **Findings** — ranked list (leak / homeless policy / false slice / good slice to keep).
3. **Target tree** — condensed; only the parts that change.
4. **Next 3 moves** — concrete renames/moves, lowest risk first.

Expand into a full migration plan only if asked.

### Review rules

- Prefer **rename + move** over rewriting behaviour.
- Preserve working vertical paths while migrating; facades are temporary, not a new architecture.
- Do not propose microservices because folders are messy — fix the tree first (modular monolith by slice).
- Scorecards and long rubrics are optional; default is findings + target + next moves.

---

## Both modes

**Completion criterion:** every package on the path under discussion either (a) names a capability/sub-capability/variant a domain person would recognize, or (b) is an explicitly thin platform/edge adapter, or (c) is kernel utility with no policy.

**Out of scope here:** module *depth* and seam design (interface shape, testability) — use a deep-module / codebase-design practice for that. This skill is about *where code lives and what the tree says*.
