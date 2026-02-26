#!/bin/bash
set -e

echo "Publishing site to docs..."

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
