// ============================================================
// patch.js — Staff POS mega patch
// Usage: node patch.js path/to/StaffApp.jsx
// ============================================================
const fs = require('fs');

const FILE = process.argv[2] || process.env.FILE || 'src/StaffApp.jsx';
if (!fs.existsSync(FILE)) {
  console.error('\n❌ File not found: ' + FILE);
  console.error('   Usage: node patch.js path/to/StaffApp.jsx\n');
  process.exit(1);
}

const SRC = fs.readFileSync(FILE, 'utf8');
const BACKUP = FILE + '.backup.' + Date.now();
fs.writeFileSync(BACKUP, SRC);
console.log('📦 Backup: ' + BACKUP + '\n');

let src = SRC;
const report = [];

// ---- helpers ----
const L = (...lines) => lines.join('\n');

function apply(name, from, to) {
  if (!src.includes(from)) { report.push('❌ ' + name + ' — anchor not found'); return; }
  src = src.replace(from, to);
  report.push('✅ ' + name);
}

function applyAll(name, from, to) {
  const n = src.split(from).length - 1;
  if (n === 0) { report.push('❌ ' + name + ' — 0 occurrences'); return; }
  src = src.split(from).join(to);
  report.push('✅ ' + name + ' (' + n + 'x)');
}

// ============================================================
// P1: UPI + FRESH_MS + toMillis
// ============================================================
apply('P1 RESTAURANT.upi + helpers',
  L(
    '  gstin: "",',
    '  upi: "",',
    '};'
  ),
  L(
    '  gstin: "",',
    '  upi: "YOURNAME@upi",',
    '};',
    '',
    'const FRESH_MS = 30 * 60 * 1000;',
    'const toMillis = (v) => {',
    '  if (!v) return 0;',
    '  if (typeof v === "number") return v;',
    '  if (v.toMillis) return v.toMillis();',
    '  if (v.seconds) return v.seconds * 1000;',
    '  return 0;',
    '};'
  )
);

// ============================================================
// P2a: prevNewIdsRef declaration
// ============================================================
apply('P2a prevNewIdsRef ref',
  '  const [confetti, setConfetti] = useState(false);',
  L(
    '  const [confetti, setConfetti] = useState(false);',
    '  const prevNewIdsRef = useRef(null);'
  )
);

// ============================================================
// P2b: simplify orders onSnapshot (remove buggy ring block)
// ============================================================
apply('P2b simplify orders onSnapshot',
  L(
    '      const newOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));',
    '      setOrders(prev => {',
    '        if (prev.length > 0) {',
    '          const prevIds = new Set(prev.map(o => o.id));',
    '          const newOnes = newOrders.filter(o => !prevIds.has(o.id) && o.status === "new" && o.createdBy !== auth.currentUser?.uid && o.createdAt >= startToday.getTime());',
    '          if (newOnes.length > 0) {',
    '            playSound();',
    '            newOnes.forEach(o => {',
    '              if (typeof Notification !== "undefined" && Notification.permission === "granted") {',
    '                try { new Notification("New Order", { body: `Table ${o.table} - ${inr(o.finalTotal || 0)}` }); } catch(e) {}',
    '              }',
    '            });',
    '          }',
    '        }',
    '        return newOrders;',
    '      });'
  ),
  L(
    '      const newOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));',
    '      setOrders(newOrders);'
  )
);

