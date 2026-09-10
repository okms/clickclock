#!/usr/bin/env sh
# Prints the CHANGELOG.md section for a version (e.g. v0.3.1 or 0.3.1).
# Exits 1 with a message if the section is missing or empty, so a release
# without notes fails loudly.
set -eu
version="${1#v}"
notes="$(awk -v v="$version" '
  $0 ~ "^## \\[" v "\\]" { on = 1; next }
  on && /^## \[/ { exit }
  on { print }
' CHANGELOG.md | sed -e '/^\[.*\]: http/d' | awk 'NF { blank = 0 } !NF { blank++ } blank < 2')"
if [ -z "$(printf '%s' "$notes" | tr -d '[:space:]')" ]; then
  echo "CHANGELOG.md has no section for version $version. Add one before tagging." >&2
  exit 1
fi
printf '%s\n' "$notes"
