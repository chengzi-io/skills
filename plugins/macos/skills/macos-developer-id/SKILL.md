---
name: macos-developer-id
description: >
  Set up Developer ID signing and notarization: the certificate and notary key once per Apple account, then the signing secrets in the current GitHub repository.
disable-model-invocation: true
allowed-tools: Bash(xcrun swift *)
metadata:
  version: "2026.11.20"
---

# Developer ID signing

Goal: releases signed with a Developer ID and notarized by Apple, so the app opens
without the Open Anyway detour and permissions survive updates.

This skill has two phases. Phase A is once per Apple Developer account. Phase B is once
per repository: it stores the account's credentials as GitHub secrets this project can
use. The skill does not install a release pipeline and does not cut a release.

`<skill>` is this skill's directory.

What users get:

| | Ad-hoc (default) | Developer ID |
| --- | --- | --- |
| First launch | Blocked by Gatekeeper, once: System Settings → Privacy & Security → **Open Anyway** | Opens |
| Updates through Sparkle | Work: EdDSA proves they came from you, and no Gatekeeper prompt | Work |
| Permissions (camera, screen recording, accessibility…) and keychain items | May be asked for again after an update: every build has a new signature | Kept |
| Homebrew cask (`macos-homebrew`) | Own tap only: blocked at first launch, or the cask clears the quarantine flag | Installs, and can go to the official `homebrew/cask` |

Ad-hoc builds have no hardened runtime (its library validation would reject the
embedded Sparkle framework) and no notarization.

## Environment

!`xcrun swift -e 'import Foundation; let fm = FileManager.default; var xcode = "none"; for path in ["/Applications/Xcode.app", "/Applications/Xcode-beta.app"] { if fm.fileExists(atPath: path) { if let data = fm.contents(atPath: path + "/Contents/Info.plist") { if let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] { if let s = plist["CFBundleShortVersionString"] as? String { xcode = s } } }; break } }; var gh = "none"; for path in ["/opt/homebrew/bin/gh", "/usr/local/bin/gh", "/usr/bin/gh"] { if fm.isExecutableFile(atPath: path) { gh = path; break } }; print("xcode=\(xcode) gh=\(gh)")'`

Claude Code replaces the line above with its output when the skill loads. Elsewhere, run
that one command yourself. It is a single command on purpose (no `&&`, `|`, `$()`), so
one `allowed-tools` rule covers it. If `gh=none`, stop and ask the user to install and
sign in to the GitHub CLI. If `xcode=none`, they need Xcode to create the certificate.

## 1. Detect the project

Before changing anything, find how this repository signs and stores secrets. Ask only
for what you cannot tell:

- GitHub repository: `gh repo view`, or ask.
- Where the team ID lives, if at all: `TEAM_ID` or `DEVELOPMENT_TEAM` in an xcconfig,
  `DEVELOPMENT_TEAM` in a `.pbxproj`, an ExportOptions plist. Remember this path; do
  not assume `App/Configs/Identity.xcconfig`.
- Whether a release workflow already exists, and which GitHub environment it uses for
  secrets. Default environment name: `release`. Default secret names (keep these on a
  project already wired for them):

  - `DEVELOPER_ID_P12_BASE64`
  - `DEVELOPER_ID_P12_PASSWORD`
  - `NOTARY_API_KEY_P8_BASE64`
  - `NOTARY_API_KEY_ID`
  - `NOTARY_API_ISSUER_ID`

  If the workflow uses different names, use those, or ask.
- Whether a release pipeline is already installed. If it is not, say so: this skill
  only creates the certificate and configures secrets; it will not install or run the
  project's release process.

## Plan

Show the user this plan and wait for the go-ahead before the first step.

Phase A — once per Apple Developer account (the user does this):

1. The Developer ID Application certificate, exported as a `.p12`.
2. The App Store Connect notary key.
3. The certificate in the login keychain, and notary credentials for local releases.

Phase B — once per repository:

4. The team ID written where this project keeps it, on a branch and a PR.
5. The five secrets in the chosen GitHub environment (default `release`).
6. A check that the next release can be notarized, using whatever this project already
   has.
7. If `README.md` has a `### First launch` subsection (the Gatekeeper detour), remove
   it after a notarized build exists. If it has no such heading, leave the README.

## Phase A — the account

The user must have an Apple Developer Program membership and the Account Holder role:
only they create the certificate and the keys. Do not create these for them, and do
not read a secret's value.

### A1. The certificate (the user)

1. Join the Apple Developer Program.
2. Create a **Developer ID Application** certificate: Xcode → Settings → Accounts →
   Manage Certificates, as Account Holder.
3. Export it with its private key from Keychain Access as a `.p12`, with a password.

