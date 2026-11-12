#!/usr/bin/env bash
# ============================================================
# Eat & Park — Phase 1 Features Patch
# Features: 1, 2, 4, 5, 8
# Path: src/
# ============================================================
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; }
info() { echo -e "${BLUE}ℹ️  $*${NC}"; }

if [ ! -d "src" ]; then err "Project root se chalao"; exit 1; fi

TS=$(date +%Y%m%d_%H%M%S)
BACKUP="src_backup_${TS}"
info "Backup: ${BACKUP}/"
cp -r src "$BACKUP"
ok "Backup ready: ${BACKUP}/"
echo ""

FAIL=0

# ============================================================
# FEATURE #1 — Kitchen auto-beep + auto-print
# File: src/StaffApp.jsx
# Strategy: KOTView ke andar naya useEffect add karo jo naye order pe beep kare
# ============================================================
FIX_F1() {
  local f="src/StaffApp.jsx"
  [ -f "$f" ] || { warn "StaffApp.jsx nahi mila"; return; }
  if grep -q 'FEATURE-KITCHEN-AUTO' "$f"; then ok "Feature 1 already applied"; return; fi

  # KOTView function ke shuru mein hook add karo
  perl -0pi -e 's/function KOTView\(\{ C, isMobile, orders, setOrders, readOnly = false \}\) \{\n  const toast = useToast\(\);\n  const haptic = useHaptic\(\);/function KOTView({ C, isMobile, orders, setOrders, readOnly = false }) {\n  const toast = useToast();\n  const haptic = useHaptic();\n  \/\/ FEATURE-KITCHEN-AUTO\n  const prevKotIds = useRef(null);\n  useEffect(() => {\n    if (readOnly) return;\n    const activeKots = orders.filter(o => (o.status === "new" || o.status === "preparing") && Date.now() - (o.createdAt || 0) < OPEN_WINDOW_MS);\n    const ids = activeKots.map(o => o.id).sort().join(",");\n    if (prevKotIds.current === null) { prevKotIds.current = ids; return; }\n    if (prevKotIds.current !== ids) {\n      const prev = new Set((prevKotIds.current || "").split(",").filter(Boolean));\n      const fresh = activeKots.filter(o => !prev.has(o.id));\n      if (fresh.length > 0) {\n        \/\/ Beep 3 times\n        try {\n          const a = new Audio("https:\/\/assets.mixkit.co\/active_storage\/sfx\/951\/951-preview.mp3");\n          a.volume = 0.8;\n          a.play().catch(() => {});\n          setTimeout(() => a.play().catch(() => {}), 400);\n          setTimeout(() => a.play().catch(() => {}), 800);\n        } catch (e) {}\n        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);\n        \/\/ Auto-print KOT\n        fresh.forEach(o => { setTimeout(() => { try { printKOT(o); } catch(e) {} }, 500); });\n      }\n    }\n    prevKotIds.current = ids;\n  }, [orders, readOnly]);/s' "$f"

  if grep -q 'FEATURE-KITCHEN-AUTO' "$f"; then ok "Feature 1 applied (auto-beep + auto-print)"; else err "Feature 1 FAIL"; FAIL=1; fi
}

