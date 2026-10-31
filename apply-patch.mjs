import fs from "fs";
const file = process.argv[2];
if (!file) { console.error("usage: node apply-patch.js <path-to-staff-file>"); process.exit(1); }
let src = fs.readFileSync(file, "utf8");
const crlf = src.includes("\r\n");
if (crlf) src = src.replace(/\r\n/g, "\n");
// fs.copyFileSync(file, file + ".bak");
const L = (...a) => a.join("\n");
let ok = 0; const bad = [];
const note = (n, good) => { if (good) { ok++; console.log("OK  ", n); } else { bad.push(n); console.log("SKIP", n, "(anchor not found or already applied)"); } };
function rep(n, a, b, all) {
  const tag = /\/\*(P\d+)\*\//.exec(b); if (tag && src.includes(tag[0])) return note(n, false);
  if (!src.includes(a)) return note(n, false);
  src = all ? src.split(a).join(b) : src.replace(a, () => b);
  note(n, true);
}
function between(n, s, e, b) {
  const tag = /\/\*(P\d+)\*\//.exec(b); if (tag && src.includes(tag[0])) return note(n, false);
  const i = src.indexOf(s); if (i < 0) return note(n, false);
  const j = src.indexOf(e, i); if (j < 0) return note(n, false);
  src = src.slice(0, i) + b + src.slice(j + e.length); note(n, true);
}

// P1 draft: clear draft when cart becomes empty
rep("P1 draft resurrection",
  '  const draftRestoredRef = useRef(false);',
  L('  const draftRestoredRef = useRef(false);',
    '  /*P1*/ useEffect(() => {',
    '    if (existingOrder || addMoreMode || !draftRestoredRef.current) return;',
    '    try { if (Object.keys(cart).length === 0) localStorage.removeItem("staff_draft_" + table); } catch (e) {}',
    '  }, [cart, table, existingOrder, addMoreMode]);'));

// P2 stale/deleted menu items can no longer crash Send KOT
rep("P2 stale cart items",
  '  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);',
  '  /*P2*/ const cartItems = Object.entries(cart).filter(([id, q]) => q > 0 && (menu.some((x) => x.id === id) || existingItems.some((e) => e.itemId === id)));');

// P3 bookings: no state mutation + Confirm updates status
rep("P3a bookings sort",
  '(bookings || []).sort((a,b) => b.createdAt - a.createdAt).map(b => (',
  '[...(bookings || [])].sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)).map(b => (');
rep("P3b booking confirm status",
  '<a href={`https://wa.me/91${b.phone}`} target="_blank" rel="noopener noreferrer" style=',
  '<a href={`https://wa.me/91${b.phone}`} target="_blank" rel="noopener noreferrer" onClick={() => { updateDoc(doc(db, "bookings", b.id), { status: "confirmed", confirmedAt: Date.now() }).catch(() => {}); }} style=');

// P4 waiter-call sound: fix URL + respect mute
rep("P4 call sound",
  'new Audio("https://assets.mixkit.co/active-storage/sfx/951/951-preview.mp3").play().catch(() => {});',
  'if (localStorage.getItem("staff_mute") !== "1") new Audio("https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3").play().catch(() => {});');

// P5 kitchen: age from last KOT, new items bright, old dim, cancelled struck-through
rep("P5a kitchen helper",
  'function KOTView({ C, isMobile, orders, setOrders }) {',
  L('/*P5*/ function kotDisplayItems(o) {',
    '  const kots = o.kots || [];',
    '  const last = kots[kots.length - 1];',
    '  if (kots.length < 2 || !last) return o.items || [];',
    '  const fresh = (last.items || []).map((i) => ({ ...i }));',
    '  const gone = (last.removedItems || []).map((i) => ({ ...i, _cancel: true }));',
    '  const prev = kots.slice(0, -1).flatMap((k) => k.items || []).map((i) => ({ ...i, _old: true }));',
    '  return [...fresh, ...gone, ...prev];',
    '}',
    'function KOTView({ C, isMobile, orders, setOrders }) {'));
