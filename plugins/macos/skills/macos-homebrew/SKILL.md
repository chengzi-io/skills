---
name: macos-homebrew
description: >
  Publish a macOS app on Homebrew, either the official homebrew/cask or the user's own tap kept up to date by a release job.
disable-model-invocation: true
allowed-tools: Bash(xcrun swift *)
metadata:
  version: "2026.11.20"
---

# Homebrew cask

Goal: users install the app with `brew install --cask`; the app keeps updating itself
(through Sparkle or the project's own updater) and Homebrew only installs it.

`<skill>` is this skill's directory. `<token>` is the Homebrew cask token (usually the
app name in lower case; `brew generate-cask-token` is authoritative).

## Environment

!`xcrun swift -e 'import Foundation; let fm = FileManager.default; var brew = "none"; for path in ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"] { if fm.isExecutableFile(atPath: path) { brew = path; break } }; var gh = "none"; for path in ["/opt/homebrew/bin/gh", "/usr/local/bin/gh", "/usr/bin/gh"] { if fm.isExecutableFile(atPath: path) { gh = path; break } }; print("brew=\(brew) gh=\(gh)")'`

Claude Code replaces the line above with its output when the skill loads. Elsewhere, run
that one command yourself. It is a single command on purpose (no `&&`, `|`, `$()`), so
one `allowed-tools` rule covers it. Official cask checks and a local audit need `brew`.
`gh` is needed to open the official cask pull request or to push to an own tap. If one
is `none`, stop and ask the user to install it.

## 1. Detect the project

Collect the facts, and ask for anything you cannot tell:

- App display name, `.app` file name, bundle identifier, minimum macOS, whether the app
  is sandboxed (App Sandbox in entitlements or Info.plist).
- GitHub repository (`gh repo view` or ask), and whether there is already a published
  release (`gh release list --exclude-drafts --limit 1`).
- How the release DMG is named and where it is downloaded from (a URL pattern such as
  `https://github.com/<owner>/<repo>/releases/download/v#{version}/<App>-#{version}.dmg`).
  Do not assume a template layout or `dist/<App>-<version>.dmg`.
- Where the version comes from: a published GitHub release, a version file, marketing
  version, or the user.
- Whether the app is signed with a Developer ID (team ID set, or the user says so). That
  decides official cask versus an own tap.
- Existing release workflow file, job names, secrets environment (default `release`),
  and a scripts directory if the project has one.

This skill does not install a release pipeline. There must already be a published
release to submit a cask or to preview one.

## Plan

Show the user this plan and wait for the go-ahead: step 2 picks the channel, and the
later steps differ per channel.

1. Read the facts, recommend a channel.
2. Official cask: cask, checks, pull request, then the README and any releasing docs.
3. Own tap: the user's repository and token, then the wiring.
4. Own tap: check the cask, commit.
5. Later: from the own tap to the official cask.

## Steps

### 2. Read the facts and pick the channel

| | Official `homebrew/cask` | Own tap |
| --- | --- | --- |
| Users run | `brew install --cask <token>` | `brew install --cask <owner>/<name>/<token>` |
| Signing | Developer ID and notarized: Homebrew requires the app to pass Gatekeeper | Any; ad-hoc builds take scheme A or B |
| Who gets in | A notable repository, at least 30 days old | Anyone |
| New versions | BrewTestBot checks every 3 hours and opens the update pull request itself; the release workflow does nothing | A job the user adds after a successful publish pushes the cask |
| One-time work | A pull request the user reviews and answers for | A tap repository and a token |

```bash
gh repo view --json stargazerCount,forkCount,watchers,createdAt
gh release list --exclude-drafts --limit 1
```

- No Developer ID: own tap, scheme A or B.
- Developer ID, but the repository is not notable yet: own tap with scheme C now, the
  official cask later (step 6).
- Developer ID and notable: the official cask. No tap, no token, no workflow change.

### 3. Official cask

Follow [references/official-cask.md](references/official-cask.md). Ask the user before
each step that acts on their GitHub account.

### 4. Own tap: the user's part

Follow [references/own-tap.md](references/own-tap.md#what-the-user-sets-up). Ask before
creating anything in their account.

### 5. Own tap: wire it in and check it

Follow [references/own-tap.md](references/own-tap.md#wire-it-in), then
[references/own-tap.md](references/own-tap.md#check-and-finish). The Gatekeeper schemes
that decide the cask and the README notice:
[references/own-tap.md](references/own-tap.md#how-the-cask-meets-gatekeeper).

### 6. Later: from the own tap to the official cask

Follow [references/official-cask.md](references/official-cask.md#from-the-own-tap).

## Changes

| File or setting | Official `homebrew/cask` | Own tap |
| --- | --- | --- |
| `README.md` (or the project's install docs) | the install command | the install command, plus a notice for an ad-hoc cask |
| releasing docs, if the project has them | [wiring/releasing-official.md](wiring/releasing-official.md) | [wiring/releasing-tap.md](wiring/releasing-tap.md) |
| the release workflow | nothing | a `homebrew` job after the publish job, from [wiring/homebrew-job.yml](wiring/homebrew-job.yml) |
| project config (xcconfig, env file, or the script's own variables) | nothing | tap name, and the unsigned scheme while ad-hoc |
| the cask update script | nothing | copied from `wiring/update-cask.sh` into the project's scripts directory |
| the secrets environment (default `release`) | nothing | `HOMEBREW_TAP_TOKEN` (name configurable) |
| a tap repository | nothing | the user's |

## The user's part

- The GitHub account: the fork and the pull request for the official cask; the tap
  repository and its token for the own tap.
- Reviewing the submission in their name, and answering Homebrew's maintainers.
- The Developer ID itself is `macos-developer-id`; nothing here creates a
  certificate.

## Done when

1. The own tap changes are committed on a branch; the official cask is a merged pull
   request. Run the project's usual check (`make ci` or equivalent) if it has one.
2. Own tap: the next release's Homebrew job is green, and
   `brew install --cask <owner>/<name>/<token>` works.
3. Official cask: `brew install --cask <token>` works after the merge. Nothing in the
   repository is required to change besides the install docs.

## Never

- create the tap repository, the token or the fork yourself, or push to the user's
  account without asking
- name AI as author or co-author of a commit to the official cask, or add an
  `Assisted-by` trailer
- ask the maintainers to review before the user has reviewed the submission
- submit an ad-hoc cask to the official `homebrew/cask`: it never passes the Gatekeeper
  check
- cut a release or design a DMG window: that is not this skill
