// ============================================================
// projectpatch.js — Eat & Park Staff POS mega patch
// Usage: node projectpatch.js [path/to/StaffApp.jsx]
// Default: src/StaffApp.jsx
// ============================================================
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || 'src/StaffApp.jsx';
if (!fs.existsSync(FILE)) {
  console.error('\n❌ File not found: ' + FILE);
  console.error('   Usage: node projectpatch.js path/to/StaffApp.jsx\n');
  process.exit(1);
}

const SRC = fs.readFileSync(FILE, 'utf8');
const BACKUP = FILE + '.backup.' + Date.now();
fs.writeFileSync(BACKUP, SRC);
console.log('\n📦 Backup: ' + path.relative(process.cwd(), BACKUP) + '\n');

let src = SRC;
const report = [];
let failed = 0;

// ---------- helpers ----------
function apply(name, from, to, optional) {
  if (!src.includes(from)) {
    if (!optional) failed++;
    report.push((optional ? '⚪ ' : '❌ ') + name + (optional ? ' (skipped)' : ' — anchor not found'));
    return;
  }
  src = src.replace(from, to);
  report.push('✅ ' + name);
}
function applyAll(name, from, to) {
  const n = src.split(from).length - 1;
  if (n === 0) { failed++; report.push('❌ ' + name); return; }
  src = src.split(from).join(to);
  report.push('✅ ' + name + ' (' + n + 'x)');
}
function findFunctionBounds(name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const m = src.match(re);
  if (!m) return null;
  const startIdx = m.index;
  let i = startIdx + m[0].length - 1;
  let pd = 1; i++;
  while (i < src.length && pd > 0) {
    if (src[i] === '(') pd++;
    else if (src[i] === ')') pd--;
    i++;
  }
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== '{') return null;
  let depth = 1; i++;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  if (depth !== 0) return null;
  return { start: startIdx, end: i };
}

// ============================================================
// P1 — RESTAURANT.upi + FRESH_MS + toMillis
// ============================================================
apply('P1 UPI + FRESH_MS + toMillis',
  '  gstin: "",\n  upi: "",\n};',
  '  gstin: "",\n  upi: "YOURNAME@upi",\n};\n\n' +
  'const FRESH_MS = 30 * 60 * 1000;\n' +
  'const toMillis = (v) => {\n' +
  '  if (!v) return 0;\n' +
  '  if (typeof v === "number") return v;\n' +
  '  if (v.toMillis) return v.toMillis();\n' +
  '  if (v.seconds) return v.seconds * 1000;\n' +
  '  return 0;\n' +
  '};'
);

// ============================================================
// P-imports — orderBy, limit
// ============================================================
apply('P-imports orderBy+limit',
  'query, where, runTransaction\n} from "firebase/firestore";',
  'query, where, runTransaction, orderBy, limit\n} from "firebase/firestore";'
);

// ============================================================
// P2a — prevNewIdsRef
// ============================================================
apply('P2a prevNewIdsRef',
  '  const [confetti, setConfetti] = useState(false);',
  '  const [confetti, setConfetti] = useState(false);\n  const prevNewIdsRef = useRef(null);'
);

// ============================================================
// P2b — simplify orders onSnapshot (remove buggy ring block)
// ============================================================
apply('P2b simplify onSnapshot',
  [
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
  ].join('\n'),
  '      const newOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));\n      setOrders(newOrders);'
);

// ============================================================
// P2c — sound 30-min window + first-order ring
// ============================================================
apply('P2c sound 30min + interval',
  [
    '  const newCount = orders.filter(o => o.status === "new" && Date.now() - o.createdAt < 6 * 3600 * 1000).length;',
    '  const parcelCount = orders.filter(isOpenParcel).length;',
    '  useEffect(() => {',
    '    document.title = (newCount ? `(${newCount}) ` : "") + "Eat & Park Staff";',
    '    if (!user || newCount === 0) return;',
    '    const iv = setInterval(() => playSound(), 8000);',
    '    return () => clearInterval(iv);',
    '  }, [newCount, user]);'
  ].join('\n'),
  [
    '  const newCount = orders.filter(o => o.status === "new" && toMillis(o.createdAt) > Date.now() - FRESH_MS).length;',
    '  const parcelCount = orders.filter(isOpenParcel).length;',
    '',
    '  useEffect(() => {',
    '    const fresh = orders.filter(o => o.status === "new" && toMillis(o.createdAt) > Date.now() - FRESH_MS);',
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
  ].join('\n')
);

