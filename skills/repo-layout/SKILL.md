---
name: repo-layout
description: >
  Decide, create, move, rename, refactor, and inspect repository paths so the
  tree expresses business capabilities and real implementation identities
  instead of technical layers. Use when adding features, creating or moving
  files, choosing folder or file names, changing layout, or reviewing a PR,
  diff, or tree. Trigger when code would land in generic or technical
  locations such as utils, helpers, common, controllers, services,
  repositories, or a file hiding a provider, channel, actor, SDK, protocol,
  payload shape, or vendor-specific behavior. Also use for package-by-feature,
  vertical slices, screaming architecture, colocation, 整理目录, 项目结构,
  目录结构, 文件放哪, 重构目录, 目录迁移. For large repository-wide structural
  migration, load `refs/migration.md` and create a migration plan only when
  the task genuinely requires multiple independently validated batches. Skip
  unrelated bugfixes, algorithms, copies, dependency bumps, and changes that
  create no new path or structural identity.
license: MIT
metadata:
  version: "2026.08.24"
---

# Repo layout

Treat the repository tree as architecture.

Apply the same rules whether creating, moving, refactoring, or inspecting code.

This skill decides where code lives. Implementation, testing strategy, and
deployment are outside its scope.

## 1. Path grammar

Ignore mount prefixes such as:

```text
src/
app/
lib/
packages/<name>/
```

Every semantic path must parse as:

```text
{slice}/{sub-capability?}/{variant?}/{leaf}
```

| Slot             | Meaning                                                         |
| ---------------- | --------------------------------------------------------------- |
| `slice`          | top-level business capability                                   |
| `sub-capability` | business concept inside the slice                               |
| `variant`        | real provider, channel, actor, protocol, or implementation face |
| `leaf`           | one use case or one concept                                     |

Maximum four semantic segments.

Valid:

```text
checkout/place.ts
checkout/payment/charge.ts
checkout/payment/stripe/charge.ts
checkout/http/submit.ts
```

Invalid:

```text
controllers/refund.ts
checkout/services/refund.ts
checkout/payment/stripe/services/charge.ts
```

Every semantic segment must have one clear meaning.

If a segment cannot be classified, choose another path.

## 2. Core rules

### Business meaning first

Prefer:

```text
orders/
payments/
identity/
checkout/
```

over:

```text
services/
models/
repositories/
helpers/
```

### Identity must be visible

If code is materially specific to a provider, vendor, channel, actor, SDK,
protocol, payload shape, webhook, or other implementation identity, expose that
identity in the path.

```text
checkout/payment/stripe/charge.ts
```

not:

```text
checkout/payment/charge.ts
```

when the latter contains Stripe-specific behavior.

**Name identity before writing identity-specific code.**

Do not wait for a second provider.

### Technical roles do not define directories

Do not create structural directories such as:

```text
controllers/
services/
repositories/
handlers/
models/
views/
hooks/
helpers/
utils/
common/
misc/
dto/
entities/
usecases/
interactors/
infrastructure/
adapters/
```

The rule is semantic:

> A technical role must not be the reason a directory exists.

### Reuse existing slices

Search before creating a slice.

Do not create parallel trees for the same business capability.

### Do not invent structure

Do not create:

* empty identity directories;
* hypothetical provider directories;
* arbitrary intermediate folders;
* hierarchy added only for aesthetics.

Structure should reflect concepts that already exist.

### Colocate behavior

Code that changes together belongs together.

Do not split one use case across technical layers.

Tests stay with the concept:

```text
checkout/payment/stripe/charge.ts
checkout/payment/stripe/charge.test.ts
```

### Siblings must be the same kind

Good:

```text
orders/
  create.ts
  cancel.ts
  refund.ts
```

Good:

```text
checkout/payment/
  stripe/
  paypal/
```

Bad:

```text
orders/
  create.ts
  http/
  StripeService.ts
  helpers/
```

Do not mix use cases, variants, and technical roles at one level.

### Do not repeat nouns

Prefer:

```text
orders/create.ts
```

over:

```text
orders/create_order.ts
```

Follow the repository's existing naming convention, including singular or
plural slice names.

### Promote only when needed

Start with:

```text
checkout/place.ts
```

Promote to:

```text
checkout/place/
  place.ts
  place.test.ts
```

only when the concept needs multiple colocated files.

### Shared code needs a real concept

Prefer:

```text
money/
clock/
address/
```

over:

```text
shared/
common/
utils/
```

when the code represents a real shared concept.

Code shared by several variants inside a slice belongs at the sub-capability
level, above the variants: `checkout/payment/charge.ts` for provider-agnostic
logic, `checkout/payment/stripe/charge.ts` only for Stripe-specific logic.

### Entrypoints are not business slices

HTTP, worker, CLI, cron, and similar boundaries are delivery/process concerns.

Keep delivery faces with their slice where possible:

