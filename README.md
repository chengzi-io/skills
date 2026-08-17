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
| [`emil-design-eng`](skills/emil-design-eng) | design | emilkowalski/skills@main#9075d17 | 2026-08-10 | This skill encodes Emil Kowalski's philosophy on UI polish, component design, animation decisions, a… |
| [`frontend-design`](skills/frontend-design) | design | anthropics/skills@main#f17010c | 2026-08-10 | Guidance for distinctive, intentional visual design when building new UI or reshaping an existing on… |
| [`prototype`](skills/prototype) | design | emilkowalski/skills@main#9075d17 | 2026-08-10 | Build multiple genuinely different versions of a UI piece you describe, rendered behind a visual pic… |
| [`web-design-guidelines`](skills/web-design-guidelines) | design | vercel-labs/agent-skills@main#7c180d9 | 2026-08-10 | Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check acc… |
| [`shadcn`](skills/shadcn) | frontend | shadcn/ui@main#deda4df | 2026-08-10 | Manages shadcn components and projects — adding, searching, fixing, debugging, styling, and composin… |
| [`vercel-composition-patterns`](skills/vercel-composition-patterns) | frontend | vercel-labs/agent-skills@main#7c180d9 | 2026-08-10 | React composition patterns that scale. Use when refactoring components with boolean prop proliferati… |
| [`vercel-react-best-practices`](skills/vercel-react-best-practices) | frontend | vercel-labs/agent-skills@main#7c180d9 | 2026-08-10 | React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be … |
| [`domain-modeling`](skills/domain-modeling) | architecture | mattpocock/skills@main#8b78b53 | 2026-08-14 | Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or edi… |
| [`grill-with-docs`](skills/grill-with-docs) | architecture | mattpocock/skills@main#068b6e0 | 2026-08-17 | A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as … |
| [`grilling`](skills/grilling) | architecture | local | — | Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test … |
| [`improve-codebase-architecture`](skills/improve-codebase-architecture) | architecture | mattpocock/skills@main#068b6e0 | 2026-08-17 | Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill throug… |
| [`screaming-architecture`](skills/screaming-architecture) | architecture | local | — | Organise and review package structure so directories scream business capabilities (package-by-featur… |
| [`oapi-codegen-best-practices`](skills/golang/oapi-codegen-best-practices) | golang | local | — | Best practices for generating and wiring Go HTTP APIs with oapi-codegen (v2), covering strict-server… |
| [`write-skill`](skills/write-skill) | meta | local | — | Creates or updates Agent Skills following the current agentskills.io specification and guidance. Use… |
| [`tdd`](skills/tdd) | development | mattpocock/skills@main#068b6e0 | 2026-08-17 | Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions … |

<!-- skills:table:end -->

## Manage

```bash
pnpm install
pnpm manage          # interactive: add / manage (sync, rename, change group, remove) / list / validate
pnpm sync            # pull upstream into local skill dirs
pnpm sync:check      # exit 1 if outdated or missing
pnpm validate        # deps + marketplace + frontmatter + README table
pnpm readme          # regenerate skills table above
```

The interactive menu asks before checking upstream (default: no network). **Add skill** lets you pick a repo already in `dependencies.json` or type a new one; **Manage skills** covers sync, rename (dir + `SKILL.md` + registry files), change group, and remove.

GitHub responses (default branch, tree, raw files, commit SHA) are cached under `node_modules/.cache/manage` for 10 minutes — set `MANAGE_CACHE_TTL_MS` to change the TTL (`0` disables), or pass `--no-cache` to CLI commands, e.g. `node scripts/manage.mjs sync --no-cache`.

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
