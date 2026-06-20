---
name: write-skill
description: |
  Creates or updates Agent Skills following the current agentskills.io specification and guidance.
  Use this skill when creating a new skill, refactoring an existing skill, improving trigger descriptions,
  organizing scripts/references/assets, or setting up skill evals and maintenance.
license: MIT
metadata:
  version: "0.1.0"
  source: https://agentskills.io/llms.txt
---

# Write Skill

Create or update skills using the current Agent Skills documentation at `agentskills.io`.

## What to Produce

- A skill directory rooted at `skill-name/`
- A concise `SKILL.md` with frontmatter and operational instructions
- Optional `scripts/`, `references/`, `assets/`, and `evals/` only when they remove real ambiguity or repeated work
- Updated quick references or validation artifacts if the skill already exists

## Workflow

### Step 1: Start from Real Expertise

Before drafting, identify:

1. The concrete task the skill should handle
2. The source of truth: prior conversation, runbook, codebase, schemas, API docs, style guides, failure cases
3. The corrections an agent would need that it would not infer on its own
4. Whether the skill needs deterministic scripts, references, assets, or eval fixtures

Prefer extracting a skill from a real successful task or real project artifacts. Generic advice without local context usually produces weak skills.

### Step 2: Define the Skill Boundary

Keep the skill to one coherent unit of work.

- Too narrow: multiple skills would need to activate for one normal task
- Too broad: the description becomes fuzzy and false-triggers
- Good boundary: the workflow, tools, and output conventions naturally belong together

### Step 3: Name the Skill

Follow the spec:

- 1-64 characters
- Lowercase letters, numbers, and hyphens only
- No leading or trailing hyphen
- No consecutive hyphens
- The directory name must match `name`

Prefer short action-oriented names such as `write-skill`, `pdf-processing`, `code-review`, or `roll-dice`.

### Step 4: Write the Description for Triggering

The `description` field carries most of the activation burden because agents usually see it before the full body.

Write it as guidance to the agent:

- Say what the skill does and when to use it
- Focus on user intent, not the internal implementation
- Include likely trigger terms and nearby phrasing
- Be slightly pushy about relevant cases, including cases where the user does not name the domain directly
- Keep it concrete and under 1024 characters

Use wording like `Use this skill when ...`.

If the task is to improve an existing skill, test the description with labeled positive and negative prompts rather than editing it by intuition alone.

### Step 5: Design the `SKILL.md` Body

Keep only what the agent would otherwise miss.

Prefer these patterns when they fit:

- Step-by-step workflow for the happy path
- Gotchas for non-obvious local facts
- Input/output examples when transformations matter
- Output templates when format matters
- Checklists for dependent multi-step workflows
- Validation loops: do work, validate, fix, re-run
- Plan-validate-execute for destructive or batch operations

Calibrate control to the task:

- Give freedom when multiple approaches are valid and judgment matters
- Be prescriptive when operations are fragile, destructive, or sequence-sensitive
- Provide defaults, not menus
- Explain why when reasoning helps the model choose well
- Cut background the model already knows

### Step 6: Use Progressive Disclosure

Keep the skill lean:

- Keep `SKILL.md` under 500 lines and roughly under 5,000 tokens
- Move detailed material into `references/`
- Tell the agent exactly when to read each reference file
- Keep references one level deep from `SKILL.md`
- Link directly from `SKILL.md`; avoid long reference chains

Use supporting directories deliberately:

- `scripts/` for repeated or deterministic logic
- `references/` for detailed docs loaded on demand
- `assets/` for templates, images, sample files, or other output resources
- `evals/` when the skill needs repeatable trigger or output evaluation. A common convention is `evals/evals.json`.

Any other directories are allowed by the format, but do not add clutter that does not help the workflow.

### Step 7: Decide Between One-Off Commands and Bundled Scripts

For simple tool invocations, a pinned one-off command may be enough.

Examples of reasonable defaults:

- `uvx` or `uv run` for Python tooling and self-contained Python scripts
- `npx` for Node-based CLIs
- `bunx` for Bun-based environments
- `deno run` for Deno scripts
- `go run` for one-off Go tools

Bundle a script in `scripts/` when the agent keeps reinventing the same helper logic or when deterministic behavior matters.

If a skill uses scripts, require these qualities:

- Non-interactive operation
- `--help` usage output
- Clear error messages
- Structured stdout where possible
- Diagnostics sent to stderr
- Safe defaults and `--dry-run` for destructive actions when applicable
- Explicit prerequisites in the body or `compatibility`

### Step 8: Write Frontmatter

Required:

- `name`
- `description`

Optional, only when they add real value:

- `license`
- `compatibility`
- `metadata`
- `allowed-tools` (experimental)

See `references/spec-quick-ref.md` for constraints and reminders.

### Step 9: Validate

Before finalizing:

1. Review `references/validation-checklist.md`
2. Review `references/spec-quick-ref.md`
3. If available, run `skills-ref validate ./skill-name`
4. Verify the description against should-trigger and should-not-trigger prompts
5. If output quality matters, compare `with_skill` and `without_skill` runs and inspect traces

### Step 10: Iterate with Real Execution

The first draft is rarely the last draft.

- Read execution traces, not just final outputs
- Add recurring corrections to the gotchas section
- Tighten defaults if traces show wandering or repeated dead ends
- Remove instructions that cost context without changing outcomes
- Bundle repeated helper logic into `scripts/`
- Prefer general fixes over patches for one eval prompt

## When to Load Support Files

- Load `references/spec-quick-ref.md` when you need a compact reminder of fields, limits, directory conventions, or script guidance.
- Load `references/validation-checklist.md` before finalizing a new or updated skill.
- Open `README.md` when maintaining this `write-skill` itself against future `agentskills.io` documentation changes.

## Quick Reference

For detailed field specifications and validation rules, use the two files in `references/`.
