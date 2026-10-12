
/* eslint-disable */
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { db } from "./firebase";
import {
  collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc,
  getDocs, getDoc, addDoc, query, orderBy, serverTimestamp, where,
  runTransaction  // 👈 ADD THIS
} from "firebase/firestore";
import { QRCodeSVG } from 'qrcode.react';
function ImageUploadButton({ currentImage, onUploaded, label }) {
  const widgetRef = useRef(null);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const tryInit = () => {
      if (cancelled) return;
      if (window.cloudinary) {
        widgetRef.current = window.cloudinary.createUploadWidget(
          {
            cloudName: "nnddxvcn",
            uploadPreset: "eatpark_uploads",
            sources: ["local", "camera", "url"],
            multiple: false,
            maxFileSize: 5000000,
            clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary error:", error);
              alert("Upload fail: " + (error.statusText || error.message || JSON.stringify(error)));
              return;
            }
            if (result && result.event === "success") {
              onUploadedRef.current(result.info.secure_url);
            }
          }
        );
        setReady(true);
      } else if (++tries < 20) {
        setTimeout(tryInit, 300);
      } else {
        alert("Cloudinary script load nahi hui. public/index.html check karo.");
      }
    };
    tryInit();
    return () => { cancelled = true; };
  }, []);

  const openWidget = () => {
    if (widgetRef.current) widgetRef.current.open();
  };

  return (
    <button
      onClick={openWidget}
      disabled={!ready}
      style={{
        width: "100%",
        padding: 14,
        border: "none",
        borderRadius: 12,
        background: ready ? "#D97706" : "#999",
        color: "#fff",
        fontWeight: 800,
        fontSize: 14,
        cursor: ready ? "pointer" : "wait",
      }}
    >
      {ready ? (label || "📸 Upload Image") : "⏳ Loading..."}
    </button>
  );
}
/* ═══════════════════════════════════════════════════════════════════════
   🍽️ EAT & PARK RESTAURANT — V15 FINAL
   Waiter Mode · Running Items · KOT · Touch Kitchen · Live Notifications
   ═══════════════════════════════════════════════════════════════════════ */

// ==
// 1. CONSTANTS
// ==

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
@keyframes flash { 0% { background-color: #E25938; } 50% { background-color: #C1442D; } 100% { background-color: #E25938; } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes slideRight { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes toastSlide { 0% { transform: translate(-50%, 100px); opacity: 0; } 10% { transform: translate(-50%, 0); opacity: 1; } 90% { transform: translate(-50%, 0); opacity: 1; } 100% { transform: translate(-50%, 100px); opacity: 0; } }
@keyframes scaleInBounce { 0% { transform: scale(0.3); opacity: 0; } 50% { opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes smoothSlideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes fadeInScale { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes notificationPulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(226,89,56,0.7); } 70% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(226,89,56,0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(226,89,56,0); } }
.flash-banner { animation: flash 2s infinite; }
.slide-up { animation: slideUp 0.4s ease-out; }
.slide-right { animation: slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-anim { animation: toastSlide 3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.smooth-transition { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.hover-lift:hover { transform: translateY(-3px); box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12) !important; }
.scale-bounce { animation: scaleInBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.smooth-slide-up { animation: smoothSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.fade-scale { animation: fadeInScale 0.3s ease-out; }
.pulse { animation: pulse 2s ease-in-out infinite; }
.notification-pulse { animation: notificationPulse 2s ease-in-out infinite; }
.dark-theme { filter: invert(0.92) hue-rotate(180deg); background: #111; min-height: 100vh; }
.desktop-menu { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); column-gap: 24px; }
.desktop-menu > * { grid-column: 1 / -1; }
.desktop-menu > .smooth-slide-up { grid-column: auto; }
.dark-theme img, .dark-theme .keep-color { filter: invert(1) hue-rotate(180deg); }
@media print {
  .app-content { display: none !important; }
  .print-area { display: block !important; color: #000; font-family: 'JetBrains Mono', monospace; filter: none !important; }
  @page { margin: 0; }
  body { background: #fff; margin: 0; padding: 0; }
}
`;

const COLORS = {
  ink: "#1A1A1A", paper: "#FAFAF8", paper2: "#F0EFEB",
  copper: "#E25938", copperDark: "#C1442D", copperLight: "#F5E8E3",
  rust: "#C0392B", sage: "#4A7C59", sageDark: "#2F5C3F", sageLight: "#E8F0EB",
  gold: "#D4A574", line: "#E8E6DC", text: "#3C3C3C", textLight: "#8A8375",
  success: "#10B981", error: "#EF4444", warning: "#FF9800", info: "#3B82F6",
  google: "#4285F4", razorpay: "#0B4F6C", phonepe: "#5F259F"
};

const RESTAURANT = {
  name: "Eat & Park", full: "Eat & Park Restaurant", tagline: "A Premium Family Restaurant",
  address: "Girja More, Ara – Buxar Main Road, Pakri, Ara",
  phones: ["7303267750", "8271918062"], whatsapp: "917303267750", upiId: "heckeyhr@ybl", gstin: process.env.REACT_APP_GSTIN || ""
};

const GOOGLE_PLACE_ID = "ChIJc8jv-j9fjTkRYFQLM7KK1aA";
const GOOGLE_REVIEW_URL = `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`;

const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY || "YOUR_RAZORPAY_KEY_ID";
const PHONEPE_MERCHANT_ID = process.env.REACT_APP_PHONEPE_MERCHANT_ID || "YOUR_MERCHANT_ID";

const CATEGORIES = [
  "Thali",
  "Mutton, Fish & Egg",
  "Chicken Curries",
  "Tandoor",
  "Biryani & Rice",
  "Paneer & Mushroom",
  "Dal, Roti & Chole",
  "Soya Chaap",
  "Chinese",
  "Momos & Rolls",
  "Pizza, Burgers & More",
  "Maggi, Corn & Fries",
  "Soups",
  "Shakes & Drinks",
  "Desserts",
  "Combos"
];

const VEG = COLORS.sage; const NONVEG = COLORS.rust;

// ==
// 2. LOYALTY SYSTEM
// ==

const LOYALTY_TIERS = [
  { name: 'Bronze', points: 0, discount: 0.05, emoji: '🥉', color: '#CD7F32' },
  { name: 'Silver', points: 500, discount: 0.10, emoji: '🥈', color: '#C0C0C0' },
  { name: 'Gold', points: 1000, discount: 0.15, emoji: '🥇', color: '#FFD700' },
  { name: 'Platinum', points: 2000, discount: 0.25, emoji: '💎', color: '#E5E4E2' }
];

function getLoyaltyTier(points) {
  let tier = LOYALTY_TIERS[0];
  for (const t of LOYALTY_TIERS) if (points >= t.points) tier = t;
  return tier;
}

// ==
// 3. UTILITY FUNCTIONS
// ==

function inr(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "₹0";
  return "₹" + num.toLocaleString("en-IN");
}
/* eslint-disable */
function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 8); }

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Ek hi jagah se order total (coupon + loyalty + delivery sab included)
function getOrderTotal(o) {
  const hasRunning = (o?.kots || []).some(k => k.isRunning);
  if (Number.isFinite(o?.finalTotal) && (!hasRunning || o?.billEditedAt)) return o.finalTotal;
  const sub = (o?.items || []).reduce((s, it) => s + it.price * it.qty, 0);
  const coupon = Math.round((sub * (o?.discount || 0)) / 100);
  return Math.max(0, sub - coupon - (o?.loyaltyDiscount || 0)) + (o?.deliveryFee || 0);
}

// Firestore doc ko safe shape deta hai (purane/adhure docs se crash nahi hoga)
const normOrder = (d) => {
  const o = { id: d.id, ...d.data() };
  if (!Array.isArray(o.items)) o.items = [];
  if (!o.customer) o.customer = { name: "Walk-in", phone: "" };
  return o;
};

// Running KOT aane par total / paid status theek karta hai
const runningPatch = (o, added) => {
  const addT = added.reduce((s, it) => s + it.price * it.qty, 0);
  const p = {};
  if (o.billEditedAt) {
    const g = Number(o.gstRate) || 0;
    p.finalTotal = Math.round((Number(o.finalTotal) || 0) + addT * (1 + g / 100));
    p.subtotal = (Number(o.subtotal) || 0) + addT;
  }
  if (o.paid) { p.paid = false; p.paymentStatus = "pending"; }
  return p;
};

const patchAt = (list, idx, patch) => list.map((x, i) => (i === idx ? { ...x, ...patch } : x));

const DEMO_OTP = process.env.REACT_APP_DEMO_OTP === "true";
function timeAgo(ts) { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return s + "s ago"; const m = Math.floor(s / 60); if (m < 60) return m + "m ago"; return Math.floor(m / 60) + "h ago"; }
function toLocalISODate(timestamp) { const d = new Date(timestamp); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; }

function getEstimatedTime(items, menu = []) {
  if (!items || items.length === 0) return 5;
  const maxTime = Math.max(...items.map(it => { 
    const item = menu.find(m => m.id === it.itemId); 
    return PREP_TIME_ESTIMATES[item?.category || "Fun Food"] || 15; 
  }));
  return (Number.isFinite(maxTime) ? maxTime : 15) + 2;
}

function getOrderProgress(status) {
  const map = { new: 15, preparing: 50, ready: 85, served: 100 };
  return map[status] || 0;
}

// Cart helpers — Flash sale / Combo price override handle karte hain
function getCartQty(cartEntry) {
  if (!cartEntry) return 0;
  if (typeof cartEntry === 'number') return cartEntry;
  return cartEntry.qty || 0;
}

function getCartLineTotal(cartEntry, menuItem) {
  if (!cartEntry || !menuItem) return 0;
  const price = cartEntry.priceOverride ?? menuItem.price ?? 0;
  return price * getCartQty(cartEntry);
}

function getSmartSuggestionPool(menu, cart) {
  const hour = new Date().getHours();
  let cats;
  if (hour < 11) cats = ["Shakes & Drinks", "Momos & Rolls"];
  else if (hour < 15) cats = ["Biryani & Rice", "Thali", "Dal, Roti & Chole"];
  else if (hour < 18) cats = ["Maggi, Corn & Fries", "Shakes & Drinks", "Momos & Rolls"];
  else cats = ["Tandoor", "Chinese", "Paneer & Mushroom"];
  return menu.filter(m => cats.includes(m.category) && m.available && !cart[m.id]);
}


const PREP_TIME_ESTIMATES = {
  "Thali": 20,
  "Mutton, Fish & Egg": 30,
  "Chicken Curries": 25,
  "Tandoor": 20,
  "Biryani & Rice": 25,
  "Paneer & Mushroom": 20,
  "Dal, Roti & Chole": 12,
  "Soya Chaap": 18,
  "Chinese": 15,
  "Momos & Rolls": 12,
  "Pizza, Burgers & More": 15,
  "Maggi, Corn & Fries": 8,
  "Soups": 8,
  "Shakes & Drinks": 5,
  "Desserts": 5,
  "Combos": 15,
  // Fallback for old categories
  "Drinks": 3,
  "Fun Food": 10,
  "Chinese Starter": 12,
  "Tandoori": 20,
  "Biryani & Thali": 25
};const STATUS_FLOW = ["new", "preparing", "ready", "served"];
const STATUS_LABEL = { new: "New", preparing: "Preparing", ready: "Ready", served: "Served" };
const STATUS_COLOR = { new: COLORS.rust, preparing: COLORS.copper, ready: COLORS.sage, served: "#8A8375" };

const TOAST_CONFIG = {
  success: { duration: 2200, bg: COLORS.success, icon: "✅" },
  error: { duration: 4500, bg: COLORS.error, icon: "❌" },
  info: { duration: 3000, bg: COLORS.ink, icon: "ℹ️" },
  reward: { duration: 5000, bg: COLORS.gold, icon: "🎁" },
  warning: { duration: 4000, bg: COLORS.warning, icon: "⚠️" },
  order: { duration: 6000, bg: COLORS.copper, icon: "🛎️" }
};

const EMPTY_STATES = {
  veg_filtered: { icon: "🥬", title: "No vegetarian options here", subtitle: "Try 'All Items' or check our Paneer & Mushroom section!" },
  search_no_results: { icon: "🔍", title: "Dish not found", subtitle: "Try searching 'paneer', 'chicken', 'biryani', or 'tandoori'" },
  category_empty: { icon: "📂", title: "This category is empty", subtitle: "Check out our bestsellers in Fun Food or Tandoori!" }
};

// ==
// 4. REUSABLE COMPONENTS
// ==

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('🔴 ErrorBoundary caught:', error);
    console.error('🔴 Component Stack:', info.componentStack);
    this.setState({ error, errorInfo: info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 20 }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>😅</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.ink, marginBottom: '0.5rem' }}>Something went wrong</h2>
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, maxWidth: 600, overflow: 'auto', fontSize: 12, color: '#c00', marginBottom: 16, whiteSpace: 'pre-wrap' }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.errorInfo?.componentStack}
          </pre>
          <button onClick={() => { try { localStorage.removeItem('eatpark_cart'); } catch (e) {} window.location.reload(); }} style={{ background: COLORS.copper, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>Clear Cache & Refresh</button>
          <button onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })} style={{ background: COLORS.ink, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginTop: 10 }}>🔄 Try Again</button>
          <button onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })} style={{ background: COLORS.ink, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginTop: 10 }}>🔄 Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const VegDot = memo(({ veg }) => {
  const c = veg ? VEG : NONVEG;
  return <span role="img" aria-label={veg ? "Vegetarian" : "Non-vegetarian"} style={{ width: 14, height: 14, border: `1.5px solid ${c}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} /></span>;
});

const Badge = memo(({ children, color }) => (
  <span style={{ background: color, color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 999, fontWeight: 700, display: "inline-block" }}>{children}</span>
));

const Stepper = memo(({ qty, onChange }) => {
  const btnStyle = { width: 28, height: 28, borderRadius: "50%", border: `1.5px solid ${COLORS.copper}`, background: "transparent", color: COLORS.copper, fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" };
  return <div style={{ display: "flex", alignItems: "center", gap: 10 }}><button onClick={() => onChange(Math.max(0, qty - 1))} style={btnStyle}>−</button><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, minWidth: 16, textAlign: "center", fontSize: 15 }}>{qty}</span><button onClick={() => onChange(qty + 1)} style={btnStyle}>+</button></div>;
});

const AddBtnStepper = memo(({ qty, onChange, available }) => {
  if (!available) return <div style={{ color: COLORS.rust, background: COLORS.paper2, borderRadius: 8, fontWeight: 700, fontSize: 11, padding: "6px 10px", textAlign: "center", width: 80, boxSizing: "border-box" }}>Out of stock</div>;
  if (!qty) return <button onClick={() => onChange(1)} style={{ color: COLORS.sage, background: "#fff", border: `2px solid ${COLORS.sage}`, borderRadius: 8, fontWeight: 800, fontSize: 12, padding: "6px 16px", cursor: "pointer", width: 80, boxShadow: "0 4px 12px rgba(74,124,89,0.15)" }} className="smooth-transition hover-lift">ADD</button>;
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: 80, padding: "4px", background: "#fff", border: `2px solid ${COLORS.sage}`, borderRadius: 8 }}><button onClick={() => onChange(Math.max(0, qty - 1))} style={{ width: 22, height: 22, border: "none", color: COLORS.sage, background: "transparent", fontSize: 18, cursor: "pointer" }}>−</button><span style={{ fontWeight: 800, fontSize: 14, color: COLORS.sage }}>{qty}</span><button onClick={() => onChange(qty + 1)} style={{ width: 22, height: 22, border: "none", color: COLORS.sage, background: "transparent", fontSize: 18, cursor: "pointer" }}>+</button></div>;
});

const SearchBar = memo(({ value, onChange, placeholder = "Search menu..." }) => {
  const timeoutRef = useRef(null);
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  const handleChange = (e) => {
    const q = e.target.value;
    setLocalValue(q);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(q), 250);
  };
  return (
    <div style={{ position: "relative", flex: 1 }}>
      <input type="text" value={localValue} onChange={handleChange} placeholder={placeholder} className="keep-color"
        style={{ padding: "12px 16px 12px 42px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 16, width: "100%", boxSizing: "border-box", background: "#fff", color: COLORS.ink }} />
      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: COLORS.textLight }}>🔍</span>
      {localValue && (<button onClick={() => { setLocalValue(""); onChange(""); }} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: COLORS.textLight, padding: "4px 8px" }}>✕</button>)}
    </div>
  );
});

