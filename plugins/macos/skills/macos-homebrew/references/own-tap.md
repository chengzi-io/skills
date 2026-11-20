# Own tap

Users run `brew install --cask <owner>/<name>/<token>`; a job in the release workflow
pushes the cask on every release. Anyone can have a tap, and it takes ad-hoc builds too.
Needs a published release.

## How the cask meets Gatekeeper

Homebrew quarantines what it downloads, so macOS checks the app on its first launch.

| Scheme | When | The cask | README.md |
| --- | --- | --- | --- |
| C. Developer ID | The app is Developer ID signed and notarized | Plain: the app passes the check and opens | The install command |
| A. caveats | Ad-hoc, the user picks it | Tells users to click Open Anyway after macOS blocks the first launch | The command and notice A |
| B. xattr | Ad-hoc, the user picks it | Clears the quarantine flag after installing, so macOS never checks the app | The command and notice B |

With a Developer ID, use C. Without one, explain the trade-off and let the user pick A
or B:

- A: users get stuck at the first launch, as they do with the DMG.
- B: users notice nothing, but the author answers for skipping Gatekeeper, and
  `homebrew/cask` never accepts such a cask.
- C, for comparison: the Apple Developer Program costs $99 a year; the cask then passes
  Gatekeeper, can later go to `homebrew/cask` (`macos-developer-id`), and Sparkle
  updates keep the app's permissions.

`update-cask.sh` decides on every release: C as soon as a team ID (or equivalent) is
set, otherwise the unsigned scheme (`caveats` or `xattr`).

## What the user sets up

1. A tap repository named `homebrew-<name>`, for example `<owner>/homebrew-tap`, with a
   `Casks/` directory. Users then install with
   `brew install --cask <owner>/<name>/<token>`.
2. A fine-grained token with Contents read and write on the tap only, stored in the
   project's secrets environment (default `release`):
   `gh secret set HOMEBREW_TAP_TOKEN --env release`. The secret name is configurable.

Both need the user's GitHub account: ask before creating either for them.

## Wire it in

1. Copy `<skill>/wiring/update-cask.sh` into the project's scripts directory (default
   `scripts/update-cask.sh` when that folder exists; otherwise ask). The script is
   self-contained: it does not source a project `common.sh`.
2. Configure the script for this project. Prefer a short block of variables at the top
   of the copied script, or environment variables the release job will set. Required:

   - `APP_NAME`, `APP_DISPLAY_NAME`, `BUNDLE_ID`
   - `VERSION` and the path to the release DMG (or a pattern to find it)
   - `RELEASES_URL` or a full `URL_TEMPLATE` for the cask `url`
   - `MIN_MACOS` (for example `14`, `15` or `26`)
   - `HOMEBREW_TAP` (`owner/homebrew-name`)
   - `HOMEBREW_UNSIGNED` (`caveats` or `xattr`) while the app is ad-hoc; empty with a
     Developer ID
   - `ZAP_TRASH` when the default sandboxed paths do not apply

   If the project already has these values in an xcconfig or similar, the script may
   read them, but it must still work when those files do not exist.

3. In the release workflow, add a job *after the job that publishes the GitHub Release*,
   using `<skill>/wiring/homebrew-job.yml` as the starting point. Fill in the
   placeholders: the preceding job names, how the tag or version is passed, the runner,
   the environment, the secret name, and the path to `update-cask.sh`. Do not assume
   jobs named `release-please` or `publish`.

4. If the project has releasing docs, replace or insert a Homebrew section using
   `<skill>/wiring/releasing-tap.md`. If it has none, only the install docs change.

5. In the install section of `README.md` (or the project's equivalent), after the DMG
   instructions:

   ````markdown
   With [Homebrew](https://brew.sh):

   ```bash
   brew install --cask <owner>/<name>/<token>
   ```
   ````

   For A, follow it with:

   ```markdown
   > [!IMPORTANT]
   > <App> is not signed with an Apple Developer ID yet. After `brew install`, macOS
   > blocks its first launch: open System Settings → Privacy & Security and click
   > **Open Anyway**, once.
   ```

   For B:

   ```markdown
   > [!IMPORTANT]
   > <App> is not signed with an Apple Developer ID or notarized by Apple. Its Homebrew
   > cask removes the quarantine flag macOS puts on downloads, so macOS opens the app
   > without checking it. Install it this way only if you trust this repository; the
   > DMG above keeps the check.
   ```

## Check and finish

1. After a release build that produces the DMG, write the cask and check its syntax:
   `scripts/update-cask.sh print > .build/<token>.rb && ruby -c .build/<token>.rb`
   (adjust the script path if it is not in `scripts/`).
2. With Homebrew installed, check it as Homebrew will, in a throwaway local tap; outside
   a tap `brew style` applies other rules:

   ```bash
   export HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1
   brew tap-new local/casktest --no-git
   mkdir -p "$(brew --repository local/casktest)/Casks"
   cp .build/<token>.rb "$(brew --repository local/casktest)/Casks/"
   brew style "$(brew --repository local/casktest)/Casks/<token>.rb"
   brew audit --cask local/casktest/<token>
   brew untrust --cask local/casktest/<token>; brew untap local/casktest
   ```

3. Run the project's usual check if it has one, then commit the script, its
   configuration, the workflow job, the install docs and any releasing docs together,
   for example `feat(homebrew): publish releases to a homebrew tap`.

Once a Developer ID is in place, the next release's cask is plain. Remove the unsigned
scheme and the README notice; `update-cask.sh` logs a reminder while
`HOMEBREW_UNSIGNED` remains.
