#!/usr/bin/env python3
# PATCH 4 (sab kuch ek me):
#   1. Kharcha (Expenses) tab  - roz ka kharcha, category, cash/UPI/bank
#   2. Reports tab             - Profit/Loss, Excel download (multi-sheet), PDF/Print, WhatsApp
#   3. Day Close               - cash gin ke match, din ka hisab Firestore me save
#   4. Billing: Favourite quick-add (top 8 bikne wale) + item rate editable (sirf owner)
#   5. Tables: 60 min se zyada baithe table par timer
#   6. Merge Table atomic (writeBatch) + Saman tab par low-stock badge
#
# Usage:  python3 patch_staff4.py src/StaffApp.jsx
# Patch 1/2/3 lagi ho ya na ho - ye dono me chalta hai.

import sys, shutil, datetime

if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    src = f.read()

applied = 0
skipped = 0


def sub(name, old, new, count=1):
    global src, applied, skipped
    if new in src:
        print("PEHLE SE", name)
        return
    n = src.count(old)
    if n == count:
        src = src.replace(old, new)
        applied += 1
        print("OK    ", name)
    else:
        skipped += 1
        print("SKIP  ", name, "(%d jagah mila, %d chahiye)" % (n, count))


BLOCK = r'''
// ===========================================================================
// KHARCHA (EXPENSES) + REPORTS / P&L + DAY CLOSE   (patch 4)
// Firestore collections: expenses/{id}, dayClose/{YYYY-MM-DD}
// ===========================================================================
const EXP_CATS = ["Saman / Kaccha maal", "Salary", "Kiraya", "Gas / Coyla", "Bijli / Pani", "Repair", "Packing", "Marketing", "Anya"];
const goldOf = (C) => C.gold || C.red;
const goldTextOf = (C) => C.goldText || C.red;
const rs = (n) => "Rs " + (Number(n) || 0).toLocaleString("en-IN");
const xmlEsc = (s) => String(s === null || s === undefined ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Multi-sheet Excel file (SpreadsheetML) - koi library nahi chahiye
function downloadXls(filename, sheets) {
  const body = sheets.map((sh) => {
    const name = xmlEsc(String(sh.name).replace(/[\\/?*\[\]:]/g, " ").slice(0, 31));
    const rows = sh.rows.map((r) => "<Row>" + r.map((c) => {
      const isNum = typeof c === "number" && isFinite(c);
      return '<Cell><Data ss:Type="' + (isNum ? "Number" : "String") + '">' + xmlEsc(c) + "</Data></Cell>";
    }).join("") + "</Row>").join("");
    return '<Worksheet ss:Name="' + name + '"><Table>' + rows + "</Table></Worksheet>";
  }).join("");
  const xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' + body + "</Workbook>";
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const loadOrdersRange = async (fromKey, toKey) => {
  const start = new Date(fromKey + "T00:00:00").getTime();
  const end = new Date(toKey + "T00:00:00").getTime() + 86400000;
  const snap = await getDocs(query(collection(db, "orders"), where("createdAt", ">=", start), where("createdAt", "<", end)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
const loadExpensesRange = async (fromKey, toKey) => {
  const snap = await getDocs(query(collection(db, "expenses"), where("date", ">=", fromKey), where("date", "<=", toKey)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

function calcStats(orders, expenses) {
  const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const valid = orders.filter((o) => o.status !== "cancelled");
  const paid = valid.filter((o) => o.paid);
  const duePending = sum(valid.filter((o) => o.paymentStatus === "due" && !o.paid), (o) => o.finalTotal);
  const revenue = sum(paid, (o) => o.finalTotal);
  const pay = { cash: 0, upi: 0, card: 0 };
  paid.forEach((o) => { const m = String(o.payment || "cash").toLowerCase(); pay[m] = (pay[m] || 0) + (Number(o.finalTotal) || 0); });
  const expTotal = sum(expenses, (e) => e.amount);
  const expByCat = {};
  expenses.forEach((e) => { const c = e.category || "Anya"; expByCat[c] = (expByCat[c] || 0) + (Number(e.amount) || 0); });
  const catRows = Object.entries(expByCat).sort((a, b) => b[1] - a[1]);
  const saman = sum(expenses.filter((e) => /saman|maal/i.test(e.category || "")), (e) => e.amount);
  const profit = revenue - expTotal;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const dayMap = {};
  const dayOf = (k) => { if (!dayMap[k]) dayMap[k] = { date: k, orders: 0, revenue: 0, expense: 0 }; return dayMap[k]; };
  valid.forEach((o) => { const d = dayOf(invDateKey(new Date(o.createdAt || 0))); d.orders++; if (o.paid) d.revenue += Number(o.finalTotal) || 0; });
  expenses.forEach((e) => { if (e.date) dayOf(e.date).expense += Number(e.amount) || 0; });
  const daily = Object.values(dayMap).sort((a, b) => (a.date < b.date ? -1 : 1)).map((d) => ({ ...d, profit: d.revenue - d.expense }));
  const itemMap = {};
  paid.forEach((o) => (o.items || []).forEach((it) => {
    const k = it.name + (it.portion ? " (" + it.portion + ")" : "");
    if (!itemMap[k]) itemMap[k] = { name: k, qty: 0, amt: 0 };
    itemMap[k].qty += Number(it.qty) || 0;
    itemMap[k].amt += (Number(it.price) || 0) * (Number(it.qty) || 0);
  }));
  const items = Object.values(itemMap).sort((a, b) => b.amt - a.amt);
  const wMap = {};
  paid.forEach((o) => { const w = o.waiter || "Staff"; if (!wMap[w]) wMap[w] = { name: w, orders: 0, amt: 0 }; wMap[w].orders++; wMap[w].amt += Number(o.finalTotal) || 0; });
  const waiters = Object.values(wMap).sort((a, b) => b.amt - a.amt);
  return {
    valid, paid, revenue, pay, duePending, expTotal, catRows, saman, profit, margin, daily, items, waiters,
    cancelled: orders.length - valid.length,
    avg: paid.length ? Math.round(revenue / paid.length) : 0,
    discount: sum(paid, (o) => o.billDiscount),
    gst: sum(paid, (o) => o.gstAmount),
  };
}

function StatCard({ C, isMobile, label, value, color, sub }) {
  return (
    <div style={{ background: C.card, border: "1px solid " + C.line, borderRadius: 14, padding: isMobile ? 12 : 18 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: isMobile ? 17 : 26, fontWeight: 900, color, fontFamily: "monospace", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray, fontWeight: 700, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KHARCHA (EXPENSES) TAB
// ---------------------------------------------------------------------------
function ExpensesView({ C, isMobile, isOwner, waiterName }) {
  const toast = useToast();
  const haptic = useHaptic();
  const G = goldOf(C);
  const GT = goldTextOf(C);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return invDateKey(d); });
  const [to, setTo] = useState(invDateKey());
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState(EXP_CATS[0]);
  const [mode, setMode] = useState("cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(invDateKey());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const a = from <= to ? from : to;
    const b = from <= to ? to : from;
    const unsub = onSnapshot(
      query(collection(db, "expenses"), where("date", ">=", a), where("date", "<=", b)),
      (snap) => {
        setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => (x.date === y.date ? (y.createdAt || 0) - (x.createdAt || 0) : x.date < y.date ? 1 : -1)));
        setLoading(false);
      },
      (e) => { setLoading(false); toast("Kharcha load nahi hua: " + e.message, "error"); }
    );
    return () => unsub();
  }, [from, to]);

  const total = list.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const byCat = {};
  list.forEach((e) => { byCat[e.category || "Anya"] = (byCat[e.category || "Anya"] || 0) + (Number(e.amount) || 0); });

  const save = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) { toast("Sahi amount likho", "warning"); return; }
    if (saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "expenses"), { date, amount: amt, category: cat, mode, note: note.trim(), by: waiterName || "Staff", createdAt: Date.now() });
      logAudit("expense_added", { total: amt, reason: cat + (note.trim() ? " - " + note.trim() : "") });
      haptic(25);
      toast("Kharcha save ho gaya: " + inr(amt), "success");
      setAmount(""); setNote("");
    } catch (e) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const remove = async (e) => {
    if (!isOwner) { toast("Sirf owner kharcha delete kar sakta hai", "warning"); return; }
    if (!window.confirm(e.category + " - " + inr(e.amount) + " delete karein?")) return;
    try {
      await deleteDoc(doc(db, "expenses", e.id));
      logAudit("expense_deleted", { total: Number(e.amount) || 0, reason: (e.category || "") + (e.note ? " - " + e.note : "") });
      toast("Delete ho gaya", "success");
    } catch (err) { toast(err.message, "error"); }
  };

  const chip = (active, label, onClick, key) => (
    <button key={key || label} onClick={onClick} style={{ padding: "7px 13px", borderRadius: 20, border: "1px solid " + (active ? G : C.line), background: active ? G : C.card, color: active ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}</button>
  );
  const field = { width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1.5px solid " + C.line, borderRadius: 10, fontSize: 15, background: C.card, color: C.ink, outline: "none", fontFamily: "inherit" };
  const lbl = { fontSize: 11, fontWeight: 800, color: C.gray, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Kharcha</h2>
        <div style={{ fontSize: 12, color: C.gray, fontWeight: 700, marginTop: 2 }}>Roz ka kharcha yahan likho - P&amp;L report isi se banti hai</div>
      </div>

      <div style={{ background: C.card, border: "1px solid " + C.line, borderRadius: 14, padding: isMobile ? 12 : 18, marginBottom: 16 }}>
        <div style={lbl}>Amount (Rs)</div>
        <input type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={{ ...field, fontSize: 22, fontWeight: 900, fontFamily: "monospace", marginBottom: 12 }} />
        <div style={lbl}>Category</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{EXP_CATS.map((c) => chip(cat === c, c, () => { haptic(); setCat(c); }))}</div>
        <div style={lbl}>Kaise diya</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{[["cash", "Cash"], ["upi", "UPI"], ["bank", "Bank"]].map(([id, l]) => chip(mode === id, l, () => setMode(id), id))}</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div><div style={lbl}>Note (optional)</div><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Jaise: paneer 5kg, Ramesh" style={field} /></div>
          <div><div style={lbl}>Date</div><input type="date" value={date} max={invDateKey()} onChange={(e) => e.target.value && setDate(e.target.value)} style={field} /></div>
        </div>
        <button onClick={save} disabled={saving} style={{ width: "100%", padding: 14, border: "none", borderRadius: 10, background: "linear-gradient(135deg, " + G + " 0%, " + (C.goldDark || G) + " 100%)", color: "#fff", fontWeight: 900, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{saving ? <Spinner /> : "Kharcha Save Karo"}</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {chip(false, "Aaj", () => { setFrom(invDateKey()); setTo(invDateKey()); })}
        {chip(false, "Is mahine", () => { const d = new Date(); d.setDate(1); setFrom(invDateKey(d)); setTo(invDateKey()); })}
        <input type="date" value={from} max={invDateKey()} onChange={(e) => e.target.value && setFrom(e.target.value)} style={{ ...field, width: "auto", padding: "7px 10px", fontSize: 13 }} />
        <span style={{ color: C.gray, fontSize: 12, fontWeight: 800 }}>se</span>
        <input type="date" value={to} max={invDateKey()} onChange={(e) => e.target.value && setTo(e.target.value)} style={{ ...field, width: "auto", padding: "7px 10px", fontSize: 13 }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card, border: "1px solid " + C.line, borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.gray, textTransform: "uppercase" }}>Kul kharcha ({list.length})</span>
        <span style={{ fontSize: 20, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(total)}</span>
      </div>
      {Object.keys(byCat).length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
            <span key={c} style={{ background: C.cardAlt, color: C.ink, padding: "5px 10px", borderRadius: 14, fontSize: 11, fontWeight: 800 }}>{c}: <span style={{ color: GT, fontFamily: "monospace" }}>{inr(v)}</span></span>
          ))}
        </div>
      )}

      {loading && <div style={{ textAlign: "center", padding: 24 }}><Spinner color={G} /></div>}
      {!loading && list.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.gray, fontSize: 13, fontWeight: 700 }}>Is period me koi kharcha nahi</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.card, border: "1px solid " + C.line, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: C.ink }}>{e.category}{e.note ? <span style={{ color: C.gray, fontWeight: 600 }}> - {e.note}</span> : ""}</div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{e.date} - {String(e.mode || "cash").toUpperCase()}{e.by ? " - " + e.by : ""}</div>
            </div>
            <div style={{ fontWeight: 900, color: C.red, fontFamily: "monospace", fontSize: 15, flexShrink: 0 }}>{inr(e.amount)}</div>
            {isOwner && <button onClick={() => remove(e)} style={{ border: "none", background: "transparent", color: C.gray, fontSize: 16, cursor: "pointer", padding: 4 }}>x</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// REPORTS: PROFIT / LOSS + DOWNLOAD + DAY CLOSE
// ---------------------------------------------------------------------------
function ReportsView({ C, isMobile, isOwner, waiterName }) {
  const toast = useToast();
  const haptic = useHaptic();
  const G = goldOf(C);
  const GT = goldTextOf(C);
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return invDateKey(d); });
  const [to, setTo] = useState(invDateKey());
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [closes, setCloses] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const a = from <= to ? from : to;
      const b = from <= to ? to : from;
      const [o, e] = await Promise.all([loadOrdersRange(a, b), loadExpensesRange(a, b)]);
      setOrders(o);
      setExpenses(e);
    } catch (err) { toast("Report load nahi hui: " + err.message, "error"); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { if (isOwner) load(); }, [load, isOwner]);

  useEffect(() => {
    if (!isOwner) return;
    const unsub = onSnapshot(query(collection(db, "dayClose"), orderBy("date", "desc"), limit(15)),
      (s) => setCloses(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    return () => unsub();
  }, [isOwner]);

  const stats = useMemo(() => calcStats(orders, expenses), [orders, expenses]);
  const rangeLabel = from === to ? from : from + " se " + to;
  const todayKey = invDateKey();
  const isTodayOnly = from === todayKey && to === todayKey;

  const setRange = (p) => {
    haptic();
    setPreset(p);
    const now = new Date();
    const k = (d) => invDateKey(d);
    if (p === "today") { setFrom(k(now)); setTo(k(now)); }
    else if (p === "yesterday") { const d = new Date(now); d.setDate(d.getDate() - 1); setFrom(k(d)); setTo(k(d)); }
    else if (p === "7days") { const d = new Date(now); d.setDate(d.getDate() - 6); setFrom(k(d)); setTo(k(now)); }
    else if (p === "month") { setFrom(k(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(k(now)); }
    else if (p === "lastmonth") { setFrom(k(new Date(now.getFullYear(), now.getMonth() - 1, 1))); setTo(k(new Date(now.getFullYear(), now.getMonth(), 0))); }
  };

  const downloadExcel = () => {
    const s = stats;
    const ordRows = [...orders].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map((o) => [
      (o.id || "").slice(1, 9).toUpperCase(), new Date(o.createdAt || 0).toLocaleString("en-IN"), o.orderType || "", o.table || "", o.waiter || "",
      (o.items || []).map((it) => it.qty + "x " + it.name).join("; "), Number(o.subtotal) || 0, Number(o.billDiscount) || 0, Number(o.gstAmount) || 0,
      Number(o.finalTotal) || 0, o.payment || "", o.status === "cancelled" ? "Cancelled" : o.paymentStatus === "due" && !o.paid ? "Due" : o.paid ? "Paid" : "Pending",
    ]);
    downloadXls("EatPark-PnL-" + from + "_" + to + ".xls", [
      { name: "Summary", rows: [
        [RESTAURANT.name + " - Profit & Loss"], ["Period", rangeLabel], [],
        ["Revenue (paid)", s.revenue], ["Kharcha", s.expTotal], ["Net Profit", s.profit], ["Margin %", Math.round(s.margin * 10) / 10], [],
        ["Orders (cancelled nahi)", s.valid.length], ["Paid orders", s.paid.length], ["Avg bill", s.avg], ["Discount diya", s.discount], ["GST", s.gst],
        ["Due baaki", s.duePending], ["Cancelled orders", s.cancelled], [],
        ["Cash", s.pay.cash], ["UPI", s.pay.upi], ["Card", s.pay.card],
      ] },
      { name: "Daily", rows: [["Date", "Orders", "Revenue", "Kharcha", "Profit"], ...s.daily.map((d) => [d.date, d.orders, d.revenue, d.expense, d.profit])] },
      { name: "Kharcha Category", rows: [["Category", "Amount"], ...s.catRows.map(([c, v]) => [c, v])] },
      { name: "Items", rows: [["Item", "Qty", "Amount"], ...s.items.map((i) => [i.name, i.qty, i.amt])] },
      { name: "Waiters", rows: [["Waiter", "Orders", "Amount"], ...s.waiters.map((w) => [w.name, w.orders, w.amt])] },
      { name: "Kharcha", rows: [["Date", "Category", "Amount", "Mode", "Note", "By"], ...[...expenses].sort((a, b) => (a.date < b.date ? -1 : 1)).map((e) => [e.date || "", e.category || "", Number(e.amount) || 0, e.mode || "cash", e.note || "", e.by || ""])] },
      { name: "Orders", rows: [["Bill", "Date", "Type", "Table", "Waiter", "Items", "Subtotal", "Discount", "GST", "Total", "Payment", "Status"], ...ordRows] },
    ]);
    toast("Excel download ho rahi hai", "success");
  };

  const printPnl = () => {
    const s = stats;
    const row = (k, v, b) => "<tr><td>" + (b ? "<b>" + k + "</b>" : k) + "</td><td style='text-align:right'>" + (b ? "<b>" + v + "</b>" : v) + "</td></tr>";
    const body = "<h1>" + esc(RESTAURANT.name) + "</h1><div class='sub'>Profit &amp; Loss - " + esc(rangeLabel) + "</div>" +
      "<table>" + row("Revenue (paid)", rs(s.revenue)) + row("Kharcha", rs(s.expTotal)) + row(s.profit >= 0 ? "NET PROFIT" : "NET LOSS", rs(Math.abs(s.profit)), true) + row("Margin", (Math.round(s.margin * 10) / 10) + "%") + "</table>" +
      "<h3>Payment</h3><table>" + row("Cash", rs(s.pay.cash)) + row("UPI", rs(s.pay.upi)) + row("Card", rs(s.pay.card)) + row("Due baaki", rs(s.duePending)) + row("Discount diya", rs(s.discount)) + row("GST", rs(s.gst)) + "</table>" +
      "<h3>Kharcha (category)</h3><table>" + (s.catRows.map(([c, v]) => row(esc(c), rs(v))).join("") || row("-", "-")) + "</table>" +
      "<h3>Daily</h3><table><tr><th>Date</th><th>Orders</th><th>Revenue</th><th>Kharcha</th><th>Profit</th></tr>" + s.daily.map((d) => "<tr><td>" + d.date + "</td><td>" + d.orders + "</td><td>" + rs(d.revenue) + "</td><td>" + rs(d.expense) + "</td><td>" + (d.profit < 0 ? "-" : "") + rs(Math.abs(d.profit)) + "</td></tr>").join("") + "</table>" +
      "<h3>Top 10 items</h3><table><tr><th>Item</th><th>Qty</th><th>Amount</th></tr>" + s.items.slice(0, 10).map((i) => "<tr><td>" + esc(i.name) + "</td><td>" + i.qty + "</td><td>" + rs(i.amt) + "</td></tr>").join("") + "</table>" +
      "<div class='sub' style='margin-top:14px'>Generated " + new Date().toLocaleString("en-IN") + "</div>";
    const css = "@page{margin:14mm}*{color:#000}body{font-family:Arial,sans-serif;font-size:12px;margin:0}h1{margin:0;font-size:22px}h3{margin:14px 0 4px;font-size:13px}.sub{font-size:12px;margin:2px 0 10px}table{width:100%;border-collapse:collapse;margin-bottom:6px}td,th{padding:5px 6px;border-bottom:1px solid #bbb;text-align:left}th{background:#eee}";
    printHtml("P&L " + rangeLabel, body, { css });
  };

  const shareWhatsapp = () => {
    const s = stats;
    const msg = "*" + RESTAURANT.name + " - P&L*\n" + rangeLabel + "\n\nRevenue: " + rs(s.revenue) + "\nKharcha: " + rs(s.expTotal) + "\n*" + (s.profit >= 0 ? "Profit: " : "Loss: ") + rs(Math.abs(s.profit)) + "*\nMargin: " + (Math.round(s.margin * 10) / 10) + "%\n\nCash: " + rs(s.pay.cash) + "\nUPI: " + rs(s.pay.upi) + "\nCard: " + rs(s.pay.card) + "\nDue baaki: " + rs(s.duePending);
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  };

  const closeDay = async () => {
    if (!isTodayOnly) { toast("Pehle 'Aaj' chuno, phir Day Close karo", "warning"); return; }
    const existing = closes.find((c) => c.date === todayKey);
    if (existing && !window.confirm("Aaj ka din pehle band ho chuka hai. Dobara save karein?")) return;
    const op = window.prompt("Subah ka opening cash (Rs)?", existing ? String(existing.openingCash || 0) : "0");
    if (op === null) return;
    const cc = window.prompt("Abhi drawer me kitna cash gina? (Rs)", "");
    if (cc === null || cc.trim() === "") { toast("Gine hue cash likhna zaroori hai", "warning"); return; }
    const s = stats;
    const cashExp = expenses.filter((e) => (e.mode || "cash") === "cash").reduce((t, e) => t + (Number(e.amount) || 0), 0);
    const opening = Number(op) || 0;
    const counted = Number(cc) || 0;
    const expected = opening + s.pay.cash - cashExp;
    const rec = { date: todayKey, revenue: s.revenue, cash: s.pay.cash, upi: s.pay.upi, card: s.pay.card, duePending: s.duePending, expenses: s.expTotal, cashExpenses: cashExp, profit: s.profit, orders: s.valid.length, openingCash: opening, countedCash: counted, expectedCash: expected, cashDiff: counted - expected, by: waiterName || "Staff", at: Date.now() };
    try {
      await setDoc(doc(db, "dayClose", todayKey), rec);
      logAudit("day_closed", { total: s.revenue, reason: "Cash fark: " + (counted - expected) });
      haptic(40);
      toast(counted === expected ? "Din band - cash bilkul sahi!" : "Din band - cash fark: " + inr(counted - expected), counted === expected ? "success" : "warning", { duration: 4500 });
    } catch (e) { toast(e.message, "error"); }
  };

  if (!isOwner) {
    return (
      <div style={{ textAlign: "center", padding: 50, color: C.gray }}>
        <div style={{ fontSize: 44 }}>🔒</div>
        <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>Reports sirf owner dekh sakta hai</div>
      </div>
    );
  }

  const s = stats;
  const box = { background: C.card, border: "1px solid " + C.line, borderRadius: 14, padding: isMobile ? 14 : 20, marginBottom: 16 };
  const boxTitle = { fontSize: isMobile ? 13 : 15, fontWeight: 800, color: C.ink, marginBottom: 14 };
  const chip = (id, label) => (
    <button key={id} onClick={() => setRange(id)} style={{ padding: isMobile ? "6px 11px" : "7px 14px", borderRadius: 20, border: "1px solid " + (preset === id ? G : C.line), background: preset === id ? G : C.card, color: preset === id ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
  );
  const dateInput = { padding: "8px 10px", border: "1px solid " + C.line, borderRadius: 8, fontSize: 13, background: C.card, color: C.ink, fontWeight: 700, outline: "none" };
  const actBtn = (label, onClick, filled) => (
    <button onClick={onClick} disabled={loading} style={{ flex: 1, minWidth: isMobile ? 110 : 130, padding: "11px 12px", borderRadius: 10, border: filled ? "none" : "1.5px solid " + G, background: filled ? G : "transparent", color: filled ? "#fff" : GT, fontWeight: 800, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{label}</button>
  );
  const maxDay = Math.max(1, ...s.daily.map((d) => Math.max(d.revenue, d.expense)));
  const maxItem = s.items.length ? s.items[0].amt : 1;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Reports &amp; Profit / Loss</h2>
        <div style={{ fontSize: 12, color: C.gray, fontWeight: 700, marginTop: 2 }}>{rangeLabel} - {s.valid.length} orders</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {chip("today", "Aaj")}{chip("yesterday", "Kal")}{chip("7days", "7 Din")}{chip("month", "Is Mahina")}{chip("lastmonth", "Pichla Mahina")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.gray }}>FROM</span>
        <input type="date" value={from} max={todayKey} onChange={(e) => { if (e.target.value) { setPreset("custom"); setFrom(e.target.value); } }} style={dateInput} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.gray }}>TO</span>
        <input type="date" value={to} max={todayKey} onChange={(e) => { if (e.target.value) { setPreset("custom"); setTo(e.target.value); } }} style={dateInput} />
      </div>

      {loading && <div style={{ textAlign: "center", padding: 30, color: C.gray, fontSize: 13 }}><Spinner color={G} /> Report ban rahi hai...</div>}
      {!loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 14, marginBottom: 16 }}>
            <StatCard C={C} isMobile={isMobile} label="Revenue" value={inr(s.revenue)} color={C.green} sub={s.paid.length + " paid orders"} />
            <StatCard C={C} isMobile={isMobile} label="Kharcha" value={inr(s.expTotal)} color={C.red} sub={expenses.length + " entries"} />
            <StatCard C={C} isMobile={isMobile} label={s.profit >= 0 ? "Net Profit" : "Net Loss"} value={(s.profit < 0 ? "-" : "") + inr(Math.abs(s.profit))} color={s.profit >= 0 ? C.green : C.red} sub={"Margin " + (Math.round(s.margin * 10) / 10) + "%"} />
            <StatCard C={C} isMobile={isMobile} label="Due baaki" value={inr(s.duePending)} color={C.amber} sub={"Avg bill " + inr(s.avg)} />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {actBtn("⬇ Excel", downloadExcel, true)}
            {actBtn("🖨 PDF / Print", printPnl, false)}
            {actBtn("WhatsApp", shareWhatsapp, false)}
          </div>

          <div style={box}>
            <div style={boxTitle}>Payment Split</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
              {[["Cash", s.pay.cash, C.green], ["UPI", s.pay.upi, C.blue], ["Card", s.pay.card, C.amber], ["Discount diya", s.discount, C.gray]].map(([l, v, c]) => (
                <div key={l} style={{ background: C.cardAlt, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 10, color: C.gray, fontWeight: 800 }}>{l}</div>
                  <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 900, color: c, fontFamily: "monospace", marginTop: 4 }}>{inr(v)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={box}>
            <div style={boxTitle}>Kharcha Category-wise</div>
            {s.catRows.length === 0 && <div style={{ color: C.gray, fontSize: 13, textAlign: "center", padding: 10 }}>Kharcha tab me entry karo</div>}
            {s.catRows.map(([c, v]) => (
              <div key={c} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 3 }}>
                  <span>{c}</span><span style={{ fontFamily: "monospace", color: C.gray }}>{inr(v)} ({s.expTotal ? Math.round((v / s.expTotal) * 100) : 0}%)</span>
                </div>
                <div style={{ height: 6, background: C.line, borderRadius: 3, overflow: "hidden" }}><div style={{ width: (s.expTotal ? (v / s.expTotal) * 100 : 0) + "%", height: "100%", background: G }} /></div>
              </div>
            ))}
            {s.revenue > 0 && s.saman > 0 && <div style={{ fontSize: 12, color: C.gray, fontWeight: 700, marginTop: 8 }}>Saman / kaccha maal = bikri ka <b style={{ color: GT }}>{Math.round((s.saman / s.revenue) * 100)}%</b> (food cost)</div>}
          </div>

          <div style={box}>
            <div style={boxTitle}>Daily Revenue vs Kharcha <span style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>(hara = bikri, laal = kharcha)</span></div>
            {s.daily.length === 0 && <div style={{ color: C.gray, fontSize: 13, textAlign: "center", padding: 10 }}>Koi data nahi</div>}
            {s.daily.map((d) => (
              <div key={d.date} style={{ marginBottom: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 3 }}>
                  <span>{d.date.slice(5)} <span style={{ color: C.gray }}>({d.orders})</span></span>
                  <span style={{ fontFamily: "monospace", color: d.profit >= 0 ? C.green : C.red }}>{d.profit >= 0 ? "+" : "-"}{inr(Math.abs(d.profit))}</span>
                </div>
                <div style={{ height: 6, background: C.line, borderRadius: 3, overflow: "hidden", marginBottom: 2 }}><div style={{ width: (d.revenue / maxDay) * 100 + "%", height: "100%", background: C.green }} /></div>
                <div style={{ height: 6, background: C.line, borderRadius: 3, overflow: "hidden" }}><div style={{ width: (d.expense / maxDay) * 100 + "%", height: "100%", background: C.red }} /></div>
              </div>
            ))}
          </div>

          <div style={box}>
            <div style={boxTitle}>Top Items (amount se)</div>
            {s.items.length === 0 && <div style={{ color: C.gray, fontSize: 13, textAlign: "center", padding: 10 }}>Koi paid sale nahi</div>}
            {s.items.slice(0, 10).map((it, i) => (
              <div key={it.name} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 3 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>#{i + 1} {it.name}</span>
                  <span style={{ fontFamily: "monospace", color: C.gray, flexShrink: 0 }}>{it.qty} - {inr(it.amt)}</span>
                </div>
                <div style={{ height: 6, background: C.line, borderRadius: 3, overflow: "hidden" }}><div style={{ width: (it.amt / maxItem) * 100 + "%", height: "100%", background: G }} /></div>
              </div>
            ))}
          </div>

          {s.waiters.length > 0 && (
            <div style={box}>
              <div style={boxTitle}>Waiter-wise Sale</div>
              {s.waiters.map((w) => (
                <div key={w.name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed " + C.line, fontSize: 13, color: C.ink, fontWeight: 700 }}>
                  <span>{w.name} <span style={{ color: C.gray, fontWeight: 600 }}>({w.orders} orders)</span></span>
                  <span style={{ fontFamily: "monospace", color: GT }}>{inr(w.amt)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ ...box, border: "1.5px solid " + G }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ ...boxTitle, marginBottom: 0 }}>🔒 Din Band (Day Close)</div>
              <button onClick={closeDay} style={{ padding: "10px 16px", border: "none", borderRadius: 10, background: isTodayOnly ? G : C.line, color: isTodayOnly ? "#fff" : C.gray, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Aaj ka din band karo</button>
            </div>
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 10 }}>{isTodayOnly ? "Opening cash aur gina hua cash daalo - system cash ka fark bata dega." : "Day Close ke liye upar 'Aaj' chuno."}</div>
            {closes.length === 0 && <div style={{ color: C.gray, fontSize: 12, textAlign: "center", padding: 8 }}>Abhi koi din band nahi hua</div>}
            {closes.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "9px 0", borderTop: "1px dashed " + C.line, fontSize: 12, color: C.ink, fontWeight: 700 }}>
                <div style={{ minWidth: 0 }}>
                  <div>{c.date} <span style={{ color: C.gray, fontWeight: 600 }}>- Bikri {inr(c.revenue)} - Kharcha {inr(c.expenses)}</span></div>
                  <div style={{ color: (c.profit || 0) >= 0 ? C.green : C.red, fontFamily: "monospace" }}>{(c.profit || 0) >= 0 ? "Profit " : "Loss "}{inr(Math.abs(c.profit || 0))}</div>
                </div>
                <span style={{ background: (c.cashDiff || 0) === 0 ? C.greenLight : C.amberLight, color: (c.cashDiff || 0) === 0 ? C.green : C.amber, padding: "3px 9px", borderRadius: 10, fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{(c.cashDiff || 0) === 0 ? "Cash sahi" : "Fark " + ((c.cashDiff || 0) > 0 ? "+" : "-") + inr(Math.abs(c.cashDiff || 0))}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

'''

