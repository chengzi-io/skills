# Templates

Copy-paste skeletons. Adapt names and commands to the repo; keep the
structure and the permission model.

Versions below verified 2026-09-24.

| Tool | Pin |
| --- | --- |
| `amannn/action-semantic-pull-request` | `v6` |
| `googleapis/release-please-action` | `v5` |
| `actions/checkout` | `v7` |
| `actions/setup-node` | `v7` |
| `actions/setup-go` | `v7` |
| `actions/setup-python` | `v7` |
| `astral-sh/setup-uv` | `v10` |
| `pnpm/action-setup` | `v6` |
| `golangci/golangci-lint-action` | `v9` |
| `docker/build-push-action` | `v7` |
| `actions/upload-artifact` | `v7` |
| `softprops/action-gh-release` | `v3` |
| `goreleaser/goreleaser-action` | `v7` |
| `expo/expo-github-action` | `v9` |
| `pypa/gh-action-pypi-publish` | `v1` |
| `aws-actions/configure-aws-credentials` | `v6` |
| `cloudflare/wrangler-action` | `v4` |
| `docker/setup-buildx-action` | `v4` |
| `docker/login-action` | `v4` |
| `github/codeql-action` | `v4` |
| `aquasecurity/trivy-action` | `0.36` |
| `sigstore/cosign-installer` | `v4` |

## 1. Governance files

### `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## Change type

- [ ] `feat` — new behavior
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `refactor` — no behavior change
- [ ] `perf` — performance
- [ ] `chore` — tooling, dependencies, CI

## Checklist

- [ ] Title follows Conventional Commits, for example `feat(auth): add login timeout`
- [ ] Breaking change is marked with `!` after the type or a `BREAKING CHANGE:` footer
- [ ] CI passes
```

### `.github/CONTRIBUTING.md`

```markdown
# Contributing

## Commit and PR titles

Every commit and every PR title follows Conventional Commits:

`<type>(<scope>): <subject>`

Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert`. Subject is lowercase, imperative, no trailing period.

A breaking change is `feat(api)!: drop v1 routes` or a `BREAKING CHANGE:`
footer. Breaking changes drive the major version.

## Local hooks

    <hook install command>

Hooks run the linter on commit and commitlint on the commit message. Bypass
with `--no-verify` only for a work-in-progress commit you will amend.

## Pull requests

Keep the PR title Conventional — squash merge uses it as the commit message.
```

### `.github/CODEOWNERS`

```text
* @<owner>
/.github/ @<owner>
```

### `.github/SECURITY.md`

```markdown
# Security policy

Report vulnerabilities through GitHub private vulnerability reporting
(Security → Report a vulnerability). Do not open a public issue.

Include the affected version, the impact, and the steps to reproduce.
Expected first response: within 7 days.
```

### `.github/ISSUE_TEMPLATE/config.yml`

```yaml
blank_issues_enabled: false
contact_links:
  - name: Security report
    url: https://github.com/<owner>/<repo>/security/advisories/new
    about: Report vulnerabilities privately.
```

### `.github/ISSUE_TEMPLATE/bug_report.yml`

```yaml
name: Bug report
description: Report a defect
labels: [bug]
body:
  - type: textarea
    id: what
    attributes:
      label: What happened
    validations:
      required: true
  - type: textarea
    id: repro
    attributes:
      label: Steps to reproduce
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: Version
    validations:
      required: true
```

### `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    commit-message:
      prefix: chore
      prefix-development: chore
    open-pull-requests-limit: 5
```

Swap `package-ecosystem` for the detected one: `gomod`, `pip`, `cargo`,
`github-actions`, `docker`. The `commit-message` prefix is mandatory: without
it Dependabot titles are not Conventional, and the release job reads them.

## 2. Commit rules and hooks

### `commitlint.config.mjs`

```js
export default { extends: ['@commitlint/config-conventional'] };
```

### `lefthook.yml` — Node

```yaml
pre-commit:
  commands:
    lint:
      glob: "*.{js,jsx,ts,tsx,mjs,cjs,json,jsonc}"
      run: pnpm exec ultracite fix {staged_files}

commit-msg:
  commands:
    commitlint:
      run: pnpm exec commitlint --edit {1}

pre-push:
  commands:
    test:
      run: pnpm test
```

Install with `lefthook install`. On an npm repo replace `pnpm exec` with
`npx`; on bun, `bunx`. Swap `ultracite fix` for `eslint --fix` when the repo
already runs ESLint.

### `lefthook.yml` — Go

```yaml
pre-commit:
  commands:
    fmt:
      run: test -z "$(gofmt -l .)"
    lint:
      run: golangci-lint run

pre-push:
  commands:
    test:
      run: go test ./...
