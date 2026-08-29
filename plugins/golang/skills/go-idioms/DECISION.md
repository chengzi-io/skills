# Distill samber Go skills into this skill

- **Date**: 2026-08-29
- **Status**: Accepted
- **Related**: [PROVENANCE.md](PROVENANCE.md)

## Context

`samber/cc-skills-golang` is the strongest public Go skill suite (eval deltas, active maintenance). This marketplace pins self-contained upstreams (`dependencies.json`). Samber’s skills are a mesh: each `SKILL.md` tells the model to load sibling skills. Pinning a subset leaves dangling refs; pinning ~46 skills loads dozens of Go descriptions into every golang-plugin session and pulls in orchestrators plus `samber/*` libraries.

We need model-failure traps (typed nil, append aliasing, consumer-side interfaces), not an Effective Go reprint and not a changelog.

## Decision

We will **distill** selected traps into this first-party skill (`go-idioms`), with dimensions in `reference/`. We will **not** pin `samber/cc-skills-golang`. Runtime `SKILL.md` / `reference/` must not name upstream skill slugs. Re-read upstream via [PROVENANCE.md](PROVENANCE.md) when Go or that repo moves; do not vendor their files.

## Consequences

- **+** One description in the golang plugin; independence rule holds; no oops/lo/how-to always-load.
- **+** We can slim to traps linters miss.
- **-** We own refresh when Go or samber changes. Provenance in this directory is mandatory.
- **-** Distillation can drift from upstream. Mitigate by recording commit and dropped topics in [PROVENANCE.md](PROVENANCE.md).

## Alternatives Considered

- **Pin the whole suite**: rejected — description tax and stack-default bias.
- **Pin 5–6 high-delta skills**: rejected — outbound `@skill` refs do not close; weekly sync restores them.
- **Write original skills with no upstream read**: rejected — duplicates work samber already eval’d.
