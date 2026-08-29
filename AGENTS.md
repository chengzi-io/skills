**MUST:**

- Each skill is independent. Mention another skill only if it lives in the **same plugin**.
- First-party skills must include version metadata. Third-party skills listed in `dependencies.json` do not.
  ```yaml
  metadata:
    version: "2026.08.10"
  ```
- New skill packages go in `plugins/<plugin>/skills/<name>/`. Never add a skill under the repo-root `skills/` directory.
- Plugin membership is the directory on disk. Do not put skill paths on marketplace `plugins[].skills` (Claude resolves those relative to the plugin root).
- Follow @GIT.md

## Third-party skills

This marketplace **pins** upstream skills. Most entries in `plugins/*/skills/` come from GitHub via [`dependencies.json`](dependencies.json). Weekly CI (`.github/workflows/sync-skills.yml`) re-downloads them onto the default branch.

**Prefer pin over rewrite.** A maintained upstream with a self-contained `SKILL.md` (Vercel React, AvdLee Swift, shadcn) belongs in `dependencies.json`, not a first-party copy.

### Add a pin

1. `pnpm manage` → add from GitHub (`owner/repo`, pick skills, pick plugin). Do not hand-copy a GitHub tree into `plugins/`.
2. That writes `dependencies.json`, copies files into `plugins/<plugin>/skills/<name>/`, and refreshes README tables.
3. `pnpm validate`. Commit the pin + synced files together.

Do not edit files that exist upstream for a pinned skill. Sync overwrites them. Extra local-only files in that directory survive; upstream paths do not.

### When not to pin (write first-party instead)

Pin fails when **any** of:

- No suitable upstream.
- Upstream is a **mesh**: `SKILL.md` tells the model to load sibling skills (`See owner/repo@other-skill`). Pinning a subset leaves dangling refs; pinning the whole suite blows the plugin's always-loaded description list (and can make a session look like that language/stack is the default).
- We need a different policy than upstream (slim traps-only, drop vendor libraries, drop always-load orchestrators). Sync would revert local edits.

Then distill: read upstream, write our own skill under `plugins/<plugin>/skills/<name>/`, add `metadata.version`. Do **not** list it in `dependencies.json`. Do **not** tell the model to load the upstream skill at runtime.

Keep maintainer notes **in that skill directory**, not at plugin root or `docs/`: `PROVENANCE.md` (upstream repo, commit, what we took and dropped) and `DECISION.md` (why distill instead of pin). Runtime `SKILL.md` / `reference/` stay silent about those files.

## Where a skill goes

| Plugin | Scope | Put here when |
|--------|--------|----------------|
| `foundations` | user | Language-agnostic: requirements, TDD, architecture, decisions |
| `golang` | project | Go-only |
| `python` | project | Python-only |
| `swift` | project | Swift / Xcode / Apple platforms |
| `macos` | project | Native macOS apps |
| `web` | project | Web, React, UI |

## New plugin

Adding a plugin (not a skill) means all of:

- `plugins/<name>/.claude-plugin/plugin.json`
- `plugins/<name>/.grok-plugin/plugin.json`
- `plugins/<name>/.codex-plugin/plugin.json`
- `plugins/<name>/skills/` (`.gitkeep` if empty)
- entries in `.claude-plugin/marketplace.json`, `.grok-plugin/marketplace.json`, and `.agents/plugins/marketplace.json`

## Validation — **Mandatory**

Before every commit:

1. `pnpm validate` — deps, plugin skill dirs, frontmatter, README tables
2. Claude Code — marketplace, then each plugin you touched:
   ```bash
   claude plugin validate .
   claude plugin validate plugins/<name>
   ```
3. Grok — each plugin you touched (`grok plugin validate .` checks the **root** `.claude-plugin/plugin.json`, not the per-plugin manifests):
   ```bash
   grok plugin validate plugins/<name>
   ```
4. Codex — no `plugin validate` command. Keep `plugins/<name>/.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json` in lockstep with the Claude/Grok catalogs.