```

### `lefthook.yml` — Python

```yaml
pre-commit:
  commands:
    lint:
      glob: "*.py"
      run: uv run ruff check {staged_files}
    format:
      glob: "*.py"
      run: uv run ruff format {staged_files}

commit-msg:
  commands:
    commitlint:
      run: pnpm exec commitlint --edit {1}
```

### Husky kept

When the repo already runs husky, keep it. `.husky/commit-msg`:

```sh
pnpm exec commitlint --edit "$1"
```

plus `.husky/pre-commit` running the linter, and `"prepare": "husky"` in
`package.json`. Do not add `lefthook.yml` beside it.

## 3. Workflows

### `.github/workflows/pr-title.yml`

Fork-safe: no checkout, no PR code executed. Required for public repos.

```yaml
name: PR title

on:
  pull_request_target:
    types: [opened, reopened, edited, synchronize]

permissions:
  contents: read

concurrency:
  group: pr-title-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  title:
    name: Validate PR title
    runs-on: ubuntu-latest
    permissions:
      pull-requests: read
    steps:
      - uses: amannn/action-semantic-pull-request@v6
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          validateSingleCommit: true
```

`synchronize` is required when the check gates a merge: a required check must
run on the latest push. `validateSingleCommit` also rejects a single-commit PR
whose commit message, offered by GitHub at squash time, is not Conventional.

For a private repo where every contributor has write access, the same job can
live in `ci.yml` on `pull_request` instead.

### `.github/workflows/ci.yml` — Node, pnpm

```yaml
name: CI

on:
  pull_request:
    types: [opened, reopened, synchronize]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Lint, typecheck, test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```

Drop any step whose script does not exist in `package.json`. npm: remove
`pnpm/action-setup`, set `cache: npm`, and use `npm ci`. ESLint repos replace
`pnpm lint` with `eslint .`.

### `.github/workflows/ci.yml` — Go

```yaml
name: CI

on:
  pull_request:
    types: [opened, reopened, synchronize]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Lint, test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-go@v7
        with:
          go-version-file: go.mod
      - uses: golangci/golangci-lint-action@v9
        with:
          version: v2.13
      - run: go test ./...
```

Add `cache: true` to `setup-go` when the module cache pays off, and a `.gitattributes`
with `*.go text eol=lf` before adding a Windows runner.

### `.github/workflows/ci.yml` — Python, uv

```yaml
name: CI

on:
  pull_request:
    types: [opened, reopened, synchronize]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Lint, test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: astral-sh/setup-uv@v10
        with:
          enable-cache: true
      - run: uv sync
      - run: uv run ruff check .
      - run: uv run ruff format --check .
      - run: uv run pytest
```

### `.golangci.yml` — v2

```yaml
version: "2"

run:
  timeout: 5m

linters:
  default: standard
  enable:
    - bodyclose
    - errorlint
    - gosec
    - misspell
    - revive
```

### `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release-please:
    name: Release please
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
    steps:
      - uses: googleapis/release-please-action@v5
        id: release
        with:
          config-file: .github/release-please-config.json
          manifest-file: .release-please-manifest.json

  publish:
    name: Publish
    needs: release-please
    if: ${{ needs.release-please.outputs.release_created }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v7
      # artifact steps from refs/variants.md, gated by the signals found
```

`release_created` and `tag_name` are root-component outputs. In a monorepo
read `paths_released` and the `<path>--release_created` outputs instead.

### `.github/release-please-config.json`

```json
{
  "packages": {
    ".": {
      "release-type": "node"
    }
  }
}
```

`release-type` per language: `node`, `go`, `python`, `rust`, `terraform-module`.

### `.release-please-manifest.json`

```json
{
  ".": "0.1.0"
}
```

Keep the manifest in sync with the version the repo already ships. Start a
repo that has no tags at `0.1.0`, or at `1.0.0` when the contract is stable.

## 4. Publish shapes

Only the two most common shapes live here. Every other artifact follows
`refs/variants.md`.

### npm, trusted publishing

```yaml
  publish:
    needs: release-please
    if: ${{ needs.release-please.outputs.release_created }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - run: pnpm publish --no-git-checks
```

`id-token: write` plus a trusted publisher entry on npmjs.com replaces
`NPM_TOKEN`. When the registry has no OIDC, read the token from
`${{ secrets.NPM_TOKEN }}` through an env var and scope it to an environment.

### Docker image, GHCR

```yaml
  image:
    needs: release-please
    if: ${{ needs.release-please.outputs.release_created }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v7
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v7
        with:
          push: true
          context: .
          tags: |
            ghcr.io/${{ github.repository }}:${{ needs.release-please.outputs.tag_name }}
            ghcr.io/${{ github.repository }}:latest
```

Add a `platforms:` matrix (`linux/amd64`, `linux/arm64`) only when the image
must run on arm64 hosts.
