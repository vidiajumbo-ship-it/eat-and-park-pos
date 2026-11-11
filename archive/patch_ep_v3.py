#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EP-PATCH-v3 — Terminal patch (name required + paid-only value + eatcoins)

Usage:
    python3 patch_ep_v3.py                          # default: src/App.jsx + src/staff.jsx
    python3 patch_ep_v3.py path/to/customer.jsx path/to/staff.jsx

Features:
  ✅ Auto backup (.bak.YYYYMMDD_HHMMSS)
  ✅ Idempotent (dobara chalane par skip)
  ✅ Failed patches report karta hai
"""

import sys, os, shutil
from datetime import datetime

CUSTOMER = sys.argv[1] if len(sys.argv) > 1 else "src/App.jsx"
STAFF    = sys.argv[2] if len(sys.argv) > 2 else "src/staff.jsx"

# ═══════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════
def backup(path):
    b = f"{path}.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(path, b)
    print(f"  📦 backup → {b}")

def apply_patches(path, patches):
    if not os.path.exists(path):
        print(f"❌ NOT FOUND: {path}")
        return False
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    backup(path)
    ok = 0
    for label, old, new in patches:
        if old not in content:
            if new in content:
                print(f"  ⏭️  already patched: {label}")
                ok += 1
                continue
            print(f"  ⚠️  PATTERN NOT FOUND: {label}")
            continue
        content = content.replace(old, new, 1)
        print(f"  ✅ {label}")
        ok += 1
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  → {ok}/{len(patches)} patches applied\n")
    return ok == len(patches)

# ═══════════════════════════════════════════════════════════════════════
# CUSTOMER APP PATCHES
# ═══════════════════════════════════════════════════════════════════════
CUSTOMER_PATCHES = [

    # P1 — send OTP: name required
    (
        "P1 send OTP name required",
        r'''    if (otpSending || resendIn > 0) return;
    const p = String(custPhone || "").replace(/\D/g, "").slice(-10);
    if (p.length !== 10) { showToast("⚠️ 10 digit phone daalo", 'error'); return; }
    if (DEMO_OTP) { handleSendOtpDemo(); return; }''',
        r'''    if (otpSending || resendIn > 0) return;
    if (!String(custName || "").trim()) { showToast("⚠️ Pehle apna naam daalo", 'error'); return; }
    const p = String(custPhone || "").replace(/\D/g, "").slice(-10);
    if (p.length !== 10) { showToast("⚠️ 10 digit phone daalo", 'error'); return; }
    if (DEMO_OTP) { handleSendOtpDemo(); return; }''',
    ),

    # P2 — demo send OTP: name required
    (
        "P2 demo send OTP name required",
        r'''  const handleSendOtpDemo = () => {
    if (!custPhone || custPhone.length < 10) { showToast("⚠️ Enter valid phone", 'error'); return; }''',
        r'''  const handleSendOtpDemo = () => {
    if (!String(custName || "").trim()) { showToast("⚠️ Pehle apna naam daalo", 'error'); return; }
    if (!custPhone || custPhone.length < 10) { showToast("⚠️ Enter valid phone", 'error'); return; }''',
    ),

    # P3 — verify OTP: name required + remove Guest fallback
    (
        "P3 verify OTP name + no Guest",
        r'''  const handleVerifyOtp = async () => {
    if (DEMO_OTP && !otpConfRef.current) { handleVerifyOtpDemo(); return; }''',
        r'''  const handleVerifyOtp = async () => {
    if (!String(custName || "").trim()) { showToast("⚠️ Pehle apna naam daalo", 'error'); return; }
    if (DEMO_OTP && !otpConfRef.current) { handleVerifyOtpDemo(); return; }''',
    ),
    (
        "P3b verify OTP customer doc — no Guest fallback",
        r'''    try { await setDoc(doc(db, "customers", p), { phone: p, name: custName || "Guest", address: custAddress || "", uid: auth.currentUser.uid, lastLogin: Date.now() }, { merge: true }); } catch (e) {}''',
        r'''    try {
      const _patch = { phone: p, address: custAddress || "", uid: auth.currentUser.uid, lastLogin: Date.now() };
      const _nm = String(custName || "").trim();
      if (_nm) _patch.name = _nm;
      await setDoc(doc(db, "customers", p), _patch, { merge: true });
    } catch (e) {}''',
    ),

    # P4 — demo verify OTP: name required + no Guest fallback
    (
        "P4 demo verify OTP name + no Guest",
        r'''  const handleVerifyOtpDemo = () => {
    if (generatedOtp && otpCode === generatedOtp) {
      setIsLoggedIn(true); setOtpStep("phone");
      (async () => {
        try {
          const userRef = doc(db, "customers", custPhone);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, { phone: custPhone, name: custName || "Guest", address: custAddress || "", createdAt: Date.now(), lastLogin: Date.now(), totalOrders: 0, totalSpent: 0 });
            showToast("✅ New customer registered!", 'success');
          } else {
            await updateDoc(userRef, { lastLogin: Date.now(), name: custName || userSnap.data().name });
            showToast("✅ Welcome back!", 'success');
          }
          localStorage.setItem('eatpark_customer', JSON.stringify({ name: custName, phone: custPhone, address: custAddress, isLoggedIn: true }));
        } catch (error) { console.error(error); }
      })();
    } else showToast("❌ Incorrect OTP", 'error');
};''',
        r'''  const handleVerifyOtpDemo = () => {
    if (!String(custName || "").trim()) { showToast("⚠️ Pehle apna naam daalo", 'error'); return; }
    if (generatedOtp && otpCode === generatedOtp) {
      setIsLoggedIn(true); setOtpStep("phone");
      (async () => {
        try {
          const cleanName = String(custName).trim();
          const userRef = doc(db, "customers", custPhone);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, { phone: custPhone, name: cleanName, address: custAddress || "", createdAt: Date.now(), lastLogin: Date.now(), totalOrders: 0, totalSpent: 0 });
            showToast("✅ New customer registered!", 'success');
          } else {
            await updateDoc(userRef, { lastLogin: Date.now(), name: cleanName });
            showToast("✅ Welcome back!", 'success');
          }
          localStorage.setItem('eatpark_customer', JSON.stringify({ name: cleanName, phone: custPhone, address: custAddress, isLoggedIn: true }));
        } catch (error) { console.error(error); }
      })();
    } else showToast("❌ Incorrect OTP", 'error');
};''',
    ),

    # P5 — handlePlaceOrder: totalSpent only on paid
    (
        "P5 totalSpent only when paid",
        r'''      const customerData = safeJSON('eatpark_customer', {});
      customerData.totalOrders = (customerData.totalOrders || 0) + 1;
      customerData.totalSpent = (customerData.totalSpent || 0) + finalTotal;
      customerData.lastOrderDate = Date.now();
      safeSet('eatpark_customer', customerData);
      try { await updateDoc(doc(db, "customers", custPhone), { totalOrders: customerData.totalOrders, totalSpent: customerData.totalSpent, lastOrderDate: Date.now() }); } catch (e) { }''',
        r'''      const customerData = safeJSON('eatpark_customer', {});
      customerData.lastOrderDate = Date.now();
      if (paymentInfo.paid) {
        customerData.totalOrders = (customerData.totalOrders || 0) + 1;
        customerData.totalSpent = (customerData.totalSpent || 0) + finalTotal;
      }
      safeSet('eatpark_customer', customerData);
      try {
        const _cPatch = { lastOrderDate: Date.now() };
        if (paymentInfo.paid) {
          _cPatch.totalOrders = customerData.totalOrders;
          _cPatch.totalSpent = customerData.totalSpent;
        }
        await updateDoc(doc(db, "customers", custPhone), _cPatch);
      } catch (e) { }''',
    ),
]

# ═══════════════════════════════════════════════════════════════════════
# STAFF APP PATCHES
# ═══════════════════════════════════════════════════════════════════════

# Full new CustomersView function (paid-only value + coins)
NEW_CUSTOMERS_VIEW = r'''function CustomersView({ C, isMobile, isOwner, waiterName, orders = [], loyaltyUsers = [] }) {
  const toast = useToast();
  const haptic = useHaptic();
  const G = goldOf(C);
  const GT = goldTextOf(C);
  const thisYear = new Date().getFullYear();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState("all");
  const [offer, setOffer] = useState(() => safeStorageGet("staff_bday_offer", "Flat 20% OFF + free dessert"));
  const [tpl, setTpl] = useState(() => safeStorageGet("staff_bday_tpl", defaultBdayTpl()));

  const paidByPhone = useMemo(() => {
    const map = {};
    (orders || []).forEach((o) => {
      if (!o.paid || o.status === "cancelled") return;
      const p = String(o.customer?.phone || "").replace(/\D/g, "").slice(-10);
      if (p.length !== 10) return;
      if (!map[p]) map[p] = { orders: 0, spent: 0 };
      map[p].orders += 1;
      map[p].spent += Number(o.finalTotal) || 0;
    });
    return map;
  }, [orders]);

  const coinsByPhone = useMemo(() => {
    const map = {};
    (loyaltyUsers || []).forEach((u) => {
      const p = String(u.phone || u.id || "").replace(/\D/g, "").slice(-10);
      if (p.length === 10) map[p] = Number(u.coins) || 0;
    });
    return map;
  }, [loyaltyUsers]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "customers"));
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { toast("Customers load nahi hue: " + e.message, "error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (isOwner) load(); }, [load, isOwner]);

  const rows = useMemo(() => list.map((c) => {
    const phone = String(c.phone || c.id || "").replace(/\D/g, "").slice(-10);
    const paid = paidByPhone[phone] || { orders: 0, spent: 0 };
    const coins = coinsByPhone[phone] || 0;
    return { ...c, phone, days: daysToBirthday(c.dob), paidOrders: paid.orders, paidSpent: paid.spent, coins };
  }), [list, paidByPhone, coinsByPhone]);

  const mNow = new Date().getMonth() + 1;
  const counts = useMemo(() => ({
    all: rows.length,
    today: rows.filter((c) => c.days === 0).length,
    week: rows.filter((c) => c.days !== null && c.days <= 7).length,
    month: rows.filter((c) => { const p = bdayParts(c.dob); return p && p.m === mNow; }).length,
    nodob: rows.filter((c) => !bdayParts(c.dob)).length,
  }), [rows]);
  const ql = q.trim().toLowerCase();
  const shown = useMemo(() => {
    let r = rows.filter((c) => {
      if (flt === "today" && c.days !== 0) return false;
      if (flt === "week" && !(c.days !== null && c.days <= 7)) return false;
      if (flt === "month") { const p = bdayParts(c.dob); if (!p || p.m !== mNow) return false; }
      if (flt === "nodob" && bdayParts(c.dob)) return false;
      if (!ql) return true;
      return (String(c.name || "") + " " + c.phone).toLowerCase().indexOf(ql) >= 0;
    });
    if (flt === "today" || flt === "week") r = [...r].sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
    else if (flt === "month") r = [...r].sort((a, b) => bdayParts(a.dob).d - bdayParts(b.dob).d);
    else r = [...r].sort((a, b) => (Number(b.lastLogin) || 0) - (Number(a.lastLogin) || 0));
    return r;
  }, [rows, flt, ql]);
  const pending = rows.filter((c) => c.days === 0 && c.lastWishYear !== thisYear && c.phone.length === 10);

  const msgFor = (c) => {
    const nm = c.name && c.name !== "Guest" ? c.name : "Dost";
    return tpl.replace(/\{name\}/g, nm).replace(/\{offer\}/g, offer);
  };
  const sendWish = async (c) => {
    if (c.phone.length !== 10) { toast("Phone number sahi nahi hai", "warning"); return; }
    haptic(15);
    window.open("https://wa.me/91" + c.phone + "?text=" + encodeURIComponent(msgFor(c)), "_blank");
    try {
      await setDoc(doc(db, "customers", c.id), { lastWishYear: thisYear, lastWishAt: Date.now(), lastWishBy: waiterName || "Staff" }, { merge: true });
      setList((prev) => prev.map((x) => (x.id === c.id ? { ...x, lastWishYear: thisYear } : x)));
      logAudit("birthday_wished", { reason: (c.name || "") + " " + c.phone });
    } catch (e) { toast("Wish bhej di, par 'sent' mark save nahi hua: " + e.message, "warning"); }
  };
  const editDob = async (c) => {
    const v = window.prompt((c.name || c.phone) + " ki DOB (YYYY-MM-DD), jaise 1995-03-21", c.dob || "");
    if (v === null) return;
    const t = v.trim();
    if (!bdayParts(t) || new Date(t) > new Date()) { toast("Sahi date likho (YYYY-MM-DD)", "warning"); return; }
    try {
      await setDoc(doc(db, "customers", c.id), { dob: t, dobSavedAt: Date.now() }, { merge: true });
      setList((prev) => prev.map((x) => (x.id === c.id ? { ...x, dob: t } : x)));
      toast("DOB save ho gayi", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const header = ["Name", "Phone", "DOB", "Address", "Paid Orders", "Paid Spent", "Coins", "Last Login"];
  const dataRows = (arr) => arr.map((c) => [
    String(c.name || ""), String(c.phone || ""), String(c.dob || ""), String(c.address || ""),
    Number(c.paidOrders) || 0, Number(c.paidSpent) || 0, Number(c.coins) || 0,
    c.lastLogin ? new Date(Number(c.lastLogin)).toLocaleString("en-IN") : "",
  ]);
  const downloadExcel = () => {
    if (!shown.length) { toast("Download ke liye koi customer nahi", "warning"); return; }
    downloadXls("EatPark-Customers-" + invDateKey() + ".xls", [
      { name: "Customers", rows: [header, ...dataRows(shown)] },
      { name: "Birthdays", rows: [[...header, "Days to birthday"], ...rows.filter((c) => c.days !== null).sort((a, b) => a.days - b.days).map((c) => [...dataRows([c])[0], c.days])] },
    ]);
    toast("Excel download ho rahi hai", "success");
  };
  const downloadCsv = () => {
    if (!shown.length) { toast("Download ke liye koi customer nahi", "warning"); return; }
    const csv = [header, ...dataRows(shown)].map((r) => r.map((x) => '"' + String(x ?? "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "EatPark-Customers-" + invDateKey() + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  if (!isOwner) {
    return (
      <div style={{ textAlign: "center", padding: 50, color: C.gray }}>
        <div style={{ fontSize: 44 }}>🔒</div>
        <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>Customer data sirf owner dekh sakta hai</div>
      </div>
    );
  }

  const chip = (id, label) => (
    <button key={id} onClick={() => { haptic(); setFlt(id); }} style={{ padding: "7px 13px", borderRadius: 20, border: "1px solid " + (flt === id ? G : C.line), background: flt === id ? G : C.card, color: flt === id ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}</button>
  );
  const field = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1.5px solid " + C.line, borderRadius: 10, fontSize: 14, background: C.card, color: C.ink, outline: "none", fontFamily: "inherit" };
  const box = { background: C.card, border: "1px solid " + C.line, borderRadius: 14, padding: isMobile ? 12 : 16, marginBottom: 14 };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>🎂 Customers &amp; Birthday</h2>
        <div style={{ fontSize: 12, color: C.gray, fontWeight: 700, marginTop: 2 }}>{rows.length} customers · {counts.today} ka aaj birthday</div>
      </div>

      {counts.today > 0 && (
        <div style={{ ...box, border: "2px solid " + G, background: C.goldLight || C.cardAlt, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.ink }}>🎉 Aaj {counts.today} customer ka birthday hai ({pending.length} ko wish baaki)</div>
          <button onClick={() => (pending[0] ? sendWish(pending[0]) : toast("Sabko wish bhej di ✅", "success"))} style={{ padding: "10px 16px", border: "none", borderRadius: 10, background: G, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {pending[0] ? "▶ Agla bhejo: " + (pending[0].name || pending[0].phone) : "Sab ho gaya ✅"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {chip("all", "Sab (" + counts.all + ")")}
        {chip("today", "🎂 Aaj (" + counts.today + ")")}
        {chip("week", "7 din (" + counts.week + ")")}
        {chip("month", "Is mahine (" + counts.month + ")")}
        {chip("nodob", "DOB nahi (" + counts.nodob + ")")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Naam / phone search..." style={{ ...field, flex: 1, minWidth: 160 }} />
        <button onClick={downloadExcel} style={{ padding: "10px 16px", border: "none", borderRadius: 10, background: G, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>⬇ Excel</button>
        <button onClick={downloadCsv} style={{ padding: "10px 16px", border: "1.5px solid " + G, borderRadius: 10, background: "transparent", color: GT, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>⬇ CSV</button>
        <button onClick={load} style={{ padding: "10px 14px", border: "1.5px solid " + C.line, borderRadius: 10, background: "transparent", color: C.gray, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>↻</button>
      </div>
      <div style={{ fontSize: 11, color: C.gray, fontWeight: 700, marginBottom: 12 }}>Download me wahi list aayegi jo abhi filter me dikh rahi hai (sabka data chahiye to "Sab" chuno).</div>

      <details style={box}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: GT }}>✏️ Birthday message / offer badlo</summary>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, marginBottom: 4 }}>OFFER</div>
          <input value={offer} onChange={(e) => { setOffer(e.target.value); try { localStorage.setItem("staff_bday_offer", e.target.value); } catch (x) {} }} style={{ ...field, marginBottom: 10 }} />
          <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, marginBottom: 4 }}>MESSAGE ({"{name}"} aur {"{offer}"} khud bhar jayenge)</div>
          <textarea rows={6} value={tpl} onChange={(e) => { setTpl(e.target.value); try { localStorage.setItem("staff_bday_tpl", e.target.value); } catch (x) {} }} style={{ ...field, resize: "vertical", fontFamily: "inherit" }} />
          <button onClick={() => { setTpl(defaultBdayTpl()); try { localStorage.removeItem("staff_bday_tpl"); } catch (x) {} }} style={{ marginTop: 8, padding: "7px 12px", border: "1px solid " + C.line, borderRadius: 8, background: "transparent", color: C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>↩ Default message</button>
        </div>
      </details>

      {loading && <div style={{ textAlign: "center", padding: 24 }}><Spinner color={G} /></div>}
      {!loading && shown.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.gray, fontSize: 13, fontWeight: 700 }}>Koi customer nahi mila</div>}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 8 }}>
        {shown.map((c) => {
          const wished = c.lastWishYear === thisYear;
          return (
            <div key={c.id} style={{ background: c.days === 0 ? (C.goldLight || C.cardAlt) : C.card, border: "1.5px solid " + (c.days === 0 ? G : C.line), borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "Guest"}</div>
                  <div style={{ fontSize: 12, color: C.gray, fontFamily: "monospace", marginTop: 2 }}>{c.phone}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {c.dob ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>🎂 {fmtDob(c.dob)}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: c.days === 0 ? G : C.gray }}>{c.days === 0 ? "AAJ!" : c.days + " din baaki"}</div>
                    </>
                  ) : <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>DOB nahi</div>}
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 6, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <span>Orders {Number(c.paidOrders) || 0} · {inr(c.paidSpent || 0)}</span>
                <span style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>🪙 {Number(c.coins) || 0} coins</span>
                {c.lastLogin && <span>· login {new Date(Number(c.lastLogin)).toLocaleDateString("en-IN")}</span>}
                {wished && <span style={{ color: C.green, fontWeight: 800 }}>· ✅ Wish bheji</span>}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => sendWish(c)} disabled={!c.dob || c.phone.length !== 10} style={{ flex: 1, padding: 9, border: "none", borderRadius: 8, background: c.dob ? "#25D366" : C.line, color: c.dob ? "#fff" : C.gray, fontWeight: 800, fontSize: 12, cursor: c.dob ? "pointer" : "not-allowed", fontFamily: "inherit" }}>🎂 WhatsApp Wish</button>
                <a href={"tel:" + c.phone} style={{ padding: "9px 12px", border: "1.5px solid " + C.blue, borderRadius: 8, color: C.blue, fontWeight: 800, fontSize: 12, textDecoration: "none" }}>📞</a>
                <button onClick={() => editDob(c)} style={{ padding: "9px 12px", border: "1.5px solid " + C.line, borderRadius: 8, background: "transparent", color: C.gray, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✎ DOB</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}'''

STAFF_PATCHES = [

    # S1 — add loyaltyUsers state
    (
        "S1 loyaltyUsers state",
        r'''  const [calls, setCalls] = useState([]);
  const [bookings, setBookings] = useState([]);
  const prevCallsRef = useRef(0);''',
        r'''  const [calls, setCalls] = useState([]);
  const [loyaltyUsers, setLoyaltyUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const prevCallsRef = useRef(0);''',
    ),

    # S2 — loyaltyUsers listener
    (
        "S2 loyaltyUsers listener",
        r'''  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "bookings"),
      (snap) => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => unsub();
  }, [user]);''',
        r'''  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "loyaltyUsers"),
      (snap) => setLoyaltyUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => unsub();
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "bookings"),
      (snap) => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => unsub();
  }, [user]);''',
    ),

    # S3 — pass orders + loyaltyUsers to CustomersView
    (
        "S3 CustomersView props",
        r'''{activeTab === "customers" && <CustomersView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} />}''',
        r'''{activeTab === "customers" && <CustomersView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} orders={orders} loyaltyUsers={loyaltyUsers} />}''',
    ),
]

# ═══════════════════════════════════════════════════════════════════════
# SPECIAL: full CustomersView replace (find by markers)
# ═══════════════════════════════════════════════════════════════════════
def replace_customers_view(path):
    if not os.path.exists(path):
        print(f"❌ NOT FOUND: {path}")
        return False
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if "function CustomersView({ C, isMobile, isOwner, waiterName, orders = [], loyaltyUsers = [] })" in content:
        print("  ⏭️  already patched: S4 CustomersView (coins + paid-only)")
        return True

    start_marker = "function CustomersView("
    end_marker   = "class ErrorBoundary"
    start = content.find(start_marker)
    if start < 0:
        print("  ⚠️  CustomersView not found")
        return False
    end = content.find(end_marker, start)
    if end < 0:
        print("  ⚠️  ErrorBoundary marker not found after CustomersView")
        return False

    backup(path)
    new_content = content[:start] + NEW_CUSTOMERS_VIEW + "\n\n" + content[end:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"  ✅ S4 CustomersView replaced (paid-only + coins)\n")
    return True

# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════
def main():
    print("═" * 60)
    print("🩹 EP-PATCH-v3 — Name Required + Paid Value + EatCoins")
    print("═" * 60)

    print(f"\n📄 CUSTOMER FILE: {CUSTOMER}")
    ok1 = apply_patches(CUSTOMER, CUSTOMER_PATCHES)

    print(f"📄 STAFF FILE: {STAFF}")
    ok2 = apply_patches(STAFF, STAFF_PATCHES)
    ok3 = replace_customers_view(STAFF)

    print("═" * 60)
    if ok1 and ok2 and ok3:
        print("🎉 ALL PATCHES APPLIED — restart dev server")
        print("   npm run dev")
    else:
        print("⚠️  Kuch patches fail hue — upar dekho")
        print("   Backup files .bak.* hain, restore kar sakte ho")
    print("═" * 60)

if __name__ == "__main__":
    main()