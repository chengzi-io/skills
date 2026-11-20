---
name: macos-app-icon
description: >
  Create a macOS app icon as an Icon Composer .icon (Liquid Glass layers) from a logo, drawn SVG layers, or an image-model prompt, and preview it beside installed apps.
disable-model-invocation: true
allowed-tools: Bash(xcrun swift *)
metadata:
  version: "2026.11.20"
---

# App icon

The icon has to hold up next to the best icons in the user's Dock, in every appearance
and at 32 pt. A weak icon is worse than leaving the current one, so nothing replaces the
project's icon until the user has seen the draft beside other apps and approved it.

`<skill>` is this skill's directory. Its scripts run from anywhere inside the project
and take paths relative to the project root. Drafts and renders go in `.build/icon/`
unless the user names another folder.

## Environment

!`xcrun swift -e 'import Foundation; func run(_ tool: String, _ args: String...) -> String { let p = Process(); p.executableURL = URL(fileURLWithPath: tool); p.arguments = args; let o = Pipe(); p.standardOutput = o; p.standardError = Pipe(); do { try p.run(); p.waitUntilExit() } catch { return "error" }; return String(data: o.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? "" }; let ver = run("/usr/bin/xcodebuild", "-version").split(whereSeparator: \.isNewline).first.map(String.init) ?? "unknown"; let dev = run("/usr/bin/xcode-select", "-p").trimmingCharacters(in: .whitespacesAndNewlines); let ic = URL(fileURLWithPath: dev).deletingLastPathComponent().appendingPathComponent("Applications/Icon Composer.app/Contents/Executables/ictool").path; let has = FileManager.default.isExecutableFile(atPath: ic); let ictool = has ? ic : "none"; print("xcode=\(ver) ictool=\(ictool)")'`

Claude Code replaces the line above with its output when the skill loads. Elsewhere, run
that one command yourself. It is a single command on purpose (no `&&`, `|`, `$()`), so
one `allowed-tools` rule covers it. `ictool=none` means Icon Composer is missing: stop
and ask the user to select Xcode 26, which ships it. Its `ictool` renders the checks.

## 1. Detect the project

Find the icon output and what the app is called. Ask the user only for what you cannot
tell:

- Look for an Icon Composer bundle (`*/AppIcon.icon` or any folder named `*.icon` that
  contains `icon.json`).
- If there is none, look for `**/Assets.xcassets/AppIcon.appiconset` (or the name in
  `ASSETCATALOG_COMPILER_APPICON_NAME`).
- If both exist, ask which one to change. Prefer the `.icon` (Xcode 26 / Liquid Glass);
  do not overwrite the appiconset unless the user says to.
- If there is only an appiconset and no `.icon`, **ask the user what to do**. Do not
  create a `.icon`, and do not generate a raster appiconset, until they choose. If they
  want a new `.icon`, agree with them where it should live and how it will be set as the
  app icon (`ASSETCATALOG_COMPILER_APPICON_NAME`, adding the `.icon` to the Xcode
  target). If they want to keep the appiconset only, stop: this skill writes Icon
  Composer `.icon` files.
- If neither exists, ask where the `.icon` should be written.
- The app's name and what it does: README, an xcconfig (`APP_NAME`, `APP_DISPLAY_NAME`),
  Info.plist, then the user.

Remember the chosen `.icon` path as `<icon>`. All later steps use it. Do not assume
`App/Application/AppIcon.icon`.

## Plan

Say what will change and wait for the user's go-ahead: the approved draft replaces
`<icon>` as a whole folder, and one commit. Nothing else changes.

## Steps

### 2. Start

Read the README (or the facts from step 1) and the current `<icon>`, if it exists
([how it works](references/icon-json.md)). Then ask the user, in one message, only for
what is still missing:

- what the app does and for whom, in one sentence;
- a logo or image to start from, if they have one;
- colors they want, or a mood;
- two to four installed apps whose icons they like: the Dock check sets the draft
  between them.