rep("P5b kitchen age",
  'const mins = Math.floor((Date.now() - o.createdAt) / 60000);',
  'const mins = Math.floor((Date.now() - (o.lastKotAt || o.createdAt)) / 60000);');
rep("P5c kitchen items",
  '{(o.items || []).map((it, i) => <div key={i} style={{ fontSize: isMobile ? 13 : 15,',
  '{kotDisplayItems(o).map((it, i) => <div key={i} style={{ opacity: it._old ? 0.45 : 1, textDecoration: it._cancel ? "line-through" : "none", fontSize: isMobile ? 13 : 15,');

// P6 merge tables inside a transaction on live data
between("P6 merge transaction",
  'const mb = writeBatch(db);', 'await mb.commit();',
  L('/*P6*/ await runTransaction(db, async (tx) => {',
    '        const pRef = doc(db, "orders", primaryOrder.id), oRef = doc(db, "orders", other.id);',
    '        const [pS, oS] = await Promise.all([tx.get(pRef), tx.get(oRef)]);',
    '        if (!pS.exists() || !oS.exists()) throw new Error("Order ab maujood nahi hai");',
    '        const p = pS.data(), q = oS.data();',
    '        if (p.paid || q.paid || p.status === "cancelled" || q.status === "cancelled") throw new Error("Paid/cancelled order merge nahi ho sakta");',
    '        tx.update(pRef, {',
    '          items: [...(p.items || []), ...(q.items || [])],',
    '          kots: [...(p.kots || []), ...(q.kots || [])],',
    '          subtotal: (Number(p.subtotal) || 0) + (Number(q.subtotal) || 0),',
    '          billDiscount: (Number(p.billDiscount) || 0) + (Number(q.billDiscount) || 0),',
    '          gstAmount: (Number(p.gstAmount) || 0) + (Number(q.gstAmount) || 0),',
    '          finalTotal: (Number(p.finalTotal) || 0) + (Number(q.finalTotal) || 0),',
    '          mergedFrom: [...(p.mergedFrom || []), q.table],',
    '        });',
    '        tx.update(oRef, { status: "cancelled", cancelledAt: Date.now(), cancelledBy: "merge", cancelledReason: "Merged into " + primaryOrder.table, mergedInto: primaryOrder.id });',
    '      });'));

// P7 add-items respects existing discount % and GST %
rep("P7a addedTotals helper",
  'function BillingView(',
  L('/*P7*/ function addedTotals(live, added) {',
    '  const d = Math.round(added * (Number(live.billDiscountPct) || 0) / 100);',
    '  const g = Math.round((added - d) * (Number(live.gstRate) || 0) / 100);',
    '  return { finalTotal: (Number(live.finalTotal) || 0) + added - d + g, billDiscount: (Number(live.billDiscount) || 0) + d, gstAmount: (Number(live.gstAmount) || 0) + g };',
    '}',
    'function BillingView('));
rep("P7b use helper (2 places)",
  'finalTotal: (Number(live.finalTotal) || 0) + addedTotal,',
  '...addedTotals(live, addedTotal),', true);

// P8 print CANCEL slip to kitchen when items are removed
rep("P8 cancel slip",
  'if (newKotItems.length) printKOT({ ...existingOrder, items: newKotItems, kots: [] });',
  L('if (newKotItems.length) printKOT({ ...existingOrder, items: newKotItems, kots: [] });',
    '    /*P8*/ if (removedItems.length) printKOT({ ...existingOrder, items: removedItems.map((i) => ({ ...i, name: "CANCEL >> " + i.name })), kots: [] });'));

