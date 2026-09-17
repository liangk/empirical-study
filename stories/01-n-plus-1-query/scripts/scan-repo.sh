#!/bin/bash
# Reproducible single-repository N+1 Query scan.
#
# This is the exact scanning method used to produce every result file in
# ../results/. It uses the actual Code Evolution Lab CLI (built from the public,
# free-tier repository — the N+1 Query Detector is one of the four detectors
# available there) rather than a reimplementation, so the results you get by
# running this are the product's real output, not a simulation of it.
#
# Usage:
#   ./scan-repo.sh <owner/repo> <scope1> [scope2] [scope3] ...
#
# Example (reproduces the outline/outline scan):
#   ./scan-repo.sh outline/outline server/routes server/commands server/presenters \
#       server/queues server/policies server/services
#
# Requirements: git, node >= 18, and a built copy of the Code Evolution Lab CLI.
# See ../README.md "Step 0" for how to build the CLI from source.

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <owner/repo> <scope1> [scope2] ..." >&2
  exit 1
fi

REPO="$1"; shift
SCOPES=("$@")

CLI="${CEL_CLI:-./cel-backend/dist/cli.js}"
if [ ! -f "$CLI" ]; then
  echo "CLI not found at $CLI. Build it first (see README.md Step 0) or set CEL_CLI=/path/to/dist/cli.js" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

SAFE=$(echo "$REPO" | tr '/' '_')
DIR="$WORK/$SAFE"

echo "### Cloning $REPO (blobless, no checkout yet)"
git clone --depth 1 --filter=blob:none --no-checkout --quiet "https://github.com/$REPO.git" "$DIR"

echo "### Narrowing checkout to: ${SCOPES[*]}"
# NOTE: some older git builds reject "--quiet" on sparse-checkout subcommands.
# Don't pass it there; sparse-checkout is already silent by default.
git -C "$DIR" sparse-checkout init --cone
git -C "$DIR" sparse-checkout set "${SCOPES[@]}"
git -C "$DIR" checkout HEAD --quiet

# IMPORTANT: `git ls-tree` reads the tree object directly, so it ignores
# sparse-checkout — it lists the whole repository unless we filter by path
# ourselves. Restrict the count to the requested scopes.
SCOPE_REGEX=$(printf '^(%s)/' "$(IFS='|'; echo "${SCOPES[*]}")")
FILE_COUNT=$(git -C "$DIR" ls-tree -r HEAD --name-only \
  | grep -E "$SCOPE_REGEX" \
  | grep -E '\.(js|jsx|ts|tsx)$' \
  | grep -Ev '(^|/)(node_modules|dist|build|\.git)(/|$)' \
  | wc -l)
echo "### Files in scope: $FILE_COUNT"
if [ "$FILE_COUNT" -gt 500 ]; then
  echo "!!! Scope exceeds the ~500-file scan ceiling. Narrow it further and retry." >&2
  exit 1
fi

# Build the glob pattern. Multiple scopes are combined with brace expansion so
# one CLI invocation covers all of them.
if [ "${#SCOPES[@]}" -eq 1 ]; then
  PATTERN="$DIR/${SCOPES[0]}/**/*.{js,jsx,ts,tsx}"
else
  JOINED=$(IFS=,; echo "${SCOPES[*]}")
  PATTERN="$DIR/{$JOINED}/**/*.{js,jsx,ts,tsx}"
fi

OUT="./${SAFE}.json"
echo "### Scanning..."
# The CLI exits non-zero when it finds issues (a lint-style convention meant for
# CI gating) — that's expected here, not a failure, so don't let `set -e` abort
# the script on it. We only treat a missing/empty output file as a real failure.
set +e
node "$CLI" "$PATTERN" \
  --format json \
  --output "$OUT" \
  --solutions \
  --min-severity low \
  --ignore "**/dist/**" \
  --ignore "**/build/**" \
  --ignore "**/*.test.*" \
  --ignore "**/*.spec.*" \
  --ignore "**/*.e2e.*" \
  --ignore "**/e2e/**" \
  --ignore "**/__tests__/**" \
  --ignore "**/__mocks__/**"
CLI_EXIT=$?
set -e

if [ ! -s "$OUT" ]; then
  echo "!!! Scan produced no output (CLI exit code $CLI_EXIT). Something went wrong." >&2
  exit 1
fi

echo "### Done (CLI exit code $CLI_EXIT — non-zero here just means it found issues). Results written to $OUT"
node -e "
  const d = require('$OUT');
  let n = 0, sev = {critical:0, high:0, medium:0, low:0};
  for (const f of d.files) {
    for (const det of f.detectors) {
      if (det.name === 'N+1 Query Detector') {
        for (const iss of det.issues) { n++; sev[iss.severity] = (sev[iss.severity]||0) + 1; }
      }
    }
  }
  console.log('N+1 Query Detector findings:', n, JSON.stringify(sev));
  console.log('');
  console.log('These are RAW detector findings. As documented in ../README.md, roughly');
  console.log('two-thirds of raw findings on real codebases turn out to be false positives');
  console.log('(mainly plain Map.get()/Array.find() calls mistaken for ORM lookups) — read');
  console.log('each codeBefore snippet in $OUT before treating a finding as real.');
"
