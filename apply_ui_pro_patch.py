#!/usr/bin/env python3
"""
Patch 4: New Order / Billing screen ka professional UI polish (sirf styling, logic nahi badalta).

  G1  Global CSS: hover lift (sirf mouse par), keyboard focus ring, selection color, hidden scrollbar class
  G2  Top bar: "<- Back" + right side par live total chip
  G3  Menu cards: soft shadow, 2-line name clamp, price neeche, qty badge bada, selected = green tint
  G4  Category chips: hidden scrollbar, bade pill, selected par glow
  G5  Cart panel: rounded + shadow, header tint, empty state icon, gold (+) button

Har group alag hai: kisi ka text match na ho to sirf wahi skip hota hai.

Use:   python3 apply_ui_pro_patch.py src/StaffApp.jsx
Undo:  cp src/StaffApp.jsx.bak_ui_pro src/StaffApp.jsx
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

groups = []

# ---------------------------------------------------------------- G1 global css
groups.append({
    "name": "G1 global css",
    "marker": ".ep-noscroll",
    "edits": [(
        r'''::-webkit-scrollbar-track { background: transparent; }''',
        r'''::-webkit-scrollbar-track { background: transparent; }
.ep-noscroll { scrollbar-width: none; -ms-overflow-style: none; }
.ep-noscroll::-webkit-scrollbar { display: none; }
@media (hover: hover) { .ep-card:hover { box-shadow: 0 8px 20px rgba(184,134,11,0.22) !important; border-color: #B8860B !important; transform: translateY(-1px); } }
button:focus-visible, select:focus-visible { outline: 2px solid #B8860B; outline-offset: 2px; }
::selection { background: rgba(184,134,11,0.28); }''',
    )],
})

# ---------------------------------------------------------------- G2 top bar
groups.append({
    "name": "G2 top bar",
    "marker": "← Back</button>",
    "edits": [
        (
            r'''flexShrink: 0 }}>Back</button>''',
            r'''flexShrink: 0 }}>← Back</button>''',
        ),
        (
            r'''<div style={{ width: isMobile ? 40 : 60, flexShrink: 0 }} />''',
            r'''<div style={{ background: "rgba(255,255,255,0.18)", borderRadius: 20, padding: "6px 12px", fontWeight: 900, fontSize: isMobile ? 12 : 14, fontFamily: "monospace", flexShrink: 0, minWidth: isMobile ? 40 : 60, textAlign: "center" }}>{cartItems.length > 0 ? inr(addMoreMode ? grossSub : totalAmount) : "—"}</div>''',
        ),
    ],
})

# ---------------------------------------------------------------- G3 menu cards
groups.append({
    "name": "G3 menu cards",
    "marker": 'className="ep-card"',
    "edits": [
        (
            r'''style={{ textAlign: "left", padding: isMobile ? 10 : 12, borderRadius: 10, border: `1.5px solid ${q > 0 ? C.green : C.line}`, background: C.card, cursor: "pointer", position: "relative", fontFamily: "inherit", minHeight: isMobile ? 60 : 68, color: C.ink }}''',
            r'''className="ep-card" style={{ textAlign: "left", padding: isMobile ? 10 : 12, borderRadius: 12, border: `1.5px solid ${q > 0 ? C.green : C.line}`, background: q > 0 ? C.greenLight : C.card, boxShadow: q > 0 ? "0 2px 10px rgba(22,163,74,0.15)" : "0 1px 3px rgba(0,0,0,0.05)", cursor: "pointer", position: "relative", fontFamily: "inherit", minHeight: isMobile ? 70 : 78, color: C.ink, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 4 }}''',
        ),
        (
            r'''fontSize: isMobile ? 12 : 13, fontWeight: 700, color: C.ink, marginBottom: 4, lineHeight: 1.2 }}''',
            r'''fontSize: isMobile ? 12 : 13, fontWeight: 700, color: C.ink, marginBottom: 4, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", paddingRight: 24 }}''',
        ),
        (
            r'''borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 800, animation: "successBounce 0.3s"''',
            r'''borderRadius: 12, padding: "2px 9px", fontSize: 11, fontWeight: 800, boxShadow: "0 2px 6px rgba(22,163,74,0.35)", animation: "successBounce 0.3s"''',
        ),
        (
            r'''minmax(170px, 1fr))", gap: 8, overflowY: "auto", flex: 1 }}''',
            r'''minmax(170px, 1fr))", gap: 10, overflowY: "auto", flex: 1, alignContent: "start", paddingBottom: 4, paddingRight: 2 }}''',
        ),
    ],
})

# ---------------------------------------------------------------- G4 category chips
groups.append({
    "name": "G4 category chips",
    "marker": 'className="ep-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2',
    "edits": [
        (
            r'''<div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>''',
            r'''<div className="ep-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, flexShrink: 0 }}>''',
        ),
        (
            r'''padding: "7px 14px", borderRadius: 20, border: `1px solid ${category === c ? C.gold : C.line}`''',
            r'''padding: "8px 16px", borderRadius: 999, boxShadow: category === c ? "0 3px 10px rgba(184,134,11,0.30)" : "none", border: `1px solid ${category === c ? C.gold : C.line}`''',
        ),
    ],
})

# ---------------------------------------------------------------- G5 cart panel
groups.append({
    "name": "G5 cart panel",
    "marker": 'boxShadow: "0 6px 24px rgba(0,0,0,0.08)"',
    "edits": [
        (
            r'''borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0, width: isMobile ? "100%" : 380''',
            r'''borderRadius: 16, boxShadow: "0 6px 24px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0, width: isMobile ? "100%" : 400''',
        ),
        (
            r'''padding: "10px 14px", borderBottom: `1px solid ${C.line}`, fontWeight: 800, fontSize: isMobile ? 13 : 15, color: C.ink }}>{(existingOrder''',
            r'''padding: "12px 14px", borderBottom: `1px solid ${C.line}`, background: C.cardAlt, fontWeight: 800, fontSize: isMobile ? 13 : 15, color: C.ink, letterSpacing: 0.2 }}>{(existingOrder''',
        ),
        (
            r'''<div style={{ textAlign: "center", padding: 40, color: C.gray, fontSize: 13 }}>Menu se item tap karo</div>''',
            r'''<div style={{ textAlign: "center", padding: "40px 20px", color: C.gray, fontSize: 13, fontWeight: 700 }}><div style={{ fontSize: 40, marginBottom: 8, opacity: 0.5 }}>🧾</div>Menu se item tap karo</div>''',
        ),
        (
            r'''onClick={() => setQty(id, q + 1)} style={{ width: 26, height: 26, border: "none", background: C.cardAlt, color: C.ink,''',
            r'''onClick={() => setQty(id, q + 1)} style={{ width: 26, height: 26, border: "none", background: C.goldLight, color: C.goldText,''',
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

bak = path + ".bak_ui_pro"
shutil.copyfile(path, bak)
with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(src)

print("Done. Backup: " + bak)
for a in applied:
    print("  OK:   " + a)
for s in skipped:
    print("  skip: " + s)
print("Undo: cp " + bak + " " + path)