// ============================================================
// P3a — lockRef in BillingView
// ============================================================
apply('P3a lockRef BillingView',
  '  const [payMode, setPayMode] = useState("cash");',
  '  const [payMode, setPayMode] = useState("cash");\n  const lockRef = useRef(false);'
);

// ============================================================
// P3b — handlePlaceOrder guard + table-busy check
// ============================================================
apply('P3b handlePlaceOrder guard',
  '  const handlePlaceOrder = async () => {\n    if (cartItems.length === 0 || placing) return;',
  [
    '  const handlePlaceOrder = async () => {',
    '    if (cartItems.length === 0 || lockRef.current) return;',
    '    if (!existingOrder && !addMoreMode && table !== "parcel") {',
    '      const busy = orders.some(o => isOpenDineIn(o) && Number(o.table) === Number(table));',
    '      if (busy && !window.confirm("Table " + table + " par order chalu hai. Phir bhi naya banayein?")) return;',
    '    }',
    '    lockRef.current = true;'
  ].join('\n')
);

// ============================================================
// P3c — lockRef reset in every finally
// ============================================================
applyAll('P3c finally lockRef reset',
  '} catch (e) { toast(e.message, "error"); } finally { setPlacing(false); }',
  '} catch (e) { toast(e.message, "error"); } finally { lockRef.current = false; setPlacing(false); }'
);

// ============================================================
// P5 — parcel auto-served in handlePaidPrint
// ============================================================
apply('P5 parcel auto-served paid',
  'await updateDoc(doc(db, "orders", existingOrder.id), { paid: true, paymentStatus: "paid", paidAt: Date.now() });',
  'const paidPatch = { paid: true, paymentStatus: "paid", paidAt: Date.now() };\n      if (existingOrder.orderType === "parcel") paidPatch.status = "served";\n      await updateDoc(doc(db, "orders", existingOrder.id), paidPatch);'
);

// ============================================================
// P6 — TableMergeModal busy guard
// ============================================================
apply('P6a merge busy state',
  '  const [selectedId, setSelectedId] = useState("");\n  const otherOrders = allOrders.filter(o => o.id !== primaryOrder.id && isOpenDineIn(o));',
  '  const [selectedId, setSelectedId] = useState("");\n  const [busy, setBusy] = useState(false);\n  const otherOrders = allOrders.filter(o => o.id !== primaryOrder.id && isOpenDineIn(o));'
);
apply('P6b merge guard',
  '  const merge = async () => {\n    if (!selectedId) return;\n    try {\n      const other = allOrders.find(o => o.id === selectedId);',
  '  const merge = async () => {\n    if (!selectedId || busy) return;\n    setBusy(true);\n    try {\n      const other = allOrders.find(o => o.id === selectedId);'
);
apply('P6c merge catch reset',
  '      toast("Merged successfully", "success");\n      onClose();\n    } catch (e) { toast(e.message, "error"); }\n  };',
  '      toast("Merged successfully", "success");\n      onClose();\n    } catch (e) { toast(e.message, "error"); setBusy(false); }\n  };'
);
apply('P6d merge button busy',
  '<button onClick={merge} disabled={!selectedId} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: !selectedId ? "not-allowed" : "pointer" }}>Merge</button>',
  '<button onClick={merge} disabled={!selectedId || busy} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: !selectedId || busy ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{busy ? <Spinner /> : "Merge"}</button>'
);

