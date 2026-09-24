# Variant heuristics

Signal first, recipe second. No signal, no step. This file is a decision
table, not a catalogue — stop at the signals the repo actually shows.

## 1. Linter and formatter

| Signal | Tool | Hook command | CI command |
| --- | --- | --- | --- |
| `package.json`, no ESLint config | Biome via Ultracite: `npx ultracite init`, pick Biome | `ultracite fix` | `ultracite check` |
| `package.json` plus an ESLint config | ESLint, unchanged | `eslint --fix` | `eslint .` |
| `go.mod` | golangci-lint v2, `.golangci.yml` with `version: "2"` | `golangci-lint run` | `golangci-lint-action@v9`, `version: v2.13` |
| `pyproject.toml` | ruff | `ruff check` + `ruff format` | `uv run ruff check .` |
| `Cargo.toml` | clippy + rustfmt | `cargo clippy -- -D warnings` | same, plus `cargo fmt --check` |
| `*.xcodeproj`, `Package.swift` | SwiftLint / SwiftFormat | per swift plugin guidance | same |
| no source language | none | none | none |

A repo with an existing lint config keeps it. Adding a second linter beside a
working one is a conflict, not an upgrade.

## 2. When to add a matrix

Add a matrix only when a job genuinely differs per axis:

- native compilation per OS (cgo, Tauri, Electron, goreleaser);
- a runtime compatibility claim (Node 20 and 22, Go 1.24 and 1.25, Python
  3.11 through 3.13);
- multi-architecture images.

```yaml
strategy:
  fail-fast: false
  matrix:
    os: [ubuntu-latest, macos-latest]
```

Do not matrix a pure-JavaScript lint or test job across operating systems.
Keep the matrix to two or three entries, and include `ubuntu-latest` plus the
platforms the artifact ships to. Rename the job only when the matrix forces
it, because a required status check breaks on a rename.

## 3. Artifact to CD step

| Signal | Publish target | Shape |
| --- | --- | --- |
| `package.json` with `bin` or `files`, registry public | npm | trusted publishing, `id-token: write` |
| `Dockerfile` | GHCR | `build-push-action@v7`, tags from the release tag plus `latest` |
| `tauri.conf.json` | desktop bundles | goreleaser or `tauri-action`, matrix per OS, signing secrets in an environment |
| electron-builder config | desktop installers | `electron-builder`, upload to the GitHub Release, signing plus notarization secrets |
| `eas.json` | Expo app | `expo-github-action@v9`, `eas build`, internal track first |
| `.goreleaser.yaml` | CLI binaries | `goreleaser-action@v7`, plus a Homebrew tap when users expect one |
| `pyproject.toml` with a build backend | PyPI | `pypa/gh-action-pypi-publish@v1`, trusted publishing |
| `Cargo.toml` | crates.io | `cargo publish` with a registry token in environment secrets |
| `action.yml` at the repo root | GitHub Actions market | the tag is the release; no package job at all |
| VSCode extension manifest | VS Code marketplace | `vsce publish` with `VSCE_PAT` |
| static export only, no release | none | deploy on push to the default branch; skip the release workflow |

Mobile and desktop publishing touches store credentials and signing keys.
Keep those jobs in a GitHub Environment with required reviewers, and publish
to an internal track before the store.

## 4. Deploy target to CD step

| Signal | Step |
| --- | --- |
| ArgoCD `Application` or Flux `Kustomization` in the repo | update the image tag or overlay and let the controller sync; never `kubectl apply` from CI |
| `wrangler.toml` | `wrangler deploy` with `CLOUDFLARE_API_TOKEN` from secrets, or `cloudflare/wrangler-action@v4` |
| `fly.toml` | `flyctl deploy` with `FLY_API_TOKEN` |
| `vercel.json`, `netlify.toml` | prefer the platform git integration; add a workflow only when the build needs repo secrets |
| k8s manifests, no GitOps controller | `kubectl set image` or `helm upgrade`, `KUBE_CONFIG` from secrets, production behind an Environment |
| AWS Lambda or ECS | `aws-actions/configure-aws-credentials@v6` with an OIDC role, no long-lived keys |
| database migrations present | a separate job that runs before deploy, gated on the same release output |

Deployment never runs on a push that created no release, unless the platform
integrates by git push and the repo chose that path.

## 5. Release strategy

| Signal | Config |
| --- | --- |
| default semver | plain config and manifest |
| monorepo, `packages/` or `apps/` | a `packages` map, one path per package; publish from `paths_released` and the `<path>--release_created` outputs |
| packages that must move together | the `linked-versions` plugin |
| beta channel | `"versioning": "prerelease"`, `"prerelease-type": "beta"`, `"prerelease": true` |
| force one specific version | `"release-as": "2.0.0"`; remove or raise it after that release or the next run reuses it |
| pre-1.0 where breaking means minor | `"bump-minor-pre-major": true` |
| maintained old line | a `release/v1` branch with its own config and manifest, and `target-branch` in the action input |
| existing tags look like `2026.09` | release-please has no date strategy; keep the base with `release-as` each release, or tag by hand |
| private app, docs repo, no public contract | no release workflow at all; hooks, title check, and CI only |

Available `versioning` values: `default`, `always-bump-patch`,
`always-bump-minor`, `always-bump-major`, `prerelease`, `service-pack`,
`java-snapshot`, `dependency-manifest`.

## 6. Repository shape

| Signal | Consequence |
| --- | --- |
| public repo, outside contributors | `pr-title.yml` on `pull_request_target`, no checkout of PR code |
| private repo, every contributor writes | one `ci.yml` on `pull_request`, title job inside it |
| `.husky/` or a `prepare` script | keep husky, do not add lefthook |
| existing `.github/workflows/` | merge jobs into the current files; keep job names, required checks break on rename |
| `AGENTS.md`, `CLAUDE.md`, `.agents/` | the repo carries agent instructions; still scaffold the pipeline, but check for an in-repo hook policy first |

## 7. Security add-ons

Add only when the signal is there:

| Signal | Addition |
| --- | --- |
| binaries attached to a public Release | keyless cosign signing and an SBOM; goreleaser does both natively |
| image pushed to a public registry | cosign sign plus attestation after the push |
| code in a mainstream language, public repo | CodeQL on a schedule, not on every PR |
| image built from third-party base | Trivy scan as a CI job |
| any long-lived registry token | replace with OIDC trusted publishing where the registry supports it |
| supply-chain policy demands immutable pins | pin third-party actions to a commit SHA, with the version in a trailing comment |

## 8. Stop conditions

- Signal absent: skip the step. Do not generate a job for a target the repo
  does not publish to.
- Two signals conflict, for example husky and lefthook both configured: stop
  and ask which one stays.
- The repo already ships a working pipeline: audit it instead of rewriting
  it.
- The variant is not in this table: derive it from the signals, keep the
  smallest pipeline that satisfies them, and say what you derived and why.
