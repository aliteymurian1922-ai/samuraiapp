#!/bin/bash
set -euo pipefail

REPO="https://github.com/aliteymurian1922-ai/samuraiapp.git"
BRANCH="develop"

cd "$(dirname "$0")"

git init
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO"
else
  git remote add origin "$REPO"
fi

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git add -A
if ! git diff --cached --quiet; then
  git commit -m "feat: import and stabilize Samurai SaaS platform"
fi
git push -u origin "$BRANCH"

echo "Samurai source pushed to $REPO on branch $BRANCH"