# ---------- 1. Naye screens (Kharcha + Reports) ----------
if "function ExpensesView(" in src:
    print("PEHLE SE Kharcha + Reports code")
else:
    sub("Kharcha + Reports code add",
        "class ErrorBoundary extends React.Component {",
        BLOCK + "\nclass ErrorBoundary extends React.Component {")

# ---------- 2. Tabs / sidebar / screens ----------
sub("Top tabs: Kharcha + Reports",
    '{ id: "audit", label: "📝 Audit" },',
    '{ id: "audit", label: "📝 Audit" },\n          { id: "expenses", label: "💸 Kharcha" },\n          { id: "reports", label: "📈 Reports" },')
sub("Sidebar: Kharcha + Reports",
    '{ id: "audit", label: "Audit Log", icon: "📝" }',
    '{ id: "audit", label: "Audit Log", icon: "📝" }, { id: "expenses", label: "Kharcha", icon: "💸" }, { id: "reports", label: "Reports / P&L", icon: "📈" }')
sub("Screens render",
    '{activeTab === "audit" && <AuditLogView C={C} isMobile={isMobile} />}',
    '{activeTab === "audit" && <AuditLogView C={C} isMobile={isMobile} />}\n        {activeTab === "expenses" && <ExpensesView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} />}\n        {activeTab === "reports" && <ReportsView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} />}')
