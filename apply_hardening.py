#!/usr/bin/env python3
"""
apply_hardening.py — Eat & Park POS: hardening.js ke fixes App.jsx me auto-apply karta hai.

Usage (repo root me, jahan hardening.js aur ye script rakhe ho):
    python3 apply_hardening.py src/App.jsx --dry-run     # sirf check, kuch change nahi
    python3 apply_hardening.py src/App.jsx               # Tier-1 (safe) patches
    python3 apply_hardening.py src/App.jsx --all         # Tier-1 + Tier-2 (Firestore rules check karke)

- Pehle backup banta hai (App.jsx.bak.<time>)
- Har patch exact text match se lagta hai. Match nahi mila to skip + report (file corrupt nahi hogi)
- Dobara chalane par "already applied" dikhayega (idempotent)
"""
import argparse
import shutil
import sys
import time
from pathlib import Path

IMPORT_ANCHOR = "import { QRCodeSVG } from 'qrcode.react';"
IMPORT_LINE = 'import * as HX from "./hardening";'

PATCHES = []


def P(name, old, new, count=1, tier=1):
    PATCHES.append(dict(name=name, old=old, new=new, count=count, tier=tier))


# ───────────────────────── TIER 1 (safe) ─────────────────────────
P("import hardening helpers", IMPORT_ANCHOR, IMPORT_ANCHOR + "\n" + IMPORT_LINE)

P("normOrder -> HX.normOrder (bad createdAt/items crash fix)",
  r'''const normOrder = (d) => {''',
  r'''const normOrder = HX.normOrder;
const normOrderLegacy = (d) => {''')

P("toLocalISODate -> safe version (RangeError fix)",
  r'''function toLocalISODate(timestamp) {''',
  r'''const toLocalISODate = HX.toLocalISODate;
function toLocalISODateLegacy(timestamp) {''')

P("phone crash fix (loyalty effect) 1/2",
  r'''if (!custPhone || custPhone.length < 10) { setMyLoyalty(null); return; }''',
  r'''const _p = HX.cleanPhone(custPhone);
    if (!HX.isValidPhone(_p)) { setMyLoyalty(null); return; }''')

P("phone crash fix (loyalty effect) 2/2",
  r'''getDoc(doc(db, "loyaltyUsers", custPhone))''',
  r'''getDoc(doc(db, "loyaltyUsers", _p))''')

P("Admin category select init (newItemCat)",
  r'''const [newItemCat, setNewItemCat] = useState(CATEGORIES[0]);''',
  r'''const [newItemCat, setNewItemCat] = useState((categories && categories[0]) || CATEGORIES[0]);''')

P("Admin category select init (addMenuCat)",
  r'''const [addMenuCat, setAddMenuCat] = useState(CATEGORIES[0]);''',
  r'''const [addMenuCat, setAddMenuCat] = useState((categories && categories[0]) || CATEGORIES[0]);''')

P("appSettings merge (wallpaper upload)",
  r'''await setDoc(doc(db, "settings", "appSettings"), newSettings);''',
  r'''await setDoc(doc(db, "settings", "appSettings"), { heroImage: url }, { merge: true });''')

P("appSettings merge (hero URL save)",
  r'''await setDoc(doc(db, "settings", "appSettings"), n);''',
  r'''await setDoc(doc(db, "settings", "appSettings"), { heroImage: heroImgInput.trim() }, { merge: true });''')

P("CSV formula-injection guard",
  r'''String(c).replace(/"/g, '""')''',
  r'''String(HX.csvCell(c)).replace(/"/g, '""')''')

P("Razorpay: rename legacy (hang-prone async executor)",
  r'''const processRazorpayPayment = (amount, orderId, customerName, customerPhone) =>''',
  r'''const processRazorpayPaymentLegacy = (amount, orderId, customerName, customerPhone) =>''')

