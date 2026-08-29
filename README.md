# skills

Agent Skills marketplace for Claude Code, Grok, and Codex. Plugins are split so a session only loads skill names and descriptions for the stacks you enabled — a Python repo does not pay for Go or React skill text.

**foundations** is language-agnostic (user scope). **golang**, **python**, **swift**, **macos**, and **web** are per-project.

Do not clone this repo into `~/.agents/skills`. That loads every skill into every session.

## Quick start

Add the marketplace once, then enable plugins. First success: `foundations` available in a new session.

### Claude Code

```bash
claude plugin marketplace add chengzi-io/skills
claude plugin install foundations@chengzi-skills -s user
# in a Go repo:
claude plugin install golang@chengzi-skills -s project
# in a Swift / Xcode repo:
claude plugin install swift@chengzi-skills -s project
# in a macOS app repo (also install swift):
claude plugin install macos@chengzi-skills -s project
```

`-s user` or `-s project` (`local` also exists). Restart the session after install.

### Grok

```bash
grok plugin marketplace add chengzi-io/skills
grok plugin install foundations --trust
# language plugin, e.g. Go:
grok plugin install golang --trust
# Swift / Xcode repo:
grok plugin install swift --trust
# macOS app repo (also install swift):
grok plugin install macos --trust
```

No `--scope`. Install is user-level. For one repo only, use Grok's project plugin directory (`.grok/plugins/`).

### Codex

```bash
codex plugin marketplace add chengzi-io/skills
codex plugin add foundations@chengzi-skills
# language plugin, e.g. Go:
codex plugin add golang@chengzi-skills
# Swift / Xcode repo:
codex plugin add swift@chengzi-skills
# macOS app repo (also install swift):
codex plugin add macos@chengzi-skills
```

No `--scope`. Commands follow each CLI's current plugin docs if flags change.

## Plugins

Auto-generated. Do not edit the table by hand.

<!-- plugins:table:start -->

| Plugin | Scope | When |
|--------|--------|------|
| **foundations** | user | Every project |
| **golang** | project | Go repositories |
| **python** | project | Python repositories (placeholder, no skills yet) |
| **swift** | project | Swift / Xcode repositories |
| **macos** | project | macOS app repositories |
| **web** | project | Frontend repositories |

<!-- plugins:table:end -->

## Skills

Auto-generated. Do not edit the table by hand. Source pins and sync dates: `pnpm manage` list, or [`dependencies.json`](dependencies.json).

<!-- skills:table:start -->

