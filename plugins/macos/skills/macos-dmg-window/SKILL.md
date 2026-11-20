---
name: macos-dmg-window
description: >
  Design the DMG installer window (background, icon layout, live Finder preview) and switch the project's DMG build to dmgbuild so releases use it.
disable-model-invocation: true
allowed-tools: Bash(xcrun swift *)
metadata:
  version: "2026.11.20"
---

# DMG window

The DMG window is the first screen of the product a user sees: the app icon, an arrow,
the Applications folder. The app icon carries the brand; the background frames it. The
background never has text: it is one image for every language, and the arrow needs none.

Using this skill means the user wants a designed window. There is no plain-window
fallback: once the build step is wired, it requires the design files.

`<skill>` is this skill's directory. Its scripts run from anywhere inside the project.

## Environment

!`xcrun swift -e 'import Foundation; import CoreGraphics; let fm = FileManager.default; var py = "none"; for path in ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"] { if fm.isExecutableFile(atPath: path) { py = path; break } }; var pk = "none"; for path in ["/opt/homebrew/bin/peekaboo", "/usr/local/bin/peekaboo"] { if fm.isExecutableFile(atPath: path) { pk = path; break } }; let rec = CGPreflightScreenCaptureAccess() ? "yes" : "no"; print("python3=\(py) screen_recording=\(rec) peekaboo=\(pk)")'`

Claude Code replaces the line above with its output when the skill loads. Elsewhere, run
that one command yourself. It is a single command on purpose (no `&&`, `|`, `$()`), so
one `allowed-tools` rule covers it. `python3=none` means dmgbuild cannot run until the
user installs Python 3.10 or later (`brew install python`). `screen_recording=no` means
`preview-dmg.sh` cannot screenshot the Finder window: ask the user to grant Screen
Recording, or to open the DMG and look. `peekaboo` is optional, for inspecting the
preview; official review is the Finder screenshot.

## 1. Detect the project

Find these, and ask for anything you cannot tell:

- Where the project already builds a DMG: a script such as `scripts/make-dmg.sh`, a
  Makefile target, a workflow step (`create-dmg`, `hdiutil`, `dmgbuild`), or a packaging
  tool. Remember the exact file and the command that produces the DMG.
- The existing script's arguments, if it has one (the common shape is
  `<script> <app> <dmg>`).
- A design directory: if `App/Configs/DMG` already exists, use it; otherwise suggest a
  path (`DMG/`, `packaging/dmg/`, or next to the project's other resources) and confirm
  with the user. Remember it as `<design-dir>`.
- A built `.app` to preview with, and the app's display name (for the volume name):
  DerivedData, `.build`, `dist`, or ask. Do not assume
  `.build/xcode/Build/Products/Debug/<App>.app`.
- The app icon, for brand colors: an Icon Composer `.icon` (`icon.json` and `Assets/`),
  or the user. Do not assume `App/Application/AppIcon.icon`.
- The release workflow, if any, and whether it already installs Python 3.10 or later
  (for example `actions/setup-python`). The system Python on some GitHub runners is 3.9
  and is not enough for dmgbuild.

## Plan

Say what will change and wait for the user's go-ahead: `<design-dir>` (Background.swift,
settings.py, the PNGs), the project's DMG build step (switched to dmgbuild, with
`<design-dir>` written into it), a pip requirements file, and a CI Python step if the
workflow does not already have one. The level is the user's call: default, light brand
or full brand.

## How the designed DMG is built

dmgbuild 1.6.7 builds the window from `<design-dir>`:

```text
hdiutil create a blank image and attach it; copy the app, link Applications, write
.VolumeIcon.icns from the app's AppIcon.icns, copy background.png and @2x, write .DS_Store
(window size, icon spots, background); detach, shrink, convert to compressed UDZO
```

| Input | Source | Change it here |
| --- | --- | --- |
| App, volume icon, volume name | the project's existing app build; the app's `AppIcon.icns`; the display name | No |
| Background | `<design-dir>/Background.swift`, rendered to `background.png` and `@2x`; `art.png` when an image model made the art | Yes |
| Layout | `window_rect`, `icon_size`, `text_size`, `icon_locations` in `<design-dir>/settings.py` | Yes, with the constants in `Background.swift` |
| The rest of `settings.py` | `format`, `files`, `symlinks`, `icon`; no `hide_extensions` (it fails `codesign --strict`) | No |
| The project's DMG script and `dmgbuild-requirements.txt` | Step 2 | No, after step 2 |

## Steps

### 2. Wire dmgbuild into the project's DMG build

Once per project; skip it when the detected DMG script already runs dmgbuild against
this `<design-dir>`.

1. Copy `<skill>/wiring/dmgbuild-requirements.txt` next to the DMG script, or into
   `scripts/` when that folder exists. Remember the path as `<requirements>`.