// P9 waiter must give a reason to remove sent items (owner exempt)
between("P9 removal reason",
  'if (removedItems.length) logAudit("items_removed"', '.join(", ") });',
  L('/*P9*/ if (removedItems.length) {',
    '      let why = "";',
    '      if (!isOwner) {',
    '        why = (window.prompt("Item hata rahe ho - reason likho (zaroori):", "") || "").trim();',
    '        if (!why) throw new Error("Item hatane ka reason zaroori hai");',
    '      }',
    '      logAudit("items_removed", { orderId: existingOrder.id, table: existingOrder.table || "", reason: why, items: removedItems.map(i => i.qty + "x " + i.name).join(", ") });',
    '    }'));

// P10 disabled staff cannot log in (set active:false on staff doc)
rep("P10a auth listener",
  'if (s.exists()) { setUser(u);', 'if (s.exists() && s.data().active !== false) { setUser(u);');
rep("P10b login",
  'if (!s.exists()) { await signOut(auth); setLoginError("Ye account staff ka nahi hai"); }',
  'if (!s.exists() || s.data().active === false) { await signOut(auth); setLoginError("Ye account staff ka nahi hai ya band hai"); }');

// P11 udhaar needs a vendor
rep("P11 credit needs vendor",
  'await addDoc(collection(db, "expenses"), { date, amount: amt,',
  L('/*P11*/ if (mode === "credit" && !vendorId) { toast("Udhaar ke liye vendor chuno, warna due track nahi hoga", "warning"); return; }',
    '      await addDoc(collection(db, "expenses"), { date, amount: amt,'));

// P12 bulk import: skip bills already imported
rep("P12a import dedupe",
  'for (let i = 0; i < active.length; i += 20) {',
  L('/*P12*/ const seenKeys = new Set();',
    '      try {',
    '        const exSnap = await getDocs(query(collection(db, "expenses"), where("importedFrom", "==", "gemini")));',
    '        exSnap.docs.forEach((d) => { const x = d.data(); seenKeys.add([x.date, Number(x.amount), x.vendorId || "", x.note || ""].join("|")); });',
    '      } catch (e) {}',
    '      const toImport = active.filter((p) => !seenKeys.has([p.date, Number(p.amount), resolveVendorId(p.vendorName, nameToId) || "", (p.note || "") + (p.vendorPhone ? " | " + p.vendorPhone : "")].join("|")));',
    '      imported.skipped = active.length - toImport.length;',
    '      for (let i = 0; i < toImport.length; i += 20) {'));
rep("P12b import chunk", 'const chunk = active.slice(i, i + 20);', 'const chunk = toImport.slice(i, i + 20);');
rep("P12c import toast",
  'imported.vendors + " naye vendor", "success");',
  'imported.vendors + " naye vendor" + (imported.skipped ? ", " + imported.skipped + " duplicate skip" : ""), "success");');

// P13 NEW FEATURE: "food ready" alert for waiters
rep("P13 ready alert",
  '  const parcelCount = orders.filter(isOpenParcel).length;',
  L('  const parcelCount = orders.filter(isOpenParcel).length;',
    '  /*P13*/ const prevReadyRef = useRef(null);',
    '  useEffect(() => {',
    '    const ready = orders.filter((o) => o.status === "ready" && !o.paid && Date.now() - toMillis(o.createdAt) < 18 * 3600 * 1000).map((o) => o.id);',
    '    if (prevReadyRef.current === null) { prevReadyRef.current = ready; return; }',
    '    const prev = new Set(prevReadyRef.current);',
    '    const fresh = orders.filter((o) => ready.includes(o.id) && !prev.has(o.id));',
    '    if (fresh.length) {',
    '      fresh.forEach((o) => toast((o.orderType === "parcel" ? "Parcel" : "Table " + o.table) + " READY - serve karo", "success", { duration: 5000 }));',
    '      haptic(40);',
    '    }',
    '    prevReadyRef.current = ready;',
    '  }, [orders]);'));

if (crlf) src = src.replace(/\n/g, "\r\n");
fs.writeFileSync(file, src);
console.log("\nDone: " + ok + " applied, " + bad.length + " skipped" + (bad.length ? " -> " + bad.join(", ") : ""));