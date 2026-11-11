#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EP-PATCH-v4 — Robust auto-detect + duplicate key fix

Usage:
    python3 patch_ep_v4.py                                    # auto-detect
    python3 patch_ep_v4.py src/App.jsx src/StaffApp.jsx       # explicit
"""

import sys, os, re, shutil
from datetime import datetime

# ═══════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════
def backup(path):
    b = f"{path}.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(path, b)
    print(f"  📦 backup → {b}")

def find_file(*candidates):
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def apply_simple(path, patches):
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
            print(f"  ⚠️  NOT FOUND: {label}")
            continue
        content = content.replace(old, new, 1)
        print(f"  ✅ {label}")
        ok += 1
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return ok, len(patches)

def find_function_body(content, signature, start_pos=0):
    """`signature` (e.g. 'const foo = () => {') → returns (start, end) of full function incl. closing } and optional ;"""
    start = content.find(signature, start_pos)
    if start < 0:
        return None, None
    body_start = start + len(signature)
    depth = 1  # we're inside the { of signature
    i = body_start
    while i < len(content):
        c = content[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                i += 1
                break
        i += 1
    if i < len(content) and content[i] == ';':
        i += 1
    return start, i

# ═══════════════════════════════════════════════════════════════════════
# CUSTOMER PATCHES (idempotent)
# ═══════════════════════════════════════════════════════════════════════
CUSTOMER_SIMPLE = [
    (
        "P1 send OTP name",
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
    (
        "P2 demo send OTP name",
        r'''  const handleSendOtpDemo = () => {
    if (!custPhone || custPhone.length < 10) { showToast("⚠️ Enter valid phone", 'error'); return; }''',
        r'''  const handleSendOtpDemo = () => {
    if (!String(custName || "").trim()) { showToast("⚠️ Pehle apna naam daalo", 'error'); return; }
    if (!custPhone || custPhone.length < 10) { showToast("⚠️ Enter valid phone", 'error'); return; }''',
    ),
    (
        "P3 verify OTP name",
        r'''  const handleVerifyOtp = async () => {
    if (DEMO_OTP && !otpConfRef.current) { handleVerifyOtpDemo(); return; }''',
        r'''  const handleVerifyOtp = async () => {
    if (!String(custName || "").trim()) { showToast("⚠️ Pehle apna naam daalo", 'error'); return; }
    if (DEMO_OTP && !otpConfRef.current) { handleVerifyOtpDemo(); return; }''',
    ),
    (
        "P3b verify OTP no-Guest",
        r'''    try { await setDoc(doc(db, "customers", p), { phone: p, name: custName || "Guest", address: custAddress || "", uid: auth.currentUser.uid, lastLogin: Date.now() }, { merge: true }); } catch (e) {}''',
        r'''    try {
      const _patch = { phone: p, address: custAddress || "", uid: auth.currentUser.uid, lastLogin: Date.now() };
      const _nm = String(custName || "").trim();
      if (_nm) _patch.name = _nm;
      await setDoc(doc(db, "customers", p), _patch, { merge: true });
    } catch (e) {}''',
    ),
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
    # Duplicate key cleanups
    (
        "D1 App phone input duplicate fontSize",
        'color: "#fff", fontSize: 15, outline: "none", fontSize: 20, letterSpacing: 2',
        'color: "#fff", outline: "none", fontSize: 20, letterSpacing: 2',
    ),
    (
        "D2 App OTP input duplicate fontSize",
        'color: "#fff", fontSize: 15, outline: "none", fontSize: 28, letterSpacing: 10',
        'color: "#fff", outline: "none", fontSize: 28, letterSpacing: 10',
    ),
]

NEW_VERIFY_DEMO = r'''const handleVerifyOtpDemo = () => {
  if (!String(custName || "").trim()) { showToast("⚠️ Pehle apna naam daalo", "error"); return; }
  if (generatedOtp && otpCode === generatedOtp) {
    setIsLoggedIn(true); setOtpStep("phone");
    (async () => {
      try {
        const cleanName = String(custName).trim();
        const userRef = doc(db, "customers", custPhone);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, { phone: custPhone, name: cleanName, address: custAddress || "", createdAt: Date.now(), lastLogin: Date.now(), totalOrders: 0, totalSpent: 0 });
          showToast("✅ New customer registered!", "success");
        } else {
          await updateDoc(userRef, { lastLogin: Date.now(), name: cleanName });
          showToast("✅ Welcome back!", "success");
        }
        localStorage.setItem("eatpark_customer", JSON.stringify({ name: cleanName, phone: custPhone, address: custAddress, isLoggedIn: true }));
      } catch (error) { console.error(error); }
    })();
  } else showToast("❌ Incorrect OTP", "error");
};'''

def patch_verify_demo(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    sig = "const handleVerifyOtpDemo = () => {"
    if sig not in content:
        print("  ⚠️  P4 handleVerifyOtpDemo not found at all")
        return False

    # Already patched?
    idx = content.find(sig)
    head = content[idx:idx+200]
    if 'if (!String(custName || "").trim())' in head:
        print("  ⏭️  already patched: P4 verify OTP demo")
        return True

    start, end = find_function_body(content, sig)
    if start is None:
        print("  ⚠️  P4 could not find function body")
        return False

    backup(path)
    content = content[:start] + NEW_VERIFY_DEMO + content[end:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("  ✅ P4 verify OTP demo (name + no Guest)")
    return True

# ═══════════════════════════════════════════════════════════════════════
# STAFF PATCHES
# ═══════════════════════════════════════════════════════════════════════
STAFF_SIMPLE = [
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
    (
        "S3 CustomersView props",
        r'''{activeTab === "customers" && <CustomersView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} />}''',
        r'''{activeTab === "customers" && <CustomersView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} orders={orders} loyaltyUsers={loyaltyUsers} />}''',
    ),
    # Duplicate display key in tabs
    (
        "D3 Staff tabs duplicate display",
        'padding: isMobile ? "0 8px" : "0 16px", display: "flex", gap: 4',
        'padding: isMobile ? "0 8px" : "0 16px", gap: 4',
    ),
]

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

def patch_customers_view(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if "function CustomersView({ C, isMobile, isOwner, waiterName, orders = [], loyaltyUsers = [] })" in content:
        print("  ⏭️  already patched: S4 CustomersView")
        return True

    start_marker = "function CustomersView("
    end_marker = "class ErrorBoundary"
    start = content.find(start_marker)
    if start < 0:
        print("  ⚠️  S4 CustomersView not found")
        return False
    end = content.find(end_marker, start)
    if end < 0:
        # Fallback: find next top-level function after CustomersView
        for cand in ["function ImportView(", "function HistoryView("]:
            e = content.find(cand, start)
            if e > 0:
                end = e
                break
    if end < 0:
        print("  ⚠️  S4 could not find end marker")
        return False

    backup(path)
    content = content[:start] + NEW_CUSTOMERS_VIEW + "\n\n" + content[end:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("  ✅ S4 CustomersView replaced (paid-only + 🪙 coins)")
    return True

# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════
def main():
    print("═" * 60)
    print("🩹 EP-PATCH-v4 — auto-detect + duplicate-key fix")
    print("═" * 60)

    # File detection
    if len(sys.argv) >= 3:
        CUSTOMER, STAFF = sys.argv[1], sys.argv[2]
    else:
        CUSTOMER = find_file("src/App.jsx", "src/app.jsx", "App.jsx") or "src/App.jsx"
        STAFF = find_file("src/StaffApp.jsx", "src/staff.jsx", "src/Staff.jsx",
                          "StaffApp.jsx", "staff.jsx") or "src/StaffApp.jsx"

    print(f"\n📄 CUSTOMER: {CUSTOMER}")
    if not os.path.exists(CUSTOMER):
        print(f"❌ NOT FOUND: {CUSTOMER}")
    else:
        ok, total = apply_simple(CUSTOMER, CUSTOMER_SIMPLE)
        p4 = patch_verify_demo(CUSTOMER)
        print(f"  → {ok}/{total} + P4 {'✅' if p4 else '❌'}\n")

    print(f"📄 STAFF: {STAFF}")
    if not os.path.exists(STAFF):
        print(f"❌ NOT FOUND: {STAFF}")
        print("   Hint: file name check karo — src/StaffApp.jsx vs src/staff.jsx\n")
    else:
        ok, total = apply_simple(STAFF, STAFF_SIMPLE)
        s4 = patch_customers_view(STAFF)
        print(f"  → {ok}/{total} + S4 {'✅' if s4 else '❌'}\n")

    print("═" * 60)
    print("Done. Ab chalao:  npm run dev")
    print("═" * 60)

if __name__ == "__main__":
    main()