### A2. The notary API key (the user)

App Store Connect → Users and Access → Integrations → App Store Connect API: create a
team key with the Developer role, download the `.p8` once, and note the key ID and the
issuer ID.

### A3. Local releases (the user)

Keep the certificate in the login keychain, and store the notary credentials once:

```bash
xcrun notarytool store-credentials notary --key AuthKey_XXXXXXXXXX.p8 \
  --key-id XXXXXXXXXX --issuer <issuer uuid>
```

Later, local notarization uses `NOTARY_PROFILE=notary` with the project's own release
command, if it has one.

Skip Phase A when this account already has a Developer ID Application certificate and
a notary key: go on to Phase B with those files.

## Phase B — this repository

Keep the same Sparkle key if the app has already shipped: installed copies accept the
first Developer ID update by its EdDSA signature, so never generate a second one. This
transition has not been exercised yet; try it with a test build before relying on it.

Ad-hoc releases may carry a first-launch note in GitHub Release notes (if the project's
publish script adds one) and in `README.md` (B4 below). This skill does not rewrite notes
on releases already published; if the publish script inserts the note, the user updates
that script.

### B1. Team ID

Set the team ID in the file found in step 1, commit it on a branch and open a PR. With
the team ID set, a missing certificate or notary secret should fail the release instead
of falling back to ad-hoc, if the project's workflow is written that way.

### B2. The secrets (the user)

The exported files sit in the repository root only while this step needs them
(`.gitignore` should cover `*.p12` and `*.p8`; add those patterns if they are missing).
The user runs these there, then deletes the files. Substitute the environment name and
secret names from step 1 if they differ:

```bash
base64 -i developer-id.p12 | gh secret set DEVELOPER_ID_P12_BASE64 --env release
gh secret set DEVELOPER_ID_P12_PASSWORD --env release
base64 -i AuthKey_XXXXXXXXXX.p8 | gh secret set NOTARY_API_KEY_P8_BASE64 --env release
gh secret set NOTARY_API_KEY_ID --env release --body XXXXXXXXXX
gh secret set NOTARY_API_ISSUER_ID --env release --body <issuer uuid>
```

The publish job, if the project has one, should import them into a temporary keychain
and delete it when the job ends.

### B3. Check a notarized build

After the next release the project already knows how to produce, or a local signed
build:

```bash
spctl --assess --type execute -vv dist/<App>.app          # source=Notarized Developer ID
spctl -a -t open --context context:primary-signature -vv dist/<App>-X.Y.Z.dmg
xcrun stapler validate dist/<App>-X.Y.Z.dmg
```

Adjust the paths to whatever this project emits. If it has a doctor or status script
that reports signing, run that too. None of these are required to exist.

### B4. Remove a first-launch note from `README.md`, if it has one

A signed, notarized build opens without the Gatekeeper detour. If `README.md` contains
a `### First launch` subsection, remove that heading and its paragraph, up to the next
heading. If the heading is not there, do not edit the README.

```bash
awk '/^### First launch$/ { skip = 1; next } skip && /^#/ { skip = 0 } !skip' \
    README.md >README.md.new && mv README.md.new README.md
grep -n '### First launch' README.md
```

The `grep` prints nothing once the subsection is gone, or if it was never there. Commit
the `README.md` change with the team ID one or on its own.

## Changes

| File or setting | What changes |
| --- | --- |
| the project's team ID location | the Developer ID team, once agreed |
| the GitHub environment (default `release`) | the five secrets, under the names in step 1 |
| `README.md` | a `### First launch` subsection is removed, only if it was present |
| the login keychain | the certificate, for local releases |
| the release workflow | nothing, when it already imports these secret names once a team ID is set |

## The user's part

- The Apple Developer Program membership and the Account Holder role; the **Developer ID
  Application** certificate and its `.p12`; the App Store Connect team key and its
  `.p8`; every secret typed into `gh`; `notarytool store-credentials`.
- Deleting the exported `.p12` and `.p8` once the secrets are stored.

## Done when

1. The team ID is set in the project, and the five secrets exist in the chosen
   environment (confirm with `gh secret list --env <environment>`, names only).
2. The next release, or a local signed build, passes `spctl --assess --type execute -vv`
   with `source=Notarized Developer ID`, and `xcrun stapler validate` on its disk image
   when the project ships one.
3. `README.md` has no `### First launch` heading, or never had one.

## Never

- create the certificate, the App Store Connect key or the secrets for the user, or read
  a secret's value
- commit the `.p12`, the `.p8` or their passwords
- generate a new Sparkle key for an app that has shipped: installed copies would reject
  every update
- push or merge the team ID PR for the user
- cut a release, design a DMG window, or publish a Homebrew cask: that is not this skill
