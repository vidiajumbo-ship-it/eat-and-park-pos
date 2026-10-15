// hardening.js — drop-in fixes for Eat & Park POS V15 (React + Firestore)
// Import what you need into your main file and delete the old versions.
import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

/* ───────────── 1. Input / data normalisation ───────────── */
export const MAX_QTY = 99;
export const TABLE_COUNT = 12; // use everywhere instead of hardcoded 12

export const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
export const clampQty = (q) => Math.min(MAX_QTY, Math.max(0, Math.round(num(q) * 100) / 100));

// FIX: phone was used raw as a Firestore doc id. "123/456" made doc() throw
// synchronously inside useEffect and crashed the whole customer screen.
export const cleanPhone = (p) => String(p || "").replace(/\D/g, "").slice(-10);
export const isValidPhone = (p) => /^[6-9]\d{9}$/.test(p);

// FIX: createdAt could be missing / Timestamp / string -> toISOString() threw RangeError
// and one bad doc blanked the Admin dashboard.
export const toMillis = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v.toMillis === "function") return v.toMillis();
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
};
export const toLocalISODate = (ts) => {
  const t = toMillis(ts);
  if (!t) return "";
  const d = new Date(t);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
};
export const normOrder = (d) => {
  const raw = d.data() || {};
  return {
    ...raw,
    id: d.id,
    createdAt: toMillis(raw.createdAt),
    items: (Array.isArray(raw.items) ? raw.items : []).map((it) => ({
      ...it, price: num(it.price), qty: num(it.qty),
    })),
    customer: raw.customer || { name: "", phone: "" },
  };
};

// FIX: CSV formula injection (=cmd|...) when opened in Excel
export const csvCell = (c) => {
  const s = String(c ?? "");
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
};

/* ───────────── 2. Business day (orders vanished at midnight) ───────────── */
// FIX: query used midnight, so a served-but-unpaid table ("billing") dropped off the
// board at 00:00 while the app only reloads at 05:00. Use the same 5am cutoff.
export function businessDayStart(now = new Date(), startHour = 5) {
  const d = new Date(now);
  d.setHours(startHour, 0, 0, 0);
  if (d > now) d.setDate(d.getDate() - 1);
  return d.getTime();
}

/* ───────────── 3. Orders: atomic, idempotent, stale-safe ───────────── */
// FIX: old version did getDoc() then setDoc() and swallowed getDoc errors. After a
// timed-out write that actually landed, a retry overwrote an order the kitchen had
// already advanced. Transaction = create only if it doesn't exist.
export async function setOrderOnce(order) {
  const ref = doc(db, "orders", order.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) tx.set(ref, order);
  });
}

// FIX: advanceStatus trusted the *clicked* status. A stale tablet could push an order
// from "ready" back to "preparing". Now it aborts if the server status moved on.
export async function advanceStatusSafe(orderId, expected, STATUS_FLOW) {
  const i = STATUS_FLOW.indexOf(expected);
  if (i < 0) return { ok: false, reason: "invalid" };
  const next = STATUS_FLOW[Math.min(i + 1, STATUS_FLOW.length - 1)];
  if (next === expected) return { ok: false, reason: "final" };
  const ref = doc(db, "orders", orderId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return { ok: false, reason: "missing" };
    const cur = snap.data();
    if (cur.status === "cancelled") return { ok: false, reason: "cancelled" };
    if (cur.status !== expected) return { ok: false, reason: "stale", current: cur.status };
    const patch = { status: next };
    if (next === "served") patch.servedAt = Date.now();
    if (cur.kots?.length) patch.kots = cur.kots.map((k) => (k.status === expected ? { ...k, status: next } : k));
    tx.update(ref, patch);
    return { ok: true, next };
  });
}
// Caller: remove the optimistic setOrdersState, or roll it back when ok === false
// (the snapshot will NOT re-fire if the server doc didn't change).

// FIX: item-count comparison missed price/qty edits (lost updates between two devices).
// Use a revision counter bumped ONLY by item-affecting writers (bill save, running KOT).
export async function guardedOrderUpdate(base, patch) {
  const ref = doc(db, "orders", base.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Order nahi mila");
    const cur = snap.data();
    if ((cur.rev || 0) !== (base.rev || 0)) {
      throw new Error("Ye order kisi aur ne abhi badla hai. Bill band karke dobara kholo.");
    }
    tx.update(ref, { ...patch, rev: (cur.rev || 0) + 1 });
  });
}
// Also add `rev: (cur.rev||0)+1` to addRunningItems' tx.update.

