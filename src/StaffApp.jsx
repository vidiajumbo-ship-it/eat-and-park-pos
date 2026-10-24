/* eslint-disable */
import React, { useState, useEffect, useMemo, useRef, useContext, createContext, useCallback } from "react";
import { db, auth } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, setDoc, onSnapshot, getDoc, updateDoc, addDoc,
  query, where, runTransaction
} from "firebase/firestore";

// ===========================================================================
// COLORS
// ===========================================================================
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

// ===========================================================================
// GLOBAL CSS (animations, press states, shimmer)
// ===========================================================================
const GLOBAL_CSS = `
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes scaleIn { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes slideInTop { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.7; } }
@keyframes pulseRing { 0% { box-shadow: 0 0 0 0 rgba(220,38,38,0.55); } 100% { box-shadow: 0 0 0 14px rgba(220,38,38,0); } }
@keyframes lateBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
@keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(700px) rotate(720deg); opacity: 0; } }
@keyframes successBounce { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes spinnerRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
button { -webkit-tap-highlight-color: transparent; transition: transform 0.08s ease, opacity 0.08s ease, background 0.15s ease; }
button:active:not(:disabled) { transform: scale(0.96); }
button:disabled { opacity: 0.55; }
input, textarea { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
input:focus, textarea:focus { border-color: #DC2626 !important; box-shadow: 0 0 0 3px rgba(220,38,38,0.12); }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 4px; }
::-webkit-scrollbar-track { background: transparent; }
`;

// ===========================================================================
// UTILS
// ===========================================================================
const uid = (p) => p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);
const inr = (n) => "₹" + (Number(n) || 0).toLocaleString("en-IN");
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
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

function getRangeBounds(range, customDate) {
  const now = Date.now();
  if (range === "today") { const d = new Date(); d.setHours(0,0,0,0); return { start: d.getTime(), end: now }; }
  if (range === "yesterday") { const s = new Date(); s.setDate(s.getDate()-1); s.setHours(0,0,0,0); const e = new Date(); e.setHours(0,0,0,0); return { start: s.getTime(), end: e.getTime() }; }
  if (range === "7days") { const d = new Date(); d.setDate(d.getDate()-6); d.setHours(0,0,0,0); return { start: d.getTime(), end: now }; }
  if (range === "30days") { const d = new Date(); d.setDate(d.getDate()-29); d.setHours(0,0,0,0); return { start: d.getTime(), end: now }; }
  if (range === "month") { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return { start: d.getTime(), end: now }; }
  if (range === "custom" && customDate) { const start = new Date(customDate + "T00:00:00").getTime(); return { start, end: start + 86400000 }; }
  const d = new Date(); d.setHours(0,0,0,0); return { start: d.getTime(), end: now };
}

// ===========================================================================
// HOOKS
// ===========================================================================
function useHaptic() {
  return useCallback((ms = 10) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }, []);
}
function useDebounce(value, delay = 150) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
function useOnline() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return online;
}