const Toast = memo(({ message, type = 'info' }) => {
  const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
  return (
    <div className="toast-anim" role="status" style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', background: config.bg, color: '#fff', padding: '16px 28px', borderRadius: 30, boxShadow: `0 12px 28px ${config.bg}66`, zIndex: 100, fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 18 }}>{config.icon}</span><span>{message}</span>
    </div>
  );
});

const ModalHeader = memo(({ title, onClose }) => (
  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 16 }}>
    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 700 }}>{title}</div>
    <button onClick={onClose} style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>✕</button>
  </div>
));

const StatCard = memo(({ label, value, icon, color }) => (
  <div style={{ background: "#fff", border: `1.5px solid ${COLORS.line}`, borderRadius: 18, padding: "24px 20px", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }} className="smooth-transition hover-lift">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}><div style={{ fontSize: 13, color: COLORS.textLight, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em" }}>{label}</div><span style={{ fontSize: 28 }}>{icon}</span></div>
    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, color: color }}>{value}</div>
  </div>
));

const SidebarBtn = memo(({ icon, text, onClick, highlight }) => (
  <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderRadius: 14, background: highlight ? COLORS.copperLight : COLORS.paper, border: highlight ? `1.5px solid ${COLORS.copper}` : `1px solid ${COLORS.line}`, color: highlight ? COLORS.copperDark : COLORS.ink, fontSize: 15, fontWeight: 700, cursor: "pointer", textAlign: "left", width: '100%' }}>
    <span style={{ fontSize: 20 }}>{icon}</span><span>{text}</span>
  </button>
));

const ComboCard = memo(({ combo, onAdd }) => {
  if (!combo.active) return null;
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `2px solid ${COLORS.gold}`, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 32 }}>{combo.image}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.ink }}>{combo.name}</div>
          <ul style={{ fontSize: 12, color: COLORS.textLight, margin: '4px 0', paddingLeft: 16 }}>
            {combo.items.map(item => <li key={item.id}>{item.name} × {item.quantity}</li>)}
          </ul>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontWeight: 700, color: COLORS.copper }}>₹{combo.finalPrice}</span>
            <span style={{ textDecoration: 'line-through', fontSize: 12, color: COLORS.textLight }}>₹{combo.totalPrice}</span>
            <span style={{ background: COLORS.copper, color: '#fff', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{combo.discount}% OFF</span>
          </div>
        </div>
        <button onClick={onAdd} style={{ background: COLORS.sage, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Add Combo</button>
      </div>
    </div>
  );
});

const FlashSaleItem = memo(({ item, onAdd }) => {
  if (!item.active || (item.stock != null && item.stock <= 0)) return null;
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `2px solid ${COLORS.error}`, padding: 12, minWidth: 150, flexShrink: 0 }}>
      <div style={{ fontSize: 20 }}>🔥</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{item.name}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0' }}>
        <span style={{ fontWeight: 800, color: COLORS.error }}>₹{item.discountPrice}</span>
        <span style={{ textDecoration: 'line-through', fontSize: 12, color: COLORS.textLight }}>₹{item.price}</span>
      </div>
      {item.stock != null && item.stock <= 5 && (<div style={{ fontSize: 11, color: COLORS.error, fontWeight: 700, marginBottom: 4 }}>Only {item.stock} left!</div>)}
      <button onClick={onAdd} style={{ background: COLORS.error, color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 6, fontWeight: 700, width: '100%', cursor: 'pointer' }}>Add</button>
    </div>
  );
});

// ==
// 5. CUSTOM HOOKS
// ==
function useLiveNow(intervalMs = 30000) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick(x => x + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
}
const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) { return initialValue; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(storedValue)); }
    catch (error) { console.error('useLocalStorage error:', error); }
  }, [key, storedValue]);
  return [storedValue, setStoredValue];
};

