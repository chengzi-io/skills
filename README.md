# skills

Agent Skills marketplace for Claude Code, Grok, Codex, and pi. Plugins are split so a session only loads skill names and descriptions for the stacks you enabled — a Python repo does not pay for Go or React skill text. In pi this selection happens automatically per project.

**foundations** is language-agnostic (user scope). **golang**, **rust**, **python**, **java**, **typescript**, **swift**, **macos**, and **web** are per-project.

Do not clone this repo into `~/.agents/skills`. That loads every skill into every session. pi is the exception: install it as a package (below) and the extension filters skills per project.

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

### pi

```bash
pi install git:github.com/chengzi-io/skills
```

Tracks the default branch, so `pi update --extensions` picks up new and synced skills. Append a ref to pin instead: `@<tag-or-commit>`

One install, every project. pi has no marketplace and no install scopes, so this package declares `plugins/*/skills` in its `pi` manifest and `extensions/pi-skills.mjs` picks the applicable plugins per session. A Go API keeps `foundations` and `golang`; the same repo with a `web/package.json` that depends on React also keeps `web`. Each session reports the outcome once. The totals include skills from other sources, such as `~/.agents/skills`:

```text
skills: 19/48 kept (go)
```

Detection runs once per session — editing `go.mod` mid-session takes effect next session — because the skill list lives in the system prompt, and changing it mid-session would invalidate the provider's prompt cache for the whole conversation. To narrow a project further, add a filtering delta to `.pi/settings.json`:

```json
{
  "packages": [{
    "source": "git:github.com/chengzi-io/skills",
    "autoload": false,
    "skills": ["!plugins/web/skills/**"]
  }]
}
```

Use `!glob` to exclude a whole plugin, or `-plugins/<plugin>/skills/<skill>` for one skill; `pi config --local` writes the same entries with full paths. Skills marked `disable-model-invocation: true` stay out of the prompt but remain callable through `/skill:<name>`.

pi ignores `.claude-plugin/`, `.grok-plugin/`, and `.codex-plugin/` manifests, so the `lspServers` entries below apply to Claude Code and Grok only.

## Plugins

Auto-generated. Do not edit the table by hand.

<!-- plugins:table:start -->

| Plugin | Scope | When |
|--------|--------|------|
| **foundations** | user | Every project |
| **golang** | project | Go repositories |
| **rust** | project | Rust repositories (LSP only) |
| **python** | project | Python repositories (LSP only) |
| **java** | project | Java repositories (LSP only) |
| **typescript** | project | TypeScript repositories (LSP only) |
| **swift** | project | Swift / Xcode repositories |
| **macos** | project | macOS app repositories |
| **web** | project | Frontend repositories |

<!-- plugins:table:end -->

Every language plugin enables LSP in Claude Code and Grok. They configure the connection only; install the server binary on `PATH` yourself:

- `golang` — `gopls`: `go install golang.org/x/tools/gopls@latest`
- `rust` — `rust-analyzer`: `rustup component add rust-analyzer`
- `python` — `pyright-langserver`: `npm install -g pyright`
- `java` — `jdtls`: `brew install jdtls` (needs JDK 17+)
- `typescript` — `typescript-language-server`: `npm install -g typescript-language-server typescript`
- `swift` — `sourcekit-lsp`: bundled with the Swift toolchain (Xcode or swift.org)

Codex has no LSP support: its plugin runtime accepts but ignores `lspServers`, so Codex users rely on file search and reading instead.

## Skills

Auto-generated. Do not edit the table by hand. Source pins and sync dates: `pnpm manage` list, or [`dependencies.json`](dependencies.json).

<!-- skills:table:start -->