2. Adapt the detected DMG step so it calls dmgbuild the way
   `<skill>/wiring/make-dmg.sh` does. Prefer keeping the project's existing command-line
   (`<script> <app> <dmg>` when that is already the shape). Write `<design-dir>` and
   `<requirements>` into the script itself (replace the `__DESIGN_DIR__` placeholder, or
   the equivalent in a workflow step). The script must exit if `<design-dir>/settings.py`
   is missing; do not fall back to a plain window.
3. If the project uses `create-dmg` or a raw `hdiutil` one-liner in a workflow instead
   of a script, replace that step with a call to the wired script, and keep the same
   output path the rest of the workflow expects.
4. If the job that builds the DMG does not already install Python 3.10 or later, add
   `<skill>/wiring/ci-setup-python.yml` before that step. If it already does (this
   template's release workflow installs Python 3.13), leave it.
5. The release job should build from the committed PNGs and never render
   `Background.swift`.

If the user decides against a designed window, undo this step: restore the previous DMG
script from git, and delete `<design-dir>` and the requirements file.

On a Mac without Python 3.10 or later, the script fails and says so: `brew install
python`. On first use it installs dmgbuild, hash-pinned, into `.build/dmgbuild-1.6.7`.

### 3. Default

```bash
mkdir -p <design-dir> && cp <skill>/templates/* <design-dir>/   # skip if the design already exists
<skill>/scripts/render-dmg-background.sh <design-dir>
# build or locate a .app, then:
<skill>/scripts/preview-dmg.sh --app <path.app> --design <design-dir> \
    --make-dmg <the wired script> --name "<display name>"
# → .build/dmg/dmg.png
```

White paper and a dark gray arrow. `preview-dmg.sh` mounts the DMG, opens it in Finder
and screenshots the window. Show the user the screenshot. Unless they already said which
level they want, ask: [the three brand levels](references/brand-levels.md).

`--make-dmg` is optional; without it the skill's `wiring/make-dmg.sh` builds the preview
directly. After step 2, passing the project's wired script is the better check.

### 4. Read the brand

The brand is the app icon. Take the colors from the icon found in step 1 (`fill` in
`icon.json` and its layers in `Assets/`, or the rendered app icon in the preview) and
look at the icon in `.build/dmg/dmg.png`. Pick the motif: a shape from the icon that
still reads at 30–60 pt.

### 5. Light brand

A soft gradient in the icon's colors and an arrow drawn from its motif, in two or three
variants. Write each one into `<design-dir>/Background.swift`, render, preview, and
show the user the screenshots. Steps: [light brand](references/brand-levels.md#light-brand).

### 6. Full brand

An illustration or texture from the icon's world that leads to Applications, drawn in
code or made by an image model. Propose two or three scenes, say how each one is made,
and let the user pick. Steps and the image-model prompt:
[full brand](references/brand-levels.md#full-brand).

### 7. Finish

1. Render once more, so the PNGs match `Background.swift`, and run `preview-dmg.sh`.
2. Commit `<design-dir>`, the wired DMG script, the requirements file, and any CI Python
   step together, for example `feat(dmg): add a designed installer window`. Reverting
   that commit brings back the plain DMG.

## Changes

| File | Change |
| --- | --- |
| `<design-dir>/Background.swift` | the background, drawn in code |
| `<design-dir>/settings.py` | `window_rect`, `icon_size`, `text_size`, `icon_locations` |
| `<design-dir>/background.png`, `@2x`, `art.png` | rendered from it, or the user's art |
| the project's DMG script, and `dmgbuild-requirements.txt` | step 2, once per project |
| the release workflow | a Python 3.10+ setup step, only when it had none |

## The user's part

- Pick the level, and the scene or variant they like.
- Look at the preview screenshot of the real Finder window, and generate the art when the
  full brand uses an image model.
- Grant Screen Recording if they want the automated preview.

## Done when

- `preview-dmg.sh` shows the window the user approved, at the level they picked, and the
  PNGs match `Background.swift`.
- The project's DMG build step uses dmgbuild with `<design-dir>` written into it, and CI
  can install dmgbuild (Python 3.10+ is present).

## Never

- Leave a fallback to a plain `hdiutil` window when the design is missing: the user asked
  for a designed DMG, so a missing design is an error.
- Draw a dark full background, or put anything dark under an icon or its label: Finder
  draws the 128 pt icons and their labels in black, and a window with a background
  picture stays in light mode.
- Put text in the background or the art: it is one image for every language. Keep the
  bottom 25 pt clear: a user's path bar or status bar can cover it.
- Draw a brand shape with an SF Symbol, or use another brand's artwork or characters:
  their license forbids use in logos and other trademark use.
- Rename `DMGBackground` or change its `size`, `appIcon` and `applications` without
  changing `settings.py` too: they match `window_rect` and `icon_locations`.
- Cut a release, sign, notarize, or write an appcast: that is not this skill.
