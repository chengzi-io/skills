---
name: macos-window-screenshot
description: >
  Screenshot one macOS app window as the system draws it: rounded transparent corners, no
  shadow. Use when the user wants a screenshot of an app window or a page in it, or wants to
  compare a window with a design image. Covers navigating to the page, Stage Manager,
  and active vs inactive look.
allowed-tools: Bash(xcrun swift *)
metadata:
  version: "2026.11.17"
---

# Screenshot a macOS window

Capture by window ID with `screencapture -x -o -l <id>`: the corners stay round and transparent, there is no shadow, and it works on any display. Never crop a full-screen shot or render the view yourself (`cacheDisplay`, `ImageRenderer`); both lose the real window chrome.

Inputs: process name `APP`, bundle ID `BUNDLE`, the target page and its window title. For a dev build, also the `.app` path and any launch args or env it supports (UI language, mock data).

## Environment

!`xcrun swift -e 'import Foundation; import CoreGraphics; import ApplicationServices; let fm = FileManager.default; let pk = ["/opt/homebrew/bin/peekaboo", "/usr/local/bin/peekaboo"].first { p in fm.isExecutableFile(atPath: p) } ?? "none"; let sm = UserDefaults(suiteName: "com.apple.WindowManager")?.bool(forKey: "GloballyEnabled") ?? false; print("macos=\(ProcessInfo.processInfo.operatingSystemVersionString) stage_manager=\(sm ? 1 : 0) screen_recording=\(CGPreflightScreenCaptureAccess() ? "yes" : "no") accessibility=\(AXIsProcessTrusted() ? "yes" : "no") peekaboo=\(pk)")'`

Claude Code replaces the line above with its output when the skill loads. Elsewhere, run that one command yourself. It is a single command on purpose (no `&&`, `|`, `$()`), so one `allowed-tools` rule covers it. `stage_manager=1` means activation is required (below); `peekaboo=` decides the tool in the steps.

## Permissions

The program running these commands needs Screen Recording (window titles and capture) and Accessibility (menu and control clicks); `screen_recording` and `accessibility` above report them for that program. If either is `no`, ask the user to grant it in System Settings > Privacy & Security; never work around it.

## Activation

- **Background first.** Without Stage Manager, a window can be captured while its app stays in the background and the user is never disturbed, but it is drawn inactive: gray traffic lights, title and toolbar.
- **Activate only when needed**: when the shot must look active, or when Stage Manager is on (`stage_manager=1`). Stage Manager shrinks windows of apps not in front to thumbnails, and both `screencapture` and ScreenCaptureKit then return only the thumbnail.
- **Activation is brief and in place**: it doesn't move the window, and step 3 hands focus back right after the capture.

## Steps

Pick the tool once from `peekaboo=` above: installed means use the **Peekaboo** line in step 2; `none` means use the **Native** line. Steps 1, 3 and 4 are the same either way; don't activate with Peekaboo's `--foreground`, which can fail with a focus-identity error.

1. **Launch** (skip if already running on the right page), in the background as a fresh instance; step 3 waits for the window:
   ```sh
   pkill -x "$APP"; open -g -n /path/App.app [--env K=V] --args [-AppleLanguages '(zh-Hans)']
   ```

2. **Navigate** through the app's own menus and controls, in the background. Titles follow the UI language (`设置…` in Chinese).
   - **Peekaboo**: `peekaboo menu click --app "$APP" --path "$APP > Settings…"`. For controls in a window, `peekaboo see --app "$APP" --json` lists elements with IDs, then `peekaboo click --on <id> --snapshot <snapshot id>`.
   - **Native**:
     ```sh
     osascript -e 'tell application "System Events" to click menu item "Settings…" of menu "'"$APP"'" of menu bar 1 of process "'"$APP"'"'
     ```
     Controls: `click button "…" of window "…" of process "…"`.

   If no menu or control reaches the page, say so; don't add debug code.

3. **Find, activate, wait, capture, restore**, in one command. It polls every 20 ms instead of sleeping: finds the window by exact title (or lists the app's titles and exits 1; pick one, don't guess), activates the app only with `activate`, waits until the bounds hold still for 0.2 s (with Stage Manager, also until the window has grown out of its thumbnail), runs `screencapture -x -o -l`, then gives focus back and waits until the previous app is really in front. Typically about 1 s. Pass `activate` per the Activation rules above.
   ```sh
   xcrun swift scripts/shot.swift "$APP" "<title>" out.png [activate]
   ```
   `scripts/shot.swift` sits next to this SKILL.md; use its full path when running from elsewhere.
   Quit the app afterwards if you launched it. Don't use `peekaboo see` for the final image: its default engine fills the corners white.

4. **Verify before showing.** Right page, full size, intended look; `sips -g pixelWidth -g pixelHeight -g hasAlpha out.png` should match points × the scale of the window's display (2x Retina, often 1x external) and show `hasAlpha: yes`.

Report the image path and the commands used, so the shot can be retaken.
