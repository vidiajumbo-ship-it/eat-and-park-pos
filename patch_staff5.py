#!/usr/bin/env python3
# PATCH 5 (final):
#   1. Custom category add (settings/expenseCats)
#   2. Mode "credit" (udhaar) — expense recognize but cash nahi
#   3. Vendor master (vendors collection) — manual add
#   4. Vendor Payments alag (vendorPayments) — P&L expense NAHI
#   5. Reports mein alag "Vendor Due" tab
#   6. Day Close: cash vendor payments bhi drawer se minus
#
# Usage: python3 patch_staff5.py src/StaffApp.jsx
# Patch 4 PEHLE laga hona chahiye.

import sys, shutil, datetime

if len(sys.argv) < 2:
    print(__doc__); sys.exit(1)

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    src = f.read()

applied = 0; skipped = 0

def sub(name, old, new, count=1):
    global src, applied, skipped
    if new in src:
        print("PEHLE SE", name); return
    n = src.count(old)
    if n == count:
        src = src.replace(old, new); applied += 1; print("OK    ", name)
    else:
        skipped += 1; print("SKIP  ", name, "(%d mila, %d chahiye)" % (n, count))


# ---------- 1. Vendor + Credit BLOCK ----------
VENDOR_BLOCK = r'''
// ===========================================================================
// VENDOR DUE TRACKING (patch 5)
// collections: vendors/{id}, vendorPayments/{id}
// Expense mode="credit" => due create, cash out NAHI, P&L expense HAAN
// vendorPayments       => due kam, P&L expense NAHI, cash out HAAN
// ===========================================================================

const modeLabel = (m) => ({ cash: "Cash", upi: "UPI", bank: "Bank", credit: "Udhaar" }[m] || m);

async function loadVendorDues() {
  const [vSnap, eSnap, pSnap] = await Promise.all([
    getDocs(collection(db, "vendors")),
    getDocs(query(collection(db, "expenses"), where("mode", "==", "credit"))),
    getDocs(collection(db, "vendorPayments")),
  ]);
  const map = {};
  vSnap.docs.forEach((d) => {
    const v = { id: d.id, ...d.data() };
    map[v.id] = { ...v, purchases: 0, paid: 0, due: Number(v.openingDue) || 0 };
  });
  eSnap.docs.forEach((d) => {
    const e = d.data();
    if (e.vendorId && map[e.vendorId]) map[e.vendorId].purchases += Number(e.amount) || 0;
  });
  pSnap.docs.forEach((d) => {
    const p = d.data();
    if (p.vendorId && map[p.vendorId]) map[p.vendorId].paid += Number(p.amount) || 0;
  });
  return Object.values(map)
    .map((v) => ({ ...v, due: (Number(v.openingDue) || 0) + v.purchases - v.paid }))
    .sort((a, b) => b.due - a.due);
}

async function loadCustomCats() {
  try {
    const s = await getDoc(doc(db, "settings", "expenseCats"));
    if (s.exists() && Array.isArray(s.data().list) && s.data().list.length) return s.data().list;
  } catch (e) {}
  return EXP_CATS;
}
async function saveCustomCats(list) {
  await setDoc(doc(db, "settings", "expenseCats"), { list, updatedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// VENDOR LEDGER / PAYMENT VIEW
// ---------------------------------------------------------------------------
function VendorView({ C, isMobile, isOwner, waiterName, onDuesChange }) {
  const toast = useToast(); const haptic = useHaptic();
  const G = goldOf(C); const GT = goldTextOf(C);
  const [vendors, setVendors] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newOpen, setNewOpen] = useState("");
  const [payVendor, setPayVendor] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("cash");
  const [payNote, setPayNote] = useState("");
  const [payDate, setPayDate] = useState(invDateKey());
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const dues = await loadVendorDues();
      setVendors(dues);
      const ps = await getDocs(query(collection(db, "vendorPayments"), orderBy("createdAt", "desc"), limit(50)));
      setPayments(ps.docs.map((d) => ({ id: d.id, ...d.data() })));
      if (onDuesChange) onDuesChange(dues.reduce((s, v) => s + Math.max(0, v.due), 0));
    } catch (e) { toast("Vendor load nahi hua: " + e.message, "error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const addVendor = async () => {
    const n = newName.trim();
    if (!n) { toast("Vendor ka naam likho", "warning"); return; }
    if (saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "vendors"), {
        name: n, phone: newPhone.trim(),
        openingDue: Number(newOpen) || 0,
        active: true, createdAt: Date.now(),
      });
      logAudit("vendor_added", { reason: n });
      toast("Vendor add ho gaya", "success"); haptic(20);
      setNewName(""); setNewPhone(""); setNewOpen("");
      refresh();
    } catch (e) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const payNow = async () => {
    const amt = Number(payAmount);
    if (!payVendor) { toast("Vendor chuno", "warning"); return; }
    if (!(amt > 0)) { toast("Sahi amount likho", "warning"); return; }
    if (saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "vendorPayments"), {
        vendorId: payVendor, amount: amt, mode: payMode,
        note: payNote.trim(), date: payDate,
        by: waiterName || "Staff", createdAt: Date.now(),
      });
      logAudit("vendor_paid", { total: amt, reason: "Vendor " + payVendor + " - " + payMode });
      toast("Payment save ho gayi: " + inr(amt), "success"); haptic(25);
      setPayAmount(""); setPayNote("");
      refresh();
    } catch (e) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const deleteVendor = async (v) => {
    if (!isOwner) return;
    if (!window.confirm(v.name + " ko delete karein? (payments/purchases history rahegi)")) return;
    try {
      await deleteDoc(doc(db, "vendors", v.id));
      toast("Vendor delete ho gaya", "success");
      refresh();
    } catch (e) { toast(e.message, "error"); }
  };

  const field = { width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1.5px solid " + C.line, borderRadius: 10, fontSize: 15, background: C.card, color: C.ink, outline: "none", fontFamily: "inherit" };
  const lbl = { fontSize: 11, fontWeight: 800, color: C.gray, marginBottom: 5, textTransform: "uppercase" };
  const box = { background: C.card, border: "1px solid " + C.line, borderRadius: 14, padding: isMobile ? 14 : 18, marginBottom: 16 };

  const totalDue = vendors.reduce((s, v) => s + Math.max(0, v.due), 0);

  if (!isOwner) {
    return (
      <div style={{ textAlign: "center", padding: 50, color: C.gray }}>
        <div style={{ fontSize: 44 }}>🔒</div>
        <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>Vendor sirf owner dekh sakta hai</div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Vendor Due</h2>
      <div style={{ fontSize: 12, color: C.gray, fontWeight: 700, marginBottom: 14 }}>
        Vendor ka udhaar aur payment - ye kharcha NAHI hai, alag track hota hai
      </div>

      <div style={{ background: C.amberLight || C.cardAlt, border: "1px solid " + (C.amber || G), borderRadius: 14, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, textTransform: "uppercase" }}>Kul Vendor Due</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.amber || GT, fontFamily: "monospace", marginTop: 4 }}>{inr(totalDue)}</div>
        </div>
        <div style={{ fontSize: 11, color: C.gray, fontWeight: 700, textAlign: "right" }}>{vendors.filter((v) => v.due > 0).length} vendor<br/>due wale</div>
      </div>

      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 12 }}>➕ Naya Vendor</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Vendor name" style={field} />
          <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone" style={field} />
          <input value={newOpen} onChange={(e) => setNewOpen(e.target.value)} type="number" placeholder="Purana due" style={field} />
        </div>
        <button onClick={addVendor} disabled={saving} style={{ width: "100%", padding: 12, border: "none", borderRadius: 10, background: G, color: "#fff", fontWeight: 800, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{saving ? "Saving..." : "Vendor Add Karo"}</button>
      </div>

      {vendors.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 12 }}>💵 Vendor ko Paisa Do (Payment)</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <select value={payVendor} onChange={(e) => setPayVendor(e.target.value)} style={field}>
              <option value="">-- Vendor chuno --</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name} (due {inr(Math.max(0, v.due))})</option>)}
            </select>
            <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Amount Rs" style={field} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {[["cash", "Cash"], ["upi", "UPI"], ["bank", "Bank"]].map(([id, l]) => (
              <button key={id} onClick={() => setPayMode(id)} style={{ padding: "7px 13px", borderRadius: 20, border: "1px solid " + (payMode === id ? G : C.line), background: payMode === id ? G : C.card, color: payMode === id ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 8, marginBottom: 10 }}>
            <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note (optional)" style={field} />
            <input type="date" value={payDate} max={invDateKey()} onChange={(e) => e.target.value && setPayDate(e.target.value)} style={field} />
          </div>
          <button onClick={payNow} disabled={saving} style={{ width: "100%", padding: 14, border: "none", borderRadius: 10, background: "linear-gradient(135deg, " + G + " 0%, " + (C.goldDark || G) + " 100%)", color: "#fff", fontWeight: 900, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{saving ? "Saving..." : "Payment Save Karo"}</button>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 8, textAlign: "center", fontWeight: 700 }}>⚠️ Ye P&L expense nahi hai - sirf due kam karega</div>
        </div>
      )}

      {loading && <div style={{ textAlign: "center", padding: 20 }}><Spinner color={G} /></div>}

      {!loading && vendors.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: C.gray, fontSize: 13, fontWeight: 700 }}>Abhi koi vendor nahi - upar se add karo</div>
      )}

      {!loading && vendors.map((v) => (
        <div key={v.id} style={{ background: C.card, border: "1px solid " + C.line, borderRadius: 12, padding: 14, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: C.ink }}>
                {v.name}
                {v.phone && <span style={{ color: C.gray, fontWeight: 600, fontSize: 12 }}> · {v.phone}</span>}
              </div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                Opening {inr(v.openingDue || 0)} · Purchase {inr(v.purchases)} · Paid {inr(v.paid)}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: C.gray, fontWeight: 700 }}>DUE</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: v.due > 0 ? C.red : C.green, fontFamily: "monospace" }}>{inr(Math.max(0, v.due))}</div>
            </div>
            {isOwner && <button onClick={() => deleteVendor(v)} style={{ border: "none", background: "transparent", color: C.gray, fontSize: 16, cursor: "pointer", padding: 4 }} title="Delete">x</button>}
          </div>
        </div>
      ))}

      {payments.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 10 }}>🕐 Recent Payments</div>
          {payments.slice(0, 20).map((p) => {
            const v = vendors.find((x) => x.id === p.vendorId);
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px dashed " + C.line, fontSize: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: C.ink }}>{v ? v.name : p.vendorId}</div>
                  <div style={{ color: C.gray, fontSize: 11 }}>{p.date} · {modeLabel(p.mode)}{p.note ? " · " + p.note : ""}</div>
                </div>
                <div style={{ fontWeight: 900, color: C.green, fontFamily: "monospace" }}>{inr(p.amount)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
'''
sub("Vendor block add",
    "class ErrorBoundary extends React.Component {",
    VENDOR_BLOCK + "\nclass ErrorBoundary extends React.Component {")


