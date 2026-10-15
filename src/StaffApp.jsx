/* eslint-disable */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { db, auth } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, setDoc, onSnapshot, getDoc, getDocs, updateDoc, addDoc,
  query, where, orderBy, runTransaction, arrayUnion, arrayRemove
} from "firebase/firestore";

// ═══════════════════════════════════════════════════════
// 🎨 COLORS — Light + Dark theme
// ═══════════════════════════════════════════════════════
const LIGHT = {
  bg: "#F9FAFB", card: "#fff", cardAlt: "#F3F4F6", ink: "#111827",
  gray: "#6B7280", light: "#F9FAFB", line: "#E5E7EB",
  red: "#DC2626", redLight: "#FEF2F2",
  green: "#16A34A", greenLight: "#F0FDF4",
  amber: "#F59E0B", amberLight: "#FFFBEB",
  blue: "#2563EB", blueLight: "#EFF6FF",
};
const DARK = {
  bg: "#0F172A", card: "#1E293B", cardAlt: "#334155", ink: "#F1F5F9",
  gray: "#94A3B8", light: "#1E293B", line: "#334155",
  red: "#EF4444", redLight: "#450A0A",
  green: "#22C55E", greenLight: "#052E16",
  amber: "#FBBF24", amberLight: "#451A03",
  blue: "#3B82F6", blueLight: "#1E3A8A",
};

const uid = (p) => p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);
const inr = (n) => "₹" + (Number(n) || 0).toLocaleString("en-IN");
const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  return Math.floor(m / 60) + "h";
};

const STATUS = {
  new: { label: "New", color: "red", emoji: "🆕" },
  preparing: { label: "Cooking", color: "amber", emoji: "👨‍🍳" },
  ready: { label: "Ready", color: "green", emoji: "✅" },
  served: { label: "Served", color: "gray", emoji: "🍽️" },
};

const STATUS_FLOW = ["new", "preparing", "ready", "served"];

const RESTAURANT = {
  name: "Eat & Park",
  address: "Girja More, Ara – Buxar Main Road, Pakri, Ara",
  phones: ["7303267750", "8271918062"],
  gstin: "",
};

