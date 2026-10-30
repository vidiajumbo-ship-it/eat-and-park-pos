#!/usr/bin/env python3
"""
Patch 2 (pehle apply_fav_patch.py lag chuka hona chahiye):
Owner menu card par ☆ tap karke item ko Favourite pin kare. Sirf owner/admin/manager ko ☆ dikhega.
Pinned items favourites me sabse upar aate hain, phir auto (zyada bikne wale). Pin list Firestore me save hoti hai
(settings/favourites -> { ids: [...] }), to saare devices par same rahegi.

Use:   python3 apply_fav_pin_patch.py src/StaffApp.jsx
Undo:  cp src/StaffApp.jsx.bak_pin src/StaffApp.jsx
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

if "pinnedIds" in src:
    print("Pin patch pehle se laga hua hai. Kuch change nahi kiya.")
    sys.exit(0)

if "showFav" not in src:
    print("ERROR: pehle apply_fav_patch.py chalao (showFav nahi mila). File change NAHI hui.")
    sys.exit(1)

edits = []

# 1) pinned state + Firestore listener + togglePin (sirf owner)
edits.append((
    'const [showFav, setShowFav] = useState(false);',
    'const [showFav, setShowFav] = useState(false);\n'
    '  const [pinnedIds, setPinnedIds] = useState([]);\n'
    '  useEffect(() => {\n'
    '    const unsub = onSnapshot(doc(db, "settings", "favourites"), (s) => setPinnedIds(s.exists() && Array.isArray(s.data().ids) ? s.data().ids : []), () => {});\n'
    '    return () => unsub();\n'
    '  }, []);\n'
    '  const togglePin = async (id) => {\n'
    '    if (!isOwner) { toast("Favourite sirf owner pin kar sakta hai", "warning"); return; }\n'
    '    const prev = pinnedIds;\n'
    '    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];\n'
    '    haptic(8);\n'
    '    setPinnedIds(next);\n'
    '    try { await setDoc(doc(db, "settings", "favourites"), { ids: next, updatedAt: Date.now() }); }\n'
    '    catch (e) { setPinnedIds(prev); toast(e.message, "error"); }\n'
    '  };',
))

# 2) favItems: pinned item hamesha list me, aur sabse upar
edits.append((
    'm.available && cnt[m.id]',
    'm.available && (cnt[m.id] || pinnedIds.includes(m.id))',
))
edits.append((
    '.sort((a, b) => cnt[b.id] - cnt[a.id])',
    '.sort((a, b) => { const pa = pinnedIds.indexOf(a.id), pb = pinnedIds.indexOf(b.id); if (pa >= 0 || pb >= 0) return pa < 0 ? 1 : pb < 0 ? -1 : pa - pb; return cnt[b.id] - cnt[a.id]; })',
))
edits.append((
    '}, [orders, menu]);',
    '}, [orders, menu, pinnedIds]);',
))

# 3) menu card par owner ke liye pin icon
edits.append((
    'lineHeight: 1.2 }}>{m.name}</div>',
    'lineHeight: 1.2 }}>{m.name}</div>\n'
    '                  {isOwner && <span role="button" title="Favourite pin" onClick={(e) => { e.stopPropagation(); togglePin(m.id); }} '
    'style={{ position: "absolute", bottom: 4, right: 6, fontSize: 16, lineHeight: 1, padding: 4, cursor: "pointer", '
    'opacity: pinnedIds.includes(m.id) ? 1 : 0.35 }}>{pinnedIds.includes(m.id) ? "⭐" : "☆"}</span>}',
))

for i, (find, _) in enumerate(edits, 1):
    c = src.count(find)
    if c != 1:
        print("ERROR: edit #%d ka text %d baar mila (1 hona chahiye). File change NAHI hui." % (i, c))
        print("Text: " + find[:90])
        sys.exit(1)

for find, repl in edits:
    src = src.replace(find, repl, 1)

bak = path + ".bak_pin"
shutil.copyfile(path, bak)
with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(src)

print("Done. Backup: " + bak)
print("Undo: cp " + bak + " " + path)