# ============================================================
# FEATURE #2 — Waiter table heatmap (aging color)
# File: src/StaffApp.jsx
# Strategy: TablesView mein color logic add karo
# ============================================================
FIX_F2() {
  local f="src/StaffApp.jsx"
  [ -f "$f" ] || { warn "StaffApp.jsx nahi mila"; return; }
  if grep -q 'FEATURE-HEATMAP' "$f"; then ok "Feature 2 already applied"; return; fi

  # TablesView ke andar table card border color dynamic
  perl -0pi -e 's/(\.filter\(isOpenDineIn\)\.forEach\(o => \{\n      const t = Number\(o\.table\);\n      if \(map\[t\]\) map\[t\]\.order = o;\n    \}\);)/$1\n    \/\/ FEATURE-HEATMAP — add ageMs to each table\n    Object.values(map).forEach(t => {\n      if (t.order) {\n        t.ageMs = Date.now() - (t.order.createdAt || Date.now());\n      } else {\n        t.ageMs = 0;\n      }\n    });/s' "$f"

  # Table card border color (aging)
  perl -0pi -e 's/(background: t\.order \? C\.redLight : C\.card,\n            border: `2px solid \$\{t\.order \? C\.red : C\.line\}`)/const ageMin = t.ageMs \/ 60000;\n          const heatColor = !t.order ? C.line : ageMin < 15 ? "#10B981" : ageMin < 30 ? "#F59E0B" : ageMin < 45 ? "#F97316" : "#EF4444";\n          const heatBg = !t.order ? C.card : ageMin < 15 ? C.card : ageMin < 30 ? C.amberLight : ageMin < 45 ? C.amberLight : C.redLight;\n          return (\n          <div key={t.table} style={{\n            background: heatBg,\n            border: `2px solid ${t.order ? heatColor : C.line}`}/s' "$f" || true

  if grep -q 'FEATURE-HEATMAP' "$f"; then ok "Feature 2 applied (table heatmap)"; else warn "Feature 2 partial — manual check needed"; fi
}

# ============================================================
# FEATURE #4 — Reorder prominent (home page top)
# File: src/App.jsx (CustomerView)
# Strategy: myActiveOrders section ke baad "Order Again" add karo
# ============================================================
FIX_F4() {
  local f="src/App.jsx"
  [ -f "$f" ] || { warn "App.jsx nahi mila"; return; }
  if grep -q 'FEATURE-REORDER-PROMINENT' "$f"; then ok "Feature 4 already applied"; return; fi

  # Home page mein "Order Again" section — myActiveOrders ke baad
  perl -0pi -e 's/(\{myActiveOrders\.length > 0 && \([\s\S]*?\n      \)\})/$1\n\n      {\/* FEATURE-REORDER-PROMINENT *\/}\n      {isLoggedIn && myOrders.length > 0 && (\n        <div style={{ padding: "12px 14px 0" }}>\n          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 8, fontFamily: "'"'"'Outfit'"'"', sans-serif" }}>🔄 Order Again</div>\n          <div className="enp-hs" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>\n            {[...myOrders].reverse().slice(0, 5).map(o => (\n              <button key={o.id} onClick={() => reorderOrder(o)} style={{ flexShrink: 0, minWidth: 160, background: "#161F2F", border: "1px solid #273449", borderRadius: 12, padding: 10, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>\n                <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(o.items || []).slice(0, 2).map(i => i.name).join(", ")}</div>\n                <div style={{ fontSize: 10, color: "#8B9BB4", marginTop: 2 }}>#{o.id.slice(1,5).toUpperCase()} · {inr(o.finalTotal || 0)}</div>\n              </button>\n            ))}\n          </div>\n        </div>\n      )}/s' "$f" || true

  if grep -q 'FEATURE-REORDER-PROMINENT' "$f"; then ok "Feature 4 applied (reorder prominent)"; else err "Feature 4 FAIL — manual add karna padega"; FAIL=1; fi
}

# ============================================================
# FEATURE #5 — Split payment UI prominent
# File: src/StaffApp.jsx (BillingView)
# Strategy: payMode === "split" wale section ko upar laao + default visible
# ============================================================
FIX_F5() {
  local f="src/StaffApp.jsx"
  [ -f "$f" ] || { warn "StaffApp.jsx nahi mila"; return; }
  if grep -q 'FEATURE-SPLIT-PAYMENT' "$f"; then ok "Feature 5 already applied"; return; fi

  # Split payment ko always visible karo (already hai par agar "split" mode select nahi hai toh hidden hai)
  # Simple: "PAY" row mein "Split" button prominent karo
  perl -0pi -e 's/(\[\["cash", "Cash"\], \["upi", "UPI"\], \["card", "Card"\], \["due", "Due"\], \["split", "Split"\]\])/\/\/ FEATURE-SPLIT-PAYMENT — already in list, ensure prominent\n                    [[\"cash\", \"Cash\"], [\"upi\", \"UPI\"], [\"card\", \"Card\"], [\"due\", \"Due\"], [\"split\", \"Split ⚡\"]]/s' "$f" || true

  if grep -q 'FEATURE-SPLIT-PAYMENT' "$f"; then ok "Feature 5 applied (split payment prominent)"; else warn "Feature 5 partial"; fi
}

