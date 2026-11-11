#!/usr/bin/env bash
# ============================================================
# Eat & Park — Bug Fix Patch Script v1
# Path: /workspaces/eat-and-park-pos/src/
# ============================================================
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; }
info() { echo -e "${BLUE}ℹ️  $*${NC}"; }

# ---------- Sanity ----------
if [ ! -d "src" ]; then
  err "Ye script project root se chalao (jahan 'src/' folder hai). Abhi: $(pwd)"
  exit 1
fi
if ! command -v perl >/dev/null 2>&1; then
  err "perl nahi mila. 'sudo apt install perl' karo."
  exit 1
fi

# ---------- Backup ----------
TS=$(date +%Y%m%d_%H%M%S)
BACKUP="src_backup_${TS}"
info "Backup bana rahe hain: ${BACKUP}/"
cp -r src "$BACKUP"
ok "Backup ready: ${BACKUP}/"
info "Revert: rm -rf src && mv ${BACKUP} src"
echo ""

FAIL=0

# ============================================================
# FIX 1 — recover.js : err.reason.message handle
# ============================================================
FIX_RECOVER() {
  local f="src/recover.js"
  [ -f "$f" ] || { warn "recover.js nahi mila"; return; }
  if grep -q 'reasonMsg' "$f"; then ok "recover.js already patched"; return; fi

  perl -0pi -e 's/function isFirestoreCrash\(err\) \{\s*if \(!err\) return false;\s*const msg = String\(err\.message \|\| \(err\.reason && err\.reason\.message\) \|\| err\);\s*return FS_ERROR_PATTERN\.test\(msg\);\s*\}/function isFirestoreCrash(err) {\n  if (!err) return false;\n  const reasonMsg = err.reason \&\& typeof err.reason === "object" \&\& err.reason.message;\n  const msg = String(err.message || reasonMsg || err.reason || err);\n  return FS_ERROR_PATTERN.test(msg);\n}/s' "$f"

  if grep -q 'reasonMsg' "$f"; then ok "recover.js patched"; else err "recover.js FAIL"; FAIL=1; fi
}

# ============================================================
# FIX 2 — DeliveryApp.jsx : setLoading always + better errors
# ============================================================
FIX_DELIVERY() {
  local f="src/DeliveryApp.jsx"
  [ -f "$f" ] || { warn "DeliveryApp.jsx nahi mila"; return; }

  # FIX 2a: setLoading in finally
  if grep -q 'FIX-LOADING-ALWAYS' "$f"; then
    ok "DeliveryApp loading already patched"
  else
    perl -0pi -e 's/const unsub = onAuthStateChanged\(auth, async \(u\) => \{([\s\S]*?)\n    \}\);/const unsub = onAuthStateChanged(auth, async (u) => {\n      try {$1\n      } finally {\n        setLoading(false); \/\/ FIX-LOADING-ALWAYS\n      }\n    });/s' "$f"
    if grep -q 'FIX-LOADING-ALWAYS' "$f"; then ok "DeliveryApp loading patched"; else err "DeliveryApp loading FAIL"; FAIL=1; fi
  fi

  # FIX 2b: better login error
  if grep -q 'FIX-LOGIN-ERRORS' "$f"; then
    ok "DeliveryApp login-error already patched"
  else
    perl -0pi -e 's/catch \(err\) \{ setLoginError\("Email ya password galat hai\."\); \}/catch (err) {\n      const msg =\n        err.code === "auth\/network-request-failed" ? "Internet check karo" :\n        err.code === "auth\/too-many-requests" ? "Bahut try ho gaye, thodi der baad" :\n        err.code === "auth\/invalid-email" ? "Email format galat hai" :\n        "Email ya password galat hai."; \/\/ FIX-LOGIN-ERRORS\n      setLoginError(msg);\n    }/s' "$f"
    if grep -q 'FIX-LOGIN-ERRORS' "$f"; then ok "DeliveryApp login-error patched"; else warn "DeliveryApp login-error SKIP (pattern mismatch)"; fi
  fi
}

# ============================================================
# FIX 3 — StaffApp.jsx : tryRecover(error) -> tryRecover(err)
# ============================================================
FIX_STAFF_ERRBOUNDARY() {
  local f="src/StaffApp.jsx"
  [ -f "$f" ] || { warn "StaffApp.jsx nahi mila"; return; }
  if grep -q 'tryRecover(err);' "$f"; then ok "StaffApp ErrorBoundary already patched"; return; fi

  perl -0pi -e 's/componentDidCatch\(err, info\) \{\s*tryRecover\(error\);/componentDidCatch(err, info) {\n    tryRecover(err); \/\/ FIX-ERRBOUNDARY/s' "$f"

  if grep -q 'FIX-ERRBOUNDARY' "$f"; then ok "StaffApp ErrorBoundary patched"; else err "StaffApp ErrorBoundary FAIL"; FAIL=1; fi
}

