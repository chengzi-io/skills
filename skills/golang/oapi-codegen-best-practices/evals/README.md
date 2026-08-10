# Skill evals: oapi-codegen-best-practices

## Layout

| Path | Role |
|------|------|
| `evals.json` | Quality cases: prompts + binary assertions; modes `with_skill` / `without_skill` |
| `trigger.json` | Auto-invoke cases: description-only YES/NO gold labels |
| `results/` | Graded runs (timestamped + `latest.json` pointer) |

## How to run (manual / subagent)

### Trigger

1. Give the model **only** `skill_name` + `skill_description` from `trigger.json` (not `SKILL.md` body).
2. For each case, ask: load this skill? `YES`/`NO` + short reason.
3. Score agreement with `gold`.

### Quality

1. **with_skill**: force-read `../SKILL.md` and needed `../reference/*`, then answer `prompt`.
2. **without_skill**: ban reading this skill directory; answer from general knowledge.
3. Grade each assertion true/false; case passes only if all its assertions pass.

Prefer subagents (e.g. `OpenCode/deepseek-v4-flash`) over one-shot CLI if that is the project harness.

## Latest snapshot

See `results/latest.json` and the full report it points at.
