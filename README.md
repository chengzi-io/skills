# skills

Agent Skills marketplace for Claude Code, Grok, and Codex. Plugins are split so a session only loads skill names and descriptions for the stacks you enabled — a Python repo does not pay for Go or React skill text.

**foundations** is language-agnostic (user scope). **golang**, **python**, and **web** are per-project.

Do not clone this repo into `~/.agents/skills`. That loads every skill into every session.

## Quick start

Add the marketplace once, then enable plugins. First success: `foundations` available in a new session.

### Claude Code

```bash
claude plugin marketplace add chengzi-io/skills
claude plugin install foundations@chengzi-skills -s user
# in a Go repo:
claude plugin install golang@chengzi-skills -s project
```

`-s user` or `-s project` (`local` also exists). Restart the session after install.

### Grok

```bash
grok plugin marketplace add chengzi-io/skills
grok plugin install foundations --trust
# language plugin, e.g. Go:
grok plugin install golang --trust
```

No `--scope`. Install is user-level. For one repo only, use Grok's project plugin directory (`.grok/plugins/`).

### Codex

```bash
codex plugin marketplace add chengzi-io/skills
codex plugin add foundations@chengzi-skills
# language plugin, e.g. Go:
codex plugin add golang@chengzi-skills
```

No `--scope`. Commands follow each CLI's current plugin docs if flags change.

## Plugins

| Plugin | Scope | When |
|--------|--------|------|
| **foundations** | user | Every project |
| **golang** | project | Go repositories |
| **python** | project | Python repositories (placeholder, no skills yet) |
| **web** | project | Frontend / React / UI |

## Skills

Auto-generated. Do not edit the table by hand. Source pins and sync dates: `pnpm manage` list, or [`dependencies.json`](dependencies.json).

<!-- skills:table:start -->

| Skill | Plugin | Description |
|-------|--------|-------------|
| [`caveman`](plugins/foundations/skills/caveman) | foundations | Ultra-compressed communication mode. Cuts output tokens 65% (measured) by speaking like caveman whil… |
| [`domain-modeling`](plugins/foundations/skills/domain-modeling) | foundations | Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or edi… |
| [`eli5`](plugins/foundations/skills/eli5) | foundations | Explain a topic like I'm a 5 year old. Use when the user types /eli5 <topic> or asks for a dead-simp… |
| [`grill-with-docs`](plugins/foundations/skills/grill-with-docs) | foundations | A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as … |
| [`grilling`](plugins/foundations/skills/grilling) | foundations | Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test … |
| [`improve-codebase-architecture`](plugins/foundations/skills/improve-codebase-architecture) | foundations | Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill throug… |
| [`repo-layout`](plugins/foundations/skills/repo-layout) | foundations | Decide, create, move, rename, refactor, and inspect repository paths so the tree expresses business … |
| [`tdd`](plugins/foundations/skills/tdd) | foundations | Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions … |
| [`write-adr`](plugins/foundations/skills/write-adr) | foundations | Draft, review, or slim Architecture Decision Records (ADRs). Trigger on ADR, architecture decision, … |
| [`write-bdd`](plugins/foundations/skills/write-bdd) | foundations | Write, review, and implement BDD Gherkin .feature files and step definitions. Use when the user asks… |
| [`write-ears`](plugins/foundations/skills/write-ears) | foundations | Write and review EARS functional requirements and acceptance criteria. Use when the user asks to wri… |
| [`writing-openapi-specs`](plugins/foundations/skills/writing-openapi-specs) | foundations | Reference guide for OpenAPI specification best practices, naming conventions, and expressing complex… |
| [`oapi-codegen-best-practices`](plugins/golang/skills/oapi-codegen-best-practices) | golang | Best practices for generating and wiring Go HTTP APIs with oapi-codegen (v2), covering strict-server… |
| [`emil-design-eng`](plugins/web/skills/emil-design-eng) | web | This skill encodes Emil Kowalski's philosophy on UI polish, component design, animation decisions, a… |
| [`frontend-design`](plugins/web/skills/frontend-design) | web | Guidance for distinctive, intentional visual design when building new UI or reshaping an existing on… |
| [`prototype`](plugins/web/skills/prototype) | web | Build multiple genuinely different versions of a UI piece you describe, rendered behind a visual pic… |
| [`shadcn`](plugins/web/skills/shadcn) | web | Manages shadcn components and projects — adding, searching, fixing, debugging, styling, and composin… |
| [`transitions-dev`](plugins/web/skills/transitions-dev) | web | Production-ready CSS transitions for web apps. Use when implementing notification badges, dropdowns,… |
| [`vercel-composition-patterns`](plugins/web/skills/vercel-composition-patterns) | web | React composition patterns that scale. Use when refactoring components with boolean prop proliferati… |
| [`vercel-react-best-practices`](plugins/web/skills/vercel-react-best-practices) | web | React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be … |
| [`web-design-guidelines`](plugins/web/skills/web-design-guidelines) | web | Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check acc… |

<!-- skills:table:end -->

## Contributing

New first-party skills go in `plugins/<plugin>/skills/<name>/`. Agent rules: [AGENTS.md](AGENTS.md).

```bash
pnpm install
pnpm manage          # add / sync / rename / change plugin / remove
pnpm validate
pnpm readme          # regenerate the skills table above
```

Third-party pins live in [`dependencies.json`](dependencies.json). Weekly CI (`.github/workflows/sync-skills.yml`) syncs them onto the default branch.
