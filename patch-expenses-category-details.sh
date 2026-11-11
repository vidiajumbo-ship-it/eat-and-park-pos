#!/usr/bin/env bash
# ============================================================
# Eat & Park — Expenses: Category Details + Print
# Feature B: Category pe click → details modal + print
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

MARKER = "FEATURE-EXPENSE-DETAILS"

if MARKER in src:
    print("✅ Feature B already applied")
    sys.exit(0)

# ============================================================
# EDIT 1: detailCat state add (after showNewCat state)
# ============================================================
OLD_1 = '''  const [showNewCat, setShowNewCat] = useState(false);

  useEffect(() => {
    loadCustomCats().then(setCats);'''

NEW_1 = '''  const [showNewCat, setShowNewCat] = useState(false);
  // FEATURE-EXPENSE-DETAILS
  const [detailCat, setDetailCat] = useState(null);
  const catExpenses = detailCat ? list.filter(e => (e.category || "Anya") === detailCat) : [];
  const catTotal = catExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const catAvg = catExpenses.length ? Math.round(catTotal / catExpenses.length) : 0;

  useEffect(() => {
    loadCustomCats().then(setCats);'''

if src.count(OLD_1) != 1:
    print(f"❌ EDIT 1: Expected 1 match, found {src.count(OLD_1)}")
    sys.exit(1)

src = src.replace(OLD_1, NEW_1, 1)
print("✅ EDIT 1: detailCat state added")

# ============================================================
# EDIT 2: 📋 button har chip ke saath
# ============================================================
OLD_2 = '''          {cats.map((c) => {
            const isDefault = EXP_CATS.includes(c);
            return (
              <div key={c} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                {chip(cat === c, c, () => { haptic(); setCat(c); })}
                {!isDefault && ('''

NEW_2 = '''          {cats.map((c) => {
            const isDefault = EXP_CATS.includes(c);
            return (
              <div key={c} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                {chip(cat === c, c, () => { haptic(); setCat(c); })}
                <button
                  onClick={(e) => { e.stopPropagation(); setDetailCat(c); }}
                  title={"Details: " + c}
                  style={{
                    width: 20, height: 20, borderRadius: "50%",
                    border: "none", background: C.blue, color: "#fff",
                    fontSize: 9, fontWeight: 900, cursor: "pointer",
                    padding: 0, lineHeight: 1
                  }}
                >📋</button>
                {!isDefault && ('''

if src.count(OLD_2) != 1:
    print(f"❌ EDIT 2: Expected 1 match, found {src.count(OLD_2)}")
    sys.exit(1)

src = src.replace(OLD_2, NEW_2, 1)
print("✅ EDIT 2: 📋 details button added")

# ============================================================
# EDIT 3: Modal + print function add (before return)
# ============================================================
OLD_3 = '''  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Kharcha</h2>'''

