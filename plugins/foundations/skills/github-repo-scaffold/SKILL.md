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
  version: "2026.10.11"
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
| Lint and format | detected per ecosystem, `refs/variants.md` section 1 | An existing config always wins |
| Release | release-please-action@v5 with a GitHub App token, Release PR merged by a human | — |
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
| an existing lint or format config at the repo root | lint tool — existing config wins |
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

### Phase 4 — land the files

Which path depends on whether the release branch is already protected.

- New repository (no remote, empty remote, or release branch unprotected):
  commit the scaffold directly on the release branch and push. No feature
  branch, no first PR — there is no gate yet to pass through, and the branch
  protection API returns 404 for a branch that does not exist.
- Existing protected repository: put the scaffold on a branch and open a PR.
  It goes through the gate like any other change.

### Phase 5 — hand-off

Apply or teach the protection surface (section 6) after the files are on
the release branch, then end there. This holds for an existing repository
too: requiring a new check before the scaffold PR merges leaves that PR
stuck. A `pull_request_target` workflow runs from the base branch, so the
title check cannot report on the PR that adds it.

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
9. release-please runs on a GitHub App token. On `GITHUB_TOKEN` the Release
   PR starts no checks and can never merge.
10. Dependabot commits carry a Conventional prefix, so a dependency bump
   cannot fake a minor or major release.
11. Branch protection exists on the release branch, requires the title check
    and the CI job names, and squash merge uses the PR title as the commit
    message. Audit this read-only with `gh api` when a token is available,
    otherwise report it as a gap for the owner.

Output:

| Concern | Verdict | Action |
| --- | --- | --- |
| PR title check | gap | add `.github/workflows/pr-title.yml` |

Verdicts: `pass`, `gap` (missing, add it), `conflict` (present but wrong or
unsafe, fix it), `n/a` (no signal).

## 6. Protection surface

The pipeline is only as strong as its weakest protection. Set every item, or
teach every item. An item left unset is a hole the title gate gets pushed
through — a merge commit bypasses a PR title check the branch never
required.

Apply these only after the phase 2 plan is approved: they change how the
whole team merges.

### 6.1 When `gh` is authenticated

Run `gh auth status`. With a token that can administer the repository, apply
the settings, then read them back (6.3).

Set `reviews` from the number of people who can push. A solo maintainer
cannot approve their own PR, so with `enforce_admins: true` a count of 1
blocks every merge. Solo → `0`: the PR and its checks are still required,
only the human approval is dropped. Two or more → `1`.

```bash
owner_repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
branch=main
pushers=$(gh api "repos/$owner_repo/collaborators?per_page=100" --jq '[.[] | select(.permissions.push)] | length')
reviews=$([ "$pushers" -ge 2 ] && echo 1 || echo 0)

gh api --method PUT "repos/$owner_repo/branches/$branch/protection" --input - <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Validate PR title", "Lint, typecheck, test"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": $reviews,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

gh api --method PATCH "repos/$owner_repo" \
  -F allow_squash_merge=true \
  -F squash_merge_commit_title=PR_TITLE \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true

gh api --method PUT "repos/$owner_repo/actions/permissions/workflow" --input - <<'JSON'
{ "default_workflow_permissions": "read" }
JSON
```

Rules inside this block:

- Each `contexts` entry must equal a workflow job `name:` value. Renaming a
  job silently drops the requirement.
- `contexts` is the simple form of `required_status_checks`. Use the `checks`
  array instead when a check must be bound to a specific GitHub App id.
- `squash_merge_commit_title=PR_TITLE` is what makes the checked title become
  the commit. Without it the squash body wins and the gate is decoration.
- `enforce_admins` may be `false` when the team needs an admin escape hatch.
  Decide it out loud; never leave it implicit.

Secrets and deploy environments. The release App needs its client id as a
variable and its private key as a secret:

```bash
gh variable set RELEASE_APP_CLIENT_ID --repo "$owner_repo" --body "$client_id"
gh secret set RELEASE_APP_PRIVATE_KEY --repo "$owner_repo" < release-app.private-key.pem
```

```bash
echo "$NPM_TOKEN" | gh secret set NPM_TOKEN --repo "$owner_repo"

echo "$NPM_TOKEN" | gh secret set NPM_TOKEN --repo "$owner_repo" --env production

gh api --method PUT "repos/$owner_repo/environments/production" --input - <<'JSON'
{ "reviewers": [{ "type": "User", "id": 12345 }] }
JSON
```

Feed the value on stdin. A token on the command line lands in shell history
and in the process list. Use a real numeric reviewer id — an environment with
no reviewer is not protected, it is only a name.

### 6.2 When `gh` is missing or unauthenticated

Do not leave the surface to chance. Hand the user the exact commands from
6.1, plus the click path:

- Settings → Branches → add a rule for the release branch: require a pull
  request (required approvals 0 for a solo maintainer, 1 for a team),
  require the status checks by job name, require conversation
  resolution, block force pushes and deletions.
- Settings → General: allow squash merging only, and set the default commit
  message to the pull request title.
- Settings → Actions → General: workflow permissions read-only.
- Settings → Environments: create the deploy environment with required
  reviewers.
- Developer settings → GitHub Apps → New GitHub App: webhook off,
  repository permissions Contents and Pull requests read and write. Generate
  a private key, then install the App on the repository.
- Settings → Secrets and variables → Actions: add `RELEASE_APP_CLIENT_ID`
  as a variable and `RELEASE_APP_PRIVATE_KEY` as a secret.
- Settings → Secrets and variables → Actions: add every secret the generated
  workflows name, at environment scope when the job deploys.

### 6.3 Verify

Read the settings back and report one row per item.

```bash
gh api "repos/$owner_repo/branches/$branch/protection" --jq '.required_status_checks.contexts'
gh api "repos/$owner_repo" --jq '{squash: .allow_squash_merge, title: .squash_merge_commit_title}'
gh api "repos/$owner_repo/actions/permissions/workflow" --jq .default_workflow_permissions
```

| Item | State |
| --- | --- |
| Branch protection requires the title check | set / taught / gap |

`set` means the read-back shows it. `taught` means the user holds the command
or click path. `gap` is a failure — fix it before finishing the task.

## 7. Do not

- Do not present the section 1 defaults as questions.
- Do not swap an existing hook manager or an existing lint tool for a default.
- Do not overwrite existing workflows, hook configs, or templates.- Do not generate a matrix, an image job, or a deploy step without its
  signal.
- Do not write a step that calls a script the repo does not have.
- Do not grant workflow-level `write` permissions.
- Do not check out or execute PR code in a `pull_request_target` workflow.
- Do not publish on every push to the release branch; gate on the release
  output.
- Do not expand into source layout, test strategy, or code review.
