#!/usr/bin/env bash
# Homebrew cask for the current release DMG.
#   print  writes the cask to stdout
#   push   commits Casks/<token>.rb to the tap $HOMEBREW_TAP through the GitHub API;
#          GH_TOKEN needs contents:write on the tap
# Homebrew quarantines what it downloads, so Gatekeeper checks the app on first launch.
# A Developer ID build (TEAM_ID set) gets a plain cask. An ad-hoc build (TEAM_ID empty)
# gets what HOMEBREW_UNSIGNED picks:
#   caveats  the cask tells the user to click Open Anyway after macOS blocks the launch
#   xattr    the cask clears the quarantine flag after installing, so macOS never checks
#            the app; homebrew/cask never accepts such a cask
#
# Configure with environment variables (or edit the defaults below after copying).
# Required: APP_NAME, APP_DISPLAY_NAME, BUNDLE_ID, VERSION, HOMEBREW_TAP (for push).
# DMG defaults to dist/$APP_NAME-$VERSION.dmg.
# RELEASES_URL is the GitHub releases root (https://github.com/owner/repo/releases).
# URL_TEMPLATE overrides the cask url; may contain #{version}.
# MIN_MACOS is a major version (14, 15, 26) or a dotted string (14.0).
# ZAP_TRASH is a comma-separated list of zap paths; default is the two sandbox paths.
set -euo pipefail

die() {
    echo "error: $*" >&2
    exit 1
}

log() {
    echo "$*" >&2
}

if [[ ${1:-} == -h || ${1:-} == --help ]]; then
    awk '/^#!/ { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"
    exit 0
fi

APP_NAME=${APP_NAME:-}
APP_DISPLAY_NAME=${APP_DISPLAY_NAME:-}
BUNDLE_ID=${BUNDLE_ID:-}
VERSION=${VERSION:-}
TEAM_ID=${TEAM_ID:-}
HOMEBREW_TAP=${HOMEBREW_TAP:-}
HOMEBREW_UNSIGNED=${HOMEBREW_UNSIGNED:-}
MIN_MACOS=${MIN_MACOS:-}
RELEASES_URL=${RELEASES_URL:-}
URL_TEMPLATE=${URL_TEMPLATE:-}
ZAP_TRASH=${ZAP_TRASH:-}
DMG=${DMG:-}

[[ -n $APP_NAME ]] || die "set APP_NAME"
[[ -n $APP_DISPLAY_NAME ]] || die "set APP_DISPLAY_NAME"
[[ -n $BUNDLE_ID ]] || die "set BUNDLE_ID"
[[ -n $VERSION ]] || die "set VERSION"

dmg=${DMG:-dist/$APP_NAME-$VERSION.dmg}
token=$(tr '[:upper:]' '[:lower:]' <<<"$APP_NAME")

macos_symbol() {
    local major=${1%%.*}
    case $major in
        14) echo sonoma ;;
        15) echo sequoia ;;
        26) echo tahoe ;;
        *) die "no Homebrew macOS symbol for $1; set MIN_MACOS to a known major version or extend this script" ;;
    esac
}

cask() {
    [[ -f $dmg ]] || die "no DMG at $dmg"
    local sha macos unsigned="" zap homepage url
    sha=$(shasum -a 256 "$dmg" | awk '{ print $1 }')
    [[ -n $MIN_MACOS ]] || die "set MIN_MACOS (for example 14, 15 or 26)"
    macos=$(macos_symbol "$MIN_MACOS")
    if [[ -z ${TEAM_ID} ]]; then
        unsigned=${HOMEBREW_UNSIGNED}
        [[ $unsigned == caveats || $unsigned == xattr ]] ||
            die "TEAM_ID is empty: set HOMEBREW_UNSIGNED to caveats or xattr"
    elif [[ -n ${HOMEBREW_UNSIGNED} ]]; then
        log "TEAM_ID is set, so the cask ignores HOMEBREW_UNSIGNED; remove it and its README notice"
    fi

    if [[ -n $URL_TEMPLATE ]]; then
        url=$URL_TEMPLATE
    else
        [[ -n $RELEASES_URL ]] || die "set RELEASES_URL or URL_TEMPLATE"
        url="$RELEASES_URL/download/v#{version}/$APP_NAME-#{version}.dmg"
    fi
    homepage=${HOMEPAGE:-${RELEASES_URL%/releases}}

    if [[ -n $ZAP_TRASH ]]; then
        zap=$ZAP_TRASH
    else
        zap="~/Library/Application Scripts/$BUNDLE_ID,~/Library/Containers/$BUNDLE_ID"
    fi

    cat <<EOF
cask "$token" do
  version "$VERSION"
  sha256 "$sha"

  url "$url"
  name "$APP_DISPLAY_NAME"
  homepage "$homepage"

  auto_updates true
  depends_on macos: :$macos

  app "$APP_NAME.app"

EOF
    if [[ $unsigned == xattr ]]; then
        cat <<EOF
  postflight_steps do
    run "/usr/bin/xattr", args: ["-dr", "com.apple.quarantine", "{{appdir}}/$APP_NAME.app"]
  end

EOF
    fi
    echo "  zap trash: ["
    IFS=',' read -r -a zap_items <<<"$zap"
    local i=${#zap_items[@]} n=0
    for item in "${zap_items[@]}"; do
        item=${item#"${item%%[![:space:]]*}"}
        item=${item%"${item##*[![:space:]]}"}
        n=$((n + 1))
        if [[ $n -lt $i ]]; then
            echo "    \"$item\","
        else
            echo "    \"$item\","
        fi
    done
    echo "  ]"
    if [[ $unsigned == caveats ]]; then
        cat <<EOF

  caveats <<~CAVEATS
    $APP_DISPLAY_NAME is not signed with an Apple Developer ID, so macOS blocks its first
    launch. Open System Settings → Privacy & Security and click Open Anyway, once.
  CAVEATS
EOF
    fi
    echo "end"
}

case ${1:-} in
    print) cask ;;
    push)
        [[ -n ${HOMEBREW_TAP} ]] || die "set HOMEBREW_TAP to owner/homebrew-tap"
        path="Casks/$token.rb"
        content=$(cask | base64)
        args=(-X PUT "repos/$HOMEBREW_TAP/contents/$path" -f message="chore($token): update to $VERSION" -f content="$content")
        if existing=$(gh api "repos/$HOMEBREW_TAP/contents/$path" --jq .sha 2>/dev/null); then
            args+=(-f sha="$existing")
        fi
        gh api "${args[@]}" >/dev/null
        log "updated $HOMEBREW_TAP/$path to $VERSION"
        ;;
    *) die "usage: update-cask.sh print|push" ;;
esac
