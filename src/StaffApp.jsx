/* eslint-disable */
import React, { useState, useEffect, useMemo, useRef, useContext, createContext, useCallback } from "react";
import { db, auth } from "./firebase";
import { assertEditable, resolveVendorId } from "./lib/guards";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, setDoc, onSnapshot, getDoc, updateDoc, addDoc,
  query, where, runTransaction, deleteDoc, getDocs, orderBy, limit, writeBatch
} from "firebase/firestore";

// ===========================================================================
// COLORS
// ===========================================================================
const LIGHT = {
  bg: "#FAF7EF", card: "#FFFFFF", cardAlt: "#F4EEDD", ink: "#1C1608",
  gray: "#7A7058", light: "#FAF7EF", line: "#E9E0C9",
  red: "#DC2626", redLight: "#FEF2F2",
  green: "#16A34A", greenLight: "#F0FDF4",
  amber: "#F59E0B", amberLight: "#FFFBEB",
  blue: "#2563EB", blueLight: "#EFF6FF",
  gold: "#B8860B", goldDark: "#7A5806", goldLight: "#FBF3D9", goldText: "#8A6200",
};
const DARK = {
  bg: "#14110A", card: "#1F1A10", cardAlt: "#2C2516", ink: "#F7F0DA",
  gray: "#B0A585", light: "#1F1A10", line: "#3D3319",
  red: "#EF4444", redLight: "#450A0A",
  green: "#22C55E", greenLight: "#052E16",
  amber: "#FBBF24", amberLight: "#451A03",
  blue: "#3B82F6", blueLight: "#1E3A8A",
  gold: "#D4A017", goldDark: "#8F6A0A", goldLight: "#3A2C08", goldText: "#F0C85A",
};

