import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { db } from "./firebase";
import {
  collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc,
  getDocs, getDoc, addDoc, query, orderBy, serverTimestamp, where
} from "firebase/firestore";
import { QRCodeSVG } from 'qrcode.react';

/* ═══════════════════════════════════════════════════════════════════════════════════
   🍽️ EAT & PARK RESTAURANT — FINAL V15 (Waiter Mode · Running Items · KOT · Touch Kitchen)
   ═══════════════════════════════════════════════════════════════════════════════════ */

// ============================================
// 1. CONSTANTS & CONFIGURATION
// ============================================

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
  phones: ["7303267750", "8271918062"], whatsapp: "917303267750", upiId: "apnanumber@upi"
};

const GOOGLE_PLACE_ID = "ChIJc8jv-j9fjTkRYFQLM7KK1aA";
const GOOGLE_REVIEW_URL = `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`;

const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY || "YOUR_RAZORPAY_KEY_ID";
const PHONEPE_MERCHANT_ID = process.env.REACT_APP_PHONEPE_MERCHANT_ID || "YOUR_MERCHANT_ID";

const CATEGORIES = [
  "Drinks", "Fun Food", "Chinese Starter", "Mughlai", "Tandoori",
  "Soup", "Indian Bread", "Snacks", "Chinese Mains", "Pulao",
  "Paneer & Mushroom", "Chicken, Mutton, Fish & Egg", "Biryani & Thali",
  "Aloo, Dal & Sides", "Momo", "Tea & Coffee",
];

const VEG = COLORS.sage; const NONVEG = COLORS.rust;

// ============================================
// 2. LOYALTY SYSTEM
// ============================================

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

// ============================================
// 3. UTILITY FUNCTIONS
// ============================================

function inr(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 8); }
function timeAgo(ts) { const s = Math.floor((Date.now() - ts)/1000); if (s < 60) return s + "s ago"; const m = Math.floor(s/60); if (m < 60) return m + "m ago"; return Math.floor(m/60) + "h ago"; }
function toLocalISODate(timestamp) { const d = new Date(timestamp); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; }

function getEstimatedTime(items) {
  if (!items || items.length === 0) return 5;
  const maxTime = Math.max(...items.map(it => { const item = DEFAULT_MENU.find(m => m.id === it.itemId); return PREP_TIME_ESTIMATES[item?.category || "Fun Food"] || 15; }));
  return maxTime + 2;
}

function getOrderProgress(status) { const map = { new: 15, preparing: 50, ready: 85, served: 100 }; return map[status] || 0; }

function getSmartSuggestionPool(menu, cart) {
  const hour = new Date().getHours();
  let pool = [];
  if (hour < 11) pool = menu.filter(m => m.category.includes("Tea") || m.category.includes("Bread"));
  else if (hour < 13) pool = menu.filter(m => m.category.includes("Biryani") || m.category.includes("Pulao"));
  else if (hour < 17) pool = menu.filter(m => m.category.includes("Snacks") || m.category.includes("Drinks"));
  else pool = menu.filter(m => m.category.includes("Tandoori") || m.category.includes("Mains"));
  return pool.filter(m => m.available && !cart[m.id]);
}

const PREP_TIME_ESTIMATES = { "Drinks": 3, "Fun Food": 10, "Chinese Starter": 12, "Tandoori": 20, "Biryani & Thali": 25 };

const STATUS_FLOW = ["new", "preparing", "ready", "served"];
const STATUS_LABEL = { new: "New", preparing: "Preparing", ready: "Ready", served: "Served" };
const STATUS_COLOR = { new: COLORS.rust, preparing: COLORS.copper, ready: COLORS.sage, served: "#8A8375" };

const TOAST_CONFIG = {
  success: { duration: 2200, bg: COLORS.success, icon: "✅" },
  error: { duration: 4500, bg: COLORS.error, icon: "❌" },
  info: { duration: 3000, bg: COLORS.ink, icon: "ℹ️" },
  reward: { duration: 5000, bg: COLORS.gold, icon: "🎁" },
  warning: { duration: 4000, bg: COLORS.warning, icon: "⚠️" },
  order: { duration: 6000, bg: COLORS.copper, icon: "🛎️" },
};

const EMPTY_STATES = {
  veg_filtered: { icon: "🥬", title: "No vegetarian options here", subtitle: "Try 'All Items' or check our Paneer & Mushroom section!" },
  search_no_results: { icon: "🔍", title: "Dish not found", subtitle: "Try searching 'paneer', 'chicken', 'biryani', or 'tandoori'" },
  category_empty: { icon: "📂", title: "This category is empty", subtitle: "Check out our bestsellers in Fun Food or Tandoori!" },
};

// ============================================
// 4. REUSABLE COMPONENTS
// ============================================

const ErrorBoundary = React.memo(({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleError = (event) => {
      console.error('Uncaught error:', event.error);
      setHasError(true);
      setError(event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>😅</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.ink, marginBottom: '0.5rem' }}>Something went wrong</h2>
        <p style={{ color: COLORS.textLight, marginBottom: '1rem' }}>Please try refreshing the page</p>
        <button onClick={() => window.location.reload()} style={{ background: COLORS.copper, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>Refresh Page</button>
      </div>
    );
  }
  return children;
});

const VegDot = memo(({ veg }) => {
  const c = veg ? VEG : NONVEG;
  return <span role="img" aria-label={veg ? "Vegetarian item" : "Non-vegetarian item"} title={veg ? "Vegetarian" : "Non-vegetarian"} style={{ width: 14, height: 14, border: `1.5px solid ${c}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} /></span>;
});

const Badge = memo(({ children, color }) => (
  <span style={{ background: color, color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 999, fontWeight: 700, display: "inline-block" }}>{children}</span>
));

const Stepper = memo(({ qty, onChange }) => {
  const btnStyle = { width: 28, height: 28, borderRadius: "50%", border: `1.5px solid ${COLORS.copper}`, background: "transparent", color: COLORS.copper, fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" };
  return <div style={{ display: "flex", alignItems: "center", gap: 10 }}><button onClick={() => onChange(Math.max(0, qty - 1))} style={btnStyle} className="smooth-transition" aria-label="Decrease quantity">−</button><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, minWidth: 16, textAlign: "center", fontSize: 15 }}>{qty}</span><button onClick={() => onChange(qty + 1)} style={btnStyle} className="smooth-transition" aria-label="Increase quantity">+</button></div>;
});

const AddBtnStepper = memo(({ qty, onChange, available }) => {
  if (!available) return <div style={{ color: COLORS.rust, background: COLORS.paper2, borderRadius: 8, fontWeight: 700, fontSize: 11, padding: "6px 10px", textAlign: "center", width: 80, boxSizing: "border-box" }}>Out of stock</div>;
  if (!qty) return <button onClick={() => onChange(1)} aria-label="Add item to cart" style={{ color: COLORS.sage, background: "#fff", border: `2px solid ${COLORS.sage}`, borderRadius: 8, fontWeight: 800, fontSize: 12, padding: "6px 16px", cursor: "pointer", width: 80, boxShadow: "0 4px 12px rgba(74,124,89,0.15)" }} className="smooth-transition hover-lift scale-bounce">ADD</button>;
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: 80, padding: "4px", background: "#fff", border: `2px solid ${COLORS.sage}`, borderRadius: 8, boxShadow: "0 4px 12px rgba(74,124,89,0.15)" }}><button onClick={() => onChange(Math.max(0, qty - 1))} aria-label="Decrease quantity" style={{ width: 22, height: 22, border: "none", color: COLORS.sage, background: "transparent", fontSize: 18, cursor: "pointer" }}>−</button><span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 14, color: COLORS.sage }}>{qty}</span><button onClick={() => onChange(qty + 1)} aria-label="Increase quantity" style={{ width: 22, height: 22, border: "none", color: COLORS.sage, background: "transparent", fontSize: 18, cursor: "pointer" }}>+</button></div>;
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
      <input type="text" value={localValue} onChange={handleChange} placeholder={placeholder} className="keep-color" aria-label="Search menu items"
        style={{ padding: "12px 16px 12px 42px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", width: "100%", boxSizing: "border-box", background: "#fff", color: COLORS.ink }} />
      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: COLORS.textLight }}>🔍</span>
      {localValue && (<button onClick={() => { setLocalValue(""); onChange(""); }} aria-label="Clear search" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: COLORS.textLight, padding: "4px 8px" }}>✕</button>)}
    </div>
  );
});

const SlideButton = memo(({ onComplete, text, bg = COLORS.sage }) => {
  const [val, setVal] = useState(0);
  return (
    <div style={{ position: 'relative', width: '100%', height: 48, background: COLORS.paper2, borderRadius: 14, overflow: 'hidden', border: `1px solid ${COLORS.line}` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${val}%`, background: bg, transition: val === 0 ? 'width 0.3s' : 'none' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: val > 50 ? '#fff' : COLORS.text, pointerEvents: 'none', zIndex: 2 }}>
        {text} <span style={{ marginLeft: 8, fontSize: 18 }}>»</span>
      </div>
      <input type="range" min="0" max="100" value={val} onChange={(e) => setVal(Number(e.target.value))} onMouseUp={() => { if (val > 85) onComplete(); setVal(0); }} onTouchEnd={() => { if (val > 85) onComplete(); setVal(0); }} aria-label={text} style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute', top: 0, left: 0, zIndex: 3 }} />
    </div>
  );
});

const Toast = memo(({ message, type = 'info' }) => {
  const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
  return (
    <div className="toast-anim" role="status" aria-live="polite" style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', background: config.bg, color: '#fff', padding: '16px 28px', borderRadius: 30, boxShadow: `0 12px 28px ${config.bg}66`, zIndex: 100, fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>
      <span style={{ fontSize: 18 }}>{config.icon}</span>
      <span>{message}</span>
    </div>
  );
});

const ModalHeader = memo(({ title, onClose }) => (
  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 16 }}>
    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 700 }}>{title}</div>
    <button onClick={onClose} aria-label="Close" style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>✕</button>
  </div>
));

const StatCard = memo(({ label, value, icon, color }) => (
  <div style={{ background: "#fff", border: `1.5px solid ${COLORS.line}`, borderRadius: 18, padding: "24px 20px", transition: "all 0.3s ease", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }} className="smooth-transition hover-lift">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}><div style={{ fontSize: 13, color: COLORS.textLight, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em" }}>{label}</div><span style={{ fontSize: 28 }}>{icon}</span></div>
    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, color: color }}>{value}</div>
  </div>
));

