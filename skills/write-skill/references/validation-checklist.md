# Validation Checklist

Review every new or modified skill against this list before finalizing.

## Frontmatter

- [ ] `name` matches the parent directory name exactly
- [ ] `name` uses only lowercase letters, numbers, and hyphens
- [ ] `name` does not start or end with a hyphen
- [ ] `name` has no consecutive hyphens (`--`)
- [ ] `name` is ≤ 64 characters
- [ ] `description` is ≤ 1024 characters and non-empty
- [ ] `description` describes both what the skill does AND when to use it
- [ ] `description` focuses on user intent, not internal implementation
- [ ] `description` includes specific trigger phrasing or likely task language
- [ ] `compatibility` is included only if the skill has real environment requirements (≤ 500 chars)
- [ ] `metadata` keys are reasonably unique to avoid accidental conflicts
- [ ] `allowed-tools` uses space-separated format if included (experimental)

## Body Content

- [ ] Skill file is ≤ 500 lines (move excess to `references/`)
- [ ] Instructions are step-by-step and actionable (not vague advice)
- [ ] Gotchas section captures non-obvious, environment-specific facts
- [ ] Templates provided where output format matters (not prose descriptions)
- [ ] Default tools/approaches are specified, alternatives mentioned briefly
- [ ] Explanations are included where the model needs judgment, not generic background
- [ ] Content the agent already knows is removed (no explaining basic concepts)
- [ ] Reference files are loaded conditionally: "Read references/X.md if <condition>"

## Calibration

- [ ] Flexible where multiple approaches work (explain the *why*)
- [ ] Prescriptive where operations are fragile or destructive
- [ ] Checklists used for multi-step workflows with dependencies
- [ ] Validation loops included where self-checking is feasible
- [ ] The skill feels like one coherent unit of work, not a grab bag

## Scripts and Commands

- [ ] Simple one-off commands are pinned when reproducibility matters
- [ ] Bundled scripts are used only when they remove real repeated complexity
- [ ] Scripts are non-interactive
- [ ] Scripts expose `--help` or otherwise document usage clearly
- [ ] Scripts emit clear error messages
- [ ] Structured output is preferred where practical
- [ ] Diagnostics go to stderr when practical
- [ ] Destructive scripts have safe defaults, confirmation, or `--dry-run` as appropriate

## Trigger Quality

- [ ] Read the description and ask: would an agent correctly activate this skill for intended tasks?
- [ ] Would an agent skip this skill for unrelated tasks? False positives are just as problematic as false negatives.
- [ ] If the description changed materially, test should-trigger and should-not-trigger prompts instead of relying on intuition

## Evaluation and Iteration

- [ ] Remind the user: the first draft needs real-execution refinement
- [ ] Suggest running the skill against a real task and reading execution traces
- [ ] If output quality matters, compare `with_skill` and `without_skill` behavior
- [ ] If the skill is long-lived or important, consider `evals/evals.json` with prompts, expected outputs, optional files, and assertions
- [ ] Repeated mistakes from real runs are captured back into the skill, usually in gotchas or validation steps
- [ ] Point to [evaluating skills](https://agentskills.io/skill-creation/evaluating-skills) for systematic iteration