// FIX: customer cancel was only hidden in the UI; kitchen could already be cooking.
export async function cancelOrderIfNew(orderId, by = "customer") {
  const ref = doc(db, "orders", orderId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Order not found");
    if (snap.data().status !== "new") throw new Error("Kitchen ne order shuru kar diya hai — staff se cancel karwao.");
    tx.update(ref, { status: "cancelled", cancelledAt: Date.now(), cancelledBy: by });
  });
}

/* ───────────── 4. Loyalty: ledger inside the transaction ───────────── */
// FIX: coinHistory was written AFTER the transaction from stale local state:
//  - ledger could differ from the balance actually applied
//  - double tap = duplicate history rows
// Deterministic doc ids make this idempotent.
export async function markPaidSafe(orderId, paid, loyaltyRate, getOrderTotal) {
  await runTransaction(db, async (tx) => {
    const oref = doc(db, "orders", orderId);
    const osnap = await tx.get(oref);
    if (!osnap.exists()) throw new Error("Order not found");
    const o = osnap.data();
    if (o.status === "cancelled") throw new Error("Order cancelled hai");

    if (!paid) { tx.update(oref, { paid: false }); return; }
    if (o.coinsClaimed) { tx.update(oref, { paid: true }); return; }

    const phone = cleanPhone(o.customer?.phone);
    const earned = Math.floor(getOrderTotal(o) / (Number(loyaltyRate) || 10));
    const used = Math.max(0, num(o.rewardUsedCoins));

    let usnap = null;
    const uref = isValidPhone(phone) ? doc(db, "loyaltyUsers", phone) : null;
    if (uref && (earned || used)) usnap = await tx.get(uref); // all reads before writes

    if (uref && usnap) {
      const next = Math.max(0, num(usnap.exists() ? usnap.data().coins : 0) + earned - used);
      if (usnap.exists()) tx.update(uref, { coins: next });
      else tx.set(uref, { phone, name: o.customer?.name || "Guest", coins: next });
      const ts = Date.now();
      const tag = orderId.slice(1, 5).toUpperCase();
      if (earned > 0) tx.set(doc(db, "coinHistory", orderId + "_earn"), { phone, coins: earned, reason: `Order #${tag}`, timestamp: ts });
      if (used > 0) tx.set(doc(db, "coinHistory", orderId + "_use"), { phone, coins: -used, reason: `Redeemed #${tag}`, timestamp: ts });
    }
    tx.update(oref, { paid: true, coinsClaimed: true });
  });
}

/* ───────────── 5. Menu: no more whole-menu overwrite from stale state ───────────── */
// FIX: every add/edit wrote the full `items` array from the caller's local copy, so two
// devices (admin + waiter) silently erased each other's changes, and a swallowed error
// still showed "✅ Dish added". Also refuses to save an empty menu.
// Strip the runtime-only `available` flag (menuEff adds it) before saving.
export async function updateMenuAtomic(mutator) {
  const ref = doc(db, "settings", "menu");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
    const next = mutator(cur);
    if (!Array.isArray(next) || next.length === 0) throw new Error("Refusing to save an empty menu");
    tx.set(ref, { items: next });
    return next;
  });
}
// Usage: await updateMenuAtomic((items) => [newDish, ...items]);
// Long term: one doc per dish in a `menu` collection (1 MB doc limit, no write races).

/* ───────────── 6. Razorpay: promise that can never hang ───────────── */
// FIX: `new Promise(async ...)` swallowed any throw (e.g. new Razorpay() failing) and the
// promise never settled -> isProcessingPayment stuck forever. Script was also appended
// again on every call while the first load was pending.
let rzpLoader = null;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (!rzpLoader) {
    rzpLoader = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => { rzpLoader = null; resolve(false); };
      document.body.appendChild(s);
    });
  }
  return rzpLoader;
}
export async function payWithRazorpay({ key, amount, orderId, name, desc, prefill, color }) {
  if (!key || key.startsWith("YOUR_")) throw new Error("Razorpay key configure nahi hai");
  if (!(await loadRazorpay()) || !window.Razorpay) throw new Error("Payment gateway load nahi hua");
  return new Promise((resolve, reject) => {
    try {
      const rzp = new window.Razorpay({
        key, amount: Math.round(amount * 100), currency: "INR", name,
        description: desc, order_id: undefined, // TODO: create order server-side and pass order_id
        prefill, theme: { color },
        handler: resolve,
        modal: { ondismiss: () => resolve(null) },
      });
      rzp.on("payment.failed", () => resolve(null));
      rzp.open();
    } catch (e) { reject(e); }
  });
}
// NOTE: the client can never prove a payment happened. Verify razorpay_signature in a
// Cloud Function / API route before setting paid=true. Today it is "paid_unverified".