// ===========================================================================
// TOAST SYSTEM
// ===========================================================================
const ToastCtx = createContext(null);
const useToast = () => useContext(ToastCtx)?.toast || (() => {});

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = "info", opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, type, ...opts }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), opts.duration || 2800);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none", width: "calc(100% - 32px)", maxWidth: 420 }}>
        {toasts.map(t => {
          const bg = t.type === "success" ? "#16A34A" : t.type === "error" ? "#DC2626" : t.type === "warning" ? "#F59E0B" : "#111827";
          const icon = t.type === "success" ? "✅" : t.type === "error" ? "⚠️" : t.type === "warning" ? "⏱️" : "ℹ️";
          return (
            <div key={t.id} style={{ background: bg, color: "#fff", padding: "12px 18px", borderRadius: 12, fontWeight: 700, fontSize: 13, boxShadow: "0 10px 32px rgba(0,0,0,0.22)", display: "flex", alignItems: "center", gap: 10, animation: "slideInTop 0.22s ease-out", pointerEvents: "auto" }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ flex: 1 }}>{t.msg}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

// ===========================================================================
// PREMIUM COMPONENTS
// ===========================================================================
function Skeleton({ w, h = 20, r = 8, style }) {
  return (
    <div style={{
      width: w || "100%", height: h, borderRadius: r,
      background: "linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0.06) 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
      ...style,
    }} />
  );
}

function AnimatedNumber({ value, duration = 600, format = true }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    const to = Number(value) || 0;
    const start = Date.now();
    let raf;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format ? inr(display) : display}</>;
}

function Confetti({ show, duration = 1500 }) {
  const [items] = useState(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    dur: 1 + Math.random() * 0.8,
    color: ["#DC2626", "#16A34A", "#F59E0B", "#2563EB", "#EC4899", "#8B5CF6"][i % 6],
    size: 6 + Math.random() * 8,
  })));
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {items.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: p.left + "%", top: -20,
          width: p.size, height: p.size,
          background: p.color, borderRadius: "50%",
          animation: `confettiFall ${p.dur}s ease-out ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

function ModalShell({ C, open, onClose, isMobile, title, icon, children, maxWidth = 400 }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
      zIndex: 500, display: "flex",
      alignItems: isMobile ? "flex-end" : "center",
      justifyContent: "center", padding: isMobile ? 0 : 16,
      animation: "fadeIn 0.15s ease-out",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.card, borderRadius: isMobile ? "20px 20px 0 0" : 16,
        padding: 24, width: "100%", maxWidth: isMobile ? "100%" : maxWidth,
        maxHeight: isMobile ? "92vh" : "88vh", overflowY: "auto",
        animation: isMobile ? "slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)" : "scaleIn 0.18s ease-out",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
      }}>
        {isMobile && (
          <div style={{ width: 40, height: 4, background: C.line, borderRadius: 2, margin: "0 auto 16px" }} />
        )}
        {(title || icon) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            {icon && <div style={{ fontSize: 28 }}>{icon}</div>}
            {title && <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>{title}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function ConnectionBadge({ C }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div style={{
      position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
      background: "#DC2626", color: "#fff", padding: "10px 18px",
      borderRadius: 24, fontWeight: 800, fontSize: 12,
      boxShadow: "0 12px 32px rgba(220,38,38,0.45)",
      zIndex: 9999, display: "flex", alignItems: "center", gap: 10,
      animation: "slideInTop 0.25s ease-out",
    }}>
      <span style={{ width: 8, height: 8, background: "#fff", borderRadius: "50%", animation: "pulse 1.2s infinite" }} />
      Offline — changes will sync
    </div>
  );
}

function Spinner({ size = 16, color = "#fff" }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `2px solid ${color}55`, borderTopColor: color,
      borderRadius: "50%", animation: "spinnerRotate 0.7s linear infinite",
      verticalAlign: "middle",
    }} />
  );
}

// ===========================================================================
// SPLASH SCREEN
// ===========================================================================
function SplashScreen({ C }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "system-ui, sans-serif", flexDirection: "column", gap: 20 }}>
      <div style={{ width: 100, height: 100, background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, boxShadow: `0 20px 60px ${C.red}55`, animation: "successBounce 0.6s ease-out" }}>🍽️</div>
      <div style={{ fontWeight: 900, fontSize: 22, color: C.ink, letterSpacing: "-0.02em" }}>Eat & Park</div>
      <div style={{ fontWeight: 600, fontSize: 12, color: C.gray, textTransform: "uppercase", letterSpacing: 2 }}>Staff POS</div>
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: C.red, animation: "pulse 1s infinite", animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// MAIN APP
// ===========================================================================
function StaffAppInner() {
  const toast = useToast();
  const haptic = useHaptic();

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
  const [confetti, setConfetti] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("staff_view_mode") || "auto");
  const [autoMobile, setAutoMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setAutoMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", handler); else mq.removeListener(handler); };
  }, []);

  useEffect(() => { localStorage.setItem("staff_view_mode", viewMode); }, [viewMode]);

  const isMobile = viewMode === "mobile" || (viewMode === "auto" && autoMobile);
  const cycleViewMode = () => { haptic(15); setViewMode(m => m === "auto" ? "mobile" : m === "mobile" ? "desktop" : "auto"); };
  const viewIcon = viewMode === "auto" ? "🔄" : viewMode === "mobile" ? "📱" : "💻";

  const C = darkMode ? DARK : LIGHT;
  const isOwner = ["owner", "admin", "manager"].includes(String(staffData?.role || "").toLowerCase());

  useEffect(() => { localStorage.setItem("staff_dark", darkMode ? "1" : "0"); document.body.style.background = C.bg; }, [darkMode]);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && !u.isAnonymous) {
        try {
          const s = await getDoc(doc(db, "staff", u.uid));
          if (s.exists()) { setUser(u); setStaffData(s.data()); setWaiterName(s.data().name || "Staff"); }
          else { await signOut(auth); }
        } catch (e) { console.error(e); }
      } else { setUser(null); setStaffData(null); }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Data
  useEffect(() => {
    if (!user) return;
    const startToday = new Date(); startToday.setHours(0,0,0,0);
    const unsubMenu = onSnapshot(doc(db, "settings", "menu"), (snap) => {
      if (snap.exists() && Array.isArray(snap.data().items)) setMenu(snap.data().items);
    });
    const startRange = new Date(); startRange.setDate(startRange.getDate() - 30); startRange.setHours(0,0,0,0);
    const unsubOrders = onSnapshot(query(collection(db, "orders"), where("createdAt", ">=", startRange.getTime())), (snap) => {
      const newOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(prev => {
        if (prev.length > 0) {
          const prevIds = new Set(prev.map(o => o.id));
          const newOnes = newOrders.filter(o => !prevIds.has(o.id) && o.status === "new" && o.createdAt >= startToday.getTime());
          if (newOnes.length > 0) {
            playSound();
            newOnes.forEach(o => {
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                try { new Notification("New Order", { body: `Table ${o.table} - ${inr(o.finalTotal || 0)}` }); } catch(e) {}
              }
            });
          }
        }
        return newOrders;
      });
    });
    return () => { unsubMenu(); unsubOrders(); };
  }, [user]);

  useEffect(() => {
    if (user && "Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  }, [user]);

  const playSound = () => { try { const a = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"); a.volume = 0.6; a.play().catch(() => {}); } catch (e) {} };
  const clickSound = () => { try { const a = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT");
    a.volume = 0.15; a.play().catch(() => {}); } catch (e) {} };

  const newCount = orders.filter(o => o.status === "new" && Date.now() - o.createdAt < 6 * 3600 * 1000).length;
  useEffect(() => {
    document.title = (newCount ? `(${newCount}) ` : "") + "Eat & Park Staff";
    if (!user || newCount === 0) return;
    const iv = setInterval(() => playSound(), 8000);
    return () => clearInterval(iv);
  }, [newCount, user]);

  // Esc closes modals
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (selectedTable) setSelectedTable(null);
        else if (feedbackOrder) setFeedbackOrder(null);
        else if (tableMerge) setTableMerge(null);
        else if (splitBillOrder) setSplitBillOrder(null);
        else if (sidebarOpen) setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedTable, feedbackOrder, tableMerge, splitBillOrder, sidebarOpen]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const s = await getDoc(doc(db, "staff", cred.user.uid));
      if (!s.exists()) { await signOut(auth); setLoginError("Ye account staff ka nahi hai"); }
      else toast("Welcome back!", "success");
    } catch (err) {
      const msg = err.code === "auth/invalid-credential" ? "Email ya password galat hai" : err.message;
      setLoginError(msg);
    }
  };

  const handleLogout = async () => { await signOut(auth); setUser(null); setStaffData(null); };

  if (loading) return <SplashScreen C={C} />;

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${C.bg} 0%, ${C.cardAlt} 100%)`, fontFamily: "system-ui, sans-serif", padding: 16 }}>
        <form onSubmit={handleLogin} style={{ background: C.card, borderRadius: 20, padding: isMobile ? 24 : 36, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: `1px solid ${C.line}`, animation: "scaleIn 0.35s ease-out" }}>
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
          {loginError && <div style={{ background: C.redLight, color: C.red, padding: "12px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 18 }}>Warning: {loginError}</div>}
          <button type="submit" style={{ width: "100%", padding: "15px", border: "none", borderRadius: 10, background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 8px 20px ${C.red}40` }}>Sign In</button>
          <div style={{ textAlign: "center", marginTop: 22, fontSize: 12, color: C.gray }}>
            <a href="/" style={{ color: C.blue, textDecoration: "none", fontWeight: 700 }}>Back to Customer App</a>
          </div>
        </form>
      </div>
    );
  }

  const activeOrders = orders.filter(o => o.status !== "served" && o.status !== "cancelled");
  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
  const todayRevenue = orders.filter(o => o.paid && o.status !== "cancelled" && (o.paidAt || o.createdAt) >= startOfToday.getTime()).reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", color: C.ink }}>
      <style>{GLOBAL_CSS}</style>
      <Confetti show={confetti} />

      {/* TOP BAR */}
      <div style={{ background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: "#fff", padding: isMobile ? "10px 10px" : "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 16px rgba(220,38,38,0.25)", position: "sticky", top: 0, zIndex: 50, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, minWidth: 0, flex: 1 }}>
          <button onClick={() => { haptic(); setSidebarOpen(true); }} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: isMobile ? 34 : 38, height: isMobile ? 34 : 38, borderRadius: 8, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>☰</button>
          {!isMobile && <div style={{ width: 42, height: 42, background: "rgba(255,255,255,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🍽️</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Eat & Park</div>
            {!isMobile && <div style={{ fontSize: 11, opacity: 0.9, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{staffData?.name || "Staff"} - {staffData?.role || "waiter"}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: isMobile ? 4 : 8, alignItems: "center", flexShrink: 0 }}>
          <button onClick={cycleViewMode} title={`View: ${viewMode}`} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: 38, height: 38, borderRadius: 8, fontSize: 16, cursor: "pointer" }}>{viewIcon}</button>
          {!isMobile && (
            <button onClick={() => { const n = lang === "en" ? "hi" : "en"; setLang(n); localStorage.setItem("staff_lang", n); }} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: 44, height: 38, borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 800 }}>{lang === "en" ? "EN" : "हि"}</button>
          )}
          {!isMobile && (
            <button onClick={() => { haptic(); setDarkMode(d => !d); }} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: 38, height: 38, borderRadius: 8, fontSize: 16, cursor: "pointer" }}>{darkMode ? "☀️" : "🌙"}</button>
          )}
          <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", padding: isMobile ? "9px 10px" : "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Logout</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.line}`, padding: isMobile ? "0 8px" : "0 16px", display: "flex", gap: 4, overflowX: "auto" }}>
        {[
          { id: "tables", label: `🍽️ Tables` },
          { id: "orders", label: `📋 Orders${newCount ? ` (${newCount})` : ""}` },
          { id: "kot", label: `🍳 Kitchen${newCount ? ` (${newCount})` : ""}` },
          { id: "dashboard", label: "📊 Dashboard" },
          { id: "stock", label: "📦 Stock" },
        ].map(tab => (
          <button key={tab.id} onClick={() => { haptic(); setActiveTab(tab.id); setSelectedTable(null); setOrdersRange(null); }} style={{ padding: isMobile ? "12px 12px" : "15px 20px", border: "none", background: "transparent", color: activeTab === tab.id ? C.red : C.gray, fontWeight: 700, fontSize: isMobile ? 12 : 13, cursor: "pointer", borderBottom: activeTab === tab.id ? `3px solid ${C.red}` : "3px solid transparent", whiteSpace: "nowrap", flexShrink: 0 }}>{tab.label}</button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? 10 : 16 }}>
        {activeTab === "tables" && (
          <TablesView C={C} isMobile={isMobile} orders={orders}
            onTableClick={(t) => { haptic(); setSelectedTable(t); setCart({}); setBillOrder(null); setAddMoreMode(false); }}
            onEditBill={(order) => { haptic(); setBillOrder(order); setSelectedTable(order.table); setCart({}); setAddMoreMode(false); }}
            onAddMore={(order) => { haptic(); setBillOrder(order); setSelectedTable(order.table); setCart({}); setAddMoreMode(true); }}
            onMerge={(order) => setTableMerge(order)}
            onSplit={(order) => setSplitBillOrder(order)}
            onFeedback={(order) => setFeedbackOrder(order)}
            search={searchTable} setSearch={setSearchTable}
            todayRevenue={todayRevenue} activeOrders={activeOrders.length} />
        )}
        {activeTab === "orders" && (
          <OrdersView C={C} isMobile={isMobile} orders={orders} menu={menu} waiterName={waiterName} isOwner={isOwner} onAddMore={(order) => { setBillOrder(order); setSelectedTable(order.table || "parcel"); setCart({}); setAddMoreMode(true); }} onEditBill={(order) => { setBillOrder(order); setSelectedTable(order.table || "parcel"); setCart({}); setAddMoreMode(false); }} filter={ordersFilter} setFilter={setOrdersFilter} rangeStart={ordersRange?.start} rangeEnd={ordersRange?.end} setOrders={setOrders} onPaidSuccess={() => { setConfetti(true); setTimeout(() => setConfetti(false), 1800); }} />
        )}
        {activeTab === "kot" && <KOTView C={C} isMobile={isMobile} orders={orders} setOrders={setOrders} />}
        {activeTab === "stock" && <StockPanel C={C} isMobile={isMobile} menu={menu} />}
        {activeTab === "dashboard" && (
          <DashboardView C={C} isMobile={isMobile} orders={orders} menu={menu}
            onStatusClick={(status, bounds) => { setOrdersFilter(status); setOrdersRange(bounds || null); setActiveTab("orders"); }}
            onOrderClick={(order) => {
              if (order.orderType === "dine_in" && order.table) { setBillOrder(order); setSelectedTable(Number(order.table)); setCart({}); setAddMoreMode(false); }
              else { setOrdersFilter("all"); setOrdersRange(null); setActiveTab("orders"); }
            }} />
        )}
      </div>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", animation: "fadeIn 0.15s ease-out" }} onClick={() => setSidebarOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: isMobile ? "82%" : 280, maxWidth: isMobile ? 320 : undefined, background: C.card, height: "100%", padding: 20, display: "flex", flexDirection: "column", gap: 6, boxShadow: "4px 0 24px rgba(0,0,0,0.15)", overflowY: "auto", animation: "slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 44, height: 44, background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🍽️</div>
                <div><div style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>Eat & Park</div><div style={{ fontSize: 11, color: C.gray }}>Staff Panel</div></div>
              </div>
              <button onClick={() => setSidebarOpen(false)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: C.gray }}>X</button>
            </div>
            <div style={{ background: `linear-gradient(135deg, ${C.red}10 0%, ${C.red}05 100%)`, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>Logged in as</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, marginTop: 4 }}>{staffData?.name || "Staff"}</div>
              <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{staffData?.role || "waiter"}</div>
            </div>
            {[{ id: "tables", label: "Tables", icon: "🍽️" }, { id: "orders", label: "Orders", icon: "📋" }, { id: "kot", label: "Kitchen", icon: "🍳" }, { id: "dashboard", label: "Dashboard", icon: "📊" }, { id: "stock", label: "Stock", icon: "📦" }].map(tab => (
              <button key={tab.id} onClick={() => { haptic(); setActiveTab(tab.id); setSidebarOpen(false); setSelectedTable(null); setOrdersRange(null); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", border: "none", background: activeTab === tab.id ? C.redLight : "transparent", color: activeTab === tab.id ? C.red : C.ink, fontWeight: 700, fontSize: 14, borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ fontSize: 18 }}>{tab.icon}</span><span>{tab.label}</span>
              </button>
            ))}
            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 16, paddingTop: 16 }}>
              <button onClick={() => { haptic(); setViewMode(m => m === "auto" ? "mobile" : m === "mobile" ? "desktop" : "auto"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", border: "none", background: "transparent", color: C.ink, fontWeight: 700, fontSize: 14, borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 14 }}><span style={{ fontSize: 18 }}>{viewIcon}</span><span>View Mode</span></span>
                <span style={{ fontSize: 11, color: C.gray, fontWeight: 800, textTransform: "capitalize" }}>{viewMode}</span>
              </button>
              <button onClick={() => { const n = lang === "en" ? "hi" : "en"; setLang(n); localStorage.setItem("staff_lang", n); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", border: "none", background: "transparent", color: C.ink, fontWeight: 700, fontSize: 14, borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 14 }}><span style={{ fontSize: 18 }}>🌐</span><span>Language</span></span>
                <span style={{ fontSize: 11, color: C.gray, fontWeight: 800 }}>{lang === "en" ? "English" : "हिंदी"}</span>
              </button>
              <button onClick={() => { haptic(); setDarkMode(d => !d); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", border: "none", background: "transparent", color: C.ink, fontWeight: 700, fontSize: 14, borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ fontSize: 18 }}>{darkMode ? "☀️" : "🌙"}</span><span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
              </button>
              <a href="/" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", color: C.blue, fontWeight: 700, fontSize: 14, textDecoration: "none", borderRadius: 10 }}>
                <span style={{ fontSize: 18 }}>👤</span><span>Customer App</span>
              </a>
            </div>
            <div style={{ marginTop: "auto", fontSize: 10, color: C.gray, textAlign: "center", paddingTop: 20 }}>Eat & Park POS v2.0 Premium</div>
          </div>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
        </div>
      )}

      {feedbackOrder && <FeedbackModal C={C} isMobile={isMobile} order={feedbackOrder} onClose={() => setFeedbackOrder(null)} />}
      {tableMerge && <TableMergeModal C={C} isMobile={isMobile} primaryOrder={tableMerge} allOrders={orders} onClose={() => setTableMerge(null)} />}
      {splitBillOrder && <SplitBillModal C={C} isMobile={isMobile} order={splitBillOrder} onClose={() => setSplitBillOrder(null)} />}
      <ConnectionBadge C={C} />

      {selectedTable && (
        <BillingView C={C} isMobile={isMobile} table={selectedTable} menu={menu} orders={orders} cart={cart} setCart={setCart} waiterName={waiterName} existingOrder={billOrder} isOwner={isOwner} addMoreMode={addMoreMode}
          onBack={() => { setSelectedTable(null); setCart({}); setBillOrder(null); setAddMoreMode(false); }}
          onPaidSuccess={() => { haptic(60); setConfetti(true); setTimeout(() => setConfetti(false), 1800); }} />
      )}
    </div>
  );
}

// ===========================================================================
// TABLES VIEW
// ===========================================================================
function TablesView({ C, isMobile, orders, onTableClick, onEditBill, onAddMore, onMerge, onSplit, onFeedback, search, setSearch, todayRevenue, activeOrders }) {
  const tableData = useMemo(() => {
    const map = {};
    for (let i = 1; i <= TABLE_COUNT; i++) map[i] = { table: i, order: null };
    orders.filter(o => o.orderType === "dine_in" && o.status !== "served" && o.status !== "cancelled" && !o.paid).forEach(o => {
      const t = Number(o.table);
      if (map[t]) map[t].order = o;
    });
    return Object.values(map);
  }, [orders]);

  const filteredTables = search.trim() ? tableData.filter(t => String(t.table).includes(search.trim())) : tableData;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
        <div style={{ background: `linear-gradient(135deg, ${C.green}11 0%, ${C.green}05 100%)`, border: `1px solid ${C.green}33`, borderRadius: 12, padding: isMobile ? 12 : 16 }}>
          <div style={{ fontSize: 10, color: C.gray, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Revenue</div>
          <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 900, color: C.green, marginTop: 4, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><AnimatedNumber value={todayRevenue} /></div>
        </div>
        <div style={{ background: `linear-gradient(135deg, ${C.red}11 0%, ${C.red}05 100%)`, border: `1px solid ${C.red}33`, borderRadius: 12, padding: isMobile ? 12 : 16 }}>
          <div style={{ fontSize: 10, color: C.gray, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Active</div>
          <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 900, color: C.red, marginTop: 4 }}><AnimatedNumber value={activeOrders} format={false} /></div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: isMobile ? 12 : 16, gridColumn: isMobile ? "span 2" : undefined }}>
          <div style={{ fontSize: 10, color: C.gray, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Occupied</div>
          <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 900, color: C.ink, marginTop: 4 }}>{tableData.filter(t => t.order).length}/{tableData.length}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Tables</h2><button onClick={() => onTableClick("parcel")} style={{ padding: "7px 12px", border: "none", borderRadius: 8, background: C.red, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🛍️ Parcel</button></div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search table..." style={{ padding: "9px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, outline: "none", width: isMobile ? "100%" : 180, background: C.card, color: C.ink }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(160px, 1fr))", gap: isMobile ? 8 : 12 }}>
        {filteredTables.map(t => (
          <div key={t.table} style={{
            background: t.order ? C.redLight : C.card,
            border: `2px solid ${t.order ? C.red : C.line}`,
            borderRadius: 12, padding: isMobile ? 10 : 14,
            minHeight: isMobile ? 120 : 130,
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            animation: t.order ? "pulseRing 2.5s infinite" : "none",
          }}>
            <button onClick={() => onTableClick(t.table)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: C.ink }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 900, color: t.order ? C.red : C.ink, lineHeight: 1, fontFamily: "monospace" }}>{t.table}</div>
                <span style={{ fontSize: isMobile ? 14 : 20 }}>{t.order ? "🔴" : "🟢"}</span>
              </div>
              {t.order ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: isMobile ? 10 : 11, color: C.gray, fontWeight: 700 }}>#{t.order.id?.slice(1,5).toUpperCase()} - {timeAgo(t.order.createdAt)}</div>
                  <div style={{ fontSize: isMobile ? 10 : 11, color: C.gray, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.order.items?.length || 0} items - {inr(t.order.finalTotal || 0)}</div>
                </div>
              ) : <div style={{ fontSize: isMobile ? 10 : 11, color: C.gray, fontWeight: 700, textTransform: "uppercase", marginTop: 6 }}>Available</div>}
            </button>
            {t.order ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 8 }}>
                <button onClick={() => onEditBill(t.order)} style={{ padding: isMobile ? "8px 4px" : "6px", border: "none", borderRadius: 6, background: C.red, color: "#fff", fontWeight: 800, fontSize: isMobile ? 10 : 11, cursor: "pointer", fontFamily: "inherit" }}>Bill</button>
                <button onClick={() => onAddMore(t.order)} style={{ padding: isMobile ? "8px 4px" : "6px", border: "none", borderRadius: 6, background: C.green, color: "#fff", fontWeight: 800, fontSize: isMobile ? 10 : 11, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
                <button onClick={() => onMerge(t.order)} style={{ padding: isMobile ? "8px 4px" : "6px", border: `1.5px solid ${C.blue}`, borderRadius: 6, background: "transparent", color: C.blue, fontWeight: 800, fontSize: isMobile ? 10 : 11, cursor: "pointer", fontFamily: "inherit" }}>Merge</button>
                <button onClick={() => onSplit(t.order)} style={{ padding: isMobile ? "8px 4px" : "6px", border: `1.5px solid ${C.amber}`, borderRadius: 6, background: "transparent", color: C.amber, fontWeight: 800, fontSize: isMobile ? 10 : 11, cursor: "pointer", fontFamily: "inherit" }}>Split</button>
                <button onClick={() => onFeedback(t.order)} style={{ padding: isMobile ? "8px 4px" : "6px", border: `1.5px solid ${C.gray}`, borderRadius: 6, background: "transparent", color: C.gray, fontWeight: 800, fontSize: isMobile ? 10 : 11, cursor: "pointer", fontFamily: "inherit", gridColumn: "span 2" }}>Feedback</button>
              </div>
            ) : (
              <button onClick={() => onTableClick(t.table)} style={{ marginTop: 8, padding: isMobile ? "9px 4px" : "7px 4px", border: "none", borderRadius: 6, background: C.ink, color: "#fff", fontWeight: 800, fontSize: isMobile ? 11 : 10, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>New Order</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// ORDERS VIEW (with optimistic update + toast)
// ===========================================================================
function OrdersView({ C, isMobile, orders, menu, waiterName, isOwner, filter, setFilter, rangeStart, rangeEnd, setOrders, onPaidSuccess, onAddMore, onEditBill }) {
  const toast = useToast();
  const haptic = useHaptic();
  const defaultStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const [openId, setOpenId] = useState(null);
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
    haptic(12);
    // Optimistic
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o));
    try { await updateDoc(doc(db, "orders", order.id), { status: next }); toast(`Order → ${STATUS[next].label}`, "success"); }
    catch (e) { setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: order.status } : o)); toast(e.message, "error"); }
  };

  const markPaid = async (order) => {
    if (!window.confirm(`${order.orderType === "parcel" ? "Parcel" : "Table " + order.table} - ${inr(order.finalTotal || 0)} paid mark karna hai?`)) return;
    haptic(30);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, paid: true, paymentStatus: "paid", paidAt: Date.now(), paidBy: waiterName || "Staff" } : o));
    try {
      await updateDoc(doc(db, "orders", order.id), { paid: true, paymentStatus: "paid", paidAt: Date.now(), paidBy: waiterName || "Staff" });
      toast("Payment received!", "success");
      if (onPaidSuccess) onPaidSuccess();
    } catch (e) {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, paid: false, paymentStatus: "pending" } : o));
      toast(e.message, "error");
    }
  };

  const filterLabel = filter.charAt(0).toUpperCase() + filter.slice(1);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>{filterLabel} Orders ({filtered.length})</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", "active", ...STATUS_FLOW, "paid"].map(f => (
            <button key={f} onClick={() => { haptic(); setFilter(f); }} style={{ padding: isMobile ? "6px 10px" : "7px 14px", borderRadius: 20, border: `1px solid ${filter === f ? C.red : C.line}`, background: filter === f ? C.red : C.card, color: filter === f ? "#fff" : C.gray, fontWeight: 700, fontSize: isMobile ? 11 : 12, cursor: "pointer", textTransform: "capitalize", fontFamily: "inherit" }}>{f}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile || filter === "all" ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", gap: filter === "all" ? 8 : 12 }}>
        {filtered.map(o => {
          const st = STATUS[o.status] || STATUS.new;
          const stColor = C[st.color] || C.gray;
          const stBg = C[st.color + "Light"] || C.light;
          const isOpen = filter !== "all" || openId === o.id;
          if (!isOpen) return (
            <button key={o.id} onClick={() => { haptic(); setOpenId(o.id); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: isMobile ? "9px 10px" : "10px 14px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: C.ink }}>
              <span style={{ fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>{o.orderType === "parcel" ? "Parcel" : `T${o.table}`}</span>
              <span style={{ fontSize: 11, color: C.gray, whiteSpace: "nowrap" }}>#{o.id?.slice(1,5).toUpperCase()} - {timeAgo(o.createdAt)}</span>
              <span style={{ background: stBg, color: stColor, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>{st.label}</span>
              {o.paid && <span style={{ background: C.greenLight, color: C.green, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>PAID</span>}
              <span style={{ marginLeft: "auto", fontWeight: 900, color: C.red, fontFamily: "monospace", fontSize: 13, whiteSpace: "nowrap" }}>{inr(o.finalTotal || 0)}</span>
              <span style={{ color: C.gray, fontSize: 10 }}>▼</span>
            </button>
          );
          return (
            <div key={o.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: isMobile ? 12 : 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", animation: "fadeIn 0.25s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15, color: C.ink }}>{o.orderType === "parcel" ? "Parcel" : `Table ${o.table}`}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ background: stBg, color: stColor, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{st.label}</span>{filter === "all" && <button onClick={() => setOpenId(null)} style={{ border: `1px solid ${C.line}`, background: C.cardAlt, color: C.gray, borderRadius: 8, padding: "3px 9px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>▲</button>}</div>
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>#{o.id?.slice(1,5).toUpperCase()}</span><span>{timeAgo(o.createdAt)} ago</span>{o.waiter && <span>{o.waiter}</span>}
              </div>
              <div style={{ fontSize: isMobile ? 12 : 13, color: C.ink, lineHeight: 1.6, marginBottom: 10 }}>
                {(o.items || []).map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", gap: 8 }}><span>{it.qty}x {it.name}</span><span style={{ color: C.gray, fontFamily: "monospace", flexShrink: 0 }}>{inr(it.price * it.qty)}</span></div>)}
              </div>
              <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: C.gray, fontWeight: 600 }}>Total</span>
                <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(o.finalTotal || 0)}</span>
              </div>
              {o.paid && <div style={{ background: C.greenLight, color: C.green, padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, marginBottom: 10, textAlign: "center" }}>PAID</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {o.status !== "served" && <button onClick={() => advanceOrder(o)} style={{ padding: "9px", border: "none", borderRadius: 8, background: stColor, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{o.status === "new" ? "Start" : o.status === "preparing" ? "Ready" : "Serve"}</button>}
                {!o.paid && <button onClick={() => markPaid(o)} style={{ padding: "9px", border: `1.5px solid ${C.green}`, borderRadius: 8, background: "transparent", color: C.green, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Paid</button>}
                {!o.paid && <button onClick={() => onAddMore && onAddMore(o)} style={{ padding: "9px", border: "none", borderRadius: 8, background: C.green, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>+ Add Items</button>}
                {!o.paid && <button onClick={() => onEditBill && onEditBill(o)} style={{ padding: "9px", border: "none", borderRadius: 8, background: C.red, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Edit Bill</button>}
                <button onClick={() => printKOT(o)} style={{ padding: "9px", border: `1.5px solid ${C.blue}`, borderRadius: 8, background: "transparent", color: C.blue, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>KOT</button>
                <button onClick={() => printBill(o)} style={{ padding: "9px", border: `1.5px solid ${C.red}`, borderRadius: 8, background: "transparent", color: C.red, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Bill</button>
                <button onClick={() => whatsappBill(o)} style={{ padding: "9px", border: `1.5px solid ${C.green}`, borderRadius: 8, background: "transparent", color: C.green, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>WhatsApp</button>
                <button onClick={async () => {
                  if (!isOwner) { toast("Sirf owner cancel kar sakta hai", "warning"); return; }
                  const reason = window.prompt("Cancel karne ka reason?", ""); if (reason === null) return;
                  try {
                    await updateDoc(doc(db, "orders", o.id), { status: "cancelled", cancelledAt: Date.now(), cancelledBy: "staff", cancelledReason: reason || "" });
                    logAudit("cancel_order", { orderId: o.id, table: o.table || "", total: o.finalTotal || 0, reason: reason || "" });
                    toast("Order cancelled", "success");
                  } catch (e) { toast(e.message, "error"); }
                }} style={{ padding: "9px", border: `1.5px solid ${C.gray}`, borderRadius: 8, background: "transparent", color: C.gray, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit", gridColumn: "span 2" }}>Cancel Order</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: C.gray }}><div style={{ fontSize: 48, marginBottom: 8 }}>😌</div><div style={{ fontSize: 14, fontWeight: 700 }}>Koi order nahi</div></div>}
      </div>
    </div>
  );
}

// ===========================================================================
// KITCHEN VIEW (with aging bar)
// ===========================================================================
function KOTView({ C, isMobile, orders, setOrders }) {
  const toast = useToast();
  const haptic = useHaptic();
  const [, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(x => x + 1), 15000); return () => clearInterval(iv); }, []);
  const kotOrders = orders.filter(o => o.status === "new" || o.status === "preparing");
  const advanceOrder = async (order) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];
    haptic(12);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o));
    try { await updateDoc(doc(db, "orders", order.id), { status: next }); toast(STATUS[next].label, "success"); }
    catch (e) { setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: order.status } : o)); toast(e.message, "error"); }
  };
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Kitchen ({kotOrders.length})</h2>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {kotOrders.map(o => {
          const isNew = o.status === "new";
          const mins = Math.floor((Date.now() - o.createdAt) / 60000);
          const late = mins >= 15;
          const aging = Math.min(100, (mins / 20) * 100);
          return (
            <div key={o.id} style={{ background: isNew ? C.redLight : C.amberLight, border: `2px solid ${late ? C.red : isNew ? C.red : C.amber}`, borderRadius: 12, padding: isMobile ? 12 : 16, animation: late ? "lateBlink 1.2s infinite" : "none", overflow: "hidden", position: "relative" }}>
              <div style={{ height: 4, background: C.line, borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
                <div style={{ width: `${aging}%`, height: "100%", background: mins < 10 ? C.green : mins < 15 ? C.amber : C.red, transition: "width 0.5s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 15 : 17, color: C.ink }}>{o.orderType === "parcel" ? "Parcel" : `Table ${o.table}`}</div>
                <span style={{ fontSize: 12, color: late ? C.red : C.gray, fontWeight: 800 }}>{mins}m</span>
              </div>
              {(o.items || []).map((it, i) => <div key={i} style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, padding: "6px 0", borderBottom: `1px dashed ${C.line}`, color: C.ink }}>{it.qty}x {it.name}{it.portion ? <span style={{ color: C.gray, fontWeight: 500 }}> ({it.portion})</span> : ""}</div>)}
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                <button onClick={() => advanceOrder(o)} style={{ flex: 1, padding: "10px", border: "none", borderRadius: 8, background: isNew ? C.red : C.amber, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{isNew ? "Start Cooking" : "Mark Ready"}</button>
                <button onClick={() => printKOT(o)} style={{ padding: "10px 14px", border: `1.5px solid ${C.line}`, borderRadius: 8, background: "transparent", color: C.ink, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Print</button>
              </div>
            </div>
          );
        })}
        {kotOrders.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: C.gray }}><div style={{ fontSize: 48, marginBottom: 8 }}>😌</div><div style={{ fontSize: 14, fontWeight: 700 }}>Kitchen khaali hai</div></div>}
      </div>
    </div>
  );
}

// ===========================================================================
// DASHBOARD VIEW (with animated numbers)
// ===========================================================================
function DashboardView({ C, isMobile, orders, menu, onStatusClick, onOrderClick }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState("today");
  const [customDate, setCustomDate] = useState(todayStr);
  const haptic = useHaptic();

  const filtered = useMemo(() => {
    if (range === "today") { const s = new Date(); s.setHours(0,0,0,0); return orders.filter(o => o.createdAt >= s.getTime()); }
    if (range === "yesterday") { const s = new Date(); s.setDate(s.getDate()-1); s.setHours(0,0,0,0); const e = new Date(); e.setHours(0,0,0,0); return orders.filter(o => o.createdAt >= s.getTime() && o.createdAt < e.getTime()); }
    if (range === "7days") { const s = new Date(); s.setDate(s.getDate()-6); s.setHours(0,0,0,0); return orders.filter(o => o.createdAt >= s.getTime()); }
    if (range === "30days") { const s = new Date(); s.setDate(s.getDate()-29); s.setHours(0,0,0,0); return orders.filter(o => o.createdAt >= s.getTime()); }
    if (range === "month") { const s = new Date(); s.setDate(1); s.setHours(0,0,0,0); return orders.filter(o => o.createdAt >= s.getTime()); }
    if (range === "custom" && customDate) { const s = new Date(customDate + "T00:00:00").getTime(); const e = s + 86400000; return orders.filter(o => o.createdAt >= s && o.createdAt < e); }
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
  const rangeLabel = { today: "Today", yesterday: "Yesterday", "7days": "Last 7 Days", "30days": "Last 30 Days", month: "This Month", custom: `Date: ${customDate}` }[range] || "Today";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Dashboard</h2>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 2, fontWeight: 700 }}>{rangeLabel} - {todayTotal} orders</div>
        </div>
        <input type="date" value={customDate} onChange={e => { setCustomDate(e.target.value); setRange("custom"); }} style={{ padding: "8px 12px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, background: C.card, color: C.ink, fontWeight: 700, outline: "none" }} />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {[{ id: "today", label: "Today" }, { id: "yesterday", label: "Yesterday" }, { id: "7days", label: "7 Days" }, { id: "30days", label: "30 Days" }, { id: "month", label: "Month" }].map(r => (
          <button key={r.id} onClick={() => { haptic(); setRange(r.id); }} style={{ padding: isMobile ? "6px 10px" : "7px 14px", borderRadius: 20, border: `1px solid ${range === r.id ? C.red : C.line}`, background: range === r.id ? C.red : C.card, color: range === r.id ? "#fff" : C.gray, fontWeight: 700, fontSize: isMobile ? 11 : 12, cursor: "pointer", fontFamily: "inherit" }}>{r.label}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: isMobile ? 10 : 14, marginBottom: 24 }}>
        {[
          { label: "Revenue", val: todayRevenue, color: C.green, icon: "💰", click: null, fmt: true },
          { label: "Orders", val: todayTotal, color: C.red, icon: "📋", click: () => onStatusClick("all", getRangeBounds(range, customDate)), fmt: false },
          { label: "Paid", val: paidCount, color: C.green, icon: "✅", click: () => onStatusClick("paid", getRangeBounds(range, customDate)), fmt: false },
          { label: "Active", val: activeOrders, color: C.amber, icon: "🔥", click: () => onStatusClick("active", getRangeBounds(range, customDate)), fmt: false },
          { label: "Avg", val: avgOrder, color: C.blue, icon: "📈", click: null, fmt: true },
        ].map((s, i) => (
          <div key={i} onClick={s.click || undefined} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: isMobile ? 12 : 20, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", cursor: s.click ? "pointer" : "default", transition: "all 0.2s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
              <span style={{ fontSize: isMobile ? 18 : 26 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: isMobile ? 15 : 26, fontWeight: 900, color: s.color, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><AnimatedNumber value={s.val} format={s.fmt} /></div>
            {s.click && <div style={{ fontSize: 9, color: C.gray, marginTop: 6, fontWeight: 700 }}>Tap</div>}
          </div>
        ))}
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: isMobile ? 14 : 20, marginBottom: 24 }}>
        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: C.ink, marginBottom: 16 }}>Order Status</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 8 : 12 }}>
          {STATUS_FLOW.map(s => {
            const st = STATUS[s];
            const color = C[st.color] || C.gray;
            const count = statusCounts[s];
            return (
              <button key={s} onClick={() => onStatusClick(s, getRangeBounds(range, customDate))} disabled={count === 0} style={{ background: C[st.color + "Light"] || C.light, border: `2px solid ${count > 0 ? color : "transparent"}`, borderRadius: 12, padding: isMobile ? 10 : 16, textAlign: "center", cursor: count > 0 ? "pointer" : "default", opacity: count > 0 ? 1 : 0.6, fontFamily: "inherit" }}>
                <div style={{ fontSize: isMobile ? 20 : 28, marginBottom: 6 }}>{st.emoji}</div>
                <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900, color }}><AnimatedNumber value={count} format={false} /></div>
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
                  <div title={`${h}:00 - ${count}`} style={{ width: "100%", height: `${height}%`, minHeight: count > 0 ? 4 : 0, background: `linear-gradient(180deg, ${C.red} 0%, #B91C1C 100%)`, borderRadius: 3, transition: "all 0.4s" }} />
                </div>
                {h % 4 === 0 && <div style={{ fontSize: 9, color: C.gray, fontWeight: 700 }}>{h}</div>}
              </div>
            );
          })}
        </div>
      </div>
      <ReportsExtra C={C} isMobile={isMobile} orders={filtered} rangeLabel={rangeLabel} />
      <DueLedger C={C} isMobile={isMobile} orders={orders} />
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: isMobile ? 14 : 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: C.ink }}>Orders - {rangeLabel}</div>
          <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>{filtered.length} total</div>
        </div>
        {recentOrders.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.gray }}><div style={{ fontSize: 36, marginBottom: 8 }}>😌</div><div style={{ fontSize: 13, fontWeight: 700 }}>Koi order nahi</div></div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recentOrders.map(o => {
            const st = STATUS[o.status] || STATUS.new;
            const color = C[st.color] || C.gray;
            const bg = C[st.color + "Light"] || C.light;
            return (
              <button key={o.id} onClick={() => onOrderClick(o)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: isMobile ? "10px 12px" : "12px 16px", background: C.cardAlt, border: `1px solid ${C.line}`, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: isMobile ? 20 : 24 }}>{o.orderType === "parcel" ? "🛍️" : "🍽️"}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: isMobile ? 13 : 14, color: C.ink }}>{o.orderType === "parcel" ? "Parcel" : `Table ${o.table}`}</span>
                      <span style={{ background: bg, color, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{st.label}</span>
                      {o.paid && <span style={{ background: C.greenLight, color: C.green, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>PAID</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.gray, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>#{o.id.slice(1,5).toUpperCase()} - {timeAgo(o.createdAt)} ago - {(o.items || []).length} items</div>
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

// ===========================================================================
// PRINT FUNCTIONS
// ===========================================================================
function printKOT(order) {
  try {
    const itemsHtml = (order.items || []).map(it => `<tr><td style="text-align:left;font-size:14px">${it.qty} x ${esc(it.name)}${it.portion ? ` (${esc(it.portion)})` : ""}</td></tr>`).join("");
    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const w = iframe.contentWindow;
    setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 30000);
    w.document.open();
    w.document.write(`<!doctype html><html><head><title>KOT</title><style>@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:280px;margin:0 auto;padding:10px}h2,h3{text-align:center;margin:4px 0;font-weight:900}h2{font-size:26px}h3{font-size:18px}.c{text-align:center;font-size:12px;font-weight:700}.big{font-size:16px;font-weight:800}</style></head><body>
<h2>KOT</h2><h3>${order.orderType === "parcel" ? "PARCEL" : "TABLE " + order.table}</h3>
<div class="c">${now}</div><div class="c">#${order.id.slice(1,9).toUpperCase()}</div>
${order.waiter ? `<div class="c">Waiter: ${esc(order.waiter)}</div>` : ""}
<div style="border-top:2px solid #000;margin:10px 0"></div>
<table style="width:100%"><tbody>${itemsHtml}</tbody></table>
<div style="border-top:2px solid #000;margin:10px 0"></div>
<div class="c big">Total Items: ${(order.items || []).reduce((s, it) => s + it.qty, 0)}</div>
<div class="c" style="margin-top:14px;font-size:11px">- Kitchen Copy -</div>
</body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 300);
  } catch (e) { alert("Print error: " + e.message); }
}

function printHtml(title, bodyHtml, opts = {}) {
  try {
    const css = opts.css || "@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:290px;margin:0 auto;padding:10px;font-weight:700}";
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

const upiUri = (total, billNo) => `upi://pay?pa=${RESTAURANT.upi}&pn=${encodeURIComponent(RESTAURANT.name)}&am=${total}&cu=INR&tn=${encodeURIComponent("Bill " + billNo)}`;

function printBill(order) {
  try {
    const itemsHtml = (order.items || []).map(it => `<tr><td style="text-align:left">${esc(it.name)}${it.portion ? ` (${esc(it.portion)})` : ""}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">Rs ${it.price}</td><td style="text-align:right">Rs ${it.price * it.qty}</td></tr>`).join("");
    const sub = order.subtotal || (order.items || []).reduce((s, it) => s + it.price * it.qty, 0);
    const total = order.finalTotal || sub;
    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const billNo = order.id.slice(1,9).toUpperCase();
    const showQr = !!RESTAURANT.upi && !order.paid && order.payment !== "due" && total > 0;
    const qrHtml = showQr ? `<div class="c" style="margin-top:8px">Scan &amp; Pay Rs ${total}<br/><img src="https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(upiUri(total, billNo))}" width="170" height="170" /></div>` : "";
    const css = "@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:290px;margin:0 auto;padding:10px;font-weight:700}h2{text-align:center;font-size:24px;font-weight:900;margin:4px 0}.c{text-align:center;font-size:10px}.line{border-top:2px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:4px 2px}th{border-bottom:2px solid #000;text-align:left;font-size:12px}.grand td{font-size:18px;font-weight:900;border-top:3px solid #000;padding-top:8px}.badge{display:inline-block;padding:3px 10px;border:2px solid #000;border-radius:10px;font-size:12px;margin:2px}";
    const body = `<h2>${RESTAURANT.name}</h2><div class="c">${RESTAURANT.address}</div><div class="c">Ph: ${RESTAURANT.phones.join(" / ")}</div><div class="line"></div>
<div style="display:flex;justify-content:space-between;font-size:11px"><div>Bill: ${billNo}</div><div>${order.orderType === "parcel" ? "PARCEL" : "T-" + order.table}</div></div>
<div class="c" style="margin-top:4px">${now}</div>
${order.waiter ? `<div class="c">Waiter: ${esc(order.waiter)}</div>` : ""}
<div class="line"></div>
<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr></thead><tbody>${itemsHtml}</tbody></table>
<div class="line"></div>
<table>
<tr><td>Subtotal</td><td style="text-align:right">Rs ${sub}</td></tr>
${order.gstAmount ? `<tr><td>GST</td><td style="text-align:right">+Rs ${order.gstAmount}</td></tr>` : ""}
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

function whatsappBill(order) {
  let phone = String(order.customer?.phone || order.duePhone || "").replace(/\D/g, "");
  if (phone.length < 10) phone = (window.prompt("Customer WhatsApp number (10 digit)?", "") || "").replace(/\D/g, "");
  if (phone.length < 10) return;
  if (phone.length === 10) phone = "91" + phone;
  const lines = (order.items || []).map(it => `${it.qty} x ${it.name} - Rs ${it.price * it.qty}`).join("\n");
  const sub = order.subtotal || (order.items || []).reduce((s, it) => s + it.price * it.qty, 0);
  const total = order.finalTotal || sub;
  const msg = `*${RESTAURANT.name}*\nBill #${order.id.slice(1,9).toUpperCase()}\n\n${lines}\n\n*Total: Rs ${total}*\n\nThank you! Visit again`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
}

function printSplitBills(order, selected) {
  const items = order.items || [];
  const a = items.filter((_, i) => selected[i]);
  const b = items.filter((_, i) => !selected[i]);
  const fullSub = items.reduce((s, it) => s + it.price * it.qty, 0) || 1;
  const make = (list) => {
    const sub = list.reduce((s, it) => s + it.price * it.qty, 0);
    const r = sub / fullSub;
    return { ...order, items: list, subtotal: sub, deliveryFee: 0, gstAmount: Math.round((order.gstAmount || 0) * r), billDiscount: Math.round((order.billDiscount || 0) * r), finalTotal: Math.round((Number(order.finalTotal) || fullSub) * r) };
  };
  if (a.length) printBill(make(a));
  if (b.length) setTimeout(() => printBill(make(b)), 3500);
}

// ===========================================================================
// MODALS (using ModalShell - bottom sheet on mobile + blur)
// ===========================================================================
function FeedbackModal({ C, isMobile, order, onClose }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!rating) { toast("Pehle rating do", "warning"); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "feedback"), { orderId: order.id, table: order.table, rating, comment, waiter: order.waiter || "Staff", createdAt: Date.now() });
      toast("Feedback saved!", "success");
      onClose();
    } catch (e) { toast(e.message, "error"); } finally { setSaving(false); }
  };
  return (
    <ModalShell C={C} open onClose={onClose} isMobile={isMobile} title="Customer Feedback" icon="⭐" maxWidth={380}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, color: C.gray, marginBottom: 20 }}>Table {order.table} - #{order.id.slice(1,5).toUpperCase()}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setRating(n)} style={{ background: "transparent", border: "none", fontSize: 36, cursor: "pointer", filter: rating >= n ? "none" : "grayscale(1) opacity(0.4)", transform: rating >= n ? "scale(1.1)" : "scale(1)", transition: "all 0.15s" }}>⭐</button>
          ))}
        </div>
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Comment (optional)..." rows={2} style={{ width: "100%", padding: 10, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 16, background: C.card, color: C.ink, resize: "none", outline: "none" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer" }}>Skip</button>
          <button onClick={submit} disabled={saving || !rating} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: saving || !rating ? "not-allowed" : "pointer" }}>{saving ? <Spinner /> : "Submit"}</button>
        </div>
      </div>
    </ModalShell>
  );
}

function TableMergeModal({ C, isMobile, primaryOrder, allOrders, onClose }) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState("");
  const otherOrders = allOrders.filter(o => o.id !== primaryOrder.id && o.orderType === "dine_in" && o.status !== "served" && o.status !== "cancelled");
  const merge = async () => {
    if (!selectedId) return;
    try {
      const other = allOrders.find(o => o.id === selectedId);
      if (!other) return;
      await updateDoc(doc(db, "orders", primaryOrder.id), {
        items: [...(primaryOrder.items || []), ...(other.items || [])],
        kots: [...(primaryOrder.kots || []), ...(other.kots || [])],
        subtotal: (Number(primaryOrder.subtotal) || 0) + (Number(other.subtotal) || 0),
        finalTotal: (Number(primaryOrder.finalTotal) || 0) + (Number(other.finalTotal) || 0),
        mergedFrom: [...(primaryOrder.mergedFrom || []), other.table],
      });
      await updateDoc(doc(db, "orders", other.id), { status: "cancelled", cancelledAt: Date.now(), cancelledReason: "Merged into " + primaryOrder.table });
      toast("Merged successfully", "success");
      onClose();
    } catch (e) { toast(e.message, "error"); }
  };
  return (
    <ModalShell C={C} open onClose={onClose} isMobile={isMobile} title="Merge Table" icon="🔗">
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
        <button onClick={merge} disabled={!selectedId} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: !selectedId ? "not-allowed" : "pointer" }}>Merge</button>
      </div>
    </ModalShell>
  );
}

function SplitBillModal({ C, isMobile, order, onClose }) {
  const toast = useToast();
  const items = order.items || [];
  const [split1, setSplit1] = useState({});
  const toggleItem = (idx) => setSplit1(prev => ({ ...prev, [idx]: !prev[idx] }));
  const total1 = items.reduce((s, it, i) => s + (split1[i] ? it.price * it.qty : 0), 0);
  const total2 = (Number(order.finalTotal) || 0) - total1;
  return (
    <ModalShell C={C} open onClose={onClose} isMobile={isMobile} title="Split Bill" icon="✂️" maxWidth={450}>
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
        <button onClick={() => {
          if (!Object.values(split1).some(Boolean)) { toast("Kam se kam 1 item tick karo", "warning"); return; }
          printSplitBills(order, split1); onClose();
        }} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.blue, color: "#fff", fontWeight: 800, cursor: "pointer" }}>Print Both</button>
      </div>
    </ModalShell>
  );
}

// ===========================================================================
// BILLING VIEW (with debounce + autosave + sticky bar + confetti)
// ===========================================================================
function BillingView({ C, isMobile, table, menu, orders, cart, setCart, waiterName, existingOrder, addMoreMode, onBack, isOwner, onPaidSuccess }) {
  const toast = useToast();
  const haptic = useHaptic();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 150);
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
        (existingOrder.items || []).forEach(it => { initialCart[it.itemId] = (initialCart[it.itemId] || 0) + it.qty; });
        setCart(initialCart);
      }
    }
  }, [existingOrder?.id, addMoreMode]);

  // Autosave cart to localStorage
  useEffect(() => {
    if (!existingOrder && !addMoreMode && Object.keys(cart).length > 0) {
      try { localStorage.setItem(`staff_draft_${table}`, JSON.stringify(cart)); } catch (e) {}
    }
  }, [cart, table, existingOrder, addMoreMode]);

  // Restore draft on open (only if new order)
  useEffect(() => {
    if (!existingOrder && !addMoreMode) {
      try {
        const draft = localStorage.getItem(`staff_draft_${table}`);
        if (draft && Object.keys(cart).length === 0) {
          const parsed = JSON.parse(draft);
          if (parsed && Object.keys(parsed).length > 0) {
            setCart(parsed);
            toast("Draft restored", "info");
          }
        }
      } catch (e) {}
    }
  }, []);

  const existingItems = existingOrder?.items || [];
  const existingSubtotal = existingItems.reduce((s, it) => s + (it.price * it.qty), 0);

  const categories = useMemo(() => ["All", ...Array.from(new Set(menu.map(m => m.category)))], [menu]);
  const filtered = useMemo(() => menu.filter(m => m.available && (category === "All" || m.category === category) && (!debouncedSearch.trim() || m.name.toLowerCase().includes(debouncedSearch.toLowerCase()))), [menu, category, debouncedSearch]);

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const resolveItem = (id) => { const m = menu.find(x => x.id === id); if (m) return m; const ex = existingItems.find(e => e.itemId === id); return ex || null; };
  const cartSubtotal = cartItems.reduce((s, [id, q]) => { const m = resolveItem(id); return s + (m?.price || 0) * q; }, 0);
  const grossSub = addMoreMode ? existingSubtotal + cartSubtotal : cartSubtotal;
  const discAmt = Math.round(grossSub * discount / 100);
  const gstAmt = Math.round((grossSub - discAmt) * gstRate / 100);
  const totalAmount = Math.max(0, grossSub - discAmt) + gstAmt;

  useEffect(() => {
    const running = orders.filter(o => o.orderType === "dine_in" && Number(o.table) === Number(table) && o.status !== "served" && o.status !== "cancelled");
    setRunningOrders(running);
  }, [orders, table]);

  const setQty = (id, q) => {
    haptic(5);
    setCart(prev => { const next = { ...prev }; if (q <= 0) delete next[id]; else next[id] = q; return next; });
  };

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
      if (m) finalItems.push({ itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty, kotNumber: existingMap[id] ? (ex?.kotNumber || 1) : nextKotNo });
      else if (ex) finalItems.push({ itemId: id, name: ex.name, portion: ex.portion || "", price: ex.price, qty, kotNumber: ex.kotNumber || 1 });
    });
    if (finalItems.length === 0) throw new Error("Bill me kam se kam 1 item hona chahiye");
    const sub = finalItems.reduce((s, it) => s + it.price * it.qty, 0);
    const d = Math.round((sub * discount) / 100);
    const g = Math.round(((sub - d) * gstRate) / 100);
    const finalTotal = Math.max(0, sub - d) + g;
    await updateDoc(doc(db, "orders", existingOrder.id), { items: finalItems, subtotal: sub, billDiscountPct: discount, billDiscount: d, gstRate, gstAmount: g, finalTotal, payment: payMode, billEditedAt: Date.now() });
    return { finalItems, sub, discAmt: d, gstAmt: g, finalTotal };
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
        await updateDoc(doc(db, "orders", base.id), { kots: [...baseKots, runKot], items: [...(base.items || []), ...newItems], status: "new", finalTotal: (Number(base.finalTotal) || 0) + addedTotal, subtotal: (Number(base.subtotal) || 0) + addedTotal, paid: false, paymentStatus: "pending", lastKotAt: Date.now() });
        printKOT({ ...base, items: newItems, kots: [runKot] });
        haptic(30);
        toast(`KOT #${nextNo} added & printing`, "success");
        onBack();
      } catch (e) { toast(e.message, "error"); } finally { setPlacing(false); }
      return;
    }
    setPlacing(true);
    try {
      const items = cartItems.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty, kotNumber: 1 }; });
      const orderId = uid("o");
      const sub = cartSubtotal;
      const d = Math.round((sub * discount) / 100);
      const g = Math.round(((sub - d) * gstRate) / 100);
      const finalTotal = Math.max(0, sub - d) + g;
      const order = { id: orderId, table: table === "parcel" ? "" : table, orderType: table === "parcel" ? "parcel" : "dine_in", customer: { name: "Walk-in", phone: "" }, items, waiter: waiterName || "Staff", kots: [{ id: uid("kot"), kotNumber: 1, items, createdAt: Date.now(), status: "new", isRunning: false }], status: "new", paid: false, subtotal: sub, billDiscountPct: discount, billDiscount: d, gstRate, gstAmount: g, finalTotal, payment: payMode, createdAt: Date.now(), createdBy: auth.currentUser?.uid };
      await setDoc(doc(db, "orders", orderId), order);
      printKOT(order);
      try { localStorage.removeItem(`staff_draft_${table}`); } catch (e) {}
      haptic(30);
      toast("Order placed! KOT printing", "success");
      onBack();
    } catch (e) { toast(e.message, "error"); } finally { setPlacing(false); }
  };

  const handleSaveBill = async () => {
    if (!existingOrder || addMoreMode || placing) return;
    setPlacing(true);
    try { await applyCartChanges(); toast("Bill saved", "success"); onBack(); }
    catch (e) { toast(e.message, "error"); } finally { setPlacing(false); }
  };

  const handlePaidPrint = async () => {
    if (!existingOrder || addMoreMode || placing) return;
    setPlacing(true);
    try {
      if (payMode === "due") {
        if (cartItems.length === 0) { toast("Bill me kam se kam 1 item hona chahiye", "warning"); setPlacing(false); return; }
        const dn = window.prompt("Customer ka naam (due)?", "");
        if (dn === null) { setPlacing(false); return; }
        const dp = window.prompt("Phone number?", "") || "";
        const applied = await applyCartChanges();
        await updateDoc(doc(db, "orders", existingOrder.id), { payment: "due", paid: false, paymentStatus: "due", status: "served", dueName: dn || "Unknown", duePhone: dp, dueAt: Date.now() });
        logAudit("due_created", { orderId: existingOrder.id, total: applied.finalTotal, name: dn || "" });
        printBill({ ...existingOrder, finalTotal: applied.finalTotal, subtotal: applied.sub, gstAmount: applied.gstAmt, billDiscount: applied.discAmt, payment: "due", paid: false });
        toast("Due me save ho gaya", "success");
        onBack();
        return;
      }
      const applied = await applyCartChanges();
      await updateDoc(doc(db, "orders", existingOrder.id), { paid: true, paymentStatus: "paid", paidAt: Date.now() });
      printBill({ ...existingOrder, finalTotal: applied.finalTotal, subtotal: applied.sub, gstAmount: applied.gstAmt, billDiscount: applied.discAmt, payment: payMode, paid: true });
      haptic(80);
      toast("Payment received! Bill printing", "success");
      if (onPaidSuccess) onPaidSuccess();
      onBack();
    } catch (e) { toast(e.message, "error"); } finally { setPlacing(false); }
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
      await updateDoc(doc(db, "orders", orderId), { kots: [...baseKots, runKot], items: [...(baseOrder.items || []), ...newItems], status: "new", finalTotal: (Number(baseOrder.finalTotal) || 0) + addedTotal, subtotal: (Number(baseOrder.subtotal) || 0) + addedTotal, paid: false, paymentStatus: "pending", lastKotAt: Date.now() });
      printKOT({ ...baseOrder, items: newItems, kots: [runKot] });
      toast(`KOT #${nextNo} added`, "success");
      onBack();
    } catch (e) { toast(e.message, "error"); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 100, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s" }}>
      <div style={{ background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: "#fff", padding: isMobile ? "10px 12px" : "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", padding: isMobile ? "8px 12px" : "9px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: isMobile ? 12 : 13, flexShrink: 0 }}>Back</button>
        <div style={{ fontWeight: 800, fontSize: isMobile ? 13 : 16, textAlign: "center", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {existingOrder ? (addMoreMode ? `Add - ${table === "parcel" ? "Parcel" : "T" + table}` : `Bill - ${table === "parcel" ? "Parcel" : "T" + table} - ${existingItems.length} items`) : (table === "parcel" ? "New - Parcel" : `New - Table ${table}`)}
        </div>
        <div style={{ width: isMobile ? 40 : 60, flexShrink: 0 }} />
      </div>

      {runningOrders.length > 0 && !existingOrder && (
        <div style={{ background: C.amberLight, padding: "8px 12px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: isMobile ? 11 : 13, color: C.ink, fontWeight: 700, flex: 1, minWidth: 120 }}>Table {table} has {runningOrders.length} running order(s)</div>
          <button onClick={() => addRunningItems(runningOrders[0].id)} disabled={cartItems.length === 0} style={{ background: cartItems.length === 0 ? C.line : C.blue, color: "#fff", border: "none", padding: "7px 12px", borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: cartItems.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0 }}>Add to Running</button>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, overflow: isMobile ? "auto" : "hidden", padding: isMobile ? 8 : 12, paddingBottom: isMobile ? 80 : 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", height: isMobile ? "44vh" : undefined, flex: isMobile ? undefined : 1, flexShrink: 0, minWidth: 0 }}>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: "10px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, outline: "none", background: C.card, color: C.ink }} />
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {categories.map(c => (
              <button key={c} onClick={() => { haptic(); setCategory(c); }} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${category === c ? C.red : C.line}`, background: category === c ? C.red : C.card, color: category === c ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0 }}>{c}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(170px, 1fr))", gap: 8, overflowY: "auto", flex: 1 }}>
            {filtered.map(m => {
              const q = cart[m.id] || 0;
              return (
                <button key={m.id} onClick={() => setQty(m.id, q + 1)} style={{ textAlign: "left", padding: isMobile ? 10 : 12, borderRadius: 10, border: `1.5px solid ${q > 0 ? C.green : C.line}`, background: C.card, cursor: "pointer", position: "relative", fontFamily: "inherit", minHeight: isMobile ? 60 : 68, color: C.ink }}>
                  <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: C.ink, marginBottom: 4, lineHeight: 1.2 }}>{m.name}</div>
                  <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(m.price)}</div>
                  {q > 0 && <span style={{ position: "absolute", top: 6, right: 6, background: C.green, color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 800, animation: "successBounce 0.3s" }}>{q}</span>}
                </button>
              );
            })}
            {filtered.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: C.gray }}><div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div><div style={{ fontSize: 13, fontWeight: 700 }}>{menu.length === 0 ? "Menu load ho raha hai..." : "Koi matching item nahi"}</div></div>}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0, width: isMobile ? "100%" : 380, minHeight: isMobile ? 400 : undefined }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.line}`, fontWeight: 800, fontSize: isMobile ? 13 : 15, color: C.ink }}>Cart ({cartItems.length})</div>
          <div style={{ flex: isMobile ? "none" : 1, overflowY: isMobile ? "visible" : "auto", maxHeight: isMobile ? 220 : undefined }}>
            {cartItems.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.gray, fontSize: 13 }}>Menu se item tap karo</div>}
            {cartItems.map(([id, q]) => {
              const m = resolveItem(id);
              if (!m) return null;
              const existingQty = existingItems.filter(e => e.itemId === id).reduce((s, e) => s + e.qty, 0);
              const isNew = !addMoreMode && existingQty === 0;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderBottom: `1px solid ${C.line}`, background: isNew ? C.greenLight : "transparent", minHeight: 36, animation: "slideInRight 0.2s" }}>
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
                {[0,5,10,20].map(d => <button key={d} onClick={() => (isOwner ? setDiscount(d) : toast("Discount sirf owner de sakta hai", "warning"))} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${discount === d ? C.green : C.line}`, background: discount === d ? C.greenLight : C.card, color: discount === d ? C.green : C.ink, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{d === 0 ? "0" : `${d}%`}</button>)}
                <input type="number" min={0} max={100} disabled={!isOwner} value={discount || ""} onChange={e => setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} placeholder="%" style={{ width: 44, padding: "3px 6px", border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 10, background: C.card, color: C.ink, fontWeight: 700, textAlign: "center", outline: "none" }} />
              </div>
            )}
            {!addMoreMode && (
              <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.gray, fontWeight: 800, minWidth: 38 }}>GST</span>
                {[0,5,12,18].map(g => <button key={g} onClick={() => setGstRate(g)} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${gstRate === g ? C.red : C.line}`, background: gstRate === g ? C.redLight : C.card, color: gstRate === g ? C.red : C.ink, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{g === 0 ? "No" : `${g}%`}</button>)}
              </div>
            )}
            {!addMoreMode && (
              <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.gray, fontWeight: 800, minWidth: 38 }}>PAY</span>
                {[["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["due", "Due"]].map(([id, label]) => <button key={id} onClick={() => setPayMode(id)} style={{ padding: "3px 9px", borderRadius: 4, border: `1px solid ${payMode === id ? C.red : C.line}`, background: payMode === id ? C.red : C.card, color: payMode === id ? "#fff" : C.ink, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>)}
              </div>
            )}
            <div style={{ background: C.card, borderRadius: 6, padding: 8, marginBottom: 6 }}>
              {addMoreMode && <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11 }}><span style={{ color: C.gray }}>Running ({existingItems.length})</span><span style={{ fontWeight: 700, fontFamily: "monospace", color: C.ink }}>{inr(existingSubtotal)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11, color: C.green }}><span>New ({cartItems.length})</span><span style={{ fontFamily: "monospace", fontWeight: 700 }}>+{inr(cartSubtotal)}</span></div>
              </>}
              {!addMoreMode && discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11, color: C.green }}><span>Disc {discount}%</span><span style={{ fontFamily: "monospace" }}>-{inr(discAmt)}</span></div>}
              {!addMoreMode && gstRate > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11, color: C.red }}><span>GST {gstRate}%</span><span style={{ fontFamily: "monospace" }}>+{inr(gstAmt)}</span></div>}
              {!addMoreMode && discount === 0 && gstRate === 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11 }}><span style={{ color: C.gray }}>Subtotal</span><span style={{ fontWeight: 700, fontFamily: "monospace", color: C.ink }}>{inr(grossSub)}</span></div>}
            </div>
            <div style={{ background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: `0 4px 12px ${C.red}40` }}>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>TOTAL</span>
              <span style={{ color: "#fff", fontSize: 20, fontWeight: 900, fontFamily: "monospace" }}>{inr(addMoreMode ? grossSub : totalAmount)}</span>
            </div>
            {existingOrder && !addMoreMode && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 6 }}>
                <button onClick={handleSaveBill} disabled={placing} style={{ padding: 12, border: "none", borderRadius: 8, background: C.blue, color: "#fff", fontWeight: 800, fontSize: 13, cursor: placing ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{placing ? <Spinner /> : "Save"}</button>
                <button onClick={handlePaidPrint} disabled={placing} style={{ padding: 12, border: "none", borderRadius: 8, background: C.green, color: "#fff", fontWeight: 800, fontSize: 13, cursor: placing ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{placing ? <Spinner /> : "Paid"}</button>
              </div>
            )}
            {addMoreMode && (
              <button onClick={handlePlaceOrder} disabled={cartItems.length === 0 || placing} style={{ width: "100%", padding: 14, marginTop: 10, border: "none", borderRadius: 10, background: cartItems.length === 0 ? C.line : `linear-gradient(135deg, ${C.green} 0%, #15803D 100%)`, color: cartItems.length === 0 ? C.gray : "#fff", fontWeight: 800, fontSize: 14, cursor: cartItems.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{placing ? <><Spinner /> Adding...</> : "Add Items to Running KOT"}</button>
            )}
            {!existingOrder && (
              <button onClick={handlePlaceOrder} disabled={cartItems.length === 0 || placing} style={{ width: "100%", padding: 14, marginTop: 10, border: "none", borderRadius: 10, background: cartItems.length === 0 ? C.line : `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: cartItems.length === 0 ? C.gray : "#fff", fontWeight: 800, fontSize: 14, cursor: cartItems.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: cartItems.length === 0 ? "none" : `0 6px 16px ${C.red}40`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{placing ? <><Spinner /> Placing...</> : "Send KOT"}</button>
            )}
          </div>
        </div>
      </div>

      {/* STICKY MOBILE CART BAR */}
      {isMobile && cartItems.length > 0 && !existingOrder && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.card, borderTop: `1px solid ${C.line}`, padding: 12, boxShadow: "0 -4px 16px rgba(0,0,0,0.1)", zIndex: 101, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.gray, fontWeight: 800, textTransform: "uppercase" }}>{cartItems.length} items</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(totalAmount)}</div>
          </div>
          <button onClick={handlePlaceOrder} disabled={placing} style={{ padding: "14px 24px", border: "none", borderRadius: 10, background: `linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)`, color: "#fff", fontWeight: 900, fontSize: 14, cursor: placing ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: `0 6px 16px ${C.red}55`, display: "flex", alignItems: "center", gap: 8 }}>{placing ? <Spinner /> : "Place Order"}</button>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// AUDIT LOG
// ===========================================================================
const logAudit = async (action, details = {}) => {
  try { await addDoc(collection(db, "auditLog"), { action, ...details, by: auth.currentUser?.uid || "", at: Date.now() }); } catch (e) {}
};

// ===========================================================================
// REPORTS / DUE / STOCK (unchanged from previous premium version)
// ===========================================================================
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
  paidOrders.forEach(o => { const m = String(o.payment || "cash").toLowerCase(); pay[m] = (pay[m] || 0) + (Number(o.finalTotal) || 0); });
  const dueTotal = valid.filter(o => o.paymentStatus === "due").reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);
  const collected = paidOrders.reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);
  const cancelled = orders.length - valid.length;

  const exportCsv = () => {
    const rows = [["Bill","Date","Type","Table","Waiter","Items","Subtotal","Discount","GST","Total","Payment","Paid"]];
    orders.forEach(o => rows.push([(o.id || "").slice(1,9).toUpperCase(), new Date(o.createdAt).toLocaleString("en-IN"), o.orderType || "", o.table || "", o.waiter || "", (o.items || []).map(it => `${it.qty}x ${it.name}`).join("; "), o.subtotal || 0, o.billDiscount || 0, o.gstAmount || 0, o.finalTotal || 0, o.payment || "", o.paid ? "Yes" : "No"]));
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
        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: C.ink, marginBottom: 14 }}>Top Selling - {rangeLabel}</div>
        {topItems.length === 0 && <div style={{ textAlign: "center", padding: 16, color: C.gray, fontSize: 13 }}>Koi paid sale nahi</div>}
        {topItems.map(([name, d], i) => (
          <div key={name} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, gap: 8 }}>
              <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: C.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{i+1} {name}</span>
              <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: C.gray, fontFamily: "monospace", flexShrink: 0 }}>{d.qty} sold</span>
            </div>
            <div style={{ background: C.line, height: 6, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${(d.qty / maxQty) * 100}%`, height: "100%", background: C.red, borderRadius: 3, transition: "width 0.5s" }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function DueLedger({ C, isMobile, orders }) {
  const toast = useToast();
  const dues = orders.filter(o => o.paymentStatus === "due" && o.status !== "cancelled" && !o.paid);
  const total = dues.reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);
  const settle = async (o, mode) => {
    try {
      await updateDoc(doc(db, "orders", o.id), { paid: true, paymentStatus: "paid", payment: mode, paidAt: Date.now(), settledFromDue: true });
      logAudit("due_settled", { orderId: o.id, total: o.finalTotal || 0, mode });
      toast(`Due settled (${mode})`, "success");
    } catch (e) { toast(e.message, "error"); }
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

function StockPanel({ C, isMobile, menu }) {
  const toast = useToast();
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
    } catch (e) { toast(e.message, "error"); } finally { setBusy(""); }
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
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Item search..." style={{ padding: "9px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, outline: "none", width: isMobile ? "100%" : 200, background: C.card, color: C.ink }} />
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

// ===========================================================================
// ERROR BOUNDARY
// ===========================================================================
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
      <ToastProvider>
        <StaffAppInner />
      </ToastProvider>
    </ErrorBoundary>
  );
}