// ===========================================================================
// GLOBAL CSS (animations, press states, shimmer)
// ===========================================================================
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap');
h2 { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; letter-spacing: 0.2px; }
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
input:focus, textarea:focus { border-color: #B8860B !important; box-shadow: 0 0 0 3px rgba(184,134,11,0.18); }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 4px; }
::-webkit-scrollbar-track { background: transparent; }
.ep-noscroll { scrollbar-width: none; -ms-overflow-style: none; }
.ep-noscroll::-webkit-scrollbar { display: none; }
@media (hover: hover) { .ep-card:hover { box-shadow: 0 8px 20px rgba(184,134,11,0.22) !important; border-color: #B8860B !important; transform: translateY(-1px); } }
button:focus-visible, select:focus-visible { outline: 2px solid #B8860B; outline-offset: 2px; }
::selection { background: rgba(184,134,11,0.28); }
`;

// ===========================================================================
// UTILS
// ===========================================================================
const uid = (p) => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
const inr = (n) => { const v = Number(n); return "₹" + (isFinite(v) ? v : 0).toLocaleString("en-IN"); };
const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
};
const TABLE_COUNT = 20;
// Chalu parcel: paid / due / cancelled nahi, aur 18 ghante ke andar
const PAID_STATUSES = ["paid", "paid_unverified"];
const isOpenParcel = (o) =>
  o.orderType === "parcel" && o.status !== "cancelled" && !o.paid &&
  o.paymentStatus !== "due" && !PAID_STATUSES.includes(o.paymentStatus) &&
  Date.now() - (o.createdAt || 0) < 18 * 3600 * 1000;
// Table tab tak occupied jab tak paid / due / cancelled na ho (served hone par table free nahi dikhna chahiye)
const isOpenDineIn = (o) =>
  o.orderType === "dine_in" && o.status !== "cancelled" && !o.paid &&
  o.paymentStatus !== "due" && !PAID_STATUSES.includes(o.paymentStatus) &&
  Date.now() - (o.createdAt || 0) < 18 * 3600 * 1000;
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
  upi: "heckeyhr@ybl",
};

const FRESH_MS = 30 * 60 * 1000;
const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (v.toMillis) return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  return 0;
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
      <div style={{ width: 100, height: 100, background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, boxShadow: `0 20px 60px ${C.gold}55`, animation: "successBounce 0.6s ease-out" }}>🍽️</div>
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
// 📋 ESTIMATE PANEL — persons + items (manual ya auto) + one-click cart
// ===========================================================================

const SUGGEST_RULES = [
  { re: /starter|snack|tandoor|appetizer|momos|roll/i, perPerson: 0.5, pick: 2 },
  { re: /main|curry|sabzi|gravy|paneer|chicken|mutton|fish|egg/i, perPerson: 0.7, pick: 3 },
  { re: /bread|roti|naan|paratha/i, perPerson: 2, pick: 2 },
  { re: /rice|biryani|pulao/i, perPerson: 0.5, pick: 1 },
  { re: /dessert|sweet|ice/i, perPerson: 0.5, pick: 1 },
  { re: /drink|beverage|juice|shake|cold|coffee/i, perPerson: 1, pick: 2 },
  { re: /thali/i, perPerson: 1, pick: 1 },
];

function buildSuggestion(menu, persons) {
  const used = new Set();
  const out = [];
  SUGGEST_RULES.forEach((rule) => {
    const pool = menu
      .filter((m) => rule.re.test(m.category || "") && !used.has(m.id) && m.available !== false)
      .sort((a, b) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0))
      .slice(0, rule.pick);
    if (!pool.length) return;
    const totalQty = Math.max(1, Math.ceil(persons * rule.perPerson));
    const each = Math.max(1, Math.ceil(totalQty / pool.length));
    pool.forEach((m) => {
      used.add(m.id);
      out.push({ id: m.id, name: m.name, price: Number(m.price) || 0, qty: each });
    });
  });
  return out;
}


const SMART_AI_STEPS = [
  { key: "type", q: "Khaane ka type kya rakhein?", options: ["Veg", "Non-Veg", "Mix (Veg + Non-Veg)"] },
  { key: "starter", q: "Starter (Snacks) me kya loge?", options: ["Veg Starter", "Non-Veg Starter", "Starter Skip karo"] },
  { key: "main", q: "Main Course me kya loge?", options: ["Paneer (Veg)", "Chicken / Mutton (Non-Veg)", "Dal (Simple Veg)", "Main Course Skip karo"] },
  { key: "bread", q: "Bread / Roti me kya loge?", options: ["Tandoori Roti", "Naan / Butter Naan", "Bread Skip karo"] },
  { key: "drink", q: "Drinks & Dessert?", options: ["Shakes / Cold Drinks", "Dessert (Sweet)", "Dono", "Skip karo"] },
];


function EstimatePanel({ C, menu, isMobile, onClose, onMoveToCart }) {
  const [persons, setPersons] = React.useState(2);
  const [mode, setMode] = React.useState("manual");
  const [items, setItems] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [catFilter, setCatFilter] = React.useState("All");
  const toast = useToast();

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const addItem = (m) =>
    setItems((prev) => {
      const ex = prev.find((p) => p.id === m.id);
      if (ex) return prev.map((p) => (p.id === m.id ? { ...p, qty: p.qty + 1 } : p));
      return [...prev, { id: m.id, name: m.name, price: Number(m.price) || 0, qty: 1 }];
    });

  const changeQty = (id, d) =>
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, qty: p.qty + d } : p)).filter((p) => p.qty > 0)
    );

  const runAuto = () => {
    const s = buildSuggestion(menu, Number(persons) || 1);
    if (!s.length) { toast("Auto suggest ke liye menu me category match nahi mili", "warning"); return; }
    setItems(s);
  };

  const categories = React.useMemo(
    () => ["All", ...Array.from(new Set(menu.map((m) => m.category).filter(Boolean)))],
    [menu]
  );

  const filtered = React.useMemo(
    () => menu.filter((m) =>
      m.available !== false &&
      (catFilter === "All" || m.category === catFilter) &&
      (!search.trim() || String(m.name || "").toLowerCase().includes(search.toLowerCase()))
    ).slice(0, 60),
    [menu, search, catFilter]
  );

  const btn = (active) => ({
    padding: isMobile ? "9px 14px" : "8px 16px",
    borderRadius: 10,
    border: "1.5px solid " + (active ? C.gold : C.line),
    background: active ? C.gold : C.card,
    color: active ? "#fff" : C.ink,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, color: C.ink, borderRadius: isMobile ? "20px 20px 0 0" : 16, padding: 18, width: "100%", maxWidth: isMobile ? "100%" : 600, maxHeight: isMobile ? "92vh" : "88vh", overflowY: "auto", animation: isMobile ? "slideUp .25s ease-out" : "scaleIn .18s ease-out", boxShadow: "0 -8px 40px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>📋 Estimate</div>
          <button onClick={onClose} style={{ background: "rgba(0,0,0,.05)", border: "none", borderRadius: "50%", width: 34, height: 34, fontSize: 16, cursor: "pointer", color: C.ink }}>✕</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.cardAlt, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>👥 Persons:</span>
          <input type="number" min="1" value={persons} onChange={(e) => setPersons(e.target.value)} style={{ width: 80, padding: "8px 10px", borderRadius: 8, border: "1.5px solid " + C.line, fontSize: 16, fontWeight: 900, textAlign: "center", background: C.card, color: C.ink, outline: "none" }} />
          <span style={{ fontSize: 12, color: C.gray, fontWeight: 700 }}>ke hisaab se</span>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button style={btn(mode === "manual")} onClick={() => { if (mode === "auto" && items.length > 0) { if(window.confirm("AI band ho jayega, par aapke items safe rahenge. Aage badhein?")) setMode("manual"); } else setMode("manual"); }}>✍️ Manual</button>
          <button style={btn(mode === "auto")} onClick={() => { setMode("auto"); runAuto(); }}>🤖 Smart AI Suggest</button>
        </div>

        {mode === "manual" && (
          <div style={{ marginBottom: 12 }}>
            <input placeholder="🔍 Item search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid " + C.line, fontSize: 14, boxSizing: "border-box", background: C.card, color: C.ink, outline: "none", marginBottom: 8 }} />
            <div className="ep-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 6 }}>
              {categories.map((c) => (
                <button key={c} onClick={() => setCatFilter(c)} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid " + (catFilter === c ? C.gold : C.line), background: catFilter === c ? C.gold : C.card, color: catFilter === c ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit" }}>{c}</button>
              ))}
            </div>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid " + C.line, borderRadius: 10 }}>
              {filtered.map((m) => (
                <button key={m.id} onClick={() => addItem(m)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "10px 12px", border: "none", borderBottom: "1px solid " + C.line, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: C.ink }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.goldText, fontFamily: "monospace" }}>{inr(m.price)} ＋</span>
                </button>
              ))}
              {filtered.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.gray, fontSize: 13 }}>Koi item nahi mila</div>}
            </div>
          </div>
        )}

        {mode === "auto" && (
          <div style={{ marginBottom: 12, padding: 16, background: C.cardAlt, borderRadius: 12, border: "1px solid " + C.line }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 10 }}>
              🤖 Smart AI Suggest (Persons: {persons})
            </div>
            
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => {
                const starters = menu.filter(m => m.available && (m.category.includes("Starter") || m.category.includes("Snack") || m.category.includes("Momos")));
                const paneer = menu.filter(m => m.available && m.category.includes("Paneer"));
                const dal = menu.filter(m => m.available && m.category.includes("Dal"));
                const roti = menu.filter(m => m.available && m.category.includes("Roti"));
                const naan = menu.filter(m => m.available && m.category.includes("Naan"));
                
                let newItems = [];
                if (starters.length) newItems.push({ id: starters[0].id, name: starters[0].name, price: starters[0].price, qty: Math.ceil(persons * 0.5) });
                if (paneer.length) newItems.push({ id: paneer[0].id, name: paneer[0].name, price: paneer[0].price, qty: Math.ceil(persons * 0.7) });
                if (dal.length) newItems.push({ id: dal[0].id, name: dal[0].name, price: dal[0].price, qty: 1 });
                if (roti.length) newItems.push({ id: roti[0].id, name: roti[0].name, price: roti[0].price, qty: persons * 2 });
                if (naan.length) newItems.push({ id: naan[0].id, name: naan[0].name, price: naan[0].price, qty: persons });
                
                if (!newItems.length) { toast("Menu me items nahi mile", "warning"); return; }
                setItems(prev => {
                  const merged = [...prev];
                  newItems.forEach(ni => {
                    const ex = merged.find(p => p.id === ni.id);
                    if (ex) ex.qty += ni.qty;
                    else merged.push(ni);
                  });
                  return merged;
                });
                setMode("manual");
                toast("✅ AI ne items add kar diye!", "success");
              }} style={{ padding: "10px 16px", borderRadius: 8, background: C.card, border: "1px solid " + C.line, color: C.ink, fontWeight: 700, cursor: "pointer" }}>
                🟢 Veg Combo (Start + Main + Bread)
              </button>

              <button onClick={() => {
                const nonVegStarters = menu.filter(m => m.available && (m.category.includes("Chicken") || m.category.includes("Mutton") || m.category.includes("Fish")));
                const chicken = menu.filter(m => m.available && m.category.includes("Chicken"));
                const naan = menu.filter(m => m.available && m.category.includes("Naan"));
                
                let newItems = [];
                if (nonVegStarters.length) newItems.push({ id: nonVegStarters[0].id, name: nonVegStarters[0].name, price: nonVegStarters[0].price, qty: Math.ceil(persons * 0.5) });
                if (chicken.length) newItems.push({ id: chicken[0].id, name: chicken[0].name, price: chicken[0].price, qty: Math.ceil(persons * 0.7) });
                if (naan.length) newItems.push({ id: naan[0].id, name: naan[0].name, price: naan[0].price, qty: persons });
                
                if (!newItems.length) { toast("Menu me Non-Veg items nahi mile", "warning"); return; }
                setItems(prev => {
                  const merged = [...prev];
                  newItems.forEach(ni => {
                    const ex = merged.find(p => p.id === ni.id);
                    if (ex) ex.qty += ni.qty;
                    else merged.push(ni);
                  });
                  return merged;
                });
                setMode("manual");
                toast("✅ AI ne items add kar diye!", "success");
              }} style={{ padding: "10px 16px", borderRadius: 8, background: C.card, border: "1px solid " + C.line, color: C.ink, fontWeight: 700, cursor: "pointer" }}>
                🔴 Non-Veg Combo
              </button>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Selected Items ({items.length})</div>
          {items.length === 0 && <div style={{ padding: 16, textAlign: "center", color: C.gray, fontSize: 13, background: C.cardAlt, borderRadius: 10 }}>Abhi koi item nahi — upar se add karo ya Auto Suggest dabao</div>}
          {items.map((i) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid " + C.line, background: C.cardAlt, borderRadius: 8, marginBottom: 4 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, minWidth: 0 }}>{i.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid " + C.line, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                <button onClick={() => changeQty(i.id, -1)} style={{ width: 30, height: 30, border: "none", background: C.card, color: C.ink, fontSize: 16, fontWeight: 900, cursor: "pointer" }}>−</button>
                <span style={{ fontWeight: 900, fontSize: 14, minWidth: 24, textAlign: "center" }}>{i.qty}</span>
                <button onClick={() => changeQty(i.id, 1)} style={{ width: 30, height: 30, border: "none", background: C.goldLight, color: C.goldText, fontSize: 16, fontWeight: 900, cursor: "pointer" }}>＋</button>
              </div>
              <span style={{ width: 70, textAlign: "right", fontWeight: 900, fontSize: 13, fontFamily: "monospace", flexShrink: 0 }}>{inr(i.price * i.qty)}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "linear-gradient(135deg, " + C.gold + " 0%, " + C.goldDark + " 100%)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, boxShadow: "0 4px 12px " + C.gold + "40" }}>
          <div>
            <div style={{ color: "#fff", fontSize: 10, fontWeight: 800, opacity: 0.85, letterSpacing: 0.5, textTransform: "uppercase" }}>Total ({items.length} items)</div>
            <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, fontFamily: "monospace" }}>{inr(total)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#fff", fontSize: 10, fontWeight: 800, opacity: 0.85, letterSpacing: 0.5, textTransform: "uppercase" }}>Per Person</div>
            <div style={{ color: "#fff", fontSize: 16, fontWeight: 800, fontFamily: "monospace" }}>{inr(Math.round(total / (Number(persons) || 1)))}</div>
          </div>
        </div>

        <button
          disabled={!items.length}
          onClick={() => onMoveToCart(items)}
          style={{ marginTop: 12, width: "100%", padding: "15px", background: items.length ? "linear-gradient(135deg, " + C.green + " 0%, #15803D 100%)" : C.line, color: items.length ? "#fff" : C.gray, border: "none", borderRadius: 12, fontSize: 16, fontWeight: 900, cursor: items.length ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          ✅ Cart me bhejo ({items.length} items)
        </button>
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
  const [dueOrders, setDueOrders] = useState([]);
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
  const [tableMove, setTableMove] = useState(null);
  const [splitBillOrder, setSplitBillOrder] = useState(null);
  const [billOrder, setBillOrder] = useState(null);
  const [addMoreMode, setAddMoreMode] = useState(false);
  const [ordersFilter, setOrdersFilter] = useState("all");
  const [ordersRange, setOrdersRange] = useState(null);
  const [confetti, setConfetti] = useState(false);
  const [showEstimate, setShowEstimate] = useState(false);
  const [muted, setMuted] = useState(() => localStorage.getItem("staff_mute") === "1");
  const prevNewIdsRef = useRef(null);
  const [lowCount, setLowCount] = useState(0);
  // 🔔 Waiter calls listener (unified patch)
  const [calls, setCalls] = useState([]);
  const [bookings, setBookings] = useState([]);
  const prevCallsRef = useRef(0);
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, "calls"), where("status", "==", "active")),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCalls(list);
        if (list.length > prevCallsRef.current) {
          try { new Audio("https://assets.mixkit.co/active-storage/sfx/951/951-preview.mp3").play().catch(() => {}); } catch (e) {}
        }
        prevCallsRef.current = list.length;
      },
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
  }, [user]);
  const resolveCall = async (id) => {
    try { await updateDoc(doc(db, "calls", id), { status: "resolved", resolvedAt: Date.now() }); }
    catch (e) { setCalls(prev => prev.filter(c => c.id !== id)); }
  };
  useEffect(() => {
    if (!user) return;
    let invItems = [], invStock = {};
    const calc = () => setLowCount(invItems.filter((it) => Number(it.min) > 0 && invStock[it.id] !== undefined && Number(invStock[it.id]) <= Number(it.min)).length);
    const u1 = onSnapshot(doc(db, "inventory", "items"), (s) => { invItems = s.exists() && Array.isArray(s.data().list) ? s.data().list : []; calc(); }, () => {});
    const u2 = onSnapshot(doc(db, "inventory", "state"), (s) => { invStock = s.exists() ? (s.data().stock || {}) : {}; calc(); }, () => {});
    return () => { u1(); u2(); };
  }, [user]);
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
  if (snap.exists() && Array.isArray(snap.data().items) && snap.data().items.length > 0) {
    setMenu(snap.data().items);
  } else {
    console.warn("⚠️ Menu khali hai. Customer app se pehli baar khulne pe seed hoga.");
    setMenu([]);
  }
}, (err) => { console.error("menu listener:", err); });
    const startRange = new Date(); startRange.setDate(startRange.getDate() - 30); startRange.setHours(0,0,0,0);
    const unsubOrders = onSnapshot(query(collection(db, "orders"), where("createdAt", ">=", startRange.getTime())), (snap) => {
      const newOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(newOrders);
    }, (err) => { console.error("orders listener:", err); });
    const unsubDue = onSnapshot(
      query(collection(db, "orders"), where("paymentStatus", "==", "due")),
      (snap) => setDueOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => { unsubMenu(); unsubOrders(); unsubDue(); };
  }, [user]);

  useEffect(() => {
    if (user && "Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  }, [user]);

  const playSound = () => { if (localStorage.getItem("staff_mute") === "1") return; try { const a = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"); a.volume = 0.6; a.play().catch(() => {}); } catch (e) {} };
  const clickSound = () => { try { const a = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT");
    a.volume = 0.15; a.play().catch(() => {}); } catch (e) {} };

  const newCount = orders.filter(o => o.status === "new" && toMillis(o.createdAt) > Date.now() - FRESH_MS).length;
  const parcelCount = orders.filter(isOpenParcel).length;

  useEffect(() => {
    const fresh = orders.filter(o => o.status === "new" && toMillis(o.createdAt) > Date.now() - FRESH_MS);
    const freshIds = fresh.map(o => o.id);
    if (prevNewIdsRef.current === null) { prevNewIdsRef.current = freshIds; return; }
    const prevSet = new Set(prevNewIdsRef.current);
    const hasNew = freshIds.some(id => !prevSet.has(id));
    if (hasNew) {
      playSound();
      fresh.forEach(o => {
        if (prevSet.has(o.id)) return;
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try { new Notification("New Order", { body: (o.orderType === "parcel" ? "Parcel" : "Table " + o.table) + " - " + inr(o.finalTotal || 0) }); } catch (e) {}
        }
      });
    }
    prevNewIdsRef.current = freshIds;
  }, [orders]);

  useEffect(() => {
    document.title = (newCount ? "(" + newCount + ") " : "") + "Eat & Park Staff";
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
      const msg = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(err.code) ? "Email ya password galat hai"
        : err.code === "auth/too-many-requests" ? "Bahut zyada try ho gaye, thodi der baad try karo"
        : err.code === "auth/network-request-failed" ? "Internet check karo"
        : err.message;
      setLoginError(msg);
    }
  };

  const handleLogout = async () => {
    try {
      Object.keys(localStorage).filter(k => k.startsWith("staff_draft_")).forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    } catch (e) {}
    setCart({}); setSelectedTable(null); setBillOrder(null); setAddMoreMode(false);
    await signOut(auth); setUser(null); setStaffData(null);
  };

  if (loading) return <SplashScreen C={C} />;

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${C.bg} 0%, ${C.cardAlt} 100%)`, fontFamily: "system-ui, sans-serif", padding: 16 }}>
        <form onSubmit={handleLogin} style={{ background: C.card, borderRadius: 20, padding: isMobile ? 24 : 36, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: `1px solid ${C.line}`, animation: "scaleIn 0.35s ease-out" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 12px", background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, boxShadow: `0 8px 24px ${C.gold}40` }}>🍽️</div>
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
          <button type="submit" style={{ width: "100%", padding: "15px", border: "none", borderRadius: 10, background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 8px 20px ${C.gold}40` }}>Sign In</button>
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
      <div style={{ background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, color: "#fff", padding: isMobile ? "10px 10px" : "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 16px rgba(184,134,11,0.30)", position: "sticky", top: 0, zIndex: 50, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, minWidth: 0, flex: 1 }}>
          <button onClick={() => { haptic(); setSidebarOpen(true); }} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: isMobile ? 34 : 38, height: isMobile ? 34 : 38, borderRadius: 8, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>☰</button>
          {!isMobile && <div style={{ width: 42, height: 42, background: "rgba(255,255,255,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🍽️</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Eat & Park</div>
            {!isMobile && <div style={{ fontSize: 11, opacity: 0.9, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{staffData?.name || "Staff"} - {staffData?.role || "waiter"}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: isMobile ? 4 : 8, alignItems: "center", flexShrink: 0 }}>
          <button onClick={() => { const n = !muted; setMuted(n); localStorage.setItem("staff_mute", n ? "1" : "0"); }} title="Sound" style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: 38, height: 38, borderRadius: 8, fontSize: 16, cursor: "pointer" }}>{muted ? "🔇" : "🔔"}</button>
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
      <div style={{ background: C.card, borderBottom: `1px solid ${C.line}`, padding: isMobile ? "0 8px" : "0 16px", display: "flex", gap: 4, overflowX: "auto", alignItems: "center" }}>
        <button onClick={() => { haptic(); setShowEstimate(true); }} style={{ padding: isMobile ? "12px 12px" : "15px 20px", border: "none", background: "transparent", color: C.green, fontWeight: 900, fontSize: isMobile ? 12 : 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, borderBottom: `3px solid ${C.green}` }}>📋 Estimate</button>
        {[
          { id: "tables", label: `🍽️ Tables` }, { id: "parcel", label: `🛍️ Parcel${parcelCount ? ` (${parcelCount})` : ""}` },
          { id: "orders", label: `📋 Orders${newCount ? ` (${newCount})` : ""}` }, { id: "kot", label: `🍳 Kitchen${newCount ? ` (${newCount})` : ""}` },
          { id: "dashboard", label: "📊 Dashboard" }, { id: "history", label: "🕘 History" },
          { id: "inventory", label: "🧾 Saman" + (lowCount ? " (" + lowCount + ")" : "") }, { id: "audit", label: "📝 Audit" },
          { id: "expenses", label: "💸 Kharcha" }, { id: "bookings", label: "📅 Bookings" },
          { id: "reports", label: "📈 Reports" }, { id: "import", label: "📥 Import" },
        ].map(tab => (
          <button key={tab.id} onClick={() => { haptic(); setActiveTab(tab.id); setSelectedTable(null); setOrdersRange(null); }} style={{ padding: isMobile ? "12px 12px" : "15px 20px", border: "none", background: "transparent", color: activeTab === tab.id ? C.gold : C.gray, fontWeight: 700, fontSize: isMobile ? 12 : 13, cursor: "pointer", borderBottom: activeTab === tab.id ? `3px solid ${C.gold}` : "3px solid transparent", whiteSpace: "nowrap", flexShrink: 0 }}>{tab.label}</button>
        ))}
      </div>
      {/* CONTENT */}
      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? 10 : 16 }}>
        
{calls.length > 0 && (
  <div style={{ background: C.amberLight, borderBottom: `2px solid ${C.amber}`, padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
    <span style={{ fontWeight: 800, fontSize: 13, color: C.amber }}>🔔 Waiter Called ({calls.length}):</span>
    {calls.map(c => (
      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, borderRadius: 20, padding: "4px 6px 4px 12px", border: `1px solid ${C.line}` }}>
        <span style={{ fontWeight: 800, fontSize: 12, color: C.ink }}>Table {c.table}</span>
        <button onClick={() => resolveCall(c.id)} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 14, padding: "4px 10px", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✓ Done</button>
      </div>
    ))}
  </div>
)}

{activeTab === "tables" && (
          <TablesView C={C} isMobile={isMobile} orders={orders}
            onTableClick={(t) => { haptic(); setSelectedTable(t); setCart({}); setBillOrder(null); setAddMoreMode(false); }}
            onEditBill={(order) => { haptic(); setBillOrder(order); setSelectedTable(order.table); setCart({}); setAddMoreMode(false); }}
            onAddMore={(order) => { haptic(); setBillOrder(order); setSelectedTable(order.table); setCart({}); setAddMoreMode(true); }}
            onMerge={(order) => setTableMerge(order)}
            onSplit={(order) => setSplitBillOrder(order)}
            onMove={(order) => setTableMove(order)}
            onFeedback={(order) => setFeedbackOrder(order)}
            search={searchTable} setSearch={setSearchTable}
            todayRevenue={todayRevenue} activeOrders={activeOrders.length} />
        )}
        
{activeTab === "bookings" && (
  <div>
    <h2 style={{ margin: "0 0 16px", fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Bookings ({bookings?.length || 0})</h2>
    {(!bookings || bookings.length === 0) && <div style={{ textAlign: "center", padding: 40, color: C.gray }}><div style={{ fontSize: 40, marginBottom: 8 }}>📅</div><div style={{ fontSize: 13, fontWeight: 700 }}>Koi booking nahi</div></div>}
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(bookings || []).sort((a,b) => b.createdAt - a.createdAt).map(b => (
        <div key={b.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.ink }}>{b.type === "party" ? "🎉 Party" : "🍽️ Table"}</div>
            <span style={{ background: C.amberLight, color: C.amber, padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 800 }}>{(b.status || "pending").toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 12, color: C.ink, fontWeight: 700 }}>{b.name} · {b.phone}</div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>{b.date} at {b.time} · {b.guests} guests</div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <a href={`https://wa.me/91${b.phone}`} target="_blank" rel="noopener noreferrer" style={{ background: "#25D366", color: "#fff", padding: "7px 14px", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 12 }}>✅ Confirm</a>
            <button onClick={async () => { if (window.confirm("Delete booking?")) { try { await deleteDoc(doc(db, "bookings", b.id)); toast("Deleted", "success"); } catch (e) { toast(e.message, "error"); } } }} style={{ background: "transparent", color: C.red, border: `1.5px solid ${C.red}`, padding: "7px 14px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

{activeTab === "orders" && (
          <OrdersView C={C} isMobile={isMobile} orders={orders} menu={menu} waiterName={waiterName} isOwner={isOwner} onAddMore={(order) => { setBillOrder(order); setSelectedTable(order.table || "parcel"); setCart({}); setAddMoreMode(true); }} onEditBill={(order) => { setBillOrder(order); setSelectedTable(order.table || "parcel"); setCart({}); setAddMoreMode(false); }} filter={ordersFilter} setFilter={setOrdersFilter} rangeStart={ordersRange?.start} rangeEnd={ordersRange?.end} setOrders={setOrders} onPaidSuccess={() => { setConfetti(true); setTimeout(() => setConfetti(false), 1800); }} />
        )}
        {activeTab === "parcel" && (
          <ParcelView C={C} isMobile={isMobile} orders={orders}
            onNew={() => { haptic(); setSelectedTable("parcel"); setCart({}); setBillOrder(null); setAddMoreMode(false); }}
            onBill={(order) => { haptic(); setBillOrder(order); setSelectedTable("parcel"); setCart({}); setAddMoreMode(false); }}
            onAdd={(order) => { haptic(); setBillOrder(order); setSelectedTable("parcel"); setCart({}); setAddMoreMode(true); }} />
        )}
        {activeTab === "kot" && <KOTView C={C} isMobile={isMobile} orders={orders} setOrders={setOrders} />}
{activeTab === "inventory" && <InventoryPanel C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} />}
        {activeTab === "stock" && <StockPanel C={C} isMobile={isMobile} menu={menu} />}
        {activeTab === "history" && <HistoryView C={C} isMobile={isMobile} isOwner={isOwner} />}
        {activeTab === "audit" && <AuditLogView C={C} isMobile={isMobile} />}
        {activeTab === "expenses" && <ExpensesView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} />}
        {activeTab === "reports" && <ReportsView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} />}
        {activeTab === "import" && <ImportView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} onDone={() => {}} />}
        {activeTab === "dashboard" && (
          <DashboardView C={C} isMobile={isMobile} orders={orders} dueOrders={dueOrders} menu={menu}
            onStatusClick={(status, bounds) => { setOrdersFilter(status); setOrdersRange(bounds || null); setActiveTab("orders"); }}
            onOrderClick={(order) => {
              if (order.orderType === "dine_in" && order.table) { setBillOrder(order); setSelectedTable(Number(order.table)); setCart({}); setAddMoreMode(false); }
              else { setBillOrder(order); setSelectedTable("parcel"); setCart({}); setAddMoreMode(false); }
            }} />
        )}
      </div>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", animation: "fadeIn 0.15s ease-out" }} onClick={() => setSidebarOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: isMobile ? "82%" : 280, maxWidth: isMobile ? 320 : undefined, background: C.card, height: "100%", padding: 20, display: "flex", flexDirection: "column", gap: 6, boxShadow: "4px 0 24px rgba(0,0,0,0.15)", overflowY: "auto", animation: "slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 44, height: 44, background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🍽️</div>
                <div><div style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>Eat & Park</div><div style={{ fontSize: 11, color: C.gray }}>Staff Panel</div></div>
              </div>
              <button onClick={() => setSidebarOpen(false)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: C.gray }}>X</button>
            </div>
            <div style={{ background: `linear-gradient(135deg, ${C.gold}22 0%, ${C.gold}08 100%)`, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>Logged in as</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, marginTop: 4 }}>{staffData?.name || "Staff"}</div>
              <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{staffData?.role || "waiter"}</div>
            </div>
            {[{ id: "parcel", label: "Parcel", icon: "🛍️" }, { id: "tables", label: "Tables", icon: "🍽️" }, { id: "orders", label: "Orders", icon: "📋" }, { id: "kot", label: "Kitchen", icon: "🍳" }, { id: "dashboard", label: "Dashboard", icon: "📊" }, { id: "history", label: "History", icon: "🕘" }, { id: "stock", label: "Stock", icon: "📦" }, { id: "inventory", label: "Saman", icon: "🧾" }, { id: "audit", label: "Audit Log", icon: "📝" }, { id: "expenses", label: "Kharcha", icon: "💸" }, { id: "reports", label: "Reports / P&L", icon: "📈" }, { id: "import", label: "Bulk Import", icon: "📥" }].map(tab => (
              <button key={tab.id} onClick={() => { haptic(); setActiveTab(tab.id); setSidebarOpen(false); setSelectedTable(null); setOrdersRange(null); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", border: "none", background: activeTab === tab.id ? C.goldLight : "transparent", color: activeTab === tab.id ? C.gold : C.ink, fontWeight: 700, fontSize: 14, borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
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

      {showEstimate && (
        <EstimatePanel
          C={C}
          menu={menu}
          isMobile={isMobile}
          onClose={() => setShowEstimate(false)}
          onMoveToCart={(est) => {
            setCart((prev) => {
              const next = { ...prev };
              est.forEach((e) => {
                next[e.id] = (Number(next[e.id]) || 0) + e.qty;
              });
              return next;
            });
            setShowEstimate(false);
            toast(`✅ ${est.length} items cart me chale gaye`, "success");
            if (!selectedTable) setActiveTab("tables");
          }}
        />
      )}
      {feedbackOrder && <FeedbackModal C={C} isMobile={isMobile} order={feedbackOrder} onClose={() => setFeedbackOrder(null)} />}
      {tableMerge && <TableMergeModal C={C} isMobile={isMobile} primaryOrder={tableMerge} allOrders={orders} onClose={() => setTableMerge(null)} />}
      {splitBillOrder && <SplitBillModal C={C} isMobile={isMobile} order={splitBillOrder} onClose={() => setSplitBillOrder(null)} />}
      {tableMove && <TableMoveModal C={C} isMobile={isMobile} order={tableMove} allOrders={orders} onClose={() => setTableMove(null)} />}
      <ConnectionBadge C={C} />

      {selectedTable && (
        <BillingView C={C} isMobile={isMobile} table={selectedTable} menu={menu} orders={orders} cart={cart} setCart={setCart} waiterName={waiterName} existingOrder={billOrder} isOwner={isOwner} addMoreMode={addMoreMode}
          onBack={() => { setSelectedTable(null); setCart({}); setBillOrder(null); setAddMoreMode(false); }}
          onSwitchAdd={() => { setCart({}); setAddMoreMode(true); }} onPaidSuccess={() => { haptic(60); setConfetti(true); setTimeout(() => setConfetti(false), 1800); }} />
      )}
    </div>
  );
}

// ===========================================================================
// TABLES VIEW
// ===========================================================================
// ===========================================================================
// PARCEL VIEW (chalu parcel orders ek jagah)
// ===========================================================================
function ParcelView({ C, isMobile, orders, onNew, onBill, onAdd }) {
  const [, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(iv); }, []);
  const list = orders.filter(isOpenParcel).sort((a, b) => b.createdAt - a.createdAt);
  const total = list.reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Parcel ({list.length})</h2>
          <div style={{ fontSize: 12, color: C.gray, fontWeight: 700, marginTop: 2 }}>Baaki payment: {inr(total)}</div>
        </div>
        <button onClick={onNew} style={{ padding: "11px 18px", border: "none", borderRadius: 10, background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ New Parcel</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {list.map(o => {
          const st = STATUS[o.status] || STATUS.new;
          const stColor = C[st.color] || C.gray;
          const stBg = C[st.color + "Light"] || C.light;
          const cname = o.customer?.name && o.customer.name !== "Walk-in" ? o.customer.name : "";
          const cphone = o.customer?.phone || "";
          return (
            <div key={o.id} style={{ background: C.card, border: `2px solid ${stColor}`, borderRadius: 12, padding: isMobile ? 12 : 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: C.ink }}>🛍️ #{o.id?.slice(1, 5).toUpperCase()}</div>
                <span style={{ background: stBg, color: stColor, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 11, color: C.gray, marginBottom: 8, fontWeight: 700 }}>
                {timeAgo(o.createdAt)} ago{cname ? " - " + cname : ""}{cphone ? " - " + cphone : ""}{o.waiter ? " - " + o.waiter : ""}
              </div>
              <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.6, marginBottom: 8 }}>
                {(o.items || []).map((it, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{it.qty}x {it.name}{it.portion ? ` (${it.portion})` : ""}</span>
                    <span style={{ color: C.gray, fontFamily: "monospace", flexShrink: 0 }}>{inr(it.price * it.qty)}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: C.gray, fontWeight: 600 }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: C.goldText, fontFamily: "monospace" }}>{inr(o.finalTotal || 0)}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <button onClick={() => onBill(o)} style={{ padding: 9, border: "none", borderRadius: 8, background: C.red, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Bill / Paid</button>
                <button onClick={() => onAdd(o)} style={{ padding: 9, border: "none", borderRadius: 8, background: C.green, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>+ Add Items</button>
                <button onClick={() => printKOT(o)} style={{ padding: 9, border: `1.5px solid ${C.blue}`, borderRadius: 8, background: "transparent", color: C.blue, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>KOT</button>
                <button onClick={() => whatsappBill(o)} style={{ padding: 9, border: `1.5px solid ${C.green}`, borderRadius: 8, background: "transparent", color: C.green, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>WhatsApp</button>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: C.gray }}><div style={{ fontSize: 48, marginBottom: 8 }}>🛍️</div><div style={{ fontSize: 14, fontWeight: 700 }}>Koi chalu parcel nahi</div></div>}
      </div>
    </div>
  );
}

function TablesView({ C, isMobile, orders, onTableClick, onEditBill, onAddMore, onMerge, onSplit, onMove, onFeedback, search, setSearch, todayRevenue, activeOrders }) {
  const [, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(iv); }, []);
  const tableData = useMemo(() => {
    const map = {};
    for (let i = 1; i <= TABLE_COUNT; i++) map[i] = { table: i, order: null };
    orders.filter(isOpenDineIn).forEach(o => {
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
                  <div style={{ fontSize: isMobile ? 10 : 11, color: (Date.now() - (t.order.createdAt || 0)) > 3600000 ? C.amber : C.gray, fontWeight: 700 }}>{(Date.now() - (t.order.createdAt || 0)) > 3600000 ? "⏱ " : ""}#{t.order.id?.slice(1,5).toUpperCase()} - {timeAgo(t.order.createdAt)}</div>
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
                <button onClick={() => onMove(t.order)} style={{ padding: isMobile ? "8px 4px" : "6px", border: `1.5px solid ${C.ink}`, borderRadius: 6, background: "transparent", color: C.ink, fontWeight: 800, fontSize: isMobile ? 10 : 11, cursor: "pointer", fontFamily: "inherit", gridColumn: "span 2" }}>Move Table</button>
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
      logAudit("paid", { orderId: order.id, total: order.finalTotal || 0, mode }); toast("Payment received!", "success");
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
            <button key={f} onClick={() => { haptic(); setFilter(f); }} style={{ padding: isMobile ? "6px 10px" : "7px 14px", borderRadius: 20, border: "1px solid " + (filter === f ? C.gold : C.line), background: filter === f ? C.gold : C.card, color: filter === f ? "#fff" : C.gray, fontWeight: 700, fontSize: isMobile ? 11 : 12, cursor: "pointer", textTransform: "capitalize", fontFamily: "inherit" }}>{f}</button>
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
              <span style={{ marginLeft: "auto", fontWeight: 900, color: C.goldText, fontFamily: "monospace", fontSize: 13, whiteSpace: "nowrap" }}>{inr(o.finalTotal || 0)}</span>
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
                <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 900, color: C.goldText, fontFamily: "monospace" }}>{inr(o.finalTotal || 0)}</span>
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
}

// ===========================================================================
// KITCHEN VIEW (with aging bar)
// ===========================================================================
function KOTView({ C, isMobile, orders, setOrders }) {
  const toast = useToast();
  const haptic = useHaptic();
  const [, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(x => x + 1), 15000); return () => clearInterval(iv); }, []);
  const kotOrders = orders.filter(o => (o.status === "new" || o.status === "preparing") && Date.now() - (o.createdAt || 0) < 18 * 3600 * 1000);
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
function DashboardView({ C, isMobile, orders, dueOrders, menu, onStatusClick, onOrderClick }) {
  const todayStr = invDateKey();
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
  const todayTotal = filtered.filter(o => o.status !== "cancelled").length;
  const paidCount = filtered.filter(o => o.paid && o.status !== "cancelled").length;
  const activeOrders = filtered.filter(o => o.status !== "served" && o.status !== "cancelled").length;
  const avgOrder = paidCount ? Math.round(todayRevenue / paidCount) : 0;
  const statusCounts = { new: 0, preparing: 0, ready: 0, served: 0 };
  filtered.forEach(o => { if (statusCounts[o.status] !== undefined) statusCounts[o.status]++; });
  const recentOrders = [...filtered].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
  const hourCounts = Array.from({ length: 24 }, () => 0);
  filtered.forEach(o => { hourCounts[new Date(o.createdAt).getHours()]++; });
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
          <button key={r.id} onClick={() => { haptic(); setRange(r.id); }} style={{ padding: isMobile ? "6px 10px" : "7px 14px", borderRadius: 20, border: `1px solid ${range === r.id ? C.gold : C.line}`, background: range === r.id ? C.gold : C.card, color: range === r.id ? "#fff" : C.gray, fontWeight: 700, fontSize: isMobile ? 11 : 12, cursor: "pointer", fontFamily: "inherit" }}>{r.label}</button>
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
            const count = hourCounts[h];
            const maxCount = Math.max(1, ...hourCounts);
            const height = (count / maxCount) * 100;
            return (
              <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", height: 100, display: "flex", alignItems: "flex-end" }}>
                  <div title={`${h}:00 - ${count}`} style={{ width: "100%", height: `${height}%`, minHeight: count > 0 ? 4 : 0, background: `linear-gradient(180deg, ${C.gold} 0%, ${C.goldDark} 100%)`, borderRadius: 3, transition: "all 0.4s" }} />
                </div>
                {h % 4 === 0 && <div style={{ fontSize: 9, color: C.gray, fontWeight: 700 }}>{h}</div>}
              </div>
            );
          })}
        </div>
      </div>
      <ReportsExtra C={C} isMobile={isMobile} orders={filtered} rangeLabel={rangeLabel} />
      <DueLedger C={C} isMobile={isMobile} orders={dueOrders || orders} />
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
                  <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 900, color: C.goldText, fontFamily: "monospace" }}>{inr(o.finalTotal || 0)}</div>
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
    const cleanup = () => { setTimeout(() => { try { if (iframe.parentNode) document.body.removeChild(iframe); } catch (e) {} }, 5000); };
    try { w.addEventListener("afterprint", cleanup); } catch (e) {}
    setTimeout(cleanup, 90000);
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
    const cleanup = () => { setTimeout(() => { try { if (iframe.parentNode) document.body.removeChild(iframe); } catch (e) {} }, 5000); };
    try { w.addEventListener("afterprint", cleanup); } catch (e) {}
    setTimeout(cleanup, 90000);
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
    const showQr = false; // QR disabled as requested
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
  if (!order || !Array.isArray(order.items) || order.items.length === 0) { alert("Bill me item nahi hai"); return; }
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
  const aTotal = Math.round((Number(order.finalTotal) || fullSub) * (a.reduce((s, it) => s + it.price * it.qty, 0) / fullSub));
  const bTotal = (Number(order.finalTotal) || fullSub) - aTotal;
  const make = (list, targetTotal) => {
    const sub = list.reduce((s, it) => s + it.price * it.qty, 0);
    const r = sub / fullSub;
    return { ...order, items: list, subtotal: sub, deliveryFee: 0, gstAmount: Math.round((order.gstAmount || 0) * r), billDiscount: Math.round((order.billDiscount || 0) * r), finalTotal: targetTotal };
  };
  if (a.length) printBill(make(a, aTotal));
  if (b.length) setTimeout(() => printBill(make(b, bTotal)), 3500);
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
  const [busy, setBusy] = useState(false);
  const otherOrders = allOrders.filter(o => o.id !== primaryOrder.id && isOpenDineIn(o));
  const merge = async () => {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      const other = allOrders.find(o => o.id === selectedId);
      if (!other) { setBusy(false); return; }
      const mb = writeBatch(db);
      mb.update(doc(db, "orders", primaryOrder.id), {
        items: [...(primaryOrder.items || []), ...(other.items || [])],
        kots: [...(primaryOrder.kots || []), ...(other.kots || [])],
        subtotal: (Number(primaryOrder.subtotal) || 0) + (Number(other.subtotal) || 0),
        finalTotal: (Number(primaryOrder.finalTotal) || 0) + (Number(other.finalTotal) || 0),
        mergedFrom: [...(primaryOrder.mergedFrom || []), other.table],
      });
      mb.update(doc(db, "orders", other.id), { status: "cancelled", cancelledAt: Date.now(), cancelledReason: "Merged into " + primaryOrder.table });
      await mb.commit();
      logAudit("tables_merged", { orderId: primaryOrder.id, table: primaryOrder.table, merged: other.table, total: primaryOrder.finalTotal || 0 }); toast("Merged successfully", "success");
      onClose();
    } catch (e) { toast(e.message, "error"); setBusy(false); }
  };
  return (
    <ModalShell C={C} open onClose={onClose} isMobile={isMobile} title="Merge Table" icon="🔗">
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Is order (Table {primaryOrder.table}) me dusra table merge karo</div>
      {otherOrders.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.gray }}>Koi aur running order nahi</div>}
      {otherOrders.map(o => (
        <button key={o.id} onClick={() => setSelectedId(o.id)} style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: 12, marginBottom: 8, border: `2px solid ${selectedId === o.id ? C.gold : C.line}`, borderRadius: 8, background: selectedId === o.id ? C.redLight : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ fontWeight: 700, color: C.ink }}>Table {o.table}</span>
          <span style={{ color: C.gray }}>{inr(o.finalTotal || 0)}</span>
        </button>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
        <button onClick={merge} disabled={!selectedId || busy} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: !selectedId || busy ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{busy ? <Spinner /> : "Merge"}</button>
      </div>
    </ModalShell>
  );
}

function TableMoveModal({ C, isMobile, order, allOrders, onClose }) {
  const toast = useToast();
  const [to, setTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const occupied = new Set(allOrders.filter(isOpenDineIn).map(o => Number(o.table)));
  const free = Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).filter(n => !occupied.has(n));
  const move = async () => {
    if (!to || busy) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "orders", order.id), { table: to, movedFrom: order.table, movedAt: Date.now() });
      logAudit("table_moved", { orderId: order.id, from: order.table, to });
      toast(`Table ${order.table} → ${to}`, "success");
      onClose();
    } catch (e) { toast(e.message, "error"); setBusy(false); }
  };
  return (
    <ModalShell C={C} open onClose={onClose} isMobile={isMobile} title="Move Table" icon="🔀" maxWidth={380}>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>Table {order.table} ka order kis khali table par bhejna hai?</div>
      {free.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.gray }}>Koi table khali nahi</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {free.map(n => (
          <button key={n} onClick={() => setTo(n)} style={{ padding: "14px 0", borderRadius: 10, border: `2px solid ${to === n ? C.gold : C.line}`, background: to === n ? C.redLight : "transparent", color: to === n ? C.gold : C.ink, fontWeight: 900, fontSize: 16, cursor: "pointer", fontFamily: "monospace" }}>{n}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
        <button onClick={move} disabled={!to || busy} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: !to || busy ? "not-allowed" : "pointer" }}>{busy ? <Spinner /> : "Move"}</button>
      </div>
    </ModalShell>
  );
}

function SplitBillModal({ C, isMobile, order, onClose }) {
  const toast = useToast();
  const items = order.items || [];
  const [split1, setSplit1] = useState({});
  const toggleItem = (idx) => setSplit1(prev => ({ ...prev, [idx]: !prev[idx] }));
  const rawSub1 = items.reduce((s, it, i) => s + (split1[i] ? it.price * it.qty : 0), 0);
  const rawFull = items.reduce((s, it) => s + it.price * it.qty, 0) || 1;
  const grand = Number(order.finalTotal) || rawFull;
  const total1 = Math.round(grand * rawSub1 / rawFull);
  const total2 = grand - total1;
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
          const sel = Object.values(split1).filter(Boolean).length;
          if (sel === 0) { toast("Kam se kam 1 item tick karo", "warning"); return; }
          if (sel === items.length) { toast("Dono taraf item chahiye (kuch untick karo)", "warning"); return; }
          printSplitBills(order, split1); onClose();
        }} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.blue, color: "#fff", fontWeight: 800, cursor: "pointer" }}>Print Both</button>
      </div>
    </ModalShell>
  );
}