// ============================================================
// P2c: sound effect 30-min + interval fix
// ============================================================
apply('P2c sound effect + interval',
  L(
    '  const newCount = orders.filter(o => o.status === "new" && Date.now() - o.createdAt < 6 * 3600 * 1000).length;',
    '  const parcelCount = orders.filter(isOpenParcel).length;',
    '  useEffect(() => {',
    '    document.title = (newCount ? `(${newCount}) ` : "") + "Eat & Park Staff";',
    '    if (!user || newCount === 0) return;',
    '    const iv = setInterval(() => playSound(), 8000);',
    '    return () => clearInterval(iv);',
    '  }, [newCount, user]);'
  ),
  L(
    '  const newCount = orders.filter(o => o.status === "new" && toMillis(o.createdAt) > Date.now() - FRESH_MS).length;',
    '  const parcelCount = orders.filter(isOpenParcel).length;',
    '',
    '  useEffect(() => {',
    '    const now = Date.now();',
    '    const fresh = orders.filter(o => o.status === "new" && toMillis(o.createdAt) > now - FRESH_MS);',
    '    const freshIds = fresh.map(o => o.id);',
    '    if (prevNewIdsRef.current === null) { prevNewIdsRef.current = freshIds; return; }',
    '    const prevSet = new Set(prevNewIdsRef.current);',
    '    const hasNew = freshIds.some(id => !prevSet.has(id));',
    '    if (hasNew) {',
    '      playSound();',
    '      fresh.forEach(o => {',
    '        if (prevSet.has(o.id)) return;',
    '        if (typeof Notification !== "undefined" && Notification.permission === "granted") {',
    '          try { new Notification("New Order", { body: (o.orderType === "parcel" ? "Parcel" : "Table " + o.table) + " - " + inr(o.finalTotal || 0) }); } catch (e) {}',
    '        }',
    '      });',
    '    }',
    '    prevNewIdsRef.current = freshIds;',
    '  }, [orders]);',
    '',
    '  useEffect(() => {',
    '    document.title = (newCount ? "(" + newCount + ") " : "") + "Eat & Park Staff";',
    '    if (!user || newCount === 0) return;',
    '    const iv = setInterval(() => playSound(), 8000);',
    '    return () => clearInterval(iv);',
    '  }, [newCount, user]);'
  )
);

// ============================================================
// P3a: lockRef in BillingView
// ============================================================
apply('P3a lockRef in BillingView',
  '  const [payMode, setPayMode] = useState("cash");',
  L(
    '  const [payMode, setPayMode] = useState("cash");',
    '  const lockRef = useRef(false);'
  )
);

// ============================================================
// P3b: handlePlaceOrder guard + lock
// ============================================================
apply('P3b handlePlaceOrder guard',
  L(
    '  const handlePlaceOrder = async () => {',
    '    if (cartItems.length === 0 || placing) return;'
  ),
  L(
    '  const handlePlaceOrder = async () => {',
    '    if (cartItems.length === 0 || lockRef.current) return;',
    '    if (!existingOrder && !addMoreMode && table !== "parcel") {',
    '      const busy = orders.some(o => isOpenDineIn(o) && Number(o.table) === Number(table));',
    '      if (busy && !window.confirm("Table " + table + " par order chalu hai. Phir bhi naya banayein?")) return;',
    '    }',
    '    lockRef.current = true;'
  )
);

// ============================================================
// P3c: reset lockRef in ALL finally blocks
// ============================================================
applyAll('P3c finally lockRef reset',
  '} catch (e) { toast(e.message, "error"); } finally { setPlacing(false); }',
  '} catch (e) { toast(e.message, "error"); } finally { lockRef.current = false; setPlacing(false); }'
);

// ============================================================
// P4a: OrdersView filter array + cancelled
// ============================================================
apply('P4a filter array cancelled',
  '{["all", "active", ...STATUS_FLOW, "paid"].map(f => (',
  '{["all", "active", ...STATUS_FLOW, "paid", "cancelled"].map(f => ('
);

