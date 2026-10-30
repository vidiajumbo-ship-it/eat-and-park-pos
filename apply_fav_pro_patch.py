#!/usr/bin/env python3
"""
Patch 3 (pehle apply_fav_patch.py aur apply_fav_pin_patch.py lag chuke hone chahiye)

Features (BillingView / New Order screen):
  A1  Search me category naam se bhi item milega ("chinese" likho -> poori category)
  A2  Search box me  X  (clear) button
  B   Cart header me "Clear" button (sirf naye order me, confirm ke saath)
  C1  Favourites panel me owner ke pin kiye items 📌, auto wale ⭐
  C2  Favourites panel khula/band state yaad rahe (localStorage)

Har feature alag group hai: kisi group ka text match na ho to sirf wahi skip hota hai, baaki lag jate hain.

Use:   python3 apply_fav_pro_patch.py src/StaffApp.jsx
Undo:  cp src/StaffApp.jsx.bak_pro src/StaffApp.jsx
"""
import os
import shutil
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "src/StaffApp.jsx"

if not os.path.exists(path):
    print("ERROR: file nahi mili: " + path)
    sys.exit(1)

with open(path, encoding="utf-8", newline="") as f:
    src = f.read()

if "pinnedIds" not in src or "showFav" not in src:
    print("ERROR: pehle apply_fav_patch.py aur apply_fav_pin_patch.py chalao. File change NAHI hui.")
    sys.exit(1)

groups = []

# A1: category se search
groups.append({
    "name": "A1 category search",
    "marker": 'String(m.category || "").toLowerCase().includes(debouncedSearch',
    "edits": [(
        r'''m.name.toLowerCase().includes(debouncedSearch.toLowerCase())''',
        r'''(m.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || String(m.category || "").toLowerCase().includes(debouncedSearch.toLowerCase()))''',
    )],
})

# A2: search clear button
groups.append({
    "name": "A2 search clear (X)",
    "marker": 'aria-label="Search clear"',
    "edits": [(
        r'''<input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: "10px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, outline: "none", background: C.card, color: C.ink }} />''',
        r'''<div style={{ position: "relative", flexShrink: 0 }}><input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "10px 38px 10px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, outline: "none", background: C.card, color: C.ink }} />{search && <button aria-label="Search clear" onClick={() => setSearch("")} style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, border: "none", borderRadius: 14, background: C.cardAlt, color: C.gray, fontSize: 13, fontWeight: 800, cursor: "pointer", padding: 0 }}>✕</button>}</div>''',
    )],
})

# B: clear cart (sirf naye order me)
groups.append({
    "name": "B clear cart",
    "marker": "Poora cart khaali",
    "edits": [(
        r'''+ Menu</button>}</div>''',
        r'''+ Menu</button>}{!existingOrder && cartItems.length > 0 && <button onClick={() => { if (window.confirm("Poora cart khaali karein?")) { setCart({}); try { localStorage.removeItem("staff_draft_" + table); } catch (e) {} } }} style={{ float: "right", margin: "-3px 8px -3px 0", padding: "5px 12px", border: "1.5px solid " + C.red, borderRadius: 6, background: "transparent", color: C.red, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Clear</button>}</div>''',
    )],
})

# C1: pinned = 📌, auto = ⭐
groups.append({
    "name": "C1 pin marker",
    "marker": '"📌" : "⭐"',
    "edits": [(
        r'''⭐ {m.name}{cart[m.id]''',
        r'''{pinnedIds.includes(m.id) ? "📌" : "⭐"} {m.name}{cart[m.id]''',
    )],
})

# C2: favourites panel state yaad rakho
groups.append({
    "name": "C2 remember panel state",
    "marker": "staff_fav_open",
    "edits": [
        (
            r'''const [showFav, setShowFav] = useState(false);''',
            r'''const [showFav, setShowFav] = useState(() => { try { return localStorage.getItem("staff_fav_open") === "1"; } catch (e) { return false; } });''',
        ),
        (
            r'''setShowFav((v) => !v)''',
            r'''setShowFav((v) => { const n = !v; try { localStorage.setItem("staff_fav_open", n ? "1" : "0"); } catch (e) {} return n; })''',
        ),
    ],
})

applied, skipped = [], []
for g in groups:
    if g["marker"] in src:
        skipped.append(g["name"] + " (pehle se laga hai)")
        continue
    bad = [(i + 1, src.count(f)) for i, (f, _) in enumerate(g["edits"]) if src.count(f) != 1]
    if bad:
        skipped.append(g["name"] + " (text match nahi hua: " + ", ".join("edit#%d=%d baar" % b for b in bad) + ")")
        continue
    for find, repl in g["edits"]:
        src = src.replace(find, repl, 1)
    applied.append(g["name"])

if not applied:
    print("Kuch apply nahi hua. File change NAHI hui.")
    for s in skipped:
        print("  skip: " + s)
    sys.exit(0)

bak = path + ".bak_pro"
shutil.copyfile(path, bak)
with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(src)

print("Done. Backup: " + bak)
for a in applied:
    print("  OK:   " + a)
for s in skipped:
    print("  skip: " + s)
print("Undo: cp " + bak + " " + path)
