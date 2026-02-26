#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APPJS = ROOT / "app" / "app.js"

txt = APPJS.read_text(encoding="utf-8", errors="ignore").splitlines()

def emit(title, items):
    print()
    print(title)
    if not items:
        print("  (none)")
        return
    for ln, s in items[:200]:
        print(f"  L{ln:>5}  {s}")

consts = []
funcs = []
listeners = []
markers = []

for i, line in enumerate(txt, start=1):
    s = line.strip()

    if re.match(r'^(const|let|var)\s+[A-Za-z_$][\w$]*\s*=', s):
        consts.append((i, s))

    m = re.match(r'^function\s+([A-Za-z_$][\w$]*)\s*\(', s)
    if m:
        funcs.append((i, f"function {m.group(1)}("))

    if "addEventListener(" in s or "DOMContentLoaded" in s:
        listeners.append((i, s[:120]))

    if "init" in s.lower() or "boot" in s.lower() or "render" in s.lower():
        if re.search(r'\b(init|boot|render)\b', s, flags=re.I):
            markers.append((i, s[:120]))

print("OpenClaw Fence Plan (app/app.js)")
print(f"File: {APPJS}")
print(f"Total lines: {len(txt)}")

emit("Top-level declarations (const/let/var ... =)", consts)
emit("Function definitions", funcs)
emit("Event listeners / DOMContentLoaded", listeners)
emit("Other helpful markers (init/boot/render)", markers)
