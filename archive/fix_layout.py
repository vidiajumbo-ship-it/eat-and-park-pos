import os, shutil
from datetime import datetime

PATH = "src/StaffApp.jsx"

def backup(path):
    b = f"{path}.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(path, b)
    print(f"📦 backup → {b}")

if not os.path.exists(PATH):
    print(f"❌ NOT FOUND: {PATH}")
    exit()

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

backup(PATH)

# 1. Top Bar fix (Desktop pe hide, Mobile pe show)
old_top = 'padding: isMobile ? "10px 10px" : "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 16px rgba(184,134,11,0.30)", position: "sticky", top: 0, zIndex: 50, gap: 8 }}>'
new_top = 'padding: isMobile ? "10px 10px" : "14px 20px", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 16px rgba(184,134,11,0.30)", position: "sticky", top: 0, zIndex: 50, gap: 8 }}>'

if old_top in content:
    content = content.replace(old_top, new_top)
    print("✅ Top Bar duplicate display fixed (Ab desktop par hide hoga)")
else:
    print("⚠️ Top Bar pattern not found (shayad pehle se fix hai)")

# 2. TABS Menu fix (Hamesha visible rahe)
old_tabs = '<div style={{ display: (isMobile || legacyUI) ? "flex" : "none", background: C.card, borderBottom: `1px solid ${C.line}`, padding: isMobile ? "0 8px" : "0 16px", gap: 4, overflowX: "auto", alignItems: "center" }}>'
new_tabs = '<div style={{ display: "flex", background: C.card, borderBottom: `1px solid ${C.line}`, padding: isMobile ? "0 8px" : "0 16px", gap: 4, overflowX: "auto", alignItems: "center" }}>'

if old_tabs in content:
    content = content.replace(old_tabs, new_tabs)
    print("✅ TABS Menu fix (Ab mobile aur desktop dono par dikhega)")
else:
    print("⚠️ TABS Menu pattern not found")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("🎉 Layout Fix Done! Ab 'npm run dev' chala kar dekho.")