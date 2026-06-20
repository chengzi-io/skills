# `write-skill` Maintenance Guide

This file is for human or agent maintainers updating `skills/write-skill` itself.

The runtime skill stays in [`SKILL.md`](./SKILL.md). The two files in [`references/`](./references/) are compact support material for that runtime flow. This `README.md` exists because maintainers need a stable update playbook.

## Canonical Source of Truth

Start from the documentation index:

- `https://agentskills.io/llms.txt`

As of this update, the index points to these pages:

- `https://agentskills.io/client-implementation/adding-skills-support.md`
- `https://agentskills.io/clients.md`
- `https://agentskills.io/home.md`
- `https://agentskills.io/skill-creation/best-practices.md`
- `https://agentskills.io/skill-creation/evaluating-skills.md`
- `https://agentskills.io/skill-creation/optimizing-descriptions.md`
- `https://agentskills.io/skill-creation/quickstart.md`
- `https://agentskills.io/skill-creation/using-scripts.md`
- `https://agentskills.io/specification.md`

Read every page listed in `llms.txt` before changing this skill. Do not assume the set of pages is stable.

## File Responsibilities

- [`SKILL.md`](./SKILL.md)
  The runtime instructions an agent follows when asked to create or update a skill.

- [`references/spec-quick-ref.md`](./references/spec-quick-ref.md)
  A compact factsheet: field limits, directory conventions, progressive disclosure, script guidance.

- [`references/validation-checklist.md`](./references/validation-checklist.md)
  The pre-flight review checklist before shipping a new or updated skill.

- [`README.md`](./README.md)
  This maintainer-facing update guide. Keep procedural maintenance advice here, not in `SKILL.md`.

## Update Workflow

### 1. Refresh the docs corpus

Read `llms.txt`, then read every linked page. Track changes in these buckets:

- Spec changes
  - frontmatter fields
  - field limits
  - directory structure
  - file reference rules

- Authoring guidance changes
  - description and trigger advice
  - progressive disclosure limits
  - instruction-calibration patterns
  - gotchas, templates, checklists, validation loops

- Script guidance changes
  - recommended runtimes
  - version pinning guidance
  - self-contained script patterns
  - agent-friendly CLI design

- Evaluation guidance changes
  - trigger eval method
  - output-quality eval structure
  - `evals/evals.json` convention
  - benchmark and iteration workflow

- Client implementation changes that affect authors
  - discovery and activation assumptions
  - frontmatter/body delivery details
  - context compaction or resource-loading implications

### 2. Diff the docs against current local files

Check each local file for drift:

- `SKILL.md`: workflow, terminology, examples, and recommended defaults
- `references/spec-quick-ref.md`: hard constraints and compact reminders
- `references/validation-checklist.md`: final review gate
- `README.md`: maintenance procedure and source map

Preserve local opinions only when they are deliberate and still compatible with the official docs.

### 3. Update the smallest necessary surface

Use this rule:

- Put operational instructions for skill authors in `SKILL.md`
- Put terse factual reminders in `references/spec-quick-ref.md`
- Put ship-check items in `references/validation-checklist.md`
- Put maintainer process in `README.md`

Do not duplicate long passages across files.

### 4. Re-check examples and wording

When docs change, stale examples are often the first thing to rot. Verify:

- frontmatter examples still use supported fields
- naming examples still match current rules
- script examples still reflect current recommendations
- eval guidance still matches current file layout and terminology

Also remove any accidental noise:

- broken formatting
- typos
- non-ASCII artifacts introduced by accident
- duplicated guidance already moved to `references/`

### 5. Validate locally

Minimum checks:

- `wc -l skills/write-skill/SKILL.md` stays comfortably under `500`
- quick read-through to ensure `SKILL.md` still feels concise and actionable
- ensure `references/` files still match `SKILL.md`

If available in the environment:

- `skills-ref validate skills/write-skill`

If the update changed trigger or eval guidance materially, sanity-check the examples against the current docs again before finishing.

## What Usually Goes Stale

These are the common drift zones to review first:

- `description` guidance becoming too weak, too vague, or too old relative to current trigger advice
- missing mention of optional fields like `compatibility` or `allowed-tools`
- progressive disclosure limits or resource-loading guidance changing
- one-off command recommendations moving toward newer tool defaults
- script design advice missing non-interactive, `--help`, stdout/stderr, or safe-default guidance
- evaluation guidance missing trigger-rate testing or the `with_skill` vs `without_skill` comparison pattern

## Editing Rules for This Skill

- Keep `SKILL.md` lean; move reminders to `references/`
- Prefer concrete bullets over long prose
- Keep references directly loadable from `SKILL.md`
- Avoid turning this skill into a generic essay about Agent Skills
- Keep this `README.md` maintainers-only; do not stuff runtime guidance here

## Completion Checklist

- Read every page currently listed in `llms.txt`
- Updated `SKILL.md` for any behavior or workflow drift
- Updated `references/spec-quick-ref.md` for factual drift
- Updated `references/validation-checklist.md` for review-gate drift
- Updated this `README.md` if the maintenance process itself changed
- Ran at least the lightweight local checks
