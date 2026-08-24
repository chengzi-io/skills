# Skill evals: repo-layout

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

1. **with_skill**: force-read `../SKILL.md`. Read `../references/sources.md` only if the user asked why or wanted citations. Then answer `prompt`.
2. **without_skill**: ban reading this skill directory; answer from general knowledge.
3. Grade each assertion true/false with evidence quoted from the answer. Case passes only if all its assertions pass.
4. Hypothetical trees only — do not edit the skills repo.

Prefer isolated subagents (cheap: `OpenCode/mimo-v2.5` or `OpenCode/deepseek-v4-flash`) so each case starts clean. Skill must work on cheap models; smart models (`grok-4.5` / `grok-4.6`) are for grading or stubborn failures.

Assertions that pass in **both** modes are not evidence the skill helps — drop or harden them. Failures that appear only **with** skill are skill bugs (ambiguous rule, hidden in `sources.md`, or over-constraint).

## Loop

Failed with-skill assertion → fix the **class** of rule in `SKILL.md` (one home, no one-off patches) → re-run that case → stop when with-skill is green or the leftover miss is model noise.

## Latest snapshot

See `results/latest.json` and the full report it points at.

| Mode | Result |
|------|--------|
| Trigger | 19/19 |
| with_skill (`OpenCode/mimo-v2.5`) | 10/10 cases, 60/60 assertions |
| without_skill (`OpenCode/deepseek-v4-flash`) | 3/10 cases, 46/60 assertions |

Largest skill delta: **place-refund** (new code goes in a slice, not `controllers/`), **review-only** (required block + layer leaks), **wrong-ai-layout** (no DDD cake, no `shared/` on day one).
