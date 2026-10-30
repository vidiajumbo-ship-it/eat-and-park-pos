#!/usr/bin/env python3
"""
Staff.jsx patch: Favourites ko ek button me badlo (tap par saare items wrap hoke dikhen),
aur duplicate favourite names hatao.

Use:   python3 apply_fav_patch.py            (default path: src/Staff.jsx)
       python3 apply_fav_patch.py path/to/Staff.jsx
Undo:  cp src/Staff.jsx.bak src/Staff.jsx
"""
import os
import shutil
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "src/Staff.jsx"

if not os.path.exists(path):
    print("ERROR: file nahi mili: " + path)
    print("Sahi path do: python3 apply_fav_patch.py src/Staff.jsx")
    sys.exit(1)

with open(path, encoding="utf-8", newline="") as f:
    src = f.read()

if "showFav" in src:
    print("Patch pehle se laga hua hai (showFav mil gaya). Kuch change nahi kiya.")
    sys.exit(0)

edits = []

# 1) state
edits.append((
    'const [category, setCategory] = useState("All");',
    'const [category, setCategory] = useState("All");\n  const [showFav, setShowFav] = useState(false);',
))

# 2) favItems: duplicate names hatao, top 12 rakho
edits.append((
    'return menu.filter((m) => m.available && cnt[m.id]).sort((a, b) => cnt[b.id] - cnt[a.id]).slice(0, 8);',
    'const seenFav = new Set();\n'
    '    return menu.filter((m) => m.available && cnt[m.id]).sort((a, b) => cnt[b.id] - cnt[a.id])'
    '.filter((m) => { const k = String(m.name || "").trim().toLowerCase(); if (seenFav.has(k)) return false; seenFav.add(k); return true; })'
    '.slice(0, 12);',
))

# 3) toggle button + panel condition
edits.append((
    '{favItems.length > 0 && !search.trim() && (',
    '{favItems.length > 0 && !search.trim() && (\n'
    '            <button onClick={() => { haptic(); setShowFav((v) => !v); }} '
    'style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, '
    'border: "1px solid " + C.gold, background: showFav ? C.gold : C.card, color: showFav ? "#fff" : C.goldText, '
    'fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>'
    '⭐ Favourites ({favItems.length}) {showFav ? "▲" : "▼"}</button>\n'
    '          )}\n'
    '          {showFav && favItems.length > 0 && !search.trim() && (',
))

# 4) panel: slide nahi, wrap hoke dikhe
edits.append((
    '<div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, flexShrink: 0 }}>',
    '<div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 8, maxHeight: 150, overflowY: "auto", '
    'background: C.goldLight, border: "1px solid " + C.line, borderRadius: 12, flexShrink: 0 }}>',
))

# Pehle sab check karo - koi bhi match na ho (ya 2 baar ho) to kuch likhna nahi
for i, (find, _) in enumerate(edits, 1):
    c = src.count(find)
    if c != 1:
        print("ERROR: edit #%d ka text %d baar mila (1 hona chahiye). File change NAHI hui." % (i, c))
        print("Text: " + find[:90])
        sys.exit(1)

for find, repl in edits:
    src = src.replace(find, repl, 1)

shutil.copyfile(path, path + ".bak")
with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(src)

print("Done. Backup: " + path + ".bak")
print("Undo: cp " + path + ".bak " + path)
