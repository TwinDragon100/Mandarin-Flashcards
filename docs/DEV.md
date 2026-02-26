# Developer Workflow (Deterministic)

## One-time setup after cloning
Run this once per clone:

tools/install-hooks.sh

Confirm:
git config --get core.hooksPath
Expected: .githooks

## Validation (manual)
tools/oc_validate.sh

## Publish to GitHub Pages
./publish.sh