sub("Audit log labels",
    'cancel_order: "Cancel"',
    'cancel_order: "Cancel", expense_added: "Kharcha Added", expense_deleted: "Kharcha Deleted", day_closed: "Day Closed", rate_changed: "Rate Changed"')

# ---------- 3. Saman low-stock badge ----------
sub("Low-stock watcher",
    "const prevNewIdsRef = useRef(null);",
    """const prevNewIdsRef = useRef(null);
  const [lowCount, setLowCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    let invItems = [], invStock = {};
    const calc = () => setLowCount(invItems.filter((it) => Number(it.min) > 0 && invStock[it.id] !== undefined && Number(invStock[it.id]) <= Number(it.min)).length);
    const u1 = onSnapshot(doc(db, "inventory", "items"), (s) => { invItems = s.exists() && Array.isArray(s.data().list) ? s.data().list : []; calc(); }, () => {});
    const u2 = onSnapshot(doc(db, "inventory", "state"), (s) => { invStock = s.exists() ? (s.data().stock || {}) : {}; calc(); }, () => {});
    return () => { u1(); u2(); };
  }, [user]);""")
sub("Saman tab badge",
    '{ id: "inventory", label: "🧾 Saman" },',
    '{ id: "inventory", label: "🧾 Saman" + (lowCount ? " (" + lowCount + ")" : "") },')