# ============================================================
# FIX 4 — StaffApp.jsx : printKOT CSP-safe
# ============================================================
FIX_STAFF_PRINTKOT() {
  local f="src/StaffApp.jsx"
  [ -f "$f" ] || return
  if grep -q 'CSP-SAFE-PRINTKOT' "$f"; then ok "StaffApp printKOT already patched"; return; fi

  perl -0pi -e 's/function printKOT\(order\) \{[\s\S]*?\n\}\n/function printKOT(order) {\n  \/\/ CSP-SAFE-PRINTKOT\n  try {\n    const itemsHtml = (order.items || []).map(it => `<tr><td style="text-align:left;font-size:14px">${it.qty} x ${esc(it.name)}${it.portion ? ` (${esc(it.portion)})` : ""}<\/td><\/tr>`).join("");\n    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });\n    const iframe = document.createElement("iframe");\n    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";\n    document.body.appendChild(iframe);\n    const w = iframe.contentWindow;\n    const cleanup = () => { setTimeout(() => { try { if (iframe.parentNode) document.body.removeChild(iframe); } catch (e) {} }, 1000); };\n    try { w.addEventListener("afterprint", cleanup); } catch (e) {}\n    setTimeout(cleanup, 90000);\n    w.document.open();\n    w.document.write(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src \x27none\x27; object-src \x27none\x27"><title>KOT<\/title><style>@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:280px;margin:0 auto;padding:10px}h2,h3{text-align:center;margin:4px 0;font-weight:900}h2{font-size:26px}h3{font-size:18px}.c{text-align:center;font-size:12px;font-weight:700}.big{font-size:16px;font-weight:800}<\/style><\/head><body><h2>KOT<\/h2><h3>${order.orderType === "parcel" ? "PARCEL" : "TABLE " + esc(order.table)}<\/h3><div class="c">${now}<\/div><div class="c">#${esc(order.id.slice(1,9).toUpperCase())}<\/div>${order.waiter ? `<div class="c">Waiter: ${esc(order.waiter)}<\/div>` : ""}<div style="border-top:2px solid #000;margin:10px 0"><\/div><table style="width:100%"><tbody>${itemsHtml}<\/tbody><\/table><div style="border-top:2px solid #000;margin:10px 0"><\/div><div class="c big">Total Items: ${(order.items || []).reduce((s, it) => s + it.qty, 0)}<\/div><div class="c" style="margin-top:14px;font-size:11px">- Kitchen Copy -<\/div><\/body><\/html>`);\n    w.document.close();\n    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { alert("Print error: " + e.message); } }, 300);\n  } catch (e) { alert("Print error: " + e.message); }\n}\n/s' "$f"

  if grep -q 'CSP-SAFE-PRINTKOT' "$f"; then ok "StaffApp printKOT patched"; else err "StaffApp printKOT FAIL"; FAIL=1; fi
}

