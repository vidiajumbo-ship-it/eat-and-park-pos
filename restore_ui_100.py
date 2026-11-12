import os, re, shutil
from datetime import datetime

PATH = "src/StaffApp.jsx"

if not os.path.exists(PATH):
    print("❌ src/StaffApp.jsx nahi mila!")
    exit()

# Backup
b = f"{PATH}.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(PATH, b)
print(f"📦 Backup saved: {b}")

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Force Top Bar ko hamesha dikhne ke liye fix karo
content = re.sub(r'display:\s*\(isMobile\s*\|\|\s*legacyUI\)\s*\?\s*"flex"\s*:\s*"none"', 'display: "flex"', content)

# 2. Top Bar me duplicate display: "flex" hatao (agar bacha ho)
content = content.replace(
    'display: "flex", background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, color: "#fff", padding: isMobile ? "10px 10px" : "14px 20px", display: "flex",',
    'display: "flex", background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, color: "#fff", padding: isMobile ? "10px 10px" : "14px 20px",'
)

# 3. TABS Menu me duplicate display: "flex" hatao
content = content.replace(
    'display: "flex", background: C.card, borderBottom: `1px solid ${C.line}`, padding: isMobile ? "0 8px" : "0 16px", display: "flex",',
    'display: "flex", background: C.card, borderBottom: `1px solid ${C.line}`, padding: isMobile ? "0 8px" : "0 16px",'
)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("✅ Top Bar aur TABS Menu wapas 'display: flex' ho gaye!")
print("✅ Ab Desktop par Image 1 jaisa hi dikhega.")
print("🚀 Ab chalao: npm run dev")