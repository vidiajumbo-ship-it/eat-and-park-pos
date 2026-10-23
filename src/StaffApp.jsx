/* eslint-disable */
import React, { useState, useEffect, useMemo, useRef, useContext, createContext } from "react";
import { db, auth } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, setDoc, onSnapshot, getDoc, getDocs, updateDoc, addDoc,
  query, where, orderBy, runTransaction, arrayUnion, arrayRemove
} from "firebase/firestore";

// ---------------------------------------------------------------------------
// COLORS - Light + Dark theme
// ---------------------------------------------------------------------------
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
const inr = (n) => "Rs " + (Number(n) || 0).toLocaleString("en-IN");
const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
};

const TABLE_COUNT = 12;

function getRangeBounds(range, customDate) {
  const now = Date.now();
  if (range === "today") {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return { start: d.getTime(), end: now };
  }
  if (range === "yesterday") {
    const start = new Date(); start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(0, 0, 0, 0);
    return { start: start.getTime(), end: end.getTime() };
  }
  if (range === "7days") {
    const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0);
    return { start: d.getTime(), end: now };
  }
  if (range === "30days") {
    const d = new Date(); d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0);
    return { start: d.getTime(), end: now };
  }
  if (range === "month") {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
    return { start: d.getTime(), end: now };
  }
  if (range === "custom" && customDate) {
    const start = new Date(customDate + "T00:00:00").getTime();
    return { start, end: start + 86400000 };
  }
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return { start: d.getTime(), end: now };
}

const STATUS = {
  new: { label: "New", color: "red", emoji: "🆕" },
  preparing: { label: "Cooking", color: "amber", emoji: "👨‍🍳" },
  ready: { label: "Ready", color: "green", emoji: "✅" },
  served: { label: "Served", color: "gray", emoji: "🍽️" },
};

const STATUS_FLOW = ["new", "preparing", "ready", "served"];

const RESTAURANT = {
  name: "Eat & Park",
  address: "Girja More, Ara - Buxar Main Road, Pakri, Ara",
  phones: ["7303267750", "8271918062"],
  gstin: "",
  upi: "",
};

