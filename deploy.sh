#!/usr/bin/env bash
#
# Terra Invest deploy script.
#
# Place this on the server (e.g. ~/terrainvest/deploy.sh) and run it after
# pushing to main. It skips redundant work so a no-op deploy completes in
# seconds instead of rebuilding everything every time.
#
# Pipeline:
#   1. git pull
#   2. npm install      (only if package-lock.json changed)
#   3. next build       (only if any source / config / lockfile changed)
#   4. pm2 restart      (only if step 3 ran)
#
# Set FORCE=1 to skip the change detection and rebuild unconditionally.

set -euo pipefail

cd "$(dirname "$0")"

START_TS=$(date +%s)
PREV_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "none")

echo "==> git pull"
git pull --ff-only

NEW_HEAD=$(git rev-parse HEAD)

if [ "$PREV_HEAD" = "$NEW_HEAD" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "==> No new commits since last deploy. Use FORCE=1 to rebuild anyway."
  exit 0
fi

# 1) Reinstall dependencies only if the lockfile changed.
if ! git diff --quiet "$PREV_HEAD" "$NEW_HEAD" -- package-lock.json package.json 2>/dev/null \
   || [ "$PREV_HEAD" = "none" ] || [ "${FORCE:-0}" = "1" ]; then
  echo "==> npm install (lockfile changed)"
  npm ci --omit=dev --include=optional || npm install
else
  echo "==> Skipping npm install (lockfile unchanged)"
fi

# 2) Build only if anything that affects the bundle changed.
NEEDS_BUILD=0
if [ ! -d ".next" ] || [ "${FORCE:-0}" = "1" ] || [ "$PREV_HEAD" = "none" ]; then
  NEEDS_BUILD=1
elif ! git diff --quiet "$PREV_HEAD" "$NEW_HEAD" -- \
        src/ public/ \
        next.config.ts next.config.js \
        package.json package-lock.json \
        tsconfig.json postcss.config.mjs eslint.config.mjs 2>/dev/null; then
  NEEDS_BUILD=1
fi

if [ "$NEEDS_BUILD" = "1" ]; then
  echo "==> next build"
  npm run build

  echo "==> pm2 restart terrainvest --update-env"
  pm2 restart terrainvest --update-env
else
  echo "==> Skipping build + restart (no source / config changes)"
fi

END_TS=$(date +%s)
echo "==> Deploy finished in $((END_TS - START_TS))s"