_NEW_RZP = r'''const processRazorpayPayment = async (amount, orderId, customerName, customerPhone) => {
  try {
    return await HX.payWithRazorpay({
      key: RAZORPAY_KEY, amount, orderId, name: RESTAURANT.name,
      desc: `Order #${orderId.slice(1, 5).toUpperCase()}`,
      prefill: { name: customerName, contact: customerPhone }, color: COLORS.copper
    });
  } catch (e) { alert("⚠️ " + (e.message || e)); return null; }
};
'''
_RZP_ANCHOR = r'''const loadRazorpayScriptOld = () => new Promise((resolve) => {'''
P("Razorpay: never-hanging replacement", _RZP_ANCHOR, _NEW_RZP + _RZP_ANCHOR)

P("advanceStatus: stale-status guard",
  r'''if (cur.status === "cancelled") return;''',
  r'''if (cur.status === "cancelled") return;
        if (cur.status !== currentStatus) throw new Error("STALE_STATUS"); // another screen already moved it''')

P("advanceStatus: rollback optimistic update on failure",
  r'''catch (e) { console.error(e); alert("⚠️ Status update fail hua. Dobara try karo."); }''',
  r'''catch (e) {
      console.error(e);
      setOrdersState(prev => prev.map(o => (o.id === orderId ? { ...o, status: currentStatus, ...(order?.kots ? { kots: order.kots } : {}) } : o)));
      alert(String(e && e.message).includes("STALE_STATUS") ? "⚠️ Ye order kisi aur screen se pehle hi aage badh chuka hai." : "⚠️ Status update fail hua. Dobara try karo.");
    }''')

P("business day cutoff 5am (tables vanishing at midnight)",
  r'''startOfToday.setHours(0, 0, 0, 0);''',
  r'''startOfToday.setTime(HX.businessDayStart());''')

P("AI order: sanitize (customer/waiter modal)",
  r'''onOrderParsed(data);''',
  r'''onOrderParsed(HX.sanitizeAiLines(data, menu));''')

P("AI order: sanitize (BillPOS)",
  r'''setAiRes(data);''',
  r'''setAiRes(HX.sanitizeAiLines(data, menu));''')

P("AI order: fetch timeout (both places)",
  r'''await fetch("/api/parse-order", {''',
  r'''await HX.fetchWithTimeout("/api/parse-order", {''', count=2)

# ───────────────────────── TIER 2 (Firestore rules check karo) ─────────────────────────
# Ye patches transactions / naya `rev` field use karte hain. Agar tumhare rules
# customers ko missing doc `get` ya extra fields likhne se rokte hain to order place/save fail hoga.
P("setOrderOnce -> transactional create-only",
  r'''async function setOrderOnce(order) {''',
  r'''const setOrderOnce = HX.setOrderOnce;
async function setOrderOnceLegacy(order) {''', tier=2)

P("guardedOrderUpdate -> rev counter",
  r'''async function guardedOrderUpdate(base, patch) {''',
  r'''const guardedOrderUpdate = HX.guardedOrderUpdate;
async function guardedOrderUpdateLegacy(base, patch) {''', tier=2)

P("rev bump in customer running-KOT (pairs with rev guard)",
  r'''...runningPatch(o, taggedItems),''',
  r'''...runningPatch(o, taggedItems),
          rev: (o.rev || 0) + 1,''', tier=2)

P("customer cancel only while status is new",
  r'''await updateDoc(doc(db, "orders", orderId), { status: "cancelled", cancelledAt: Date.now() });''',
  r'''await HX.cancelOrderIfNew(orderId);''', tier=2)

P("customer cancel: show real error",
  r'''catch (e) { showToast("⚠️ Failed to cancel", 'error'); }''',
  r'''catch (e) { showToast("⚠️ " + ((e && e.message) || "Failed to cancel"), 'error'); }''', tier=2)