# ---------- 2. ExpensesView: custom cats + credit mode + vendor select ----------
sub("Expense: extra states",
    'const [saving, setSaving] = useState(false);\n\n  useEffect(() => {\n    setLoading(true);',
    '''const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState(EXP_CATS);
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [newCat, setNewCat] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  useEffect(() => {
    loadCustomCats().then(setCats);
    getDocs(collection(db, "vendors"))
      .then((snap) => setVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((v) => v.active !== false)))
      .catch(() => {});
  }, []);

  const addCat = async () => {
    const c = newCat.trim();
    if (!c) return;
    if (cats.includes(c)) { toast("Ye category pehle se hai", "warning"); return; }
    const list = [...cats, c];
    try {
      await saveCustomCats(list);
      setCats(list); setCat(c); setNewCat(""); setShowNewCat(false);
      toast("Category add ho gayi", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  useEffect(() => {
    setLoading(true);''')

sub("Expense: save with vendorId",
    'await addDoc(collection(db, "expenses"), { date, amount: amt, category: cat, mode, note: note.trim(), by: waiterName || "Staff", createdAt: Date.now() });',
    'await addDoc(collection(db, "expenses"), { date, amount: amt, category: cat, mode, vendorId: vendorId || null, note: note.trim(), by: waiterName || "Staff", createdAt: Date.now() });')