// ============================================================
// P4 — full OrdersView replace (void + restore + undo + cancelled filter)
// ============================================================
const NEW_ORDERS_VIEW = String.raw`function OrdersView({ C, isMobile, orders, menu, waiterName, isOwner, filter, setFilter, rangeStart, rangeEnd, setOrders, onPaidSuccess, onAddMore, onEditBill }) {
  const toast = useToast();
  const haptic = useHaptic();
  const defaultStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const [openId, setOpenId] = useState(null);
  const payLockRef = useRef(false);
  const [payFor, setPayFor] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const start = rangeStart ?? defaultStart;
  const end = rangeEnd ?? Date.now();
  const rangeAll = orders.filter(o => {
    if (o.createdAt < start || o.createdAt >= end) return false;
    if (filter === "cancelled") return o.status === "cancelled";
    return o.status !== "cancelled";
  });
  const filtered =
    filter === "all" ? rangeAll
    : filter === "active" ? rangeAll.filter(o => o.status !== "served" && !o.paid)
    : filter === "paid" ? rangeAll.filter(o => o.paid)
    : filter === "served" ? rangeAll.filter(o => o.status === "served")
    : filter === "cancelled" ? rangeAll
    : rangeAll.filter(o => o.status === filter);

  const advanceOrder = async (order) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];
    haptic(12);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o));
    try { await updateDoc(doc(db, "orders", order.id), { status: next }); toast("Order → " + STATUS[next].label, "success"); }
    catch (e) {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: order.status } : o));
      toast(e.message, "error");
    }
  };

  const voidOrder = async (o) => {
    if (!isOwner) { toast("Sirf owner delete kar sakta hai", "warning"); return; }
    const label = o.orderType === "parcel" ? "Parcel" : "Table " + o.table;
    if (!window.confirm(label + " - " + inr(o.finalTotal || 0) + (o.paid ? " (PAID)" : "") + "\nDelete karein? Revenue se hat jayega.")) return;
    const reason = window.prompt("Cancel karne ka reason? (zaroori)", "");
    if (reason === null) return;
    if (!reason.trim()) { toast("Reason likhna zaroori hai", "warning"); return; }
    setCancellingId(o.id);
    try {
      await updateDoc(doc(db, "orders", o.id), {
        status: "cancelled", cancelledAt: Date.now(),
        cancelledBy: waiterName || "Staff",
        cancelledReason: reason.trim(),
        voidedWasPaid: !!o.paid,
      });
      logAudit("void_order", { orderId: o.id, total: o.finalTotal || 0, wasPaid: !!o.paid, reason: reason.trim() });
      toast("Order delete ho gaya", "success");
    } catch (e) { toast(e.message, "error"); }
    finally { setCancellingId(null); }
  };

  const restoreOrder = async (o) => {
    if (!isOwner) { toast("Sirf owner restore kar sakta hai", "warning"); return; }
    if (!window.confirm("Is cancelled order ko restore karein?")) return;
    try {
      await updateDoc(doc(db, "orders", o.id), {
        status: o.voidedWasPaid ? "served" : "new",
        cancelledAt: null, cancelledBy: null, cancelledReason: null, voidedWasPaid: null,
        restoredAt: Date.now(), restoredBy: waiterName || "Staff",
      });
      logAudit("restore_order", { orderId: o.id, wasPaid: !!o.voidedWasPaid });
      toast("Order restore ho gaya", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const undoPaid = async (o) => {
    if (!isOwner) { toast("Sirf owner undo kar sakta hai", "warning"); return; }
    if (!window.confirm("Is order ka payment undo karein? (paid -> pending)")) return;
    try {
      await updateDoc(doc(db, "orders", o.id), {
        paid: false, paymentStatus: "pending",
        paidAt: null, paidBy: null, payment: "cash",
        undonePaidAt: Date.now(), undonePaidBy: waiterName || "Staff",
      });
      logAudit("undo_paid", { orderId: o.id, total: o.finalTotal || 0 });
      toast("Payment undo ho gaya", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const markPaidWith = async (order, mode) => {
    if (payLockRef.current) return;
    payLockRef.current = true;
    haptic(30);
    const patch = { paid: true, paymentStatus: "paid", paidAt: Date.now(), paidBy: waiterName || "Staff", payment: mode };
    if (order.orderType === "parcel") patch.status = "served";
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...patch } : o));
    try {
      await updateDoc(doc(db, "orders", order.id), patch);
      toast("Payment received!", "success");
      if (onPaidSuccess) onPaidSuccess();
    } catch (e) {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, paid: false, paymentStatus: "pending" } : o));
      toast(e.message, "error");
    } finally {
      payLockRef.current = false;
    }
  };

  const filterLabel = filter === "cancelled" ? "Cancelled" : filter.charAt(0).toUpperCase() + filter.slice(1);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>{filterLabel} Orders ({filtered.length})</h2>
        {payFor && (
          <ModalShell C={C} open onClose={() => setPayFor(null)} isMobile={isMobile} title="Payment mode" icon="💰" maxWidth={340}>
            <div style={{ fontSize: 13, color: C.gray, marginBottom: 14 }}>{payFor.orderType === "parcel" ? "Parcel" : "Table " + payFor.table} - {inr(payFor.finalTotal || 0)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[["cash", "Cash", C.green], ["upi", "UPI", C.blue], ["card", "Card", C.amber]].map(([m, l, c]) => (
                <button key={m} onClick={() => { const o = payFor; setPayFor(null); markPaidWith(o, m); }} style={{ padding: "14px 4px", border: "none", borderRadius: 10, background: c, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
              ))}
            </div>
          </ModalShell>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", "active", ...STATUS_FLOW, "paid", "cancelled"].map(f => (
            <button key={f} onClick={() => { haptic(); setFilter(f); }} style={{ padding: isMobile ? "6px 10px" : "7px 14px", borderRadius: 20, border: "1px solid " + (filter === f ? C.red : C.line), background: filter === f ? C.red : C.card, color: filter === f ? "#fff" : C.gray, fontWeight: 700, fontSize: isMobile ? 11 : 12, cursor: "pointer", textTransform: "capitalize", fontFamily: "inherit" }}>{f}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile || filter === "all" ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", gap: filter === "all" ? 8 : 12 }}>
        {filtered.map(o => {
          const st = STATUS[o.status] || STATUS.new;
          const stColor = C[st.color] || C.gray;
          const stBg = C[st.color + "Light"] || C.light;
          const isCancelled = o.status === "cancelled";
          const isOpen = filter !== "all" || openId === o.id;
          if (!isOpen && !isCancelled) return (
            <button key={o.id} onClick={() => { haptic(); setOpenId(o.id); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: isMobile ? "9px 10px" : "10px 14px", background: C.card, border: "1px solid " + C.line, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: C.ink }}>
              <span style={{ fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>{o.orderType === "parcel" ? "Parcel" : "T" + o.table}</span>
              <span style={{ fontSize: 11, color: C.gray, whiteSpace: "nowrap" }}>#{o.id?.slice(1,5).toUpperCase()} - {timeAgo(o.createdAt)}</span>
              <span style={{ background: stBg, color: stColor, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>{st.label}</span>
              {o.paid && <span style={{ background: C.greenLight, color: C.green, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>PAID</span>}
              <span style={{ marginLeft: "auto", fontWeight: 900, color: C.red, fontFamily: "monospace", fontSize: 13, whiteSpace: "nowrap" }}>{inr(o.finalTotal || 0)}</span>
              <span style={{ color: C.gray, fontSize: 10 }}>▼</span>
            </button>
          );
          return (
            <div key={o.id} style={{ background: isCancelled ? C.redLight : C.card, border: "1px solid " + (isCancelled ? C.red : C.line), borderRadius: 12, padding: isMobile ? 12 : 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", animation: "fadeIn 0.25s", opacity: isCancelled ? 0.9 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15, color: C.ink }}>{o.orderType === "parcel" ? "Parcel" : "Table " + o.table}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ background: stBg, color: stColor, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{st.label}</span>
                  {filter === "all" && !isCancelled && <button onClick={() => setOpenId(null)} style={{ border: "1px solid " + C.line, background: C.cardAlt, color: C.gray, borderRadius: 8, padding: "3px 9px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>▲</button>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>#{o.id?.slice(1,5).toUpperCase()}</span><span>{timeAgo(o.createdAt)} ago</span>{o.waiter && <span>{o.waiter}</span>}
              </div>
              {isCancelled && (
                <div style={{ background: C.amberLight, color: C.amber, padding: "8px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, marginBottom: 10 }}>
                  Cancelled by {o.cancelledBy || "?"} - {o.cancelledReason || "-"}{o.voidedWasPaid ? " (was PAID)" : ""}
                </div>
              )}
              <div style={{ fontSize: isMobile ? 12 : 13, color: C.ink, lineHeight: 1.6, marginBottom: 10 }}>
                {(o.items || []).map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", gap: 8 }}><span>{it.qty}x {it.name}</span><span style={{ color: C.gray, fontFamily: "monospace", flexShrink: 0 }}>{inr(it.price * it.qty)}</span></div>)}
              </div>
              <div style={{ borderTop: "1px solid " + C.line, paddingTop: 10, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: C.gray, fontWeight: 600 }}>Total</span>
                <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(o.finalTotal || 0)}</span>
              </div>
              {o.paid && <div style={{ background: C.greenLight, color: C.green, padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, marginBottom: 10, textAlign: "center" }}>PAID {o.payment ? "(" + o.payment.toUpperCase() + ")" : ""}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {isCancelled && isOwner && (
                  <button onClick={() => restoreOrder(o)} style={{ padding: "9px", border: "none", borderRadius: 8, background: C.green, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit", gridColumn: "span 2" }}>Restore Order</button>
                )}
                {!isCancelled && o.status !== "served" && <button onClick={() => advanceOrder(o)} style={{ padding: "9px", border: "none", borderRadius: 8, background: stColor, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{o.status === "new" ? "Start" : o.status === "preparing" ? "Ready" : "Serve"}</button>}
                {!isCancelled && !o.paid && <button onClick={() => setPayFor(o)} style={{ padding: "9px", border: "1.5px solid " + C.green, borderRadius: 8, background: "transparent", color: C.green, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Paid</button>}
                {!isCancelled && o.paid && isOwner && <button onClick={() => undoPaid(o)} style={{ padding: "9px", border: "1.5px solid " + C.amber, borderRadius: 8, background: "transparent", color: C.amber, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Undo Paid</button>}
                {!isCancelled && !o.paid && <button onClick={() => onAddMore && onAddMore(o)} style={{ padding: "9px", border: "none", borderRadius: 8, background: C.green, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>+ Add Items</button>}
                {!isCancelled && !o.paid && <button onClick={() => onEditBill && onEditBill(o)} style={{ padding: "9px", border: "none", borderRadius: 8, background: C.red, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Edit Bill</button>}
                {!isCancelled && <button onClick={() => printKOT(o)} style={{ padding: "9px", border: "1.5px solid " + C.blue, borderRadius: 8, background: "transparent", color: C.blue, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>KOT</button>}
                {!isCancelled && <button onClick={() => printBill(o)} style={{ padding: "9px", border: "1.5px solid " + C.red, borderRadius: 8, background: "transparent", color: C.red, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Bill</button>}
                {!isCancelled && <button onClick={() => whatsappBill(o)} style={{ padding: "9px", border: "1.5px solid " + C.green, borderRadius: 8, background: "transparent", color: C.green, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>WhatsApp</button>}
                {!isCancelled && (
                  <button onClick={() => voidOrder(o)} disabled={cancellingId === o.id} style={{ padding: "9px", border: "1.5px solid " + C.gray, borderRadius: 8, background: "transparent", color: C.gray, fontWeight: 800, fontSize: 12, cursor: cancellingId === o.id ? "not-allowed" : "pointer", fontFamily: "inherit", gridColumn: "span 2" }}>{cancellingId === o.id ? "Deleting..." : "Delete Order"}</button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: C.gray }}><div style={{ fontSize: 48, marginBottom: 8 }}>😌</div><div style={{ fontSize: 14, fontWeight: 700 }}>Koi order nahi</div></div>}
      </div>
    </div>
  );
}`;

