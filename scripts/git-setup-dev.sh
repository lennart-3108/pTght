#!/usr/bin/env bash
set -euo pipefail

git checkout main
git pull --ff-only
if git rev-parse --verify dev >/dev/null 2>&1; then
  echo "Branch 'dev' exists locally."
else
  git checkout -b dev
fi

git push -u origin dev
echo "Branch 'dev' is now on origin."