sub("Expense: reset vendor",
    'setAmount(""); setNote("");',
    'setAmount(""); setNote(""); setVendorId("");')

sub("Expense: chips use cats + custom button",
    '{EXP_CATS.map((c) => chip(cat === c, c, () => { haptic(); setCat(c); }))}</div>',
    '''{cats.map((c) => chip(cat === c, c, () => { haptic(); setCat(c); }))}
          <button onClick={() => setShowNewCat((v) => !v)} style={{ padding: "7px 13px", borderRadius: 20, border: "1px dashed " + C.gray, background: "transparent", color: C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Naya</button>
        </div>
        {showNewCat && (
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} placeholder="Naya category naam (jaise: Chai/Snacks)" style={{ ...field, padding: "8px 10px", fontSize: 13 }} />
            <button onClick={addCat} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: G, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
          </div>
        )}''')

sub("Expense: modes + vendor select",
    '{[["cash", "Cash"], ["upi", "UPI"], ["bank", "Bank"]].map(([id, l]) => chip(mode === id, l, () => setMode(id), id))}</div>',
    '''{[["cash", "Cash"], ["upi", "UPI"], ["bank", "Bank"], ["credit", "Udhaar"]].map(([id, l]) => chip(mode === id, l, () => { setMode(id); if (id !== "credit") setVendorId(""); }, id))}</div>
        {mode === "credit" && (
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Vendor (kiska due hai?)</div>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} style={field}>
              <option value="">-- Vendor chuno (optional) --</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 6, fontWeight: 700 }}>
              ⚠️ Udhaar = cash nahi gaya, P&L mein kharcha count hoga, vendor ka due banega. Baad mein "Reports → Vendor Due" tab se payment karo.
            </div>
          </div>
        )}''')