const ovBounds = findFunctionBounds('OrdersView');
if (ovBounds) {
  src = src.slice(0, ovBounds.start) + NEW_ORDERS_VIEW + src.slice(ovBounds.end);
  report.push('✅ P4 OrdersView full replace');
} else {
  failed++;
  report.push('❌ P4 OrdersView — bounds not found (manual replace karo)');
}

// ============================================================
// P7a — AuditLogView component (insert before ErrorBoundary)
// ============================================================
const AUDIT_COMPONENT = String.raw`
// ===========================================================================
// AUDIT LOG VIEW
// ===========================================================================
function AuditLogView({ C, isMobile }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, "auditLog"), orderBy("at", "desc"), limit(200));
    const unsub = onSnapshot(q, s => {
      setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, e => { console.error(e); setLoading(false); });
    return () => unsub();
  }, []);
  const iconOf = (a) => a === "void_order" ? "🗑" : a === "restore_order" ? "↩" : a === "undo_paid" ? "↺" : a === "due_settled" ? "💰" : a === "table_moved" ? "🔀" : "📝";
  const labelOf = (a) => ({ void_order: "Void", restore_order: "Restore", undo_paid: "Undo Paid", due_settled: "Due Settled", table_moved: "Table Moved", due_created: "Due Created", cancel_order: "Cancel" }[a] || a);
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Audit Log</h2>
      {loading && <div style={{ textAlign: "center", padding: 30 }}><Spinner color={C.red} /></div>}
      {!loading && logs.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.gray }}><div style={{ fontSize: 40, marginBottom: 8 }}>📋</div><div style={{ fontSize: 13, fontWeight: 700 }}>Koi activity nahi</div></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {logs.map(l => (
          <div key={l.id} style={{ background: C.card, border: "1px solid " + C.line, borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 16 }}>{iconOf(l.action)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>{labelOf(l.action)}</div>
                  <div style={{ fontSize: 11, color: C.gray, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.orderId ? "#" + l.orderId.slice(1, 5).toUpperCase() : ""}
                    {l.total ? " - " + inr(l.total) : ""}
                    {l.reason ? ' - "' + l.reason + '"' : ""}
                    {l.table ? " - T" + l.table : ""}
                    {l.wasPaid ? " - was PAID" : ""}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: C.gray, flexShrink: 0 }}>{timeAgo(l.at)} ago</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
`;

