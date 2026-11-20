#!/usr/bin/env bash
# Creates an unsigned DMG of an .app with an /Applications link, in the Finder window
# that settings.py in DESIGN_DIR describes: background, window size, icon spots.
# The macos-dmg-window skill writes DESIGN_DIR and REQUIREMENTS when it
# wires this script into the project. There is no plain-window fallback: if the
# design is missing, this script exits.
#   make-dmg.sh <app> <dmg>
#
# DESIGN_DIR is relative to the repository root, or absolute.
# VOLUME_NAME defaults to $APP_DISPLAY_NAME, or the .app file name without the suffix.
# REQUIREMENTS is the hash-pinned pip file, default: scripts/dmgbuild-requirements.txt.
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

# Written by macos-dmg-window when this script is installed:
DESIGN_DIR="${DESIGN_DIR:-__DESIGN_DIR__}"
REQUIREMENTS="${REQUIREMENTS:-scripts/dmgbuild-requirements.txt}"

root=$(git rev-parse --show-toplevel)
cd "$root"

app=${1:?usage: make-dmg.sh <app> <dmg>}
dmg=${2:?usage: make-dmg.sh <app> <dmg>}
[[ -d $app ]] || die "no app at $app"

case $DESIGN_DIR in
    /*) design=$DESIGN_DIR ;;
    *) design=$root/$DESIGN_DIR ;;
esac
[[ -f $design/settings.py ]] || die "no $design/settings.py; the macos-dmg-window skill writes it"

volume=${VOLUME_NAME:-${APP_DISPLAY_NAME:-}}
if [[ -z $volume ]]; then
    volume=$(basename "$app" .app)
fi

mkdir -p "$(dirname "$dmg")"
rm -f "$dmg"

# dmgbuild writes the window layout (.DS_Store) itself instead of scripting Finder, so
# it behaves the same on CI. Hash-pinned: it may run in a release job beside signing keys.
dmgbuild=$root/.build/dmgbuild-1.6.7/bin/dmgbuild
if [[ ! -x $dmgbuild ]]; then
    python3 -c 'import sys; sys.exit(sys.version_info < (3, 10))' ||
        die "dmgbuild needs python3 3.10 or later (brew install python)"
    [[ -f $REQUIREMENTS ]] || die "no $REQUIREMENTS"
    log "install dmgbuild into .build/dmgbuild-1.6.7"
    python3 -m venv "$root/.build/dmgbuild-1.6.7"
    "$root/.build/dmgbuild-1.6.7/bin/pip" install --quiet --disable-pip-version-check \
        --require-hashes --only-binary :all: -r "$REQUIREMENTS"
fi
log "package $dmg with the $DESIGN_DIR design"
"$dmgbuild" -s "$design/settings.py" -D app="$app" "$volume" "$dmg" >&2
