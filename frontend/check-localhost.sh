#!/usr/bin/env bash
set -euo pipefail

PAT_LOCAL='https?://(localhost|127\.0\.0\.1)(:[0-9]{2,5})?'
PAT_BACKEND='https?://backend(:[0-9]{2,5})?'

scan() {
  local DIR="$1"
  shift || true
  # exclude vendor stuff & sourcemaps
  grep -RInE "$PAT_LOCAL|$PAT_BACKEND" "$DIR" \
    --exclude-dir node_modules --exclude-dir .git --exclude='*.map' \
    || echo "$DIR clean"
}

# 1) scan source
scan src
scan public

# 2) build fresh
rm -rf build
npm ci
npm run build

# 3) scan built bundle (no maps)
scan build