_NEW_MARK = r'''const markPaid = async (orderId, paid) => {
    try {
      await HX.markPaidSafe(orderId, paid, loyaltyRules?.rate, getOrderTotal);
      setOrdersState(prev => prev.map(o => (o.id === orderId ? { ...o, paid, coinsClaimed: paid ? true : o.coinsClaimed } : o)));
      if (staffRole === "admin") {
        getDocs(query(collection(db, "loyaltyUsers"), orderBy("coins", "desc"), limit(300)))
          .then(q => setLoyaltyUsers(q.docs.map(d => d.data()))).catch(() => {});
      }
    } catch (e) {
      console.error("markPaid error:", e);
      alert("⚠️ Payment update failed: " + (e.message || "unknown"));
    }
  };
  const markPaidLegacy = async (orderId, paid) => {'''
P("markPaid: ledger inside transaction (idempotent)",
  r'''const markPaid = async (orderId, paid) => {''', _NEW_MARK, tier=2)


# ───────────────────────── runner ─────────────────────────
def locate(arg):
    if arg:
        p = Path(arg)
        if p.exists():
            return p
        sys.exit(f"❌ File nahi mili: {arg}")
    for c in ("src/App.jsx", "src/App.js"):
        if Path(c).exists():
            return Path(c)
    sys.exit("❌ App file nahi mili. Path do: python3 apply_hardening.py src/App.jsx")


def balance(t):
    return (t.count("{") - t.count("}"), t.count("(") - t.count(")"), t.count("[") - t.count("]"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?")
    ap.add_argument("--all", action="store_true", help="Tier-2 patches bhi lagao")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    target = locate(a.file)
    dest = target.parent / "hardening.js"
    if not dest.exists():
        for src in (Path(__file__).resolve().parent / "hardening.js", Path.cwd() / "hardening.js"):
            if src.exists():
                if not a.dry_run:
                    shutil.copy(src, dest)
                print(f"📄 hardening.js -> {dest}")
                break
        else:
            sys.exit("❌ hardening.js nahi mili. Isse script ke saath rakho ya src/ me daalo.")

    text = target.read_text(encoding="utf-8", newline="")
    before = balance(text)
    applied, already, failed, skipped = [], [], [], []

    for p in PATCHES:
        if p["tier"] == 2 and not a.all:
            skipped.append(p["name"])
            continue
        if p["new"] in text:
            already.append(p["name"])
            continue
        n = text.count(p["old"])
        if n != p["count"]:
            failed.append(f'{p["name"]}  (mila {n}, chahiye {p["count"]})')
            continue
        text = text.replace(p["old"], p["new"])
        applied.append(p["name"])

    if IMPORT_LINE not in text:
        sys.exit("❌ Import patch fail hua — kuch bhi write nahi kiya. File me QRCodeSVG import line check karo.")

    after = balance(text)
    if after != before:
        sys.exit(f"❌ Bracket balance badal gaya {before} -> {after}. Kuch write nahi kiya.")

    print("\n✅ Applied:")
    for x in applied: print("   +", x)
    if already:
        print("\n↺ Already applied:")
        for x in already: print("   =", x)
    if skipped:
        print("\n⏭  Skipped (Tier-2, --all se lagenge):")
        for x in skipped: print("   -", x)
    if failed:
        print("\n⚠️  Match nahi hua (file ka text alag hai — manual dekho):")
        for x in failed: print("   !", x)

    if a.dry_run:
        print("\n(dry-run: kuch write nahi hua)")
        return
    if not applied:
        print("\nKuch naya apply nahi hua.")
        return

    bak = target.with_name(f"{target.name}.bak.{int(time.time())}")
    shutil.copy(target, bak)
    target.write_text(text, encoding="utf-8", newline="")
    print(f"\n💾 Saved: {target}   (backup: {bak.name})")
    print("Ab chalao:  npm start   (ya)  npm run build   — aur  git diff  se review karo.")
    print("Undo:       git checkout -- " + str(target))


if __name__ == "__main__":
    main()