# ============================================================
# FIX 5 — StaffApp.jsx : printBill CSP-safe
# ============================================================
FIX_STAFF_PRINTBILL() {
  local f="src/StaffApp.jsx"
  [ -f "$f" ] || return
  if grep -q 'CSP-SAFE-PRINTBILL' "$f"; then ok "StaffApp printBill already patched"; return; fi

  perl -0pi -e 's/function printBill\(order\) \{[\s\S]*?\n\}\n/function printBill(order) {\n  \/\/ CSP-SAFE-PRINTBILL\n  try {\n    const itemsHtml = (order.items || []).map(it => `<tr><td style="text-align:left">${esc(it.name)}${it.portion ? ` (${esc(it.portion)})` : ""}<\/td><td style="text-align:center">${it.qty}<\/td><td style="text-align:right">Rs ${it.price}<\/td><td style="text-align:right">Rs ${it.price * it.qty}<\/td><\/tr>`).join("");\n    const sub = order.subtotal || (order.items || []).reduce((s, it) => s + it.price * it.qty, 0);\n    const total = order.finalTotal || sub;\n    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });\n    const billNo = esc(order.id.slice(1,9).toUpperCase());\n    const iframe = document.createElement("iframe");\n    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";\n    document.body.appendChild(iframe);\n    const w = iframe.contentWindow;\n    const cleanup = () => { setTimeout(() => { try { if (iframe.parentNode) document.body.removeChild(iframe); } catch (e) {} }, 1000); };\n    try { w.addEventListener("afterprint", cleanup); } catch (e) {}\n    setTimeout(cleanup, 90000);\n    w.document.open();\n    w.document.write(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src \x27none\x27; object-src \x27none\x27"><title>Bill ${billNo}<\/title><style>@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:290px;margin:0 auto;padding:10px;font-weight:700}h2{text-align:center;font-size:24px;font-weight:900;margin:4px 0}.c{text-align:center;font-size:10px}.line{border-top:2px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:4px 2px}th{border-bottom:2px solid #000;text-align:left;font-size:12px}.grand td{font-size:18px;font-weight:900;border-top:3px solid #000;padding-top:8px}.badge{display:inline-block;padding:3px 10px;border:2px solid #000;border-radius:10px;font-size:12px;margin:2px}<\/style><\/head><body><h2>${RESTAURANT.name}<\/h2><div class="c">${RESTAURANT.address}<\/div><div class="c">Ph: ${RESTAURANT.phones.join(" \/ ")}<\/div><div class="line"><\/div><div style="display:flex;justify-content:space-between;font-size:11px"><div>Bill: ${billNo}<\/div><div>${order.orderType === "parcel" ? "PARCEL" : "T-" + esc(order.table)}<\/div><\/div><div class="c" style="margin-top:4px">${now}<\/div>${order.waiter ? `<div class="c">Waiter: ${esc(order.waiter)}<\/div>` : ""}<div class="line"><\/div><table><thead><tr><th>Item<\/th><th style="text-align:center">Qty<\/th><th style="text-align:right">Rate<\/th><th style="text-align:right">Amt<\/th><\/tr><\/thead><tbody>${itemsHtml}<\/tbody><\/table><div class="line"><\/div><table><tr><td>Subtotal<\/td><td style="text-align:right">Rs ${sub}<\/td><\/tr>${order.gstAmount ? `<tr><td>GST<\/td><td style="text-align:right">+Rs ${order.gstAmount}<\/td><\/tr>` : ""}${order.billDiscount ? `<tr><td>Discount<\/td><td style="text-align:right">-Rs ${order.billDiscount}<\/td><\/tr>` : ""}<tr class="grand"><td>GRAND TOTAL<\/td><td style="text-align:right">Rs ${total}<\/td><\/tr><\/table><div class="line"><\/div><div class="c"><span class="badge">${(order.payment || "cash").toUpperCase()}<\/span><span class="badge">${order.paid ? "PAID" : order.payment === "due" ? "DUE" : "PENDING"}<\/span><\/div><div class="c" style="margin-top:10px;font-size:11px">** Thank you, visit again **<\/div><div class="c" style="font-size:10px">Eat \&amp; Park Restaurant<\/div><\/body><\/html>`);\n    w.document.close();\n    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { alert("Print error: " + e.message); } }, 400);\n  } catch (e) { alert("Print error: " + e.message); }\n}\n/s' "$f"

  if grep -q 'CSP-SAFE-PRINTBILL' "$f"; then ok "StaffApp printBill patched"; else err "StaffApp printBill FAIL"; FAIL=1; fi
}

# ============================================================
# FIX 6 — App.jsx : fetchAllData lq/hq actually load
# ============================================================
FIX_APP_FETCH() {
  local f="src/App.jsx"
  [ -f "$f" ] || { warn "App.jsx nahi mila"; return; }
  if grep -q 'FIX-LOYALTY-LOAD' "$f"; then ok "App.jsx fetch already patched"; return; fi

  perl -0pi -e 's/const lq = \{ docs: \[\] \};\s*const users = lq\.docs\.map\(d => d\.data\(\)\);\s*if \(users\.length > 0\) setLoyaltyUsers\(users\);\s*\/\* inventory ab sirf staff login ke baad load hoti hai \*\/\s*const hq = \{ docs: \[\] \};\s*const hist = hq\.docs\.map\(d => d\.data\(\)\);\s*if \(hist\.length > 0\) setCoinHistory\(hist\);/\/\/ FIX-LOYALTY-LOAD\n      try {\n        const [lq, hq] = await Promise.all([\n          getDocs(query(collection(db, "loyaltyUsers"), orderBy("coins", "desc"), limit(300))),\n          getDocs(query(collection(db, "coinHistory"), orderBy("timestamp", "desc"), limit(300))),\n        ]);\n        setLoyaltyUsers(lq.docs.map(d => d.data()));\n        setCoinHistory(hq.docs.map(d => d.data()));\n      } catch (e) {\n        console.warn("Loyalty\/coin history load failed:", e.code, e.message);\n      }/s' "$f"

  if grep -q 'FIX-LOYALTY-LOAD' "$f"; then ok "App.jsx fetch patched"; else err "App.jsx fetch FAIL"; FAIL=1; fi
}

