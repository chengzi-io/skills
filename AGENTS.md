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

## Where a skill goes

| Plugin | Scope | Put here when |
|--------|--------|----------------|
| `foundations` | user | Language-agnostic: requirements, TDD, architecture, decisions |
| `golang` | project | Go-only |
| `python` | project | Python-only |
| `swift` | project | Swift / Xcode / Apple platforms |
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

1. `pnpm validate` — deps, plugin skill dirs, frontmatter, README table
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
