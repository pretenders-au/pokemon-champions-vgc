#!/usr/bin/env bash
# Vendor a build of @smogon/calc from smogon/damage-calc at one commit into vendor/smogon-calc.
#
# The npm release (0.11.0, March 2026) predates the Pokémon Champions mechanics that master
# gained in June–September 2026 (Dragonize, Fire Mane, Mega Sol, Eelevate, Aura Guard, the
# M-C Megas). The package lives in the repo's calc/ subfolder, which npm cannot install from
# git, so we compile it and commit the output. Source maps, the browser bundle and the
# compiled upstream tests are dropped.
#
# Usage: scripts/vendor-smogon-calc.sh <commit-sha>   # then: npm install && npm test
set -euo pipefail
sha="${1:?usage: $0 <commit-sha>}"
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/vendor/smogon-calc"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git -C "$tmp" init -q
git -C "$tmp" remote add origin https://github.com/smogon/damage-calc.git
git -C "$tmp" fetch -q --depth 1 origin "$sha"
git -C "$tmp" checkout -q FETCH_HEAD
(cd "$tmp/calc" && npm install --ignore-scripts --no-audit --no-fund && npx tsc -p .)

mkdir -p "$dest"
rsync -a --delete --exclude='*.map' --exclude='test/' "$tmp/calc/dist/" "$dest/dist/"
# Maps are not vendored, so drop the references too (Vite warns on every dangling one).
# perl rather than sed -i: the in-place flag differs between BSD and GNU sed.
find "$dest/dist" -name '*.js' -exec perl -ni -e 'print unless /^\/\/# sourceMappingURL=/' {} +
cp "$tmp/calc/LICENSE" "$dest/LICENSE"
short="$(git -C "$tmp" rev-parse --short=7 HEAD)"
cat > "$dest/package.json" <<JSON
{
  "name": "@smogon/calc",
  "version": "0.11.0-champions.${short}",
  "description": "Pokémon battle calculator — vendored build of smogon/damage-calc@${sha} (see README.md)",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "license": "MIT",
  "repository": "github:smogon/damage-calc",
  "dependencies": {
    "@types/node": "^18.14.2"
  }
}
JSON
echo "vendored @smogon/calc @ ${sha} -> vendor/smogon-calc; now run: npm install && npm test"