// ============================================================
// P4b: rangeAll + filtered cancelled support
// ============================================================
apply('P4b rangeAll cancelled support',
  L(
    '  const rangeAll = orders.filter(o => o.status !== "cancelled" && o.createdAt >= start && o.createdAt < end);',
    '  const filtered =',
    '    filter === "all" ? rangeAll',
    '    : filter === "active" ? rangeAll.filter(o => o.status !== "served" && !o.paid)',
    '    : filter === "paid" ? rangeAll.filter(o => o.paid)',
    '    : filter === "served" ? rangeAll.filter(o => o.status === "served")',
    '    : rangeAll.filter(o => o.status === filter);'
  ),
  L(
    '  const rangeAll = orders.filter(o => {',
    '    if (o.createdAt < start || o.createdAt >= end) return false;',
    '    if (filter === "cancelled") return o.status === "cancelled";',
    '    return o.status !== "cancelled";',
    '  });',
    '  const filtered =',
    '    filter === "all" ? rangeAll',
    '    : filter === "active" ? rangeAll.filter(o => o.status !== "served" && !o.paid)',
    '    : filter === "paid" ? rangeAll.filter(o => o.paid)',
    '    : filter === "served" ? rangeAll.filter(o => o.status === "served")',
    '    : filter === "cancelled" ? rangeAll',
    '    : rangeAll.filter(o => o.status === filter);'
  )
);

// ============================================================
// P4c: markPaidWith rewrite + voidOrder/restoreOrder/undoPaid
// ============================================================
apply('P4c void/restore/undo + markPaidWith',
  L(
    '  const [payFor, setPayFor] = useState(null);',
    '  const markPaid = (order) => setPayFor(order);',
    '  const markPaidWith = async (order, mode) => {',
    '    /* confirm ab modal se hota hai */',
    '    haptic(30);',
    '    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, paid: true, paymentStatus: "paid", paidAt: Date.now(), paidBy: waiterName || "Staff", payment: mode } : o));',
    '    try {',
    '      await updateDoc(doc(db, "orders", order.id), { paid: true, paymentStatus: "paid", paidAt: Date.now(), paidBy: waiterName || "Staff", payment: mode });',
    '      toast("Payment received!", "success");',
    '      if (onPaidSuccess) onPaidSuccess();',
    '    } catch (e) {',
    '      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, paid: false, paymentStatus: "pending" } : o));',
    '      toast(e.message, "error");',
    '    }',
    '  };',
    '',
    '  const filterLabel = filter.charAt(0).toUpperCase() + filter.slice(1);'
  ),
  L(
    '  const [payFor, setPayFor] = useState(null);',
    '  const payLockRef = useRef(false);',
    '  const [cancellingId, setCancellingId] = useState(null);',
    '  const markPaid = (order) => setPayFor(order);',
    '',
    '  const markPaidWith = async (order, mode) => {',
    '    if (payLockRef.current) return;',
    '    payLockRef.current = true;',
    '    haptic(30);',
    '    const paidPatch = { paid: true, paymentStatus: "paid", paidAt: Date.now(), paidBy: waiterName || "Staff", payment: mode };',
    '    if (order.orderType === "parcel") paidPatch.status = "served";',
    '    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...paidPatch } : o));',
    '    try {',
    '      await updateDoc(doc(db, "orders", order.id), paidPatch);',
    '      toast("Payment received!", "success");',
    '      if (onPaidSuccess) onPaidSuccess();',
    '    } catch (e) {',
    '      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, paid: false, paymentStatus: "pending" } : o));',
    '      toast(e.message, "error");',
    '    } finally {',
    '      payLockRef.current = false;',
    '    }',
    '  };',
    '',
    '  const voidOrder = async (o) => {',
    '    if (!isOwner) { toast("Sirf owner delete kar sakta hai", "warning"); return; }',
    '    const label = o.orderType === "parcel" ? "Parcel" : "Table " + o.table;',
    '    if (!window.confirm(label + " · " + inr(o.finalTotal || 0) + (o.paid ? " (PAID)" : "") + " — delete? Revenue se hat jayega.")) return;',
    '    const reason = window.prompt("Cancel karne ka reason? (zaroori)", "");',
    '    if (reason === null) return;',
    '    if (!reason.trim()) { toast("Reason likhna zaroori hai", "warning"); return; }',
    '    setCancellingId(o.id);',
    '    try {',
    '      await updateDoc(doc(db, "orders", o.id), {',
    '        status: "cancelled", cancelledAt: Date.now(),',
    '        cancelledBy: waiterName || "Staff",',
    '