// ---------------------------------------------------------------------------
// MAIN APP
// ---------------------------------------------------------------------------
function StaffAppInner() {
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
  const [billOrder, setBillOrder] = useState(null);
  const [addMoreMode, setAddMoreMode] = useState(false);
  const [ordersFilter, setOrdersFilter] = useState("all");
  const [ordersRange, setOrdersRange] = useState(null);

  // ---- VIEW MODE: auto / mobile / desktop ----
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("staff_view_mode") || "auto");
  const [autoMobile, setAutoMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setAutoMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("staff_view_mode", viewMode);
  }, [viewMode]);

  const isMobile = viewMode === "mobile" || (viewMode === "auto" && autoMobile);
  const cycleViewMode = () => setViewMode(m => m === "auto" ? "mobile" : m === "mobile" ? "desktop" : "auto");
  const viewIcon = viewMode === "auto" ? "🔄" : viewMode === "mobile" ? "📱" : "💻";
  const viewTitle = `View: ${viewMode === "auto" ? `Auto (${autoMobile ? "Mobile" : "Desktop"})` : viewMode === "mobile" ? "Mobile" : "Desktop"}`;

  const T = {
    en: { tables: "Tables", orders: "Orders", kitchen: "Kitchen", dashboard: "Dashboard", logout: "Logout", search: "Search", save: "Save", cancel: "Cancel", print: "Print", paid: "Paid", sendKot: "Send KOT", total: "TOTAL", subtotal: "Subtotal", available: "Available", occupied: "Occupied", revenue: "Revenue", active: "Active" },
    hi: { tables: "टेबल", orders: "ऑर्डर", kitchen: "किचन", dashboard: "डैशबोर्ड", logout: "लॉगआउट", search: "खोजें", save: "सेव", cancel: "रद्द", print: "प्रिंट", paid: "पेड", sendKot: "KOT भेजें", total: "कुल", subtotal: "सबटोटल", available: "खाली", occupied: "व्यस्त", revenue: "कमाई", active: "चालू" }
  };
  const t = (k) => (T[lang] && T[lang][k]) || (T.en[k] || k);

  const C = darkMode ? DARK : LIGHT;
  const isOwner = ["owner", "admin", "manager"].includes(String(staffData?.role || "").toLowerCase());

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

    const startRange = new Date();
    startRange.setDate(startRange.getDate() - 30);
    startRange.setHours(0, 0, 0, 0);

    const unsubOrders = onSnapshot(
      query(collection(db, "orders"), where("createdAt", ">=", startRange.getTime())),
      (snap) => {
        const newOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setOrders(prev => {
          if (prev.length > 0) {
            const prevIds = new Set(prev.map(o => o.id));
            const newOnes = newOrders.filter(o => !prevIds.has(o.id) && o.status === "new" && o.createdAt >= startToday.getTime());
            if (newOnes.length > 0) {
              playSound();
              newOnes.forEach(o => {
                if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                  try { new Notification("New Order", { body: `Table ${o.table} - Rs ${o.finalTotal || 0}` }); } catch(e) {}
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

  // Notification permission - only after login
  useEffect(() => {
    if (user && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [user]);

  const playSound = () => {
    try {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch (e) {}
  };

  const newCount = orders.filter(o => o.status === "new" && Date.now() - o.createdAt < 6 * 3600 * 1000).length;
  useEffect(() => {
    document.title = (newCount ? `(${newCount}) ` : "") + "Eat & Park Staff";
    if (!user || newCount === 0) return;
    const iv = setInterval(() => playSound(), 8000);
    return () => clearInterval(iv);
  }, [newCount, user]);

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
        <form onSubmit={handleLogin} style={{ background: C.card, borderRadius: 20, padding: isMobile ? 24 : 36, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: `1px solid ${C.line}` }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 12px", background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, boxShadow: `0 8px 24px ${C.red}40` }}>🍽️</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.ink, letterSpacing: "-0.02em" }}>Eat & Park</div>
            <div style={{ fontSize: 13, color: C.gray, marginTop: 4, fontWeight: 600 }}>Staff POS - Sign In</div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: C.gray, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@eatpark.com" style={{ width: "100%", padding: "13px 16px", border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box", outline: "none", background: C.card, color: C.ink }} autoFocus required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: C.gray, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" style={{ width: "100%", padding: "13px 16px", border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box", outline: "none", background: C.card, color: C.ink }} required />
          </div>
          {loginError && (
            <div style={{ background: C.redLight, color: C.red, padding: "12px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 18 }}>Warning: {loginError}</div>
          )}
          <button type="submit" style={{ width: "100%", padding: "15px", border: "none", borderRadius: 10, background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 8px 20px ${C.red}40`, letterSpacing: 0.3 }}>Sign In</button>
          <div style={{ textAlign: "center", marginTop: 22, fontSize: 12, color: C.gray }}>
            <a href="/" style={{ color: C.blue, textDecoration: "none", fontWeight: 700 }}>Back to Customer App</a>
          </div>
        </form>
      </div>
    );
  }

  const activeOrders = orders.filter(o => o.status !== "served" && o.status !== "cancelled");
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const todayRevenue = orders.filter(o => o.paid && o.status !== "cancelled" && (o.paidAt || o.createdAt) >= startOfToday.getTime()).reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", color: C.ink }}>
      <style>{`@keyframes lateBlink{0%,100%{opacity:1}50%{opacity:.55}}`}</style>

      {/* TOP BAR */}
      <div style={{ background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: "#fff", padding: isMobile ? "10px 10px" : "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 16px rgba(220,38,38,0.25)", position: "sticky", top: 0, zIndex: 50, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, minWidth: 0, flex: 1 }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: isMobile ? 34 : 38, height: isMobile ? 34 : 38, borderRadius: 8, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>☰</button>
          {!isMobile && <div style={{ width: 42, height: 42, background: "rgba(255,255,255,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🍽️</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Eat & Park</div>
            {!isMobile && <div style={{ fontSize: 11, opacity: 0.9, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{staffData?.name || "Staff"} - {staffData?.role || "waiter"}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: isMobile ? 4 : 8, alignItems: "center", flexShrink: 0 }}>
          <button onClick={cycleViewMode} title={viewTitle} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: 38, height: 38, borderRadius: 8, fontSize: 16, cursor: "pointer" }}>{viewIcon}</button>
          {!isMobile && (
            <button onClick={() => { const n = lang === "en" ? "hi" : "en"; setLang(n); localStorage.setItem("staff_lang", n); }} title="Language" style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: 44, height: 38, borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 800 }}>{lang === "en" ? "EN" : "हि"}</button>
          )}
          {!isMobile && (
            <button onClick={() => setDarkMode(d => !d)} title="Toggle theme" style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: 38, height: 38, borderRadius: 8, fontSize: 16, cursor: "pointer" }}>{darkMode ? "☀️" : "🌙"}</button>
          )}
          <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", padding: isMobile ? "9px 10px" : "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Logout</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.line}`, padding: isMobile ? "0 8px" : "0 16px", display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "thin" }}>
        {[
          { id: "tables", label: `🍽️ ${t("tables")}` },
          { id: "orders", label: `📋 ${t("orders")}${newCount ? ` (${newCount})` : ""}` },
          { id: "kot", label: `🍳 ${t("kitchen")}${newCount ? ` (${newCount})` : ""}` },
          { id: "dashboard", label: `📊 ${t("dashboard")}` },
          { id: "stock", label: "📦 Stock" },
        ].map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedTable(null); setOrdersRange(null); }} style={{ padding: isMobile ? "12px 12px" : "15px 20px", border: "none", background: "transparent", color: activeTab === tab.id ? C.red : C.gray, fontWeight: 700, fontSize: isMobile ? 12 : 13, cursor: "pointer", borderBottom: activeTab === tab.id ? `3px solid ${C.red}` : "3px solid transparent", whiteSpace: "nowrap", flexShrink: 0 }}>{tab.label}</button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? 10 : 16 }}>
        {activeTab === "tables" && (
          <TablesView
            C={C}
            isMobile={isMobile}
            orders={orders}
            onTableClick={(tbl) => { setSelectedTable(tbl); setCart({}); setBillOrder(null); setAddMoreMode(false); }}
            onEditBill={(order) => { setBillOrder(order); setSelectedTable(order.table); setCart({}); setAddMoreMode(false); }}
            onAddMore={(order) => { setBillOrder(order); setSelectedTable(order.table); setCart({}); setAddMoreMode(true); }}
            onMerge={(order) => setTableMerge(order)}
            onSplit={(order) => setSplitBillOrder(order)}
            onFeedback={(order) => setFeedbackOrder(order)}
            search={searchTable}
            setSearch={setSearchTable}
            todayRevenue={todayRevenue}
            activeOrders={activeOrders.length}
          />
        )}
        {activeTab === "orders" && (
          <OrdersView
            C={C}
            isMobile={isMobile}
            orders={orders}
            menu={menu}
            waiterName={waiterName}
            isOwner={isOwner}
            filter={ordersFilter}
            setFilter={setOrdersFilter}
            rangeStart={ordersRange?.start}
            rangeEnd={ordersRange?.end}
          />
        )}
        {activeTab === "kot" && (
          <KOTView C={C} isMobile={isMobile} orders={orders} />
        )}
        {activeTab === "stock" && <StockPanel C={C} isMobile={isMobile} menu={menu} />}
        {activeTab === "dashboard" && (
          <DashboardView
            C={C}
            isMobile={isMobile}
            orders={orders}
            menu={menu}
            onStatusClick={(status, bounds) => {
              setOrdersFilter(status);
              setOrdersRange(bounds || null);
              setActiveTab("orders");
            }}
            onOrderClick={(order) => {
              if (order.orderType === "dine_in" && order.table) {
                setBillOrder(order);
                setSelectedTable(Number(order.table));
                setCart({});
                setAddMoreMode(false);
              } else {
                setOrdersFilter("all");
                setOrdersRange(null);
                setActiveTab("orders");
              }
            }}
          />
        )}
      </div>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }} onClick={() => setSidebarOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: isMobile ? "82%" : 280, maxWidth: isMobile ? 320 : undefined, background: C.card, height: "100%", padding: 20, display: "flex", flexDirection: "column", gap: 6, boxShadow: "4px 0 24px rgba(0,0,0,0.15)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 44, height: 44, background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🍽️</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>Eat & Park</div>
                  <div style={{ fontSize: 11, color: C.gray }}>Staff Panel</div>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: C.gray }}>X</button>
            </div>

            <div style={{ background: `linear-gradient(135deg, ${C.red}10 0%, ${C.red}05 100%)`, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>Logged in as</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, marginTop: 4 }}>{staffData?.name || "Staff"}</div>
              <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{staffData?.role || "waiter"}</div>
            </div>

            {[
              { id: "tables", label: "Tables", icon: "🍽️" },
              { id: "orders", label: "Orders", icon: "📋" },
              { id: "kot", label: "Kitchen", icon: "🍳" },
              { id: "dashboard", label: "Dashboard", icon: "📊" },
              { id: "stock", label: "Stock", icon: "📦" },
            ].map((tab) => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); setSelectedTable(null); setOrdersRange(null); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", border: "none", background: activeTab === tab.id ? C.redLight : "transparent", color: activeTab === tab.id ? C.red : C.ink, fontWeight: 700, fontSize: 14, borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ fontSize: 18 }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}

            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 16, paddingTop: 16 }}>
              <button onClick={() => setViewMode(m => m === "auto" ? "mobile" : m === "mobile" ? "desktop" : "auto")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", border: "none", background: "transparent", color: C.ink, fontWeight: 700, fontSize: 14, borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 18 }}>{viewIcon}</span>
                  <span>View Mode</span>
                </span>
                <span style={{ fontSize: 11, color: C.gray, fontWeight: 800, textTransform: "capitalize" }}>{viewMode}</span>
              </button>
              <button onClick={() => { const n = lang === "en" ? "hi" : "en"; setLang(n); localStorage.setItem("staff_lang", n); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", border: "none", background: "transparent", color: C.ink, fontWeight: 700, fontSize: 14, borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 18 }}>🌐</span>
                  <span>Language</span>
                </span>
                <span style={{ fontSize: 11, color: C.gray, fontWeight: 800 }}>{lang === "en" ? "English" : "हिंदी"}</span>
              </button>
              <button onClick={() => { setDarkMode(d => !d); setSidebarOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", border: "none", background: "transparent", color: C.ink, fontWeight: 700, fontSize: 14, borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ fontSize: 18 }}>{darkMode ? "☀️" : "🌙"}</span>
                <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
              </button>
              <a href="/" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", color: C.blue, fontWeight: 700, fontSize: 14, textDecoration: "none", borderRadius: 10 }}>
                <span style={{ fontSize: 18 }}>👤</span>
                <span>Customer App</span>
              </a>
            </div>

            <div style={{ marginTop: "auto", fontSize: 10, color: C.gray, textAlign: "center", paddingTop: 20 }}>
              Eat & Park POS v1.0
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
        </div>
      )}

      {feedbackOrder && <FeedbackModal C={C} isMobile={isMobile} order={feedbackOrder} onClose={() => setFeedbackOrder(null)} />}
      {tableMerge && <TableMergeModal C={C} isMobile={isMobile} primaryOrder={tableMerge} allOrders={orders} onClose={() => setTableMerge(null)} />}
      {splitBillOrder && <SplitBillModal C={C} isMobile={isMobile} order={splitBillOrder} onClose={() => setSplitBillOrder(null)} />}

      {selectedTable && (
        <BillingView
          C={C}
          isMobile={isMobile}
          table={selectedTable}
          menu={menu}
          orders={orders}
          cart={cart}
          setCart={setCart}
          waiterName={waiterName}
          existingOrder={billOrder}
          isOwner={isOwner}
          addMoreMode={addMoreMode}
          onBack={() => { setSelectedTable(null); setCart({}); setBillOrder(null); setAddMoreMode(false); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TABLES VIEW
// ---------------------------------------------------------------------------
function TablesView({ C, isMobile, orders, onTableClick, onEditBill, onAddMore, onMerge, onSplit, onFeedback, search, setSearch, todayRevenue, activeOrders }) {
  const tableData = useMemo(() => {
    const map = {};
    for (let i = 1; i <= TABLE_COUNT; i++) map[i] = { table: i, order: null };
    orders.filter(o => o.orderType === "dine_in" && o.status !== "served" && o.status !== "cancelled").forEach(o => {
      const tbl = Number(o.table);
      if (map[tbl]) map[tbl].order = o;
    });
    return Object.values(map);
  }, [orders]);

  const filteredTables = search.trim()
    ? tableData.filter(tbl => String(tbl.table).includes(search.trim()))
    : tableData;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: isMobile ? 12 : 16 }}>
          <div style={{ fontSize: 10, color: C.gray, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Revenue</div>
          <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 900, color: C.green, marginTop: 4, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inr(todayRevenue)}</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: isMobile ? 12 : 16 }}>
          <div style={{ fontSize: 10, color: C.gray, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Active</div>
          <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 900, color: C.red, marginTop: 4 }}>{activeOrders}</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: isMobile ? 12 : 16, gridColumn: isMobile ? "span 2" : undefined }}>
          <div style={{ fontSize: 10, color: C.gray, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Occupied</div>
          <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 900, color: C.ink, marginTop: 4 }}>{tableData.filter(tbl => tbl.order).length}/{tableData.length}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Tables</h2>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search table..." style={{ padding: "9px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, outline: "none", width: isMobile ? "100%" : 180, background: C.card, color: C.ink }} />
      </div>

      <div style={{ background: C.blueLight, border: `1px solid ${C.blue}`, borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 12, color: C.blue, fontWeight: 700 }}>
        Tip: Table pe tap karo, waiter assign karo, order lo
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(160px, 1fr))", gap: isMobile ? 8 : 12 }}>
        {filteredTables.map((tbl) => (
          <div key={tbl.table} style={{ background: tbl.order ? C.redLight : C.card, border: `2px solid ${tbl.order ? C.red : C.line}`, borderRadius: 12, padding: isMobile ? 10 : 14, minHeight: isMobile ? 120 : 130, display: "flex", flexDirection: "column", justifyContent: "space-between", transition: "all 0.15s" }}>
            <button onClick={() => onTableClick(tbl.table)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: C.ink }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 900, color: tbl.order ? C.red : C.ink, lineHeight: 1, fontFamily: "monospace" }}>{tbl.table}</div>
                <span style={{ fontSize: isMobile ? 14 : 20 }}>{tbl.order ? "🔴" : "🟢"}</span>
              </div>
              {tbl.order ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: isMobile ? 10 : 11, color: C.gray, fontWeight: 700 }}>#{tbl.order.id?.slice(1, 5).toUpperCase()}</div>
                  <div style={{ fontSize: isMobile ? 10 : 11, color: C.gray, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tbl.order.items?.length || 0} items - {inr(tbl.order.finalTotal || 0)}</div>
                </div>
              ) : (<div style={{ fontSize: isMobile ? 10 : 11, color: C.gray, fontWeight: 700, textTransform: "uppercase", marginTop: 6 }}>Available</div>)}
            </button>
            {tbl.order ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 8 }}>
                <button onClick={(e) => { e.stopPropagation(); onEditBill && onEditBill(tbl.order); }} style={{ padding: isMobile ? "8px 4px" : "6px", border: "none", borderRadius: 6, background: C.red, color: "#fff", fontWeight: 800, fontSize: isMobile ? 10 : 11, cursor: "pointer", fontFamily: "inherit" }}>Bill</button>
                <button onClick={(e) => { e.stopPropagation(); onAddMore && onAddMore(tbl.order); }} style={{ padding: isMobile ? "8px 4px" : "6px", border: "none", borderRadius: 6, background: C.green, color: "#fff", fontWeight: 800, fontSize: isMobile ? 10 : 11, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
                <button onClick={(e) => { e.stopPropagation(); onMerge && onMerge(tbl.order); }} style={{ padding: isMobile ? "8px 4px" : "6px", border: `1.5px solid ${C.blue}`, borderRadius: 6, background: "transparent", color: C.blue, fontWeight: 800, fontSize: isMobile ? 10 : 11, cursor: "pointer", fontFamily: "inherit" }}>Merge</button>
                <button onClick={(e) => { e.stopPropagation(); onSplit && onSplit(tbl.order); }} style={{ padding: isMobile ? "8px 4px" : "6px", border: `1.5px solid ${C.amber}`, borderRadius: 6, background: "transparent", color: C.amber, fontWeight: 800, fontSize: isMobile ? 10 : 11, cursor: "pointer", fontFamily: "inherit" }}>Split</button>
                <button onClick={(e) => { e.stopPropagation(); onFeedback && onFeedback(tbl.order); }} style={{ padding: isMobile ? "8px 4px" : "6px", border: `1.5px solid ${C.gray}`, borderRadius: 6, background: "transparent", color: C.gray, fontWeight: 800, fontSize: isMobile ? 10 : 11, cursor: "pointer", fontFamily: "inherit", gridColumn: "span 2" }}>Feedback</button>
              </div>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); onTableClick(tbl.table); }} style={{ marginTop: 8, padding: isMobile ? "9px 4px" : "7px 4px", border: "none", borderRadius: 6, background: C.ink, color: "#fff", fontWeight: 800, fontSize: isMobile ? 11 : 10, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>New Order</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ORDERS VIEW
// ---------------------------------------------------------------------------
function OrdersView({ C, isMobile, orders, menu, waiterName, isOwner, filter, setFilter, rangeStart, rangeEnd }) {
  const defaultStart = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  }, []);
  const start = rangeStart ?? defaultStart;
  const end = rangeEnd ?? Date.now();

  const rangeAll = orders.filter(o => o.status !== "cancelled" && o.createdAt >= start && o.createdAt < end);

  const filtered =
    filter === "all" ? rangeAll
    : filter === "active" ? rangeAll.filter(o => o.status !== "served")
    : filter === "paid" ? rangeAll.filter(o => o.paid)
    : filter === "served" ? rangeAll.filter(o => o.status === "served")
    : rangeAll.filter(o => o.status === filter);

  const advanceOrder = async (order) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];
    try {
      await updateDoc(doc(db, "orders", order.id), { status: next });
    } catch (e) { alert("Error: " + e.message); }
  };

  const markPaid = async (order) => {
    try {
      await updateDoc(doc(db, "orders", order.id), {
        paid: true,
        paymentStatus: "paid",
        paidAt: Date.now(),
        paidBy: waiterName || "Staff",
      });
    } catch (e) { alert("Error: " + e.message); }
  };

  const filterLabel = filter.charAt(0).toUpperCase() + filter.slice(1);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>{filterLabel} Orders ({filtered.length})</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", "active", ...STATUS_FLOW, "paid"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: isMobile ? "6px 10px" : "7px 14px", borderRadius: 20, border: `1px solid ${filter === f ? C.red : C.line}`, background: filter === f ? C.red : C.card, color: filter === f ? "#fff" : C.gray, fontWeight: 700, fontSize: isMobile ? 11 : 12, cursor: "pointer", textTransform: "capitalize", fontFamily: "inherit" }}>{f}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
        {filtered.map((o) => {
          const st = STATUS[o.status] || STATUS.new;
          const stColor = C[st.color] || C.gray;
          const stBg = C[st.color + "Light"] || C.light;
          return (
            <div key={o.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: isMobile ? 12 : 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15, color: C.ink }}>{o.orderType === "parcel" ? "Parcel" : `Table ${o.table}`}</div>
                <span style={{ background: stBg, color: stColor, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>#{o.id?.slice(1, 5).toUpperCase()}</span>
                <span>{timeAgo(o.createdAt)} ago</span>
                {o.waiter && <span>{o.waiter}</span>}
              </div>
              <div style={{ fontSize: isMobile ? 12 : 13, color: C.ink, lineHeight: 1.6, marginBottom: 10 }}>
                {(o.items || []).map((it, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", gap: 8 }}><span>{it.qty}x {it.name}</span><span style={{ color: C.gray, fontFamily: "monospace", flexShrink: 0 }}>{inr(it.price * it.qty)}</span></div>))}
              </div>
              <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: C.gray, fontWeight: 600 }}>Total</span>
                <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(o.finalTotal || 0)}</span>
              </div>
              {o.paid && <div style={{ background: C.greenLight, color: C.green, padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, marginBottom: 10, textAlign: "center" }}>PAID</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {o.status !== "served" && (
                  <button onClick={() => advanceOrder(o)} style={{ padding: "9px", border: "none", borderRadius: 8, background: stColor, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    {o.status === "new" ? "Start" : o.status === "preparing" ? "Ready" : "Serve"}
                  </button>
                )}
                {!o.paid && (
                  <button onClick={() => markPaid(o)} style={{ padding: "9px", border: `1.5px solid ${C.green}`, borderRadius: 8, background: "transparent", color: C.green, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Paid</button>
                )}
                <button onClick={() => printKOT(o)} style={{ padding: "9px", border: `1.5px solid ${C.blue}`, borderRadius: 8, background: "transparent", color: C.blue, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>KOT</button>
                <button onClick={() => printBill(o)} style={{ padding: "9px", border: `1.5px solid ${C.red}`, borderRadius: 8, background: "transparent", color: C.red, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Bill</button>
                <button onClick={() => whatsappBill(o)} style={{ padding: "9px", border: `1.5px solid ${C.green}`, borderRadius: 8, background: "transparent", color: C.green, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>WhatsApp</button>
                <button onClick={async () => { if (!isOwner) { alert("Sirf owner cancel kar sakta hai"); return; } if (window.confirm("Cancel order?")) { try { await updateDoc(doc(db, "orders", o.id), { status: "cancelled", cancelledAt: Date.now(), cancelledBy: "staff" }); logAudit("cancel_order", { orderId: o.id, table: o.table || "", total: o.finalTotal || 0 }); } catch (e) { alert(e.message); } } }} style={{ padding: "9px", border: `1.5px solid ${C.gray}`, borderRadius: 8, background: "transparent", color: C.gray, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit", gridColumn: "span 2" }}>Cancel Order</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (<div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: C.gray }}><div style={{ fontSize: 48, marginBottom: 8 }}>😌</div><div style={{ fontSize: 14, fontWeight: 700 }}>Koi order nahi</div></div>)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KITCHEN VIEW
// ---------------------------------------------------------------------------
function KOTView({ C, isMobile, orders }) {
  const kotOrders = orders.filter(o => o.status === "new" || o.status === "preparing");
  const [, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(iv); }, []);
  const advanceOrder = async (order) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];
    try { await updateDoc(doc(db, "orders", order.id), { status: next }); } catch (e) {}
  };
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Kitchen ({kotOrders.length})</h2>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {kotOrders.map((o) => {
          const isNew = o.status === "new";
          const mins = Math.floor((Date.now() - o.createdAt) / 60000);
          const late = mins >= 15;
          return (
            <div key={o.id} style={{ background: isNew ? C.redLight : C.amberLight, border: `2px solid ${late ? C.red : isNew ? C.red : C.amber}`, borderRadius: 12, padding: isMobile ? 12 : 16, animation: late ? "lateBlink 1s infinite" : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 15 : 17, color: C.ink }}>{o.orderType === "parcel" ? "Parcel" : `Table ${o.table}`}</div>
                <span style={{ fontSize: 12, color: late ? C.red : C.gray, fontWeight: 800 }}>{mins}m</span>
              </div>
              {(o.items || []).map((it, i) => (<div key={i} style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, padding: "6px 0", borderBottom: `1px dashed ${C.line}`, color: C.ink }}>{it.qty}x {it.name} {it.portion ? <span style={{ color: C.gray, fontWeight: 500 }}>({it.portion})</span> : ""}</div>))}
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                <button onClick={() => advanceOrder(o)} style={{ flex: 1, padding: "10px", border: "none", borderRadius: 8, background: isNew ? C.red : C.amber, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{isNew ? "Start Cooking" : "Mark Ready"}</button>
                <button onClick={() => printKOT(o)} style={{ padding: "10px 14px", border: `1.5px solid ${C.line}`, borderRadius: 8, background: "transparent", color: C.ink, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Print</button>
              </div>
            </div>
          );
        })}
        {kotOrders.length === 0 && (<div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: C.gray }}><div style={{ fontSize: 48, marginBottom: 8 }}>😌</div><div style={{ fontSize: 14, fontWeight: 700 }}>Kitchen khaali hai</div></div>)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD VIEW
// ---------------------------------------------------------------------------
function DashboardView({ C, isMobile, orders, menu, onStatusClick, onOrderClick }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState("today");
  const [customDate, setCustomDate] = useState(todayStr);

  const filtered = useMemo(() => {
    if (range === "today") {
      const s = new Date(); s.setHours(0, 0, 0, 0);
      return orders.filter(o => o.createdAt >= s.getTime());
    }
    if (range === "yesterday") {
      const s = new Date(); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0);
      const e = new Date(); e.setHours(0, 0, 0, 0);
      return orders.filter(o => o.createdAt >= s.getTime() && o.createdAt < e.getTime());
    }
    if (range === "7days") {
      const s = new Date(); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0);
      return orders.filter(o => o.createdAt >= s.getTime());
    }
    if (range === "30days") {
      const s = new Date(); s.setDate(s.getDate() - 29); s.setHours(0, 0, 0, 0);
      return orders.filter(o => o.createdAt >= s.getTime());
    }
    if (range === "month") {
      const s = new Date(); s.setDate(1); s.setHours(0, 0, 0, 0);
      return orders.filter(o => o.createdAt >= s.getTime());
    }
    if (range === "custom" && customDate) {
      const s = new Date(customDate + "T00:00:00").getTime();
      const e = s + 86400000;
      return orders.filter(o => o.createdAt >= s && o.createdAt < e);
    }
    return orders;
  }, [orders, range, customDate]);

  const todayRevenue = filtered.filter(o => o.paid && o.status !== "cancelled").reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);
  const todayTotal = filtered.length;
  const paidCount = filtered.filter(o => o.paid).length;
  const activeOrders = filtered.filter(o => o.status !== "served" && o.status !== "cancelled").length;
  const avgOrder = paidCount ? Math.round(todayRevenue / paidCount) : 0;

  const statusCounts = { new: 0, preparing: 0, ready: 0, served: 0 };
  filtered.forEach(o => { if (statusCounts[o.status] !== undefined) statusCounts[o.status]++; });

  const recentOrders = [...filtered].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);

  const rangeLabel = {
    today: "Today",
    yesterday: "Yesterday",
    "7days": "Last 7 Days",
    "30days": "Last 30 Days",
    month: "This Month",
    custom: `Date: ${customDate}`,
  }[range] || "Today";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Dashboard</h2>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 2, fontWeight: 700 }}>{rangeLabel} - {todayTotal} orders</div>
        </div>
        <input type="date" value={customDate} onChange={(e) => { setCustomDate(e.target.value); setRange("custom"); }} style={{ padding: "8px 12px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, background: C.card, color: C.ink, fontWeight: 700, outline: "none" }} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { id: "today", label: "Today" },
          { id: "yesterday", label: "Yesterday" },
          { id: "7days", label: "7 Days" },
          { id: "30days", label: "30 Days" },
          { id: "month", label: "Month" },
        ].map(r => (
          <button key={r.id} onClick={() => setRange(r.id)} style={{ padding: isMobile ? "6px 10px" : "7px 14px", borderRadius: 20, border: `1px solid ${range === r.id ? C.red : C.line}`, background: range === r.id ? C.red : C.card, color: range === r.id ? "#fff" : C.gray, fontWeight: 700, fontSize: isMobile ? 11 : 12, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>{r.label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: isMobile ? 10 : 14, marginBottom: 24 }}>
        {[
          { label: "Revenue", value: inr(todayRevenue), color: C.green, icon: "💰", click: null },
          { label: "Orders", value: todayTotal, color: C.red, icon: "📋", click: () => onStatusClick && onStatusClick("all", getRangeBounds(range, customDate)) },
          { label: "Paid", value: paidCount, color: C.green, icon: "✅", click: () => onStatusClick && onStatusClick("paid", getRangeBounds(range, customDate)) },
          { label: "Active", value: activeOrders, color: C.amber, icon: "🔥", click: () => onStatusClick && onStatusClick("active", getRangeBounds(range, customDate)) },
          { label: "Avg", value: inr(avgOrder), color: C.blue, icon: "📈", click: null },
        ].map((s, i) => (
          <div
            key={i}
            onClick={s.click || undefined}
            style={{
              background: C.card,
              border: `1px solid ${C.line}`,
              borderRadius: 14,
              padding: isMobile ? 12 : 20,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              cursor: s.click ? "pointer" : "default",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
              <span style={{ fontSize: isMobile ? 18 : 26 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: isMobile ? 15 : 26, fontWeight: 900, color: s.color, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.value}</div>
            {s.click && <div style={{ fontSize: 9, color: C.gray, marginTop: 6, fontWeight: 700 }}>Tap</div>}
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: isMobile ? 14 : 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8 }}>
          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: C.ink }}>Order Status</div>
          <div style={{ fontSize: 10, color: C.gray, fontWeight: 700 }}>Tap for details</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 8 : 12 }}>
          {STATUS_FLOW.map(s => {
            const st = STATUS[s];
            const color = C[st.color] || C.gray;
            const count = statusCounts[s];
            return (
              <button
                key={s}
                onClick={() => onStatusClick && onStatusClick(s, getRangeBounds(range, customDate))}
                disabled={count === 0}
                style={{
                  background: C[st.color + "Light"] || C.light,
                  border: `2px solid ${count > 0 ? color : "transparent"}`,
                  borderRadius: 12,
                  padding: isMobile ? 10 : 16,
                  textAlign: "center",
                  cursor: count > 0 ? "pointer" : "default",
                  opacity: count > 0 ? 1 : 0.6,
                  fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: isMobile ? 20 : 28, marginBottom: 6 }}>{st.emoji}</div>
                <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900, color }}>{count}</div>
                <div style={{ fontSize: isMobile ? 9 : 11, color: C.gray, fontWeight: 700, textTransform: "uppercase", marginTop: 4 }}>{st.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: isMobile ? 14 : 20, marginBottom: 24 }}>
        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: C.ink, marginBottom: 16 }}>Orders by Hour - {rangeLabel}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
          {Array.from({ length: 24 }, (_, h) => {
            const count = filtered.filter(o => new Date(o.createdAt).getHours() === h).length;
            const maxCount = Math.max(1, ...Array.from({ length: 24 }, (_, hh) => filtered.filter(o => new Date(o.createdAt).getHours() === hh).length));
            const height = (count / maxCount) * 100;
            return (
              <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", height: 100, display: "flex", alignItems: "flex-end" }}>
                  <div title={`${h}:00 - ${count} orders`} style={{ width: "100%", height: `${height}%`, minHeight: count > 0 ? 4 : 0, background: `linear-gradient(180deg, ${C.red} 0%, #B91C1C 100%)`, borderRadius: 3, transition: "all 0.3s" }} />
                </div>
                {h % 4 === 0 && <div style={{ fontSize: 9, color: C.gray, fontWeight: 700 }}>{h}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <ReportsExtra C={C} isMobile={isMobile} orders={filtered} rangeLabel={rangeLabel} />
      <DueLedger C={C} isMobile={isMobile} orders={orders} />

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: isMobile ? 14 : 20, marginBottom: 24 }}>
        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: C.ink, marginBottom: 16 }}>Staff Performance - {rangeLabel}</div>
        {(() => {
          const byWaiter = {};
          filtered.forEach(o => { const w = o.waiter || "Staff"; byWaiter[w] = (byWaiter[w] || 0) + (Number(o.finalTotal) || 0); });
          const sorted = Object.entries(byWaiter).sort((a, b) => b[1] - a[1]);
          if (sorted.length === 0) return <div style={{ textAlign: "center", padding: 20, color: C.gray }}>Koi data nahi</div>;
          const max = sorted[0][1];
          return sorted.map(([name, amount], i) => (
            <div key={name} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: C.ink }}>#{i + 1} {name}</span>
                <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 800, color: C.green, fontFamily: "monospace" }}>{inr(amount)}</span>
              </div>
              <div style={{ background: C.line, height: 6, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(amount / max) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.green} 0%, ${C.red} 100%)`, borderRadius: 3 }} />
              </div>
            </div>
          ));
        })()}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: isMobile ? 14 : 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: C.ink }}>Orders - {rangeLabel}</div>
          <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>{filtered.length} total</div>
        </div>

        {recentOrders.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.gray }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>😌</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Koi order nahi</div>
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
                  padding: isMobile ? "10px 12px" : "12px 16px",
                  background: C.cardAlt,
                  border: `1px solid ${C.line}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: isMobile ? 20 : 24 }}>{o.orderType === "parcel" ? "🛍️" : "🍽️"}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: isMobile ? 13 : 14, color: C.ink }}>{o.orderType === "parcel" ? "Parcel" : `Table ${o.table}`}</span>
                      <span style={{ background: bg, color, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{st.label}</span>
                      {o.paid && <span style={{ background: C.greenLight, color: C.green, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>PAID</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.gray, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      #{o.id.slice(1, 5).toUpperCase()} - {timeAgo(o.createdAt)} ago - {(o.items || []).length} items
                    </div>
                    {!isMobile && (
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {(o.items || []).slice(0, 3).map(it => `${it.qty}x ${it.name}`).join(", ")}
                        {(o.items || []).length > 3 ? ` +${o.items.length - 3} more` : ""}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(o.finalTotal || 0)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KOT PRINT
// ---------------------------------------------------------------------------
function printKOT(order) {
  try {
    const itemsHtml = (order.items || []).map(it => `<tr><td style="text-align:left;font-size:14px">${it.qty} x ${it.name}${it.portion ? ` (${it.portion})` : ""}</td></tr>`).join("");
    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const w = iframe.contentWindow;
    setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 30000);
    w.document.open();
    w.document.write(`<!doctype html><html><head><title>KOT</title><style>@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:280px;margin:0 auto;padding:10px}h2,h3{text-align:center;margin:4px 0;font-weight:900}h2{font-size:26px}h3{font-size:18px}.row{border-bottom:1px dashed #000;padding:6px 0}.c{text-align:center;font-size:12px;font-weight:700}.big{font-size:16px;font-weight:800}</style></head><body>
<h2>KOT</h2>
<h3>${order.orderType === "parcel" ? "PARCEL" : "TABLE " + order.table}</h3>
<div class="c">${now}</div>
<div class="c">#${order.id.slice(1, 9).toUpperCase()}</div>
${order.waiter ? `<div class="c">Waiter: ${order.waiter}</div>` : ""}
<div style="border-top:2px solid #000;margin:10px 0"></div>
<table style="width:100%;border-collapse:collapse"><tbody>${itemsHtml}</tbody></table>
<div style="border-top:2px solid #000;margin:10px 0"></div>
<div class="c big">Total Items: ${(order.items || []).reduce((s, it) => s + it.qty, 0)}</div>
${order.notes ? `<div class="c" style="margin-top:8px;border-top:1px dashed #000;padding-top:6px;font-size:12px">Note: ${order.notes}</div>` : ""}
<div class="c" style="margin-top:14px;font-size:11px">- Kitchen Copy -</div>
</body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 300);
  } catch (e) { alert("Print error: " + e.message); }
}

// ---------------------------------------------------------------------------
// FEEDBACK MODAL
// ---------------------------------------------------------------------------
function FeedbackModal({ C, isMobile, order, onClose }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!rating) { alert("Pehle rating do"); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "feedback"), {
        orderId: order.id, table: order.table, rating, comment,
        waiter: order.waiter || "Staff", createdAt: Date.now(),
      });
      alert("Feedback diya! Dhanyawaad.");
      onClose();
    } catch (e) { alert("Error: " + e.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>⭐</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, marginBottom: 4 }}>Customer Feedback</div>
        <div style={{ fontSize: 12, color: C.gray, marginBottom: 20 }}>Table {order.table} - #{order.id.slice(1, 5).toUpperCase()}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setRating(n)} style={{ background: "transparent", border: "none", fontSize: 36, cursor: "pointer", filter: rating >= n ? "none" : "grayscale(1) opacity(0.4)" }}>⭐</button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)..." rows={2} style={{ width: "100%", padding: 10, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 16, background: C.card, color: C.ink, resize: "none", outline: "none" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer" }}>Skip</button>
          <button onClick={submit} disabled={saving || !rating} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: saving || !rating ? "not-allowed" : "pointer", opacity: saving || !rating ? 0.5 : 1 }}>{saving ? "..." : "Submit"}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TABLE MERGE MODAL
// ---------------------------------------------------------------------------
function TableMergeModal({ C, isMobile, primaryOrder, allOrders, onClose }) {
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
      alert("Merged!");
      onClose();
    } catch (e) { alert("Error: " + e.message); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, marginBottom: 8 }}>Merge Table</div>
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
          <button onClick={merge} disabled={!selectedId} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: !selectedId ? "not-allowed" : "pointer", opacity: !selectedId ? 0.5 : 1 }}>Merge</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SPLIT BILL MODAL
// ---------------------------------------------------------------------------
function SplitBillModal({ C, isMobile, order, onClose }) {
  const items = order.items || [];
  const [split1, setSplit1] = useState({});
  const toggleItem = (idx) => { setSplit1(prev => ({ ...prev, [idx]: !prev[idx] })); };
  const total1 = items.reduce((s, it, i) => s + (split1[i] ? it.price * it.qty : 0), 0);
  const total2 = (Number(order.finalTotal) || 0) - total1;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 450, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, marginBottom: 8 }}>Split Bill</div>
        <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Jo items pehle bande ko dena hai unpe tick karo</div>
        {items.map((it, i) => (
          <button key={i} onClick={() => toggleItem(i)} style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: 10, marginBottom: 6, border: `2px solid ${split1[i] ? C.blue : C.line}`, borderRadius: 8, background: split1[i] ? C.blueLight : "transparent", cursor: "pointer", fontFamily: "inherit", gap: 8 }}>
            <span style={{ fontWeight: 700, color: C.ink, textAlign: "left" }}>{split1[i] ? "[x]" : "[ ]"} {it.qty}x {it.name}</span>
            <span style={{ color: C.red, fontWeight: 800, flexShrink: 0 }}>{inr(it.price * it.qty)}</span>
          </button>
        ))}
        <div style={{ background: C.cardAlt, padding: 12, borderRadius: 8, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 4, fontSize: 13 }}><span style={{ color: C.gray }}>Person 1</span><b style={{ color: C.blue }}>{inr(total1)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 4, fontSize: 13 }}><span style={{ color: C.gray }}>Person 2</span><b style={{ color: C.red }}>{inr(total2)}</b></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer" }}>Close</button>
          <button onClick={() => { if (!Object.values(split1).some(Boolean)) { alert("Kam se kam 1 item tick karo"); return; } printSplitBills(order, split1); onClose(); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.blue, color: "#fff", fontWeight: 800, cursor: "pointer" }}>Print Both</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BILLING VIEW
// ---------------------------------------------------------------------------
function BillingView({ C, isMobile, table, menu, orders, cart, setCart, waiterName, existingOrder, addMoreMode, onBack, isOwner }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [placing, setPlacing] = useState(false);
  const [runningOrders, setRunningOrders] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [gstRate, setGstRate] = useState(0);
  const [payMode, setPayMode] = useState("cash");

  useEffect(() => {
    if (existingOrder) {
      setDiscount(existingOrder.billDiscountPct || 0);
      setGstRate(existingOrder.gstRate || 0);
      if (!addMoreMode) {
        setPayMode(existingOrder.payment || "cash");
        const initialCart = {};
        (existingOrder.items || []).forEach(it => {
          initialCart[it.itemId] = (initialCart[it.itemId] || 0) + it.qty;
        });
        setCart(initialCart);
      }
    }
  }, [existingOrder?.id, addMoreMode]);

  const existingItems = existingOrder?.items || [];
  const existingSubtotal = existingItems.reduce((s, it) => s + (it.price * it.qty), 0);

  const categories = useMemo(() => ["All", ...Array.from(new Set(menu.map(m => m.category)))], [menu]);
  const filtered = useMemo(() => menu.filter(m => m.available && (category === "All" || m.category === category) && (!search.trim() || m.name.toLowerCase().includes(search.toLowerCase()))), [menu, category, search]);

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);

  const resolveItem = (id) => {
    const m = menu.find(x => x.id === id);
    if (m) return m;
    const ex = existingItems.find(e => e.itemId === id);
    return ex || null;
  };

  const cartSubtotal = cartItems.reduce((s, [id, q]) => { const m = resolveItem(id); return s + (m?.price || 0) * q; }, 0);
  const grossSub = addMoreMode ? existingSubtotal + cartSubtotal : cartSubtotal;

  useEffect(() => {
    const running = orders.filter(o => o.orderType === "dine_in" && Number(o.table) === Number(table) && o.status !== "served" && o.status !== "cancelled");
    setRunningOrders(running);
  }, [orders, table]);

  const setQty = (id, q) => { setCart(prev => { const next = { ...prev }; if (q <= 0) delete next[id]; else next[id] = q; return next; }); };

  const applyCartChanges = async () => {
    if (!existingOrder) throw new Error("No existing order to update");
    const existing = existingOrder.items || [];
    const existingMap = {};
    existing.forEach(it => { existingMap[it.itemId] = (existingMap[it.itemId] || 0) + it.qty; });
    const nextKotNo = Math.max(1, ...(existingOrder.kots || []).map(k => k.kotNumber || 1)) + 1;

    const finalItems = [];
    Object.entries(cart).forEach(([id, qty]) => {
      if (qty <= 0) return;
      const m = menu.find(x => x.id === id);
      const ex = existing.find(e => e.itemId === id);
      if (m) {
        finalItems.push({
          itemId: id, name: m.name, portion: m.portion || "",
          price: m.price, qty,
          kotNumber: existingMap[id] ? (ex?.kotNumber || 1) : nextKotNo,
        });
      } else if (ex) {
        finalItems.push({
          itemId: id, name: ex.name, portion: ex.portion || "",
          price: ex.price, qty,
          kotNumber: ex.kotNumber || 1,
        });
      }
    });

    if (finalItems.length === 0) throw new Error("Bill me kam se kam 1 item hona chahiye");

    const sub = finalItems.reduce((s, it) => s + it.price * it.qty, 0);
    const discAmt = Math.round((sub * discount) / 100);
    const gstAmt = Math.round(((sub - discAmt) * gstRate) / 100);
    const finalTotal = Math.max(0, sub - discAmt) + gstAmt;

    await updateDoc(doc(db, "orders", existingOrder.id), {
      items: finalItems, subtotal: sub,
      billDiscountPct: discount, billDiscount: discAmt,
      gstRate, gstAmount: gstAmt, finalTotal,
      payment: payMode, billEditedAt: Date.now(),
    });

    return { finalItems, sub, discAmt, gstAmt, finalTotal };
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 || placing) return;

    if (existingOrder && addMoreMode) {
      setPlacing(true);
      try {
        const base = existingOrder;
        const baseKots = base.kots?.length ? base.kots : [{ id: uid("kot"), kotNumber: 1, items: base.items || [], createdAt: base.createdAt, status: base.status }];
        const nextNo = Math.max(1, ...baseKots.map(k => k.kotNumber || 1)) + 1;
        const newItems = cartItems.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty, kotNumber: nextNo }; });
        const addedTotal = newItems.reduce((s, it) => s + it.price * it.qty, 0);
        const runKot = { id: uid("kot"), kotNumber: nextNo, items: newItems, createdAt: Date.now(), status: "new", isRunning: true };
        await updateDoc(doc(db, "orders", base.id), {
          kots: [...baseKots, runKot],
          items: [...(base.items || []), ...newItems],
          status: "new",
          finalTotal: (Number(base.finalTotal) || 0) + addedTotal,
          subtotal: (Number(base.subtotal) || 0) + addedTotal,
          paid: false, paymentStatus: "pending", lastKotAt: Date.now(),
        });
        printKOT({ ...base, items: newItems, kots: [runKot] });
        alert(`KOT #${nextNo} added & printing...`);
        onBack();
      } catch (e) { alert("Error: " + e.message); } finally { setPlacing(false); }
      return;
    }

    setPlacing(true);
    try {
      const items = cartItems.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty, kotNumber: 1 }; });
      const orderId = uid("o");
      const sub = cartSubtotal;
      const discAmt = Math.round((sub * discount) / 100);
      const gstAmt = Math.round(((sub - discAmt) * gstRate) / 100);
      const finalTotal = Math.max(0, sub - discAmt) + gstAmt;
      const order = {
        id: orderId, table, orderType: "dine_in",
        customer: { name: "Walk-in", phone: "" },
        items, waiter: waiterName || "Staff",
        kots: [{ id: uid("kot"), kotNumber: 1, items, createdAt: Date.now(), status: "new", isRunning: false }],
        status: "new", paid: false,
        subtotal: sub, billDiscountPct: discount, billDiscount: discAmt,
        gstRate, gstAmount: gstAmt, finalTotal,
        payment: payMode, createdAt: Date.now(), createdBy: auth.currentUser?.uid,
      };
      await setDoc(doc(db, "orders", orderId), order);
      printKOT(order);
      alert("Order placed! KOT printing...");
      onBack();
    } catch (e) { alert("Error: " + e.message); } finally { setPlacing(false); }
  };

  const handleSaveBill = async () => {
    if (!existingOrder || addMoreMode || placing) return;
    setPlacing(true);
    try {
      await applyCartChanges();
      alert("Bill saved!");
      onBack();
    } catch (e) { alert("Error: " + e.message); } finally { setPlacing(false); }
  };

  const handlePaidPrint = async () => {
    if (!existingOrder || addMoreMode || placing) return;
    setPlacing(true);
    try {
      if (payMode === "due") {
        if (cartItems.length === 0) { alert("Bill me kam se kam 1 item hona chahiye"); setPlacing(false); return; }
        const dn = window.prompt("Customer ka naam (due)?", "");
        if (dn === null) { setPlacing(false); return; }
        const dp = window.prompt("Phone number?", "") || "";
        const applied = await applyCartChanges();
        await updateDoc(doc(db, "orders", existingOrder.id), {
          payment: "due", paid: false, paymentStatus: "due", status: "served",
          dueName: dn || "Unknown", duePhone: dp, dueAt: Date.now(),
        });
        logAudit("due_created", { orderId: existingOrder.id, total: applied.finalTotal, name: dn || "" });
        printBill({ ...existingOrder, finalTotal: applied.finalTotal, subtotal: applied.sub, gstAmount: applied.gstAmt, billDiscount: applied.discAmt, payment: "due", paid: false });
        alert("Due me save ho gaya");
        onBack();
        return;
      }
      const applied = await applyCartChanges();
      await updateDoc(doc(db, "orders", existingOrder.id), { paid: true, paymentStatus: "paid", paidAt: Date.now() });
      printBill({ ...existingOrder, finalTotal: applied.finalTotal, subtotal: applied.sub, gstAmount: applied.gstAmt, billDiscount: applied.discAmt, payment: payMode, paid: true });
      alert("Paid & Bill printing...");
      onBack();
    } catch (e) { alert("Error: " + e.message); } finally { setPlacing(false); }
  };

  const addRunningItems = async (orderId) => {
    if (cartItems.length === 0) return;
    try {
      const baseOrder = orders.find(o => o.id === orderId);
      if (!baseOrder) return;
      const baseKots = baseOrder.kots?.length ? baseOrder.kots : [{ id: uid("kot"), kotNumber: 1, items: baseOrder.items || [], createdAt: baseOrder.createdAt, status: baseOrder.status }];
      const nextNo = Math.max(1, ...baseKots.map(k => k.kotNumber || 1)) + 1;
      const newItems = cartItems.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty, kotNumber: nextNo }; });
      const addedTotal = newItems.reduce((s, it) => s + it.price * it.qty, 0);
      const runKot = { id: uid("kot"), kotNumber: nextNo, items: newItems, createdAt: Date.now(), status: "new", isRunning: true };
      await updateDoc(doc(db, "orders", orderId), {
        kots: [...baseKots, runKot],
        items: [...(baseOrder.items || []), ...newItems],
        status: "new",
        finalTotal: (Number(baseOrder.finalTotal) || 0) + addedTotal,
        subtotal: (Number(baseOrder.subtotal) || 0) + addedTotal,
        paid: false, paymentStatus: "pending", lastKotAt: Date.now(),
      });
      printKOT({ ...baseOrder, items: newItems, kots: [runKot] });
      alert(`KOT #${nextNo} added & printing...`);
      onBack();
    } catch (e) { alert("Error: " + e.message); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 100, display: "flex", flexDirection: "column" }}>
      <div style={{ background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: "#fff", padding: isMobile ? "10px 12px" : "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", padding: isMobile ? "8px 12px" : "9px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: isMobile ? 12 : 13, flexShrink: 0 }}>Back</button>
        <div style={{ fontWeight: 800, fontSize: isMobile ? 13 : 16, textAlign: "center", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {existingOrder
            ? (addMoreMode ? `Add - T${table}` : `Bill - T${table} - ${existingItems.length} items`)
            : `New - Table ${table}`}
        </div>
        <div style={{ width: isMobile ? 40 : 60, flexShrink: 0 }} />
      </div>

      {runningOrders.length > 0 && !existingOrder && (
        <div style={{ background: C.amberLight, padding: "8px 12px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: isMobile ? 11 : 13, color: C.ink, fontWeight: 700, flex: 1, minWidth: 120 }}>Table {table} has {runningOrders.length} running order(s)</div>
          <button onClick={() => addRunningItems(runningOrders[0].id)} disabled={cartItems.length === 0} style={{ background: cartItems.length === 0 ? C.line : C.blue, color: "#fff", border: "none", padding: "7px 12px", borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: cartItems.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0 }}>Add to Running</button>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, overflow: isMobile ? "auto" : "hidden", padding: isMobile ? 8 : 12 }}>
        {/* Menu Pane */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", height: isMobile ? "44vh" : undefined, flex: isMobile ? undefined : 1, flexShrink: 0, minWidth: 0 }}>
          <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: "10px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, outline: "none", background: C.card, color: C.ink }} />
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${category === c ? C.red : C.line}`, background: category === c ? C.red : C.card, color: category === c ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0 }}>{c}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(170px, 1fr))", gap: 8, overflowY: "auto", flex: 1 }}>
            {filtered.map((m) => {
              const q = cart[m.id] || 0;
              return (
                <button key={m.id} onClick={() => setQty(m.id, q + 1)} style={{ textAlign: "left", padding: isMobile ? 10 : 12, borderRadius: 10, border: `1.5px solid ${q > 0 ? C.green : C.line}`, background: C.card, cursor: "pointer", position: "relative", fontFamily: "inherit", minHeight: isMobile ? 60 : 68, color: C.ink }}>
                  <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: C.ink, marginBottom: 4, lineHeight: 1.2 }}>{m.name}</div>
                  <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(m.price)}</div>
                  {q > 0 && <span style={{ position: "absolute", top: 6, right: 6, background: C.green, color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 800 }}>{q}</span>}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: C.gray }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{menu.length === 0 ? "Menu load ho raha hai..." : "Koi matching item nahi"}</div>
              </div>
            )}
          </div>
        </div>

        {/* Cart Pane */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0, width: isMobile ? "100%" : 380, height: isMobile ? "auto" : undefined, minHeight: isMobile ? 400 : undefined }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.line}`, fontWeight: 800, fontSize: isMobile ? 13 : 15, color: C.ink }}>Cart</div>
          <div style={{ flex: isMobile ? "none" : 1, overflowY: isMobile ? "visible" : "auto", maxHeight: isMobile ? 220 : undefined }}>
            {cartItems.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.gray, fontSize: 13 }}>Menu se item tap karo</div>}
            {cartItems.map(([id, q]) => {
              const m = resolveItem(id);
              if (!m) return null;
              const existingQty = existingItems.filter(e => e.itemId === id).reduce((s, e) => s + e.qty, 0);
              const isNew = !addMoreMode && existingQty === 0;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderBottom: `1px solid ${C.line}`, background: isNew ? C.greenLight : "transparent", minHeight: 36 }}>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "0 1 auto", minWidth: 0 }}>{m.name}</span>
                    {!addMoreMode && existingQty > 0 && <span style={{ background: C.blue, color: "#fff", fontSize: 8, padding: "1px 4px", borderRadius: 3, fontWeight: 800, flexShrink: 0 }}>R{existingQty}</span>}
                    {!addMoreMode && existingQty === 0 && <span style={{ background: C.green, color: "#fff", fontSize: 8, padding: "1px 4px", borderRadius: 3, fontWeight: 800, flexShrink: 0 }}>NEW</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.red}`, borderRadius: 4, overflow: "hidden", height: 24 }}>
                    <button onClick={() => setQty(id, q - 1)} style={{ width: 22, height: 22, border: "none", background: C.redLight, color: C.red, fontSize: 13, fontWeight: 900, cursor: "pointer", padding: 0 }}>-</button>
                    <span style={{ width: 22, textAlign: "center", fontWeight: 900, fontSize: 11, color: C.red }}>{q}</span>
                    <button onClick={() => setQty(id, q + 1)} style={{ width: 22, height: 22, border: "none", background: C.red, color: "#fff", fontSize: 13, fontWeight: 900, cursor: "pointer", padding: 0 }}>+</button>
                  </div>
                  <div style={{ width: 50, textAlign: "right", fontWeight: 800, fontSize: 11, color: C.red, fontFamily: "monospace", flexShrink: 0 }}>{inr(m.price * q)}</div>
                  <button onClick={() => setQty(id, 0)} style={{ background: "transparent", border: "none", color: C.gray, fontSize: 12, cursor: "pointer", padding: 2, flexShrink: 0 }}>x</button>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: `2px solid ${C.line}`, padding: 8, background: C.light, overflowY: isMobile ? "visible" : "auto", maxHeight: isMobile ? "none" : "65vh" }}>
            {!addMoreMode && (
              <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.gray, fontWeight: 800, minWidth: 38 }}>DISC</span>
                {[0, 5, 10, 20].map(d => (
                  <button key={d} onClick={() => (isOwner ? setDiscount(d) : alert("Discount sirf owner de sakta hai"))} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${discount === d ? C.green : C.line}`, background: discount === d ? C.greenLight : C.card, color: discount === d ? C.green : C.ink, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{d === 0 ? "0" : `${d}%`}</button>
                ))}
                <input type="number" min={0} max={100} disabled={!isOwner} value={discount || ""} onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} placeholder="%" style={{ width: 44, padding: "3px 6px", border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 10, background: C.card, color: C.ink, fontWeight: 700, textAlign: "center", outline: "none" }} />
              </div>
            )}

            {!addMoreMode && (
              <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.gray, fontWeight: 800, minWidth: 38 }}>GST</span>
                {[0, 5, 12, 18].map(g => (
                  <button key={g} onClick={() => setGstRate(g)} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${gstRate === g ? C.red : C.line}`, background: gstRate === g ? C.redLight : C.card, color: gstRate === g ? C.red : C.ink, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{g === 0 ? "No" : `${g}%`}</button>
                ))}
              </div>
            )}

            {!addMoreMode && (
              <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.gray, fontWeight: 800, minWidth: 38 }}>PAY</span>
                {[["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["due", "Due"]].map(([id, label]) => (
                  <button key={id} onClick={() => setPayMode(id)} style={{ padding: "3px 9px", borderRadius: 4, border: `1px solid ${payMode === id ? C.red : C.line}`, background: payMode === id ? C.red : C.card, color: payMode === id ? "#fff" : C.ink, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
                ))}
              </div>
            )}

            <div style={{ background: C.card, borderRadius: 6, padding: 8, marginBottom: 6 }}>
              {addMoreMode && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11 }}>
                  <span style={{ color: C.gray }}>Running ({existingItems.length})</span>
                  <span style={{ fontWeight: 700, fontFamily: "monospace", color: C.ink }}>{inr(existingSubtotal)}</span>
                </div>
              )}
              {addMoreMode && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11, color: C.green }}>
                  <span>New ({cartItems.length})</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700 }}>+{inr(cartSubtotal)}</span>
                </div>
              )}
              {!addMoreMode && discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11, color: C.green }}>
                  <span>Disc {discount}%</span>
                  <span style={{ fontFamily: "monospace" }}>-{inr(Math.round(grossSub * discount / 100))}</span>
                </div>
              )}
              {!addMoreMode && gstRate > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11, color: C.red }}>
                  <span>GST {gstRate}%</span>
                  <span style={{ fontFamily: "monospace" }}>+{inr(Math.round(grossSub * (1 - discount / 100) * gstRate / 100))}</span>
                </div>
              )}
              {!addMoreMode && discount === 0 && gstRate === 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11 }}>
                  <span style={{ color: C.gray }}>Subtotal</span>
                  <span style={{ fontWeight: 700, fontFamily: "monospace", color: C.ink }}>{inr(grossSub)}</span>
                </div>
              )}
            </div>

            <div style={{ background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: `0 4px 12px ${C.red}40` }}>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>TOTAL</span>
              <span style={{ color: "#fff", fontSize: 20, fontWeight: 900, fontFamily: "monospace" }}>
                {(() => {
                  if (addMoreMode) return inr(grossSub);
                  const discAmt = Math.round(grossSub * discount / 100);
                  const gstAmt = Math.round((grossSub - discAmt) * gstRate / 100);
                  return inr(Math.max(0, grossSub - discAmt) + gstAmt);
                })()}
              </span>
            </div>

            {existingOrder && !addMoreMode && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 6 }}>
                <button onClick={handleSaveBill} disabled={placing} style={{ padding: 12, border: "none", borderRadius: 8, background: C.blue, color: "#fff", fontWeight: 800, fontSize: 13, cursor: placing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>Save</button>
                <button onClick={handlePaidPrint} disabled={placing} style={{ padding: 12, border: "none", borderRadius: 8, background: C.green, color: "#fff", fontWeight: 800, fontSize: 13, cursor: placing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>Paid</button>
              </div>
            )}

            {addMoreMode && (
              <button onClick={handlePlaceOrder} disabled={cartItems.length === 0 || placing} style={{ width: "100%", padding: 14, marginTop: 10, border: "none", borderRadius: 10, background: cartItems.length === 0 ? C.line : `linear-gradient(135deg, ${C.green} 0%, #15803D 100%)`, color: cartItems.length === 0 ? C.gray : "#fff", fontWeight: 800, fontSize: 14, cursor: cartItems.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {placing ? "Adding..." : "Add Items to Running KOT"}
              </button>
            )}

            {!existingOrder && (
              <button onClick={handlePlaceOrder} disabled={cartItems.length === 0 || placing} style={{ width: "100%", padding: 14, marginTop: 10, border: "none", borderRadius: 10, background: cartItems.length === 0 ? C.line : `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: cartItems.length === 0 ? C.gray : "#fff", fontWeight: 800, fontSize: 14, cursor: cartItems.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: cartItems.length === 0 ? "none" : `0 6px 16px ${C.red}40` }}>
                {placing ? "Placing..." : "Send KOT"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
const logAudit = async (action, details = {}) => {
  try {
    await addDoc(collection(db, "auditLog"), { action, ...details, by: auth.currentUser?.uid || "", at: Date.now() });
  } catch (e) {}
};

// ---------------------------------------------------------------------------
// Print helper
// ---------------------------------------------------------------------------
function printHtml(title, bodyHtml, opts = {}) {
  try {
    const css = opts.css || "@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:290px;margin:0 auto;padding:10px;font-weight:700}h2{text-align:center;margin:4px 0}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:4px 2px}.line{border-top:2px dashed #000;margin:8px 0}.c{text-align:center;font-size:11px}";
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const w = iframe.contentWindow;
    setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 30000);
    w.document.open();
    w.document.write(`<!doctype html><html><head><title>${title}</title><style>${css}</style></head><body>${bodyHtml}</body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, opts.delay || 400);
  } catch (e) { alert("Print error: " + e.message); }
}

const upiUri = (total, billNo) =>
  `upi://pay?pa=${RESTAURANT.upi}&pn=${encodeURIComponent(RESTAURANT.name)}&am=${total}&cu=INR&tn=${encodeURIComponent("Bill " + billNo)}`;

// ---------------------------------------------------------------------------
// BILL PRINT
// ---------------------------------------------------------------------------
function printBill(order) {
  try {
    const itemsHtml = (order.items || []).map(it => `<tr><td style="text-align:left">${it.name}${it.portion ? ` (${it.portion})` : ""}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">Rs ${it.price}</td><td style="text-align:right">Rs ${it.price * it.qty}</td></tr>`).join("");
    const sub = order.subtotal || (order.items || []).reduce((s, it) => s + it.price * it.qty, 0);
    const total = order.finalTotal || sub;
    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const billNo = order.id.slice(1, 9).toUpperCase();
    const showQr = !!RESTAURANT.upi && !order.paid && order.payment !== "due" && total > 0;
    const qrHtml = showQr
      ? `<div class="c" style="margin-top:8px">Scan &amp; Pay Rs ${total}<br/><img src="https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(upiUri(total, billNo))}" width="170" height="170" /></div>`
      : "";
    const css = "@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:290px;margin:0 auto;padding:10px;font-weight:700}h2{text-align:center;font-size:24px;font-weight:900;margin:4px 0}h4{text-align:center;font-size:15px;margin:4px 0}.c{text-align:center;font-size:10px}.line{border-top:2px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:4px 2px}th{border-bottom:2px solid #000;text-align:left;font-size:12px}.grand td{font-size:18px;font-weight:900;border-top:3px solid #000;padding-top:8px}.badge{display:inline-block;padding:3px 10px;border:2px solid #000;border-radius:10px;font-size:12px;margin:2px}";
    const body = `
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
<tr><td>Subtotal</td><td style="text-align:right">Rs ${sub}</td></tr>
${order.gstAmount ? `<tr><td>GST</td><td style="text-align:right">+Rs ${order.gstAmount}</td></tr>` : ""}
${order.deliveryFee ? `<tr><td>Delivery</td><td style="text-align:right">+Rs ${order.deliveryFee}</td></tr>` : ""}
${order.billDiscount ? `<tr><td>Discount</td><td style="text-align:right">-Rs ${order.billDiscount}</td></tr>` : ""}
<tr class="grand"><td>GRAND TOTAL</td><td style="text-align:right">Rs ${total}</td></tr>
</table>
<div class="line"></div>
<div class="c"><span class="badge">${(order.payment || "cash").toUpperCase()}</span><span class="badge">${order.paid ? "PAID" : order.payment === "due" ? "DUE" : "PENDING"}</span></div>
${qrHtml}
<div class="c" style="margin-top:10px;font-size:11px">** Thank you, visit again **</div>
<div class="c" style="font-size:10px">Eat &amp; Park Restaurant</div>`;
    printHtml("Bill " + billNo, body, { css, delay: showQr ? 1800 : 400 });
  } catch (e) { alert("Print error: " + e.message); }
}

// ---------------------------------------------------------------------------
// WhatsApp bill
// ---------------------------------------------------------------------------
function whatsappBill(order) {
  let phone = String(order.customer?.phone || order.duePhone || "").replace(/\D/g, "");
  if (phone.length < 10) phone = (window.prompt("Customer WhatsApp number (10 digit)?", "") || "").replace(/\D/g, "");
  if (phone.length < 10) return;
  if (phone.length === 10) phone = "91" + phone;
  const lines = (order.items || []).map(it => `${it.qty} x ${it.name} - Rs ${it.price * it.qty}`).join("\n");
  const sub = order.subtotal || (order.items || []).reduce((s, it) => s + it.price * it.qty, 0);
  const total = order.finalTotal || sub;
  const msg = `*${RESTAURANT.name}*\nBill #${order.id.slice(1, 9).toUpperCase()}\n\n${lines}\n\n*Total: Rs ${total}*\n\nThank you! Visit again`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ---------------------------------------------------------------------------
// Split bill print
// ---------------------------------------------------------------------------
function printSplitBills(order, selected) {
  const items = order.items || [];
  const a = items.filter((_, i) => selected[i]);
  const b = items.filter((_, i) => !selected[i]);
  const fullSub = items.reduce((s, it) => s + it.price * it.qty, 0) || 1;
  const make = (list) => {
    const sub = list.reduce((s, it) => s + it.price * it.qty, 0);
    const r = sub / fullSub;
    return {
      ...order, items: list, subtotal: sub, deliveryFee: 0,
      gstAmount: Math.round((order.gstAmount || 0) * r),
      billDiscount: Math.round((order.billDiscount || 0) * r),
      finalTotal: Math.round((Number(order.finalTotal) || fullSub) * r),
    };
  };
  if (a.length) printBill(make(a));
  if (b.length) setTimeout(() => printBill(make(b)), 3500);
}

// ---------------------------------------------------------------------------
// REPORTS
// ---------------------------------------------------------------------------
function ReportsExtra({ C, isMobile, orders, rangeLabel }) {
  const valid = orders.filter(o => o.status !== "cancelled");
  const paidOrders = valid.filter(o => o.paid);

  const itemMap = {};
  paidOrders.forEach(o => (o.items || []).forEach(it => {
    const k = it.name + (it.portion ? ` (${it.portion})` : "");
    if (!itemMap[k]) itemMap[k] = { qty: 0, amt: 0 };
    itemMap[k].qty += it.qty;
    itemMap[k].amt += it.price * it.qty;
  }));
  const topItems = Object.entries(itemMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);
  const maxQty = topItems.length ? topItems[0][1].qty : 1;

  const pay = { cash: 0, upi: 0, card: 0 };
  paidOrders.forEach(o => {
    const m = String(o.payment || "cash").toLowerCase();
    pay[m] = (pay[m] || 0) + (Number(o.finalTotal) || 0);
  });
  const dueTotal = valid.filter(o => o.paymentStatus === "due").reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);
  const collected = paidOrders.reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);
  const cancelled = orders.length - valid.length;

  const exportCsv = () => {
    const rows = [["Bill", "Date", "Type", "Table", "Waiter", "Items", "Subtotal", "Discount", "GST", "Total", "Payment", "Paid"]];
    orders.forEach(o => rows.push([
      (o.id || "").slice(1, 9).toUpperCase(),
      new Date(o.createdAt).toLocaleString("en-IN"),
      o.orderType || "", o.table || "", o.waiter || "",
      (o.items || []).map(it => `${it.qty}x ${it.name}`).join("; "),
      o.subtotal || 0, o.billDiscount || 0, o.gstAmount || 0, o.finalTotal || 0,
      o.payment || "", o.paid ? "Yes" : "No",
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${rangeLabel.replace(/\W+/g, "_")}.csv`;
    a.click();
  };

  const closeDay = () => {
    const row = (k, v) => `<tr><td>${k}</td><td style="text-align:right">${v}</td></tr>`;
    printHtml("Day Close", `<h2>${RESTAURANT.name}</h2><div class="c">DAY CLOSING - ${rangeLabel}</div><div class="c">${new Date().toLocaleString("en-IN")}</div><div class="line"></div><table>${row("Total orders", orders.length)}${row("Cancelled", cancelled)}${row("Paid orders", paidOrders.length)}</table><div class="line"></div><table>${row("Cash", inr(pay.cash))}${row("UPI", inr(pay.upi))}${row("Card", inr(pay.card))}${row("<b>Total collected</b>", "<b>" + inr(collected) + "</b>")}${row("Due pending", inr(dueTotal))}</table><div class="line"></div><div class="c">- End of report -</div>`);
  };

  const box = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: isMobile ? 14 : 20, marginBottom: 24 };
  return (
    <>
      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: C.ink }}>Payment Split - {rangeLabel}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={exportCsv} style={{ padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${C.blue}`, background: "transparent", color: C.blue, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>CSV</button>
            <button onClick={closeDay} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Close Day</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
          {[["Cash", pay.cash, C.green], ["UPI", pay.upi, C.blue], ["Card", pay.card, C.amber], ["Due", dueTotal, C.red]].map(([l, v, c]) => (
            <div key={l} style={{ background: C.cardAlt, borderRadius: 10, padding: isMobile ? 10 : 12 }}>
              <div style={{ fontSize: 10, color: C.gray, fontWeight: 800 }}>{l}</div>
              <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 900, color: c, fontFamily: "monospace", marginTop: 4 }}>{inr(v)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={box}>
        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: C.ink, marginBottom: 14 }}>Top Selling Items - {rangeLabel}</div>
        {topItems.length === 0 && <div style={{ textAlign: "center", padding: 16, color: C.gray, fontSize: 13 }}>Koi paid sale nahi</div>}
        {topItems.map(([name, d], i) => (
          <div key={name} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, gap: 8 }}>
              <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: C.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{i + 1} {name}</span>
              <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: C.gray, fontFamily: "monospace", flexShrink: 0 }}>{d.qty} sold</span>
            </div>
            <div style={{ background: C.line, height: 6, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${(d.qty / maxQty) * 100}%`, height: "100%", background: C.red, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// DUE LEDGER
// ---------------------------------------------------------------------------
function DueLedger({ C, isMobile, orders }) {
  const dues = orders.filter(o => o.paymentStatus === "due" && o.status !== "cancelled" && !o.paid);
  const total = dues.reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);

  const settle = async (o, mode) => {
    try {
      await updateDoc(doc(db, "orders", o.id), { paid: true, paymentStatus: "paid", payment: mode, paidAt: Date.now(), settledFromDue: true });
      logAudit("due_settled", { orderId: o.id, total: o.finalTotal || 0, mode });
    } catch (e) { alert("Error: " + e.message); }
  };

  if (dues.length === 0) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.red}`, borderRadius: 14, padding: isMobile ? 14 : 20, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8 }}>
        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: C.ink }}>Due Ledger</div>
        <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(total)}</div>
      </div>
      {dues.sort((a, b) => b.createdAt - a.createdAt).map(o => (
        <div key={o.id} style={{ background: C.cardAlt, borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: isMobile ? 13 : 14, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.dueName || "Unknown"} {o.duePhone ? `- ${o.duePhone}` : ""}</div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{o.orderType === "parcel" ? "Parcel" : "Table " + o.table} - {new Date(o.dueAt || o.createdAt).toLocaleDateString("en-IN")}</div>
            </div>
            <div style={{ fontWeight: 900, color: C.red, fontFamily: "monospace", fontSize: isMobile ? 14 : 15, flexShrink: 0 }}>{inr(o.finalTotal || 0)}</div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => settle(o, "cash")} style={{ flex: 1, padding: 8, border: "none", borderRadius: 6, background: C.green, color: "#fff", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Cash</button>
            <button onClick={() => settle(o, "upi")} style={{ flex: 1, padding: 8, border: "none", borderRadius: 6, background: C.blue, color: "#fff", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>UPI</button>
            <button onClick={() => whatsappBill(o)} style={{ padding: "8px 10px", border: `1.5px solid ${C.green}`, borderRadius: 6, background: "transparent", color: C.green, fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>WA</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STOCK PANEL
// ---------------------------------------------------------------------------
function StockPanel({ C, isMobile, menu }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");

  const toggle = async (id) => {
    setBusy(id);
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "settings", "menu");
        const snap = await tx.get(ref);
        const items = (snap.data().items || []).map(m => m.id === id ? { ...m, available: !m.available } : m);
        tx.update(ref, { items });
      });
    } catch (e) { alert("Error: " + e.message); } finally { setBusy(""); }
  };

  const list = menu.filter(m => !q.trim() || m.name.toLowerCase().includes(q.toLowerCase()));
  const cats = Array.from(new Set(list.map(m => m.category)));
  const outCount = menu.filter(m => !m.available).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Stock</h2>
          <div style={{ fontSize: 12, color: C.gray, fontWeight: 700, marginTop: 2 }}>{outCount} item out of stock</div>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item search..." style={{ padding: "9px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, outline: "none", width: isMobile ? "100%" : 200, background: C.card, color: C.ink }} />
      </div>
      {cats.map(cat => (
        <div key={cat} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{cat}</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {list.filter(m => m.category === cat).map(m => (
              <button key={m.id} onClick={() => toggle(m.id)} disabled={busy === m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: isMobile ? "10px 8px" : "10px 12px", borderRadius: 10, border: `2px solid ${m.available ? C.green : C.red}`, background: m.available ? C.card : C.redLight, cursor: "pointer", fontFamily: "inherit", opacity: busy === m.id ? 0.5 : 1, textAlign: "left", gap: 6 }}>
                <span style={{ fontSize: isMobile ? 11 : 13, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{m.name}</span>
                <span style={{ fontSize: 10, fontWeight: 900, color: m.available ? C.green : C.red, whiteSpace: "nowrap", flexShrink: 0 }}>{m.available ? "In" : "Out"}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ERROR BOUNDARY
// ---------------------------------------------------------------------------
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error("Staff app crash:", err, info); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, sans-serif", background: "#F9FAFB" }}>
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 24, maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>Warning</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Kuch gadbad ho gayi</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16, wordBreak: "break-word" }}>{String(this.state.err?.message || this.state.err)}</div>
          <button onClick={() => window.location.reload()} style={{ width: "100%", padding: 13, border: "none", borderRadius: 10, background: "#DC2626", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Reload</button>
        </div>
      </div>
    );
  }
}

export default function StaffApp() {
  return (
    <ErrorBoundary>
      <StaffAppInner />
    </ErrorBoundary>
  );
}