// ===========================================================================
// BILLING VIEW (with debounce + autosave + sticky bar + confetti)
// ===========================================================================
function BillingView({ C, isMobile, table, menu, orders, cart, setCart, waiterName, existingOrder, addMoreMode, onBack, isOwner, onPaidSuccess, onSwitchAdd }) {
  const toast = useToast();
  const haptic = useHaptic();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 150);
  const [category, setCategory] = useState("All");
  const [showFav, setShowFav] = useState(() => { try { return localStorage.getItem("staff_fav_open") === "1"; } catch (e) { return false; } });
  const [pinnedIds, setPinnedIds] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "favourites"), (s) => setPinnedIds(s.exists() && Array.isArray(s.data().ids) ? s.data().ids : []), () => {});
    return () => unsub();
  }, []);
  const togglePin = async (id) => {
    if (!isOwner) { toast("Favourite sirf owner pin kar sakta hai", "warning"); return; }
    const prev = pinnedIds;
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    haptic(8);
    setPinnedIds(next);
    try { await setDoc(doc(db, "settings", "favourites"), { ids: next, updatedAt: Date.now() }); }
    catch (e) { setPinnedIds(prev); toast(e.message, "error"); }
  };
  const [placing, setPlacing] = useState(false);
  const [runningOrders, setRunningOrders] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [gstRate, setGstRate] = useState(0);
  const [payMode, setPayMode] = useState("cash");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCat, setNewCat] = useState("");
  const [savingMenu, setSavingMenu] = useState(false);
  const saveMenuItem = async () => {
    const name = newName.trim();
    const price = Number(newPrice);
    const cat = newCat.trim();
    if (!name) { toast("Item ka naam likho", "warning"); return; }
    if (!(price > 0)) { toast("Sahi rate likho", "warning"); return; }
    if (!cat) { toast("Category chuno ya likho", "warning"); return; }
    if (menu.some((m) => String(m.name || "").trim().toLowerCase() === name.toLowerCase() && m.category === cat)) { toast("Ye item is category me pehle se hai", "warning"); return; }
    setSavingMenu(true);
    try {
      const item = { id: uid("m"), name, price, category: cat, available: true, portion: "" };
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "settings", "menu");
        const snap = await tx.get(ref);
        const items = snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
        if (snap.exists()) tx.update(ref, { items: [...items, item] });
        else tx.set(ref, { items: [item] });
      });
      logAudit("menu_item_added", { name, price, category: cat });
      toast("Menu me jud gaya: " + name, "success");
      setNewName(""); setNewPrice(""); setNewCat("");
      setAddMenuOpen(false);
    } catch (e) { toast(e.message, "error"); } finally { setSavingMenu(false); }
  };
  const [cancelOpen, setCancelOpen] = useState(false);
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
  };
  const [showAdj, setShowAdj] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const handlePrintBill = async () => {
    if (!existingOrder || placing) return;
    if (existingOrder.paid) { printBill(existingOrder); return; }
    setPlacing(true);
    try {
      const applied = await applyCartChanges();
      printBill({ ...existingOrder, items: applied.finalItems, finalTotal: applied.finalTotal, subtotal: applied.sub, gstAmount: applied.gstAmt, billDiscount: applied.discAmt, payment: payMode, paid: false });
      toast("Bill saved & printing", "success");
      onBack();
    } catch (e) { toast(e.message, "error"); } finally { setPlacing(false); }
  };
  const cancelOrder = async () => {
    if (!existingOrder || placing) return;
    setPlacing(true);
    try {
      await updateDoc(doc(db, "orders", existingOrder.id), { status: "cancelled", cancelledAt: Date.now(), cancelledBy: "staff", cancelledReason: cancelReason || "" });
      logAudit("cancel_order", { orderId: existingOrder.id, table: existingOrder.table || "", total: existingOrder.finalTotal || 0, reason: cancelReason || "" });
      toast("Order cancelled", "success");
      setCancelOpen(false);
      onBack();
    } catch (e) { toast(e.message, "error"); } finally { setPlacing(false); }
  };
  const lockRef = useRef(false);

  // existingOrder ka signature - items/kots/total badalne par cart re-seed ho
  const orderSig = existingOrder
    ? existingOrder.id + "|" + (existingOrder.items || []).length + "|" + (existingOrder.kots || []).length + "|" + (existingOrder.finalTotal || 0)
    : "none";
  const lastSeededSigRef = useRef(null);
  useEffect(() => {
    if (!existingOrder) { lastSeededSigRef.current = null; return; }
    setDiscount(existingOrder.billDiscountPct || 0);
    setGstRate(existingOrder.gstRate || 0);
    if (addMoreMode) {
      setCart({});
      return;
    }
    setPayMode(existingOrder.payment || "cash");
    if (lastSeededSigRef.current === orderSig) return;
    lastSeededSigRef.current = orderSig;
    const initialCart = {};
    (existingOrder.items || []).forEach(it => { initialCart[it.itemId] = (initialCart[it.itemId] || 0) + it.qty; });
    setCart(initialCart);
  }, [existingOrder?.id, orderSig, addMoreMode]);

  // Autosave cart to localStorage
  useEffect(() => {
    if (!existingOrder && !addMoreMode && Object.keys(cart).length > 0) {
      try { localStorage.setItem(`staff_draft_${table}`, JSON.stringify(cart)); } catch (e) {}
    }
  }, [cart, table, existingOrder, addMoreMode]);

  // Restore draft on open (only if new order) - runs once per table open
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (draftRestoredRef.current) return;
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
    draftRestoredRef.current = true;
  }, [existingOrder, addMoreMode, table]);

  const existingItems = existingOrder?.items || [];
  const existingSubtotal = existingItems.reduce((s, it) => s + (it.price * it.qty), 0);

  const favItems = useMemo(() => {
    const cnt = {};
    orders.forEach((o) => { if (o.status === "cancelled") return; (o.items || []).forEach((it) => { cnt[it.itemId] = (cnt[it.itemId] || 0) + (Number(it.qty) || 0); }); });
    const seenFav = new Set();
    return menu.filter((m) => m.available && (cnt[m.id] || pinnedIds.includes(m.id))).sort((a, b) => { const pa = pinnedIds.indexOf(a.id), pb = pinnedIds.indexOf(b.id); if (pa >= 0 || pb >= 0) return pa < 0 ? 1 : pb < 0 ? -1 : pa - pb; return cnt[b.id] - cnt[a.id]; }).filter((m) => { const k = String(m.name || "").trim().toLowerCase(); if (seenFav.has(k)) return false; seenFav.add(k); return true; }).slice(0, 12 + pinnedIds.length);
  }, [orders, menu, pinnedIds]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(menu.map(m => m.category)))], [menu]);
  const filtered = useMemo(() => menu.filter(m => m.available && (category === "All" || m.category === category) && (!debouncedSearch.trim() || (m.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || String(m.category || "").toLowerCase().includes(debouncedSearch.toLowerCase())))), [menu, category, debouncedSearch]);

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const resolveItem = (id) => { const m = menu.find(x => x.id === id); const ex = existingItems.find(e => e.itemId === id); if (ex && !addMoreMode) return ex; return m || ex || null; };
  // NOTE: cart me sirf CURRENT edit ki qty hoti hai (addMoreMode me sirf naye items).
  // Isliye subtotal = sum(cart qty x price). Purani qty yahan add NAHI karni.
  const cartSubtotal = cartItems.reduce((s, [id, q]) => { 
    const m = resolveItem(id); 
    return s + (rates[id] ?? m?.price ?? 0) * q; 
  }, 0);
  const grossSub = cartSubtotal;
  const discAmt = Math.round(grossSub * discount / 100);
  const gstAmt = Math.round((grossSub - discAmt) * gstRate / 100);
  const totalAmount = Math.max(0, grossSub - discAmt) + gstAmt;

  useEffect(() => {
    const running = orders.filter(o => Number(o.table) === Number(table) && isOpenDineIn(o));
    setRunningOrders(running);
  }, [orders, table]);

  const setQty = (id, q) => {
    haptic(5);
    setCart(prev => { const next = { ...prev }; if (q <= 0) delete next[id]; else next[id] = q; return next; });
  };

  const applyCartChanges = async () => {
    if (!existingOrder) throw new Error("No existing order to update");
    const existing = existingOrder.items || [];
    const oldQty = {}, oldFirst = {};
    existing.forEach(it => {
      oldQty[it.itemId] = (oldQty[it.itemId] || 0) + it.qty;
      if (!oldFirst[it.itemId]) oldFirst[it.itemId] = it;
    });
    const nextKotNo = Math.max(1, ...(existingOrder.kots || []).map(k => k.kotNumber || 1)) + 1;

    const finalItems = [];
    const newKotItems = [];
    Object.entries(cart).forEach(([id, qty]) => {
      const q = Number(qty) || 0;
      if (q <= 0) return;
      const m = menu.find(x => x.id === id);
      const ex = oldFirst[id];
      const price = rates[id] ?? ex?.price ?? m?.price ?? 0;
      const name = ex?.name ?? m?.name ?? "Item";
      const portion = ex?.portion ?? m?.portion ?? "";
      const prev = oldQty[id] || 0;
      finalItems.push({ itemId: id, name, portion, price, qty: q, kotNumber: ex?.kotNumber || nextKotNo });
      if (q > prev) newKotItems.push({ itemId: id, name, portion, price, qty: q - prev, kotNumber: nextKotNo });
    });
    if (finalItems.length === 0) throw new Error("Bill me kam se kam 1 item hona chahiye");

    const removedItems = Object.keys(oldQty)
      .filter(id => (Number(cart[id]) || 0) < oldQty[id])
      .map(id => ({ ...oldFirst[id], qty: oldQty[id] - (Number(cart[id]) || 0) }));

    const sub = finalItems.reduce((s, it) => s + it.price * it.qty, 0);
    const d = Math.round((sub * discount) / 100);
    const g = Math.round(((sub - d) * gstRate) / 100);
    const finalTotal = Math.max(0, sub - d) + g;

    if (removedItems.length) logAudit("items_removed", { orderId: existingOrder.id, table: existingOrder.table || "", items: removedItems.map(i => i.qty + "x " + i.name).join(", ") });

    const extra = {};
    if (newKotItems.length || removedItems.length) {
      const baseKots = existingOrder.kots?.length ? existingOrder.kots : [{ id: uid("kot"), kotNumber: 1, items: existing, createdAt: existingOrder.createdAt, status: existingOrder.status }];
      const editKot = { id: uid("kot"), kotNumber: nextKotNo, items: newKotItems, removedItems, createdAt: Date.now(), status: "new", isRunning: true, isEdit: true };
      extra.kots = [...baseKots, editKot];
      if (newKotItems.length) { extra.status = "new"; extra.lastKotAt = Date.now(); }
    }
    await runTransaction(db, async (tx) => {
      const oref = doc(db, "orders", existingOrder.id);
      const osnap = await tx.get(oref);
      assertEditable(osnap.exists() ? osnap.data() : null);
      tx.update(oref, { items: finalItems, subtotal: sub, billDiscountPct: discount, billDiscount: d, gstRate, gstAmount: g, finalTotal, payment: payMode, billEditedAt: Date.now(), ...extra });
    });
    if (newKotItems.length) printKOT({ ...existingOrder, items: newKotItems, kots: [] });
    return { finalItems, sub, discAmt: d, gstAmt: g, finalTotal };
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 || lockRef.current) return;
    if (!existingOrder && !addMoreMode && table !== "parcel") {
      const busy = orders.some(o => isOpenDineIn(o) && Number(o.table) === Number(table));
      if (busy && !window.confirm("Table " + table + " par order chalu hai. Phir bhi naya banayein?")) return;
    }
    lockRef.current = true;
    if (existingOrder && addMoreMode) {
      setPlacing(true);
      try {
        const base = existingOrder;
        const baseKots = base.kots?.length ? base.kots : [{ id: uid("kot"), kotNumber: 1, items: base.items || [], createdAt: base.createdAt, status: base.status }];
        const nextNo = Math.max(1, ...baseKots.map(k => k.kotNumber || 1)) + 1;
        const newItems = cartItems.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: rates[id] ?? m.price, qty, kotNumber: nextNo }; });
        const addedTotal = newItems.reduce((s, it) => s + it.price * it.qty, 0);
        const runKot = { id: uid("kot"), kotNumber: nextNo, items: newItems, createdAt: Date.now(), status: "new", isRunning: true };
        await runTransaction(db, async (tx) => {
          const oref = doc(db, "orders", base.id);
          const osnap = await tx.get(oref);
          if (!osnap.exists()) throw new Error("Order ab maujood nahi hai");
          const live = osnap.data();
          if (live.paid) throw new Error("Order paid ho chuka hai - items add nahi ho sakte");
          if (live.status === "cancelled") throw new Error("Order cancelled hai");
          const liveKots = live.kots && live.kots.length ? live.kots : baseKots;
          const mergedItems = [...(live.items || [])].map(it => ({ ...it }));
          newItems.forEach(newItem => {
            const existing = mergedItems.find(i => i.itemId === newItem.itemId);
            if (existing) existing.qty += newItem.qty;
            else mergedItems.push(newItem);
          });
          tx.update(oref, {
            kots: [...liveKots, runKot],
            items: mergedItems,
            status: "new",
            finalTotal: (Number(live.finalTotal) || 0) + addedTotal,
            subtotal: (Number(live.subtotal) || 0) + addedTotal,
            paid: false,
            paymentStatus: "pending",
            lastKotAt: Date.now(),
          });
        });
        printKOT({ ...base, items: newItems, kots: [runKot] });
        haptic(30);
        toast(`KOT #${nextNo} added & printing`, "success");
        setCart({});
        onBack();
      } catch (e) {
        if (e.message === "REFRESH_NEEDED" || e.message.includes("badal diya")) {
          toast("Order update ho gaya tha, please wapas table par click karein.", "warning");
          onBack();
        } else {
          toast(e.message, "error");
        }
      } finally { lockRef.current = false; setPlacing(false); }
      return;
    }
    setPlacing(true);
    try {
      const items = cartItems.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: rates[id] ?? m.price, qty, kotNumber: 1 }; });
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
    } catch (e) {
        if (e.message === "REFRESH_NEEDED" || e.message.includes("badal diya")) {
          toast("Order update ho gaya tha, please wapas table par click karein.", "warning");
          onBack();
        } else {
          toast(e.message, "error");
        }
      } finally { lockRef.current = false; setPlacing(false); }
  };

  const handleSaveBill = async () => {
    if (existingOrder && existingOrder.paid) { toast("Order paid ho chuka hai - edit nahi ho sakta", "warning"); return; }
    if (!existingOrder || addMoreMode || placing) return;
    setPlacing(true);
    try { await applyCartChanges(); toast("Bill saved", "success"); onBack(); }
    catch (e) { toast(e.message, "error"); } finally { setPlacing(false); }
  };

  const handlePaidPrint = async () => {
    if (existingOrder && !addMoreMode && !placing) { if (lockRef.current) return; lockRef.current = true; }
    if (!existingOrder || addMoreMode || placing) return;
    setPlacing(true);
    try {
      if (payMode === "due") {
        if (cartItems.length === 0) { toast("Bill me kam se kam 1 item hona chahiye", "warning"); setPlacing(false); return; }
        const dn = window.prompt("Customer ka naam (due)?", "");
        if (dn === null) { setPlacing(false); return; }
        if (!dn.trim()) { toast("Due ke liye naam likhna zaroori hai", "warning"); setPlacing(false); return; }
        const dp = (window.prompt("Phone number? (10 digit)", "") || "").replace(/\D/g, "");
        if (dp.length < 10) { toast("Sahi 10 digit phone zaroori hai", "warning"); setPlacing(false); return; }
        const applied = await applyCartChanges();
        await updateDoc(doc(db, "orders", existingOrder.id), { payment: "due", paid: false, paymentStatus: "due", status: "served", dueName: dn || "Unknown", duePhone: dp, dueAt: Date.now() });
        logAudit("due_created", { orderId: existingOrder.id, total: applied.finalTotal, name: dn || "" });
        printBill({ ...existingOrder, items: applied.finalItems, finalTotal: applied.finalTotal, subtotal: applied.sub, gstAmount: applied.gstAmt, billDiscount: applied.discAmt, payment: "due", paid: false });
        toast("Due me save ho gaya", "success");
        onBack();
        return;
      }
      const applied = await applyCartChanges();
      const paidPatch = { paid: true, paymentStatus: "paid", paidAt: Date.now(), paidBy: waiterName || "Staff", payment: payMode };
      if (existingOrder.orderType === "parcel") paidPatch.status = "served";
      await updateDoc(doc(db, "orders", existingOrder.id), paidPatch);
      printBill({ ...existingOrder, items: applied.finalItems, finalTotal: applied.finalTotal, subtotal: applied.sub, gstAmount: applied.gstAmt, billDiscount: applied.discAmt, payment: payMode, paid: true });
      haptic(80);
      logAudit("paid", { orderId: existingOrder.id, total: applied.finalTotal, mode: payMode }); toast("Payment received! Bill printing", "success");
      if (onPaidSuccess) onPaidSuccess();
      onBack();
    } catch (e) {
        if (e.message === "REFRESH_NEEDED" || e.message.includes("badal diya")) {
          toast("Order update ho gaya tha, please wapas table par click karein.", "warning");
          onBack();
        } else {
          toast(e.message, "error");
        }
      } finally { lockRef.current = false; setPlacing(false); }
  };

  const addRunningItems = async (orderId) => {
    if (cartItems.length === 0 || placing) return;
    setPlacing(true);
    try {
      const baseOrder = orders.find(o => o.id === orderId);
      if (!baseOrder) return;
      const baseKots = baseOrder.kots?.length ? baseOrder.kots : [{ id: uid("kot"), kotNumber: 1, items: baseOrder.items || [], createdAt: baseOrder.createdAt, status: baseOrder.status }];
      const nextNo = Math.max(1, ...baseKots.map(k => k.kotNumber || 1)) + 1;
      const newItems = cartItems.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: rates[id] ?? m.price, qty, kotNumber: nextNo }; });
      const addedTotal = newItems.reduce((s, it) => s + it.price * it.qty, 0);
      const runKot = { id: uid("kot"), kotNumber: nextNo, items: newItems, createdAt: Date.now(), status: "new", isRunning: true };
      await runTransaction(db, async (tx) => { // live-total txn (running)
        const oref = doc(db, "orders", orderId);
        const osnap = await tx.get(oref);
        if (!osnap.exists()) throw new Error("Order ab maujood nahi hai");
        const live = osnap.data();
        if (live.paid) throw new Error("Order paid ho chuka hai - items add nahi ho sakte");
        if (live.status === "cancelled") throw new Error("Order cancelled hai");
        const liveKots = live.kots && live.kots.length ? live.kots : baseKots;
        tx.update(oref, { kots: [...liveKots, runKot], items: (() => {
              const merged = [...(live.items || [])];
              newItems.forEach(newItem => {
                const existing = merged.find(i => i.itemId === newItem.itemId);
                if (existing) existing.qty += newItem.qty;
                else merged.push(newItem);
              });
              return merged;
            })(), status: "new", finalTotal: (Number(live.finalTotal) || 0) + addedTotal, subtotal: (Number(live.subtotal) || 0) + addedTotal, paid: false, paymentStatus: "pending", lastKotAt: Date.now() });
      });
      printKOT({ ...baseOrder, items: newItems, kots: [runKot] });
      toast(`KOT #${nextNo} added`, "success");
      onBack();
    } catch (e) {
        if (e.message === "REFRESH_NEEDED" || e.message.includes("badal diya")) {
          toast("Order update ho gaya tha, please wapas table par click karein.", "warning");
          onBack();
        } else {
          toast(e.message, "error");
        }
      } finally { lockRef.current = false; setPlacing(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 100, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s" }}>
      <div style={{ background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, color: "#fff", padding: isMobile ? "10px 12px" : "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", padding: isMobile ? "8px 12px" : "9px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: isMobile ? 12 : 13, flexShrink: 0 }}>← Back</button>
        <div style={{ fontWeight: 800, fontSize: isMobile ? 13 : 16, textAlign: "center", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {existingOrder ? (addMoreMode ? `Add - ${table === "parcel" ? "Parcel" : "T" + table}` : `Bill - ${table === "parcel" ? "Parcel" : "T" + table} - ${existingItems.length} items`) : (table === "parcel" ? "New - Parcel" : `New - Table ${table}`)}
        </div>
        <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: 20, padding: "6px 12px", fontWeight: 900, fontSize: isMobile ? 12 : 14, fontFamily: "monospace", flexShrink: 0, minWidth: isMobile ? 40 : 60, textAlign: "center" }}>{cartItems.length > 0 ? inr(addMoreMode ? grossSub : totalAmount) : "—"}</div>
      </div>

      {runningOrders.length > 0 && !existingOrder && (
        <div style={{ background: C.amberLight, padding: "8px 12px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: isMobile ? 11 : 13, color: C.ink, fontWeight: 700, flex: 1, minWidth: 120 }}>Table {table} has {runningOrders.length} running order(s)</div>
          <button onClick={() => addRunningItems(runningOrders[0].id)} disabled={cartItems.length === 0} style={{ background: cartItems.length === 0 ? C.line : C.blue, color: "#fff", border: "none", padding: "7px 12px", borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: cartItems.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0 }}>Add to Running</button>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, overflow: isMobile ? "auto" : "hidden", padding: isMobile ? 8 : 12, paddingBottom: isMobile ? 80 : 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", height: isMobile ? "44vh" : undefined, flex: isMobile ? undefined : 1, flexShrink: 0, minWidth: 0 }}>
          {favItems.length > 0 && !search.trim() && (
            <button onClick={() => { haptic(); setShowFav((v) => { const n = !v; try { localStorage.setItem("staff_fav_open", n ? "1" : "0"); } catch (e) {} return n; }); }} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, border: "1px solid " + C.gold, background: showFav ? C.gold : C.card, color: showFav ? "#fff" : C.goldText, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>⭐ Favourites ({favItems.length}) {showFav ? "▲" : "▼"}</button>
          )}
          {showFav && favItems.length > 0 && !search.trim() && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 8, maxHeight: 150, overflowY: "auto", background: C.goldLight, border: "1px solid " + C.line, borderRadius: 12, flexShrink: 0 }}>
              {favItems.map((m) => (
                <button key={"fav" + m.id} onClick={() => setQty(m.id, (cart[m.id] || 0) + 1)} style={{ padding: "7px 12px", borderRadius: 20, border: "1px solid " + (C.gold || C.red), background: cart[m.id] ? (C.gold || C.red) : C.card, color: cart[m.id] ? "#fff" : C.ink, fontWeight: 800, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0 }}>{pinnedIds.includes(m.id) ? "📌" : "⭐"} {m.name}{cart[m.id] ? " ×" + cart[m.id] : ""}</button>
              ))}
            </div>
          )}
          <div style={{ position: "relative", flexShrink: 0 }}><input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "10px 38px 10px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, outline: "none", background: C.card, color: C.ink }} />{search && <button aria-label="Search clear" onClick={() => setSearch("")} style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, border: "none", borderRadius: 14, background: C.cardAlt, color: C.gray, fontSize: 13, fontWeight: 800, cursor: "pointer", padding: 0 }}>✕</button>}</div>
          <div className="ep-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, flexShrink: 0 }}>
            {categories.map(c => (
              <button key={c} onClick={() => { haptic(); setCategory(c); }} style={{ padding: "8px 16px", borderRadius: 999, boxShadow: category === c ? "0 3px 10px rgba(184,134,11,0.30)" : "none", border: `1px solid ${category === c ? C.gold : C.line}`, background: category === c ? C.gold : C.card, color: category === c ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0 }}>{c}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(170px, 1fr))", gap: 10, overflowY: "auto", flex: 1, alignContent: "start", paddingBottom: 4, paddingRight: 2 }}>
            {filtered.map(m => {
              const q = cart[m.id] || 0;
              return (
                <button key={m.id} onClick={() => setQty(m.id, q + 1)} className="ep-card" style={{ textAlign: "left", padding: isMobile ? 10 : 12, borderRadius: 12, border: `1.5px solid ${q > 0 ? C.green : C.line}`, background: q > 0 ? C.greenLight : C.card, boxShadow: q > 0 ? "0 2px 10px rgba(22,163,74,0.15)" : "0 1px 3px rgba(0,0,0,0.05)", cursor: "pointer", position: "relative", fontFamily: "inherit", minHeight: isMobile ? 70 : 78, color: C.ink, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 4 }}>
                  <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: C.ink, marginBottom: 4, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", paddingRight: 24 }}>{m.name}</div>
                  {isOwner && <span role="button" title="Favourite pin" onClick={(e) => { e.stopPropagation(); togglePin(m.id); }} style={{ position: "absolute", bottom: 4, right: 6, fontSize: 16, lineHeight: 1, padding: 4, cursor: "pointer", opacity: pinnedIds.includes(m.id) ? 1 : 0.35 }}>{pinnedIds.includes(m.id) ? "⭐" : "☆"}</span>}
                  <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 900, color: C.goldText, fontFamily: "monospace" }}>{inr(m.price)}</div>
                  {q > 0 && <span style={{ position: "absolute", top: 6, right: 6, background: C.green, color: "#fff", borderRadius: 12, padding: "2px 9px", fontSize: 11, fontWeight: 800, boxShadow: "0 2px 6px rgba(22,163,74,0.35)", animation: "successBounce 0.3s" }}>{q}</span>}
                </button>
              );
            })}
            {filtered.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: C.gray }}><div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div><div style={{ fontSize: 13, fontWeight: 700 }}>{menu.length === 0 ? "Menu load ho raha hai..." : "Koi matching item nahi"}</div></div>}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, boxShadow: "0 6px 24px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0, width: isMobile ? "100%" : 400, minHeight: isMobile ? 400 : undefined }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.line}`, background: C.cardAlt, fontWeight: 800, fontSize: isMobile ? 13 : 15, color: C.ink, letterSpacing: 0.2 }}>{(existingOrder ? "Bill" : "New Order") + " - " + (table === "parcel" ? "Parcel" : "Table " + table) + " (" + cartItems.length + ")"}{isOwner && <button onClick={() => setAddMenuOpen(true)} style={{ float: "right", margin: "-3px 0", padding: "5px 12px", border: "none", borderRadius: 6, background: C.green, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>+ Menu</button>}{!existingOrder && cartItems.length > 0 && <button onClick={() => { if (window.confirm("Poora cart khaali karein?")) { setCart({}); try { localStorage.removeItem("staff_draft_" + table); } catch (e) {} } }} style={{ float: "right", margin: "-3px 8px -3px 0", padding: "5px 12px", border: "1.5px solid " + C.red, borderRadius: 6, background: "transparent", color: C.red, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Clear</button>}</div>
          <div style={{ flex: isMobile ? "none" : 1, overflowY: isMobile ? "visible" : "auto", minHeight: isMobile ? 0 : 140 }}>
            {cartItems.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: C.gray, fontSize: 13, fontWeight: 700 }}><div style={{ fontSize: 40, marginBottom: 8, opacity: 0.5 }}>🧾</div>Menu se item tap karo</div>}
            {cartItems.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: C.cardAlt, borderBottom: "1px solid " + C.line, fontSize: 10, fontWeight: 800, color: C.gray, letterSpacing: 0.5, textTransform: "uppercase" }}>
                <div style={{ flex: 1 }}>Item</div>
                <div style={{ width: 84, textAlign: "center" }}>Qty</div>
                <div style={{ width: 64, textAlign: "right" }}>Amount</div>
                <div style={{ width: 16 }} />
              </div>
            )}
            {cartItems.map(([id, q]) => {
              const m = resolveItem(id);
              if (!m) return null;
              const existingQty = existingItems.filter(e => e.itemId === id).reduce((s, e) => s + e.qty, 0);
              const isNew = !!existingOrder && !addMoreMode && existingQty === 0;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "1px dashed " + C.line, background: isNew ? C.greenLight : "transparent" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, lineHeight: 1.25 }}>
                      {m.name}{m.portion ? " (" + m.portion + ")" : ""}
                      {isNew && <span style={{ marginLeft: 6, background: C.green, color: "#fff", fontSize: 8, padding: "1px 5px", borderRadius: 3, fontWeight: 800, verticalAlign: "middle" }}>NEW</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 2, fontFamily: "monospace", cursor: "pointer", textDecoration: "underline dotted" }} onClick={() => editRate(id, rates[id] ?? m.price, m.name)}>✎ {inr(rates[id] ?? m.price)} x {q}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", width: 84, justifyContent: "center", border: "1px solid " + C.line, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                    <button onClick={() => setQty(id, q - 1)} style={{ width: 26, height: 26, border: "none", background: C.cardAlt, color: C.ink, fontSize: 15, fontWeight: 900, cursor: "pointer", padding: 0 }}>-</button>
                    <span style={{ flex: 1, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink }}>{q}</span>
                    <button onClick={() => setQty(id, q + 1)} style={{ width: 26, height: 26, border: "none", background: C.goldLight, color: C.goldText, fontSize: 15, fontWeight: 900, cursor: "pointer", padding: 0 }}>+</button>
                  </div>
                  <div style={{ width: 64, textAlign: "right", fontWeight: 800, fontSize: 13, color: C.ink, fontFamily: "monospace", flexShrink: 0 }}>{inr((rates[id] ?? m.price) * q)}</div>
                  <button onClick={() => setQty(id, 0)} style={{ width: 16, background: "transparent", border: "none", color: C.gray, fontSize: 13, cursor: "pointer", padding: 0, flexShrink: 0 }}>x</button>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: `2px solid ${C.line}`, padding: 10, background: C.light, overflowY: isMobile ? "visible" : "auto", maxHeight: isMobile ? "none" : "55vh" }}>
            {!addMoreMode && (
              <button onClick={() => setShowAdj((v) => !v)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", marginBottom: 8, border: "1px solid " + C.line, borderRadius: 8, background: C.card, color: C.ink, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                <span>Disc {discount}% - GST {gstRate ? gstRate + "%" : "No"} - {String(payMode).toUpperCase()}</span>
                <span style={{ color: C.gray }}>{showAdj ? "▲ Band" : "▼ Badlo"}</span>
              </button>
            )}
            {!addMoreMode && (
              <div style={{ display: showAdj ? "flex" : "none", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.gray, fontWeight: 800, minWidth: 38 }}>DISC</span>
                {[0,5,10,20].map(d => <button key={d} onClick={() => (isOwner ? setDiscount(d) : toast("Discount sirf owner de sakta hai", "warning"))} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${discount === d ? C.green : C.line}`, background: discount === d ? C.greenLight : C.card, color: discount === d ? C.green : C.ink, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{d === 0 ? "0" : `${d}%`}</button>)}
                <input type="number" min={0} max={100} disabled={!isOwner} value={discount || ""} onChange={e => setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} placeholder="%" style={{ width: 44, padding: "3px 6px", border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 10, background: C.card, color: C.ink, fontWeight: 700, textAlign: "center", outline: "none" }} />
              </div>
            )}
            {!addMoreMode && (
              <div style={{ display: showAdj ? "flex" : "none", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.gray, fontWeight: 800, minWidth: 38 }}>GST</span>
                {[0,5,12,18].map(g => <button key={g} onClick={() => setGstRate(g)} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${gstRate === g ? C.gold : C.line}`, background: gstRate === g ? C.redLight : C.card, color: gstRate === g ? C.gold : C.ink, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{g === 0 ? "No" : `${g}%`}</button>)}
              </div>
            )}
            {!addMoreMode && (
              <div style={{ display: showAdj ? "flex" : "none", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.gray, fontWeight: 800, minWidth: 38 }}>PAY</span>
                {[["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["due", "Due"]].map(([id, label]) => <button key={id} onClick={() => setPayMode(id)} style={{ padding: "3px 9px", borderRadius: 4, border: `1px solid ${payMode === id ? C.gold : C.line}`, background: payMode === id ? C.gold : C.card, color: payMode === id ? "#fff" : C.ink, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>)}
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
            <div style={{ background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: `0 4px 12px ${C.gold}40` }}>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>TOTAL</span>
              <span style={{ color: "#fff", fontSize: 20, fontWeight: 900, fontFamily: "monospace" }}>{inr(addMoreMode ? grossSub : totalAmount)}</span>
            </div>
            {existingOrder && !addMoreMode && (
              <div style={{ marginTop: 8 }}>
                {existingOrder.paid && <div style={{ padding: 8, borderRadius: 6, background: C.greenLight, color: C.green, fontWeight: 900, fontSize: 12, textAlign: "center", border: "1px solid " + C.green, marginBottom: 6 }}>PAID</div>}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={handleSaveBill} disabled={placing || !!existingOrder.paid} style={{ flex: 1, padding: "9px 6px", border: "none", borderRadius: 6, background: C.blue, color: "#fff", fontWeight: 700, fontSize: 12, cursor: placing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>Save</button>
                  <button onClick={handlePrintBill} disabled={placing} style={{ flex: 1, padding: "9px 6px", border: "1px solid " + C.ink, borderRadius: 6, background: "transparent", color: C.ink, fontWeight: 700, fontSize: 12, cursor: placing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>Print</button>
                  {!existingOrder.paid && onSwitchAdd && (
                    <button onClick={onSwitchAdd} disabled={placing} style={{ flex: 1, padding: "9px 6px", border: "1px solid " + C.green, borderRadius: 6, background: "transparent", color: C.green, fontWeight: 700, fontSize: 12, cursor: placing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>+ Add</button>
                  )}
                  {!existingOrder.paid && (
                    <button onClick={handlePaidPrint} disabled={placing} style={{ flex: 1.5, padding: "9px 6px", border: "none", borderRadius: 6, background: C.green, color: "#fff", fontWeight: 800, fontSize: 12, cursor: placing ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>{placing ? <Spinner /> : (payMode === "due" ? "Due" : "Paid")}</button>
                  )}
                </div>
                {isOwner && !existingOrder.paid && (
                  <button onClick={() => setCancelOpen(true)} style={{ width: "100%", marginTop: 6, padding: 4, border: "none", background: "transparent", color: C.gray, fontWeight: 700, fontSize: 11, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>Order cancel karein</button>
                )}
              </div>
            )}
            {addMoreMode && (
              <button onClick={handlePlaceOrder} disabled={cartItems.length === 0 || placing} style={{ width: "100%", padding: 10, marginTop: 8, border: "none", borderRadius: 10, background: cartItems.length === 0 ? C.line : `linear-gradient(135deg, ${C.green} 0%, #15803D 100%)`, color: cartItems.length === 0 ? C.gray : "#fff", fontWeight: 800, fontSize: 14, cursor: cartItems.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{placing ? <><Spinner /> Adding...</> : "Add Items to Running KOT"}</button>
            )}
            {!existingOrder && (
              <button onClick={handlePlaceOrder} disabled={cartItems.length === 0 || placing} style={{ width: "100%", padding: 10, marginTop: 8, border: "none", borderRadius: 10, background: cartItems.length === 0 ? C.line : `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, color: cartItems.length === 0 ? C.gray : "#fff", fontWeight: 800, fontSize: 14, cursor: cartItems.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: cartItems.length === 0 ? "none" : `0 6px 16px ${C.gold}40`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{placing ? <><Spinner /> Placing...</> : "Send KOT"}</button>
            )}
          </div>
        </div>
      </div>

      <ModalShell C={C} open={cancelOpen} onClose={() => setCancelOpen(false)} isMobile={isMobile} title="Order cancel karein?" icon="🗑️" maxWidth={360}>
        <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason (optional)" style={{ width: "100%", boxSizing: "border-box", padding: 10, border: "1px solid " + C.line, borderRadius: 8, background: C.card, color: C.ink, marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCancelOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid " + C.line, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer" }}>Nahi</button>
          <button onClick={cancelOrder} disabled={placing} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: "pointer" }}>Haan, Cancel</button>
        </div>
      </ModalShell>

      <ModalShell C={C} open={addMenuOpen} onClose={() => setAddMenuOpen(false)} isMobile={isMobile} title="Naya menu item" icon="🍽️" maxWidth={400}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, marginBottom: 4 }}>ITEM KA NAAM</div>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Jaise: Paneer Tikka" style={{ width: "100%", boxSizing: "border-box", padding: 11, border: "1px solid " + C.line, borderRadius: 8, fontSize: 14, background: C.card, color: C.ink, marginBottom: 12, outline: "none" }} />
        <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, marginBottom: 4 }}>RATE (₹)</div>
        <input type="number" inputMode="decimal" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="200" style={{ width: "100%", boxSizing: "border-box", padding: 11, border: "1px solid " + C.line, borderRadius: 8, fontSize: 14, background: C.card, color: C.ink, marginBottom: 12, outline: "none" }} />
        <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, marginBottom: 6 }}>CATEGORY</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, maxHeight: 120, overflowY: "auto" }}>
          {Array.from(new Set(menu.map((m) => m.category).filter(Boolean))).map((c) => (
            <button key={c} onClick={() => setNewCat(c)} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid " + (newCat === c ? C.gold : C.line), background: newCat === c ? C.gold : C.card, color: newCat === c ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{c}</button>
          ))}
        </div>
        <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Ya nayi category likho" style={{ width: "100%", boxSizing: "border-box", padding: 11, border: "1px solid " + C.line, borderRadius: 8, fontSize: 14, background: C.card, color: C.ink, marginBottom: 16, outline: "none" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setAddMenuOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid " + C.line, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
          <button onClick={saveMenuItem} disabled={savingMenu} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.green, color: "#fff", fontWeight: 800, cursor: savingMenu ? "not-allowed" : "pointer" }}>{savingMenu ? <Spinner /> : "Save"}</button>
        </div>
      </ModalShell>

      {/* STICKY MOBILE CART BAR */}
      {isMobile && cartItems.length > 0 && !(existingOrder && addMoreMode) && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.card, borderTop: `1px solid ${C.line}`, padding: 12, boxShadow: "0 -4px 16px rgba(0,0,0,0.1)", zIndex: 101, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.gray, fontWeight: 800, textTransform: "uppercase" }}>{cartItems.length} items</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.goldText, fontFamily: "monospace" }}>{inr(totalAmount)}</div>
          </div>
          <button onClick={existingOrder ? handleSaveBill : handlePlaceOrder} disabled={placing || !!(existingOrder && existingOrder.paid)} style={{ padding: "14px 24px", border: "none", borderRadius: 10, background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, color: "#fff", fontWeight: 900, fontSize: 14, cursor: placing ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: `0 6px 16px ${C.gold}55`, display: "flex", alignItems: "center", gap: 8 }}>{placing ? <Spinner /> : existingOrder ? "Save Bill" : "Place Order"}</button>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// AUDIT LOG
// ===========================================================================
const logAudit = async (action, details = {}) => {
  try { await addDoc(collection(db, "auditLogs"), { action, ...details, by: auth.currentUser?.uid || "", at: Date.now() }); } catch (e) {}
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
  const editDue = async (o) => {
    const n = window.prompt("Customer ka naam?", o.dueName && o.dueName !== "Unknown" ? o.dueName : "");
    if (n === null) return;
    if (!n.trim()) { toast("Naam zaroori hai", "warning"); return; }
    const p = (window.prompt("Phone (10 digit)?", o.duePhone || "") || "").replace(/\D/g, "");
    if (p.length < 10) { toast("Sahi 10 digit phone zaroori hai", "warning"); return; }
    try {
      await updateDoc(doc(db, "orders", o.id), { dueName: n.trim(), duePhone: p });
      logAudit("due_edited", { orderId: o.id, total: o.finalTotal || 0 });
      toast("Due update ho gaya", "success");
    } catch (e) { toast(e.message, "error"); }
  };
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
        <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 900, color: C.goldText, fontFamily: "monospace" }}>{inr(total)}</div>
      </div>
      {dues.sort((a, b) => b.createdAt - a.createdAt).map(o => (
        <div key={o.id} style={{ background: C.cardAlt, borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: isMobile ? 13 : 14, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.dueName || "Unknown"} {o.duePhone ? `- ${o.duePhone}` : ""}</div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{o.orderType === "parcel" ? "Parcel" : "Table " + o.table} - {new Date(o.dueAt || o.createdAt).toLocaleDateString("en-IN")}</div>
            </div>
            <div style={{ fontWeight: 900, color: C.goldText, fontFamily: "monospace", fontSize: isMobile ? 14 : 15, flexShrink: 0 }}>{inr(o.finalTotal || 0)}</div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => settle(o, "cash")} style={{ flex: 1, padding: 8, border: "none", borderRadius: 6, background: C.green, color: "#fff", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Cash</button>
            <button onClick={() => settle(o, "upi")} style={{ flex: 1, padding: 8, border: "none", borderRadius: 6, background: C.blue, color: "#fff", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>UPI</button>
            <button onClick={() => editDue(o)} style={{ padding: "8px 10px", border: `1.5px solid ${C.gray}`, borderRadius: 6, background: "transparent", color: C.gray, fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
            <button onClick={() => whatsappBill(o)} style={{ padding: "8px 10px", border: `1.5px solid ${C.green}`, borderRadius: 6, background: "transparent", color: C.green, fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>WA</button>
          </div>
        </div>
      ))}
    </div>
  );
}
// ===========================================================================
// INVENTORY (SAMAN) - kitchen raw-material stock register
// Firestore: inventory/items (list), inventory/day_YYYY-MM-DD (entries), inventory/state (current stock)
// Paste this whole block just ABOVE the "// ERROR BOUNDARY" section of your staff file.
// ===========================================================================
const INV_DEFAULT = [
  ["मैदा", "आटा/मैदा/नूडल्स", "kg", 35, 7],
  ["आटा", "आटा/मैदा/नूडल्स", "kg", 20, 4],
  ["चाउमिन", "आटा/मैदा/नूडल्स", "pc", 10, 2],
  ["पास्ता", "आटा/मैदा/नूडल्स", "pc", 4, 1],
  ["ब्रेड क्रम्ब", "आटा/मैदा/नूडल्स", "pc", 5, 1],
  ["आरारोट", "आटा/मैदा/नूडल्स", "kg", 0, 0],
  ["रिफाइंड तेल", "तेल/चावल/नमक/चीनी", "L", 80, 16],
  ["सरसों तेल", "तेल/चावल/नमक/चीनी", "kg", 4, 1],
  ["बासमती / टेबल राइस", "तेल/चावल/नमक/चीनी", "kg", 45, 9],
  ["नमक", "तेल/चावल/नमक/चीनी", "kg", 10, 2],
  ["चीनी", "तेल/चावल/नमक/चीनी", "kg", 10, 2],
  ["घी", "तेल/चावल/नमक/चीनी", "kg", 6, 2],
  ["शहद", "तेल/चावल/नमक/चीनी", "kg", 1, 1],
  ["चिली सॉस", "सॉस", "pc", 5, 1],
  ["टमाटो सॉस", "सॉस", "pc", 5, 1],
  ["सोया सॉस", "सॉस", "pc", 5, 1],
  ["वेनिगर", "सॉस", "pc", 3, 1],
  ["अजीनो मोटो", "सॉस", "kg", 0, 0],
  ["केवड़ा जल", "सॉस", "pc", 0, 0],
  ["सेज़वान सॉस", "सॉस", "pc", 4, 1],
  ["ग्रीन चिली सॉस", "सॉस", "pc", 2, 1],
  ["मेयोनीज़", "सॉस", "kg", 5, 1],
  ["पिज़्ज़ा सॉस", "सॉस", "pc", 3, 1],
  ["ओरेगैनो + चिली फ्लेक्स", "सॉस", "pc", 3, 1],
  ["BBQ सॉस", "सॉस", "pc", 2, 1],
  ["जीरा पाउडर", "पाउडर मसाले", "pc", 2, 1],
  ["मिक्स मसाला", "पाउडर मसाले", "pc", 3, 1],
  ["लाल मिर्च पाउडर", "पाउडर मसाले", "pc", 3, 1],
  ["हल्दी पाउडर", "पाउडर मसाले", "pc", 2, 1],
  ["धनिया पाउडर", "पाउडर मसाले", "pc", 4, 1],
  ["कश्मीरी मिर्च", "पाउडर मसाले", "pc", 3, 1],
  ["चिकन मसाला", "पाउडर मसाले", "pc", 3, 1],
  ["मीट मसाला", "पाउडर मसाले", "pc", 2, 1],
  ["बिरयानी मसाला", "पाउडर मसाले", "pc", 4, 1],
  ["कस्तूरी मेथी", "पाउडर मसाले", "pc", 3, 1],
  ["तंदूरी मसाला", "पाउडर मसाले", "pc", 3, 1],
  ["टिक्का मसाला", "पाउडर मसाले", "pc", 3, 1],
  ["तंदूरी/खाने का रंग", "पाउडर मसाले", "pc", 1, 1],
  ["गरम मसाला", "पाउडर मसाले", "pc", 3, 1],
  ["चाट मसाला", "पाउडर मसाले", "pc", 2, 1],
  ["काली मिर्च पाउडर", "पाउडर मसाले", "pc", 2, 1],
  ["काला नमक", "पाउडर मसाले", "pc", 1, 1],
  ["हींग", "पाउडर मसाले", "pc", 1, 1],
  ["खड़ा जीरा", "खड़े मसाले", "pc", 0, 0],
  ["खड़ा लाल मिर्च", "खड़े मसाले", "pc", 0, 0],
  ["गोलकी", "खड़े मसाले", "gm", 0, 0],
  ["छोटी इलायची", "खड़े मसाले", "pc", 0, 0],
  ["बड़ी इलायची", "खड़े मसाले", "pc", 1, 1],
  ["जावित्री", "खड़े मसाले", "gm", 0, 0],
  ["दालचीनी", "खड़े मसाले", "gm", 100, 20],
  ["तेज पत्ता", "खड़े मसाले", "pc", 2, 1],
  ["लौंग", "खड़े मसाले", "gm", 200, 40],
  ["काजू", "मेवा", "kg", 3, 1],
  ["मगज", "मेवा", "gm", 1000, 200],
  ["बादाम", "मेवा", "gm", 500, 100],
  ["किशमिश", "मेवा", "gm", 500, 100],
  ["चना दाल", "दाल/सोया", "kg", 3, 1],
  ["अरहर दाल", "दाल/सोया", "kg", 8, 2],
  ["सोया चाप", "दाल/सोया", "pc", 40, 8],
  ["उड़द साबुत", "दाल/सोया", "kg", 4, 1],
  ["बूंदी", "दाल/सोया", "kg", 2, 1],
  ["राजमा", "दाल/सोया", "kg", 1, 1],
  ["मैगी (पैकेट)", "मैगी/कॉर्न/छोले-भटूरे", "pc", 100, 20],
  ["काबुली चना (छोले)", "मैगी/कॉर्न/छोले-भटूरे", "kg", 8, 2],
  ["छोले मसाला", "मैगी/कॉर्न/छोले-भटूरे", "pc", 3, 1],
  ["सूजी", "मैगी/कॉर्न/छोले-भटूरे", "kg", 3, 1],
  ["अनारदाना", "मैगी/कॉर्न/छोले-भटूरे", "gm", 250, 50],
  ["स्प्रिंग रोल शीट", "मैगी/कॉर्न/छोले-भटूरे", "pc", 50, 10],
  ["पनीर", "ताज़ा सामान", "kg", 40, 8],
  ["प्याज़", "ताज़ा सामान", "kg", 80, 16],
  ["टमाटर", "ताज़ा सामान", "kg", 50, 10],
  ["अदरक-लहसुन", "ताज़ा सामान", "kg", 10, 2],
  ["दही", "ताज़ा सामान", "kg", 25, 5],
  ["क्रीम/मलाई", "ताज़ा सामान", "L", 8, 2],
  ["बटर", "ताज़ा सामान", "kg", 7, 2],
  ["खमीर/बेकिंग सोडा", "ताज़ा सामान", "pc", 1, 1],
  ["आलू", "ताज़ा सामान", "kg", 40, 8],
  ["पत्तागोभी", "ताज़ा सामान", "kg", 15, 3],
  ["गाजर", "ताज़ा सामान", "kg", 5, 1],
  ["शिमला मिर्च", "ताज़ा सामान", "kg", 12, 3],
  ["मशरूम", "ताज़ा सामान", "kg", 12, 3],
  ["बेबी कॉर्न", "ताज़ा सामान", "kg", 6, 2],
  ["मटर", "ताज़ा सामान", "kg", 5, 1],
  ["पालक", "ताज़ा सामान", "kg", 4, 1],
  ["हरी मिर्च", "ताज़ा सामान", "kg", 3, 1],
  ["धनिया पत्ती", "ताज़ा सामान", "kg", 3, 1],
  ["पुदीना", "ताज़ा सामान", "kg", 1, 1],
  ["नींबू", "ताज़ा सामान", "kg", 3, 1],
  ["स्प्रिंग ओनियन", "ताज़ा सामान", "kg", 4, 1],
  ["सलाद (खीरा/मूली/गाजर)", "ताज़ा सामान", "kg", 8, 2],
  ["स्वीट कॉर्न", "ताज़ा सामान", "kg", 8, 2],
  ["अचार", "ताज़ा सामान", "kg", 2, 1],
  ["चिकन", "चिकन/मटन/मछली/अंडा", "kg", 80, 16],
  ["मटन", "चिकन/मटन/मछली/अंडा", "kg", 12, 3],
  ["मछली", "चिकन/मटन/मछली/अंडा", "kg", 10, 2],
  ["अंडा", "चिकन/मटन/मछली/अंडा", "tray", 8, 2],
  ["पिज़्ज़ा बेस", "पिज़्ज़ा/बर्गर/रोल/सैंडविच", "pc", 30, 6],
  ["मोज़ेरेला चीज़", "पिज़्ज़ा/बर्गर/रोल/सैंडविच", "kg", 5, 1],
  ["चीज़ स्लाइस", "पिज़्ज़ा/बर्गर/रोल/सैंडविच", "pc", 100, 20],
  ["बर्गर बन", "पिज़्ज़ा/बर्गर/रोल/सैंडविच", "pc", 60, 12],
  ["सैंडविच ब्रेड", "पिज़्ज़ा/बर्गर/रोल/सैंडविच", "pkt", 10, 2],
  ["फ्रेंच फ्राइज़ (फ्रोज़न)", "पिज़्ज़ा/बर्गर/रोल/सैंडविच", "kg", 15, 3],
  ["KFC/क्रिस्पी कोटिंग मिक्स", "पिज़्ज़ा/बर्गर/रोल/सैंडविच", "pc", 3, 1],
  ["वेज क्रिस्पी बर्गर पैटी", "पिज़्ज़ा/बर्गर/रोल/सैंडविच", "pc", 40, 8],
  ["ओलिव + जलापेनो", "पिज़्ज़ा/बर्गर/रोल/सैंडविच", "pc", 2, 1],
  ["दूध", "शेक/ड्रिंक/चाय", "L", 120, 24],
  ["आइसक्रीम (वनीला)", "शेक/ड्रिंक/चाय", "L", 15, 3],
  ["आइसक्रीम (चॉकलेट)", "शेक/ड्रिंक/चाय", "L", 8, 2],
  ["मैंगो पल्प", "शेक/ड्रिंक/चाय", "pc", 4, 1],
  ["स्ट्रॉबेरी क्रश", "शेक/ड्रिंक/चाय", "pc", 2, 1],
  ["बटरस्कॉच क्रश", "शेक/ड्रिंक/चाय", "pc", 2, 1],
  ["चॉकलेट सिरप", "शेक/ड्रिंक/चाय", "pc", 4, 1],
  ["ब्लू कुराकाओ सिरप", "शेक/ड्रिंक/चाय", "pc", 2, 1],
  ["मिंट सिरप", "शेक/ड्रिंक/चाय", "pc", 2, 1],
  ["कॉफी पाउडर", "शेक/ड्रिंक/चाय", "gm", 1000, 200],
  ["चायपत्ती", "शेक/ड्रिंक/चाय", "kg", 2, 1],
  ["किटकैट", "शेक/ड्रिंक/चाय", "pc", 20, 4],
  ["ओरियो बिस्किट", "शेक/ड्रिंक/चाय", "pkt", 10, 2],
  ["कोल्ड ड्रिंक", "शेक/ड्रिंक/चाय", "crate", 5, 1],
  ["सोडा", "शेक/ड्रिंक/चाय", "bottle", 24, 5],
  ["आइसक्रीम (स्ट्रॉबेरी)", "शेक/ड्रिंक/चाय", "L", 4, 1],
  ["आइसक्रीम (बटरस्कॉच)", "शेक/ड्रिंक/चाय", "L", 4, 1],
  ["कोको/चॉकलेट पाउडर", "शेक/ड्रिंक/चाय", "gm", 1000, 200],
  ["बर्फ", "शेक/ड्रिंक/चाय", "kg", 150, 30],
  ["स्ट्रॉ", "शेक/ड्रिंक/चाय", "pkt", 5, 1],
  ["शेक/पार्सल कप + ढक्कन", "शेक/ड्रिंक/चाय", "pc", 200, 40],
  ["डार्क चॉकलेट", "शेक/ड्रिंक/चाय", "kg", 1, 1],
  ["ग्रीन ऐपल सिरप", "शेक/ड्रिंक/चाय", "pc", 2, 1],
  ["ब्लूबेरी सिरप", "शेक/ड्रिंक/चाय", "pc", 2, 1],
  ["वॉटरमेलन सिरप", "शेक/ड्रिंक/चाय", "pc", 2, 1],
  ["मिनरल वाटर", "शेक/ड्रिंक/चाय", "carton", 5, 1],
  ["रसगुल्ला", "मिठाई/डेज़र्ट", "pc", 60, 12],
  ["राजभोग", "मिठाई/डेज़र्ट", "pc", 30, 6],
  ["गुलाब जामुन", "मिठाई/डेज़र्ट", "pc", 60, 12],
  ["रसमलाई", "मिठाई/डेज़र्ट", "pc", 30, 6],
  ["फ्रूट्स (फ्रूट क्रीम)", "मिठाई/डेज़र्ट", "kg", 5, 1],
  ["फ्रूट कॉकटेल (टिन)", "मिठाई/डेज़र्ट", "pc", 3, 1],
  ["कोयला (तंदूर)", "पैकिंग/अन्य", "kg", 50, 10],
  ["कमर्शियल गैस सिलेंडर", "पैकिंग/अन्य", "pc", 3, 1],
  ["डिस्पोज़ेबल कंटेनर", "पैकिंग/अन्य", "pc", 200, 40],
  ["एल्युमिनियम फॉइल", "पैकिंग/अन्य", "pc", 2, 1],
  ["टिशू पेपर", "पैकिंग/अन्य", "pkt", 5, 1]
];

const invDateKey = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const invNum = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
const invFmt = (n) => (n === null ? "" : String(Math.round(n * 100) / 100));
const EMPTY_ROW = { open: "", inn: "", close: "" };

function InventoryPanel({ C, isMobile, isOwner, waiterName }) {
  const toast = useToast();
  const haptic = useHaptic();
  const [items, setItems] = useState(null);
  const [date, setDate] = useState(invDateKey());
  const [rows, setRows] = useState({});
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const loadedDateRef = useRef(null);
  dirtyRef.current = dirty;
  const [saving, setSaving] = useState(false);
  const [loadingDay, setLoadingDay] = useState(true);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 150);
  const [cat, setCat] = useState("All");
  const [view, setView] = useState("entry");
  const [showAll, setShowAll] = useState(false);

  // Items list (live)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "inventory", "items"),
      (snap) => setItems(snap.exists() && Array.isArray(snap.data().list) ? snap.data().list : []),
      (e) => { setItems([]); toast("Inventory load nahi hua: " + e.message, "error"); });
    return () => unsub();
  }, []);

  const ready = items !== null;

  // Load the selected day (opening auto = last saved closing)
  useEffect(() => {
    if (!ready) return;
    if (dirtyRef.current && loadedDateRef.current === date) return; // unsaved typing: do not reload
    loadedDateRef.current = date;
    let cancelled = false;
    setLoadingDay(true);
    (async () => {
      try {
        const [daySnap, stSnap] = await Promise.all([getDoc(doc(db, "inventory", "day_" + date)), getDoc(doc(db, "inventory", "state"))]);
        if (cancelled) return;
        const entries = daySnap.exists() ? (daySnap.data().entries || {}) : {};
        const stock = stSnap.exists() ? (stSnap.data().stock || {}) : {};
        const next = {};
        (items || []).forEach((it) => {
          const e = entries[it.id];
          if (e) next[it.id] = { open: invFmt(invNum(e.open)), inn: invFmt(invNum(e.inn)), close: invFmt(invNum(e.close)) };
          else next[it.id] = { open: stock[it.id] !== undefined ? invFmt(invNum(stock[it.id])) : "", inn: "", close: "" };
        });
        setRows(next);
        setDirty(false);
      } catch (e) { if (!cancelled) toast("Day load error: " + e.message, "error"); }
      finally { if (!cancelled) setLoadingDay(false); }
    })();
    return () => { cancelled = true; };
  }, [date, ready, items]);

  const setField = (id, field, val) => {
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] || EMPTY_ROW), [field]: val } }));
    setDirty(true);
  };

  const changeDate = (v) => {
    if (!v) return;
    if (dirty && !window.confirm("Unsaved changes hain. Date badalne par ye chale jayenge. Continue?")) return;
    setDate(v);
  };

  const rowOf = (id) => rows[id] || EMPTY_ROW;
  const currentOf = (id) => {
    const r = rowOf(id);
    const close = invNum(r.close);
    if (close !== null) return close;
    const open = invNum(r.open);
    if (open === null) return null;
    return open + (invNum(r.inn) || 0);
  };
  const usedOf = (id) => {
    const r = rowOf(id);
    const close = invNum(r.close);
    if (close === null) return null;
    return (invNum(r.open) || 0) + (invNum(r.inn) || 0) - close;
  };
  const isLow = (it) => {
    const cur = currentOf(it.id);
    return cur !== null && Number(it.min) > 0 && cur <= Number(it.min);
  };

  const save = async () => {
    if (saving || !ready) return;
    const entries = {};
    let negative = 0;
    (items || []).forEach((it) => {
      const r = rowOf(it.id);
      const o = invNum(r.open), i = invNum(r.inn), c = invNum(r.close);
      if (o === null && i === null && c === null) return;
      entries[it.id] = { open: o, inn: i, close: c };
      if (c !== null && (o || 0) + (i || 0) - c < 0) negative++;
    });
    if (Object.keys(entries).length === 0) { toast("Kuch bhara nahi hai", "warning"); return; }
    if (negative > 0 && !window.confirm(negative + " item me closing, opening+aaya se zyada hai (khapat minus). Phir bhi save karein?")) return;
    setSaving(true);
    try {
      await runTransaction(db, async (tx) => {
        const stRef = doc(db, "inventory", "state");
        const st = await tx.get(stRef);
        const stock = st.exists() ? { ...(st.data().stock || {}) } : {};
        const lastDate = st.exists() ? (st.data().lastDate || "") : "";
        Object.entries(entries).forEach(([id, e]) => { if (e.close !== null) stock[id] = e.close; });
        tx.set(doc(db, "inventory", "day_" + date), { date, entries, updatedAt: Date.now(), by: waiterName || "Staff" });
        if (date >= lastDate) tx.set(stRef, { stock, lastDate: date, updatedAt: Date.now() });
      });
      haptic(30);
      setDirty(false);
      toast("Stock save ho gaya", "success");
    } catch (e) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const seedDefault = async () => {
    if (!isOwner) { toast("Sirf owner default list load kar sakta hai", "warning"); return; }
    if (!window.confirm(INV_DEFAULT.length + " items ki default list load karein?")) return;
    try {
      const list = INV_DEFAULT.map((x, i) => ({ id: "i" + String(i + 1).padStart(3, "0"), name: x[0], cat: x[1], unit: x[2], ord: x[3], min: x[4] }));
      await setDoc(doc(db, "inventory", "items"), { list, updatedAt: Date.now() });
      toast("Default list load ho gayi", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const saveItems = async (list) => { await updateDoc(doc(db, "inventory", "items"), { list, updatedAt: Date.now() }); };

  const editItem = async (it) => {
    if (!isOwner) { toast("Sirf owner item badal sakta hai", "warning"); return; }
    const m = window.prompt(it.name + " - Minimum stock (isse kam par laal alert, 0 = alert nahi) [" + it.unit + "]", String(it.min || 0));
    if (m === null) return;
    const o = window.prompt(it.name + " - Mangane ki matra (15 din) [" + it.unit + "]", String(it.ord || 0));
    if (o === null) return;
    try {
      await saveItems(items.map((x) => x.id === it.id ? { ...x, min: Math.max(0, Number(m) || 0), ord: Math.max(0, Number(o) || 0) } : x));
      toast("Item update ho gaya", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const addItem = async () => {
    if (!isOwner) { toast("Sirf owner item jod sakta hai", "warning"); return; }
    const name = (window.prompt("Naye item ka naam?", "") || "").trim();
    if (!name) return;
    const cats = Array.from(new Set((items || []).map((x) => x.cat)));
    const c = (window.prompt("Category? (" + cats.join(", ") + ")", cats[0] || "अन्य") || "").trim() || "अन्य";
    const unit = (window.prompt("Unit? (kg / L / pc / gm)", "kg") || "kg").trim();
    try {
      await saveItems([...(items || []), { id: uid("i"), name, cat: c, unit, ord: 0, min: 0 }]);
      toast("Item jud gaya", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const cats = useMemo(() => ["All", ...Array.from(new Set((items || []).map((x) => x.cat)))], [items]);
  const visible = useMemo(() => (items || []).filter((it) => (cat === "All" || it.cat === cat) && (!debouncedQ.trim() || it.name.toLowerCase().includes(debouncedQ.toLowerCase()))), [items, cat, debouncedQ]);
  const lowItems = (items || []).filter(isLow);

  // Order list
  const orderList = (items || []).filter((it) => Number(it.ord) > 0 && (showAll || isLow(it)));
  const orderText = () => {
    const byCat = {};
    orderList.forEach((it) => { (byCat[it.cat] = byCat[it.cat] || []).push(it); });
    let msg = "*" + RESTAURANT.name + " - Saman Order List*\n" + date + "\n";
    Object.entries(byCat).forEach(([c, list]) => {
      msg += "\n*" + c + "*\n";
      list.forEach((it) => { msg += "- " + it.name + ": " + it.ord + " " + it.unit + "\n"; });
    });
    return msg;
  };
  const shareOrder = () => {
    if (orderList.length === 0) { toast("Order list khaali hai", "warning"); return; }
    window.open("https://wa.me/?text=" + encodeURIComponent(orderText()), "_blank");
  };
  const printOrder = () => {
    if (orderList.length === 0) { toast("Order list khaali hai", "warning"); return; }
    const byCat = {};
    orderList.forEach((it) => { (byCat[it.cat] = byCat[it.cat] || []).push(it); });
    const body = "<h2>" + esc(RESTAURANT.name) + "</h2><div class='c'>SAMAN ORDER LIST - " + esc(date) + "</div><div class='line'></div>" +
      Object.entries(byCat).map(([c, list]) => "<div style='font-size:12px;margin-top:6px'>" + esc(c) + "</div><table>" +
        list.map((it) => "<tr><td>" + esc(it.name) + "</td><td style='text-align:right'>" + esc(it.ord) + " " + esc(it.unit) + "</td></tr>").join("") + "</table>").join("") +
      "<div class='line'></div><div class='c'>Total items: " + orderList.length + "</div>";
    printHtml("Order List", body, { css: "@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:290px;margin:0 auto;padding:10px;font-weight:700}h2{text-align:center;font-size:20px;margin:4px 0}.c{text-align:center;font-size:11px}.line{border-top:2px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:3px 2px}" });
  };

  const inputStyle = { width: "100%", boxSizing: "border-box", padding: isMobile ? "9px 6px" : "8px 8px", border: "1.5px solid " + C.line, borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: "center", background: C.card, color: C.ink, outline: "none", fontFamily: "monospace" };
  const labelStyle = { fontSize: 9, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3, textAlign: "center" };

  if (!ready) return <div style={{ padding: 20 }}><Skeleton h={40} style={{ marginBottom: 10 }} /><Skeleton h={90} style={{ marginBottom: 10 }} /><Skeleton h={90} /></div>;

  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: C.gray }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🧾</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 6 }}>Saman ki list abhi khaali hai</div>
        <div style={{ fontSize: 12, marginBottom: 16 }}>Menu ke hisab se {INV_DEFAULT.length} items ki default list load karo</div>
        <button onClick={seedDefault} style={{ padding: "12px 22px", border: "none", borderRadius: 10, background: C.red, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Default list load karo</button>
        {!isOwner && <div style={{ fontSize: 11, marginTop: 10 }}>(Sirf owner/manager kar sakta hai)</div>}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: dirty ? 80 : 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Saman Stock</h2>
          <div style={{ fontSize: 12, color: lowItems.length ? C.red : C.gray, fontWeight: 700, marginTop: 2 }}>{lowItems.length ? lowItems.length + " item kam stock" : "Sab theek hai"}</div>
        </div>
        <input type="date" value={date} max={invDateKey()} onChange={(e) => changeDate(e.target.value)} style={{ padding: "8px 12px", border: "1px solid " + C.line, borderRadius: 8, fontSize: 13, background: C.card, color: C.ink, fontWeight: 700, outline: "none" }} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["entry", "📝 Daily Entry"], ["order", "🛒 Order List" + (lowItems.length ? " (" + lowItems.length + ")" : "")]].map(([id, label]) => (
          <button key={id} onClick={() => { haptic(); setView(id); }} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: "1.5px solid " + (view === id ? C.gold : C.line), background: view === id ? C.gold : C.card, color: view === id ? "#fff" : C.gray, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
        ))}
      </div>

      {view === "entry" && (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item search..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", border: "1px solid " + C.line, borderRadius: 8, fontSize: 14, outline: "none", background: C.card, color: C.ink, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 4 }}>
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid " + (cat === c ? C.gold : C.line), background: cat === c ? C.gold : C.card, color: cat === c ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0 }}>{c}</button>
            ))}
          </div>
          {loadingDay && <div style={{ textAlign: "center", padding: 20, color: C.gray, fontSize: 13 }}><Spinner color={C.red} /> Load ho raha hai...</div>}
          {!loadingDay && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", gap: 8 }}>
              {visible.map((it) => {
                const r = rowOf(it.id);
                const used = usedOf(it.id);
                const low = isLow(it);
                return (
                  <div key={it.id} style={{ background: low ? C.redLight : C.card, border: "1.5px solid " + (low ? C.red : C.line), borderRadius: 12, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                      <button onClick={() => editItem(it)} style={{ background: "transparent", border: "none", padding: 0, textAlign: "left", fontFamily: "inherit", cursor: "pointer", minWidth: 0, flex: 1 }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: C.ink }}>{it.name}</span>
                        <span style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}> ({it.unit})</span>
                        {low && <span style={{ marginLeft: 6, background: C.red, color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>KAM</span>}
                      </button>
                      <div style={{ fontSize: 12, fontWeight: 800, color: used === null ? C.gray : used < 0 ? C.red : C.green, fontFamily: "monospace", flexShrink: 0 }}>
                        {used === null ? "khapat -" : "khapat " + invFmt(used)}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      {[["open", "Opening"], ["inn", "Aaya"], ["close", "Closing"]].map(([f, label]) => (
                        <div key={f}>
                          <div style={labelStyle}>{label}</div>
                          <input type="number" inputMode="decimal" step="any" min="0" value={r[f]} onChange={(e) => setField(it.id, f, e.target.value)} placeholder="0" style={inputStyle} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {visible.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 30, color: C.gray, fontSize: 13 }}>Koi item nahi mila</div>}
            </div>
          )}
          {isOwner && !loadingDay && (
            <button onClick={addItem} style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 10, border: "1.5px dashed " + C.gray, background: "transparent", color: C.gray, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ Naya item jodo</button>
          )}
        </>
      )}

      {view === "order" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={() => setShowAll(false)} style={{ padding: "7px 14px", borderRadius: 20, border: "1px solid " + (!showAll ? C.gold : C.line), background: !showAll ? C.gold : C.card, color: !showAll ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Sirf kam stock</button>
            <button onClick={() => setShowAll(true)} style={{ padding: "7px 14px", borderRadius: 20, border: "1px solid " + (showAll ? C.gold : C.line), background: showAll ? C.gold : C.card, color: showAll ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Poori 15 din ki list</button>
          </div>
          {orderList.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.gray }}><div style={{ fontSize: 40, marginBottom: 8 }}>👍</div><div style={{ fontSize: 13, fontWeight: 700 }}>Abhi kuch mangane ki zarurat nahi</div></div>}
          {Array.from(new Set(orderList.map((x) => x.cat))).map((c) => (
            <div key={c} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{c}</div>
              {orderList.filter((x) => x.cat === c).map((it) => {
                const cur = currentOf(it.id);
                return (
                  <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: C.card, border: "1px solid " + C.line, borderRadius: 10, marginBottom: 6, gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: C.ink }}>{it.name}</div>
                      <div style={{ fontSize: 11, color: C.gray }}>Abhi: {cur === null ? "-" : invFmt(cur)} {it.unit}</div>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 15, color: C.goldText, fontFamily: "monospace", flexShrink: 0 }}>{it.ord} {it.unit}</div>
                  </div>
                );
              })}
            </div>
          ))}
          {orderList.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={shareOrder} style={{ padding: 13, border: "none", borderRadius: 10, background: C.green, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>WhatsApp</button>
              <button onClick={printOrder} style={{ padding: 13, border: "1.5px solid " + C.blue, borderRadius: 10, background: "transparent", color: C.blue, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Print</button>
            </div>
          )}
        </div>
      )}

      {dirty && view === "entry" && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: C.card, borderTop: "1px solid " + C.line, padding: 12, boxShadow: "0 -4px 16px rgba(0,0,0,0.1)", zIndex: 60, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 800, color: C.amber }}>Unsaved changes</div>
          <button onClick={save} disabled={saving} style={{ padding: "13px 28px", border: "none", borderRadius: 10, background: "linear-gradient(135deg, " + C.gold + " 0%, " + C.goldDark + " 100%)", color: "#fff", fontWeight: 900, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>{saving ? <Spinner /> : "Save Stock"}</button>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// HISTORY VIEW - purane orders dekho / print / delete
// ===========================================================================
function HistoryView({ C, isMobile, isOwner }) {
  const toast = useToast();
  const haptic = useHaptic();
  const [from, setFrom] = useState(invDateKey());
  const [to, setTo] = useState(invDateKey());
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [delFor, setDelFor] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const a = from <= to ? from : to;
      const b = from <= to ? to : from;
      const start = new Date(a + "T00:00:00").getTime();
      const end = new Date(b + "T00:00:00").getTime() + 86400000;
      const snap = await getDocs(query(collection(db, "orders"), where("createdAt", ">=", start), where("createdAt", "<", end)));
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)));
    } catch (e) { toast("History load nahi hui: " + e.message, "error"); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const quick = (daysBack) => {
    haptic();
    setFrom(invDateKey(new Date(Date.now() - daysBack * 86400000)));
    setTo(invDateKey(daysBack === 1 ? new Date(Date.now() - 86400000) : new Date()));
  };

  const isDue = (o) => o.paymentStatus === "due" && !o.paid && o.status !== "cancelled";
  const isActive = (o) => !o.paid && o.status !== "cancelled" && !isDue(o);
  const ql = q.trim().toLowerCase();
  const rows = list.filter((o) => {
    if (filter === "paid" && !o.paid) return false;
    if (filter === "due" && !isDue(o)) return false;
    if (filter === "cancelled" && o.status !== "cancelled") return false;
    if (filter === "active" && !isActive(o)) return false;
    if (!ql) return true;
    const hay = [(o.id || "").slice(1, 9), o.table, o.customer && o.customer.name, o.customer && o.customer.phone, o.dueName, o.duePhone, o.waiter]
      .concat((o.items || []).map((it) => it.name)).join(" ").toLowerCase();
    return hay.indexOf(ql) >= 0;
  });
  const paidTotal = list.filter((o) => o.paid && o.status !== "cancelled").reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);

  const doDelete = async () => {
    if (!delFor || busy) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "orders", delFor.id));
      logAudit("order_deleted", { orderId: delFor.id, table: delFor.table || "", total: delFor.finalTotal || 0, status: delFor.status || "", paid: !!delFor.paid });
      setList((prev) => prev.filter((x) => x.id !== delFor.id));
      toast("Order delete ho gaya", "success");
      setDelFor(null);
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  const chip = (id, label) => (
    <button key={id} onClick={() => { haptic(); setFilter(id); }} style={{ padding: isMobile ? "6px 10px" : "7px 14px", borderRadius: 20, border: "1px solid " + (filter === id ? C.gold : C.line), background: filter === id ? C.gold : C.card, color: filter === id ? "#fff" : C.gray, fontWeight: 700, fontSize: isMobile ? 11 : 12, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
  );
  const dateInput = { padding: "8px 10px", border: "1px solid " + C.line, borderRadius: 8, fontSize: 13, background: C.card, color: C.ink, fontWeight: 700, outline: "none" };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Order History</h2>
        <div style={{ fontSize: 12, color: C.gray, fontWeight: 700, marginTop: 2 }}>{list.length} orders - Paid total {inr(paidTotal)}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <button onClick={() => quick(0)} style={{ padding: "7px 12px", borderRadius: 20, border: "1px solid " + C.line, background: C.card, color: C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Today</button>
        <button onClick={() => quick(1)} style={{ padding: "7px 12px", borderRadius: 20, border: "1px solid " + C.line, background: C.card, color: C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Yesterday</button>
        <button onClick={() => quick(6)} style={{ padding: "7px 12px", borderRadius: 20, border: "1px solid " + C.line, background: C.card, color: C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>7 Days</button>
        <button onClick={() => quick(29)} style={{ padding: "7px 12px", borderRadius: 20, border: "1px solid " + C.line, background: C.card, color: C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>30 Days</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.gray }}>FROM</span>
        <input type="date" value={from} max={invDateKey()} onChange={(e) => e.target.value && setFrom(e.target.value)} style={dateInput} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.gray }}>TO</span>
        <input type="date" value={to} max={invDateKey()} onChange={(e) => e.target.value && setTo(e.target.value)} style={dateInput} />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {chip("all", "All")}{chip("active", "Active")}{chip("paid", "Paid")}{chip("due", "Due")}{chip("cancelled", "Cancelled")}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search (table, bill no, naam, item)..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", border: "1px solid " + C.line, borderRadius: 8, fontSize: 14, outline: "none", background: C.card, color: C.ink, marginBottom: 12 }} />

      {loading && <div style={{ textAlign: "center", padding: 30, color: C.gray, fontSize: 13 }}><Spinner color={C.red} /> Load ho raha hai...</div>}
      {!loading && rows.length === 0 && <div style={{ textAlign: "center", padding: 50, color: C.gray }}><div style={{ fontSize: 40, marginBottom: 8 }}>😌</div><div style={{ fontSize: 13, fontWeight: 700 }}>Koi order nahi mila</div></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {!loading && rows.map((o) => {
          const cancelled = o.status === "cancelled";
          const open = openId === o.id;
          const when = new Date(o.createdAt || 0).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
          const st = STATUS[o.status] || STATUS.new;
          return (
            <div key={o.id} style={{ background: C.card, border: "1px solid " + (cancelled ? C.gray : C.line), borderRadius: 12, opacity: cancelled ? 0.8 : 1 }}>
              <button onClick={() => { haptic(); setOpenId(open ? null : o.id); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: isMobile ? "10px 10px" : "12px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: C.ink }}>
                <div style={{ fontSize: 22 }}>{o.orderType === "parcel" ? "🛍️" : "🍽️"}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{o.orderType === "parcel" ? "Parcel" : "Table " + o.table}</span>
                    {cancelled ? <span style={{ background: C.cardAlt, color: C.gray, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>CANCELLED</span>
                      : <span style={{ background: C[st.color + "Light"] || C.light, color: C[st.color] || C.gray, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{st.label}</span>}
                    {o.paid && <span style={{ background: C.greenLight, color: C.green, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>PAID</span>}
                    {isDue(o) && <span style={{ background: C.redLight, color: C.red, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>DUE</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray }}>#{(o.id || "").slice(1, 5).toUpperCase()} - {when} - {(o.items || []).length} items</div>
                </div>
                <div style={{ fontWeight: 900, color: C.goldText, fontFamily: "monospace", fontSize: isMobile ? 14 : 16, flexShrink: 0 }}>{inr(o.finalTotal || 0)}</div>
                <span style={{ color: C.gray, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
              </button>
              {open && (
                <div style={{ padding: isMobile ? "0 10px 12px" : "0 14px 14px", borderTop: "1px solid " + C.line }}>
                  <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.7, padding: "8px 0" }}>
                    {(o.items || []).map((it, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span>{it.qty}x {it.name}{it.portion ? " (" + it.portion + ")" : ""}</span>
                        <span style={{ color: C.gray, fontFamily: "monospace", flexShrink: 0 }}>{inr(it.price * it.qty)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginBottom: 8 }}>
                    {o.waiter ? "Waiter: " + o.waiter + " - " : ""}{o.payment ? "Pay: " + String(o.payment).toUpperCase() : ""}{o.dueName ? " - Due: " + o.dueName : ""}{cancelled && o.cancelledReason ? " - Reason: " + o.cancelledReason : ""}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isOwner ? "1fr 1fr" : "1fr", gap: 6 }}>
                    <button onClick={() => printBill(o)} style={{ padding: 10, border: "1.5px solid " + C.red, borderRadius: 8, background: "transparent", color: C.red, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Print Bill</button>
                    {isOwner && <button onClick={() => setDelFor(o)} style={{ padding: 10, border: "none", borderRadius: 8, background: C.red, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ModalShell C={C} open={!!delFor} onClose={() => setDelFor(null)} isMobile={isMobile} title="Order delete karein?" icon="🗑️" maxWidth={360}>
        {delFor && <div style={{ fontSize: 13, color: C.ink, marginBottom: 6, fontWeight: 700 }}>{delFor.orderType === "parcel" ? "Parcel" : "Table " + delFor.table} - #{(delFor.id || "").slice(1, 5).toUpperCase()} - {inr(delFor.finalTotal || 0)}</div>}
        <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>Ye order hamesha ke liye hat jayega aur dashboard ke revenue/report se bhi nikal jayega. Wapas nahi aayega.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setDelFor(null)} style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid " + C.line, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer" }}>Nahi</button>
          <button onClick={doDelete} disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: busy ? "not-allowed" : "pointer" }}>{busy ? <Spinner /> : "Haan, Delete"}</button>
        </div>
      </ModalShell>
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
// AUDIT LOG VIEW
// ===========================================================================
function AuditLogView({ C, isMobile }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, "auditLogs"), orderBy("at", "desc"), limit(200));
    const unsub = onSnapshot(q, s => {
      setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, e => { console.error(e); setLoading(false); });
    return () => unsub();
  }, []);
  const iconOf = (a) => a === "void_order" ? "🗑" : a === "restore_order" ? "↩" : a === "undo_paid" ? "↺" : a === "due_settled" ? "💰" : a === "table_moved" ? "🔀" : "📝";
  const labelOf = (a) => ({ void_order: "Void", restore_order: "Restore", undo_paid: "Undo Paid", due_settled: "Due Settled", table_moved: "Table Moved", due_created: "Due Created", cancel_order: "Cancel", expense_added: "Kharcha Added", expense_deleted: "Kharcha Deleted", day_closed: "Day Closed", rate_changed: "Rate Changed", vendor_added: "Vendor Added", vendor_paid: "Vendor Paid", paid: "Paid", due_edited: "Due Edited", tables_merged: "Tables Merged", items_removed: "Items Removed", order_deleted: "Deleted", menu_item_added: "Menu Item Added" }[a] || a);
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
                    {l.mode ? " - " + String(l.mode).toUpperCase() : ""}
                    {l.items ? " - " + l.items : ""}
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

// ===========================================================================
// ERROR BOUNDARY
// ===========================================================================

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
      await addDoc(collection(db, "expenses"), { date, amount: amt, category: cat, mode, vendorId: vendorId || null, note: note.trim(), by: waiterName || "Staff", createdAt: Date.now() });
      logAudit("expense_added", { total: amt, reason: cat + (note.trim() ? " - " + note.trim() : "") });
      haptic(25);
      toast("Kharcha save ho gaya: " + inr(amt), "success");
      setAmount(""); setNote(""); setVendorId("");
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
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{cats.map((c) => chip(cat === c, c, () => { haptic(); setCat(c); }))}
          <button onClick={() => setShowNewCat((v) => !v)} style={{ padding: "7px 13px", borderRadius: 20, border: "1px dashed " + C.gray, background: "transparent", color: C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Naya</button>
        </div>
        {showNewCat && (
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} placeholder="Naya category naam (jaise: Chai/Snacks)" style={{ ...field, padding: "8px 10px", fontSize: 13 }} />
            <button onClick={addCat} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: G, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
          </div>
        )}
        <div style={lbl}>Kaise diya</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{[["cash", "Cash"], ["upi", "UPI"], ["bank", "Bank"], ["credit", "Udhaar"]].map(([id, l]) => chip(mode === id, l, () => { setMode(id); if (id !== "credit") setVendorId(""); }, id))}</div>
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
        )}
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
  const [rTab, setRTab] = useState("pnl");
  const [vendorDue, setVendorDue] = useState(0);

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
    let cashVendorPay = 0;
    try {
      const pSnap = await getDocs(query(collection(db, "vendorPayments"), where("date", "==", todayKey), where("mode", "==", "cash")));
      cashVendorPay = pSnap.docs.reduce((t, d) => t + (Number(d.data().amount) || 0), 0);
    } catch (e) { toast("Vendor payments load nahi hue, Day Close roka gaya: " + e.message, "error"); return; }
    const opening = Number(op) || 0;
    const counted = Number(cc) || 0;
    const expected = opening + s.pay.cash - cashExp - cashVendorPay;
    const rec = { date: todayKey, revenue: s.revenue, cash: s.pay.cash, upi: s.pay.upi, card: s.pay.card, cashVendorPayments: cashVendorPay, duePending: s.duePending, expenses: s.expTotal, cashExpenses: cashExp, profit: s.profit, orders: s.valid.length, openingCash: opening, countedCash: counted, expectedCash: expected, cashDiff: counted - expected, by: waiterName || "Staff", at: Date.now() };
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
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setRTab("pnl")} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid " + (rTab === "pnl" ? G : C.line), background: rTab === "pnl" ? G : C.card, color: rTab === "pnl" ? "#fff" : C.gray, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>📈 P&L</button>
        <button onClick={() => setRTab("vendors")} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid " + (rTab === "vendors" ? G : C.line), background: rTab === "vendors" ? G : C.card, color: rTab === "vendors" ? "#fff" : C.gray, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>🏪 Vendor Due{vendorDue > 0 ? " (" + inr(vendorDue) + ")" : ""}</button>
      </div>

      {rTab === "vendors" && <VendorView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} onDuesChange={setVendorDue} />}

      {rTab === "pnl" && (<>
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
      </>)}
    </div>
  );
}



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
      setVendors(dues.filter((x) => x.active !== false));
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
      if (Math.abs(Number(v.due) || 0) > 0) { toast("Pehle due clear karo (baaki " + inr(v.due) + ")", "warning"); return; }
      await updateDoc(doc(db, "vendors", v.id), { active: false, deletedAt: Date.now() });
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


// ===========================================================================
// BULK IMPORT (patch 6)
// Gemini se nikala hua JSON import karke vendors + expenses auto-create
// ===========================================================================

function ImportView({ C, isMobile, isOwner, waiterName, onDone }) {
  const toast = useToast(); const haptic = useHaptic();
  const G = goldOf(C); const GT = goldTextOf(C);
  const [rawJson, setRawJson] = useState("");
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [existingVendors, setExistingVendors] = useState([]);
  const [modeOverride, setModeOverride] = useState("");

  useEffect(() => {
    getDocs(collection(db, "vendors"))
      .then((s) => setExistingVendors(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, []);

  const parseJson = (text, overrideArg) => {
    const override = overrideArg === undefined ? modeOverride : overrideArg;
    setError(""); setResult(null);
    if (!text.trim()) { setParsed(null); return; }
    try {
      const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const obj = JSON.parse(clean);
      const bills = Array.isArray(obj) ? obj : (obj.bills || []);
      if (!Array.isArray(bills)) throw new Error("JSON mein 'bills' array nahi mila");
      const normalized = bills.map((b, i) => ({
        _idx: i,
        vendorName: String(b.vendorName || "").trim(),
        vendorPhone: b.vendorPhone ? String(b.vendorPhone).trim() : "",
        date: b.date || invDateKey(),
        amount: Number(b.amount) || 0,
        category: b.category || "Anya",
        mode: override || b.mode || "credit",
        note: b.note || "",
        confidence: Number(b.confidence) || 1,
        _valid: !!b.vendorName && Number(b.amount) > 0,
        _skip: false,
        _existingVendorId: "",
      }));
      normalized.forEach((n) => {
        const match = existingVendors.find((v) => v.name.toLowerCase() === n.vendorName.toLowerCase());
        if (match) n._existingVendorId = match.id;
      });
      setParsed(normalized);
    } catch (e) {
      setParsed(null);
      setError("JSON galat hai: " + e.message);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) { toast("Sirf .json file daalo", "warning"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const txt = String(ev.target.result || "");
      setRawJson(txt);
      parseJson(txt);
    };
    reader.readAsText(file);
  };

  const toggleSkip = (idx) => {
    setParsed((prev) => prev.map((p) => p._idx === idx ? { ...p, _skip: !p._skip } : p));
  };
  const editField = (idx, field, value) => {
    setParsed((prev) => prev.map((p) => {
      if (p._idx !== idx) return p;
      const upd = { ...p, [field]: value };
      if (field === "vendorName") { const mv = existingVendors.find((v) => v.name.trim().toLowerCase() === String(value).trim().toLowerCase()); upd._existingVendorId = mv ? mv.id : ""; }
      upd._valid = !!upd.vendorName && Number(upd.amount) > 0;
      return upd;
    }));
  };

  const stats = useMemo(() => {
    if (!parsed) return null;
    const active = parsed.filter((p) => !p._skip && p._valid);
    const newVendors = new Set();
    active.forEach((p) => { if (!p._existingVendorId) newVendors.add(p.vendorName.toLowerCase()); });
    return {
      total: parsed.length,
      importing: active.length,
      skipped: parsed.filter((p) => p._skip).length,
      invalid: parsed.filter((p) => !p._skip && !p._valid).length,
      newVendors: newVendors.size,
      totalAmount: active.reduce((s, p) => s + Number(p.amount || 0), 0),
    };
  }, [parsed]);

  const runImport = async () => {
    if (!parsed || !stats || stats.importing === 0) { toast("Kuch import karne layak nahi", "warning"); return; }
    if (!window.confirm(stats.importing + " bills import honge. " + stats.newVendors + " naye vendor banenge. Confirm?")) return;
    setImporting(true);
    const imported = { expenses: 0, vendors: 0, errors: [] };
    try {
      const nameToId = {};
      const freshVendors = await getDocs(collection(db, "vendors"));
      freshVendors.docs.forEach((d) => { nameToId[String(d.data().name || "").trim().toLowerCase()] = d.id; });

      const newVendorNames = new Set();
      const seenNew = new Set();
      parsed.filter((p) => !p._skip && p._valid).forEach((p) => { const k = p.vendorName.trim().toLowerCase(); if (!nameToId[k] && !seenNew.has(k)) { seenNew.add(k); newVendorNames.add(p.vendorName.trim()); } });
      for (const vName of newVendorNames) {
        try {
          const ref = await addDoc(collection(db, "vendors"), {
            name: vName, phone: "", openingDue: 0, active: true, createdAt: Date.now(),
          });
          nameToId[vName.toLowerCase()] = ref.id;
          imported.vendors++;
        } catch (e) {
          imported.errors.push("Vendor '" + vName + "': " + e.message);
        }
      }

      const active = parsed.filter((p) => !p._skip && p._valid);
      for (let i = 0; i < active.length; i += 20) {
        const chunk = active.slice(i, i + 20);
        const batch = writeBatch(db);
        chunk.forEach((p) => {
          const vId = resolveVendorId(p.vendorName, nameToId);
          const ref = doc(collection(db, "expenses"));
          batch.set(ref, {
            date: p.date,
            amount: Number(p.amount),
            category: p.category,
            mode: p.mode,
            vendorId: vId,
            note: (p.note || "") + (p.vendorPhone ? " | " + p.vendorPhone : ""),
            by: waiterName || "Staff",
            createdAt: Date.now(),
            importedFrom: "gemini",
          });
          imported.expenses++;
        });
        await batch.commit();
      }

      try {
        await addDoc(collection(db, "auditLogs"), {
          action: "bulk_import",
          amount: stats.totalAmount,
          count: imported.expenses,
          by: waiterName || "Staff",
          at: Date.now(),
          detail: imported.vendors + " new vendors, " + imported.expenses + " expenses",
        });
      } catch (e) {}

      haptic(50);
      setResult({ ok: true, ...imported, totalAmount: stats.totalAmount });
      toast("Import ho gaya: " + imported.expenses + " expenses, " + imported.vendors + " naye vendor", "success");
      if (onDone) onDone();
    } catch (e) {
      setResult({ ok: false, error: e.message });
      toast("Import fail: " + e.message, "error");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setRawJson(""); setParsed(null); setError(""); setResult(null);
  };

  const box = { background: C.card, border: "1px solid " + C.line, borderRadius: 14, padding: isMobile ? 14 : 18, marginBottom: 16 };
  const field = { width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1.5px solid " + C.line, borderRadius: 10, fontSize: 14, background: C.card, color: C.ink, outline: "none", fontFamily: "inherit" };

  if (!isOwner) {
    return (
      <div style={{ textAlign: "center", padding: 50, color: C.gray }}>
        <div style={{ fontSize: 44 }}>🔒</div>
        <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>Bulk import sirf owner kar sakta hai</div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>📥 Bulk Import</h2>
      <div style={{ fontSize: 12, color: C.gray, fontWeight: 700, marginBottom: 14 }}>
        Gemini se nikala hua JSON file yahan daalo - vendors aur expenses auto-create ho jayenge
      </div>

      {!parsed && !result && (
        <>
          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 10 }}>📸 Step 1: Bills ki photo Gemini ko bhejo</div>
            <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.6, marginBottom: 12 }}>
              Gemini ko bill photo + niche wala prompt bhejo. Wo aapko JSON dega. Us JSON ko <b>.json</b> file mein save karo.
            </div>
            <details style={{ marginBottom: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: GT, padding: "8px 0" }}>📋 Gemini Prompt dekho / copy karo</summary>
              <pre style={{ background: C.cardAlt, padding: 12, borderRadius: 8, fontSize: 10, overflowX: "auto", color: C.ink, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{`Tum ek restaurant accounting assistant ho. Main tumhe purane bill/invoice ki photo bhej raha hoon. Tumhe isse structured JSON nikaalna hai.

RULES:
1. Sirf valid JSON return karo, koi explanation nahi.
2. Agar koi field samajh nahi aaye toh null daalo.
3. Amount number mein.
4. Date YYYY-MM-DD format mein.
5. Category choose karo: ["Saman / Kaccha maal", "Salary", "Kiraya", "Gas / Coyla", "Bijli / Pani", "Repair", "Packing", "Marketing", "Anya"]
6. "paid" likha ho toh mode="cash", warna mode="credit".
7. Multiple bills ho toh array.

OUTPUT:
{
  "bills": [
    {
      "vendorName": "Ramesh Vegetables",
      "vendorPhone": "9876543210",
      "date": "2026-10-15",
      "amount": 10000,
      "category": "Saman / Kaccha maal",
      "mode": "credit",
      "note": "Paneer 5kg",
      "confidence": 0.95
    }
  ]
}`}</pre>
            </details>
          </div>

          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 10 }}>📁 Step 2: JSON file upload karo</div>
            <input type="file" accept=".json,application/json" onChange={handleFile} style={{ ...field, padding: 10, cursor: "pointer" }} />
            <div style={{ fontSize: 11, color: C.gray, marginTop: 8, fontWeight: 700 }}>Ya niche seedha paste karo:</div>
            <textarea
              value={rawJson}
              onChange={(e) => { setRawJson(e.target.value); parseJson(e.target.value); }}
              placeholder='{"bills": [{"vendorName": "...", "amount": 1000, ...}]}'
              style={{ ...field, minHeight: 160, marginTop: 8, fontFamily: "monospace", fontSize: 12 }}
            />
            {error && <div style={{ color: C.red, fontSize: 12, fontWeight: 700, marginTop: 8 }}>❌ {error}</div>}
          </div>

          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 10 }}>⚙️ Mode override (optional)</div>
            <div style={{ fontSize: 11, color: C.gray, marginBottom: 8 }}>Agar Gemini galat mode de raha ho toh yahan sabke liye fix karo:</div>
            <select value={modeOverride} onChange={(e) => { const v = e.target.value; setModeOverride(v); if (parsed) parseJson(rawJson, v); }} style={field}>
              <option value="">-- Gemini ka mode use karo --</option>
              <option value="cash">Sab Cash</option>
              <option value="credit">Sab Udhaar</option>
              <option value="upi">Sab UPI</option>
              <option value="bank">Sab Bank</option>
            </select>
          </div>
        </>
      )}

      {parsed && !result && (
        <>
          <div style={{ ...box, background: C.goldLight || C.cardAlt, border: "1.5px solid " + G }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
              <div><div style={{ fontSize: 10, color: C.gray, fontWeight: 800 }}>TOTAL</div><div style={{ fontSize: 20, fontWeight: 900, color: C.ink, fontFamily: "monospace" }}>{stats.total}</div></div>
              <div><div style={{ fontSize: 10, color: C.gray, fontWeight: 800 }}>IMPORT</div><div style={{ fontSize: 20, fontWeight: 900, color: C.green, fontFamily: "monospace" }}>{stats.importing}</div></div>
              <div><div style={{ fontSize: 10, color: C.gray, fontWeight: 800 }}>NEW VENDORS</div><div style={{ fontSize: 20, fontWeight: 900, color: GT, fontFamily: "monospace" }}>{stats.newVendors}</div></div>
              <div><div style={{ fontSize: 10, color: C.gray, fontWeight: 800 }}>AMOUNT</div><div style={{ fontSize: 16, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(stats.totalAmount)}</div></div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={runImport} disabled={importing || stats.importing === 0} style={{ flex: 1, minWidth: 140, padding: 14, border: "none", borderRadius: 10, background: importing ? C.line : "linear-gradient(135deg, " + G + " 0%, " + (C.goldDark || G) + " 100%)", color: importing ? C.gray : "#fff", fontWeight: 900, fontSize: 15, cursor: importing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{importing ? "Import ho raha hai..." : "✅ " + stats.importing + " Bills Import Karo"}</button>
            <button onClick={reset} disabled={importing} style={{ padding: "14px 20px", border: "1.5px solid " + C.line, borderRadius: 10, background: "transparent", color: C.gray, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>

          <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 8 }}>Preview ({parsed.length} bills)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {parsed.map((p) => (
              <div key={p._idx} style={{ background: p._skip ? C.cardAlt : C.card, border: "1px solid " + (p._valid ? C.line : C.red), borderRadius: 10, padding: 10, opacity: p._skip ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 0 }}>
                    <input type="checkbox" checked={!p._skip} onChange={() => toggleSkip(p._idx)} style={{ cursor: "pointer" }} />
                    <input
                      value={p.vendorName}
                      onChange={(e) => editField(p._idx, "vendorName", e.target.value)}
                      placeholder="Vendor name"
                      style={{ ...field, padding: "6px 8px", fontSize: 13, fontWeight: 800 }}
                    />
                  </div>
                  <input
                    value={p.amount}
                    onChange={(e) => editField(p._idx, "amount", e.target.value)}
                    type="number"
                    placeholder="Amount"
                    style={{ ...field, padding: "6px 8px", fontSize: 13, width: 100, fontFamily: "monospace", fontWeight: 900 }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 6, fontSize: 11 }}>
                  <input value={p.date} onChange={(e) => editField(p._idx, "date", e.target.value)} type="date" style={{ ...field, padding: "5px 7px", fontSize: 11 }} />
                  <select value={p.category} onChange={(e) => editField(p._idx, "category", e.target.value)} style={{ ...field, padding: "5px 7px", fontSize: 11 }}>
                    {EXP_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={p.mode} onChange={(e) => editField(p._idx, "mode", e.target.value)} style={{ ...field, padding: "5px 7px", fontSize: 11 }}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                    <option value="credit">Udhaar</option>
                  </select>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, color: p._existingVendorId ? C.green : GT, padding: "5px 7px", background: C.cardAlt, borderRadius: 6 }}>
                    {p._existingVendorId ? "✓ existing" : "★ naya"}
                    <span style={{ color: C.gray, marginLeft: "auto" }}>{Math.round(p.confidence * 100)}%</span>
                  </div>
                </div>
                {p.note && <div style={{ fontSize: 11, color: C.gray, marginTop: 6, fontStyle: "italic" }}>{p.note}</div>}
                {!p._valid && <div style={{ fontSize: 11, color: C.red, marginTop: 4, fontWeight: 700 }}>⚠️ Vendor name ya amount missing</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {result && (
        <div style={{ ...box, border: "2px solid " + (result.ok ? C.green : C.red), textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>{result.ok ? "✅" : "❌"}</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: result.ok ? C.green : C.red, marginTop: 8 }}>{result.ok ? "Import Successful" : "Import Failed"}</div>
          {result.ok ? (
            <div style={{ marginTop: 12, fontSize: 13, color: C.ink, fontWeight: 700 }}>
              <div>{result.expenses} expenses add huye</div>
              <div>{result.vendors} naye vendors bane</div>
              <div>Total: {inr(result.totalAmount)}</div>
              {result.errors && result.errors.length > 0 && <div style={{ color: C.amber, marginTop: 8, fontSize: 11 }}>{result.errors.length} errors - check console</div>}
            </div>
          ) : (
            <div style={{ marginTop: 12, fontSize: 12, color: C.red }}>{result.error}</div>
          )}
          <button onClick={reset} style={{ marginTop: 16, padding: "12px 24px", border: "none", borderRadius: 10, background: G, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Naya Import Karo</button>
        </div>
      )}
    </div>
  );
}

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