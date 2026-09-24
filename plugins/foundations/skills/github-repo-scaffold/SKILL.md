---
name: github-repo-scaffold
description: >
  Scaffold or audit a GitHub repository's governance and delivery layer:
  Conventional Commits enforcement, CI quality gates, automated release, and
  CD artifact distribution. Use when creating a new repository, initializing
  .github files, writing or fixing GitHub Actions workflows, adding commit
  hooks or commitlint, wiring automated releases or changelogs, or reviewing
  an existing repository's pipeline. Trigger with "set up CI", "scaffold a
  repo", "GitHub Actions", "release workflow", "commitlint", "lefthook",
  "dependabot", "PR template", "conventional commits", CI/CD, 仓库规范,
  自动发布, 提交规范.
license: MIT
metadata:
  version: "2026.09.24"
---

# GitHub repo scaffold

Own the pipeline and governance layer of a GitHub repository: commit rules,
CI gates, automated release, and artifact delivery.

This skill writes and audits those files. `repo-layout` decides where source
code lives — do not restructure code here.

## 1. Defaults

Decisions already made. Apply them; do not offer them as choices.

| Concern | Default | Exception |
| --- | --- | --- |
| Git hooks | lefthook, `lefthook.yml` | Repo already runs husky → keep husky |
| Commit rules | commitlint + `@commitlint/config-conventional` | — |
| PR title rules | `amannn/action-semantic-pull-request@v6` | — |
| Node lint | Biome + Ultracite on a new project | Existing ESLint config → keep ESLint |
| Go lint | golangci-lint v2 | — |
| Release | release-please-action@v5, Release PR merged by a human | — |
| Registry auth | OIDC / trusted publishing | Registry without OIDC → token in environment secrets |

`refs/templates.md` pins the action majors verified on 2026-09-24. Check the
latest major before writing when the repo pins something else; write one pin,
never a floating tag.

## 2. Detect before writing

Read the tree first. Every later choice comes from a signal, never from a
question the repository can already answer.

| Signal | Decides |
| --- | --- |
| `go.mod`, `package.json`, `pyproject.toml`, `Cargo.toml`, `*.xcodeproj`, `eas.json` | toolchain, lint, test commands |
| `lefthook.yml`, `.husky/`, a `prepare` script | hook manager — husky wins when present |
| ESLint config, `biome.json*`, `.golangci.yml` | lint tool — existing config wins |
| `bin` or `publishConfig` in package.json, `Dockerfile`, goreleaser config, `tauri.conf.json`, `eas.json` | artifact type, so the CD steps |
| `vercel.json`, `netlify.toml`, `wrangler.toml`, `fly.toml`, k8s manifests, an ArgoCD Application | deploy target, so the CD steps |
| existing `.github/workflows/` | merge into them, never overwrite |
| public repo taking outside contributors | fork-safe title workflow |

Then ask only what no signal answers: distribution targets the author intends
but the repo does not show yet, and whether release automation is wanted at
all.

## 3. Workflow

### Phase 1 — detect

Run section 2. Report the detected state in a few lines before generating
anything.

### Phase 2 — plan

List every file to create, keep, or skip, each with one reason. Show the list
before writing. A skip needs a reason too: `exists`, `no signal`, or
`declined`.

### Phase 3 — generate

Write files from `refs/templates.md`. Rules:

1. Never overwrite an existing file. Read it first, then extend it or report
   the conflict.
2. Every command in a workflow must exist in the repo: a `package.json`
   script, a `Makefile` target, a `Taskfile` task, or a real tool binary. If
   the script is missing, add the script or drop the step — never write a
   step that fails on its first run.
3. Workflows start from `permissions: contents: read`. Elevate inside the one
   job that needs it.
4. A `pull_request_target` workflow never checks out PR code and never runs
   PR scripts. It validates the title only.
5. Publish jobs gate on the release step output, so a push that creates no
   release publishes nothing.
6. One workflow per concern: title, CI, release. Do not merge them into one
   file to save a file.

### Phase 4 — hand-off

End with the settings only a human can change (section 6).

## 4. Variant heuristics

Do not enumerate every project shape. Detect the signals, then apply the
matching recipe from `refs/variants.md`.

Core rule: a step exists only when its signal exists. No `Dockerfile`, no
image job. No `eas.json`, no mobile build. A matrix appears only when a build
or a test genuinely differs per platform, per runtime version, or per
architecture.

## 5. Audit mode

Read-only. Report the gaps; change nothing unless asked.

Check each item:

1. Hook manager present and installed (`lefthook.yml`, or `.husky/` plus a
   `prepare` script).
2. commitlint present with `@commitlint/config-conventional`, and the
   `commit-msg` hook calls it.
3. PR title validation in CI, on a trigger that includes `synchronize` when
   the check is required for merge.
4. Lint and test steps call commands that exist.
5. Release automation consistent: manifest, config, changelog path, and the
   version source agree.
6. `permissions` minimal; no top-level `write`.
7. Title workflow fork-safe; no PR checkout under `pull_request_target`.
8. Publish jobs gated on release output; registry credentials come from
   secrets or OIDC.
9. Dependabot commits carry a Conventional prefix, so a dependency bump
   cannot fake a minor or major release.

Output:

| Concern | Verdict | Action |
| --- | --- | --- |
| PR title check | gap | add `.github/workflows/pr-title.yml` |

Verdicts: `pass`, `gap` (missing, add it), `conflict` (present but wrong or
unsafe, fix it), `n/a` (no signal).

## 6. Hand-off checklist

The agent cannot change these. State them last.

- Branch protection on the release branch: require a PR, require the status
  checks by exact job name, require the PR title check.
- Merge mode: squash, with the PR title as the commit message. This is what
  makes title validation govern the real commit.
- Actions permission default: read repository contents and packages.
- Environments with required reviewers when CD deploys to production.
- Every secret the generated workflows name, added at repository or
  environment scope.

## 7. Do not

- Do not present the section 1 defaults as questions.
- Do not migrate a husky repo to lefthook, or an ESLint repo to Biome.
- Do not overwrite existing workflows, hook configs, or templates.
- Do not generate a matrix, an image job, or a deploy step without its
  signal.
- Do not write a step that calls a script the repo does not have.
- Do not grant workflow-level `write` permissions.
- Do not check out or execute PR code in a `pull_request_target` workflow.
- Do not publish on every push to the release branch; gate on the release
  output.
- Do not expand into source layout, test strategy, or code review.