NEW_3 = '''  // FEATURE-EXPENSE-DETAILS: category print function
  const printCategoryExpenses = () => {
    if (!detailCat || catExpenses.length === 0) {
      toast("Is category mein koi entry nahi", "warning");
      return;
    }
    const itemsHtml = catExpenses.map(e =>
      `<tr>
        <td style="text-align:left;font-size:11px">${e.date || ""}</td>
        <td style="text-align:left;font-size:11px">${esc(e.note || "-")}</td>
        <td style="text-align:center;font-size:11px">${String(e.mode || "cash").toUpperCase()}</td>
        <td style="text-align:right;font-size:11px">Rs ${Number(e.amount).toFixed(0)}</td>
      </tr>`
    ).join("");
    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const body = `<h2>${esc(RESTAURANT.name)}</h2>
      <div class="c">Kharcha Category: <b>${esc(detailCat)}</b></div>
      <div class="c">${esc(now)}</div>
      <div class="line"></div>
      <table><thead><tr><th>Date</th><th>Note</th><th>Mode</th><th style="text-align:right">Amt</th></tr></thead>
      <tbody>${itemsHtml}</tbody></table>
      <div class="line"></div>
      <table>
        <tr><td>Entries</td><td style="text-align:right"><b>${catExpenses.length}</b></td></tr>
        <tr><td>Average</td><td style="text-align:right">Rs ${catAvg}</td></tr>
        <tr class="grand"><td>TOTAL</td><td style="text-align:right">Rs ${catTotal}</td></tr>
      </table>
      <div class="line"></div>
      <div class="c" style="font-size:10px;margin-top:8px">** Kharcha Report **</div>`;
    printHtml("Expense " + detailCat, body, { css: "@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:290px;margin:0 auto;padding:10px;font-weight:700}h2{text-align:center;font-size:20px;margin:4px 0}.c{text-align:center;font-size:11px}.line{border-top:2px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse;font-size:11px}th{border-bottom:2px solid #000;text-align:left;font-size:11px;padding:4px 2px}td{padding:3px 2px}.grand td{font-size:16px;font-weight:900;border-top:3px solid #000;padding-top:8px}" });
  };

  return (
    <div>
      {detailCat && (
        <ModalShell C={C} open onClose={() => setDetailCat(null)} isMobile={isMobile} title={detailCat} icon="📋" maxWidth={500}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            <div style={{ background: C.cardAlt, padding: 10, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.gray, fontWeight: 800, textTransform: "uppercase" }}>Entries</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, fontFamily: "monospace" }}>{catExpenses.length}</div>
            </div>
            <div style={{ background: C.cardAlt, padding: 10, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.gray, fontWeight: 800, textTransform: "uppercase" }}>Average</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.blue, fontFamily: "monospace" }}>{inr(catAvg)}</div>
            </div>
            <div style={{ background: C.goldLight, padding: 10, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.gray, fontWeight: 800, textTransform: "uppercase" }}>Total</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.goldText, fontFamily: "monospace" }}>{inr(catTotal)}</div>
            </div>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid " + C.line, borderRadius: 8 }}>
            {catExpenses.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.gray, fontSize: 13 }}>Is period mein koi entry nahi</div>}
            {catExpenses.map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: "1px dashed " + C.line }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{e.date}{e.note ? " · " + e.note : ""}</div>
                  <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{String(e.mode || "cash").toUpperCase()}{e.by ? " · " + e.by : ""}</div>
                </div>
                <div style={{ fontWeight: 900, color: C.red, fontFamily: "monospace", fontSize: 13 }}>{inr(e.amount)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => setDetailCat(null)} style={{ flex: 1, padding: 12, border: "1px solid " + C.line, borderRadius: 10, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Band</button>
            <button onClick={printCategoryExpenses} disabled={catExpenses.length === 0} style={{ flex: 1, padding: 12, border: "none", borderRadius: 10, background: catExpenses.length ? C.gold : C.line, color: catExpenses.length ? "#fff" : C.gray, fontWeight: 900, cursor: catExpenses.length ? "pointer" : "not-allowed", fontFamily: "inherit" }}>🖨️ Print</button>
          </div>
        </ModalShell>
      )}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Kharcha</h2>'''

if src.count(OLD_3) != 1:
    print(f"❌ EDIT 3: Expected 1 match, found {src.count(OLD_3)}")
    sys.exit(1)

src = src.replace(OLD_3, NEW_3, 1)
print("✅ EDIT 3: Modal + print function added")

# ============================================================
# Save + Verify
# ============================================================
FILE.write_text(src, encoding="utf-8")
final = FILE.read_text(encoding="utf-8")

if MARKER in final:
    print("✅ Verify: category details code present")
    print(f"📄 File: {len(final)} bytes, {final.count(chr(10))} lines")
else:
    print("❌ Verify fail")
    sys.exit(1)
PYEOF

EXIT=$?
echo ""
echo -e "${BLUE}========================================${NC}"
if [ "$EXIT" -eq 0 ]; then
  echo -e "${GREEN}✅ FEATURE B READY${NC}"
  echo ""
  echo "Ab karo:"
  echo "  1. npm run build   ← PEHLE YE"
  echo "  2. Test: Expenses → category chip pe 📋 button"
  echo "  3. Print button test karo"
else
  echo -e "${RED}❌ PATCH FAIL — file SAFE hai${NC}"
  echo "Revert: rm -rf src && mv ${BACKUP} src"
fi
echo -e "${BLUE}========================================${NC}"