| They have | Path |
| --- | --- |
| A logo or an image | step 3 |
| Nothing; a mark of simple shapes suits the app | step 4, then 5 |
| Nothing; it wants a character, an illustration or soft volume | step 4, then 6 |

### 3. From an image

Turn the logo into one layer file per depth: an SVG layer, or a PNG or JPG placed with
`image-layer.swift`. A finished icon with its own tile is not a layer. Take the fill from
the logo's colors and write `icon.json`. The rules and the command:
[from an image](references/artwork.md#from-an-image).

### 4. Concepts

Draw six to eight different ideas as black marks, render them with
`<skill>/scripts/concepts.sh`, and show the sheet. The user picks one or two, or asks for
another round. Rules: [concepts](references/artwork.md#concepts).

### 5. Draw

Build the pick as layers in `.build/icon/<letter>.icon` (start from a copy of `<icon>`,
or from a minimal `icon.json` if there is no current `.icon`), in two or three variants
of color and depth. Rules: [drawing the pick](references/artwork.md#drawing-the-pick).

### 6. Image model

For what code draws badly (a character, an illustration, soft 3D volume), give the user
one prompt per layer to generate: [the image-model prompt](references/artwork.md#the-image-model-prompt).
Reject what comes back with text, a signature, a tile or a drawn shadow, then place each
one with `image-layer.swift`: the layout is decided there, not by the model.

### 7. Check

```bash
<skill>/scripts/check-icon.sh <draft.icon> [/Applications/<App>.app ...]
```

It renders macOS 26 in all six appearances, 32 pt, this Mac's Finder icon, and the icon
between installed apps at 128 pt and 32 pt, and it fails when actool rejects or warns
about the icon. What to look for: [the check sheets](references/check.md).

### 8. Approve

Show the user both sheets of each variant. They pick, ask for changes, or reject. After
two rounds without a pick, stop and say so: suggest the image-model path (step 6) if it
was not tried, or a designer. Never put a draft the user has not approved into `<icon>`.

### 9. Finish

1. Replace `<icon>` with the approved draft, the whole folder, so no old layer file
   lingers.
2. If the project has a check that compiles the icon (`make assets`, `make ci`, or an
   `actool` script), run it; otherwise `check-icon.sh` on the installed `<icon>` is the
   check.
3. Tell the user that Icon Composer (Xcode › Open Developer Tool) edits the same file, if
   they want to tune it by hand; run `check-icon.sh` again after they save.
4. When Dock or Finder keeps showing the old icon: the built `.app` is still right. Look
   at the `.app` itself (`open -R <path>`, then Get Info) and refresh the cache with
   `killall Dock`, or log out and in.
5. Commit `<icon>`. Ask the user whether the message should be `chore(icon): set the app
   icon` or a `feat` / `fix` they prefer; do not infer this from a template version file.

## Changes

| File | Change |
| --- | --- |
| `<icon>/icon.json` | the fill, the groups and their properties |
| `<icon>/Assets/` | one image per layer |
| `<icon>` | replaced as a folder, so old layers go |

## The user's part

- Give the logo, the image or the colors, and name the apps whose icons they like.
- Pick a concept from the sheet, and approve the final draft.
- Generate the image-model layers, if that path is taken.
- If the project has only an appiconset, choose whether to add a `.icon`.

## Done when

- `check-icon.sh` passes and both sheets look right at 32 pt, in every appearance, and in
  the Dock row.
- The user approved the draft, and the project's icon check (step 9) has passed after
  the replacement.

## Never

- Put a draft into `<icon>` that the user has not approved.
- Create a `.icon` or rasterize an appiconset on your own when the project has only an
  appiconset: ask first.
- Draw a rounded square, a tile, a shadow or gloss: the system adds those.
- Use an SF Symbol, Apple product imagery or another brand's logo.
- Advise `make clean` or deleting DerivedData when Dock or Finder shows the old icon:
  the build is not at fault.
- Package a DMG, sign a release, or edit a settings window: that is not this skill.