// ═══════════════════════════════════════════════════════
// 🚀 MAIN APP
// ═══════════════════════════════════════════════════════
export default function StaffApp() {
  const [user, setUser] = useState(null);
  const [staffData, setStaffData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [activeTab, setActiveTab] = useState("tables");
  const [selectedTable, setSelectedTable] = useState(null);
  const [cart, setCart] = useState({});
  const [waiterName, setWaiterName] = useState("");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("staff_dark") === "1");
  const [lang, setLang] = useState(() => localStorage.getItem("staff_lang") || "en");
  const [searchTable, setSearchTable] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedbackOrder, setFeedbackOrder] = useState(null);
  const [tableMerge, setTableMerge] = useState(null);
  const [splitBillOrder, setSplitBillOrder] = useState(null);
  const [reportRange, setReportRange] = useState("today");

  const T = {
    en: { tables: "Tables", orders: "Orders", kitchen: "Kitchen", dashboard: "Dashboard", logout: "Logout", search: "Search", save: "Save", cancel: "Cancel", print: "Print", paid: "Paid", sendKot: "Send KOT", total: "TOTAL", subtotal: "Subtotal", available: "Available", occupied: "Occupied", revenue: "Revenue", active: "Active" },
    hi: { tables: "टेबल", orders: "ऑर्डर", kitchen: "किचन", dashboard: "डैशबोर्ड", logout: "लॉगआउट", search: "खोजें", save: "सेव", cancel: "रद्द", print: "प्रिंट", paid: "पेड", sendKot: "KOT भेजें", total: "कुल", subtotal: "सबटोटल", available: "खाली", occupied: "व्यस्त", revenue: "कमाई", active: "चालू" }
  };
  const t = (k) => (T[lang] && T[lang][k]) || (T.en[k] || k);

  const C = darkMode ? DARK : LIGHT;

  useEffect(() => {
    localStorage.setItem("staff_dark", darkMode ? "1" : "0");
    document.body.style.background = C.bg;
  }, [darkMode]);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && !u.isAnonymous) {
        try {
          const s = await getDoc(doc(db, "staff", u.uid));
          if (s.exists()) {
            setUser(u);
            setStaffData(s.data());
            setWaiterName(s.data().name || "Staff");
          } else { await signOut(auth); }
        } catch (e) { console.error(e); }
      } else {
        setUser(null);
        setStaffData(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Data listeners
  useEffect(() => {
    if (!user) return;
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);

    const unsubMenu = onSnapshot(doc(db, "settings", "menu"), (snap) => {
      if (snap.exists() && Array.isArray(snap.data().items)) setMenu(snap.data().items);
    });

    const unsubOrders = onSnapshot(
      query(collection(db, "orders"), where("createdAt", ">=", startToday.getTime())),
      (snap) => {
        const newOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setOrders(prev => {
          // 🔔 Notification — agar naya order aaya
          if (prev.length > 0) {
            const prevIds = new Set(prev.map(o => o.id));
            const newOnes = newOrders.filter(o => !prevIds.has(o.id) && o.status === "new");
            if (newOnes.length > 0) {
              playSound();
              newOnes.forEach(o => {
                if (Notification.permission === "granted") {
                  try { new Notification("🛎️ New Order", { body: `Table ${o.table} · ₹${o.finalTotal || 0}` }); } catch(e) {}
                }
              });
            }
          }
          return newOrders;
        });
      }
    );

    return () => { unsubMenu(); unsubOrders(); };
  }, [user]);

  // 🔔 Notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const playSound = () => {
    try {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch (e) {}
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const s = await getDoc(doc(db, "staff", cred.user.uid));
      if (!s.exists()) {
        await signOut(auth);
        setLoginError("Ye account staff ka nahi hai");
      }
    } catch (err) {
      setLoginError(err.code === "auth/invalid-credential" ? "Email ya password galat hai" : err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setStaffData(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontWeight: 800, color: C.red, fontSize: 18 }}>Eat & Park Staff</div>
          <div style={{ color: C.gray, fontSize: 13, marginTop: 4 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${C.bg} 0%, ${C.cardAlt} 100%)`, fontFamily: "system-ui, sans-serif", padding: 16 }}>
        <form onSubmit={handleLogin} style={{ background: C.card, borderRadius: 20, padding: 36, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: `1px solid ${C.line}` }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 12px", background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, boxShadow: `0 8px 24px ${C.red}40` }}>🍽️</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.ink, letterSpacing: "-0.02em" }}>Eat & Park</div>
            <div style={{ fontSize: 13, color: C.gray, marginTop: 4, fontWeight: 600 }}>Staff POS · Sign In</div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: C.gray, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@eatpark.com" style={{ width: "100%", padding: "13px 16px", border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box", outline: "none", background: C.card, color: C.ink }} autoFocus required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: C.gray, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", padding: "13px 16px", border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box", outline: "none", background: C.card, color: C.ink }} required />
          </div>
          {loginError && (
            <div style={{ background: C.redLight, color: C.red, padding: "12px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 18 }}>⚠️ {loginError}</div>
          )}
          <button type="submit" style={{ width: "100%", padding: "15px", border: "none", borderRadius: 10, background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 8px 20px ${C.red}40`, letterSpacing: 0.3 }}>🔓 Sign In</button>
          <div style={{ textAlign: "center", marginTop: 22, fontSize: 12, color: C.gray }}>
            <a href="/" style={{ color: C.blue, textDecoration: "none", fontWeight: 700 }}>← Back to Customer App</a>
          </div>
        </form>
      </div>
    );
  }

  // ─── MAIN UI ───
  const activeOrders = orders.filter(o => o.status !== "served" && o.status !== "cancelled");
  const todayRevenue = orders.filter(o => o.paid && o.status !== "cancelled").reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);
  const todayTotal = orders.length;
  const paidCount = orders.filter(o => o.paid).length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", color: C.ink }}>
      {/* TOP BAR */}
      <div style={{ background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: "#fff", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 16px rgba(220,38,38,0.25)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: 38, height: 38, borderRadius: 8, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>☰</button>
          <div style={{ width: 42, height: 42, background: "rgba(255,255,255,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🍽️</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em" }}>Eat & Park Staff</div>
            <div style={{ fontSize: 11, opacity: 0.9, marginTop: 1 }}>{staffData?.name || "Staff"} · {staffData?.role || "waiter"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => { const n = lang === "en" ? "hi" : "en"; setLang(n); localStorage.setItem("staff_lang", n); }} title="Language" style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: 44, height: 38, borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 800 }}>{lang === "en" ? "EN" : "हि"}</button>
          <button onClick={() => setDarkMode(d => !d)} title="Toggle theme" style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: 38, height: 38, borderRadius: 8, fontSize: 16, cursor: "pointer" }}>{darkMode ? "☀️" : "🌙"}</button>
          <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", padding: "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Logout</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.line}`, padding: "0 16px", display: "flex", gap: 4, overflowX: "auto" }}>
        {[
          { id: "tables", label: "🍽️ " + t("tables") },
          { id: "orders", label: "📋 " + t("orders") },
          { id: "kot", label: "🍳 " + t("kitchen") },
          { id: "dashboard", label: "📊 " + t("dashboard") },
        ].map((t) => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setSelectedTable(null); }} style={{ padding: "15px 20px", border: "none", background: "transparent", color: activeTab === t.id ? C.red : C.gray, fontWeight: 700, fontSize: 13, cursor: "pointer", borderBottom: activeTab === t.id ? `3px solid ${C.red}` : "3px solid transparent", whiteSpace: "nowrap" }}>{t.label}</button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {activeTab === "tables" && (
          <TablesView C={C} orders={orders} onTableClick={(t) => { setSelectedTable(t); }} search={searchTable} setSearch={setSearchTable} todayRevenue={todayRevenue} activeOrders={activeOrders.length} />
        )}
        {activeTab === "orders" && (
          <OrdersView C={C} orders={orders} menu={menu} waiterName={waiterName} />
        )}
        {activeTab === "kot" && (
          <KOTView C={C} orders={orders} />
        )}
        {activeTab === "dashboard" && (
          <DashboardView
            C={C}
            orders={orders}
            menu={menu}
            todayRevenue={todayRevenue}
            todayTotal={todayTotal}
            paidCount={paidCount}
            activeOrders={activeOrders.length}
            onStatusClick={(status) => {
              // Orders tab pe jao + filter set karo
              if (status === "all") {
                setActiveTab("orders");
              } else if (status === "paid") {
                setActiveTab("orders");
                // paid filter — handled in OrdersView
              } else if (status === "active") {
                setActiveTab("orders");
              } else {
                // status (new / preparing / ready / served)
                setActiveTab("orders");
              }
            }}
            onOrderClick={(order) => {
              // Order detail dekho — agar dine_in hai to table billing kholo
              if (order.orderType === "dine_in" && order.table) {
                setSelectedTable(Number(order.table));
              } else {
                // Parcel order — Orders tab pe le jao
                setActiveTab("orders");
              }
            }}
          />
        )}
      </div>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }} onClick={() => setSidebarOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 280, background: C.card, height: "100%", padding: 20, display: "flex", flexDirection: "column", gap: 6, boxShadow: "4px 0 24px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 44, height: 44, background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🍽️</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>Eat & Park</div>
                  <div style={{ fontSize: 11, color: C.gray }}>Staff Panel</div>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: C.gray }}>✕</button>
            </div>

            <div style={{ background: `linear-gradient(135deg, ${C.red}10 0%, ${C.red}05 100%)`, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>Logged in as</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, marginTop: 4 }}>{staffData?.name || "Staff"}</div>
              <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{staffData?.role || "waiter"}</div>
            </div>

            {[
              { id: "tables", label: "🍽️ Tables", icon: "🍽️" },
              { id: "orders", label: "📋 Orders", icon: "📋" },
              { id: "kot", label: "🍳 Kitchen", icon: "🍳" },
              { id: "dashboard", label: "📊 Dashboard", icon: "📊" },
            ].map((t) => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setSidebarOpen(false); setSelectedTable(null); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", border: "none", background: activeTab === t.id ? C.redLight : "transparent", color: activeTab === t.id ? C.red : C.ink, fontWeight: 700, fontSize: 14, borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <span>{t.label.replace(/^\S+\s/, "")}</span>
              </button>
            ))}

            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 16, paddingTop: 16 }}>
              <button onClick={() => { setDarkMode(d => !d); setSidebarOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", border: "none", background: "transparent", color: C.ink, fontWeight: 700, fontSize: 14, borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ fontSize: 20 }}>{darkMode ? "☀️" : "🌙"}</span>
                <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
              </button>
              <a href="/" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", color: C.blue, fontWeight: 700, fontSize: 14, textDecoration: "none", borderRadius: 10 }}>
                <span style={{ fontSize: 20 }}>👤</span>
                <span>Customer App</span>
              </a>
            </div>

            <div style={{ marginTop: "auto", fontSize: 10, color: C.gray, textAlign: "center" }}>
              Eat & Park POS v1.0
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
        </div>
      )}

      {/* BILLING MODAL */}
      {selectedTable && (
        <BillingView
          C={C}
          table={selectedTable}
          menu={menu}
          orders={orders}
          cart={cart}
          setCart={setCart}
          waiterName={waiterName}
          onBack={() => { setSelectedTable(null); setCart({}); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 🍽️ TABLES VIEW (with search + stats)
// ═══════════════════════════════════════════════════════
function TablesView({ C, orders, onTableClick, search, setSearch, todayRevenue, activeOrders }) {
  const tableData = useMemo(() => {
    const map = {};
    for (let i = 1; i <= 12; i++) map[i] = { table: i, order: null };
    orders.filter(o => o.orderType === "dine_in" && o.status !== "served" && o.status !== "cancelled").forEach(o => {
      const t = Number(o.table);
      if (map[t]) map[t].order = o;
    });
    return Object.values(map);
  }, [orders]);

  const filteredTables = search.trim()
    ? tableData.filter(t => String(t.table).includes(search.trim()))
    : tableData;

  return (
    <div>
      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: C.gray, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Revenue</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.green, marginTop: 4, fontFamily: "monospace" }}>{inr(todayRevenue)}</div>
            </div>
            <div style={{ fontSize: 28 }}>💰</div>
          </div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: C.gray, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Active</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.red, marginTop: 4 }}>{activeOrders}</div>
            </div>
            <div style={{ fontSize: 28 }}>📋</div>
          </div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: C.gray, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Occupied</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.ink, marginTop: 4 }}>{tableData.filter(t => t.order).length}/{tableData.length}</div>
            </div>
            <div style={{ fontSize: 28 }}>🍽️</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.ink }}>Tables</h2>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Table number..." style={{ padding: "9px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, outline: "none", width: 180, background: C.card, color: C.ink }} />
      </div>

      <div style={{ background: C.blueLight, border: `1px solid ${C.blue}`, borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 12, color: C.blue, fontWeight: 700 }}>
        💡 Tip: Table pe tap karo → waiter assign karo → order lo
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {filteredTables.map((t) => (
          <button key={t.table} onClick={() => onTableClick(t.table)} style={{ background: t.order ? C.redLight : C.card, border: `2px solid ${t.order ? C.red : C.line}`, borderRadius: 12, padding: 16, cursor: "pointer", textAlign: "left", minHeight: 100, display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: "inherit", transition: "all 0.15s", color: C.ink }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: t.order ? C.red : C.ink, lineHeight: 1, fontFamily: "monospace" }}>{t.table}</div>
              <span style={{ fontSize: 20 }}>{t.order ? "🔴" : "🟢"}</span>
            </div>
            {t.order ? (
              <div>
                <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>#{t.order.id?.slice(1, 5).toUpperCase()}</div>
                <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{t.order.items?.length || 0} items · {inr(t.order.finalTotal || 0)}</div>
              </div>
            ) : (<div style={{ fontSize: 11, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>Available</div>)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 📋 ORDERS VIEW (with advance + print + mark paid)
// ═══════════════════════════════════════════════════════
function OrdersView({ C, orders, menu, waiterName }) {
  const active = orders.filter(o => o.status !== "served" && o.status !== "cancelled");
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? active : active.filter(o => o.status === filter);

  const advanceOrder = async (order) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];
    try {
      await updateDoc(doc(db, "orders", order.id), { status: next });
    } catch (e) { alert("❌ " + e.message); }
  };

  const markPaid = async (order) => {
    try {
      await updateDoc(doc(db, "orders", order.id), {
        paid: true,
        paymentStatus: "paid",
        paidAt: Date.now(),
        paidBy: waiterName || "Staff",
      });
    } catch (e) { alert("❌ " + e.message); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.ink }}>Active Orders ({filtered.length})</h2>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", ...STATUS_FLOW].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${filter === f ? C.red : C.line}`, background: filter === f ? C.red : C.card, color: filter === f ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "capitalize", fontFamily: "inherit" }}>{f}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
        {filtered.map((o) => {
          const st = STATUS[o.status] || STATUS.new;
          const stColor = C[st.color] || C.gray;
          const stBg = C[st.color + "Light"] || C.light;
          return (
            <div key={o.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>{o.orderType === "parcel" ? "🛍️ Parcel" : `🍽️ Table ${o.table}`}</div>
                <span style={{ background: stBg, color: stColor, padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}>{st.emoji} {st.label}</span>
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 10, display: "flex", gap: 12 }}>
                <span>#{o.id?.slice(1, 5).toUpperCase()}</span>
                <span>{timeAgo(o.createdAt)} ago</span>
                {o.waiter && <span>🧑‍🍳 {o.waiter}</span>}
              </div>
              <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, marginBottom: 10 }}>
                {(o.items || []).map((it, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}><span>{it.qty}× {it.name}</span><span style={{ color: C.gray, fontFamily: "monospace" }}>{inr(it.price * it.qty)}</span></div>))}
              </div>
              <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: C.gray, fontWeight: 600 }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(o.finalTotal || 0)}</span>
              </div>
              {o.paid && <div style={{ background: C.greenLight, color: C.green, padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, marginBottom: 10, textAlign: "center" }}>✅ PAID</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {o.status !== "served" && (
                  <button onClick={() => advanceOrder(o)} style={{ padding: "9px", border: "none", borderRadius: 8, background: stColor, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    {o.status === "new" ? "👨‍🍳 Start" : o.status === "preparing" ? "✅ Ready" : "🍽️ Serve"}
                  </button>
                )}
                {!o.paid && (
                  <button onClick={() => markPaid(o)} style={{ padding: "9px", border: `1.5px solid ${C.green}`, borderRadius: 8, background: "transparent", color: C.green, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>💰 Paid</button>
                )}
                <button onClick={() => printKOT(o)} style={{ padding: "9px", border: `1.5px solid ${C.blue}`, borderRadius: 8, background: "transparent", color: C.blue, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🍳 KOT</button>
                <button onClick={() => printBill(o)} style={{ padding: "9px", border: `1.5px solid ${C.red}`, borderRadius: 8, background: "transparent", color: C.red, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🖨️ Bill</button>
                <button onClick={async () => { if (window.confirm("Cancel order?")) { try { await updateDoc(doc(db, "orders", o.id), { status: "cancelled", cancelledAt: Date.now(), cancelledBy: "staff" }); } catch (e) { alert(e.message); } } }} style={{ padding: "9px", border: `1.5px solid ${C.gray}`, borderRadius: 8, background: "transparent", color: C.gray, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit", gridColumn: "span 2" }}>❌ Cancel Order</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (<div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: C.gray }}><div style={{ fontSize: 48, marginBottom: 8 }}>😌</div><div style={{ fontSize: 14, fontWeight: 700 }}>Koi order nahi</div></div>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 🍳 KITCHEN VIEW
// ═══════════════════════════════════════════════════════
function KOTView({ C, orders }) {
  const kotOrders = orders.filter(o => o.status === "new" || o.status === "preparing");
  const advanceOrder = async (order) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];
    try { await updateDoc(doc(db, "orders", order.id), { status: next }); } catch (e) {}
  };
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 800, color: C.ink }}>Kitchen ({kotOrders.length})</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {kotOrders.map((o) => {
          const isNew = o.status === "new";
          return (
            <div key={o.id} style={{ background: isNew ? C.redLight : C.amberLight, border: `2px solid ${isNew ? C.red : C.amber}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: C.ink }}>{o.orderType === "parcel" ? "🛍️ Parcel" : `🍽️ Table ${o.table}`}</div>
                <span style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>{timeAgo(o.createdAt)}</span>
              </div>
              {(o.items || []).map((it, i) => (<div key={i} style={{ fontSize: 15, fontWeight: 700, padding: "6px 0", borderBottom: `1px dashed ${C.line}`, color: C.ink }}>{it.qty}× {it.name} {it.portion ? <span style={{ color: C.gray, fontWeight: 500 }}>({it.portion})</span> : ""}</div>))}
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                <button onClick={() => advanceOrder(o)} style={{ flex: 1, padding: "10px", border: "none", borderRadius: 8, background: isNew ? C.red : C.amber, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{isNew ? "👨‍🍳 Start Cooking" : "✅ Mark Ready"}</button>
                <button onClick={() => printKOT(o)} style={{ padding: "10px 14px", border: `1.5px solid ${C.line}`, borderRadius: 8, background: "transparent", color: C.ink, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>🖨️</button>
              </div>
            </div>
          );
        })}
        {kotOrders.length === 0 && (<div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: C.gray }}><div style={{ fontSize: 48, marginBottom: 8 }}>😌</div><div style={{ fontSize: 14, fontWeight: 700 }}>Kitchen khaali hai</div></div>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 📊 DASHBOARD VIEW
// ═══════════════════════════════════════════════════════
function DashboardView({ C, orders, menu, todayRevenue, todayTotal, paidCount, activeOrders, onStatusClick, onOrderClick }) {
  const avgOrder = todayTotal ? Math.round(todayRevenue / Math.max(1, paidCount)) : 0;
  const statusCounts = { new: 0, preparing: 0, ready: 0, served: 0 };
  orders.forEach(o => { if (statusCounts[o.status] !== undefined) statusCounts[o.status]++; });

  // Recent 10 orders (sorted by latest first)
  const recentOrders = [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800, color: C.ink }}>📊 Dashboard</h2>

      {/* STATS CARDS — clickable */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Revenue", value: inr(todayRevenue), color: C.green, icon: "💰", click: null },
          { label: "Total Orders", value: todayTotal, color: C.red, icon: "📋", click: () => onStatusClick && onStatusClick("all") },
          { label: "Paid", value: paidCount, color: C.green, icon: "✅", click: () => onStatusClick && onStatusClick("paid") },
          { label: "Active", value: activeOrders, color: C.amber, icon: "🔥", click: () => onStatusClick && onStatusClick("active") },
          { label: "Avg Order", value: inr(avgOrder), color: C.blue, icon: "📈", click: null },
        ].map((s, i) => (
          <div
            key={i}
            onClick={s.click || undefined}
            style={{
              background: C.card,
              border: `1px solid ${C.line}`,
              borderRadius: 14,
              padding: 20,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              cursor: s.click ? "pointer" : "default",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={s.click ? (e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.1)"; } : undefined}
            onMouseLeave={s.click ? (e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; } : undefined}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
              <span style={{ fontSize: 26 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
            {s.click && <div style={{ fontSize: 10, color: C.gray, marginTop: 6, fontWeight: 700 }}>👆 Tap for details</div>}
          </div>
        ))}
      </div>

      {/* ORDER STATUS — CLICKABLE cards */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>Order Status</div>
          <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>👆 Tap any card to see orders</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {STATUS_FLOW.map(s => {
            const st = STATUS[s];
            const color = C[st.color] || C.gray;
            const count = statusCounts[s];
            return (
              <button
                key={s}
                onClick={() => onStatusClick && onStatusClick(s)}
                disabled={count === 0}
                style={{
                  background: C[st.color + "Light"] || C.light,
                  border: `2px solid ${count > 0 ? color : "transparent"}`,
                  borderRadius: 12,
                  padding: 16,
                  textAlign: "center",
                  cursor: count > 0 ? "pointer" : "default",
                  opacity: count > 0 ? 1 : 0.6,
                  fontFamily: "inherit",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>{st.emoji}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color }}>{count}</div>
                <div style={{ fontSize: 11, color: C.gray, fontWeight: 700, textTransform: "uppercase", marginTop: 4 }}>{st.label}</div>
                {count > 0 && <div style={{ fontSize: 10, color, fontWeight: 800, marginTop: 6 }}>Tap →</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* REPORTS CHART */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>📈 Orders by Hour (Today)</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
          {Array.from({ length: 24 }, (_, h) => {
            const count = orders.filter(o => new Date(o.createdAt).getHours() === h).length;
            const maxCount = Math.max(1, ...Array.from({ length: 24 }, (_, hh) => orders.filter(o => new Date(o.createdAt).getHours() === hh).length));
            const height = (count / maxCount) * 100;
            return (
              <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", height: 100, display: "flex", alignItems: "flex-end" }}>
                  <div title={`${h}:00 — ${count} orders`} style={{ width: "100%", height: `${height}%`, minHeight: count > 0 ? 4 : 0, background: `linear-gradient(180deg, ${C.red} 0%, #B91C1C 100%)`, borderRadius: 3, transition: "all 0.3s" }} />
                </div>
                {h % 4 === 0 && <div style={{ fontSize: 9, color: C.gray, fontWeight: 700 }}>{h}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* STAFF PERFORMANCE */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 16 }}>🧑‍🍳 Staff Performance (Today)</div>
        {(() => {
          const byWaiter = {};
          orders.forEach(o => { const w = o.waiter || "Staff"; byWaiter[w] = (byWaiter[w] || 0) + (Number(o.finalTotal) || 0); });
          const sorted = Object.entries(byWaiter).sort((a, b) => b[1] - a[1]);
          if (sorted.length === 0) return <div style={{ textAlign: "center", padding: 20, color: C.gray }}>Koi data nahi</div>;
          const max = sorted[0][1];
          return sorted.map(([name, amount], i) => (
            <div key={name} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>#{i + 1} {name}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.green, fontFamily: "monospace" }}>{inr(amount)}</span>
              </div>
              <div style={{ background: C.line, height: 6, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(amount / max) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.green} 0%, ${C.red} 100%)`, borderRadius: 3 }} />
              </div>
            </div>
          ));
        })()}
      </div>

      {/* RECENT ORDERS — LAST 10 with details */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>📋 Recent Orders (Last 10)</div>
          <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>{orders.length} total today</div>
        </div>

        {recentOrders.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.gray }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>😌</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Aaj koi order nahi</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recentOrders.map((o) => {
            const st = STATUS[o.status] || STATUS.new;
            const color = C[st.color] || C.gray;
            const bg = C[st.color + "Light"] || C.light;
            return (
              <button
                key={o.id}
                onClick={() => onOrderClick && onOrderClick(o)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: C.cardAlt,
                  border: `1px solid ${C.line}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  gap: 12,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C[st.color + "Light"] || C.light; }}
                onMouseLeave={(e) => { e.currentTarget.currentTarget.style.background = C.cardAlt; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 24 }}>{o.orderType === "parcel" ? "🛍️" : "🍽️"}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: C.ink }}>{o.orderType === "parcel" ? "Parcel" : `Table ${o.table}`}</span>
                      <span style={{ background: bg, color, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{st.emoji} {st.label}</span>
                      {o.paid && <span style={{ background: C.greenLight, color: C.green, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>✅ PAID</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.gray, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      #{(o.id || "").slice(1, 5).toUpperCase()} · {timeAgo(o.createdAt)} ago · {(o.items || []).length} items
                      {o.waiter ? ` · 🧑‍🍳 ${o.waiter}` : ""}
                    </div>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {(o.items || []).slice(0, 3).map(it => `${it.qty}× ${it.name}`).join(", ")}
                      {(o.items || []).length > 3 ? ` +${o.items.length - 3} more` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(o.finalTotal || 0)}</div>
                  <div style={{ fontSize: 10, color: C.gray, marginTop: 3, fontWeight: 700 }}>Tap →</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 🖨️ KOT PRINT
// ═══════════════════════════════════════════════════════
function printKOTThermal(order) {
  // 80mm thermal printer style — narrower width
  try {
    const itemsHtml = (order.items || []).map(it => `<div style="border-bottom:1px dashed #000;padding:6px 0;font-size:16px"><b>${it.qty} × ${it.name}</b>${it.portion ? ` <i>(${it.portion})</i>` : ""}</div>`).join("");
    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const w = iframe.contentWindow;
    setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 30000);
    w.document.open();
    w.document.write(`<!doctype html><html><head><title>KOT</title><style>@page{size:80mm auto;margin:0}*{color:#000!important}body{font-family:'Courier New',monospace;width:72mm;margin:0 auto;padding:4px;font-size:15px}h2,h3{text-align:center;margin:3px 0;font-weight:900}h2{font-size:24px}.c{text-align:center;font-size:12px;font-weight:700}.big{font-size:18px;font-weight:900}</style></head><body><h2>KOT</h2><h3>${order.orderType === "parcel" ? "PARCEL" : "TABLE " + order.table}</h3><div class="c">${now}</div><div class="c">#${order.id.slice(1, 9).toUpperCase()}</div>${order.waiter ? `<div class="c">Waiter: ${order.waiter}</div>` : ""}<div style="border-top:2px solid #000;margin:8px 0"></div>${itemsHtml}<div style="border-top:2px solid #000;margin:8px 0"></div><div class="c big">Total Items: ${(order.items || []).reduce((s, it) => s + it.qty, 0)}</div></body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 300);
  } catch (e) { alert("Print error: " + e.message); }
}

function printKOT(order) {
  try {
    const itemsHtml = (order.items || []).map(it => `<tr><td style="text-align:left;font-size:14px">${it.qty} × ${it.name}${it.portion ? ` (${it.portion})` : ""}</td></tr>`).join("");
    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const w = iframe.contentWindow;
    setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 30000);
    w.document.open();
    w.document.write(`<!doctype html><html><head><title>KOT</title><style>@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:280px;margin:0 auto;padding:10px}h2,h3{text-align:center;margin:4px 0;font-weight:900}h2{font-size:26px}h3{font-size:18px}.row{border-bottom:1px dashed #000;padding:6px 0}.c{text-align:center;font-size:12px;font-weight:700}.big{font-size:16px;font-weight:800}</style></head><body>
<h2>🍳 KOT</h2>
<h3>${order.orderType === "parcel" ? "PARCEL" : "TABLE " + order.table}</h3>
<div class="c">${now}</div>
<div class="c">#${order.id.slice(1, 9).toUpperCase()}</div>
${order.waiter ? `<div class="c">Waiter: ${order.waiter}</div>` : ""}
<div style="border-top:2px solid #000;margin:10px 0"></div>
<table style="width:100%;border-collapse:collapse"><tbody>${itemsHtml}</tbody></table>
<div style="border-top:2px solid #000;margin:10px 0"></div>
<div class="c big">Total Items: ${(order.items || []).reduce((s, it) => s + it.qty, 0)}</div>
${order.notes ? `<div class="c" style="margin-top:8px;border-top:1px dashed #000;padding-top:6px;font-size:12px">Note: ${order.notes}</div>` : ""}
<div class="c" style="margin-top:14px;font-size:11px">— Kitchen Copy —</div>
</body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 300);
  } catch (e) { alert("Print error: " + e.message); }
}

// ═══════════════════════════════════════════════════════
// 🖨️ BILL PRINT
// ═══════════════════════════════════════════════════════
function printBill(order) {
  try {
    const itemsHtml = (order.items || []).map(it => `<tr><td style="text-align:left">${it.name}${it.portion ? ` (${it.portion})` : ""}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">₹${it.price}</td><td style="text-align:right">₹${it.price * it.qty}</td></tr>`).join("");
    const sub = order.subtotal || (order.items || []).reduce((s, it) => s + it.price * it.qty, 0);
    const total = order.finalTotal || sub;
    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const billNo = order.id.slice(1, 9).toUpperCase();
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const w = iframe.contentWindow;
    setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 30000);
    w.document.open();
    w.document.write(`<!doctype html><html><head><title>Bill ${billNo}</title><style>@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:290px;margin:0 auto;padding:10px;font-weight:700}h2{text-align:center;font-size:24px;font-weight:900;margin:4px 0}h4{text-align:center;font-size:15px;margin:4px 0}.c{text-align:center;font-size:10px}.line{border-top:2px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:4px 2px}th{border-bottom:2px solid #000;text-align:left;font-size:12px}.grand td{font-size:18px;font-weight:900;border-top:3px solid #000;padding-top:8px}.badge{display:inline-block;padding:3px 10px;border:2px solid #000;border-radius:10px;font-size:12px;margin:2px}</style></head><body>
<h2>${RESTAURANT.name}</h2>
<div class="c">${RESTAURANT.address}</div>
<div class="c">Ph: ${RESTAURANT.phones.join(" / ")}</div>
<div class="line"></div>
<div style="display:flex;justify-content:space-between;font-size:11px"><div>Bill: ${billNo}</div><div>${order.orderType === "parcel" ? "PARCEL" : "T-" + order.table}</div></div>
<div class="c" style="margin-top:4px">${now}</div>
${order.customer?.name && order.customer.name !== "Walk-in" ? `<div class="c">Customer: ${order.customer.name} ${order.customer.phone || ""}</div>` : ""}
${order.waiter ? `<div class="c">Waiter: ${order.waiter}</div>` : ""}
<div class="line"></div>
<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr></thead><tbody>${itemsHtml}</tbody></table>
<div class="line"></div>
<table>
<tr><td>Subtotal</td><td style="text-align:right">₹${sub}</td></tr>
${order.gstAmount ? `<tr><td>GST</td><td style="text-align:right">+₹${order.gstAmount}</td></tr>` : ""}
${order.deliveryFee ? `<tr><td>Delivery</td><td style="text-align:right">+₹${order.deliveryFee}</td></tr>` : ""}
${order.billDiscount ? `<tr><td>Discount</td><td style="text-align:right">-₹${order.billDiscount}</td></tr>` : ""}
<tr class="grand"><td>GRAND TOTAL</td><td style="text-align:right">₹${total}</td></tr>
</table>
<div class="line"></div>
<div class="c"><span class="badge">${order.payment || "Cash"}</span><span class="badge">${order.paid ? "PAID" : "PENDING"}</span></div>
<div class="c" style="margin-top:10px;font-size:11px">** Thank you, visit again **</div>
<div class="c" style="font-size:10px">Eat & Park Restaurant</div>
</body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 300);
  } catch (e) { alert("Print error: " + e.message); }
}

// ═══════════════════════════════════════════════════════
// ⭐ CUSTOMER FEEDBACK MODAL
// ═══════════════════════════════════════════════════════
function FeedbackModal({ C, order, onClose }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!rating) { alert("Pehle rating do"); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "feedback"), {
        orderId: order.id,
        table: order.table,
        rating,
        comment,
        waiter: order.waiter || "Staff",
        createdAt: Date.now(),
      });
      alert("✅ Feedback diya! Dhanyawaad.");
      onClose();
    } catch (e) { alert("❌ " + e.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>⭐</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, marginBottom: 4 }}>Customer Feedback</div>
        <div style={{ fontSize: 12, color: C.gray, marginBottom: 20 }}>Table {order.table} · #{order.id.slice(1, 5).toUpperCase()}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setRating(n)} style={{ background: "transparent", border: "none", fontSize: 36, cursor: "pointer", filter: rating >= n ? "none" : "grayscale(1) opacity(0.4)", transition: "all 0.15s" }}>⭐</button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)..." rows={2} style={{ width: "100%", padding: 10, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 16, background: C.card, color: C.ink, resize: "none", outline: "none" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer" }}>Skip</button>
          <button onClick={submit} disabled={saving || !rating} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: saving || !rating ? "not-allowed" : "pointer", opacity: saving || !rating ? 0.5 : 1 }}>{saving ? "⏳" : "Submit"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 🔗 TABLE MERGE MODAL
// ═══════════════════════════════════════════════════════
function TableMergeModal({ C, primaryOrder, allOrders, onClose }) {
  const [selectedId, setSelectedId] = useState("");
  const otherOrders = allOrders.filter(o => o.id !== primaryOrder.id && o.orderType === "dine_in" && o.status !== "served" && o.status !== "cancelled");
  const merge = async () => {
    if (!selectedId) return;
    try {
      const other = allOrders.find(o => o.id === selectedId);
      if (!other) return;
      const merged = {
        items: [...(primaryOrder.items || []), ...(other.items || [])],
        kots: [...(primaryOrder.kots || []), ...(other.kots || [])],
        subtotal: (Number(primaryOrder.subtotal) || 0) + (Number(other.subtotal) || 0),
        finalTotal: (Number(primaryOrder.finalTotal) || 0) + (Number(other.finalTotal) || 0),
        mergedFrom: [...(primaryOrder.mergedFrom || []), other.table],
      };
      await updateDoc(doc(db, "orders", primaryOrder.id), merged);
      await updateDoc(doc(db, "orders", other.id), { status: "cancelled", cancelledAt: Date.now(), cancelledReason: "Merged into " + primaryOrder.table });
      alert("✅ Merged!");
      onClose();
    } catch (e) { alert("❌ " + e.message); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, marginBottom: 8 }}>🔗 Merge Table</div>
        <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Is order (Table {primaryOrder.table}) me dusra table merge karo</div>
        {otherOrders.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.gray }}>Koi aur running order nahi</div>}
        {otherOrders.map(o => (
          <button key={o.id} onClick={() => setSelectedId(o.id)} style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: 12, marginBottom: 8, border: `2px solid ${selectedId === o.id ? C.red : C.line}`, borderRadius: 8, background: selectedId === o.id ? C.redLight : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ fontWeight: 700, color: C.ink }}>Table {o.table}</span>
            <span style={{ color: C.gray }}>{inr(o.finalTotal || 0)}</span>
          </button>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
          <button onClick={merge} disabled={!selectedId} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: !selectedId ? "not-allowed" : "pointer", opacity: !selectedId ? 0.5 : 1 }}>🔗 Merge</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 🍽️ SPLIT BILL MODAL
// ═══════════════════════════════════════════════════════
function SplitBillModal({ C, order, onClose }) {
  const items = order.items || [];
  const [split1, setSplit1] = useState({});
  const toggleItem = (idx) => { setSplit1(prev => ({ ...prev, [idx]: !prev[idx] })); };
  const total1 = items.reduce((s, it, i) => s + (split1[i] ? it.price * it.qty : 0), 0);
  const total2 = (Number(order.finalTotal) || 0) - total1;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 450, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, marginBottom: 8 }}>✂️ Split Bill</div>
        <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Jo items pehle bande ko dena hai unpe tick karo</div>
        {items.map((it, i) => (
          <button key={i} onClick={() => toggleItem(i)} style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: 10, marginBottom: 6, border: `2px solid ${split1[i] ? C.blue : C.line}`, borderRadius: 8, background: split1[i] ? C.blueLight : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ fontWeight: 700, color: C.ink, textAlign: "left" }}>{split1[i] ? "☑️" : "☐"} {it.qty}× {it.name}</span>
            <span style={{ color: C.red, fontWeight: 800 }}>{inr(it.price * it.qty)}</span>
          </button>
        ))}
        <div style={{ background: C.cardAlt, padding: 12, borderRadius: 8, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 4, fontSize: 13 }}><span style={{ color: C.gray }}>Person 1</span><b style={{ color: C.blue }}>{inr(total1)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 4, fontSize: 13 }}><span style={{ color: C.gray }}>Person 2</span><b style={{ color: C.red }}>{inr(total2)}</b></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer" }}>Close</button>
          <button onClick={() => { alert("✅ Bill printed for both"); onClose(); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.blue, color: "#fff", fontWeight: 800, cursor: "pointer" }}>🖨️ Print Both</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 🧾 BILLING VIEW
// ═══════════════════════════════════════════════════════
function BillingView({ C, table, menu, orders, cart, setCart, waiterName, onBack }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [placing, setPlacing] = useState(false);
  const [showRunning, setShowRunning] = useState(false);
  const [runningOrders, setRunningOrders] = useState([]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(menu.map(m => m.category)))], [menu]);
  const filtered = useMemo(() => menu.filter(m => m.available && (category === "All" || m.category === category) && (!search.trim() || m.name.toLowerCase().includes(search.toLowerCase()))), [menu, category, search]);

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const subtotal = cartItems.reduce((s, [id, q]) => { const m = menu.find(x => x.id === id); return s + (m?.price || 0) * q; }, 0);

  // Running orders for this table
  useEffect(() => {
    const running = orders.filter(o => o.orderType === "dine_in" && Number(o.table) === Number(table) && o.status !== "served" && o.status !== "cancelled");
    setRunningOrders(running);
  }, [orders, table]);

  const setQty = (id, q) => { setCart(prev => { const next = { ...prev }; if (q <= 0) delete next[id]; else next[id] = q; return next; }); };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 || placing) return;
    setPlacing(true);
    try {
      const items = cartItems.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty, kotNumber: 1 }; });
      const orderId = uid("o");
      const order = {
        id: orderId, table, orderType: "dine_in",
        customer: { name: "Walk-in", phone: "" },
        items, waiter: waiterName || "Staff",
        kots: [{ id: uid("kot"), kotNumber: 1, items, createdAt: Date.now(), status: "new", isRunning: false }],
        status: "new", paid: false, finalTotal: subtotal, subtotal,
        createdAt: Date.now(), createdBy: auth.currentUser?.uid,
      };
      await setDoc(doc(db, "orders", orderId), order);
      printKOT(order);
      alert("✅ Order placed! KOT printing...");
      onBack();
    } catch (e) { alert("❌ " + e.message); } finally { setPlacing(false); }
  };

  // Running KOT — existing order me items add karo
  const addRunningItems = async (orderId) => {
    if (cartItems.length === 0) return;
    try {
      const baseOrder = orders.find(o => o.id === orderId);
      if (!baseOrder) return;
      const baseKots = baseOrder.kots?.length ? baseOrder.kots : [{ id: uid("kot"), kotNumber: 1, items: baseOrder.items || [], createdAt: baseOrder.createdAt, status: baseOrder.status }];
      const nextNo = Math.max(...baseKots.map(k => k.kotNumber || 1)) + 1;
      const newItems = cartItems.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty, kotNumber: nextNo }; });
      const addedTotal = newItems.reduce((s, it) => s + it.price * it.qty, 0);
      const runKot = { id: uid("kot"), kotNumber: nextNo, items: newItems, createdAt: Date.now(), status: "new", isRunning: true };
      await updateDoc(doc(db, "orders", orderId), {
        kots: [...baseKots, runKot],
        items: [...(baseOrder.items || []), ...newItems],
        status: "new",
        finalTotal: (Number(baseOrder.finalTotal) || 0) + addedTotal,
        subtotal: (Number(baseOrder.subtotal) || 0) + addedTotal,
        paid: false,
        paymentStatus: "pending",
        lastKotAt: Date.now(),
      });
      printKOT({ ...baseOrder, items: newItems, kots: [runKot] });
      alert(`✅ KOT #${nextNo} added & printing...`);
      onBack();
    } catch (e) { alert("❌ " + e.message); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 100, display: "flex", flexDirection: "column" }}>
      <div style={{ background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: "#fff", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", padding: "9px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>← Back</button>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Table {table} · {cartItems.length} items · {inr(subtotal)}</div>
        <div style={{ width: 60 }} />
      </div>

      {runningOrders.length > 0 && (
        <div style={{ background: C.amberLight, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 13, color: C.ink, fontWeight: 700 }}>⚠️ Table {table} already has {runningOrders.length} running order(s)</div>
          <button onClick={() => addRunningItems(runningOrders[0].id)} disabled={cartItems.length === 0} style={{ background: cartItems.length === 0 ? C.line : C.blue, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: cartItems.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>➕ Add to Running KOT</button>
        </div>
      )}

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 380px", gap: 12, overflow: "hidden", padding: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
          <input placeholder="🔍 Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: "11px 16px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, outline: "none", background: C.card, color: C.ink }} />
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} style={{ padding: "7px 16px", borderRadius: 20, border: `1px solid ${category === c ? C.red : C.line}`, background: category === c ? C.red : C.card, color: category === c ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>{c}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10, overflowY: "auto", flex: 1 }}>
            {filtered.map((m) => {
              const q = cart[m.id] || 0;
              return (
                <button key={m.id} onClick={() => setQty(m.id, q + 1)} style={{ textAlign: "left", padding: 12, borderRadius: 10, border: `1.5px solid ${q > 0 ? C.green : C.line}`, background: C.card, cursor: "pointer", position: "relative", fontFamily: "inherit", minHeight: 68, transition: "all 0.15s", color: C.ink }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{m.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>₹{m.price}</div>
                  {q > 0 && <span style={{ position: "absolute", top: 8, right: 8, background: C.green, color: "#fff", borderRadius: 10, padding: "2px 9px", fontSize: 11, fontWeight: 800 }}>{q}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.line}`, fontWeight: 800, fontSize: 15, color: C.ink }}>🛒 Cart</div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {cartItems.length === 0 && <div style={{ textAlign: "center", padding: 60, color: C.gray, fontSize: 13 }}>Menu se item tap karo</div>}
            {cartItems.map(([id, q]) => {
              const m = menu.find(x => x.id === id);
              if (!m) return null;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: C.gray, fontFamily: "monospace" }}>₹{m.price}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${C.red}`, borderRadius: 6, overflow: "hidden" }}>
                    <button onClick={() => setQty(id, q - 1)} style={{ width: 28, height: 30, border: "none", background: C.redLight, color: C.red, fontSize: 16, fontWeight: 900, cursor: "pointer" }}>−</button>
                    <span style={{ width: 32, textAlign: "center", fontWeight: 900, fontSize: 14, color: C.red }}>{q}</span>
                    <button onClick={() => setQty(id, q + 1)} style={{ width: 28, height: 30, border: "none", background: C.red, color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer" }}>+</button>
                  </div>
                  <div style={{ width: 62, textAlign: "right", fontWeight: 800, fontSize: 13, color: C.red, fontFamily: "monospace" }}>₹{m.price * q}</div>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: `2px solid ${C.line}`, padding: 14, background: C.light }}>
            {/* QUICK DISCOUNT BUTTONS */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: C.gray, fontWeight: 800, alignSelf: "center", minWidth: 50 }}>DISCOUNT</span>
              {[0, 5, 10, 20].map(d => (
                <button key={d} onClick={() => { const el = document.getElementById("discInput"); if (el) { el.value = d; el.dispatchEvent(new Event("input", { bubbles: true })); } }} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.line}`, background: C.card, color: C.ink, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>{d === 0 ? "None" : `${d}%`}</button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: C.gray, fontWeight: 600 }}>Subtotal</span>
              <span style={{ fontWeight: 700, fontFamily: "monospace", color: C.ink }}>₹{subtotal}</span>
            </div>
            <div style={{ background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, borderRadius: 10, padding: "14px 18px", marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: `0 6px 16px ${C.red}40` }}>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>TOTAL</span>
              <span style={{ color: "#fff", fontSize: 24, fontWeight: 900, fontFamily: "monospace" }}>₹{subtotal}</span>
            </div>
            <button onClick={handlePlaceOrder} disabled={cartItems.length === 0 || placing} style={{ width: "100%", padding: 15, marginTop: 10, border: "none", borderRadius: 10, background: cartItems.length === 0 ? C.line : `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: cartItems.length === 0 ? C.gray : "#fff", fontWeight: 800, fontSize: 15, cursor: cartItems.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: cartItems.length === 0 ? "none" : `0 6px 16px ${C.red}40` }}>
              {placing ? "⏳ Placing..." : "🍳 Send KOT"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