# ============================================================
# FIX 7 — App.jsx : sidebar duplicate Logout + user info
# ============================================================
FIX_APP_SIDEBAR() {
  local f="src/App.jsx"
  [ -f "$f" ] || return
  if grep -q 'SIDEBAR-DEDUP-FIXED' "$f"; then ok "App.jsx sidebar already patched"; return; fi

  perl -0pi -e 's/(<SidebarBtn icon="🚪" text="Logout" onClick=\{handleLogout\} \/>)\s*\{isLoggedIn && \(\s*<div style=\{\{ marginTop: 8, padding: 12, background: COLORS\.paper, borderRadius: 12, textAlign: "center", fontSize: 12, color: COLORS\.textLight, fontWeight: 600 \}\}>\s*👤 \{custName \|\| "Guest"\} · \{custPhone\}\s*<\/div>\s*\)\}\s*<SidebarBtn icon="🚪" text="Logout" onClick=\{handleLogout\} \/>/$1\n              {\/* SIDEBAR-DEDUP-FIXED *\/}/s' "$f"

  if grep -q 'SIDEBAR-DEDUP-FIXED' "$f"; then ok "App.jsx sidebar patched"; else warn "App.jsx sidebar SKIP (pattern mismatch — shayad already clean)"; fi
}

# ============================================================
# FIX 8 — App.jsx : ErrorBoundary duplicate Try Again
# ============================================================
FIX_APP_ERRBOUNDARY() {
  local f="src/App.jsx"
  [ -f "$f" ] || return
  if grep -q 'ERRBOUNDARY-DEDUP-FIXED' "$f"; then ok "App.jsx ErrorBoundary already patched"; return; fi

  perl -0pi -e 's/(<button onClick=\{\(\) => this\.setState\(\{ hasError: false, error: null, errorInfo: null \}\)\}[^>]*>🔄 Try Again<\/button>)\s*<button onClick=\{\(\) => this\.setState\(\{ hasError: false, error: null, errorInfo: null \}\)\}[^>]*>🔄 Try Again<\/button>/$1\n          {\/* ERRBOUNDARY-DEDUP-FIXED *\/}/s' "$f"

  if grep -q 'ERRBOUNDARY-DEDUP-FIXED' "$f"; then ok "App.jsx ErrorBoundary patched"; else warn "App.jsx ErrorBoundary SKIP (pattern mismatch — shayad already clean)"; fi
}

# ============================================================
# RUN ALL
# ============================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Eat & Park — Applying fixes${NC}"
echo -e "${BLUE}  Path: $(pwd)/src${NC}"
echo -e "${BLUE}========================================${NC}\n"

info "1/8 recover.js";              FIX_RECOVER
info "2/8 DeliveryApp.jsx";         FIX_DELIVERY
info "3/8 StaffApp ErrorBoundary";  FIX_STAFF_ERRBOUNDARY
info "4/8 StaffApp printKOT";       FIX_STAFF_PRINTKOT
info "5/8 StaffApp printBill";      FIX_STAFF_PRINTBILL
info "6/8 App.jsx fetchAllData";    FIX_APP_FETCH
info "7/8 App.jsx sidebar dedup";   FIX_APP_SIDEBAR
info "8/8 App.jsx ErrorBoundary";   FIX_APP_ERRBOUNDARY

echo ""
echo -e "${BLUE}========================================${NC}"
if [ "$FAIL" -eq 0 ]; then
  ok "SAB FIXES APPLY HO GAYE!"
  echo ""
  echo "Ab karo:"
  echo "  1. git diff src/"
  echo "  2. npm run build   (ya npm start)"
  echo "  3. Browser mein test karo"
  echo ""
  echo "Kuch toota toh revert:"
  echo "  rm -rf src && mv ${BACKUP} src"
else
  err "KUCH FIXES FAIL — upar dekho"
  echo ""
  echo "Revert: rm -rf src && mv ${BACKUP} src"
fi
echo -e "${BLUE}========================================${NC}"
