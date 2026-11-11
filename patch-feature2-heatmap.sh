#!/usr/bin/env bash
# ============================================================
# Eat & Park — Feature 2 Patch
# Waiter Table Heatmap (aging color)
# ============================================================
# Tables view mein age ke hisaab se border color:
#   🟢 0-15 min | 🟡 15-30 | 🟠 30-45 | 🔴 45+
# ============================================================
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; }
info() { echo -e "${BLUE}ℹ️  $*${NC}"; }

# --- Sanity ---
if [ ! -d "src" ]; then err "Project root se chalao"; exit 1; fi
if [ ! -f "src/StaffApp.jsx" ]; then err "src/StaffApp.jsx nahi mila"; exit 1; fi
if ! command -v python3 >/dev/null 2>&1; then err "python3 nahi mila"; exit 1; fi

# --- Backup ---
TS=$(date +%Y%m%d_%H%M%S)
BACKUP="src_backup_${TS}"
info "Backup: ${BACKUP}/"
cp -r src "$BACKUP"
ok "Backup ready"
info "Revert: rm -rf src && mv ${BACKUP} src"
echo ""

# --- Python patch ---
python3 - <<'PYEOF'
from pathlib import Path
import sys

FILE = Path("src/StaffApp.jsx")
src = FILE.read_text(encoding="utf-8")

MARKER = "FEATURE-HEATMAP"

if MARKER in src:
    print("✅ Feature 2 already applied")
    sys.exit(0)

# ============================================================
# EDIT 1: tableData useMemo ka return block replace karo
# ============================================================
OLD_1 = '''    return Object.values(map);
  }, [orders]);'''

NEW_1 = '''    // FEATURE-HEATMAP: compute age for each table
    return Object.values(map).map(t => {
      if (!t.order) return { ...t, ageMin: 0, heatColor: C.line, heatBg: C.card };
      const ageMin = (Date.now() - (t.order.createdAt || Date.now())) / 60000;
      let heatColor, heatBg;
      if (ageMin < 15) { heatColor = "#10B981"; heatBg = C.card; }
      else if (ageMin < 30) { heatColor = "#F59E0B"; heatBg = C.amberLight; }
      else if (ageMin < 45) { heatColor = "#F97316"; heatBg = C.amberLight; }
      else { heatColor = "#EF4444"; heatBg = C.redLight; }
      return { ...t, ageMin, heatColor, heatBg };
    });
  }, [orders, C.card, C.line, C.amberLight, C.redLight]);'''

# Only replace the FIRST occurrence (inside TablesView — should be the only one)
if src.count(OLD_1) != 1:
    print(f"❌ EDIT 1: Expected 1 match, found {src.count(OLD_1)}")
    print("   Manual check karo: grep -n 'return Object.values(map);' src/StaffApp.jsx")
    sys.exit(1)

src = src.replace(OLD_1, NEW_1, 1)
print("✅ EDIT 1: tableData heat calculation added")

# ============================================================
# EDIT 2: Table card background + border replace karo
# ============================================================
OLD_2 = '''            background: t.order ? C.redLight : C.card,
            border: `2px solid ${t.order ? C.red : C.line}`,'''

NEW_2 = '''            background: t.heatBg,
            border: `2px solid ${t.heatColor}`,'''

if src.count(OLD_2) != 1:
    print(f"❌ EDIT 2: Expected 1 match, found {src.count(OLD_2)}")
    print("   Ye line alag file mein bhi ho sakti hai. Check karo:")
    print("   grep -n 'background: t.order ? C.redLight' src/StaffApp.jsx")
    sys.exit(1)

src = src.replace(OLD_2, NEW_2, 1)
print("✅ EDIT 2: table card heat styling added")

# ============================================================
# Save + Verify
# ============================================================
FILE.write_text(src, encoding="utf-8")
final = FILE.read_text(encoding="utf-8")

if MARKER in final and final.count(MARKER) == 1:
    print("✅ Verify: heatmap code present")
    print(f"📄 File: {len(final)} bytes, {final.count(chr(10))} lines")
else:
    print("❌ Verify fail")
    sys.exit(1)
PYEOF

EXIT=$?
echo ""
echo -e "${BLUE}========================================${NC}"
if [ "$EXIT" -eq 0 ]; then
  echo -e "${GREEN}✅ FEATURE 2 READY${NC}"
  echo ""
  echo "Ab karo:"
  echo "  1. npm run build   ← PEHLE YE CHALAO"
  echo "  2. Agar pass → npm run dev → test"
  echo "  3. Agar fail → revert (niche command)"
  echo ""
  echo "Revert: rm -rf src && mv ${BACKUP} src"
else
  echo -e "${RED}❌ PATCH FAIL — file SAFE hai, kuch nahi bigda${NC}"
  echo ""
  echo "Revert: rm -rf src && mv ${BACKUP} src"
  echo ""
  echo "Ya manually VS Code se karo."
fi
echo -e "${BLUE}========================================${NC}"