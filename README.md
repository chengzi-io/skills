# skills

Marketplace of Agent Skills: first-party packages plus optional third-party skills from GitHub. Install **foundations** at user scope; install **golang**, **python**, or **web** at project scope for that stack.

## Install

This repository is a marketplace, not a dump of every skill.

1. Add it as a marketplace in Claude Code, Grok, or Codex.
2. Enable plugins as needed:
   - **foundations** — user scope (every project)
   - **golang** / **python** / **web** — project scope for that stack
3. **python** currently ships with no skills (placeholder).

Do not clone this repo into `~/.agents/skills`. That loads every skill name and description into every session.

Claude Code can enable a plugin at `--scope user` or `--scope project`. Grok and Codex CLIs do not have the same scope flag; project-level install is a project-local plugin directory. Use each CLI's current plugin docs for exact commands.

## Skills

Auto-generated from plugin skill dirs + `dependencies.json` + `marketplace.json`. Do not edit the table by hand.

<!-- skills:table:start -->

| Skill | Plugin | Source | Synced | Description |
|-------|--------|--------|--------|-------------|
| [`domain-modeling`](plugins/foundations/skills/domain-modeling) | foundations | mattpocock/skills@main#8b78b53 | 2026-08-14 | Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or edi… |
| [`eli5`](plugins/foundations/skills/eli5) | foundations | anthropics/claude-plugins-community@main#f4c9452 | 2026-08-23 | Explain a topic like I'm a 5 year old. Use when the user types /eli5 <topic> or asks for a dead-simp… |
| [`grill-with-docs`](plugins/foundations/skills/grill-with-docs) | foundations | mattpocock/skills@main#8b78b53 | 2026-08-14 | A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as … |
| [`grilling`](plugins/foundations/skills/grilling) | foundations | local | — | Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test … |
| [`improve-codebase-architecture`](plugins/foundations/skills/improve-codebase-architecture) | foundations | mattpocock/skills@main#8b78b53 | 2026-08-15 | Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill throug… |
| [`repo-layout`](plugins/foundations/skills/repo-layout) | foundations | local | — | Decide, create, move, rename, refactor, and inspect repository paths so the tree expresses business … |
| [`tdd`](plugins/foundations/skills/tdd) | foundations | mattpocock/skills@main#8b78b53 | 2026-08-14 | Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions … |
| [`write-adr`](plugins/foundations/skills/write-adr) | foundations | local | — | Draft, review, or slim Architecture Decision Records (ADRs). Trigger on ADR, architecture decision, … |
| [`write-bdd`](plugins/foundations/skills/write-bdd) | foundations | local | — | Write, review, and implement BDD Gherkin .feature files and step definitions. Use when the user asks… |
| [`write-ears`](plugins/foundations/skills/write-ears) | foundations | local | — | Write and review EARS functional requirements and acceptance criteria. Use when the user asks to wri… |
| [`writing-openapi-specs`](plugins/foundations/skills/writing-openapi-specs) | foundations | speakeasy-api/skills@master#d2eab59 | 2026-08-10 | Reference guide for OpenAPI specification best practices, naming conventions, and expressing complex… |
| [`oapi-codegen-best-practices`](plugins/golang/skills/oapi-codegen-best-practices) | golang | local | — | Best practices for generating and wiring Go HTTP APIs with oapi-codegen (v2), covering strict-server… |
| [`emil-design-eng`](plugins/web/skills/emil-design-eng) | web | emilkowalski/skills@main#9075d17 | 2026-08-10 | This skill encodes Emil Kowalski's philosophy on UI polish, component design, animation decisions, a… |
| [`frontend-design`](plugins/web/skills/frontend-design) | web | anthropics/skills@main#f17010c | 2026-08-10 | Guidance for distinctive, intentional visual design when building new UI or reshaping an existing on… |
| [`prototype`](plugins/web/skills/prototype) | web | emilkowalski/skills@main#9075d17 | 2026-08-10 | Build multiple genuinely different versions of a UI piece you describe, rendered behind a visual pic… |
| [`shadcn`](plugins/web/skills/shadcn) | web | shadcn/ui@main#deda4df | 2026-08-10 | Manages shadcn components and projects — adding, searching, fixing, debugging, styling, and composin… |
| [`vercel-composition-patterns`](plugins/web/skills/vercel-composition-patterns) | web | vercel-labs/agent-skills@main#7c180d9 | 2026-08-10 | React composition patterns that scale. Use when refactoring components with boolean prop proliferati… |
| [`vercel-react-best-practices`](plugins/web/skills/vercel-react-best-practices) | web | vercel-labs/agent-skills@main#7c180d9 | 2026-08-10 | React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be … |
| [`web-design-guidelines`](plugins/web/skills/web-design-guidelines) | web | vercel-labs/agent-skills@main#7c180d9 | 2026-08-10 | Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check acc… |

<!-- skills:table:end -->

## Manage

```bash
pnpm install
pnpm manage          # interactive: add / manage (sync, rename, change plugin, remove) / list / validate
pnpm sync            # pull upstream into plugin skill dirs
pnpm sync:check      # exit 1 if outdated or missing
pnpm validate        # deps + plugin dirs + frontmatter + README table
pnpm readme          # regenerate skills table above
```

The interactive menu asks before checking upstream (default: no network). **Add skill** downloads into `plugins/<plugin>/skills/<name>/`. **Manage skills** covers sync, rename (dir + `SKILL.md` + registry), change plugin (moves the directory), and remove. The menu still labels that action "Change group".

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
| `pnpm manage` → Add / Sync / Rename / Change plugin / Remove | Manager rewrites the table before finishing (fails if markers missing) |
| `pnpm sync` (local + CI) | Always rewrites after pin/file updates |
| CI workflow | Extra `npm run readme` step; PR includes `plugins/**` + `README.md` + `dependencies.json` |
| `pnpm validate` | Fails if the table is stale (`pnpm readme -- --check`) |
| `pnpm readme` | Manual regenerate |

**Not automatic:** hand-adding a local skill under `plugins/<name>/skills/`, or editing `SKILL.md` / `dependencies.json` outside the manager — run `pnpm readme` (or rely on `pnpm validate` before commit). Plugin membership is the directory, not marketplace `skills[]`.

CI (`.github/workflows/sync-skills.yml`): Monday 06:00 UTC + manual dispatch; opens a PR when skill files, pins, or the README table change.

## Layout

| Path | Role |
|------|------|
| `plugins/<name>/skills/` | Skill packages (`SKILL.md` + assets) |
| `plugins/foundations`, `plugins/golang`, `plugins/python`, `plugins/web` | Physical plugins each CLI installs |
| `plugins/<name>/.claude-plugin/plugin.json` | Claude plugin manifest (also `.grok-plugin/`, `.codex-plugin/`) |
| `.claude-plugin/marketplace.json` | Claude Code catalog |
| `.grok-plugin/marketplace.json` | Grok catalog |
| `.agents/plugins/marketplace.json` | Codex catalog |
| `.claude-plugin/plugin.json` | Marketplace metadata (not an installable skill pack) |
| `AGENTS.md` | Rules for agents editing this repo |
| `dependencies.json` | Upstream sources for third-party skills |
| `scripts/manage.mjs` | Manager, CI sync, README table |

Do not add skill packages under the repo-root `skills/` directory.
