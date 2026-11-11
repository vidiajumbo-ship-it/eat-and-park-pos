#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""EP-PATCH-v4-CLEANUP — remove duplicate loyaltyUsers listeners."""
import sys, os, shutil
from datetime import datetime

PATH = sys.argv[1] if len(sys.argv) > 1 else "src/StaffApp.jsx"
if not os.path.exists(PATH):
    print(f"❌ NOT FOUND: {PATH}")
    sys.exit(1)

BLOCK = '''  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "loyaltyUsers"),
      (snap) => setLoyaltyUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => unsub();
  }, [user]);
'''

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

count = content.count(BLOCK)
print(f"📄 {PATH}")
print(f"🔍 Found {count} copy/copies of loyaltyUsers listener")

if count <= 1:
    print("✅ No duplicates — file clean hai")
    sys.exit(0)

# Backup
b = f"{PATH}.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(PATH, b)
print(f"📦 backup → {b}")

# Keep first occurrence, remove rest
first = content.find(BLOCK)
head = content[:first + len(BLOCK)]
tail = content[first + len(BLOCK):]
tail_clean = tail.replace(BLOCK, "", count - 1)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(head + tail_clean)

print(f"✅ Removed {count - 1} duplicate(s), 1 rakha")
print(f"   Total blocks now: {BLOCK and (head + tail_clean).count(BLOCK)}")