#!/usr/bin/env bash
# Renders <design-dir>/Background.swift into <design-dir>/background.png and @2x.
# Runs from anywhere inside the project.
#   render-dmg-background.sh <design-dir>
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
cd "$(git rev-parse --show-toplevel)"
[[ $# -ge 1 ]] || die "usage: render-dmg-background.sh <design-dir>"
design=$1
[[ -f $design/Background.swift ]] || {
    echo "error: no $design/Background.swift; copy the skill's templates/ there first" >&2
    exit 1
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
xcrun swiftc -swift-version 6 -parse-as-library \
    "$here/render-dmg-background.swift" "$design/Background.swift" -o "$tmp/render"
"$tmp/render" "$design"
echo "$design/background.png" "$design/background@2x.png"
