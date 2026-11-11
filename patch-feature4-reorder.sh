#!/usr/bin/env bash
# ============================================================
# Eat & Park — Feature 4 Patch
# Reorder Prominent (Order Again section)
# ============================================================
# Customer app home pe "Order Again" section add karta hai
# Last 5 orders ke cards — tap pe cart auto-fill
# ============================================================
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; }
info() { echo -e "${BLUE}ℹ️  $*${NC}"; }

if [ ! -d "src" ]; then err "Project root se chalao"; exit 1; fi
if [ ! -f "src/App.jsx" ]; then err "src/App.jsx nahi mila"; exit 1; fi

TS=$(date +%Y%m%d_%H%M%S)
BACKUP="src_backup_${TS}"
info "Backup: ${BACKUP}/"
cp -r src "$BACKUP"
ok "Backup ready"
echo ""

python3 - <<'PYEOF'
from pathlib import Path
import sys

FILE = Path("src/App.jsx")
src = FILE.read_text(encoding="utf-8")

MARKER = "FEATURE-REORDER-PROMINENT"

if MARKER in src:
    print("✅ Feature 4 already applied")
    sys.exit(0)

# Unique anchor: active orders section ka end
# Dhundte hain: `<span>Track ➔</span>` ke baad `</div>\n      )}`
ANCHOR = 'setRunningOrderId(myActiveOrders[0].id)} style={{ background: "#3B82F6", color: "#fff", border: "none", borderRadius: 14, padding: "0 16px", fontWeight: 800, cursor: "pointer", fontSize: 18 }}>➕</button>'

if ANCHOR not in src:
    print("❌ Active orders section ka anchor nahi mila")
    print("   Verify: grep -n 'Track ➔' src/App.jsx")
    sys.exit(1)

# Find where the active orders block ends (after the anchor, find </div>\n      )})
anchor_idx = src.find(ANCHOR)
if anchor_idx < 0:
    print("❌ Anchor index fail")
    sys.exit(1)

search_from = anchor_idx + len(ANCHOR)
end_marker = '</div>\n      )}'
end_idx = src.find(end_marker, search_from)

if end_idx < 0:
    print("❌ End marker nahi mila")
    sys.exit(1)

insert_pos = end_idx + len(end_marker)

new_block = '''

      {/* FEATURE-REORDER-PROMINENT */}
      {isLoggedIn && myOrders.length > 0 && (
        <div style={{ padding: "12px 14px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 8, fontFamily: "'Outfit', sans-serif" }}>🔄 Order Again</div>
          <div className="enp-hs" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {[...myOrders].reverse().slice(0, 5).map(o => (
              <button
                key={o.id}
                onClick={() => reorderOrder(o)}
                style={{
                  flexShrink: 0,
                  minWidth: 160,
                  background: "#161F2F",
                  border: "1px solid #273449",
                  borderRadius: 12,
                  padding: 10,
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {(o.items || []).slice(0, 2).map(i => i.name).join(", ")}
                  {(o.items || []).length > 2 ? " +" + ((o.items || []).length - 2) : ""}
                </div>
                <div style={{ fontSize: 10, color: "#8B9BB4", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <span>#{o.id.slice(1, 5).toUpperCase()}</span>
                  <span>{inr(o.finalTotal || 0)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}'''

src = src[:insert_pos] + new_block + src[insert_pos:]
FILE.write_text(src, encoding="utf-8")

final = FILE.read_text(encoding="utf-8")
if MARKER in final:
    print("✅ Feature 4 apply ho gaya (Order Again section)")
    print(f"📄 File: {len(final)} bytes")
else:
    print("❌ Verify fail")
    sys.exit(1)
PYEOF

EXIT=$?
echo ""
echo -e "${BLUE}========================================${NC}"
if [ "$EXIT" -eq 0 ]; then
  echo -e "${GREEN}✅ FEATURE 4 READY${NC}"
  echo ""
  echo "Ab karo:"
  echo "  1. npm run build"
  echo "  2. npm run dev"
  echo "  3. Customer app → home → 'Order Again' section"
else
  echo -e "${RED}❌ PATCH FAIL${NC}"
  echo "Revert: rm -rf src && mv ${BACKUP} src"
fi
echo -e "${BLUE}========================================${NC}"