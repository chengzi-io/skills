# Official `homebrew/cask`

Users run `brew install --cask <token>`. The cask keeps itself up to date: Homebrew's
BrewTestBot checks the latest published GitHub release every 3 hours and opens the
update pull request itself, so the release workflow does nothing for Homebrew.

Needs a notable repository, at least 30 days old: 225 stars, 90 forks or 90 watchers
when its own author submits it (75, 30 or 30 when someone else does). `brew audit --new`
also checks it. And it needs a Developer ID (`macos-developer-id`): Homebrew
requires the app to pass Gatekeeper.

## The terms for AI-written pull requests

Homebrew accepts pull requests written with AI on these terms; tell the user before
starting:

- The pull request says that AI was used, and which tool.
- The user reviews everything before asking maintainers to review it.
- No commit names AI as author or co-author, and no `Assisted-by` or similar trailer.
- The user answers maintainers' questions and review comments themselves.

Forking, pushing and opening the pull request act on the user's GitHub account: ask
before each.

## 1. Write the cask

`brew generate-cask-token "<path to the .app>"` gives the token. Take the values from
what step 1 of the skill detected: the app name, display name, bundle id, minimum
macOS, the version of the latest published release, and the SHA-256 of its DMG
(`gh release download <tag> --pattern '*.dmg' --dir .build/cask`, then `shasum -a 256`).
The download URL follows the pattern agreed in that step (a common one is
`https://github.com/<owner>/<repo>/releases/download/v#{version}/<App>-#{version}.dmg`).

A starting template is also in `templates/cask.rb.example`.

```ruby
cask "<token>" do
  version "<version>"
  sha256 "<sha256 of the DMG>"

  url "<download URL pattern, with #{version}>"
  name "<display name>"
  desc "<what the app is, in a few plain words>"
  homepage "https://github.com/<owner>/<repo>"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: :<minimum macOS, for example sonoma>

  app "<App>.app"

  zap trash: [
    # Sandboxed apps typically leave both of these. Non-sandboxed apps more often
    # leave Application Support, Caches and Preferences — ask, then list what applies.
    "~/Library/Application Scripts/<bundle id>",
    "~/Library/Containers/<bundle id>",
  ]
end
```

- `desc`: ask the user what the app is, then follow Homebrew's Description Guidelines: a
  neutral one-liner, without the app's name or marketing words.
- `livecheck`: if this repository creates the git tag while the GitHub Release is still
  a draft (release-please does this), the default strategy, which reads tags, can see a
  version whose DMG cannot be downloaded yet. `:github_latest` reads only published
  releases. Use the default tag strategy only when a tag always means a published
  download.

## 2. Check it

In a checkout of `homebrew/cask`, in `Casks/<first letter of token>/`:

```bash
brew tap --force homebrew/cask
cd "$(brew --repository homebrew/cask)"
git checkout -b <token> origin/HEAD
cp <cask file> "Casks/<letter>/<token>.rb"
HOMEBREW_NO_INSTALL_FROM_API=1 brew install --cask <token>
brew uninstall --cask <token>
brew audit --new --cask <token>
brew style --fix --cask <token>
brew lgtm --online
```

`brew audit --new` also checks the repository's notability and the download.

## 3. Open the pull request

With the user's go-ahead: fork (`gh repo fork Homebrew/homebrew-cask --clone=false`),
`git remote add <user> https://github.com/<user>/homebrew-cask.git`, commit as
`<token> <version> (new cask)` with no AI trailer, push, and open the pull request: fill
in its template and disclose the AI use. Then the user follows up with the maintainers.

## 4. After the merge, in the project

- In the install section of `README.md` (or the project's equivalent), after the DMG
  instructions:

  ````markdown
  With [Homebrew](https://brew.sh):

  ```bash
  brew install --cask <token>
  ```
  ````

- If the project has releasing docs, replace or insert a Homebrew section using
  `<skill>/wiring/releasing-official.md`. If it has none, only the install docs change.
- Nothing changes in the release workflow. Commit, for example `docs: add the homebrew
  install`.

## From the own tap

When the app has a Developer ID and the repository is notable, submit it as above. After
the merge:

- In the project, remove the Homebrew job, the cask-update script, the tap name and the
  unsigned scheme, and switch the install and releasing docs to the official text from
  step 4.
- In the tap, delete `Casks/<token>.rb` and add `"<token>": "homebrew/cask"` to its
  `tap_migrations.json`, so `brew install --cask <owner>/<name>/<token>` installs the
  official cask.
- Homebrew does not move copies already installed from the tap; they keep updating
  through the app's own updater. Tell users who want Homebrew to track the official
  cask to run
  `brew uninstall --cask <owner>/<name>/<token> && brew install --cask <token>`.