/* ───────────── 7. AI order: validate everything the model returns ───────────── */
// FIX: BillPOS.applyAi did `next[i].qty + line.qty` -> string concat if qty came as "2";
// WaiterOrderPanel could push NaN into the cart; CustomerView accepted qty = 1e9.
export function sanitizeAiLines(data, menu) {
  const byId = new Map((menu || []).map((m) => [m.id, m]));
  const items = [];
  for (const l of Array.isArray(data?.items) ? data.items : []) {
    const m = byId.get(l?.id);
    const qty = Math.round(num(l?.qty));
    if (!m || !m.available || qty < 1) continue;
    items.push({ id: m.id, qty: Math.min(qty, MAX_QTY) });
  }
  const t = Math.round(num(data?.table));
  return {
    items,
    orderType: data?.orderType === "parcel" ? "parcel" : "dine_in",
    table: t >= 1 && t <= TABLE_COUNT ? t : null,
    notes: String(data?.notes || "").slice(0, 200),
    unmatched: (Array.isArray(data?.unmatched) ? data.unmatched : []).slice(0, 10).map(String),
  };
}
// FIX: fetch had no timeout; a hung API froze the modal and applied the order after close.
export async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}
// Also: abort in a useEffect cleanup when the modal unmounts, and stop SpeechRecognition there.

/* ───────────── 8. Snippets to paste into the main file ───────────── */
/*
// (a) CustomerView loyalty effect — no crash on weird phone input
useEffect(() => {
  const p = cleanPhone(custPhone);
  if (!isValidPhone(p)) { setMyLoyalty(null); return; }
  let off = false;
  getDoc(doc(db, "loyaltyUsers", p))
    .then((s) => { if (!off) setMyLoyalty(s.exists() ? s.data() : null); })
    .catch(() => {});
  return () => { off = true; };
}, [custPhone]);

// (b) App auth listener — ignore out-of-order async results
useEffect(() => {
  let seq = 0;
  const unsub = onAuthStateChanged(auth, async (u) => {
    const my = ++seq;
    setAuthUser(u);
    if (u && !u.isAnonymous) {
      let role = null;
      try { const s = await getDoc(doc(db, "staff", u.uid)); role = s.exists() ? (s.data().role || "staff") : null; } catch (e) {}
      if (my !== seq) return;            // a newer auth event won
      setStaffRole(role);
    } else setStaffRole(null);
  });
  return unsub;
}, []);

// (c) Admin: select state must follow the live categories, not the CATEGORIES constant
const [addMenuCat, setAddMenuCat] = useState("");
const effectiveCat = categories.includes(addMenuCat) ? addMenuCat : categories[0] || "";
// use effectiveCat for <select value> and for saving

// (d) Admin settings writes: always merge, never overwrite the whole appSettings doc
await setDoc(doc(db, "settings", "appSettings"), { heroImage: url }, { merge: true });

// (e) Double-submit guard for bookings / order buttons
const submittingRef = useRef(false);
const handleBooking = async () => {
  if (submittingRef.current) return;
  submittingRef.current = true;
  try { ... } finally { submittingRef.current = false; }
};
*/

/* ───────────── 9. Dark mode without breaking position:fixed ───────────── */
// FIX: `.dark-theme { filter: invert(...) }` makes the wrapper the containing block for
// every position:fixed child (modals, cart bar, FABs scroll with the page) and is very
// heavy on phones. Use CSS variables instead:
export const THEME_CSS = `
:root{--bg:#FAFAF8;--ink:#1A1A1A;--card:#fff;--line:#E8E6DC}
:root[data-theme="dark"]{--bg:#121212;--ink:#F2F2F2;--card:#1E1E1E;--line:#333}
body{background:var(--bg);color:var(--ink)}
`;
// toggle with document.documentElement.dataset.theme = isDark ? "dark" : "light"