apply('P7a AuditLogView component',
  '// ===========================================================================\n// ERROR BOUNDARY',
  AUDIT_COMPONENT + '\n// ===========================================================================\n// ERROR BOUNDARY'
);

// ============================================================
// P7b — tabs array
// ============================================================
apply('P7b tabs array audit',
  '{ id: "inventory", label: "🧾 Saman" },',
  '{ id: "inventory", label: "🧾 Saman" },\n          { id: "audit", label: "📝 Audit" },'
);

// ============================================================
// P7c — sidebar
// ============================================================
apply('P7c sidebar audit',
  '{ id: "inventory", label: "Saman", icon: "🧾" }',
  '{ id: "inventory", label: "Saman", icon: "🧾" }, { id: "audit", label: "Audit Log", icon: "📝" }'
);

// ============================================================
// P7d — content render
// ============================================================
apply('P7d content render audit',
  '{activeTab === "stock" && <StockPanel C={C} isMobile={isMobile} menu={menu} />}',
  '{activeTab === "stock" && <StockPanel C={C} isMobile={isMobile} menu={menu} />}\n        {activeTab === "audit" && <AuditLogView C={C} isMobile={isMobile} />}'
);

// ============================================================
// Write + report
// ============================================================
fs.writeFileSync(FILE, src);

console.log('─────────────── PATCH REPORT ───────────────');
report.forEach(r => console.log(r));
console.log('────────────────────────────────────────────');

if (failed === 0) {
  console.log('\n🎉 All patches applied successfully!');
  console.log('   → Restart dev server: npm run dev');
  console.log('   → Apni UPI ID daalna mat bhoolna (P1 me "YOURNAME@upi")');
  console.log('   → Firestore rules deploy karna zaroori hai\n');
} else {
  console.log('\n⚠️  ' + failed + ' patch(es) failed. File phir bhi update ho gayi hai.');
  console.log('   Baaki changes apply ho gaye. Failed patches manually dekh lo.\n');
  process.exit(2);
}