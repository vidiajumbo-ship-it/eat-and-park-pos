const fs = require("fs");
const path = require("path");

function findFile(name) {
  for (const dir of ["src", "."]) {
    if (!fs.existsSync(dir)) continue;
    const hit = fs.readdirSync(dir).find((f) => f.toLowerCase() === name.toLowerCase());
    if (hit) return path.join(dir, hit);
  }
  return null;
}

const MARK = { "App.jsx": "🎂 DOB POPUP", "Staff.jsx": "CUSTOMERS + BIRTHDAY (patch 7)" };

const edits = [
// ───────────── App.jsx : 1A ─────────────
{ file: "App.jsx",
find: String.raw`const [waiterUnlocked, setWaiterUnlocked] = useState(wasWaiterOpen);`,
replace: String.raw`const [waiterUnlocked, setWaiterUnlocked] = useState(wasWaiterOpen);

  // 🎂 DOB popup (login ke baad)
  const [showDobModal, setShowDobModal] = useState(false);
  const [dobInput, setDobInput] = useState("");
  const [dobSaving, setDobSaving] = useState(false);
  const [dobErr, setDobErr] = useState("");
  useEffect(() => {
    if (!isLoggedIn || waiterUnlocked) return;
    const p = String(custPhone || "").replace(/\D/g, "").slice(-10);
    if (p.length !== 10) return;
    let off = false;
    (async () => {
      try {
        if (localStorage.getItem("enp_dob_done_" + p) === "1") return;
        const skipAt = Number(localStorage.getItem("enp_dob_skip_" + p) || 0);
        if (Date.now() - skipAt < 3 * 86400000) return;
        let hasDob = false;
        try {
          const s = await getDoc(doc(db, "customers", p));
          hasDob = s.exists() && !!s.data().dob;
        } catch (e) {}
        if (off) return;
        if (hasDob) { localStorage.setItem("enp_dob_done_" + p, "1"); return; }
        setShowDobModal(true);
      } catch (e) {}
    })();
    return () => { off = true; };
  }, [isLoggedIn, custPhone]);
  const saveDob = async () => {
    const p = String(custPhone || "").replace(/\D/g, "").slice(-10);
    if (!dobInput) { setDobErr("Apni date of birth chuno"); return; }
    if (new Date(dobInput) > new Date()) { setDobErr("Future ki date nahi chalegi"); return; }
    setDobErr(""); setDobSaving(true);
    try {
      await setDoc(doc(db, "customers", p), { phone: p, name: custName || "Guest", dob: dobInput, dobSavedAt: Date.now() }, { merge: true });
      try { localStorage.setItem("enp_dob_done_" + p, "1"); } catch (e) {}
      setShowDobModal(false);
      showToast("🎂 Thanks! Birthday pe special offer milega", "success");
    } catch (e) { setDobErr("Save nahi hua, dobara try karo"); }
    finally { setDobSaving(false); }
  };
  const skipDob = () => {
    const p = String(custPhone || "").replace(/\D/g, "").slice(-10);
    try { localStorage.setItem("enp_dob_skip_" + p, String(Date.now())); } catch (e) {}
    setShowDobModal(false);
  };` },

// ───────────── App.jsx : 1B ─────────────
{ file: "App.jsx",
find: String.raw`{/* ENP-CUSTOMER-UI */}`,
replace: String.raw`{/* 🎂 DOB POPUP */}
      {showDobModal && isLoggedIn && (
        <div style={{ position: "fixed", inset: 0, zIndex: 160, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 380, background: "#161F2F", borderRadius: 24, padding: 28, border: "1px solid #273449", boxShadow: "0 24px 70px rgba(0,0,0,0.55)", textAlign: "center" }}>
            <div style={{ fontSize: 54, marginBottom: 8 }}>🎂</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>Give your date of birth and get offer on birthday</div>
            <div style={{ fontSize: 13, color: "#8B9BB4", marginTop: 8, marginBottom: 18 }}>Apna birthday batao, us din aapko special offer milega 🎁</div>
            <input type="date" value={dobInput} min="1940-01-01" max={new Date().toISOString().split("T")[0]} onChange={(e) => { setDobInput(e.target.value); setDobErr(""); }}
              style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#fff", fontSize: 18, fontWeight: 700, textAlign: "center", outline: "none", colorScheme: "dark" }} />
            {dobErr && <div style={{ color: "#EF4444", fontSize: 12, fontWeight: 700, marginTop: 8 }}>{dobErr}</div>}
            <button onClick={saveDob} disabled={dobSaving} style={{ width: "100%", padding: 15, marginTop: 16, background: "#FF5A1F", border: "none", borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 800, cursor: dobSaving ? "wait" : "pointer", opacity: dobSaving ? 0.6 : 1, boxShadow: "0 8px 20px rgba(255,90,31,0.3)" }}>
              {dobSaving ? "⏳ Saving..." : "🎁 Save & Get Offer"}
            </button>
            <button onClick={skipDob} style={{ width: "100%", padding: 10, marginTop: 6, background: "none", border: "none", color: "#8B9BB4", fontWeight: 700, cursor: "pointer" }}>Baad me</button>
          </div>
        </div>
      )}

      {/* ENP-CUSTOMER-UI */}` },

// ───────────── Staff.jsx : 2A ─────────────
{ file: "Staff.jsx",
find: String.raw`{ id: "history", label: "Bills", icon: "🧾" },`,
replace: String.raw`{ id: "history", label: "Bills", icon: "🧾" },
              { id: "customers", label: "Customers", icon: "🎂" },` },

// ───────────── Staff.jsx : 2B ─────────────
{ file: "Staff.jsx",
find: String.raw`{ id: "reports", label: "📈 Reports" }, { id: "import", label: "📥 Import" },`,
replace: String.raw`{ id: "reports", label: "📈 Reports" }, { id: "import", label: "📥 Import" }, { id: "customers", label: "🎂 Customers" },` },

// ───────────── Staff.jsx : 2C ─────────────
{ file: "Staff.jsx",
find: String.raw`{ id: "import", label: "Bulk Import", icon: "📥" }]`,
replace: String.raw`{ id: "import", label: "Bulk Import", icon: "📥" }, { id: "customers", label: "Customers", icon: "🎂" }]` },

// ───────────── Staff.jsx : 2D ─────────────
{ file: "Staff.jsx",
find: String.raw`{activeTab === "import" && <ImportView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} onDone={() => {}} />}`,
replace: String.raw`{activeTab === "import" && <ImportView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} onDone={() => {}} />}
        {activeTab === "customers" && <CustomersView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} />}` },

// ───────────── Staff.jsx : 2E (CustomersView) ─────────────
{ file: "Staff.jsx",
find: String.raw`class ErrorBoundary extends React.Component {`,
replace: String.raw`// ===========================================================================
// CUSTOMERS + BIRTHDAY (patch 7)
// ===========================================================================
const defaultBdayTpl = () => "🎂 Happy Birthday {name}! 🎉\n\nEat & Park Restaurant ki taraf se aapko dher saari shubhkamnayein.\n\n🎁 Aapka Birthday Offer: {offer}\n\nAaiye, apne parivaar ke saath celebrate kijiye! 📞 " + RESTAURANT.phones[0];
const bdayParts = (dob) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob || ""));
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
};
const daysToBirthday = (dob) => {
  const p = bdayParts(dob);
  if (!p) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let next = new Date(now.getFullYear(), p.m - 1, p.d);
  if (next < now) next = new Date(now.getFullYear() + 1, p.m - 1, p.d);
  return Math.round((next - now) / 86400000);
};
const fmtDob = (dob) => {
  const p = bdayParts(dob);
  return p ? new Date(p.y, p.m - 1, p.d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
};

function CustomersView({ C, isMobile, isOwner, waiterName }) {
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "customers"));
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { toast("Customers load nahi hue: " + e.message, "error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (isOwner) load(); }, [load, isOwner]);

  const rows = useMemo(() => list.map((c) => ({
    ...c,
    phone: String(c.phone || c.id || "").replace(/\D/g, "").slice(-10),
    days: daysToBirthday(c.dob),
  })), [list]);
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

  const header = ["Name", "Phone", "DOB", "Address", "Orders", "Spent", "Last Login"];
  const dataRows = (arr) => arr.map((c) => [
    String(c.name || ""), String(c.phone || ""), String(c.dob || ""), String(c.address || ""),
    Number(c.totalOrders) || 0, Number(c.totalSpent) || 0,
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
              <div style={{ fontSize: 11, color: C.gray, marginTop: 6 }}>
                Orders {Number(c.totalOrders) || 0} · {inr(c.totalSpent || 0)}{c.lastLogin ? " · login " + new Date(Number(c.lastLogin)).toLocaleDateString("en-IN") : ""}
                {wished && <span style={{ color: C.green, fontWeight: 800 }}> · ✅ Wish bheji</span>}
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
}

class ErrorBoundary extends React.Component {` },
];

