# skills

Personal Agent Skills: first-party packages plus optional third-party skills from GitHub.

## Install

```bash
npx skills add chengzi-io/skills
```

## Skills

Auto-generated from local `SKILL.md` + `dependencies.json` + `marketplace.json`. Do not edit by hand — run `pnpm readme`.

<!-- skills:table:start -->

| Skill | Plugin | Source | Description |
|-------|--------|--------|-------------|
| [`write-adr`](skills/writing/write-adr) | writing | local | Write Architecture Decision Records (ADRs). Use when the user asks to create an ADR, document a tech… |
| [`write-bdd`](skills/writing/write-bdd) | writing | local | Write, review, and implement BDD Gherkin .feature files and step definitions. Use when the user asks… |
| [`write-ears`](skills/writing/write-ears) | writing | local | Write and review EARS functional requirements and acceptance criteria. Use when the user asks to wri… |
| [`emil-design-eng`](skills/emil-design-eng) | web | emilkowalski/skills@main | This skill encodes Emil Kowalski's philosophy on UI polish, component design, animation decisions, a… |
| [`prototype`](skills/prototype) | web | emilkowalski/skills@main | Build multiple genuinely different versions of a UI piece you describe, rendered behind a visual pic… |
| [`grill-me`](skills/grill-me) | architecture | local | Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test … |
| [`screaming-architecture`](skills/screaming-architecture) | architecture | local | Organise and review package structure so directories scream business capabilities (package-by-featur… |
| [`write-skill`](skills/write-skill) | meta | local | Creates or updates Agent Skills following the current agentskills.io specification and guidance. Use… |

<!-- skills:table:end -->

## Manage

```bash
pnpm install
pnpm manage          # interactive: add / sync / remove / list / validate
pnpm sync            # pull upstream into local skill dirs
pnpm sync:check      # exit 1 if outdated or missing
pnpm validate        # deps + marketplace + frontmatter + README table
pnpm readme          # regenerate skills table above
```

`dependencies.json` is the source of truth for third-party sync. Empty list → sync is a no-op.

CI (`.github/workflows/sync-skills.yml`): Monday 06:00 UTC + manual dispatch; opens a PR when skill files or the README table change.

## Layout

| Path | Role |
|------|------|
| `skills/` | Skill packages (`SKILL.md` + assets) |
| `.claude-plugin/marketplace.json` | Plugin groups and skill paths |
| `dependencies.json` | Upstream sources for third-party skills |
| `scripts/manage.mjs` | Manager, CI sync, README table |
