#!/usr/bin/env bash
# ============================================================
# Eat & Park — Feature 5 Patch
# Split Payment Prominent
# ============================================================
# Ye script bill screen mein "Split" button ko prominent karta hai
# (label change + emoji). Actual split logic already hai.
# ============================================================
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; }
info() { echo -e "${BLUE}ℹ️  $*${NC}"; }

if [ ! -d "src" ]; then err "Project root se chalao"; exit 1; fi
if [ ! -f "src/StaffApp.jsx" ]; then err "src/StaffApp.jsx nahi mila"; exit 1; fi

TS=$(date +%Y%m%d_%H%M%S)
BACKUP="src_backup_${TS}"
info "Backup: ${BACKUP}/"
cp -r src "$BACKUP"
ok "Backup ready"
echo ""

python3 - <<'PYEOF'
from pathlib import Path
import sys

FILE = Path("src/StaffApp.jsx")
src = FILE.read_text(encoding="utf-8")

MARKER = "FEATURE-SPLIT-PROMINENT"

if MARKER in src:
    print("✅ Feature 5 already applied")
    sys.exit(0)

# Exact pattern: do jagah Split button hai
# 1. BillingView (line ~2385) — 5 payment modes wali
# 2. KOTView ya aur jagah nahi
# Hum sirf BillingView wala change karte hain

OLD = '''{[["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["due", "Due"], ["split", "Split"]].map(([id, label]) => ('''

NEW = '''{/* FEATURE-SPLIT-PROMINENT */}
                  {[["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["due", "Due"], ["split", "Split ⚡"]].map(([id, label]) => ('''

if OLD not in src:
    print("❌ Split button ka exact pattern nahi mila")
    print("   Verify: grep -n 'split.*Split' src/StaffApp.jsx")
    sys.exit(1)

# Count occurrences — only 1 expected
count = src.count(OLD)
if count == 0:
    print("❌ Pattern nahi mila")
    sys.exit(1)

src = src.replace(OLD, NEW, 1)
FILE.write_text(src, encoding="utf-8")

final = FILE.read_text(encoding="utf-8")
if MARKER in final:
    print(f"✅ Feature 5 apply ho gaya (Split ⚡ button)")
    print(f"📄 File: {len(final)} bytes")
else:
    print("❌ Verify fail")
    sys.exit(1)
PYEOF

EXIT=$?
echo ""
echo -e "${BLUE}========================================${NC}"
if [ "$EXIT" -eq 0 ]; then
  echo -e "${GREEN}✅ FEATURE 5 READY${NC}"
  echo ""
  echo "Ab karo:"
  echo "  1. npm run build"
  echo "  2. npm run dev"
  echo "  3. Staff POS → order → bill → 'Split ⚡' button dikhega"
else
  echo -e "${RED}❌ PATCH FAIL${NC}"
  echo "Revert: rm -rf src && mv ${BACKUP} src"
fi
echo -e "${BLUE}========================================${NC}"