const SidebarBtn = memo(({ icon, text, onClick, highlight }) => (
  <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderRadius: 14, background: highlight ? COLORS.copperLight : COLORS.paper, border: highlight ? `1.5px solid ${COLORS.copper}` : `1px solid ${COLORS.line}`, color: highlight ? COLORS.copperDark : COLORS.ink, fontSize: 15, fontWeight: 700, cursor: "pointer", textAlign: "left", transition: "all 0.2s ease", width: '100%', boxShadow: highlight ? "0 4px 12px rgba(226,89,56,0.15)" : "none" }}>
    <span style={{ fontSize: 20 }}>{icon}</span> <span>{text}</span>
  </button>
));

const ComboCard = memo(({ combo, onAdd }) => {
  if (!combo.active) return null;
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `2px solid ${COLORS.gold}`, padding: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
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
        <button onClick={onAdd} style={{ background: COLORS.sage, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }} className="smooth-transition hover-lift">Add Combo</button>
      </div>
    </div>
  );
});

const FlashSaleItem = memo(({ item, onAdd }) => {
  if (!item.active) return null;
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `2px solid ${COLORS.error}`, padding: 12, minWidth: 150, flexShrink: 0 }}>
      <div style={{ fontSize: 20 }}>🔥</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{item.name}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0' }}>
        <span style={{ fontWeight: 800, color: COLORS.error }}>₹{item.discountPrice}</span>
        <span style={{ textDecoration: 'line-through', fontSize: 12, color: COLORS.textLight }}>₹{item.price}</span>
      </div>
      <button onClick={onAdd} style={{ background: COLORS.error, color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 6, fontWeight: 700, width: '100%', cursor: 'pointer' }} className="smooth-transition hover-lift">Add</button>
    </div>
  );
});

// ============================================
// 5. CUSTOM HOOKS
// ============================================

const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) { return initialValue; }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) { console.error(error); }
  }, [key, storedValue]);

  return [storedValue, setValue];
};

// ============================================
// 6. NOTIFICATION SOUND
// ============================================

const notificationAudio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
notificationAudio.volume = 0.5;

const playNotificationSound = () => {
  try {
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(e => console.log("Sound play error:", e));
  } catch (e) { console.log("Sound error:", e); }
};

// ============================================
// 7. MENU ITEM HELPER
// ============================================

function mi(id, name, price, category, veg, desc, portion, isBestseller = false, available = true, customImg = "") {
  let img = customImg || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80";
  if (!customImg) {
    if (category.includes("Drinks") || category.includes("Tea")) img = "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Fun Food") || category.includes("Snacks")) img = "https://images.unsplash.com/photo-1626082895617-2c6ad36f568a?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Indian Bread")) img = "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Paneer")) img = "https://images.unsplash.com/photo-1631452180519-c014fe946bc0?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Mushroom") || category.includes("Soup") || category.includes("Dal") || category.includes("Aloo")) img = "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Biryani") || category.includes("Pulao")) img = "https://images.unsplash.com/photo-1589302168068-964664d93cb0?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Chinese") || category.includes("Momo")) img = "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Tandoori") || category.includes("Mughlai")) img = "https://images.unsplash.com/photo-1599487405702-3e28c42b9370?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Chicken") || category.includes("Mutton") || category.includes("Egg") || category.includes("Fish")) img = "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=80";
    else if (category.includes("Thali")) img = "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=400&q=80";
  }
  return { id, name, desc: desc || "Freshly prepared with premium ingredients.", price, category, veg, available, image: img, portion: portion || "", isBestseller };
}

// ============================================
// 8. LOYALTY PROGRESS COMPONENT
// ============================================

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
        <span style={{ fontWeight: 700, color: pointsNeeded > 0 ? COLORS.copper : COLORS.success }}>{pointsNeeded > 0 ? `${pointsNeeded} points away` : '🎉 Unlocked!'}</span>
      </div>
      <div style={{ width: '100%', height: 6, background: COLORS.paper2, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', background: `linear-gradient(90deg, ${COLORS.gold}, ${nextTier.color || COLORS.sage})`, borderRadius: 999, transition: 'width 0.8s ease' }} />
      </div>
      {pointsNeeded > 0 && (
        <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4, fontWeight: 500 }}>
          💰 Spend ₹{Math.ceil(pointsNeeded * loyaltyRules.rate)} more to reach {nextTier.name}
        </div>
      )}
    </div>
  );
});

// ============================================
// 9. CHAT BOX COMPONENT
// ============================================