// 🖥️📱 APP / DESKTOP MODE
const VIEW_KEY = "eatpark_viewmode";
function useViewMode() {
  const read = () => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "desktop" || saved === "app") return saved;
    } catch (e) {}
    return typeof window !== "undefined" && window.innerWidth >= 1024 ? "desktop" : "app";
  };
  const [mode, setModeState] = useState(read);
  useEffect(() => {
    const sync = () => setModeState(read());
    window.addEventListener("eatpark_viewmode_change", sync);
    return () => window.removeEventListener("eatpark_viewmode_change", sync);
  }, []);
  const setMode = useCallback((m) => {
    try { localStorage.setItem(VIEW_KEY, m); } catch (e) {}
    window.dispatchEvent(new Event("eatpark_viewmode_change"));
  }, []);
  return [mode, setMode];
}

// 📌 ADMIN PRESETS (Firebase: settings/presets) — waiters, customers, notes, discount, GST
const DEFAULT_PRESETS = { waiters: [], notes: [], discounts: [], gstRates: [], customers: [] };
function usePresets() {
  const [presets, setPresetsState] = useState(() => {
    try { return { ...DEFAULT_PRESETS, ...JSON.parse(localStorage.getItem("eatpark_presets") || "{}") }; }
    catch (e) { return DEFAULT_PRESETS; }
  });
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "presets"), (snap) => {
      if (snap.exists()) {
        const d = { ...DEFAULT_PRESETS, ...snap.data() };
        setPresetsState(d);
        try { localStorage.setItem("eatpark_presets", JSON.stringify(d)); } catch (e) {}
      }
    }, (err) => console.error("presets listener:", err));
    return () => unsub();
  }, []);
  const savePresets = async (next) => {
    setPresetsState(next);
    try { localStorage.setItem("eatpark_presets", JSON.stringify(next)); } catch (e) {}
    try { await setDoc(doc(db, "settings", "presets"), next); }
    catch (e) { console.error(e); alert("⚠️ Presets save nahi hue. Internet / Firebase rules check karo."); }
  };
  return [presets, savePresets];
}

const ViewModeToggle = memo(() => {
  const [mode, setMode] = useViewMode();
  const isDesktop = mode === "desktop";
  return (
    <button onClick={() => setMode(isDesktop ? "app" : "desktop")} title="App / Desktop mode badlo"
      style={{ background: COLORS.paper2, border: `1.5px solid ${COLORS.line}`, borderRadius: 12, padding: "8px 12px", cursor: "pointer", fontWeight: 700, fontSize: 13, marginLeft: 8, color: COLORS.ink }}>
      {isDesktop ? "📱 App Mode" : "🖥️ Desktop Mode"}
    </button>
  );
});

// 5 galat PIN ke baad 30 second lock
function usePinLockout(max = 5, lockMs = 30000) {
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  return {
    isLocked: () => Date.now() < lockedUntil,
    secondsLeft: () => Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)),
    registerFail: () => {
      const n = fails + 1;
      if (n >= max) { setLockedUntil(Date.now() + lockMs); setFails(0); } else setFails(n);
    },
    reset: () => setFails(0)
  };
}



// ==
// 6. NOTIFICATION SOUND
// ==

const notificationAudio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
notificationAudio.volume = 0.5;
// Notification Android pe crash na kare
const safeNotify = (title, opts) => { try { return new Notification(title, opts); } catch (e) { console.warn("Notification:", e); } };
// localStorage corrupt ho to bhi crash na ho
const safeJSON = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v ?? fallback; } catch (e) { return fallback; } };
const safeSet = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.error("localStorage:", e); } };
const playNotificationSound = () => {
  try { notificationAudio.currentTime = 0; notificationAudio.play().catch(e => console.log("Sound play error:", e)); } catch (e) { console.log("Sound error:", e); }
};
// 🔓 Audio unlock on first user interaction (browser autoplay fix)
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    notificationAudio.play().then(() => {
      notificationAudio.pause();
      notificationAudio.currentTime = 0;
    }).catch(() => {});
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);
}

// ==
// 7. MENU ITEM HELPER
// ==

function mi(id, name, price, category, veg, desc, portion, isBestseller = false, available = true, customImg = "") {
  let img = customImg || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80";
  if (!customImg) {
    if (category.includes("Thali")) img = "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Mutton") || category.includes("Fish") || category.includes("Egg")) img = "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Chicken")) img = "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Tandoor")) img = "https://images.unsplash.com/photo-1599487405702-3e28c42b9370?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Biryani") || category.includes("Rice")) img = "https://images.unsplash.com/photo-1589302168068-964664d93cb0?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Paneer") || category.includes("Mushroom")) img = "https://images.unsplash.com/photo-1631452180519-c014fe946bc0?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Dal") || category.includes("Roti") || category.includes("Chole")) img = "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Soya")) img = "https://images.unsplash.com/photo-1626082895617-2c6ad36f568a?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Chinese")) img = "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Momos") || category.includes("Rolls")) img = "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Pizza") || category.includes("Burgers")) img = "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Maggi") || category.includes("Corn") || category.includes("Fries")) img = "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Soups")) img = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Shakes") || category.includes("Drinks")) img = "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Desserts")) img = "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Combos")) img = "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=400&q=80";
  }
  return { id, name, desc: desc || "Freshly prepared with premium ingredients.", price, category, veg, available, image: img, portion: portion || "", isBestseller };
}

// ==
// 8. LOYALTY PROGRESS
// ==

const LoyaltyProgress = memo(({ currentPoints, nextTier, loyaltyRules }) => {
  if (!nextTier) return null;
  const currentTierIndex = LOYALTY_TIERS.indexOf(nextTier) - 1;
  const previousTierPoints = currentTierIndex >= 0 ? LOYALTY_TIERS[currentTierIndex].points : 0;
  const pointsNeeded = nextTier.points - currentPoints;
  const progress = Math.min(((currentPoints - previousTierPoints) / (nextTier.points - previousTierPoints)) * 100, 100);
  return (
    <div style={{ marginTop: 8, padding: '10px 12px', background: '#fff', borderRadius: 10, border: `1px solid ${COLORS.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: COLORS.textLight }}>{nextTier.emoji} Next: {nextTier.name}</span>
        <span style={{ fontWeight: 700, color: pointsNeeded > 0 ? COLORS.copper : COLORS.success }}>{pointsNeeded > 0 ? `${pointsNeeded} away` : '🎉 Unlocked!'}</span>
      </div>
      <div style={{ width: '100%', height: 6, background: COLORS.paper2, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', background: `linear-gradient(90deg, ${COLORS.gold}, ${nextTier.color || COLORS.sage})`, borderRadius: 999, transition: 'width 0.8s ease' }} />
      </div>
      {pointsNeeded > 0 && (<div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>💰 Spend ₹{Math.ceil(pointsNeeded * loyaltyRules.rate)} more</div>)}
    </div>
  );
});

// ==
// 9. CHAT BOX
// ==

const ChatBox = memo(({ orderId, customerId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesRef = useMemo(() => collection(db, 'chats', orderId, 'messages'), [orderId]);
  useEffect(() => {
    try {
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
        setMessages(snap.docs.map(doc => { const data = doc.data(); if (!data.timestamp) data.timestamp = Date.now(); return { id: doc.id, ...data }; }));
      });
      return unsub;
    } catch (e) { console.error('Chat error:', e); }
  }, [orderId, messagesRef]);
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await addDoc(messagesRef, { text: newMessage, senderId: customerId, senderName: customerId === 'customer' ? 'Customer' : 'Restaurant', timestamp: serverTimestamp() });
      setNewMessage('');
    } catch (e) { console.error('Chat send error:', e); }
  };
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, background: '#fff' }}>
      <div style={{ maxHeight: 250, overflowY: 'auto', marginBottom: 8 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ textAlign: msg.senderId === customerId ? 'right' : 'left', margin: '4px 0' }}>
            <span style={{ background: msg.senderId === customerId ? COLORS.copper : '#e9ecef', color: msg.senderId === customerId ? '#fff' : '#000', padding: '6px 12px', borderRadius: 12, display: 'inline-block', maxWidth: '80%' }}>{msg.text}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 4 }} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
        <button onClick={sendMessage} style={{ background: COLORS.copper, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer' }}>Send</button>
      </div>
    </div>
  );
});

// ==
// 10. GOOGLE REVIEW BUTTON
// ==

const GoogleReviewButton = memo(({ variant = 'primary', size = 'md', showText = true }) => {
  const variants = {
    primary: { background: '#4285F4', color: '#fff', border: 'none' },
    sm: { background: '#4285F4', color: '#fff', border: 'none' }
  };
  const sizes = {
    sm: { padding: '4px 12px', fontSize: 11, borderRadius: 16 },
    md: { padding: '8px 18px', fontSize: 13, borderRadius: 20 },
    lg: { padding: '12px 24px', fontSize: 16, borderRadius: 24 }
  };
  return (
    <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontWeight: 700, cursor: 'pointer', ...variants[variant], ...sizes[size] }} className="smooth-transition hover-lift">
      <span style={{ fontSize: size === 'lg' ? 24 : size === 'sm' ? 14 : 18 }}>⭐</span>
      {showText && <span>Rate on Google</span>}
    </a>
  );
});

// ==
// 11. PAYMENT PROCESSING
// ==

const loadRazorpayScript = () => new Promise((resolve) => {
  if (window.Razorpay) { resolve(true); return; }
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

// Success pe Razorpay response, cancel/fail pe null return karta hai
const processRazorpayPayment = (amount, orderId, customerName, customerPhone) =>
  new Promise(async (resolve) => {
    if (!RAZORPAY_KEY || RAZORPAY_KEY.startsWith("YOUR_")) {
      alert("⚠️ Razorpay key configure nahi hai.");
      return resolve(null);
    }
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) { alert("⚠️ Payment gateway load nahi hua."); return resolve(null); }
    const rzp = new window.Razorpay({
      key: RAZORPAY_KEY, amount: Math.round(amount * 100), currency: "INR",
      name: RESTAURANT.name, description: `Order #${orderId.slice(1, 5).toUpperCase()}`,
      prefill: { name: customerName, contact: customerPhone },
      theme: { color: COLORS.copper },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => resolve(null) }
    });
    rzp.on('payment.failed', () => resolve(null));
    rzp.open();
  });



// ==
// 12. KOT BADGE (V15 NEW)
// ==

const KotBadge = memo(({ kots }) => {
  const count = kots?.length || 1;
  if (count <= 1) return null;
  return (
    <span style={{ background: COLORS.info, color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 800, marginLeft: 6 }}>
      {count} KOTs
    </span>
  );
});

