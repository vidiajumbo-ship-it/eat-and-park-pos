import os, shutil
from datetime import datetime

PATH = "src/StaffApp.jsx"
if not os.path.exists(PATH):
    print("❌ File nahi mila")
    exit()

# Backup
shutil.copy2(PATH, f"{PATH}.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
print(f"📦 Backup created: {PATH}.bak...")

with open(PATH, "r", encoding="utf-8") as f:
    c = f.read()

# 1. Top Bar fix (Duplicate display hatana)
old_top = '''padding: isMobile ? "10px 10px" : "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 16px rgba(184,134,11,0.30)"'''
new_top = '''padding: isMobile ? "10px 10px" : "14px 20px", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 16px rgba(184,134,11,0.30)"'''
if old_top in c:
    c = c.replace(old_top, new_top)
    print("✅ Top Bar fixed (Ab desktop par hide hoga)")
else:
    print("⚠️ Top Bar pattern not found (shayad pehle se fix hai)")

# 2. TABS Menu fix (Hamesha visible rahe)
old_tabs = '''display: (isMobile || legacyUI) ? "flex" : "none", background: C.card, borderBottom: `1px solid ${C.line}`, padding: isMobile ? "0 8px" : "0 16px", display: "flex"'''
new_tabs = '''display: "flex", background: C.card, borderBottom: `1px solid ${C.line}`, padding: isMobile ? "0 8px" : "0 16px"'''
if old_tabs in c:
    c = c.replace(old_tabs, new_tabs)
    print("✅ TABS Menu fixed (Ab desktop aur mobile dono par dikhega)")
else:
    print("⚠️ TABS pattern not found (shayad pehle se fix hai)")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(c)

print("🎉 Fix Done! Ab terminal me 'npm run dev' ya 'npm run build' chalao.")