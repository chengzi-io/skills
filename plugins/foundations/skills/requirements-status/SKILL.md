---
name: requirements-status
description: "Report which EARS requirements are passing, failing, in progress, or untested by joining docs/requirements/ with acceptance-test results into a generated docs/requirements/STATUS.md. Use when the user asks which features are done, requirement status, progress, what is implemented or left, or to update STATUS.md. Also use after finishing a feature, before calling it done."
license: MIT
metadata:
  version: "2026.11.06"
---

# Requirements Status

`docs/requirements/STATUS.md` tells the user which requirements actually work. It is generated from test results, never written by hand: a requirement is done when a test proves it, not when an agent says so.

## Inputs

- Requirements: `### FR-<DOMAIN>-NNNN Title` headings in `docs/requirements/*.md` (written with `write-ears`).
- Acceptance tests whose names contain requirement IDs, per the naming rule in `write-ears`. Tests without an ID are ignored.

## Workflow

1. Run the tests with a machine-readable report. Keep `reports/` out of git.

   | Runner | Command |
   |--------|---------|
   | pytest | `pytest --junitxml=reports/junit.xml` |
   | Vitest | `vitest run --reporter=junit --outputFile=reports/junit.xml` |
   | Jest (add `jest-junit`) | `JEST_JUNIT_OUTPUT_FILE=reports/junit.xml jest --ci --reporters=default --reporters=jest-junit` |
   | Playwright | `PLAYWRIGHT_JUNIT_OUTPUT_FILE=reports/junit.xml npx playwright test --reporter=junit` |
   | Go | `go test -json ./... > reports/go-test.json` |
   | cargo-nextest | add `[profile.ci.junit]` `path = "junit.xml"` to `.config/nextest.toml`, run `cargo nextest run --profile ci`, read `target/nextest/ci/junit.xml` |

   Any other runner that writes JUnit XML works. A run with failing tests still writes its report; continue.

2. Generate the report with the bundled script (path relative to this skill's directory):

   ```bash
   python3 scripts/requirements_status.py reports/junit.xml [more result files…]
   ```

   `--requirements DIR` (default `docs/requirements`), `--output FILE` (default `docs/requirements/STATUS.md`), `--check` (exit 1 if the file is stale, for CI).

3. Tell the user the totals and the "Needs attention" list. Commit `STATUS.md` in the same change as the code and tests that moved it.

## Statuses

| | Meaning |
|---|---------|
| ✅ | Every test naming it passes |
| ❌ | At least one test fails |
| 🚧 | Some tests are skipped: work in progress |
| ⚪ | No test names it: not done, whatever anyone claims |
| ⚠ | A test names an ID that no requirement has |

## Rules

- Never edit `STATUS.md` by hand, and never report a requirement as done without ✅.
- Fix ⚠ by correcting the test's ID, or ask the user whether a requirement is missing. Never add a requirement yourself.
- In CI, run the tests and then the script with `--check`, so a stale `STATUS.md` fails the build.
