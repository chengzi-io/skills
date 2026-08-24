# Skill evals: repo-layout

## Layout

| Path | Role |
|------|------|
| `evals.json` | Quality cases + `track` (`place` / `improve`); modes `with_skill` / `without_skill` |
| `trigger.json` | Auto-invoke cases: description-only YES/NO gold labels |
| `results/` | Graded runs (timestamped + `latest.json` pointer) |

`place` = default Place (new project / module / file). `improve` = Review / Cleanup / Migrate; with_skill must follow SKILL.md first-match Track and load `references/improve.md` for those tracks. Place answers include a human-readable layout decision (path + why + left alone).

## How to run (manual / subagent)

### Trigger

1. Give the model **only** `skill_name` + `skill_description` from `trigger.json` (not `SKILL.md` body).
2. For each case, ask: load this skill? `YES`/`NO` + short reason.
3. Score agreement with `gold`.

### Quality

1. **with_skill**: read `../SKILL.md`, then follow its first-match Track table (`../references/improve.md` when Review / Cleanup / Migrate). `../references/sources.md` only if the user asked why.
2. **without_skill**: ban reading this skill directory; answer from general knowledge.
3. Grade each assertion true/false with evidence. Case passes only if all its assertions pass.
4. Hypothetical trees only — do not edit the skills repo.

Prefer isolated subagents (cheap: `OpenCode/mimo-v2.5` or `OpenCode/deepseek-v4-flash`). Skill must work on cheap models.

Assertions that pass in **both** modes are not evidence the skill helps. Failures that appear only **with** skill are skill bugs (ambiguous rule, hidden in `sources.md`, or over-constraint).

## Loop

Failed with-skill assertion → fix the **class** of rule in `SKILL.md` or `references/improve.md` (one home, no one-off patches) → re-run that case.

## Latest snapshot

See `results/latest.json` and the full report it points at.

| Mode | Result |
|------|--------|
| Trigger | 21/21 |
| with_skill sampled (`OpenCode/mimo-v2.5`) | place-refund, review-only, execute-from-plan green; shared-junk + full-cleanup-plan green after one fix each |
