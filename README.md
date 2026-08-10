# skills

Personal Agent Skills: first-party packages plus optional third-party skills from GitHub.

## Install

```bash
npx skills add chengzi-io/skills
```

## Skills

Auto-generated from local `SKILL.md` + `dependencies.json` + `marketplace.json`. Do not edit the table by hand.

<!-- skills:table:start -->

| Skill | Plugin | Source | Synced | Description |
|-------|--------|--------|--------|-------------|
| [`write-adr`](skills/writing/write-adr) | writing | local | — | Draft, review, or slim Architecture Decision Records (ADRs). Trigger on ADR, architecture decision, … |
| [`write-bdd`](skills/writing/write-bdd) | writing | local | — | Write, review, and implement BDD Gherkin .feature files and step definitions. Use when the user asks… |
| [`write-ears`](skills/writing/write-ears) | writing | local | — | Write and review EARS functional requirements and acceptance criteria. Use when the user asks to wri… |
| [`writing-openapi-specs`](skills/writing-openapi-specs) | writing | speakeasy-api/skills@master#d2eab59 | 2026-08-10 | Reference guide for OpenAPI specification best practices, naming conventions, and expressing complex… |
| [`emil-design-eng`](skills/emil-design-eng) | web | emilkowalski/skills@main#9075d17 | 2026-08-10 | This skill encodes Emil Kowalski's philosophy on UI polish, component design, animation decisions, a… |
| [`prototype`](skills/prototype) | web | emilkowalski/skills@main#9075d17 | 2026-08-10 | Build multiple genuinely different versions of a UI piece you describe, rendered behind a visual pic… |
| [`grill-me`](skills/grill-me) | architecture | local | — | Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test … |
| [`screaming-architecture`](skills/screaming-architecture) | architecture | local | — | Organise and review package structure so directories scream business capabilities (package-by-featur… |
| [`oapi-codegen-best-practices`](skills/golang/oapi-codegen-best-practices) | golang | local | — | Best practices for generating and wiring Go HTTP APIs with oapi-codegen (v2), covering strict-server… |
| [`write-skill`](skills/write-skill) | meta | local | — | Creates or updates Agent Skills following the current agentskills.io specification and guidance. Use… |

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

Each third-party entry tracks:

| Field | Meaning |
|-------|---------|
| `source.branch` / `tag` / `release` | Tracking policy (what to follow) |
| `resolved.sha` | Exact upstream commit currently on disk |
| `resolved.syncedAt` | When that commit was last installed/synced |

### When the skills table updates

| Trigger | Guarantee |
|---------|-----------|
| `pnpm manage` → Add / Sync / Remove | Manager rewrites the table before finishing (fails if markers missing) |
| `pnpm sync` (local + CI) | Always rewrites after pin/file updates |
| CI workflow | Extra `npm run readme` step; PR includes `README.md` + `dependencies.json` |
| `pnpm validate` | Fails if the table is stale (`pnpm readme -- --check`) |
| `pnpm readme` | Manual regenerate |

**Not automatic:** hand-adding a local skill, or editing `SKILL.md` / `marketplace.json` / `dependencies.json` outside the manager — run `pnpm readme` (or rely on `pnpm validate` before commit).

CI (`.github/workflows/sync-skills.yml`): Monday 06:00 UTC + manual dispatch; opens a PR when skill files, pins, or the README table change.

## Layout

| Path | Role |
|------|------|
| `skills/` | Skill packages (`SKILL.md` + assets) |
| `.claude-plugin/marketplace.json` | Plugin groups and skill paths |
| `dependencies.json` | Upstream sources for third-party skills |
| `scripts/manage.mjs` | Manager, CI sync, README table |