```text
checkout/http/...
checkout/worker/...
```

A delivery channel is a variant, not a technical role: `checkout/http/` and
`checkout/worker/` are valid, while `handlers/`, `controllers/`, and
`views/` are not.

Preserve framework-mandated layouts when tooling requires them.

---

## 3. Placement procedure

The normal path for every new, moved, or renamed path.

### 3.1 Find the slice

Strip the mount prefix.

Reuse the nearest existing business slice.

### 3.2 Classify directories

For every middle segment:

```text
business concept      → sub-capability
implementation face   → variant
neither               → invalid
```

### 3.3 Detect identity

Inspect the implementation for concrete identity:

```text
provider SDKs
vendor types
proprietary payloads
protocol-specific behavior
channel/actor branches
provider === ...
vendor-specific errors
```

If identity exists, expose it in the path.

### 3.4 Check scope

Normal work stays within:

```text
one slice
+ optional sub-capability
+ optional variant
```

If the work spans several slices, pause and determine whether it is:

* still one coherent change — continue; or
* a larger migration — take the migration path (section 5).

**Three or more slices is an escalation signal, not a trigger.** First
determine whether the work can be reduced to one coherent change.

Do not automatically create a migration plan.

### 3.5 Create the smallest valid path

No speculative hierarchy.

No technical layer.

No unnecessary depth.

### 3.6 Execute the change

With the path decided:

```text
create/move/rename
→ fix references
→ verify with existing tests
→ final check (section 7)
```

A layout change should preserve unless explicitly requested otherwise:

```text
runtime behavior
routes
exports
schemas
serialization
public APIs
configuration contracts
```

A move is not a rewrite.

The skill ends here.

---

## 4. Read-only inspection

Use for PRs, diffs, trees, or completed changes.

Do not modify code unless requested.

Apply the same rules — run the placement procedure in reverse over the
existing paths.

Check:

1. Does every changed or suspicious path parse?
2. Does every semantic directory express business meaning or real identity?
3. Is concrete identity visible in the path?
4. Are related behaviors colocated?
5. Are siblings the same kind?
6. Did a technical role become a structural boundary?
7. Did the change stay within its intended slice?
8. Did tests stay with the concept?
9. Did structural moves preserve contracts?

For a diff, focus on problems introduced or exposed by the change.

Do not turn inspection into unrelated cleanup.

Output:

| Path                       | Verdict | Reason                          |
| -------------------------- | ------- | ------------------------------- |
| `checkout/payment/stripe/` | pass    | Identity is explicit            |
| `src/utils/stripe.ts`      | stop    | Provider hidden in generic role |

Verdicts:

* `pass` — conforms;
* `smell` — structural weakness but not blocking;
* `stop` — invalid placement or human architectural judgment required.

For repository-wide inspection, summarize findings by slice; when the work
qualifies as a large migration, take the migration path (section 5).

---

## 5. Migration path

Use only after the scope check (3.4) decides the work is too large for one
coherent change.

1. inspect first;
2. load `refs/migration.md`;
3. create a migration plan only when required;
4. migrate incrementally.

That reference defines:

* repository inventory;
* migration planning;
* progressive batching;
* batch boundaries;
* validation;
* interruption/resume;
* migration-plan lifecycle.

**A plan file is optional for small restructuring and required only when the
migration needs multiple independently validated batches or explicit state
tracking.**

---

## 6. Human decisions

Ask only when a deterministic rule cannot decide:

* creating a genuinely new top-level slice;
* ambiguous domain vocabulary with no established project term;
* a change spanning several slices that may require architectural redesign;
* deleting or collapsing an established layer tree;
* a framework constraint conflicts with the target grammar.

Do not ask for deterministic placement decisions already defined above.

Record explicit migration decisions in the migration plan when one exists.

---

## 7. Final check

Before completing a normal change:

```text
Can an agent infer the purpose from the path?
Does every directory express business meaning or real identity?
Is concrete identity visible where it exists?
Are related behaviors colocated?
Did I avoid speculative structure?
Did I stay within the intended slice?
Did tests follow the concept?
Did I preserve behavior and public contracts?
```

Before completing an inspection:

```text
Did I apply the same rules used for placement?
Did I limit findings to the requested scope?
Did I distinguish smell from stop?
```

If a required answer is no, fix or report the issue before completing the task.

## Do not

* Start a large migration merely because several slices are involved.
* Create a migration plan for a localized change.
* Move repository-wide code in one unvalidated pass.
* Hide provider/channel/actor/protocol identity in generic files.
* Create empty identity directories.
* Wait for a second vendor before naming the first real vendor.
* Split one use case into controllers/services/repositories.
* Add `commands/`, `use-cases/`, or `actions/` merely to classify verbs.
* Add depth without semantic meaning.
* Turn structural migration into behavior redesign.
* Expand into implementation, testing strategy, or deployment.
* Maintain separate Audit and Review rule sets.