// ─────────────── APPLY ───────────────
const files = {};
let failed = false;

for (const name of ["App.jsx", "Staff.jsx"]) {
  const p = findFile(name);
  if (!p) { console.error("❌ " + name + " nahi mili (src/ ya current folder me). Project root se chalao."); failed = true; continue; }
  files[name] = { path: p, text: fs.readFileSync(p, "utf8"), skip: false };
  if (files[name].text.includes(MARK[name])) {
    console.log("⏭️  " + name + ": patch pehle se laga hua hai, skip.");
    files[name].skip = true;
  }
}
if (failed) process.exit(1);

edits.forEach((e, i) => {
  const f = files[e.file];
  if (f.skip) return;
  const n = f.text.split(e.find).length - 1;
  if (n !== 1) {
    console.error("❌ " + e.file + " edit #" + (i + 1) + ": FIND text " + n + " baar mila (1 hona chahiye). Kuch bhi change nahi kiya.\n   FIND: " + e.find.slice(0, 90));
    failed = true;
    return;
  }
  f.text = f.text.replace(e.find, () => e.replace);
});
if (failed) process.exit(1);

for (const name of Object.keys(files)) {
  const f = files[name];
  if (f.skip) continue;
  fs.copyFileSync(f.path, f.path + ".bak");
  fs.writeFileSync(f.path, f.text, "utf8");
  console.log("✅ " + f.path + " patched (backup: " + f.path + ".bak)");
}
console.log("\n🎉 Done! Ab: git add -A && git commit -m 'DOB popup + customers tab' && git push");