# ---------- 4. Tables: timer ----------
sub("Tables: re-render timer",
    "const tableData = useMemo(() => {",
    "const [, setTick] = useState(0);\n  useEffect(() => { const iv = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(iv); }, []);\n  const tableData = useMemo(() => {")
sub("Tables: 60 min warning",
    "color: C.gray, fontWeight: 700 }}>#{t.order.id?.slice(1,5).toUpperCase()} - {timeAgo(t.order.createdAt)}",
    'color: (Date.now() - (t.order.createdAt || 0)) > 3600000 ? C.amber : C.gray, fontWeight: 700 }}>{(Date.now() - (t.order.createdAt || 0)) > 3600000 ? "⏱ " : ""}#{t.order.id?.slice(1,5).toUpperCase()} - {timeAgo(t.order.createdAt)}')

# ---------- 5. Merge atomic ----------
sub("Import writeBatch",
    "query, where, runTransaction, deleteDoc, getDocs, orderBy, limit",
    "query, where, runTransaction, deleteDoc, getDocs, orderBy, limit, writeBatch")
sub("Merge: batch start",
    'await updateDoc(doc(db, "orders", primaryOrder.id), {',
    'const mb = writeBatch(db);\n      mb.update(doc(db, "orders", primaryOrder.id), {')