const ChatBox = memo(({ orderId, customerId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesRef = collection(db, 'chats', orderId, 'messages');

  useEffect(() => {
    try {
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      const unsubscribe = onSnapshot(q, (snap) => {
        const msgs = snap.docs.map(doc => {
          const data = doc.data();
          if (!data.timestamp) data.timestamp = Date.now();
          return { id: doc.id, ...data };
        });
        setMessages(msgs);
      });
      return unsubscribe;
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
            {msg.senderName && <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{msg.senderName}</div>}
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

// ============================================
// 10. GOOGLE REVIEW BUTTON
// ============================================

const GoogleReviewButton = memo(({ variant = 'primary', size = 'md', showText = true }) => {
  const buttonStyles = {
    primary: { background: '#4285F4', color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(66, 133, 244, 0.3)' },
    secondary: { background: 'transparent', color: '#4285F4', border: `2px solid #4285F4`, boxShadow: 'none' },
    gold: { background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#1A1A1A', border: 'none', boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)' }
  };
  const sizeStyles = {
    sm: { padding: '4px 12px', fontSize: 11, borderRadius: 16 },
    md: { padding: '8px 18px', fontSize: 13, borderRadius: 20 },
    lg: { padding: '12px 24px', fontSize: 16, borderRadius: 24 }
  };
  const styles = { display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease', ...buttonStyles[variant], ...sizeStyles[size] };
  return (
    <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer" style={styles} className="smooth-transition hover-lift">
      <span style={{ fontSize: size === 'lg' ? 24 : size === 'sm' ? 14 : 18 }}>⭐</span>
      {showText && <span>Rate on Google</span>}
    </a>
  );
});

// ============================================
// 11. PAYMENT PROCESSING
// ============================================

const loadRazorpayScript = () => new Promise((resolve) => {
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

const processRazorpayPayment = async (amount, orderId, customerName, customerPhone) => {
  const isScriptLoaded = await loadRazorpayScript();
  if (!isScriptLoaded) { alert("⚠️ Payment gateway could not load. Please try again."); return false; }
  const options = {
    key: RAZORPAY_KEY, amount: Math.round(amount * 100), currency: "INR",
    name: RESTAURANT.name, description: `Order #${orderId}`,
    prefill: { name: customerName, contact: customerPhone },
    theme: { color: COLORS.copper },
    handler: function (response) { console.log("Payment successful:", response); return true; },
    modal: { ondismiss: function () { console.log("Payment cancelled"); return false; } }
  };
  const razorpay = new window.Razorpay(options);
  razorpay.open();
  return true;
};

// ============================================
// 12. NEW: KOT Badge
// ============================================

const KotBadge = memo(({ kots }) => {
  const count = kots?.length || 1;
  if (count <= 1) return null;
  return (
    <span style={{ background: COLORS.info, color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 800, marginLeft: 6 }}>
      {count} KOTs
    </span>
  );
});

// ============================================
// 13. NEW: Kitchen Notification Column (compact, live)
// ============================================

const KitchenNotificationColumn = memo(({ orders, selectedOrderId, onSelect }) => {
  const [open, setOpen] = useState(true);
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
        <button onClick={() => setOpen(false)} aria-label="Close notifications" style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: COLORS.textLight }}>✕</button>
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

// ============================================
// 14. NEW: Running Order Modal
// ============================================

const RunningOrderModal = memo(({ order, menu, onConfirm, onClose, showToast }) => {
  const [additions, setAdditions] = useState({});
  const [search, setSearch] = useState("");

  const filtered = menu.filter(m => m.available && (!search.trim() || m.name.toLowerCase().includes(search.toLowerCase())));
  const itemsToAdd = Object.entries(additions).filter(([, q]) => q > 0);
  const addTotal = itemsToAdd.reduce((s, [id, q]) => { const m = menu.find(x => x.id === id); return s + (m ? m.price * q : 0); }, 0);

  const handleSetQty = (id, q) => {
    setAdditions(prev => {
      const next = { ...prev, [id]: q };
      if (q <= 0) delete next[id];
      return next;
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 85, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="slide-up"
        style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: "20px", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800 }}>➕ Add Running Items</div>
            <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>
              Order #{order.id.slice(1, 5).toUpperCase()} · New KOT #{((order.kots?.length || 1) + 1)}
            </div>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <VegDot veg={item.veg} />
                    <strong style={{ fontSize: 14 }}>{item.name}</strong>
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.copper, fontWeight: 700, marginTop: 2 }}>{inr(item.price)}</div>
                </div>
                <AddBtnStepper qty={qty} onChange={q => handleSetQty(item.id, q)} available={item.available} />
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: `2px solid ${COLORS.line}`, paddingTop: 16, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 17, marginBottom: 12 }}>
            <span>Additional Total</span>
            <span style={{ color: COLORS.copper, fontFamily: "'JetBrains Mono', monospace" }}>{inr(addTotal)}</span>
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

// ============================================
// 15. NEW: Waiter Order Panel
// ============================================

const WaiterOrderPanel = memo(({ menu, table, setTable, onSubmit, onClose, showToast }) => {
  const [cart, setCart] = useState({});
  const [search, setSearch] = useState("");
  const [waiterName, setWaiterName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  const filtered = menu.filter(m => m.available && (!search.trim() || m.name.toLowerCase().includes(search.toLowerCase())));
  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const subtotal = cartItems.reduce((s, [id, q]) => { const m = menu.find(x => x.id === id); return s + (m ? m.price * q : 0); }, 0);

  const setQty = (id, q) => {
    setCart(prev => {
      const next = { ...prev, [id]: q };
      if (q <= 0) delete next[id];
      return next;
    });
  };

  const inputStyle = { padding: 12, border: `1.5px solid ${COLORS.line}`, borderRadius: 10, fontSize: 14, width: "100%", boxSizing: "border-box", fontFamily: "'Plus Jakarta Sans', sans-serif" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 85, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="slide-up"
        style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: "20px", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800 }}>🧑‍🍳 Waiter Mode</div>
            <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>Take order on behalf of customer</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <input placeholder="Waiter Name" value={waiterName} onChange={e => setWaiterName(e.target.value)} style={inputStyle} />
          <select value={table} onChange={e => setTable(Number(e.target.value))} style={{ ...inputStyle, background: "#fff" }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>Table {n}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <input placeholder="Customer Name (optional)" value={customerName} onChange={e => setCustomerName(e.target.value)} style={inputStyle} />
          <input placeholder="Customer Phone (optional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} style={inputStyle} />
        </div>

        <SearchBar value={search} onChange={setSearch} placeholder="Search items..." />

        <div style={{ marginTop: 16, maxHeight: "32vh", overflowY: "auto" }}>
          {filtered.map(item => {
            const qty = cart[item.id] || 0;
            return (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <VegDot veg={item.veg} />
                    <strong style={{ fontSize: 14 }}>{item.name}</strong>
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.copper, fontWeight: 700, marginTop: 2 }}>{inr(item.price)}</div>
                </div>
                <AddBtnStepper qty={qty} onChange={q => setQty(item.id, q)} available={item.available} />
              </div>
            );
          })}
        </div>

        <textarea placeholder="Notes (e.g., less spicy, no onion)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, marginTop: 12, resize: "none" }} />

        <div style={{ borderTop: `2px solid ${COLORS.line}`, paddingTop: 16, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
            <span>{cartItems.length} items · Total</span>
            <span style={{ color: COLORS.copper, fontFamily: "'JetBrains Mono', monospace" }}>{inr(subtotal)}</span>
          </div>
          <button disabled={cartItems.length === 0}
            onClick={() => {
              if (cartItems.length === 0) return;
              const items = cartItems.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty }; });
              onSubmit({ table, items, waiterName, customerName: customerName || "Walk-in", customerPhone: customerPhone || "", notes });
            }}
            style={{ width: "100%", padding: 16, border: "none", borderRadius: 14, background: cartItems.length ? COLORS.sage : COLORS.paper2, color: cartItems.length ? "#fff" : COLORS.textLight, fontWeight: 800, fontSize: 16, cursor: cartItems.length ? "pointer" : "not-allowed" }}>
            🍳 Send Order to Kitchen
          </button>
        </div>
      </div>
    </div>
  );
});

// ============================================
// 16. CUSTOMER VIEW
// ============================================

function CustomerView({ menu, orders, placeOrder, bookEvent, gallery, offersList, table, setTable, requestPinPrompt, settings, isDark, setIsDark, requestWaiter, loyaltyRules, loyaltyUsers, coinHistory, setOrdersState, categories, flashSaleItems, comboOffers }) {
  const [category, setCategory] = useState(categories[0] || "Drinks");
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [myOrderIds, setMyOrderIds] = useState([]);
  const [orderType, setOrderType] = useState("dine_in");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState('info');
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [claimedReward, setClaimedReward] = useState(null);
  const [otpStep, setOtpStep] = useState("phone");
  const [otpCode, setOtpCode] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [bookType, setBookType] = useState("table");
  const [bookData, setBookData] = useState({ name: "", phone: "", date: "", time: "", guests: "" });
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [favorites, setFavorites] = useLocalStorage('favorites', []);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [activeOrderIdForChat, setActiveOrderIdForChat] = useState(null);

  // NEW: waiter mode + running items
  const [runningOrderId, setRunningOrderId] = useState(null);
  const [showWaiterMode, setShowWaiterMode] = useState(false);

  const filteredItems = useMemo(() => {
    let items = searchQuery.trim() ? menu : menu.filter((m) => m.category === category);
    items = items.filter((m) => {
      if (vegOnly && !m.veg) return false;
      if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); return m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q); }
      return true;
    });
    return items;
  }, [menu, category, searchQuery, vegOnly]);

  let emptyReason = 'category_empty';
  if (vegOnly) emptyReason = 'veg_filtered';
  else if (searchQuery && searchQuery.trim() !== '') emptyReason = 'search_no_results';

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const cartCount = cartItems.reduce((s, [, q]) => s + q, 0);
  const subtotal = cartItems.reduce((s, [id, q]) => { const item = menu.find((m) => m.id === id); return s + (item ? item.price * q : 0); }, 0);
  const deliveryFee = orderType === "parcel" ? 40 : 0;
  const discountAmount = Math.round((subtotal * appliedDiscount) / 100);
  const cartTotal = Math.max(0, subtotal - discountAmount) + deliveryFee;

  const activeUser = loyaltyUsers.find(u => u.phone === custPhone);
  const currentCoins = activeUser ? activeUser.coins : 0;
  const loyaltyTier = getLoyaltyTier(currentCoins);
  const loyaltyDiscount = loyaltyTier.discount * subtotal;
  const finalTotal = cartTotal - loyaltyDiscount;
  const newEarnedCoins = Math.floor(finalTotal / loyaltyRules.rate);

  const myActiveOrders = orders.filter(o => myOrderIds.includes(o.id) && o.status !== "served" && o.status !== "cancelled");
  const myOrders = orders.filter(o => myOrderIds.includes(o.id));
  const myCoinLogs = coinHistory.filter(c => c.phone === custPhone);

  const cartQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=${RESTAURANT.upiId}&pn=${encodeURIComponent(RESTAURANT.name)}&am=${finalTotal}&cu=INR`)}`;
  const loyaltyQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=${RESTAURANT.upiId}&pn=${encodeURIComponent(RESTAURANT.name)}&am=999&cu=INR`)}`;

  const showToast = useCallback((msg, type = 'info') => {
    const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
    if (type === 'reward' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
    if (type === 'order') playNotificationSound();
    setToast(msg); setToastType(type);
    const timeout = setTimeout(() => setToast(null), config.duration);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const savedCustomer = localStorage.getItem('eatpark_customer');
    if (savedCustomer) {
      try { const data = JSON.parse(savedCustomer); if (data.name) setCustName(data.name); if (data.phone) setCustPhone(data.phone); if (data.address) setCustAddress(data.address); if (data.isLoggedIn) setIsLoggedIn(true); } catch (e) {}
    }
    const savedCart = localStorage.getItem('eatpark_cart');
    if (savedCart) { try { setCart(JSON.parse(savedCart)); } catch (e) {} }
    const savedOrders = localStorage.getItem('eatpark_orders');
    if (savedOrders) { try { const ordersData = JSON.parse(savedOrders); setMyOrderIds(ordersData.map(o => o.id)); } catch (e) {} }
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  useEffect(() => {
    if (custName || custPhone) localStorage.setItem('eatpark_customer', JSON.stringify({ name: custName, phone: custPhone, address: custAddress, isLoggedIn }));
  }, [custName, custPhone, custAddress, isLoggedIn]);

  useEffect(() => { if (Object.keys(cart).length > 0) localStorage.setItem('eatpark_cart', JSON.stringify(cart)); }, [cart]);

  // NEW: Live status updates for customer
  useEffect(() => {
    if (myOrderIds.length === 0) return;
    const unsubs = myOrderIds.slice(-3).map(id => {
      return onSnapshot(doc(db, "orders", id), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const prev = orders.find(o => o.id === id);
        if (prev && prev.status !== data.status) {
          const labels = { new: "🍽️ Received", preparing: "👨‍🍳 Cooking", ready: "✅ Ready!", served: "🎉 Served" };
          showToast(`${labels[data.status] || data.status} — Order #${id.slice(1, 5)}`, 'order');
        }
      });
    });
    return () => unsubs.forEach(u => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myOrderIds.join(",")]);

  // FIXED: handleSetQty with proper functional update
  const handleSetQty = useCallback((id, q) => {
    setCart((prevCart) => {
      const oldQ = prevCart[id] || 0;
      if (q > oldQ && q === 1) {
        const options = getSmartSuggestionPool(menu, prevCart);
        if (options.length > 0) {
          const randomSug = options[Math.floor(Math.random() * options.length)];
          setAiSuggestion(randomSug);
          setTimeout(() => setAiSuggestion(null), 6000);
        }
      }
      const next = { ...prevCart, [id]: q };
      if (q <= 0) delete next[id];
      return next;
    });
  }, [menu]);

  const toggleFavorite = useCallback((itemId) => {
    setFavorites(prev => {
      if (prev.includes(itemId)) { showToast('Removed from favorites', 'info'); return prev.filter(id => id !== itemId); }
      showToast('Added to favorites!', 'success');
      return [...prev, itemId];
    });
  }, [setFavorites, showToast]);

  const sendPushNotification = useCallback((title, message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message, icon: '/icon-192.png', vibrate: [200, 100, 200], requireInteraction: true });
    }
  }, []);

  const cancelOrder = useCallback(async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    try {
      await updateDoc(doc(db, "orders", orderId), { status: "cancelled", cancelledAt: Date.now() });
      setOrdersState(prev => prev.map(o => o.id === orderId ? { ...o, status: "cancelled", cancelledAt: Date.now() } : o));
      showToast("❌ Order cancelled successfully", 'warning');
      sendPushNotification("Order Cancelled", `Order #${orderId.slice(1, 5)} has been cancelled`);
    } catch (e) { console.error("Cancel error:", e); showToast("⚠️ Failed to cancel order", 'error'); }
  }, [setOrdersState, showToast, sendPushNotification]);

  const reorderOrder = useCallback((order) => {
    const newCart = {};
    order.items.forEach(item => { newCart[item.itemId] = (newCart[item.itemId] || 0) + item.qty; });
    setCart(newCart);
    setCartOpen(true);
    showToast("🔄 Order items added to cart!", 'success');
  }, [setCart, showToast]);

  // NEW: Add running items (creates new KOT)
  const addRunningItems = useCallback(async (orderId, newItems) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      const nextKotNumber = (order.kots?.length || 1) + 1;
      const taggedItems = newItems.map(it => ({ ...it, kotNumber: nextKotNumber }));
      const newKot = { id: uid("kot"), kotNumber: nextKotNumber, items: taggedItems, createdAt: Date.now(), status: "new", isRunning: true };
      const updatedKots = [...(order.kots || [{ id: uid("kot"), kotNumber: 1, items: order.items, createdAt: order.createdAt, status: "new" }]), newKot];
      const updatedItems = [...order.items, ...taggedItems];
      const addedTotal = taggedItems.reduce((s, it) => s + it.price * it.qty, 0);

      await updateDoc(doc(db, "orders", orderId), { kots: updatedKots, items: updatedItems, status: "new", lastKotAt: Date.now() });

      const waText = `🍳 *RUNNING KOT* — Order #${orderId.slice(1, 5).toUpperCase()}\nTable ${order.table}\n` + taggedItems.map(i => `• ${i.qty}x ${i.name}`).join("\n") + `\n\nAdditional: ₹${addedTotal}`;
      window.open(`https://wa.me/${RESTAURANT.whatsapp}?text=${encodeURIComponent(waText)}`, "_blank");

      setRunningOrderId(null);
      showToast("🍳 New KOT sent to kitchen!", "success");
    } catch (e) { console.error(e); showToast("⚠️ Failed to add items", "error"); }
  }, [orders, showToast]);

  // NEW: Waiter takes order
  const handleWaiterOrder = useCallback(async ({ table: t, items, waiterName, customerName, customerPhone, notes: orderNotes }) => {
    const orderId = uid("o");
    const total = items.reduce((s, it) => s + it.price * it.qty, 0);
    const order = {
      id: orderId, table: t, orderType: "dine_in",
      customer: { name: customerName, phone: customerPhone || "WALK-IN", address: "" },
      items, waiter: waiterName || "Staff", takenBy: "waiter",
      kots: [{ id: uid("kot"), kotNumber: 1, items: items.map(it => ({ ...it, kotNumber: 1 })), createdAt: Date.now(), status: "new", isRunning: false }],
      notes: orderNotes, payment: "cash", paymentStatus: "pending",
      status: "new", paid: false, createdAt: Date.now(),
      coinsClaimed: true, earnedCoins: 0, rewardUsedCoins: 0,
      deliveryFee: 0, loyaltyDiscount: 0, discount: 0,
    };

    await placeOrder(order, 0);
    playNotificationSound();

    const waText = `🧑‍🍳 *WAITER ORDER* (#${orderId.slice(1, 5).toUpperCase()})\nTable ${t} · Waiter: ${waiterName || "Staff"}\nCustomer: ${customerName}\n` + items.map(i => `• ${i.qty}x ${i.name}`).join("\n") + (orderNotes ? `\nNotes: ${orderNotes}` : "") + `\n\nTotal: ₹${total}`;
    window.open(`https://wa.me/${RESTAURANT.whatsapp}?text=${encodeURIComponent(waText)}`, "_blank");

    setShowWaiterMode(false);
    showToast("✅ Waiter order placed!", "success");
  }, [placeOrder, showToast]);

  const handleSendOtp = () => {
    if (!custPhone || custPhone.length < 10) { showToast("⚠️ Enter valid 10-digit phone", 'error'); return; }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(code); setOtpStep("verify");
    showToast(`🔐 Demo OTP sent: ${code}`, 'success');
    alert(`🔐 Demo OTP: ${code}`);
  };

  const handleVerifyOtp = () => {
    if (otpCode === generatedOtp || otpCode === "1234") {
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
  };

  const checkExistingCustomer = useCallback(async (phone) => {
    if (phone.length === 10) {
      try {
        const userSnap = await getDoc(doc(db, "customers", phone));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setCustName(data.name || "");
          setCustAddress(data.address || "");
          setIsLoggedIn(true);
          showToast(`👋 Welcome back ${data.name || 'Guest'}!`, 'success');
        }
      } catch (e) { console.log(e); }
    }
  }, [showToast]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) { showToast("Geolocation not supported", 'error'); return; }
    showToast("📍 Fetching your GPS location...", 'info');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCustAddress(`Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)} (Auto-detected GPS Location)`);
        showToast("✅ Location fetched successfully!", 'success');
      },
      () => { showToast("⚠️ Unable to retrieve location", 'error'); }
    );
  };

  const handleApplyCoupon = () => {
    const code = couponCode.toUpperCase().trim();
    const coupons = {
      "EAT20": { discount: 20, min: 0, ok: () => true, msg: "🎉 Flat 20% Discount Applied!" },
      "EATS10": { discount: 10, min: 0, ok: () => true, msg: "🎉 10% Discount Applied!" },
      "WELCOME20": { discount: 20, min: 0, ok: () => myOrderIds.length === 0, msg: "🎉 Welcome! 20% Off Applied!", failMsg: "💳 Welcome coupon is for first order only" },
      "COMEBACK15": { discount: 15, min: 199, ok: () => true, msg: "🎉 Welcome back! 15% Off Applied!" },
      "LOYALTY50": { discount: 50, min: 0, ok: () => currentCoins >= 500, msg: "👑 VIP 50% Off Applied!", failMsg: "👑 Requires 500+ EatCoins" },
    };
    const coupon = coupons[code];
    if (!coupon) { showToast("❌ Invalid Coupon Code", 'error'); return; }
    if (!coupon.ok()) { showToast(coupon.failMsg || "⚠️ Coupon conditions not met", 'warning'); return; }
    if (subtotal < coupon.min) { showToast(`⚠️ Minimum order ₹${coupon.min} required`, 'warning'); return; }
    setAppliedDiscount(coupon.discount);
    showToast(coupon.msg, 'success');
  };

  const handlePlaceOrder = useCallback(async () => {
    if (cartItems.length === 0) return;
    if (!custName.trim()) { showToast("⚠️ Please enter your Name", 'error'); return; }
    if (!custPhone.trim() || custPhone.length < 10) { showToast("⚠️ Please enter valid 10-digit Phone", 'error'); return; }
    if (orderType === "parcel" && !custAddress.trim()) { showToast("⚠️ Please enter Delivery Address", 'error'); return; }

    setIsProcessingPayment(true);
    try {
      if (paymentMethod === "razorpay") {
        const success = await processRazorpayPayment(finalTotal, uid("o"), custName, custPhone);
        if (!success) { setIsProcessingPayment(false); return; }
      } else if (paymentMethod === "phonepe") {
        showToast("📱 Redirecting to PhonePe...", 'info');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const orderId = uid("o");
      const itemStrings = cartItems.map(([id, qty]) => { const m = menu.find((mi) => mi.id === id); return `${qty}x ${m.name}`; }).join(", ");
      const claimedText = claimedReward ? `\n🎁 *Free Reward Claimed:* ${claimedReward.item}` : "";
      const scheduleText = isScheduled && scheduleDate && scheduleTime ? `\n📅 *Scheduled:* ${scheduleDate} at ${scheduleTime}` : "";

      const waText = `🚨 *NEW ORDER ALERT* (#${orderId.slice(1, 5).toUpperCase()})\n\n`
        + `*Type:* ${orderType === 'parcel' ? '🛍️ Parcel (Delivery ₹40)' : `🍽️ Table ${table}`}\n`
        + `*Customer:* ${custName} (${custPhone})\n`
        + (orderType === 'parcel' ? `*Address:* ${custAddress}\n\n` : `\n`)
        + `*Items:* ${itemStrings}${claimedText}\n`
        + (appliedDiscount > 0 ? `*Coupon Discount:* ${appliedDiscount}%\n` : ``)
        + (loyaltyDiscount > 0 ? `*Loyalty Discount:* ${loyaltyTier.name} (${loyaltyTier.discount * 100}%)\n` : ``)
        + `*Total Bill:* ₹${finalTotal}\n*Payment:* ${paymentMethod}\n` + scheduleText
        + (notes ? `*Notes:* ${notes}` : ``);

      const link = document.createElement('a'); link.href = `https://wa.me/${RESTAURANT.whatsapp}?text=${encodeURIComponent(waText)}`; link.target = '_blank'; document.body.appendChild(link); link.click(); document.body.removeChild(link);

      const initialItems = cartItems.map(([id, qty]) => { const m = menu.find((mi) => mi.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty, kotNumber: 1 }; });

      const order = {
        id: orderId, table, orderType,
        customer: { name: custName, phone: custPhone, address: orderType === "parcel" ? custAddress : "" },
        items: initialItems,
        claimedReward: claimedReward ? claimedReward.item : null,
        rewardUsedCoins: claimedReward ? claimedReward.cost : 0,
        earnedCoins: newEarnedCoins,
        discount: appliedDiscount,
        loyaltyDiscount: loyaltyDiscount,
        loyaltyTier: loyaltyTier.name,
        deliveryFee, notes, payment: paymentMethod,
        paymentStatus: paymentMethod === "cash" ? "pending" : "paid",
        status: "new",
        paid: paymentMethod !== "cash",
        createdAt: Date.now(),
        scheduledDate: isScheduled ? scheduleDate : null,
        scheduledTime: isScheduled ? scheduleTime : null,
        isScheduled: isScheduled,
        coinsClaimed: false,
        kots: [{ id: uid("kot"), kotNumber: 1, items: initialItems, createdAt: Date.now(), status: "new", isRunning: false }],
      };

      const orderHistory = JSON.parse(localStorage.getItem('eatpark_orders') || '[]');
      orderHistory.push(order);
      localStorage.setItem('eatpark_orders', JSON.stringify(orderHistory));

      const customerData = JSON.parse(localStorage.getItem('eatpark_customer') || '{}');
      customerData.totalOrders = (customerData.totalOrders || 0) + 1;
      customerData.totalSpent = (customerData.totalSpent || 0) + finalTotal;
      customerData.lastOrderDate = Date.now();
      localStorage.setItem('eatpark_customer', JSON.stringify(customerData));

      await placeOrder(order, claimedReward ? claimedReward.cost : 0);

      try {
        await updateDoc(doc(db, "customers", custPhone), { totalOrders: customerData.totalOrders, totalSpent: customerData.totalSpent, lastOrderDate: Date.now() });
      } catch (e) { console.log(e); }

      playNotificationSound();
      sendPushNotification("🛎️ New Order Received!", `Order #${orderId.slice(1, 5)} from ${custName} - ₹${finalTotal}`);

      setMyOrderIds([...myOrderIds, order.id]);
      setCart({});
      localStorage.removeItem('eatpark_cart');
      setNotes(""); setClaimedReward(null); setCartOpen(false); setActiveModal('track');
      setIsScheduled(false); setScheduleDate(""); setScheduleTime("");
      showToast("🎉 Order Placed Successfully!", 'success');
      setTimeout(() => showToast("⭐ Love our food? Rate us on Google!", 'info'), 4000);
    } catch (e) {
      console.error("Order error:", e);
      showToast("⚠️ Failed to place order. Please try again.", 'error');
    } finally { setIsProcessingPayment(false); }
  }, [cartItems, custName, custPhone, custAddress, orderType, table, paymentMethod, finalTotal, claimedReward, isScheduled, scheduleDate, scheduleTime, appliedDiscount, loyaltyDiscount, loyaltyTier, notes, menu, placeOrder, sendPushNotification, myOrderIds, showToast]);

  const handleBooking = async () => {
    if (!bookData.name || !bookData.phone || !bookData.date || !bookData.time || !bookData.guests) { showToast("⚠️ Please fill all fields", 'error'); return; }
    const newBooking = { ...bookData, type: bookType, id: uid("b"), status: "pending", createdAt: Date.now() };
    await bookEvent(newBooking); setConfirmedBooking(newBooking); setBookData({ name: "", phone: "", date: "", time: "", guests: "" }); showToast("✅ Booking Request Sent!", 'success');
  };

  const addComboToCart = useCallback((combo) => {
    combo.items.forEach(item => {
      setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + item.quantity }));
    });
    showToast(`🎉 ${combo.name} added to cart!`, 'success');
  }, [showToast]);

  const addFlashSaleToCart = useCallback((item) => {
    setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
    showToast(`⚡ ${item.name} added to cart at special price!`, 'success');
  }, [showToast]);

  const inputStyle = { padding: "12px 16px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", width: "100%", boxSizing: "border-box", transition: "all 0.2s ease" };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: cartCount ? 120 : 60, background: "var(--bg-color, #fff)", minHeight: "100vh", position: "relative" }}>
      {toast && <Toast message={toast} type={toastType} />}

      {orders.filter(o => o.status === "new" && !myOrderIds.includes(o.id)).length > 0 && (
        <div style={{ position: "fixed", top: 16, right: 16, background: COLORS.copper, color: "#fff", padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, zIndex: 100, boxShadow: "0 4px 12px rgba(226,89,56,0.4)", animation: "notificationPulse 2s ease-in-out infinite" }} className="notification-pulse">🔔 New Order!</div>
      )}

      <button onClick={() => { requestWaiter(table); showToast("🔔 Waiter has been notified!", 'success'); }} aria-label="Call waiter to your table"
        style={{ position: "fixed", top: 80, right: 16, background: COLORS.rust, color: "#fff", border: "none", borderRadius: 20, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 8px 24px rgba(192,57,43,0.4)", cursor: "pointer", zIndex: 60, fontSize: 13, fontWeight: 800 }} className="smooth-transition hover-lift scale-bounce" title="Call Waiter">🔔 Waiter Call</button>

      {/* NEW: Waiter Mode button */}
      <button onClick={() => setShowWaiterMode(true)} aria-label="Open waiter mode"
        style={{ position: "fixed", top: 130, right: 16, background: COLORS.info, color: "#fff", border: "none", borderRadius: 20, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 8px 24px rgba(59,130,246,0.4)", cursor: "pointer", zIndex: 60, fontSize: 13, fontWeight: 800 }} className="smooth-transition hover-lift" title="Waiter takes order">🧑‍🍳 Waiter Mode</button>

      <div style={{ position: "relative", height: 220, borderRadius: "0 0 24px 24px", overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", marginBottom: 16 }}>
        <div className="keep-color" style={{ position: "absolute", inset: 0, backgroundImage: `url('${settings?.heroImage || "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80"}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="keep-color" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,26,26,0.9) 0%, rgba(26,26,26,0.3) 60%, rgba(26,26,26,0.1) 100%)" }} />
        <div className="keep-color" style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.25)", backdropFilter: "blur(12px)", padding: "6px 12px", borderRadius: 20, color: "#fff", display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.3)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>Table</span>
          <select value={table} onChange={(e) => setTable(Number(e.target.value))} aria-label="Select table number" style={{ background: "transparent", color: "#fff", border: "none", fontWeight: 800, fontSize: 16, outline: "none", appearance: "none" }}>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (<option key={n} value={n} style={{ color: '#000' }}>{n}</option>))}</select>
        </div>
        <div className="keep-color" style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, color: "#fff", margin: "0 0 4px", textShadow: "0 4px 12px rgba(0,0,0,0.6)", fontWeight: 800 }}>{RESTAURANT.name}</h1>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.9)", margin: 0, fontWeight: 500 }}>{RESTAURANT.tagline}</p>
        </div>
      </div>

      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <div style={{ background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)', padding: '12px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
          <span style={{ fontSize: 24 }}>🌟</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Today's Special</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Chicken Butter Masala with Garlic Naan - ₹350</div>
          </div>
        </div>
      </div>

      {myActiveOrders.length > 0 && (
        <div style={{ padding: "0 16px", marginBottom: 12, display: "flex", gap: 8 }}>
          <button onClick={() => setActiveModal('track')} style={{ flex: 1, background: COLORS.sageLight, border: `2px solid ${COLORS.sage}`, color: COLORS.sageDark, borderRadius: 14, padding: "12px", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: 14 }} className="smooth-transition hover-lift">
            <span>📦 {myActiveOrders.length} Active Order{myActiveOrders.length > 1 ? 's' : ''}</span>
            <span>Track ➔</span>
          </button>
          <button onClick={() => setRunningOrderId(myActiveOrders[0].id)} title="Add running items"
            style={{ background: COLORS.info, color: "#fff", border: "none", borderRadius: 14, padding: "0 16px", fontWeight: 800, cursor: "pointer", fontSize: 18 }}>➕</button>
        </div>
      )}

      {!searchQuery.trim() && comboOffers && comboOffers.filter(c => c.active).length > 0 && (
        <div style={{ padding: "16px", borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: COLORS.ink, marginBottom: 12 }}>🎯 Combo Offers</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {comboOffers.filter(c => c.active).map(combo => <ComboCard key={combo.id} combo={combo} onAdd={() => addComboToCart(combo)} />)}
          </div>
        </div>
      )}

      {!searchQuery.trim() && flashSaleItems && flashSaleItems.filter(f => f.active).length > 0 && (
        <div style={{ padding: "16px", borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: COLORS.rust, marginBottom: 12 }}>⚡ Flash Sale</h3>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
            {flashSaleItems.filter(f => f.active).map(item => <FlashSaleItem key={item.id} item={item} onAdd={() => addFlashSaleToCart(item)} />)}
          </div>
        </div>
      )}

      {!searchQuery.trim() && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "8px 16px", scrollbarWidth: "none", borderBottom: `1px solid ${COLORS.line}` }}>
          {categories.map((c) => (<button key={c} onClick={() => setCategory(c)} style={{ whiteSpace: "nowrap", padding: "8px 16px", borderRadius: 12, border: `1.5px solid ${category === c ? COLORS.copper : COLORS.line}`, background: category === c ? COLORS.copper : "transparent", color: category === c ? "#fff" : COLORS.ink, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }} className="smooth-transition">{c}</button>))}
        </div>
      )}

      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <button onClick={() => setVegOnly(!vegOnly)} aria-label={vegOnly ? "Showing vegetarian only" : "Showing all items"}
            style={{ padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${vegOnly ? COLORS.sage : COLORS.line}`, background: vegOnly ? COLORS.sageLight : "transparent", color: vegOnly ? COLORS.sageDark : COLORS.textLight, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <VegDot veg={true} /> <span style={{ fontSize: 13 }}>{vegOnly ? "Veg" : "All"}</span>
          </button>
        </div>

        {filteredItems.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: COLORS.textLight }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>{EMPTY_STATES[emptyReason].icon}</div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{EMPTY_STATES[emptyReason].title}</div>
            <div style={{ fontSize: 13 }}>{EMPTY_STATES[emptyReason].subtitle}</div>
          </div>
        )}

        {filteredItems.map((item) => {
          const isFavorite = favorites.includes(item.id);
          return (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${COLORS.line}`, gap: 12, opacity: item.available ? 1 : 0.6 }} className="smooth-slide-up">
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <VegDot veg={item.veg} />
                  {item.portion && <span style={{ fontSize: 11, background: COLORS.paper2, color: COLORS.text, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{item.portion}</span>}
                  {item.isBestseller && <span style={{ fontSize: 11, background: COLORS.copperLight, color: COLORS.copperDark, padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>🔥 Bestseller</span>}
                  {!item.available && <span style={{ fontSize: 11, color: COLORS.rust, fontWeight: 800 }}>Out of Stock</span>}
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: COLORS.ink, fontWeight: 700, marginBottom: 2 }}>{item.name}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: COLORS.copper, fontWeight: 800, marginBottom: 4 }}>{inr(item.price)}</div>
                {item.desc && <div style={{ fontSize: 12, color: COLORS.textLight, lineHeight: 1.4, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.desc}</div>}
              </div>
              <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
                <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="keep-color" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, filter: item.available ? 'none' : 'grayscale(100%)' }}
                  onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; }} />
                <div style={{ position: "absolute", top: -4, right: -4 }}>
                  <button onClick={() => toggleFavorite(item.id)} style={{ background: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }} aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                    <span style={{ fontSize: 16, color: isFavorite ? '#FFD700' : '#CCC' }}>{isFavorite ? '⭐' : '☆'}</span>
                  </button>
                </div>
                <div style={{ position: "absolute", bottom: -12, left: "50%", transform: "translateX(-50%)", zIndex: 2 }}>
                  <AddBtnStepper qty={cart[item.id] || 0} onChange={(q) => handleSetQty(item.id, q)} available={item.available} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: "center", padding: "20px 20px 60px", fontSize: 13, color: COLORS.textLight, lineHeight: 1.6, fontWeight: 500 }}>
        {RESTAURANT.address}<br />{RESTAURANT.phones.join(" · ")}<br /><br />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button onClick={() => requestPinPrompt("staff")} style={{ background: "none", border: `1px solid ${COLORS.line}`, color: COLORS.textLight, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }} className="smooth-transition hover-lift">🔒 Staff Login</button>
          <button onClick={() => requestPinPrompt("admin")} style={{ background: "none", border: `1px solid ${COLORS.line}`, color: COLORS.textLight, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }} className="smooth-transition hover-lift">⚙️ Admin Login</button>
        </div>
      </div>

      {aiSuggestion && !cartOpen && !activeModal && (
        <div className="smooth-slide-up" style={{ position: 'fixed', bottom: cartCount > 0 ? 100 : 20, left: 16, right: 16, background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', padding: 14, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 4, boxShadow: '0 8px 24px rgba(253, 160, 133, 0.4)' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#d35400', marginBottom: 2 }}>🤖 AI Suggests pairing:</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.ink }}>{aiSuggestion.name}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => { handleSetQty(aiSuggestion.id, 1); setAiSuggestion(null); }} style={{ background: COLORS.ink, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>+ Add</button>
            <button onClick={() => setAiSuggestion(null)} aria-label="Dismiss suggestion" style={{ background: 'transparent', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>&times;</button>
          </div>
        </div>
      )}

      {!cartOpen && !activeModal && (
        <button className="keep-color smooth-transition hover-lift" onClick={() => setShowSidebar(true)} aria-label="Open menu" style={{ position: "fixed", top: 16, left: 16, background: COLORS.ink, color: "#fff", border: "none", borderRadius: "50%", width: 50, height: 50, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", cursor: "pointer", zIndex: 50, fontSize: 20 }}>☰</button>
      )}

      {cartCount > 0 && !cartOpen && !activeModal && (
        <button onClick={() => setCartOpen(true)} aria-label={`View cart, ${cartCount} items, total ${inr(finalTotal)}`} style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 400, background: COLORS.sage, color: "#fff", border: "none", borderRadius: 16, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, fontSize: 16, cursor: "pointer", zIndex: 5, boxShadow: "0 12px 28px rgba(74,124,89,0.35)" }} className="smooth-transition hover-lift">
          <span>{cartCount} item{cartCount > 1 ? "s" : ""}</span><span>{inr(finalTotal)} ➔</span>
        </button>
      )}

      {showSidebar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex" }}>
          <div style={{ width: "80%", maxWidth: 300, background: "#fff", height: "100%", padding: "24px", display: "flex", flexDirection: "column", boxShadow: "4px 0 30px rgba(0,0,0,0.2)", overflowY: "auto" }} className="slide-right">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: COLORS.copper }}>Eat & Park</div>
              <button onClick={() => setShowSidebar(false)} aria-label="Close menu" style={{ background: "none", border: "none", fontSize: 22, color: COLORS.textLight, cursor: "pointer" }}>✕</button>
            </div>

            {myOrders.length > 0 && <MyOrderStats myOrders={myOrders} loyaltyCoins={currentCoins} />}

            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <SidebarBtn icon={isDark ? "☀️" : "🌙"} text={isDark ? "Switch to Light Mode" : "VIP Dark Mode"} onClick={() => { setIsDark(!isDark); setShowSidebar(false); showToast(isDark ? "☀️ Light Mode Active" : "🌙 VIP Dark Mode Active", "success"); }} highlight />
              <SidebarBtn icon="🖼️" text="Photo Gallery" onClick={() => { setShowSidebar(false); setActiveModal('gallery'); }} />
              <SidebarBtn icon="📜" text="My Order History" onClick={() => { setShowSidebar(false); setActiveModal('orderHistory'); }} />
              <SidebarBtn icon="🪙" text="My Coin History" onClick={() => { setShowSidebar(false); setActiveModal('coinHistory'); }} />
              <SidebarBtn icon="🎁" text="Today's Offers" onClick={() => { setShowSidebar(false); setActiveModal('offers'); }} />
              <SidebarBtn icon="🍽️" text="Table Booking" onClick={() => { setShowSidebar(false); setBookType("table"); setActiveModal('booking'); }} />
              <SidebarBtn icon="🎉" text="Party Booking" onClick={() => { setShowSidebar(false); setBookType("party"); setActiveModal('booking'); }} />
              <SidebarBtn icon="👑" text="VIP Loyalty Partner" onClick={() => { setShowSidebar(false); setActiveModal('loyalty'); }} />
              <SidebarBtn icon="⭐" text="Rate us on Google" onClick={() => { setShowSidebar(false); window.open(GOOGLE_REVIEW_URL, '_blank'); }} highlight={true} />
              <div style={{ marginTop: 16, padding: 12, background: COLORS.paper, borderRadius: 12, textAlign: 'center', border: `1px solid ${COLORS.line}` }}>
                <QRCodeSVG value={window.location.href} size={100} />
                <p style={{ fontSize: 11, color: COLORS.textLight, marginTop: 6 }}>📲 Scan to order on your phone</p>
              </div>
              <SidebarBtn icon="💬" text="Chat with Restaurant" onClick={() => { setShowSidebar(false); setActiveOrderIdForChat(myActiveOrders[0]?.id || 'general'); setActiveModal('chat'); }} highlight={false} />
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }} onClick={() => setShowSidebar(false)} className="fade-in" />
        </div>
      )}

      {myOrders.filter(o => o.status === "served").length > 0 && !cartOpen && !activeModal && (
        <div style={{ position: "fixed", bottom: 80, right: 16, zIndex: 50 }}>
          <GoogleReviewButton variant="primary" size="md" showText={true} />
        </div>
      )}

      {(cartOpen || activeModal) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", zIndex: 70 }} onClick={() => { setCartOpen(false); setActiveModal(null); setConfirmedBooking(null); }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: "24px 20px 30px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -10px 40px rgba(0,0,0,0.15)" }} className="slide-up">

            {cartOpen && (
              <>
                <ModalHeader title="Checkout" onClose={() => setCartOpen(false)} />
                {cartItems.map(([id, q]) => {
                  const item = menu.find((m) => m.id === id);
                  return (<div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "12px", background: COLORS.paper, borderRadius: 12, border: `1px solid ${COLORS.line}` }}><div style={{ fontSize: 15, fontWeight: 700 }}>{item.name} {item.portion && <span style={{ fontSize: 12, color: COLORS.textLight }}>({item.portion})</span>}</div><Stepper qty={q} onChange={(nq) => handleSetQty(id, nq)} /></div>);
                })}

                <div style={{ display: "flex", gap: 12, marginTop: 20, marginBottom: 16 }}>
                  <button onClick={() => setOrderType("dine_in")} style={{ flex: 1, padding: "12px", border: `2px solid ${orderType === "dine_in" ? COLORS.copper : COLORS.line}`, background: orderType === "dine_in" ? COLORS.copper : "#fff", color: orderType === "dine_in" ? "#fff" : COLORS.ink, borderRadius: 12, fontWeight: 800, cursor: "pointer", transition: "all 0.2s ease" }}>🍽️ Dine-in</button>
                  <button onClick={() => setOrderType("parcel")} style={{ flex: 1, padding: "12px", border: `2px solid ${orderType === "parcel" ? COLORS.copper : COLORS.line}`, background: orderType === "parcel" ? COLORS.copper : "#fff", color: orderType === "parcel" ? "#fff" : COLORS.ink, borderRadius: 12, fontWeight: 800, cursor: "pointer", transition: "all 0.2s ease" }}>🛍️ Parcel (+₹40)</button>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} style={{ width: 18, height: 18, accentColor: COLORS.copper }} />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>📅 Schedule Order</span>
                  </label>
                  {isScheduled && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                      <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} style={{ ...inputStyle, flex: 1 }} min={new Date().toISOString().split('T')[0]} />
                      <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    </div>
                  )}
                </div>

                <div style={{ background: COLORS.paper2, padding: 16, borderRadius: 16, marginBottom: 16, border: `1px solid ${COLORS.line}` }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, color: COLORS.ink }}>🔐 Quick OTP Authentication</div>
                  {!isLoggedIn ? (
                    <div>
                      {otpStep === "phone" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="tel" placeholder="10-digit Phone" value={custPhone} onChange={(e) => { setCustPhone(e.target.value); checkExistingCustomer(e.target.value); }} style={{ ...inputStyle, flex: 1 }} />
                          <button onClick={handleSendOtp} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer" }}>Send OTP</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="text" placeholder="Enter OTP (e.g. 1234)" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                          <button onClick={handleVerifyOtp} style={{ background: COLORS.success, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer" }}>Verify</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: COLORS.success, fontWeight: 800, fontSize: 14 }}>✓ Verified Customer ({custPhone})</div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 1 }}>Your Details</div>
                  <input type="text" placeholder="Your Name *" value={custName} onChange={(e) => setCustName(e.target.value)} style={inputStyle} />
                  <input type="tel" placeholder="Phone Number *" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} style={inputStyle} />
                  {orderType === "parcel" && (
                    <div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <textarea placeholder="Delivery Address *" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} style={{ ...inputStyle, resize: "none", flex: 1 }} rows={2} />
                        <button onClick={handleGetLocation} title="Get GPS Location" aria-label="Get GPS location" style={{ background: COLORS.sage, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>📍 GPS</button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <input type="text" placeholder="Coupon Code (e.g. EAT20)" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} style={inputStyle} />
                  <button onClick={handleApplyCoupon} style={{ background: COLORS.gold, color: COLORS.ink, border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer" }}>Apply</button>
                </div>

                <div style={{ background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', borderRadius: 16, padding: 16, marginBottom: 20, border: `1.5px solid ${COLORS.gold}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.ink }}>🪙 EatCoins</div>
                    {custPhone.length >= 10 ? (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.sageDark }}>Bal: {currentCoins}</div>
                        <div style={{ fontSize: 11, color: COLORS.gold, fontWeight: 700 }}>{loyaltyTier.name} ({loyaltyTier.discount * 100}% off)</div>
                      </div>
                    ) : (<div style={{ fontSize: 12, color: COLORS.textLight }}>Enter Phone to check</div>)}
                  </div>

                  {custPhone.length >= 10 && (
                    <LoyaltyProgress currentPoints={currentCoins} nextTier={LOYALTY_TIERS.find((t) => t.points > currentCoins) || null} loyaltyRules={loyaltyRules} />
                  )}

                  {custPhone.length >= 10 && (
                    <div style={{ marginTop: 12 }}>
                      {loyaltyRules.rewards.map(r => {
                        const canAfford = currentCoins >= r.cost;
                        const isClaimed = claimedReward?.id === r.id;
                        const pointsNeeded = Math.max(0, r.cost - currentCoins);
                        const progress = Math.min((currentCoins / r.cost) * 100, 100);
                        return (
                          <div key={r.id} style={{ display: 'flex', flexDirection: 'column', background: '#fff', padding: 12, borderRadius: 10, marginBottom: 8, border: `1px solid ${isClaimed ? COLORS.success : COLORS.line}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{r.item}</div>
                                <div style={{ fontSize: 12, color: COLORS.gold, fontWeight: 800 }}>{r.cost} Coins</div>
                              </div>
                              <button onClick={() => { setClaimedReward(isClaimed ? null : r); if (!isClaimed) showToast(`🎁 ${r.item} claimed!`, 'reward'); }} disabled={!canAfford && !isClaimed}
                                style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: isClaimed ? COLORS.success : (canAfford ? COLORS.ink : COLORS.paper2), color: isClaimed || canAfford ? '#fff' : COLORS.textLight, fontWeight: 800, cursor: canAfford ? 'pointer' : 'not-allowed', fontSize: 13 }}>
                                {isClaimed ? "✓ Claimed" : (canAfford ? "Claim 🎁" : `${pointsNeeded} more`)}
                              </button>
                            </div>
                            {!isClaimed && !canAfford && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                                  <span style={{ color: COLORS.textLight }}>Progress</span>
                                  <span style={{ fontWeight: 600, color: COLORS.copper }}>{Math.round(progress)}%</span>
                                </div>
                                <div style={{ width: '100%', height: 4, background: COLORS.paper2, borderRadius: 999, overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.copper})`, borderRadius: 999, transition: 'width 0.5s ease' }} />
                                </div>
                                <div style={{ fontSize: 10, color: COLORS.textLight, marginTop: 2 }}>🪙 Need {pointsNeeded} more coins (₹{Math.ceil(pointsNeeded * loyaltyRules.rate)} spend)</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: COLORS.copper, fontWeight: 700, textAlign: 'center', marginTop: 8 }}>
                    🎁 You will earn +{newEarnedCoins} EatCoins on this order!
                  </div>
                  {loyaltyDiscount > 0 && (
                    <div style={{ fontSize: 13, color: COLORS.sage, fontWeight: 800, textAlign: 'center', marginTop: 4 }}>
                      💰 {loyaltyTier.name} Discount: -{inr(loyaltyDiscount)}
                    </div>
                  )}
                </div>

                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special cooking instructions?" style={{ ...inputStyle, marginBottom: 20, resize: "none" }} rows={2} />

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Payment Method</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <button onClick={() => setPaymentMethod('cash')} style={{ padding: '10px', borderRadius: 10, border: `2px solid ${paymentMethod === 'cash' ? COLORS.copper : COLORS.line}`, background: paymentMethod === 'cash' ? COLORS.copperLight : 'transparent', fontWeight: 700, cursor: 'pointer' }}>💵 Cash</button>
                    <button onClick={() => setPaymentMethod('razorpay')} style={{ padding: '10px', borderRadius: 10, border: `2px solid ${paymentMethod === 'razorpay' ? COLORS.copper : COLORS.line}`, background: paymentMethod === 'razorpay' ? COLORS.copperLight : 'transparent', fontWeight: 700, cursor: 'pointer' }}>💳 Razorpay</button>
                    <button onClick={() => setPaymentMethod('phonepe')} style={{ padding: '10px', borderRadius: 10, border: `2px solid ${paymentMethod === 'phonepe' ? COLORS.copper : COLORS.line}`, background: paymentMethod === 'phonepe' ? COLORS.copperLight : 'transparent', fontWeight: 700, cursor: 'pointer' }}>📱 PhonePe</button>
                    <button onClick={() => setPaymentMethod('gpay')} style={{ padding: '10px', borderRadius: 10, border: `2px solid ${paymentMethod === 'gpay' ? COLORS.copper : COLORS.line}`, background: paymentMethod === 'gpay' ? COLORS.copperLight : 'transparent', fontWeight: 700, cursor: 'pointer' }}>🟢 Google Pay</button>
                  </div>
                </div>

                <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.textLight }}><span>Subtotal</span><span>{inr(subtotal)}</span></div>
                  {appliedDiscount > 0 && (<div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.success }}><span>Coupon Discount ({appliedDiscount}%)</span><span>-{inr(discountAmount)}</span></div>)}
                  {loyaltyDiscount > 0 && (<div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.gold }}><span>Loyalty Discount ({loyaltyTier.name})</span><span>-{inr(loyaltyDiscount)}</span></div>)}
                  {orderType === "parcel" && (<div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.copper }}><span>Delivery Charge</span><span>+{inr(deliveryFee)}</span></div>)}
                  {isScheduled && (<div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.info }}><span>📅 Scheduled</span><span>{scheduleDate} {scheduleTime}</span></div>)}
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18, borderTop: `1px solid ${COLORS.line}`, paddingTop: 8, marginTop: 4 }}>
                    <span>Grand Total</span><span style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.copper }}>{inr(finalTotal)}</span>
                  </div>
                  {claimedReward && (<div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, color: COLORS.success, marginTop: 4 }}><span>+ Free Reward</span><span>{claimedReward.item}</span></div>)}
                </div>

                {orderType === "parcel" && paymentMethod === "cash" && (
                  <div style={{ textAlign: "center", padding: "20px", background: COLORS.paper, border: `2px dashed ${COLORS.line}`, borderRadius: 16, marginBottom: 20 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.ink, marginBottom: 12 }}>Scan to Pay {inr(finalTotal)}</div>
                    <img src={cartQrSrc} alt="UPI QR Code" loading="lazy" style={{ width: 160, height: 160, borderRadius: 14, border: '4px solid #fff', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} />
                  </div>
                )}

                <button onClick={handlePlaceOrder} disabled={isProcessingPayment} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 14, padding: "16px", fontWeight: 800, fontSize: 16, cursor: isProcessingPayment ? 'not-allowed' : 'pointer', width: "100%", opacity: isProcessingPayment ? 0.6 : 1, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }} className="hover-lift smooth-transition">
                  {isProcessingPayment ? '⏳ Processing...' : '🎉 Place Order'}
                </button>
              </>
            )}

            {activeModal === 'gallery' && (
              <>
                <ModalHeader title="🖼️ Photo Gallery" onClose={() => setActiveModal(null)} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                  {gallery.map((imgUrl, idx) => (
                    <img key={idx} src={imgUrl} alt="Gallery item" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; }} />
                  ))}
                </div>
              </>
            )}

            {activeModal === 'orderHistory' && (
              <>
                <ModalHeader title="📜 My Order History" onClose={() => setActiveModal(null)} />
                {myOrders.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                    <div style={{ background: COLORS.paper, padding: 12, borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.copper }}>{myOrders.length}</div>
                      <div style={{ fontSize: 11, color: COLORS.textLight }}>Total Orders</div>
                    </div>
                    <div style={{ background: COLORS.paper, padding: 12, borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.sage }}>{myOrders.filter(o => o.status === "served").length}</div>
                      <div style={{ fontSize: 11, color: COLORS.textLight }}>Completed</div>
                    </div>
                    <div style={{ background: COLORS.paper, padding: 12, borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#4285F4' }}>{myOrders.filter(o => o.status === "served").length > 0 ? '⭐' : '—'}</div>
                      <div style={{ fontSize: 11, color: COLORS.textLight }}>Ready to Review</div>
                    </div>
                  </div>
                )}
                {myOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: "40px 0", color: COLORS.textLight, fontWeight: 600 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>No past orders found.
                    <div style={{ fontSize: 13, marginTop: 8 }}>Start ordering now! 🍽️</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[...myOrders].reverse().map(o => {
                      const orderTotal = o.items.reduce((s, i) => s + (i.price * i.qty), 0) + (o.deliveryFee || 0) - (o.loyaltyDiscount || 0);
                      const isCompleted = o.status === "served";
                      const isCancelled = o.status === "cancelled";
                      return (
                        <div key={o.id} style={{ background: COLORS.paper, border: `1px solid ${isCancelled ? COLORS.error : isCompleted ? COLORS.sage : COLORS.line}`, padding: 16, borderRadius: 14, transition: 'all 0.2s ease', borderLeft: isCancelled ? `4px solid ${COLORS.error}` : isCompleted ? `4px solid ${COLORS.sage}` : `4px solid ${COLORS.copper}`, opacity: isCancelled ? 0.6 : 1 }} className="smooth-transition hover-lift">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontWeight: 800 }}>
                            <span style={{ fontSize: 15 }}>#{o.id.slice(1, 5).toUpperCase()}</span>
                            <span style={{ color: isCancelled ? COLORS.error : isCompleted ? COLORS.sage : STATUS_COLOR[o.status] || COLORS.ink, textTransform: 'uppercase', fontSize: 11, background: isCancelled ? 'rgba(239,68,68,0.1)' : isCompleted ? COLORS.sageLight : COLORS.paper2, padding: '2px 10px', borderRadius: 12 }}>
                              {isCancelled ? "❌ Cancelled" : isCompleted ? "✅ Completed" : o.status === "new" ? "🆕 New" : o.status === "preparing" ? "👨‍🍳 Cooking" : o.status === "ready" ? "✅ Ready" : o.status}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>
                            📅 {new Date(o.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {o.isScheduled && (<span style={{ display: 'block', color: COLORS.info, fontSize: 11 }}>📅 Scheduled: {o.scheduledDate} at {o.scheduledTime}</span>)}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: COLORS.ink }}>
                            {o.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${COLORS.line}`, paddingTop: 10, marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: isCancelled ? COLORS.error : COLORS.copper }}>💰 {inr(orderTotal)}</div>
                              {o.loyaltyDiscount > 0 && (<div style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700 }}>👑 {o.loyaltyTier || 'Loyalty'} discount applied</div>)}
                              {o.payment && (<div style={{ fontSize: 10, color: COLORS.textLight }}>💳 {o.payment}</div>)}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {!isCancelled && (<button onClick={() => reorderOrder(o)} style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${COLORS.sage}`, background: 'transparent', color: COLORS.sage, fontWeight: 700, fontSize: 11, cursor: 'pointer' }} className="smooth-transition hover-lift">🔄 Reorder</button>)}
                              <GoogleReviewButton variant="primary" size="sm" />
                              {!isCompleted && !isCancelled && (o.status === "new" || o.status === "preparing") && (
                                <button onClick={() => cancelOrder(o.id)} style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${COLORS.error}`, background: 'transparent', color: COLORS.error, fontWeight: 700, fontSize: 11, cursor: 'pointer' }} className="smooth-transition hover-lift">❌ Cancel</button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {activeModal === 'coinHistory' && (
              <>
                <ModalHeader title="🪙 My Coin History" onClose={() => setActiveModal(null)} />
                {!custPhone || custPhone.length < 10 ? (
                  <div style={{ textAlign: 'center', padding: "30px 0", color: COLORS.textLight, fontWeight: 600 }}>Please enter your phone number during checkout to view coin history.</div>
                ) : myCoinLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: "40px 0", color: COLORS.textLight, fontWeight: 600 }}>No coin transactions yet. (Balance: {currentCoins})</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8, color: COLORS.gold }}>Current Balance: {currentCoins} EatCoins</div>
                    {[...myCoinLogs].reverse().map((log, idx) => (
                      <div key={idx} style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, padding: 14, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{log.reason}</div>
                          <div style={{ fontSize: 11, color: COLORS.textLight }}>{new Date(log.timestamp).toLocaleString('en-IN')}</div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: log.coins > 0 ? COLORS.success : COLORS.error }}>
                          {log.coins > 0 ? `+${log.coins}` : log.coins} 🪙
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeModal === 'offers' && (
              <>
                <ModalHeader title="🎁 Today's Offers" onClose={() => setActiveModal(null)} />
                {offersList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: "40px 0", color: COLORS.textLight, fontWeight: 600 }}>No active offers currently.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {offersList.map(offer
                                    // ============================================
// 13. STAFF VIEW — V15 (Touch to proceed · Live notifications)
// ============================================

const STAFF_SHORTCUTS = {
  'Ctrl+K': 'Focus first order',
  '↑ / ↓': 'Navigate between orders',
  'Enter / Space': 'Advance selected order',
  'Shift+?': 'Toggle this help panel',
};

const KeyboardHelpModal = memo(({ onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} className="fade-scale" style={{ background: '#fff', padding: 28, borderRadius: 20, width: '90%', maxWidth: 440 }}>
      <h2 style={{ margin: '0 0 20px', fontFamily: "'Outfit', sans-serif" }}>⌨️ Keyboard Shortcuts</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {Object.entries(STAFF_SHORTCUTS).map(([key, desc]) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: COLORS.paper, borderRadius: 10 }}>
            <kbd style={{ background: COLORS.copper, color: '#fff', padding: '4px 10px', borderRadius: 6, fontWeight: 800, fontFamily: 'monospace', fontSize: 12 }}>{key}</kbd>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{desc}</span>
          </div>
        ))}
      </div>
      <button onClick={onClose} style={{ background: COLORS.copper, color: '#fff', border: 'none', borderRadius: 14, padding: '13px 20px', fontWeight: 800, width: '100%', marginTop: 20, cursor: 'pointer' }}>Close</button>
    </div>
  </div>
));

function StaffView({ orders, advanceStatus, requestPinPrompt, calls, resolveCall, cancelOrderByStaff }) {
  const active = orders.filter((o) => o.status !== "served" && o.status !== "cancelled").sort((a, b) => a.createdAt - b.createdAt);
  const activeCalls = calls.filter(c => c.status === 'active');
  const columns = ["new", "preparing", "ready"];
  const newOrderCount = active.filter(o => o.status === "new").length;
  const prevCountRef = useRef(newOrderCount);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    if (newOrderCount > prevCountRef.current) {
      playNotificationSound();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🛎️ New Order Received!', { body: `${newOrderCount} new order${newOrderCount > 1 ? 's' : ''} waiting`, icon: '/icon-192.png', vibrate: [200, 100, 200] });
      }
    }
    prevCountRef.current = newOrderCount;
  }, [newOrderCount]);

  const prevCallsRef = useRef(activeCalls.length);
  useEffect(() => {
    if (activeCalls.length > prevCallsRef.current) {
      const bell = new Audio("https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3");
      bell.play().catch(() => {});
    }
    prevCallsRef.current = activeCalls.length;
  }, [activeCalls.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'k' && e.ctrlKey) { e.preventDefault(); if (active[0]) setSelectedOrderId(active[0].id); }
      if (e.key === 'ArrowUp') { const i = active.findIndex(o => o.id === selectedOrderId); if (i > 0) setSelectedOrderId(active[i - 1].id); }
      if (e.key === 'ArrowDown') { const i = active.findIndex(o => o.id === selectedOrderId); if (i < active.length - 1 && i >= 0) setSelectedOrderId(active[i + 1].id); }
      if ((e.key === 'Enter' || e.key === ' ') && selectedOrderId) { const o = active.find(x => x.id === selectedOrderId); if (o) { e.preventDefault(); advanceStatus(o.id, o.status); } }
      if ((e.key === '?' || e.key === '/') && e.shiftKey) { e.preventDefault(); setShowHelpModal(v => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedOrderId, active, advanceStatus]);

  const handlePrintReceipt = (order) => {
    const w = window.open('', '_blank', 'width=300,height=600');
    if (!w) return;
    const kots = order.kots?.length ? order.kots : [{ kotNumber: 1, items: order.items, createdAt: order.createdAt }];
    const itemsHtml = kots.map(kot => `
      <div style="margin-top:10px;border-top:1px dashed #000;padding-top:6px">
        <strong>KOT #${kot.kotNumber}${kot.isRunning ? ' (RUNNING)' : ''}</strong>
        ${kot.items.map(it => `<div>${it.qty}x ${it.name}</div>`).join('')}
      </div>
    `).join('');
    const totalAmount = order.items.reduce((s, it) => s + (it.price * it.qty), 0) + (order.deliveryFee || 0) - (order.loyaltyDiscount || 0);
    w.document.write(`
      <html><head><title>KOT #${order.id.slice(1,5)}</title>
      <style>body{font-family:'JetBrains Mono',monospace;font-size:12px;padding:10px;width:260px}
      h2,h4{text-align:center;margin:4px 0}</style></head><body>
      <h2>${RESTAURANT.name}</h2>
      <h4>${order.orderType === 'parcel' ? '🛍️ PARCEL' : `🍽️ TABLE ${order.table}`}</h4>
      <p>Order: #${order.id.toUpperCase()}<br/>Customer: ${order.customer.name}</p>
      ${itemsHtml}
      <div style="text-align:right;font-weight:bold;margin-top:10px">Total: ₹${totalAmount}</div>
      <script>window.print();setTimeout(()=>window.close(),500)</script></body></html>
    `);
    w.document.close();
  };

  return (
    <div style={{ padding: "26px 20px 60px", maxWidth: 1200, margin: "0 auto" }}>
      <KitchenNotificationColumn orders={active} selectedOrderId={selectedOrderId} onSelect={setSelectedOrderId} />

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, color: COLORS.ink, fontWeight: 800 }}>🍳 Kitchen Board</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowHelpModal(true)} title="Keyboard Shortcuts" style={{ background: COLORS.paper2, border: `1.5px solid ${COLORS.line}`, borderRadius: 12, padding: "10px 16px", cursor: "pointer", fontWeight: 700 }}>⌨️ Shortcuts</button>
          <button onClick={() => requestPinPrompt("admin")} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 14, padding: "13px 20px", fontWeight: 700, cursor: 'pointer' }}>⚙️ Admin</button>
        </div>
      </div>
      <div style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 24, fontWeight: 600 }}>
        👆 Tap any button to advance. No sliding needed.
      </div>

      {newOrderCount > 0 && (
        <div className="slide-up" style={{ background: 'rgba(226,89,56,0.1)', border: `2px solid ${COLORS.copper}`, borderRadius: 16, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🛎️</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.copper }}>{newOrderCount} New Order{newOrderCount > 1 ? 's' : ''}!</div>
            <div style={{ fontSize: 13, color: COLORS.textLight }}>Tap the card to advance</div>
          </div>
        </div>
      )}

      {showHelpModal && <KeyboardHelpModal onClose={() => setShowHelpModal(false)} />}

      {activeCalls.length > 0 && (
        <div className="slide-up" style={{ background: "rgba(239,68,68,0.1)", border: `2px solid ${COLORS.error}`, borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <h3 style={{ color: COLORS.error, margin: "0 0 12px 0" }}>🚨 Waiter Requested!</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {activeCalls.map(c => (
              <div key={c.id} style={{ background: '#fff', padding: "12px 16px", borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>Table {c.table}</span>
                <button onClick={() => resolveCall(c.id)} style={{ background: COLORS.success, color: '#fff', border: 'none', padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>✓ Resolved</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
        {columns.map((status) => {
          const list = active.filter((o) => o.status === status);
          return (
            <div key={status} style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 18, padding: 20 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: STATUS_COLOR[status] }} />
                <div style={{ fontSize: 15, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em", color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, background: STATUS_COLOR[status], color: "#fff", padding: "3px 10px", borderRadius: 14, fontWeight: 700, marginLeft: "auto" }}>{list.length}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {list.map((o) => {
                  const isSelected = selectedOrderId === o.id;
                  const runningCount = (o.kots || []).filter(k => k.isRunning).length;
                  return (
                    <div key={o.id} onClick={() => setSelectedOrderId(o.id)} style={{ background: isSelected ? COLORS.copper : '#fff', border: `2px solid ${isSelected ? COLORS.copper : COLORS.line}`, borderRadius: 16, padding: 18, boxShadow: isSelected ? '0 12px 24px rgba(226,89,56,0.2)' : '0 8px 24px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: isSelected ? '#fff' : (o.orderType === "parcel" ? COLORS.rust : COLORS.ink), display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                          {o.orderType === "parcel" ? "🛍️ PARCEL" : `🍽️ Table ${o.table}`}
                          <KotBadge kots={o.kots} />
                          {runningCount > 0 && (<span style={{ background: isSelected ? 'rgba(255,255,255,0.3)' : COLORS.info, color: '#fff', fontSize: 10, padding: "2px 6px", borderRadius: 8, fontWeight: 800 }}>RUNNING</span>)}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'rgba(255,255,255,0.85)' : COLORS.textLight, background: isSelected ? 'rgba(255,255,255,0.2)' : COLORS.paper2, padding: '4px 10px', borderRadius: 12 }}>{timeAgo(o.createdAt)}</div>
                      </div>

                      <div style={{ borderTop: isSelected ? `1px solid rgba(255,255,255,0.3)` : `1.5px dashed ${COLORS.line}`, paddingTop: 14, marginBottom: 14 }}>
                        {o.items.map((it, idx) => (
                          <div key={idx} style={{ fontSize: 15, marginBottom: 6, fontWeight: 600, color: isSelected ? '#fff' : COLORS.ink }}>
                            <span style={{ fontWeight: 800, display: 'inline-block', width: 28 }}>{it.qty}×</span> {it.name}
                            {it.kotNumber > 1 && (<span style={{ fontSize: 10, marginLeft: 6, color: isSelected ? 'rgba(255,255,255,0.7)' : COLORS.info, fontWeight: 700 }}>KOT#{it.kotNumber}</span>)}
                          </div>
                        ))}
                        {o.claimedReward && (<div style={{ fontSize: 14, marginTop: 10, padding: '6px 10px', background: isSelected ? 'rgba(255,255,255,0.2)' : COLORS.sageLight, color: isSelected ? '#fff' : COLORS.sageDark, borderRadius: 8, fontWeight: 800 }}>🎁 FREE: {o.claimedReward}</div>)}
                        {o.payment && (<div style={{ fontSize: 11, marginTop: 6, color: isSelected ? 'rgba(255,255,255,0.7)' : COLORS.textLight, fontWeight: 600 }}>💳 {o.payment} {o.paid ? '✅' : '⏳'}</div>)}
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button onClick={(e) => { e.stopPropagation(); advanceStatus(o.id, status); }} style={{ flex: 1, padding: "14px 12px", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", transition: "all 0.15s ease", background: status === "ready" ? COLORS.sage : (status === "preparing" ? COLORS.copper : COLORS.ink), color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                          {status === "new" ? "👨‍🍳 Start Cooking" : status === "preparing" ? "✅ Mark Ready" : "🍽️ Mark Served"}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handlePrintReceipt(o); }} title="Print KOT" style={{ background: isSelected ? 'rgba(255,255,255,0.25)' : COLORS.paper2, color: isSelected ? '#fff' : COLORS.ink, border: 'none', width: 48, height: 48, borderRadius: 12, fontSize: 20, cursor: 'pointer' }}>🖨️</button>
                        <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Cancel order #${o.id.slice(1, 5)}?`)) { cancelOrderByStaff && cancelOrderByStaff(o.id); } }} title="Cancel order" style={{ background: 'transparent', color: isSelected ? '#fff' : COLORS.error, border: `1.5px solid ${isSelected ? 'rgba(255,255,255,0.5)' : COLORS.error}`, width: 48, height: 48, borderRadius: 12, fontSize: 18, cursor: 'pointer', fontWeight: 800 }}>✕</button>
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && (
                  <div style={{ textAlign: "center", padding: "20px 0", color: COLORS.textLight, fontSize: 13, fontStyle: "italic" }}>No orders</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