// ==
// 13. KITCHEN NOTIFICATION COLUMN (V15 NEW)
// ==

const KitchenNotificationColumn = memo(({ orders, selectedOrderId, onSelect }) => { useLiveNow(30000);
  const [open, setOpen] = useState(false);
  const newOrders = orders.filter(o => o.status === "new");
  const preparingOrders = orders.filter(o => o.status === "preparing");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Open notifications"
        style={{ position: "fixed", top: 90, right: 16, zIndex: 90, background: newOrders.length ? COLORS.copper : COLORS.ink, color: "#fff", border: "none", borderRadius: "50%", width: 52, height: 52, fontSize: 22, cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
        className={newOrders.length ? "notification-pulse" : ""}>
        🔔{newOrders.length > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, background: COLORS.error, color: "#fff", borderRadius: "50%", width: 22, height: 22, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{newOrders.length}</span>
        )}
      </button>
    );
  }

  return (
    <div style={{ position: "fixed", top: 90, right: 16, width: 240, maxHeight: "calc(100vh - 120px)", background: "#fff", border: `1.5px solid ${COLORS.line}`, borderRadius: 16, boxShadow: "0 12px 32px rgba(0,0,0,0.12)", zIndex: 90, display: "flex", flexDirection: "column", overflow: "hidden" }} className="slide-right">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${COLORS.line}`, background: COLORS.paper }}>
        <span style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5 }}>🔔 Live Orders</span>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: COLORS.textLight }}>✕</button>
      </div>
      <div style={{ overflowY: "auto", padding: 10, flex: 1 }}>
        {newOrders.length === 0 && preparingOrders.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 0", color: COLORS.textLight, fontSize: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>😌</div>All quiet
          </div>
        )}
        {newOrders.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: COLORS.copper, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>🆕 New ({newOrders.length})</div>
            {newOrders.map(o => (
              <button key={o.id} onClick={() => onSelect(o.id)} style={{ width: "100%", textAlign: "left", background: selectedOrderId === o.id ? COLORS.copperLight : COLORS.paper, border: `1px solid ${selectedOrderId === o.id ? COLORS.copper : COLORS.line}`, borderRadius: 10, padding: "8px 10px", marginBottom: 6, cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 13 }}>{o.orderType === "parcel" ? "🛍️" : `T${o.table}`}</strong>
                  <span style={{ fontSize: 10, color: COLORS.textLight }}>{timeAgo(o.createdAt)}</span>
                </div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 2 }}>
                  {o.items.length} item{o.items.length !== 1 ? "s" : ""}
                  {o.kots?.length > 1 && (<span style={{ marginLeft: 6, color: COLORS.info, fontWeight: 700 }}>+{o.kots.length - 1} KOT</span>)}
                </div>
              </button>
            ))}
          </>
        )}
        {preparingOrders.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: COLORS.sage, letterSpacing: 1, margin: "10px 0 6px", textTransform: "uppercase" }}>👨‍🍳 Cooking ({preparingOrders.length})</div>
            {preparingOrders.map(o => (
              <button key={o.id} onClick={() => onSelect(o.id)} style={{ width: "100%", textAlign: "left", background: selectedOrderId === o.id ? COLORS.sageLight : COLORS.paper, border: `1px solid ${selectedOrderId === o.id ? COLORS.sage : COLORS.line}`, borderRadius: 10, padding: "8px 10px", marginBottom: 6, cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 13 }}>{o.orderType === "parcel" ? "🛍️" : `T${o.table}`}</strong>
                  <span style={{ fontSize: 10, color: COLORS.textLight }}>{timeAgo(o.createdAt)}</span>
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
});

// ==
// 14. RUNNING ORDER MODAL (V15 NEW)
// ==

const RunningOrderModal = memo(({ order, menu, onConfirm, onClose }) => {
  const [additions, setAdditions] = useState({});
  const [search, setSearch] = useState("");
  const filtered = menu.filter(m => m.available && (!search.trim() || m.name.toLowerCase().includes(search.toLowerCase())));
  const itemsToAdd = Object.entries(additions).filter(([, q]) => q > 0);
  const addTotal = itemsToAdd.reduce((s, [id, q]) => { const m = menu.find(x => x.id === id); return s + (m ? m.price * q : 0); }, 0);

  const handleSetQty = (id, q) => { setAdditions(prev => { const next = { ...prev, [id]: q }; if (q <= 0) delete next[id]; return next; }); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 85, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="slide-up" style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: "20px", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800 }}>➕ Add Running Items</div>
            <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>Order #{order.id.slice(1, 5).toUpperCase()} · New KOT #{Math.max(1, ...(order.kots || [{ kotNumber: 1 }]).map(k => k.kotNumber || 1)) + 1}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search menu..." />
        <div style={{ marginTop: 16, maxHeight: "45vh", overflowY: "auto" }}>
          {filtered.map(item => {
            const qty = additions[item.id] || 0;
            return (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><VegDot veg={item.veg} /><strong style={{ fontSize: 14 }}>{item.name}</strong></div>
                  <div style={{ fontSize: 13, color: COLORS.copper, fontWeight: 700, marginTop: 2 }}>{inr(item.price)}</div>
                </div>
                <AddBtnStepper qty={qty} onChange={q => handleSetQty(item.id, q)} available={item.available} />
              </div>
            );
          })}
        </div>
        <div style={{ borderTop: `2px solid ${COLORS.line}`, paddingTop: 16, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 17, marginBottom: 12 }}>
            <span>Additional Total</span><span style={{ color: COLORS.copper, fontFamily: "'JetBrains Mono', monospace" }}>{inr(addTotal)}</span>
          </div>
          <button disabled={itemsToAdd.length === 0}
            onClick={() => {
              if (itemsToAdd.length === 0) return;
              const newItems = itemsToAdd.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty }; });
              onConfirm(newItems);
            }}
            style={{ width: "100%", padding: "16px", border: "none", borderRadius: 14, background: itemsToAdd.length ? COLORS.info : COLORS.paper2, color: itemsToAdd.length ? "#fff" : COLORS.textLight, fontWeight: 800, fontSize: 16, cursor: itemsToAdd.length ? "pointer" : "not-allowed" }}>
            🍳 Send KOT to Kitchen
          </button>
        </div>
      </div>
    </div>
  );
});
// ==
// 14.5 TABLE STATUS BOARD
// ==

const TableStatusBoard = memo(({ orders, tables = 12, onTableClick, onEmptyTableClick, showStats = true, compact = false }) => { useLiveNow(30000);
  const tableData = useMemo(() => {
    const activeOrders = (orders || []).filter(o =>
      o.orderType === "dine_in" &&
      o.status !== "served" &&
      o.status !== "cancelled"
    );

    const map = {};
    for (let i = 1; i <= tables; i++) {
      map[i] = { table: i, order: null, status: "empty" };
    }

    activeOrders.forEach(o => {
      const t = Number(o.table);
      if (map[t]) {
        map[t].order = o;
        if (o.status === "ready" || o.status === "served") map[t].status = "billing";
        else map[t].status = "occupied";
      }
    });

    return Object.values(map);
  }, [orders, tables]);

  const stats = useMemo(() => {
    const active = tableData.filter(t => t.order);
    const totalAmount = active.reduce((sum, t) => sum + getOrderTotal(t.order), 0);
    return {
      occupied: active.length,
      empty: tables - active.length,
      running: totalAmount,
    };
  }, [tableData, tables]);
   
  const statusColors = {
    empty:    { bg: "#E8F5E9", border: "#4A7C59", label: "Empty",    emoji: "🟢" },
    occupied: { bg: "#FFEBEE", border: "#EF4444", label: "Occupied", emoji: "🔴" },
    billing:  { bg: "#FFF8E1", border: "#FF9800", label: "Billing",  emoji: "🟡" },
  };

  const formatTime = (ts) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

  if (compact) {
    return (
      <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.line}`, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>🍽️ Table Status</div>
          <div style={{ fontSize: 11, color: COLORS.textLight }}>
            <span style={{ color: COLORS.error, fontWeight: 700 }}>{stats.occupied}</span> occupied ·{' '}
            <span style={{ color: COLORS.sage, fontWeight: 700 }}>{stats.empty}</span> free
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 6 }}>
          {tableData.map(t => {
            const c = statusColors[t.status];
            return (
              <button
                key={t.table}
                onClick={() => (t.order ? (onTableClick && onTableClick(t.order)) : (onEmptyTableClick && onEmptyTableClick(t.table)))}
                disabled={!t.order && !onEmptyTableClick}
                style={{
                  aspectRatio: '1', borderRadius: 8,
                  background: c.bg, border: `1.5px solid ${c.border}`,
                  fontWeight: 800, fontSize: 13, color: COLORS.ink,
                  cursor: (t.order || onEmptyTableClick) ? 'pointer' : 'default',
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: 0
                }}>
                {t.table}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: 18, border: `1px solid ${COLORS.line}`, padding: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🍽️</span>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800 }}>Table Status Board</div>
            <div style={{ fontSize: 12, color: COLORS.textLight, fontWeight: 600 }}>Live · {tables} tables</div>
          </div>
        </div>

        {showStats && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ background: '#FFEBEE', border: `1px solid ${COLORS.error}`, borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🔴</span>
              <div>
                <div style={{ fontSize: 10, color: COLORS.error, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Occupied</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, color: COLORS.error }}>{stats.occupied}</div>
              </div>
            </div>
            <div style={{ background: '#E8F5E9', border: `1px solid ${COLORS.sage}`, borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🟢</span>
              <div>
                <div style={{ fontSize: 10, color: COLORS.sageDark, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Free</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, color: COLORS.sageDark }}>{stats.empty}</div>
              </div>
            </div>
            <div style={{ background: '#F0EFEB', border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>💰</span>
              <div>
                <div style={{ fontSize: 10, color: COLORS.textLight, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Running</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, color: COLORS.copper }}>{inr(stats.running)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 11, fontWeight: 700, color: COLORS.textLight, flexWrap: 'wrap' }}>
        <span><span style={{ color: COLORS.sage }}>●</span> Empty</span>
        <span><span style={{ color: COLORS.error }}>●</span> Occupied</span>
        <span><span style={{ color: '#E65100' }}>●</span> Billing / Ready</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {tableData.map(t => {
          const c = statusColors[t.status];
          const o = t.order;
          const total = o ? getOrderTotal(o) : 0;
          const itemCount = o ? o.items.reduce((sum, i) => sum + i.qty, 0) : 0;

          return (
            <button
              key={t.table}
              onClick={() => o && onTableClick && onTableClick(o)}
              disabled={!o}
              style={{
                background: c.bg,
                border: `2px solid ${c.border}`,
                borderRadius: 14, padding: 14,
                cursor: o ? 'pointer' : 'default',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease',
                position: 'relative',
                minHeight: 120,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}
              className={o ? 'hover-lift' : ''}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 800, color: COLORS.ink, lineHeight: 1 }}>
                  {t.table}
                </div>
                <span style={{ fontSize: 16 }}>{c.emoji}</span>
              </div>

              {!o ? (
                <div style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Available
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 10, color: COLORS.textLight, fontWeight: 700 }}>
                    <span>{o.waiter ? `🧑‍🍳 ${o.waiter}` : '🧑‍🍳 —'}</span>
                    <span>⏱️ {formatTime(o.createdAt)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 700 }}>
                      #{o.id.slice(1, 5).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.textLight, fontWeight: 700 }}>
                      {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                    <div>
                      <div style={{ fontSize: 9, color: COLORS.textLight, fontWeight: 800, textTransform: 'uppercase' }}>Total</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 800, color: COLORS.copper }}>
                        {inr(total)}
                      </div>
                    </div>
                    {o.status === "ready" && (
                      <div style={{ background: '#E65100', color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                        Ready
                      </div>
                    )}
                    {(o.status === "new" || o.status === "preparing") && (
                      <div style={{ background: COLORS.info, color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                        {o.status === "new" ? "New" : "Cooking"}
                      </div>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ==)
// 15. WAITER ORDER PANEL (V15 NEW)
// ==

const WaiterOrderPanel = memo(({ menu, table, setTable, onSubmit, onClose, onAddMoreItems, orders, setMenuState, categories }) => {
  const [cart, setCart] = useState({});
  const [search, setSearch] = useState("");
  const [waiterName, setWaiterName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [orderMode, setOrderMode] = useState("dine_in"); 
  const [placedOrder, setPlacedOrder] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🆕 Add Menu Item State
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    price: "",
    category: categories[0] || "Thali",
    veg: true,
    portion: "",
    desc: "",
    image: "",
    isBestseller: false
  });
  const [isSavingItem, setIsSavingItem] = useState(false);

  const filtered = menu.filter(m => m.available && (!search.trim() || m.name.toLowerCase().includes(search.toLowerCase())));
  const cartItems = Object.entries(cart).filter(([, e]) => getCartQty(e) > 0);
  const cartCount = cartItems.reduce((s, [, e]) => s + getCartQty(e), 0);
  const subtotal = cartItems.reduce((s, [id, e]) => {
    const item = menu.find((m) => m.id === id);
    return s + getCartLineTotal(e, item);
  }, 0);
  const setQty = (id, q) => {
    setCart(prev => {
      const next = { ...prev };
      if (q <= 0) delete next[id];
      else next[id] = { qty: q };
      return next;
    });
  };
  const inputStyle = { padding: 12, border: `1.5px solid ${COLORS.line}`, borderRadius: 10, fontSize: 14, width: "100%", boxSizing: "border-box", fontFamily: "'Plus Jakarta Sans', sans-serif" };

  // 🔥 Running tables
  const runningTables = useMemo(() => {
    return (orders || [])
      .filter(o => o.orderType === "dine_in" && o.status !== "served" && o.status !== "cancelled")
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [orders]);

  const currentTableRunning = runningTables.find(o => Number(o.table) === Number(table));

  // 🆕 SAVE NEW MENU ITEM TO FIREBASE
  const handleSaveNewItem = async () => {
    if (!newItem.name.trim()) { alert("⚠️ Item name required"); return; }
    if (!newItem.price || Number(newItem.price) <= 0) { alert("⚠️ Valid price required"); return; }

    setIsSavingItem(true);
    try {
      // Naya item banao
      const newDish = mi(
        uid("m"),
        newItem.name.trim(),
        Number(newItem.price),
        newItem.category,
        newItem.veg,
        newItem.desc.trim(),
        newItem.portion.trim(),
        newItem.isBestseller,
        true,
        newItem.image.trim()
      );

      // Menu mein sabse upar add karo
      const updatedMenu = [newDish, ...menu];

      // Firestore mein save karo
      await setDoc(doc(db, "settings", "menu"), { items: updatedMenu });

      // Local state update karo
      if (setMenuState) setMenuState(updatedMenu);

      // Success message
      alert(`✅ "${newDish.name}" added to menu!\n\nAb ise cart mein add kar sakte ho.`);

      // Form reset karo
      setNewItem({
        name: "",
        price: "",
        category: categories[0] || "Thali",
        veg: true,
        portion: "",
        desc: "",
        image: "",
        isBestseller: false
      });
      setShowAddItem(false);

      // Search mein naya item dikhane ke liye
      setSearch(newDish.name);

    } catch (error) {
      console.error("Save new item error:", error);
      alert("❌ Failed to save item. Check internet and try again.");
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleSubmit = async () => {
    if (cartItems.length === 0) return;
    setIsSubmitting(true);
    try {
      const items = cartItems.map(([id, entry]) => {
        const m = menu.find(x => x.id === id);
        return {
          itemId: id,
          name: m.name,
          portion: m.portion || "",
          price: entry.priceOverride ?? m.price,
          qty: getCartQty(entry)
        };
      });
      let created = null;
      try {
      created = await onSubmit({
  table: orderMode === "parcel" ? 0 : table,
  orderType: orderMode,
  items, waiterName,
  customerName: customerName || "Walk-in",
  customerPhone: customerPhone || "",
  notes
});
      } catch (err) {
        console.error(err);
        alert("❌ Order send nahi hua. Internet check karke dobara try karo.");
      }
      if (created) {
        setPlacedOrder(created);
        setCart({});
        setNotes("");
      }
    } catch (e) { console.error(e); }
    finally { setIsSubmitting(false); }
  };

  const handlePrintKOT = (order) => {
    const w = window.open('', '_blank', 'width=300,height=600');
    if (!w) return;
    const totalAmount = getOrderTotal(order);
    w.document.write(`<html><head><title>KOT</title>
      <style>body{font-family:monospace;font-size:13px;padding:12px;width:280px}
      h2,h4{text-align:center;margin:4px 0}
      .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #000}</style></head><body>
      <h2>${escapeHtml(RESTAURANT.name)}</h2>
      <h4>WAITER ORDER — TABLE ${escapeHtml(order.table)}</h4>
      <p>Order: #${escapeHtml(order.id.toUpperCase())}<br/>Waiter: ${escapeHtml(order.waiter || "-")}<br/>Customer: ${escapeHtml(order.customer.name)}</p>
      <div style="margin-top:10px">
        ${order.items.map(it => `<div class="row"><span>${it.qty}x ${escapeHtml(it.name)}</span><span>₹${it.price * it.qty}</span></div>`).join('')}
      </div>
      <div style="text-align:right;font-weight:bold;margin-top:12px;font-size:15px">Total: ₹${totalAmount}</div>
      <p style="text-align:center;margin-top:12px;font-size:11px">— Thank You —</p>
      <script>window.print();setTimeout(()=>window.close(),500)</script></body></html>`);
    w.document.close();
  };
  

  const handleSendOtp = () => {
    if (!custPhone || custPhone.length < 10) { showToast("⚠️ Enter valid phone", 'error'); return; }
    if (!DEMO_OTP) {
      showToast("ℹ️ OTP service abhi connected nahi — naam & phone se order karo", 'info');
      return;
    }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(code);
    setOtpStep("verify");
    showToast(`🔐 Demo OTP: ${code}`, 'success');
  };
    const addComboToCart = useCallback((combo) => {
    try {
      const lines = (combo.items || []).map(it => ({ ...it, quantity: Number(it.quantity) || 1, menuItem: menu.find(m => m.id === it.id) }));
      if (lines.length === 0 || lines.some(l => !l.menuItem || !l.menuItem.available)) { showToast("⚠️ Combo ka koi item available nahi", 'warning'); return; }
      const totalMenuPrice = lines.reduce((s, l) => s + l.menuItem.price * l.quantity, 0);
      const finalPrice = Number(combo.finalPrice);
      if (!(totalMenuPrice > 0) || !Number.isFinite(finalPrice)) { showToast("⚠️ Combo ka price set nahi hai", 'warning'); return; }
      const ratio = finalPrice / totalMenuPrice;
      setCart(prev => {
        const next = { ...prev };
        lines.forEach(l => {
          const prevEntry = next[l.id];
          const prevQty = getCartQty(prevEntry);
          const prevPrice = prevEntry?.priceOverride ?? l.menuItem.price;
          const newQty = prevQty + l.quantity;
          next[l.id] = { qty: newQty, priceOverride: Math.round((prevQty * prevPrice + l.quantity * l.menuItem.price * ratio) / newQty) };
        });
        return next;
      });
      showToast(`🎉 ${combo.name} added!`, 'success');
    } catch (e) {
      console.error("Combo error:", e);
      showToast("⚠️ Combo error: " + (e?.message || e), 'error');
    }
  }, [menu, showToast]);
  const addComboToCartPrev = useCallback((combo) => {
    const lines = combo.items.map(it => ({ ...it, menuItem: menu.find(m => m.id === it.id) }));
    if (lines.some(l => !l.menuItem || !l.menuItem.available)) { showToast("⚠️ Combo ka koi item available nahi", 'warning'); return; }
    const totalMenuPrice = lines.reduce((s, l) => s + l.menuItem.price * l.quantity, 0);
    if (totalMenuPrice <= 0) return;
    const ratio = combo.finalPrice / totalMenuPrice;
    setCart(prev => {
      const next = { ...prev };
      lines.forEach(l => {
        next[l.id] = { qty: getCartQty(next[l.id]) + l.quantity, priceOverride: Math.round(l.menuItem.price * ratio) };
      });
      return next;
    });
    showToast(`🎉 ${combo.name} added!`, 'success');
  }, [menu, showToast]);
  
const KeyboardHelpModal = memo(({ onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', padding: 28, borderRadius: 20, width: '90%', maxWidth: 440 }}>
      <h2 style={{ margin: '0 0 20px' }}>⌨️ Shortcuts</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {Object.entries(STAFF_SHORTCUTS).map(([key, desc]) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: COLORS.paper, borderRadius: 10 }}>
            <kbd style={{ background: COLORS.copper, color: '#fff', padding: '4px 10px', borderRadius: 6, fontWeight: 800, fontSize: 12 }}>{key}</kbd>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{desc}</span>
          </div>
        ))}
      </div>
      <button onClick={onClose} style={{ background: COLORS.copper, color: '#fff', border: 'none', borderRadius: 14, padding: '13px 20px', fontWeight: 800, width: '100%', marginTop: 20, cursor: 'pointer' }}>Close</button>
    </div>
  </div>
));

// ═══════════════════════════════════════════════
// 🧾 BILL + ORDER — ONE SCREEN POS
// ═══════════════════════════════════════════════
function BillPOSScreen(p) {
  const { order, orders, menu, viewMode, items, setItems, calc } = p;
  const [tab, setTab] = useState(order && order.isDraft ? "menu" : "bill");
  const [presets] = usePresets();
  const waiterNames = presets.waiters || [];
  const gstList = [0, ...((presets.gstRates && presets.gstRates.length ? presets.gstRates : [5, 12, 18]).filter((r) => Number(r) > 0))];
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const isDesktop = viewMode === "desktop";
  const isDraft = !!(order && order.isDraft);
  const cats = p.categories && p.categories.length ? p.categories : Array.from(new Set((menu || []).map((m) => m.category)));

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (menu || []).filter((m) => m.available && (cat === "all" || m.category === cat) && (!q || String(m.name).toLowerCase().includes(q)));
  }, [menu, cat, search]);

  const qtyOf = (id) => items.filter((it) => it.itemId === id).reduce((s, it) => s + (it.qty || 0), 0);
  const itemCount = items.reduce((s, it) => s + (it.qty || 0), 0);

  const addItem = (m) => setItems((prev) => {
    const i = prev.findIndex((it) => it.itemId === m.id && it.price === m.price);
    if (i >= 0) return prev.map((it, k) => (k === i ? { ...it, qty: it.qty + 1 } : it));
    return [...prev, { itemId: m.id, name: m.name, portion: m.portion || "", price: m.price, qty: 1, _rowId: Date.now() + "_" + Math.random().toString(36).slice(2, 6) }];
  });
  const changeQty = (rowId, d) => setItems((prev) => prev.flatMap((it) => (it._rowId !== rowId ? [it] : (it.qty + d <= 0 ? [] : [{ ...it, qty: Math.round((it.qty + d) * 100) / 100 }]))));
  const [showNew, setShowNew] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const emptyNew = { name: "", price: "", category: cats[0] || "Thali", veg: true, portion: "" };
  const [newItem, setNewItem] = useState(emptyNew);

  const checkNewItem = () => {
    const name = newItem.name.trim();
    const price = Number(newItem.price);
    if (!name) { alert("⚠️ Item ka naam daalo"); return null; }
    if (!Number.isFinite(price) || price <= 0) { alert("⚠️ Sahi rate daalo"); return null; }
    return { name, price };
  };

  // Sirf is bill me (menu me save nahi hota)
  const addCustomOnly = () => {
    const v = checkNewItem();
    if (!v) return;
    setItems((prev) => [...prev, { itemId: uid("c"), name: v.name, portion: newItem.portion.trim(), price: v.price, qty: 1, _rowId: Date.now() + "_" + Math.random().toString(36).slice(2, 6) }]);
    setNewItem(emptyNew);
    setShowNew(false);
  };

  // Menu me hamesha ke liye save + bill me add
  const saveNewItem = async () => {
    const v = checkNewItem();
    if (!v || savingItem) return;
    setSavingItem(true);
    try {
      const dish = mi(uid("m"), v.name, v.price, newItem.category || cats[0] || "Thali", newItem.veg, "", newItem.portion.trim(), false, true, "");
      const updatedMenu = [dish, ...(menu || [])];
      await setDoc(doc(db, "settings", "menu"), { items: updatedMenu });
      if (p.setMenuState) p.setMenuState(updatedMenu);
      addItem(dish);
      setNewItem(emptyNew);
      setShowNew(false);
    } catch (e) {
      console.error("Save new item error:", e);
      alert("❌ Item save nahi hua. Internet check karke dobara try karo.");
    } finally {
      setSavingItem(false);
    }
  };

  const commitQty = (rowId, raw) => {
    const v = parseFloat(String(raw).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return false;
    setItems((prev) => prev.map((it) => (it._rowId === rowId ? { ...it, qty: Math.round(v * 100) / 100 } : it)));
    return true;
  };
  const commitPrice = (rowId, raw) => {
    const v = parseFloat(String(raw).replace(",", "."));
    if (!Number.isFinite(v) || v < 0) return false;
    setItems((prev) => prev.map((it) => (it._rowId === rowId ? { ...it, price: Math.round(v * 100) / 100 } : it)));
    return true;
  };
  const removeRow = (rowId) => setItems((prev) => prev.filter((it) => it._rowId !== rowId));

  const clash = isDraft && p.orderType === "dine_in"
    ? (orders || []).find((o) => o.orderType === "dine_in" && o.status !== "served" && o.status !== "cancelled" && Number(o.table) === Number(p.table))
    : null;

  const inp = { padding: "7px 9px", border: `1.5px solid ${COLORS.line}`, borderRadius: 8, fontSize: 13, width: "100%", boxSizing: "border-box", fontFamily: "inherit" };
  const chip = (on, color = COLORS.copper) => ({ padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${on ? color : COLORS.line}`, background: on ? color : "#fff", color: on ? "#fff" : COLORS.text, fontWeight: 800, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" });
  const lbl = { fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: COLORS.textLight, minWidth: 34 };
  const disabled = p.saving || items.length === 0;
  const footBtn = (bg, color, border) => ({ flex: 1, padding: "12px 6px", borderRadius: 10, border: border || "none", background: disabled ? COLORS.paper2 : bg, color: disabled ? COLORS.textLight : color, fontWeight: 800, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit" });
  const actBtn = (bg, color, border) => ({ display: "none", flex: 1, padding: "11px 6px", borderRadius: 10, border: border || "none", background: disabled ? COLORS.paper2 : bg, color: disabled ? COLORS.textLight : color, fontWeight: 800, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit" });
  const qtyBtn = { width: 24, height: 24, border: "none", background: "transparent", color: COLORS.sage, fontSize: 16, fontWeight: 800, cursor: "pointer", padding: 0 };

  const menuPane = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, height: "100%" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input placeholder="🔍 Item search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inp, flex: 1, width: "auto" }} />
        <button type="button" onClick={() => setShowNew(true)} style={{ ...chip(true, COLORS.sage), padding: "7px 12px" }}>➕ New Item</button>
      </div>
      {showNew && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 260, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }} onClick={() => setShowNew(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 16, width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800 }}>➕ Naya Item</div>
            <input autoFocus placeholder="Item ka naam *" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} style={inp} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <input type="number" inputMode="decimal" placeholder="Rate ₹ *" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} style={inp} />
              <input placeholder="Portion (Half/Full)" value={newItem.portion} onChange={(e) => setNewItem({ ...newItem, portion: e.target.value })} style={inp} />
            </div>
            <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} style={{ ...inp, background: "#fff" }}>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => setNewItem({ ...newItem, veg: true })} style={{ ...chip(newItem.veg, COLORS.sage), flex: 1 }}>🟢 Veg</button>
              <button type="button" onClick={() => setNewItem({ ...newItem, veg: false })} style={{ ...chip(!newItem.veg, COLORS.rust), flex: 1 }}>🔴 Non-Veg</button>
            </div>
            <button type="button" disabled={savingItem} onClick={saveNewItem} style={{ padding: 12, borderRadius: 10, border: "none", background: savingItem ? COLORS.paper2 : COLORS.sage, color: savingItem ? COLORS.textLight : "#fff", fontWeight: 800, fontSize: 14, cursor: savingItem ? "wait" : "pointer" }}>
              {savingItem ? "⏳ Saving..." : "💾 Menu me save + bill me add"}
            </button>
            <button type="button" onClick={addCustomOnly} style={{ padding: 11, borderRadius: 10, border: `2px solid ${COLORS.info}`, background: "transparent", color: COLORS.info, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
              ➕ Sirf is bill me (menu me save nahi)
            </button>
            <button type="button" onClick={() => setShowNew(false)} style={{ padding: 8, border: "none", background: "transparent", color: COLORS.textLight, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, flexShrink: 0 }}>
        {["all", ...cats].map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} style={chip(cat === c, COLORS.ink)}>{c === "all" ? "All" : c}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(170px, 1fr))" : "repeat(2, 1fr)", gap: 6, alignContent: "start" }}>
        {list.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 20, color: COLORS.textLight, fontSize: 12 }}>Koi item nahi mila</div>}
        {list.map((m) => {
          const q = qtyOf(m.id);
          return (
            <button key={m.id} type="button" onClick={() => addItem(m)} style={{ textAlign: "left", padding: "6px 8px", borderRadius: 8, border: `1.5px solid ${q > 0 ? COLORS.sage : COLORS.line}`, background: q > 0 ? COLORS.sageLight : "#fff", cursor: "pointer", position: "relative", fontFamily: "inherit", minHeight: 52 }}>
              <div style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
                <VegDot veg={m.veg} />
                <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2, color: COLORS.ink, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.name}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.copper, marginTop: 3 }}>
                ₹{m.price}{m.portion ? <span style={{ color: COLORS.textLight, fontWeight: 600 }}> · {m.portion}</span> : null}
              </div>
              {q > 0 && <span style={{ position: "absolute", top: 4, right: 4, background: COLORS.sage, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>{q}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  const billPane = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, height: "100%", overflowY: isDesktop ? "auto" : "visible" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {isDraft ? (
          <>
            <button type="button" onClick={() => p.setOrderType("dine_in")} style={chip(p.orderType === "dine_in")}>🍽️ Table</button>
            <button type="button" onClick={() => p.setOrderType("parcel")} style={chip(p.orderType === "parcel")}>🛍️ Parcel</button>
            {p.orderType === "dine_in" && (
              <select value={p.table} onChange={(e) => p.setTable(Number(e.target.value))} style={{ ...inp, width: 84 }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>T-{n}</option>)}
              </select>
            )}
            <select value={p.waiter} onChange={(e) => p.setWaiter(e.target.value)} style={{ ...inp, flex: 1, minWidth: 90, width: "auto", background: "#fff" }}>
              <option value="">🧑‍🍳 Waiter chuno</option>
              {p.waiter && !waiterNames.includes(p.waiter) && <option value={p.waiter}>{p.waiter}</option>}
              {waiterNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </>
        ) : (
          <div style={{ fontWeight: 800, fontSize: 13 }}>
            {order.orderType === "parcel" ? "🛍️ Parcel" : `🍽️ Table ${order.table}`} · #{order.id.slice(1, 9).toUpperCase()}{order.waiter ? ` · 🧑‍🍳 ${order.waiter}` : ""}
          </div>
        )}
      </div>

      {clash && (
        <div style={{ background: "#FFF3E0", border: `1.5px solid ${COLORS.warning}`, borderRadius: 8, padding: "6px 8px", fontSize: 12, fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span>⚠️ Table {p.table} pe order #{clash.id.slice(1, 5).toUpperCase()} pehle se chal raha hai</span>
          <button type="button" onClick={() => p.onOpenOrder(clash)} style={chip(true, COLORS.info)}>Wahi kholo</button>
        </div>
      )}

      {(presets.customers || []).length > 0 && (
        <select value="" onChange={(e) => { const c = (presets.customers || [])[Number(e.target.value)]; if (c) { p.setCustName(c.name); p.setCustPhone(c.phone || ""); } }} style={{ ...inp, background: "#fff" }}>
          <option value="">👤 Saved customer chuno...</option>
          {(presets.customers || []).map((c, i) => <option key={i} value={i}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
        </select>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 6 }}>
        <input placeholder="Customer" value={p.custName} onChange={(e) => p.setCustName(e.target.value)} style={inp} />
        <input placeholder="Phone" value={p.custPhone} onChange={(e) => p.setCustPhone(e.target.value)} style={inp} />
        <input placeholder="GSTIN" value={p.gstin} onChange={(e) => p.setGstin(e.target.value.toUpperCase())} style={inp} />
      </div>

      <div style={{ flex: 1, minHeight: 80, overflowY: "auto", border: `1px solid ${COLORS.line}`, borderRadius: 10, background: "#fff" }}>
        {items.length === 0 && <div style={{ textAlign: "center", padding: 16, color: COLORS.textLight, fontSize: 12 }}>Menu se item tap karo ➕</div>}
        {items.map((it) => (
          <div key={it._rowId} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderBottom: `1px solid ${COLORS.line}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}{it.portion ? ` (${it.portion})` : ""}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <span style={{ fontSize: 10, color: COLORS.textLight }}>Rate ₹</span>
                <input key={it._rowId + "_p_" + it.price} type="number" inputMode="decimal" min={0} step="any" defaultValue={it.price}
                  onBlur={(e) => { if (!commitPrice(it._rowId, e.target.value)) e.target.value = it.price; }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                  style={{ width: 62, padding: "2px 4px", border: `1px solid ${COLORS.line}`, borderRadius: 6, fontSize: 12, fontWeight: 700 }} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${COLORS.sage}`, borderRadius: 8 }}>
              <button type="button" onClick={() => changeQty(it._rowId, -1)} style={qtyBtn}>−</button>
              <input key={it._rowId + "_q_" + it.qty} type="number" inputMode="decimal" min={0} step="any" defaultValue={it.qty}
                onBlur={(e) => { if (!commitQty(it._rowId, e.target.value)) e.target.value = it.qty; }}
                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                style={{ width: 46, textAlign: "center", border: "none", background: "transparent", fontWeight: 800, fontSize: 12 }} />
              <button type="button" onClick={() => changeQty(it._rowId, 1)} style={qtyBtn}>+</button>
            </div>
            <div style={{ width: 52, textAlign: "right", fontWeight: 800, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>₹{Math.round(it.price * it.qty * 100) / 100}</div>
            <button type="button" onClick={() => removeRow(it._rowId)} style={{ background: "transparent", border: `1.5px solid ${COLORS.error}`, color: COLORS.error, width: 24, height: 24, borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 800, padding: 0 }}>✕</button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={lbl}>GST</span>
        {gstList.map((r) => (
          <button key={r} type="button" onClick={() => p.setGstRate(r)} style={chip(p.gstRate === r)}>{r === 0 ? "No" : r + "%"}</button>
        ))}
        <button type="button" onClick={() => p.setGstRate("custom")} style={chip(p.gstRate === "custom")}>Custom</button>
        {p.gstRate === "custom" && <input type="number" placeholder="%" value={p.gstCustom} onChange={(e) => p.setGstCustom(e.target.value)} style={{ ...inp, width: 60 }} />}
        <span style={{ ...lbl, marginLeft: 6 }}>Disc</span>
        {(presets.discounts || []).map((d) => (
          <button key={d} type="button" onClick={() => p.setDiscPct(p.discPct === d ? 0 : d)} style={chip(p.discPct === d, COLORS.success)}>{d}%</button>
        ))}
        <input type="number" min={0} max={100} placeholder="%" value={p.discPct || ""} onChange={(e) => p.setDiscPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} style={{ ...inp, width: 56 }} />
        <input type="number" min={0} placeholder="₹" value={p.disc || ""} onChange={(e) => p.setDisc(Math.max(0, Number(e.target.value) || 0))} style={{ ...inp, width: 64 }} />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={lbl}>Pay</span>
        {[["cash", "💵 Cash"], ["upi", "📱 UPI"], ["card", "💳 Card"], ["razorpay", "⚡ Razorpay"], ["due", "⏳ Due"]].map(([id, label]) => (
          <button key={id} type="button" onClick={() => p.setPayMode(id)} style={chip(p.payMode === id)}>{label}</button>
        ))}
        <button type="button" onClick={() => p.setPayStatus(p.payStatus === "paid" ? "pending" : "paid")} style={chip(true, p.payStatus === "paid" ? COLORS.success : COLORS.warning)}>
          {p.payStatus === "paid" ? "✓ Paid" : "⏳ Pending"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 4 }}>
          {(presets.notes || []).length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(presets.notes || []).map((n) => (
                <button key={n} type="button" onClick={() => p.setNotes(p.notes ? p.notes + ", " + n : n)} style={{ ...chip(false), padding: "3px 8px", fontSize: 11 }}>+ {n}</button>
              ))}
            </div>
          )}
          <input placeholder="Notes..." value={p.notes} onChange={(e) => p.setNotes(e.target.value)} style={inp} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <input type="checkbox" checked={p.showBillNo} onChange={(e) => p.setShowBillNo(e.target.checked)} /> Bill #
        </label>
        {isDraft && (
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <input type="checkbox" checked={p.sendKot} onChange={(e) => p.setSendKot(e.target.checked)} /> 🍳 Kitchen ko bhejo
          </label>
        )}
      </div>

      <div style={{ background: COLORS.paper, borderRadius: 10, padding: "8px 10px", fontSize: 12, border: `1.5px solid ${COLORS.gold}` }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal ({itemCount} items)</span><b>₹{calc.sub}</b></div>
        {p.discPct > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.success }}><span>Discount {p.discPct}%</span><b>-₹{calc.discPctAmt}</b></div>}
        {p.disc > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.success }}><span>Extra discount</span><b>-₹{calc.discAmt}</b></div>}
        {calc.gstRate > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.copper }}><span>GST {calc.gstRate}%</span><b>+₹{calc.gst}</b></div>}
        {calc.delivery > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.copper }}><span>Delivery</span><b>+₹{calc.delivery}</b></div>}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, borderTop: `2px solid ${COLORS.ink}`, paddingTop: 5, marginTop: 4 }}>
          <span>TOTAL</span><span style={{ color: COLORS.copper, fontFamily: "'JetBrains Mono', monospace" }}>₹{calc.total}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" disabled={disabled} onClick={() => p.onAction("save")} style={actBtn("transparent", COLORS.sage, `2px solid ${COLORS.sage}`)}>
          {p.saving ? "⏳..." : (isDraft && p.sendKot ? "🍳 KOT Bhejo" : "💾 Save")}
        </button>
        <button type="button" disabled={disabled} onClick={() => p.onAction("print")} style={actBtn(COLORS.info, "#fff")}>🖨️ Save & Print</button>
        <button type="button" disabled={disabled} onClick={() => p.onAction("paid")} style={actBtn(COLORS.sage, "#fff")}>✓ Paid & Print</button>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: isDesktop ? "center" : "flex-end", justifyContent: "center" }} onClick={p.onClose}>
      <div onClick={(e) => e.stopPropagation()} className="slide-up"
        style={{ background: "#fff", width: isDesktop ? "min(1200px, 97vw)" : "100%", maxWidth: isDesktop ? 1200 : 560, height: isDesktop ? "92vh" : "96vh", borderRadius: isDesktop ? 18 : "20px 20px 0 0", padding: 12, display: "flex", flexDirection: "column", boxSizing: "border-box", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800 }}>🧾 {isDraft ? "New Order + Bill" : "Order Bill"}</div>
          <button type="button" onClick={p.onClose} style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "50%", width: 30, height: 30, fontSize: 14, cursor: "pointer" }}>✕</button>
        </div>

        {(isDesktop || tab === "bill") && (
          <div style={{ order: 99, display: "flex", gap: 6, alignItems: "center", flexShrink: 0, paddingTop: 8, borderTop: `1px solid ${COLORS.line}` }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.copper, fontFamily: "'JetBrains Mono', monospace", minWidth: 70 }}>₹{calc.total}</div>
            <button type="button" disabled={disabled} onClick={() => p.onAction("save")} style={footBtn("transparent", COLORS.sage, `2px solid ${COLORS.sage}`)}>
              {p.saving ? "⏳..." : (isDraft && p.sendKot ? "🍳 KOT" : "💾 Save")}
            </button>
            <button type="button" disabled={disabled} onClick={() => p.onAction("print")} style={footBtn(COLORS.info, "#fff")}>🖨️ Print</button>
            <button type="button" disabled={disabled} onClick={() => p.onAction("paid")} style={footBtn(COLORS.sage, "#fff")}>✓ Paid + Print</button>
          </div>
        )}

        {isDesktop ? (
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gridTemplateRows: "minmax(0, 1fr)", gap: 14, flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div style={{ minHeight: 0, height: "100%", overflow: "hidden" }}>{menuPane}</div>
            <div style={{ minHeight: 0, height: "100%", overflow: "hidden" }}>{billPane}</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => setTab("menu")} style={{ ...chip(tab === "menu", COLORS.ink), flex: 1, padding: "8px 6px" }}>🍽️ Menu</button>
              <button type="button" onClick={() => setTab("bill")} style={{ ...chip(tab === "bill", COLORS.ink), flex: 1, padding: "8px 6px" }}>🧾 Bill ({itemCount}) · ₹{calc.total}</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: tab === "bill" ? "auto" : "hidden" }}>
              {tab === "menu" ? menuPane : billPane}
            </div>
            {tab === "menu" && (
              <button type="button" onClick={() => setTab("bill")} style={{ padding: 12, borderRadius: 12, border: "none", background: COLORS.sage, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
                <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span><span>Bill dekho ₹{calc.total} ➔</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StaffView({ menu = [], orders, advanceStatus, requestPinPrompt, calls, resolveCall, cancelOrderByStaff, placeOrder, categories = [], setMenuState }) {
  const active = orders.filter((o) => o.status !== "served" && o.status !== "cancelled").sort((a, b) => a.createdAt - b.createdAt);
  const activeCalls = calls.filter(c => c.status === 'active');
  const columns = ["new", "preparing", "ready"];
  const newOrderCount = active.filter(o => o.status === "new").length;
  const prevCountRef = useRef(newOrderCount);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [viewMode] = useViewMode();
  const [colTab, setColTab] = useState("new");
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [billOrder, setBillOrder] = useState(null);
  const [billEditItems, setBillEditItems] = useState([]);
  const [billGstRate, setBillGstRate] = useState(0);
  const [billGstCustom, setBillGstCustom] = useState("");
  const [billDiscount, setBillDiscount] = useState(0);
  const [billDiscountPct, setBillDiscountPct] = useState(0);
  const [billPayMode, setBillPayMode] = useState("cash");
  const [billPayStatus, setBillPayStatus] = useState("paid");
  const [billCustomerName, setBillCustomerName] = useState("");
  const [billCustomerPhone, setBillCustomerPhone] = useState("");
  const [billCustomerGstin, setBillCustomerGstin] = useState("");
  const [billNotes, setBillNotes] = useState("");
  const [billSearch, setBillSearch] = useState("");
  const [billAddItemOpen, setBillAddItemOpen] = useState(false);
  const [billShowBillNo, setBillShowBillNo] = useState(true);
  const [billTable, setBillTable] = useState(1);
  const [billOrderType, setBillOrderType] = useState("dine_in");
  const [billWaiter, setBillWaiter] = useState("");
  const [billSendKot, setBillSendKot] = useState(true);
  const [billSaving, setBillSaving] = useState(false);

  useEffect(() => {
    if (newOrderCount > prevCountRef.current) {
      playNotificationSound();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🛎️ New Order!', { body: `${newOrderCount} new waiting` });
      }
    }
    prevCountRef.current = newOrderCount;
  }, [newOrderCount]);

  const prevCallsRef = useRef(activeCalls.length);
  useEffect(() => {
    if (activeCalls.length > prevCallsRef.current) {
      const bell = new Audio("https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3");
      bell.play().catch(() => { });
    }
    prevCallsRef.current = activeCalls.length;
  }, [activeCalls.length]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) return;
      if (billOrder) return;
      if (e.key === 'k' && e.ctrlKey) { e.preventDefault(); if (active[0]) setSelectedOrderId(active[0].id); }
      if (e.key === 'ArrowUp') { const i = active.findIndex(o => o.id === selectedOrderId); if (i > 0) setSelectedOrderId(active[i - 1].id); }
      if (e.key === 'ArrowDown') { const i = active.findIndex(o => o.id === selectedOrderId); if (i < active.length - 1 && i >= 0) setSelectedOrderId(active[i + 1].id); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && selectedOrderId) { const o = active.find(x => x.id === selectedOrderId); if (o) { e.preventDefault(); advanceStatus(o.id, o.status); } }
      if ((e.key === '?' || e.key === '/') && e.shiftKey) { e.preventDefault(); setShowHelpModal(v => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedOrderId, active, advanceStatus, billOrder]);

  const handlePrintReceipt = (order) => {
    const w = window.open('', '_blank', 'width=300,height=600');
    if (!w) return;
    const kots = order.kots?.length ? order.kots : [{ kotNumber: 1, items: order.items }];
    const itemsHtml = kots.map(kot => `<div style="margin-top:10px;border-top:1px dashed #000;padding-top:6px"><strong>KOT #${kot.kotNumber}${kot.isRunning ? ' (RUNNING)' : ''}</strong>${kot.items.map(it => `<div>${it.qty}x ${escapeHtml(it.name)}</div>`).join('')}</div>`).join('');
    const totalAmount = getOrderTotal(order);
    w.document.write(`<html><head><title>KOT</title><style>body{font-family:monospace;font-size:12px;padding:10px;width:260px}h2,h4{text-align:center;margin:4px 0}</style></head><body><h2>${escapeHtml(RESTAURANT.name)}</h2><h4>${order.orderType === 'parcel' ? 'PARCEL' : `TABLE ${escapeHtml(order.table)}`}</h4><p>Order: #${escapeHtml(order.id.toUpperCase())}<br/>Customer: ${escapeHtml(order.customer.name)}</p>${itemsHtml}<div style="text-align:right;font-weight:bold;margin-top:10px">Total: ₹${totalAmount}</div><script>window.print();setTimeout(()=>window.close(),500)</script></body></html>`);
    w.document.close();
  };
  
  const bookEvent = async (booking) => { await setDoc(doc(db, "bookings", booking.id), booking); };

  const cancelOrderByStaff = async (orderId) => {
    try { await updateDoc(doc(db, "orders", orderId), { status: "cancelled", cancelledAt: Date.now(), cancelledBy: "staff" }); } catch (e) { console.error(e); }
  };

  if (loading) {
    return (<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.paper, fontWeight: 700, fontSize: 18, color: COLORS.copper }}>🍽️ Loading Eat & Park POS...</div>);
  }

  return (
    <ErrorBoundary>
      <div className={isDark ? "dark-theme" : ""} style={{ minHeight: "100vh", background: "var(--bg-color, #FAFAF8)", color: COLORS.ink, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <style>{FONTS}</style>
        <div className="app-content">
  
  
  {role === "customer" && <ErrorBoundary key="cust"><CustomerView menu={menu} orders={orders} placeOrder={placeOrder} bookEvent={bookEvent} gallery={gallery} offersList={offersList} table={table} setTable={setTable} requestPinPrompt={requestPinPrompt} settings={settings} isDark={isDark} setIsDark={setIsDark} requestWaiter={requestWaiter} loyaltyRules={loyaltyRules} loyaltyUsers={loyaltyUsers} coinHistory={coinHistory} setOrdersState={setOrdersState} categories={categories} flashSaleItems={validFlashSaleItems} comboOffers={validComboOffers} setMenuState={setMenuState} setLoyaltyRules={saveLoyaltyRules} /></ErrorBoundary>}
  
  {role === "staff" && <ErrorBoundary key="staff"><StaffView menu={menu} orders={orders} placeOrder={placeOrder} categories={categories} setMenuState={setMenuState} advanceStatus={advanceStatus} requestPinPrompt={requestPinPrompt} calls={calls} resolveCall={resolveCall} cancelOrderByStaff={cancelOrderByStaff} /></ErrorBoundary>}
  
  {role === "admin" && <ErrorBoundary key="admin"><AdminView menu={menu} setMenuState={setMenuState} bookings={bookings} orders={orders} markPaid={markPaid} requestPinPrompt={requestPinPrompt} inventory={inventory} addInventory={addInventory} updateStock={updateStock} deleteBooking={deleteBooking} offersList={offersList} addOffer={addOffer} removeOffer={removeOffer} loyaltyRules={loyaltyRules} setLoyaltyRules={saveLoyaltyRules} loyaltyUsers={loyaltyUsers} settings={settings} setSettings={setSettings} gallery={gallery} setGallery={setGallery} categories={categories} updateCategories={updateCategories} flashSaleItems={flashSaleItems} setFlashSaleItems={setFlashSaleItems} comboOffers={comboOffers} setComboOffers={setComboOffers} savePromotions={savePromotions} /></ErrorBoundary>}
  
  {/* 🆕 FALLBACK — agar role match nahi hua toh */}
  {!["customer", "staff", "admin"].includes(role) && (
    <div style={{ padding: 40, textAlign: "center", minHeight: "100vh" }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>⚠️</div>
      <h2 style={{ fontSize: 24, marginBottom: 12 }}>Role Error</h2>
      <p style={{ fontSize: 14, color: "#8A8375", marginBottom: 20 }}>
        Current role: <strong style={{ color: "#E25938" }}>{String(role)}</strong>
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={() => setRole("customer")} style={{ padding: "12px 24px", borderRadius: 12, background: "#E25938", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>
          Customer View
        </button>
        <button onClick={() => setRole("staff")} style={{ padding: "12px 24px", borderRadius: 12, background: "#4A7C59", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>
          Staff View
        </button>
        <button onClick={() => setRole("admin")} style={{ padding: "12px 24px", borderRadius: 12, background: "#1A1A1A", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>
          Admin View
        </button>
      </div>
    </div>
  )}
</div>
        {showPinModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowPinModal(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", padding: "28px", borderRadius: 20, width: "90%", maxWidth: 340, textAlign: "center" }} className="slide-up">
              <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
              <h3 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700 }}>PIN ({targetRole.toUpperCase()})</h3>
              <input type="password" placeholder="••••" autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handlePinSubmit(); }} style={{ padding: "16px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 32, width: "100%", boxSizing: "border-box", textAlign: "center", letterSpacing: 12, marginBottom: 24, fontWeight: 800 }} />
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => { setShowPinModal(false); setPinInput(""); }} style={{ flex: 1, padding: "14px", borderRadius: 12, border: `2px solid ${COLORS.line}`, background: "transparent", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={handlePinSubmit} style={{ flex: 1, padding: "14px", borderRadius: 12, background: COLORS.ink, color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>Login</button>
              </div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 16 }}></div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