sub("Merge: batch commit",
    'await updateDoc(doc(db, "orders", other.id), { status: "cancelled", cancelledAt: Date.now(), cancelledReason: "Merged into " + primaryOrder.table });',
    'mb.update(doc(db, "orders", other.id), { status: "cancelled", cancelledAt: Date.now(), cancelledReason: "Merged into " + primaryOrder.table });\n      await mb.commit();')

# ---------- 6. Billing: favourites ----------
sub("Billing: favourite items calc",
    'const categories = useMemo(() => ["All"',
    """const favItems = useMemo(() => {
    const cnt = {};
    orders.forEach((o) => { if (o.status === "cancelled") return; (o.items || []).forEach((it) => { cnt[it.itemId] = (cnt[it.itemId] || 0) + (Number(it.qty) || 0); }); });
    return menu.filter((m) => m.available && cnt[m.id]).sort((a, b) => cnt[b.id] - cnt[a.id]).slice(0, 8);
  }, [orders, menu]);
  const categories = useMemo(() => ["All\"""")
sub("Billing: favourite row",
    '<input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}',
    """{favItems.length > 0 && !search.trim() && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, flexShrink: 0 }}>
              {favItems.map((m) => (
                <button key={"fav" + m.id} onClick={() => setQty(m.id, (cart[m.id] || 0) + 1)} style={{ padding: "7px 12px", borderRadius: 20, border: "1px solid " + (C.gold || C.red), background: cart[m.id] ? (C.gold || C.red) : C.card, color: cart[m.id] ? "#fff" : C.ink, fontWeight: 800, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0 }}>⭐ {m.name}{cart[m.id] ? " ×" + cart[m.id] : ""}</button>
              ))}
            </div>
          )}
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}""")

