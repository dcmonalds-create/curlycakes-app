#!/usr/bin/env bash
# Quick deploy helper — stages, commits, and pushes to GitHub.
# Vercel auto-redeploys on push (once you've imported the repo on vercel.com).
set -e
cd "$(dirname "$0")"

MSG="${1:-Update CurlyCakes}"

git add .
if git diff --staged --quiet; then
  echo "Nothing to commit."
  exit 0
fi

git -c user.email="dcmonalds-create@users.noreply.github.com" \
    -c user.name="dcmonalds-create" \
    commit -m "$MSG"
git push

echo "✅ Pushed. Vercel will redeploy in ~30s."