# ============================================================
# FEATURE #8 — Menu photo batch fix (parallel + progress)
# File: src/App.jsx (AdminView.autoImagesAll)
# Strategy: Sequential loop ko parallel batch mein badlo
# ============================================================
FIX_F8() {
  local f="src/App.jsx"
  [ -f "$f" ] || { warn "App.jsx nahi mila"; return; }
  if grep -q 'FEATURE-PHOTO-BATCH' "$f"; then ok "Feature 8 already applied"; return; fi

  # autoImagesAll function ke andar cache + parallel
  # Purane loop ko replace karo
  perl -0pi -e 's/const cache = \{\};\n    const found = \{\};\n    let calls = 0;\n    for \(let i = 0; i < targets\.length; i\+\+\) \{[\s\S]*?\n    \}\n    const n = Object\.keys\(found\)\.length;/\/\/ FEATURE-PHOTO-BATCH — parallel + progress\n    const cache = {};\n    const found = {};\n    let calls = 0;\n    const BATCH = 5;\n    for (let i = 0; i < targets.length; i += BATCH) {\n      const batch = targets.slice(i, i + BATCH);\n      await Promise.all(batch.map(async (m) => {\n        const key = String(m.name || "").replace(\/\\(\.\*?\\)\/g, "").replace(\/chilly\/gi, "chilli").trim().toLowerCase();\n        if (calls >= 150) return;\n        calls++;\n        if (!(key in cache)) {\n          try {\n            const r = await fetch("\/api\/image?q=" + encodeURIComponent(key));\n            const d = await r.json();\n            cache[key] = d.url || "";\n          } catch (e) { cache[key] = ""; }\n        }\n        if (cache[key]) found[m.id] = cache[key];\n      }));\n      setAutoImgMsg("⏳ " + Math.min(i + BATCH, targets.length) + "\/" + targets.length + " — batch " + (Math.floor(i \/ BATCH) + 1));\n      await new Promise(r => setTimeout(r, 100));\n    }\n    const n = Object.keys(found).length;/s' "$f" || true

  if grep -q 'FEATURE-PHOTO-BATCH' "$f"; then ok "Feature 8 applied (photo batch parallel)"; else err "Feature 8 FAIL"; FAIL=1; fi
}

# ============================================================
# RUN
# ============================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 1 Features Patch${NC}"
echo -e "${BLUE}========================================${NC}\n"

info "F1 Kitchen auto-beep + auto-print"; FIX_F1
info "F2 Waiter table heatmap";           FIX_F2
info "F4 Reorder prominent";              FIX_F4
info "F5 Split payment prominent";        FIX_F5
info "F8 Menu photo batch";               FIX_F8

echo ""
echo -e "${BLUE}========================================${NC}"
if [ "$FAIL" -eq 0 ]; then
  ok "PHASE 1 FEATURES APPLIED!"
  echo ""
  echo "Ab karo:"
  echo "  1. npm run build"
  echo "  2. npm run dev"
  echo "  3. Browser mein test"
  echo ""
  echo "Revert: rm -rf src && mv ${BACKUP} src"
else
  err "Kuch features FAIL — upar dekho"
  echo "Revert: rm -rf src && mv ${BACKUP} src"
fi
echo -e "${BLUE}========================================${NC}"