# ---------- 7. Billing: item rate editable ----------
sub("Rate: state + editRate",
    "const [cancelOpen, setCancelOpen] = useState(false);",
    """const [cancelOpen, setCancelOpen] = useState(false);
  const [rates, setRates] = useState({});
  const editRate = (id, cur, name) => {
    if (!isOwner) { toast("Rate sirf owner badal sakta hai", "warning"); return; }
    const v = window.prompt((name || "Item") + " ka naya rate (Rs)?", String(cur));
    if (v === null) return;
    const n = Number(v);
    if (v.trim() === "" || !(n >= 0)) { toast("Sahi rate likho", "warning"); return; }
    haptic(8);
    setRates((prev) => ({ ...prev, [id]: n }));
    logAudit("rate_changed", { table: table === "parcel" ? "" : table, reason: (name || "Item") + ": " + cur + " -> " + n });
  };""")
sub("Rate: subtotal",
    "return s + (m?.price || 0) * q;",
    "return s + (rates[id] ?? m?.price ?? 0) * q;")
sub("Rate: cart line (tap to edit)",
    'marginTop: 2, fontFamily: "monospace" }}>{inr(m.price)} x {q}</div>',
    'marginTop: 2, fontFamily: "monospace", cursor: "pointer", textDecoration: "underline dotted" }} onClick={() => editRate(id, rates[id] ?? m.price, m.name)}>✎ {inr(rates[id] ?? m.price)} x {q}</div>')
sub("Rate: cart amount",
    "{inr(m.price * q)}",
    "{inr((rates[id] ?? m.price) * q)}")
sub("Rate: new order items",
    "price: m.price, qty, kotNumber: 1 }",
    "price: rates[id] ?? m.price, qty, kotNumber: 1 }")
sub("Rate: add-more items (2 jagah)",
    "price: m.price, qty, kotNumber: nextNo }",
    "price: rates[id] ?? m.price, qty, kotNumber: nextNo }", count=2)
sub("Rate: bill edit - naya item",
    "price: m.price, qty, kotNumber: nextKotNo }",
    "price: rates[id] ?? m.price, qty, kotNumber: nextKotNo }")
sub("Rate: bill edit - purana item",
    "price: ex.price, qty, kotNumber: ex.kotNumber || 1 }",
    "price: rates[id] ?? ex.price, qty, kotNumber: ex.kotNumber || 1 }")

if applied:
    bak = path + ".bak4-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copyfile(path, bak)
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)
    print("\nBackup:", bak)

print("\nLaga: %d  |  Skip: %d" % (applied, skipped))
print("Ab chalao: npm run build")
