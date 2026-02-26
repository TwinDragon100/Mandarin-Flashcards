#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/app"

echo "OpenClaw Validation Runner"
echo "Root: $ROOT"
echo "App:  $APP_DIR"
echo

echo "0) Fence integrity check (OC_BEGIN/OC_END)"
python3 - "$APP_DIR" <<'PY'
import re, sys, pathlib

app_dir = pathlib.Path(sys.argv[1])

begin_re = re.compile(r'/\*\s*OC_BEGIN:([A-Za-z0-9_.-]+):v(\d+)\s*\*/')
end_re   = re.compile(r'/\*\s*OC_END:([A-Za-z0-9_.-]+):v(\d+)\s*\*/')

problems = []

for path in sorted(app_dir.rglob("*")):
    if not path.is_file():
        continue
    if path.suffix.lower() not in {".js", ".css", ".html"}:
        continue

    text = path.read_text(encoding="utf-8", errors="ignore")

    begins = list(begin_re.finditer(text))
    ends   = list(end_re.finditer(text))

    if not begins and not ends:
        continue

    if len(begins) != len(ends):
        problems.append(f"{path}: begin/end count mismatch (begins={len(begins)} ends={len(ends)})")
        continue

    for b, e in zip(begins, ends):
        b_tag, b_ver = b.group(1), b.group(2)
        e_tag, e_ver = e.group(1), e.group(2)
        if (b_tag, b_ver) != (e_tag, e_ver):
            problems.append(f"{path}: fence tag/version mismatch (BEGIN {b_tag}:v{b_ver} vs END {e_tag}:v{e_ver})")
            continue
        if e.start() <= b.end():
            problems.append(f"{path}: END appears before BEGIN for {b_tag}:v{b_ver}")
            continue

if problems:
    print("FENCE INTEGRITY FAILURES:")
    for p in problems:
        print(" -", p)
    sys.exit(10)

print("OK")
PY
echo

echo "1) JS syntax check (node --check)"
find "$APP_DIR" -type f -name "*.js" -print0 | while IFS= read -r -d '' f; do
  node --check "$f" >/dev/null
done
echo "OK"
echo

echo "2) Duplicate function definitions (simple scan)"
tmp="$(mktemp)"
find "$APP_DIR" -type f -name "*.js" -print0 | xargs -0 cat > "$tmp"

python3 - "$tmp" <<'PY'
import re, sys
text = open(sys.argv[1], "r", encoding="utf-8", errors="ignore").read()
funcs = re.findall(r'^\s*function\s+([A-Za-z_$][\w$]*)\s*\(', text, flags=re.M)
dups = sorted({f for f in funcs if funcs.count(f) > 1})
if dups:
    print("DUPLICATE FUNCTIONS FOUND:")
    for f in dups:
        print(" -", f)
    sys.exit(2)
print("OK")
PY

rm -f "$tmp"
echo

echo "3) DOM selector existence check (basic)"
python3 - "$APP_DIR" <<'PY'
import re, sys, pathlib

app = pathlib.Path(sys.argv[1]).resolve()
html = ""
for f in app.rglob("*.html"):
    html += f.read_text(encoding="utf-8", errors="ignore") + "\n"

selectors = []

for f in app.rglob("*.js"):
    txt = f.read_text(encoding="utf-8", errors="ignore")

    for m in re.finditer(r'getElementById\(\s*[\'"]([^\'"]+)[\'"]\s*\)', txt):
        selectors.append(("id", m.group(1), str(f)))

    for m in re.finditer(r'querySelector(All)?\(\s*[\'"]([#.][^\'"]+)[\'"]\s*\)', txt):
        sel = m.group(2)
        if sel.startswith("#"):
            selectors.append(("id", sel[1:], str(f)))
        elif sel.startswith("."):
            selectors.append(("class", sel[1:], str(f)))

missing = []
for kind, name, src in selectors:
    if kind == "id":
        if re.search(r'\bid\s*=\s*[\'"]%s[\'"]' % re.escape(name), html) is None:
            missing.append((kind, name, src))
    else:
        if re.search(r'\bclass\s*=\s*[\'"][^\'"]*\b%s\b' % re.escape(name), html) is None:
            missing.append((kind, name, src))

if missing:
    print("MISSING DOM TARGETS:")
    for kind, name, src in missing:
        print(f" - {kind}:{name} referenced in {src}")
    sys.exit(3)

print("OK")
PY
echo

echo "Validation complete."
