# Large Repository Migration

Use this procedure only when the repository requires a substantial structural
migration that cannot be completed as one independently validated change.

Do not use this procedure for ordinary file moves, feature work, or a small
slice refactor.

## 1. Confirm migration mode

Migration mode requires at least one of:

* repository-wide restructuring;
* dismantling a large technical-layer tree;
* multiple business slices requiring coordinated migration;
* work that must be split into several independently validated batches;
* explicit requirement to pause, resume, and track migration state.

Do not infer migration mode from file count alone.

Three or more affected slices is an escalation signal, not a sufficient trigger.

If the work can be completed as one validated change, use normal Change mode.

## 2. Inspect before planning

Inventory the repository before moving code.

Find:

* business slice candidates;
* technical-layer trees;
* generic dumps;
* hidden implementation identities;
* parallel trees;
* framework-mandated boundaries;
* high-churn structural debt.

Do not move code during inventory.

## 3. Decide whether a plan is necessary

A migration plan is required when work contains multiple independent batches or
must persist state across interruptions.

For a small restructuring that can be completed in one coherent change, do not
create a plan.

Create the plan using the project's existing planning location when one exists.
Otherwise use:

```text
docs/plans/repo-layout-migration.md
```

## 4. Plan format

The plan is a migration ledger, not a copy of this skill.

```markdown
# Repository Layout Migration

## Goal

<target state>

## Scope

<areas included>

## Batches

### checkout

Status: pending

Current:
- ...

Target:
- ...

Validation:
- ...

Risks:
- ...

Human decisions:
- ...

### orders

Status: pending

...

## Blockers

- ...

## Completed

- ...
```

Track state, not rules.

## 5. Partition into batches

Prefer:

```text
one slice
→ one migration batch
→ one validation boundary
```

If a slice is too large, split by sub-capability.

Do not partition by technical layer:

```text
bad:
move all controllers
move all services
move all utils
```

Prefer:

```text
good:
migrate checkout/payment
migrate checkout/order-placement
migrate orders/refund
```

A batch should be:

* semantically coherent;
* independently understandable;
* independently testable;
* independently reviewable;
* safe to stop after completion.

## 6. Execute progressively

For each batch:

```text
read current plan
→ inspect target slice
→ derive target paths from repo-layout rules
→ identify hidden identities
→ move paths
→ fix references
→ run affected tests
→ validate contracts
→ inspect resulting tree
→ mark batch complete
→ update plan
→ choose next batch
```

Never process the entire migration graph at once.

Complete and validate one batch before starting the next.

## 7. Keep behavior stable

Unless explicitly requested, preserve:

* runtime behavior;
* routes;
* exports;
* schemas;
* serialization;
* public APIs;
* configuration contracts;
* database semantics;
* test semantics.

Separate structural migration from behavioral redesign.

## 8. Discoveries during migration

A migration batch may reveal new structural information.

Do not immediately expand the current batch.

Instead:

1. finish or safely stop the current batch;
2. record the discovery in the plan;
3. classify the discovery;
4. assign it to a later batch when possible.

This keeps batches bounded.

## 9. Human decisions

Stop only for decisions that cannot be resolved by repo-layout rules:

* new top-level slice;
* ambiguous domain naming;
* deletion/collapse of a major existing layer;
* incompatible framework constraint;
* genuine cross-slice architectural redesign.

Record the decision in the plan.

Do not re-open settled decisions.

## 10. Resume after interruption

When resuming:

1. read the migration plan;
2. identify the last completed batch;
3. inspect the repository state;
4. validate the last completed batch if necessary;
5. continue with the next pending batch.

Never assume repository state from the plan alone.

The filesystem and tests are authoritative for actual state.

## 11. Completion criteria

A migration is complete when:

* all planned batches are completed;
* remaining exceptions are explicit;
* required human decisions are recorded;
* affected tests pass;
* contracts remain intact;
* the resulting tree satisfies repo-layout grammar;
* the migration plan is closed.

Mark the plan complete only after the repository, not merely the plan, satisfies
the target structure.