| Skill | Plugin | Source | Description |
|-------|--------|--------|-------------|
| [`caveman`](plugins/foundations/skills/caveman) | foundations | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) | Ultra-compressed communication mode. Cuts output tokens 65% (measured) by speaking like caveman whil… |
| [`domain-modeling`](plugins/foundations/skills/domain-modeling) | foundations | [mattpocock/skills](https://github.com/mattpocock/skills) | Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or edi… |
| [`eli5`](plugins/foundations/skills/eli5) | foundations | [anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community) | Explain a topic like I'm a 5 year old. Use when the user types /eli5 <topic> or asks for a dead-simp… |
| [`grill-with-docs`](plugins/foundations/skills/grill-with-docs) | foundations | [mattpocock/skills](https://github.com/mattpocock/skills) | A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as … |
| [`grilling`](plugins/foundations/skills/grilling) | foundations | - | Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test … |
| [`improve-codebase-architecture`](plugins/foundations/skills/improve-codebase-architecture) | foundations | [mattpocock/skills](https://github.com/mattpocock/skills) | Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill throug… |
| [`repo-layout`](plugins/foundations/skills/repo-layout) | foundations | - | Decide, create, move, rename, refactor, and inspect repository paths so the tree expresses business … |
| [`tdd`](plugins/foundations/skills/tdd) | foundations | [mattpocock/skills](https://github.com/mattpocock/skills) | Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions … |
| [`write-adr`](plugins/foundations/skills/write-adr) | foundations | - | Draft, review, or slim Architecture Decision Records (ADRs). Trigger on ADR, architecture decision, … |
| [`write-bdd`](plugins/foundations/skills/write-bdd) | foundations | - | Write, review, and implement BDD Gherkin .feature files and step definitions. Use when the user asks… |
| [`write-ears`](plugins/foundations/skills/write-ears) | foundations | - | Write and review EARS functional requirements and acceptance criteria. Use when the user asks to wri… |
| [`writing-openapi-specs`](plugins/foundations/skills/writing-openapi-specs) | foundations | [speakeasy-api/skills](https://github.com/speakeasy-api/skills) | Reference guide for OpenAPI specification best practices, naming conventions, and expressing complex… |
| [`go-idioms`](plugins/golang/skills/go-idioms) | golang | - | Write and review idiomatic Go that models still get wrong: typed-nil interfaces, append aliasing, de… |
| [`oapi-codegen-best-practices`](plugins/golang/skills/oapi-codegen-best-practices) | golang | - | Best practices for generating and wiring Go HTTP APIs with oapi-codegen (v2), covering strict-server… |
| [`swift-concurrency`](plugins/swift/skills/swift-concurrency) | swift | [AvdLee/Swift-Concurrency-Agent-Skill](https://github.com/AvdLee/Swift-Concurrency-Agent-Skill) | Diagnose Swift Concurrency issues, refactor callback-based code to async/await, and guide Swift 6 mi… |
| [`swift-testing-expert`](plugins/swift/skills/swift-testing-expert) | swift | [AvdLee/Swift-Testing-Agent-Skill](https://github.com/AvdLee/Swift-Testing-Agent-Skill) | Expert guidance for Swift Testing: test structure, #expect/#require macros, traits and tags, paramet… |
| [`swiftdata-pro`](plugins/swift/skills/swiftdata-pro) | swift | [twostraws/SwiftData-Agent-Skill](https://github.com/twostraws/SwiftData-Agent-Skill) | Writes, reviews, and improves SwiftData code using modern APIs and best practices. Use when reading,… |
| [`swiftui-pro`](plugins/swift/skills/swiftui-pro) | swift | [twostraws/SwiftUI-Agent-Skill](https://github.com/twostraws/SwiftUI-Agent-Skill) | Comprehensively reviews SwiftUI code for best practices on modern APIs, maintainability, and perform… |
| [`macos-auto-update`](plugins/macos/skills/macos-auto-update) | macos | [fayazara/macos-app-skills](https://github.com/fayazara/macos-app-skills) | Add Sparkle auto-update support to a native macOS app. Use this skill whenever the user wants to add… |
| [`macos-notch-ui`](plugins/macos/skills/macos-notch-ui) | macos | [fayazara/macos-app-skills](https://github.com/fayazara/macos-app-skills) | Add a Dynamic Island-style notch UI to a macOS app. Use this skill whenever the user wants to create… |
| [`macos-patterns`](plugins/macos/skills/macos-patterns) | macos | [fayazara/macos-app-skills](https://github.com/fayazara/macos-app-skills) | Essential native macOS development patterns that web developers don't know about. Use this skill whe… |
| [`macos-release`](plugins/macos/skills/macos-release) | macos | [fayazara/macos-app-skills](https://github.com/fayazara/macos-app-skills) | Release a native macOS app to GitHub with DMG packaging and Sparkle appcast updates. Use this skill … |
| [`macos-settings-ui`](plugins/macos/skills/macos-settings-ui) | macos | [fayazara/macos-app-skills](https://github.com/fayazara/macos-app-skills) | Build a proper macOS settings/preferences window with liquid glass support for macOS 26 (Tahoe). Use… |
| [`emil-design-eng`](plugins/web/skills/emil-design-eng) | web | [emilkowalski/skills](https://github.com/emilkowalski/skills) | This skill encodes Emil Kowalski's philosophy on UI polish, component design, animation decisions, a… |
| [`frontend-design`](plugins/web/skills/frontend-design) | web | [anthropics/skills](https://github.com/anthropics/skills) | Guidance for distinctive, intentional visual design when building new UI or reshaping an existing on… |
| [`prototype`](plugins/web/skills/prototype) | web | [emilkowalski/skills](https://github.com/emilkowalski/skills) | Build multiple genuinely different versions of a UI piece you describe, rendered behind a visual pic… |
| [`shadcn`](plugins/web/skills/shadcn) | web | [shadcn/ui](https://github.com/shadcn/ui) | Manages shadcn components and projects — adding, searching, fixing, debugging, styling, and composin… |
| [`transitions-dev`](plugins/web/skills/transitions-dev) | web | [Jakubantalik/transitions.dev](https://github.com/Jakubantalik/transitions.dev) | Production-ready CSS transitions for web apps. Use when implementing notification badges, dropdowns,… |
| [`vercel-composition-patterns`](plugins/web/skills/vercel-composition-patterns) | web | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | React composition patterns that scale. Use when refactoring components with boolean prop proliferati… |
| [`vercel-react-best-practices`](plugins/web/skills/vercel-react-best-practices) | web | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be … |
| [`web-design-guidelines`](plugins/web/skills/web-design-guidelines) | web | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check acc… |

<!-- skills:table:end -->

## Contributing

New first-party skills go in `plugins/<plugin>/skills/<name>/`. Agent rules: [AGENTS.md](AGENTS.md).

```bash
pnpm install
pnpm manage          # add / sync / rename / change plugin / remove
pnpm validate
pnpm readme          # regenerate the plugins and skills tables above
```

Third-party pins live in [`dependencies.json`](dependencies.json). Weekly CI (`.github/workflows/sync-skills.yml`) syncs them onto the default branch.
