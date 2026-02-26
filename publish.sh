#!/bin/bash
set -euo pipefail

echo "Publishing site to docs..."

if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
  echo "ERROR: Not on branch 'main'."
  exit 1
fi

if ! git diff --quiet -- app; then
  echo "ERROR: app/ has uncommitted changes. Commit first."
  exit 1
fi

tools/oc_validate.sh

# Remove only site files (preserve docs/_docs)
find docs -maxdepth 1 -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.webmanifest" \) -delete
rm -rf docs/data docs/icons

# Copy fresh app build
cp -R app/* docs/

echo "Committing changes..."
git add docs
git commit -m "Publish" || echo "No changes to commit"

echo "Pushing..."
git push

echo "Publish complete."
