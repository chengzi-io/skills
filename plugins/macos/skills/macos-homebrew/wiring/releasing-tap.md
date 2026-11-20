## Homebrew cask

Each release updates `Casks/<app>.rb` in the tap that `HOMEBREW_TAP` names: the
`homebrew` job of the release workflow downloads the published DMG and runs
`update-cask.sh push` with the `HOMEBREW_TAP_TOKEN` secret. Preview the cask with
`update-cask.sh print` after a release build.

| Signing | The cask |
| --- | --- |
| Developer ID (team ID set) | Plain: Gatekeeper checks the app and lets it open |
| Ad-hoc, `HOMEBREW_UNSIGNED=caveats` | Tells users to click Open Anyway after macOS blocks the first launch |
| Ad-hoc, `HOMEBREW_UNSIGNED=xattr` | Clears the quarantine flag, so macOS never checks the app; `homebrew/cask` never accepts it |

The install docs carry an `[!IMPORTANT]` notice for both ad-hoc casks. Once a Developer
ID is set, remove `HOMEBREW_UNSIGNED` and that notice.

The job runs after the publish job, when the release is already public: if it fails,
only the cask is out of date. Fix the token or the tap, then re-run the failed job.