| Skill | Plugin | Source | Description |
|-------|--------|--------|-------------|
| [`caveman`](plugins/foundations/skills/caveman) | foundations | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) | Terse caveman voice: answer first, fluff gone, every technical fact kept. Use for /caveman, "caveman… |
| [`documentation`](plugins/foundations/skills/documentation) | foundations | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Write and maintain technical documentation. Trigger with "write docs for", "document this", "create … |
| [`domain-modeling`](plugins/foundations/skills/domain-modeling) | foundations | [mattpocock/skills](https://github.com/mattpocock/skills) | Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or edi… |
| [`eli5`](plugins/foundations/skills/eli5) | foundations | [anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community) | Explain a topic like I'm a 5 year old. Use when the user types /eli5 <topic> or asks for a dead-simp… |
| [`grill-with-docs`](plugins/foundations/skills/grill-with-docs) | foundations | [mattpocock/skills](https://github.com/mattpocock/skills) | A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as … |
| [`grilling`](plugins/foundations/skills/grilling) | foundations | - | Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test … |
| [`improve-codebase-architecture`](plugins/foundations/skills/improve-codebase-architecture) | foundations | [mattpocock/skills](https://github.com/mattpocock/skills) | Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill throug… |
| [`repo-layout`](plugins/foundations/skills/repo-layout) | foundations | - | Decide, create, move, rename, refactor, and inspect repository paths so the tree expresses business … |
| [`requirements-status`](plugins/foundations/skills/requirements-status) | foundations | - | Report which EARS requirements are passing, failing, in progress, or untested by joining docs/requir… |
| [`tdd`](plugins/foundations/skills/tdd) | foundations | [mattpocock/skills](https://github.com/mattpocock/skills) | Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions … |
| [`write-adr`](plugins/foundations/skills/write-adr) | foundations | - | Draft, review, or slim Architecture Decision Records (ADRs). Trigger on ADR, architecture decision, … |
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
| [`afk`](plugins/web/skills/afk) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Works through a project while you're away, finding improvements and new ideas, building the best of … |
| [`better-accessibility`](plugins/web/skills/better-accessibility) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Reviews and fixes keyboard and focus behavior, ARIA, accessible names, forms, screen-reader announce… |
| [`better-colors`](plugins/web/skills/better-colors) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Builds and checks color systems by generating palettes, naming semantic tokens, converting between f… |
| [`better-interface`](plugins/web/skills/better-interface) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Reviews a screen, flow or whole interface across accessibility, layout, writing, typography, color a… |
| [`better-layout`](plugins/web/skills/better-layout) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Sets grouping, alignment, reading order, responsive structure and room for translated text, so a lay… |
| [`better-typography`](plugins/web/skills/better-typography) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Sets and reviews how text renders, from the type scale and spacing to font features, wrapping, trunc… |
| [`better-ui`](plugins/web/skills/better-ui) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Polishes surfaces, icons and motion with exact values for border radius, optical alignment, shadows,… |
| [`better-writing`](plugins/web/skills/better-writing) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Writes and reviews interface copy, from labels and errors to empty states and confirmations, so it m… |
| [`break`](plugins/web/skills/break) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Renders a component you choose under every scenario that can reach it on a temporary page and stress… |
| [`build-design`](plugins/web/skills/build-design) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Builds UI from a Figma file or a design image so it matches the design, using the project's existing… |
| [`emil-design-eng`](plugins/web/skills/emil-design-eng) | web | [emilkowalski/skills](https://github.com/emilkowalski/skills) | This skill encodes Emil Kowalski's philosophy on UI polish, component design, animation decisions, a… |
| [`explain-interface`](plugins/web/skills/explain-interface) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Explains how a website, a visual effect or an animation was built, from a live URL or a screenshot. |
| [`frontend-design`](plugins/web/skills/frontend-design) | web | [anthropics/skills](https://github.com/anthropics/skills) | Guidance for distinctive, intentional visual design when building new UI or reshaping an existing on… |
| [`interface-review`](plugins/web/skills/interface-review) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Reviews a branch, pull request or uncommitted change for the interface problems it introduced or reg… |
| [`shadcn`](plugins/web/skills/shadcn) | web | [shadcn/ui](https://github.com/shadcn/ui) | Manages shadcn components and projects — adding, searching, fixing, debugging, styling, and composin… |
| [`state-machine`](plugins/web/skills/state-machine) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Renders every state of a component you choose on a throwaway page, with mock data and a switcher, so… |
| [`transitions-dev`](plugins/web/skills/transitions-dev) | web | [Jakubantalik/transitions.dev](https://github.com/Jakubantalik/transitions.dev) | Production-ready CSS transitions for web apps. Use when implementing notification badges, dropdowns,… |
| [`variant`](plugins/web/skills/variant) | web | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | Builds multiple variants of a component you're working on and helps you iterate and pick one. |
| [`vercel-composition-patterns`](plugins/web/skills/vercel-composition-patterns) | web | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | React composition patterns that scale. Use when refactoring components with boolean prop proliferati… |
| [`vercel-react-best-practices`](plugins/web/skills/vercel-react-best-practices) | web | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be … |

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