# ---------- 3. Reports: Vendor tab ----------
sub("Reports: state for tab",
    'const [closes, setCloses] = useState([]);\n  const [loading, setLoading] = useState(true);',
    'const [closes, setCloses] = useState([]);\n  const [loading, setLoading] = useState(true);\n  const [rTab, setRTab] = useState("pnl");\n  const [vendorDue, setVendorDue] = useState(0);')

sub("Reports: tab bar + wrap PnL",
    '''<div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {chip("today", "Aaj")}{chip("yesterday", "Kal")}{chip("7days", "7 Din")}{chip("month", "Is Mahina")}{chip("lastmonth", "Pichla Mahina")}
      </div>''',
    '''<div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setRTab("pnl")} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid " + (rTab === "pnl" ? G : C.line), background: rTab === "pnl" ? G : C.card, color: rTab === "pnl" ? "#fff" : C.gray, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>📈 P&L</button>
        <button onClick={() => setRTab("vendors")} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid " + (rTab === "vendors" ? G : C.line), background: rTab === "vendors" ? G : C.card, color: rTab === "vendors" ? "#fff" : C.gray, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>🏪 Vendor Due{vendorDue > 0 ? " (" + inr(vendorDue) + ")" : ""}</button>
      </div>

      {rTab === "vendors" && <VendorView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} onDuesChange={setVendorDue} />}

      {rTab === "pnl" && (<>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {chip("today", "Aaj")}{chip("yesterday", "Kal")}{chip("7days", "7 Din")}{chip("month", "Is Mahina")}{chip("lastmonth", "Pichla Mahina")}
      </div>''')

sub("Reports: close PnL fragment",
    '''      )}
    </div>
  );
}''',
    '''      )}
      </>)}
    </div>
  );
}''')


# ---------- 4. DayClose: vendor cash payments minus ----------
sub("DayClose: add vendor cash payments",
    'const cashExp = expenses.filter((e) => (e.mode || "cash") === "cash").reduce((t, e) => t + (Number(e.amount) || 0), 0);',
    '''const cashExp = expenses.filter((e) => (e.mode || "cash") === "cash").reduce((t, e) => t + (Number(e.amount) || 0), 0);
    let cashVendorPay = 0;
    try {
      const pSnap = await getDocs(query(collection(db, "vendorPayments"), where("date", "==", todayKey), where("mode", "==", "cash")));
      cashVendorPay = pSnap.docs.reduce((t, d) => t + (Number(d.data().amount) || 0), 0);
    } catch (e) {}''')

sub("DayClose: expected cash",
    'const expected = opening + s.pay.cash - cashExp;',
    'const expected = opening + s.pay.cash - cashExp - cashVendorPay;')

sub("DayClose: record vendor cash",
    'const rec = { date: todayKey, revenue: s.revenue, cash: s.pay.cash, upi: s.pay.upi, card: s.pay.card,',
    'const rec = { date: todayKey, revenue: s.revenue, cash: s.pay.cash, upi: s.pay.upi, card: s.pay.card, cashVendorPayments: cashVendorPay,')


# ---------- 5. Audit labels ----------
sub("Audit labels patch5",
    'rate_changed: "Rate Changed"',
    'rate_changed: "Rate Changed", vendor_added: "Vendor Added", vendor_paid: "Vendor Paid"')


if applied:
    bak = path + ".bak5-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copyfile(path, bak)
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)
    print("\nBackup:", bak)

print("\nLaga: %d  |  Skip: %d" % (applied, skipped))
print("Ab chalao: npm run build")