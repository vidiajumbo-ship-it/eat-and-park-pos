#!/usr/bin/env bash
# ============================================================
# Eat & Park — Expenses: Category Remove Patch
# Feature A: Custom category delete button
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

MARKER = "FEATURE-EXPENSE-REMOVE-CAT"

if MARKER in src:
    print("✅ Feature A already applied")
    sys.exit(0)

# ============================================================
# EDIT 1: removeCat function add karo (addCat ke baad)
# ============================================================
OLD_1 = '''      toast("Category add ho gayi", "success");
    } catch (e) { toast(e.message, "error"); }
  };'''

NEW_1 = '''      toast("Category add ho gayi", "success");
    } catch (e) { toast(e.message, "error"); }
  };
  // FEATURE-EXPENSE-REMOVE-CAT
  const removeCat = async (catToRemove) => {
    if (EXP_CATS.includes(catToRemove)) {
      toast("Default category delete nahi ho sakti", "warning");
      return;
    }
    if (!window.confirm("Category \\"" + catToRemove + "\\" delete karein? Is category ke purane kharchay rahenge.")) return;
    const newList = cats.filter((c) => c !== catToRemove);
    try {
      await saveCustomCats(newList);
      setCats(newList);
      if (cat === catToRemove) setCat(newList[0] || EXP_CATS[0]);
      toast("Category delete ho gayi", "success");
    } catch (e) { toast(e.message, "error"); }
  };'''

if src.count(OLD_1) != 1:
    print(f"❌ EDIT 1: Expected 1 match, found {src.count(OLD_1)}")
    sys.exit(1)

src = src.replace(OLD_1, NEW_1, 1)
print("✅ EDIT 1: removeCat function added")

# ============================================================
# EDIT 2: Category chips ke saath × button
# ============================================================
OLD_2 = '''        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{cats.map((c) => chip(cat === c, c, () => { haptic(); setCat(c); }))}
          <button onClick={() => setShowNewCat((v) => !v)} style={{ padding: "7px 13px", borderRadius: 20, border: "1px dashed " + C.gray, background: "transparent", color: C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Naya</button>
        </div>'''

NEW_2 = '''        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {cats.map((c) => {
            const isDefault = EXP_CATS.includes(c);
            return (
              <div key={c} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                {chip(cat === c, c, () => { haptic(); setCat(c); })}
                {!isDefault && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCat(c); }}
                    title={"Delete: " + c}
                    style={{
                      width: 18, height: 18, borderRadius: "50%",
                      border: "none", background: C.red, color: "#fff",
                      fontSize: 11, fontWeight: 900, cursor: "pointer",
                      padding: 0, lineHeight: 1, marginLeft: -4
                    }}
                  >×</button>
                )}
              </div>
            );
          })}
          <button onClick={() => setShowNewCat((v) => !v)} style={{ padding: "7px 13px", borderRadius: 20, border: "1px dashed " + C.gray, background: "transparent", color: C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Naya</button>
        </div>'''

if src.count(OLD_2) != 1:
    print(f"❌ EDIT 2: Expected 1 match, found {src.count(OLD_2)}")
    sys.exit(1)

src = src.replace(OLD_2, NEW_2, 1)
print("✅ EDIT 2: category remove buttons added")

# ============================================================
# Save + Verify
# ============================================================
FILE.write_text(src, encoding="utf-8")
final = FILE.read_text(encoding="utf-8")

if MARKER in final:
    print("✅ Verify: remove-cat code present")
    print(f"📄 File: {len(final)} bytes, {final.count(chr(10))} lines")
else:
    print("❌ Verify fail")
    sys.exit(1)
PYEOF

EXIT=$?
echo ""
echo -e "${BLUE}========================================${NC}"
if [ "$EXIT" -eq 0 ]; then
  echo -e "${GREEN}✅ FEATURE A READY${NC}"
  echo ""
  echo "Ab karo:"
  echo "  1. npm run build"
  echo "  2. Test: Expenses → category chip pe × button"
else
  echo -e "${RED}❌ PATCH FAIL — file SAFE hai${NC}"
  echo "Revert: rm -rf src && mv ${BACKUP} src"
fi
echo -e "${BLUE}========================================${NC}"