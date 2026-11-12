#!/usr/bin/env bash
set -uo pipefail

FILE="src/StaffApp.jsx"
[ -f "$FILE" ] || { echo "❌ src/StaffApp.jsx nahi mila"; exit 1; }

cp "$FILE" "$FILE.bak"
echo "✅ Backup: $FILE.bak"

python3 - <<'PYEOF'
from pathlib import Path

FILE = Path("src/StaffApp.jsx")
src = FILE.read_text(encoding="utf-8")

# 1. StaffApp mein Orders ko filter karo (Sirf fresh 12 ghante wale dikhein)
OLD_1 = 'const kotOrders = orders.filter(o => (o.status === "new" || o.status === "preparing") && Date.now() - (o.createdAt || 0) < OPEN_WINDOW_MS);'
NEW_1 = '''// FIX: Sirf 12 ghante ke andar ke orders dikhao
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  const kotOrders = orders.filter(o => {
    if (o.status !== "new" && o.status !== "preparing") return false;
    return Date.now() - (o.createdAt || 0) < TWELVE_HOURS;
  });'''

if OLD_1 in src:
    src = src.replace(OLD_1, NEW_1)
    print("✅ StaffApp Kitchen orders filter fix ho gaya (12 ghante cutoff)")
else:
    print("⚠️ KotOrders filter pattern nahi mila.")

# 2. StaffApp (Orders Tab) mein bhi purane orders hide karo
OLD_2 = 'const rangeAll = orders.filter(o => {\n    if (o.createdAt < start || o.createdAt >= end) return false;\n    if (filter === "cancelled") return o.status === "cancelled";\n    return o.status !== "cancelled";\n  });'
NEW_2 = '''const rangeAll = orders.filter(o => {
    // FIX: 12 ghante se purane orders staff ko mat dikhao (Dashboard/Orders tab me)
    const age = Date.now() - (o.createdAt || 0);
    if (age > 12 * 60 * 60 * 1000) return false; 
    if (o.createdAt < start || o.createdAt >= end) return false;
    if (filter === "cancelled") return o.status === "cancelled";
    return o.status !== "cancelled";
  });'''

if OLD_2 in src:
    src = src.replace(OLD_2, NEW_2)
    print("✅ StaffApp Orders tab filter fix ho gaya (12 ghante cutoff)")
else:
    print("⚠️ Orders range filter pattern nahi mila.")

FILE.write_text(src, encoding="utf-8")
PYEOF

echo "Ab karo: npm run build"