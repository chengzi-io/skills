# Skill Quick Reference

Derived from the current `agentskills.io` docs corpus, centered on:

- `specification.md`
- `best-practices.md`
- `optimizing-descriptions.md`
- `evaluating-skills.md`
- `using-scripts.md`

## Frontmatter

- `name`
  - Required
  - 1-64 characters
  - Lowercase letters, numbers, hyphens
  - No leading or trailing hyphen
  - No consecutive hyphens
  - Must match the parent directory name

- `description`
  - Required
  - 1-1024 characters
  - Describe what the skill does and when to use it
  - Focus on user intent
  - Include likely trigger phrasing
  - Prefer wording like `Use this skill when ...`

- `license`
  - Optional
  - Keep short

- `compatibility`
  - Optional
  - Up to 500 characters
  - Use only for real environment requirements

- `metadata`
  - Optional
  - Arbitrary key-value mapping
  - Use reasonably unique keys

- `allowed-tools`
  - Optional
  - Experimental
  - Space-separated approved tool names
  - Example: `Bash(git:*) Bash(jq:*) Read`

## Progressive Disclosure

1. Discovery
   Agents typically see only `name` and `description`.

2. Activation
   Agents load the full `SKILL.md`.

3. Execution
   Agents load `scripts/`, `references/`, `assets/`, or other files only when needed.

Keep `SKILL.md` under 500 lines and roughly under 5,000 tokens.

## Directory Conventions

- `SKILL.md`
  Required.

- `scripts/`
  Use for repeated or deterministic logic.

- `references/`
  Use for detailed docs that should load conditionally.

- `assets/`
  Use for templates, images, or output resources.

- `evals/`
  Common convention for evaluation fixtures such as `evals/evals.json`.
  Useful, but not required by the spec.

Additional files or directories are allowed when they support the workflow.

## Body Design

- Keep only what the agent would otherwise miss
- Use defaults, not menus
- Explain why when judgment matters
- Be prescriptive for fragile or destructive actions
- Put local edge cases in a gotchas section
- Provide templates when output format matters
- Use checklists or validation loops for dependent workflows

## File References

- Use relative paths from the skill root
- Keep references directly linked from `SKILL.md`
- Avoid deep reference chains
- Prefer specific load conditions such as:
  `Read references/api-errors.md if the API returns a non-200 status code.`

## Script Guidance

- Prefer pinned one-off commands for simple cases
- Bundle a script when the helper logic is repeated or hard to get right ad hoc
- Scripts should be non-interactive
- Scripts should expose `--help`
- Prefer structured stdout and diagnostics on stderr
- Add safe defaults or `--dry-run` for risky operations

## Evaluation Reminders

- Trigger quality:
  use labeled should-trigger and should-not-trigger prompts, and run them multiple times

- Output quality:
  compare `with_skill` and `without_skill` runs, save artifacts, add assertions, and inspect traces

## Validation Tool

```bash
skills-ref validate ./my-skill
```
