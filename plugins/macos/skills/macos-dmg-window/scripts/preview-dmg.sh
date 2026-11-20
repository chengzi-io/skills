#!/usr/bin/env bash
# Builds a DMG with the design in --design, opens it in Finder and screenshots the
# window. The program running this needs Screen Recording permission. Runs from
# anywhere inside the project.
#   preview-dmg.sh --app <path.app> --design <dir> [--out .build/dmg/dmg.png]
#                  [--make-dmg <script>] [--name <volume name>]
set -euo pipefail

die() {
    echo "error: $*" >&2
    exit 1
}

if [[ ${1:-} == -h || ${1:-} == --help ]]; then
    awk '/^#!/ { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"
    exit 0
fi

here=$(cd "$(dirname "$0")" && pwd)
root=$(git rev-parse --show-toplevel)
cd "$root"

app=""
design=""
out=".build/dmg/dmg.png"
make_dmg=""
volume=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --app) app=$2; shift 2 ;;
        --design) design=$2; shift 2 ;;
        --out) out=$2; shift 2 ;;
        --make-dmg) make_dmg=$2; shift 2 ;;
        --name) volume=$2; shift 2 ;;
        *) die "usage: preview-dmg.sh --app <path.app> --design <dir> [--out FILE] [--make-dmg SCRIPT] [--name VOLUME]" ;;
    esac
done

[[ -n $app && -n $design ]] || die "usage: preview-dmg.sh --app <path.app> --design <dir> [--out FILE] [--make-dmg SCRIPT] [--name VOLUME]"
[[ -d $app ]] || die "no app at $app"
[[ -f $design/settings.py ]] || die "no $design/settings.py"

dmg=.build/dmg/preview.dmg
mkdir -p "$(dirname "$dmg")" "$(dirname "$out")"
rm -f "$dmg"

if [[ -n $make_dmg ]]; then
    "$make_dmg" "$app" "$dmg"
else
    DESIGN_DIR=$design VOLUME_NAME=${volume:-$(basename "$app" .app)} \
        REQUIREMENTS=${REQUIREMENTS:-$here/../wiring/dmgbuild-requirements.txt} \
        "$here/../wiring/make-dmg.sh" "$app" "$dmg"
fi
[[ -f $dmg ]] || die "no DMG written at $dmg"

mount=$(hdiutil attach -noverify "$dmg" | awk -F '\t' '/\/Volumes\// { print $NF }')
[[ -n $mount ]] || die "cannot mount $dmg"
trap 'hdiutil detach -quiet "$mount" || echo "error: cannot detach $mount" >&2' EXIT

open "$mount"
id=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
    id=$(xcrun swift "$here/window-id.swift" "$(pgrep -x Finder)" "$(basename "$mount")")
    [[ -n $id ]] && break
    sleep 1
done
[[ -n $id ]] || die "no Finder window for $mount (Screen Recording permission?)"
# Under Stage Manager a window of a background app sits tilted in the side strip, and
# that is what the screenshot would show.
open -a Finder
# Finder draws the background a moment after the window appears.
sleep 2
screencapture -x -o -l "$id" "$out"
echo "$out"
