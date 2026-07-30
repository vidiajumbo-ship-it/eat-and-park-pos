import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { db } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  addDoc,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import QRCode from 'qrcode.react';

/* ═══════════════════════════════════════════════════════════════════════════════════
   🍽️ EAT & PARK RESTAURANT — FINAL V14.1 (FIXED & ENHANCED)
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

// Use environment variables for sensitive keys (fallback to placeholders)
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
  for (const t of LOYALTY_TIERS) {
    if (points >= t.points) tier = t;
  }
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
// 4. REUSABLE COMPONENTS (memoized for performance)
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

const Badge = memo(({ children, color }) => {
  return <span style={{ background: color, color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 999, fontWeight: 700, display: "inline-block" }}>{children}</span>;
});

const Stepper = memo(({ qty, onChange }) => {
  const btnStyle = { width: 28, height: 28, borderRadius: "50%", border: `1.5px solid ${COLORS.copper}`, background: "transparent", color: COLORS.copper, fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" };
  return <div style={{ display: "flex", alignItems: "center", gap: 10 }}><button onClick={() => onChange(Math.max(0, qty - 1))} style={btnStyle} className="smooth-transition" aria-label="Decrease quantity">−</button><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, minWidth: 16, textAlign: "center", fontSize: 15 }}>{qty}</span><button onClick={() => onChange(qty + 1)} style={btnStyle} className="smooth-transition" aria-label="Increase quantity">+</button></div>;
});

const AddBtnStepper = memo(({ qty, onChange, available }) => {
  if (!available) return <div style={{ color: COLORS.rust, background: COLORS.paper2, borderRadius: 8, fontWeight: 700, fontSize: 11, padding: "6px 10px", textAlign: "center", width: 80, boxSizing: "border-box" }}>Out of stock</div>;
  if (!qty) return <button onClick={() => onChange(1)} aria-label="Add item to cart" style={{ color: COLORS.sage, background: "#fff", border: `2px solid ${COLORS.sage}`, borderRadius: 8, fontWeight: 800, fontSize: 12, padding: "6px 16px", cursor: "pointer", width: 80, boxShadow: "0 4px 12px rgba(74,124,89,0.15)" }} className="smooth-transition hover-lift scale-bounce">ADD</button>;
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: 80, padding: "4px", background: "#fff", border: `2px solid ${COLORS.sage}`, borderRadius: 8, boxShadow: "0 4px 12px rgba(74,124,89,0.15)" }}><button onClick={() => onChange(Math.max(0, qty - 1))} aria-label="Decrease quantity" style={{ width: 22, height: 22, border: "none", color: COLORS.sage, background: "transparent", fontSize: 18, cursor: "pointer" }} className="smooth-transition">−</button><span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 14, color: COLORS.sage }}>{qty}</span><button onClick={() => onChange(qty + 1)} aria-label="Increase quantity" style={{ width: 22, height: 22, border: "none", color: COLORS.sage, background: "transparent", fontSize: 18, cursor: "pointer" }} className="smooth-transition">+</button></div>;
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
      <input type="text" value={localValue} onChange={handleChange} placeholder={placeholder} aria-label="Search menu items" style={{ padding: "12px 16px 12px 42px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", width: "100%", boxSizing: "border-box", background: "#fff" }} />
      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: COLORS.textLight }}>🔍</span>
      {localValue && ( <button onClick={() => { setLocalValue(""); onChange(""); }} aria-label="Clear search" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: COLORS.textLight, padding: "4px 8px" }}>✕</button> )}
    </div>
  );
});

const SlideButton = memo(({ onComplete, text, bg = COLORS.sage }) => {
  const [val, setVal] = useState(0);
  return (
    <div style={{position: 'relative', width: '100%', height: 48, background: COLORS.paper2, borderRadius: 14, overflow: 'hidden', border: `1px solid ${COLORS.line}`}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${val}%`, background: bg, transition: val === 0 ? 'width 0.3s' : 'none'}} />
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: val > 50 ? '#fff' : COLORS.text, pointerEvents: 'none', zIndex: 2}}>
        {text} <span style={{marginLeft: 8, fontSize: 18}}>»</span>
      </div>
      <input type="range" min="0" max="100" value={val} onChange={(e) => setVal(Number(e.target.value))} onMouseUp={() => { if(val > 85) onComplete(); setVal(0); }} onTouchEnd={() => { if(val > 85) onComplete(); setVal(0); }} aria-label={text} style={{opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute', top: 0, left: 0, zIndex: 3}} />
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

const ModalHeader = memo(({ title, onClose }) => {
  return <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 16 }}><div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 700 }}>{title}</div><button onClick={onClose} aria-label="Close" style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>✕</button></div>;
});

const StatCard = memo(({ label, value, icon, color }) => {
  return <div style={{ background: "#fff", border: `1.5px solid ${COLORS.line}`, borderRadius: 18, padding: "24px 20px", transition: "all 0.3s ease", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }} className="smooth-transition hover-lift">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}><div style={{ fontSize: 13, color: COLORS.textLight, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em" }}>{label}</div><span style={{ fontSize: 28 }}>{icon}</span></div>
    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, color: color }}>{value}</div>
  </div>;
});

const SidebarBtn = memo(({ icon, text, onClick, highlight }) => {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderRadius: 14, background: highlight ? COLORS.copperLight : COLORS.paper, border: highlight ? `1.5px solid ${COLORS.copper}` : `1px solid ${COLORS.line}`, color: highlight ? COLORS.copperDark : COLORS.ink, fontSize: 15, fontWeight: 700, cursor: "pointer", textAlign: "left", transition: "all 0.2s ease", width: '100%', boxShadow: highlight ? "0 4px 12px rgba(226,89,56,0.15)" : "none" }}>
      <span style={{ fontSize: 20 }}>{icon}</span> <span>{text}</span>
    </button>
  );
});

// ---------- new helper components ----------
const ComboCard = memo(({ combo, onAdd }) => {
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
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
};

// ============================================
// 6. NOTIFICATION SOUND (single instance)
// ============================================

const notificationAudio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
notificationAudio.volume = 0.5;

const playNotificationSound = () => {
  try {
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(e => console.log("Sound play error:", e));
  } catch(e) {
    console.log("Sound error:", e);
  }
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
// 9. CHAT BOX COMPONENT (with local timestamp fallback)
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
          // Fallback to local time if serverTimestamp not yet set
          if (!data.timestamp) data.timestamp = Date.now();
          return { id: doc.id, ...data };
        });
        setMessages(msgs);
      });
      return unsubscribe;
    } catch (e) {
      console.error('Chat error:', e);
    }
  }, [orderId, messagesRef]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await addDoc(messagesRef, {
        text: newMessage,
        senderId: customerId,
        senderName: customerId === 'customer' ? 'Customer' : 'Restaurant',
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (e) {
      console.error('Chat send error:', e);
    }
  };

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, background: '#fff' }}>
      <div style={{ maxHeight: 250, overflowY: 'auto', marginBottom: 8 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ textAlign: msg.senderId === customerId ? 'right' : 'left', margin: '4px 0' }}>
            <span style={{
              background: msg.senderId === customerId ? COLORS.copper : '#e9ecef',
              color: msg.senderId === customerId ? '#fff' : '#000',
              padding: '6px 12px',
              borderRadius: 12,
              display: 'inline-block',
              maxWidth: '80%'
            }}>
              {msg.text}
            </span>
            {msg.senderName && <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{msg.senderName}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 4 }}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
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
  const styles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    textDecoration: 'none',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    ...buttonStyles[variant],
    ...sizeStyles[size]
  };
  return (
    <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer" style={styles} className="smooth-transition hover-lift">
      <span style={{ fontSize: size === 'lg' ? 24 : size === 'sm' ? 14 : 18 }}>⭐</span>
      {showText && <span>Rate on Google</span>}
    </a>
  );
});

// ============================================
// 11. PAYMENT PROCESSING (Razorpay)
// ============================================

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const processRazorpayPayment = async (amount, orderId, customerName, customerPhone) => {
  const isScriptLoaded = await loadRazorpayScript();
  if (!isScriptLoaded) {
    alert("⚠️ Payment gateway could not load. Please try again.");
    return false;
  }
  const options = {
    key: RAZORPAY_KEY,
    amount: Math.round(amount * 100),
    currency: "INR",
    name: RESTAURANT.name,
    description: `Order #${orderId}`,
    prefill: { name: customerName, contact: customerPhone },
    theme: { color: COLORS.copper },
    handler: function(response) { console.log("Payment successful:", response); return true; },
    modal: { ondismiss: function() { console.log("Payment cancelled"); return false; } }
  };
  const razorpay = new window.Razorpay(options);
  razorpay.open();
  return true;
};

// ============================================
// 12. CUSTOMER VIEW (with all features)
// ============================================

function CustomerView({ menu, orders, placeOrder, bookEvent, gallery, offersList, table, setTable, requestPinPrompt, settings, isDark, setIsDark, requestWaiter, loyaltyRules, loyaltyUsers, coinHistory, setOrdersState }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
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

  // ---------- Combo & Flash Sale static data ----------
  const comboOffers = [
    {
      id: 'combo1',
      name: 'Family Combo (Pizza + Biryani + Paneer)',
      items: [
        { id: 'f2', name: 'Eat & Park Special Pizza', price: 280, quantity: 1, portion: '' },
        { id: 'br5', name: 'Chicken Biryani', price: 210, quantity: 1, portion: '' },
        { id: 'pn1', name: 'Paneer Masala', price: 250, quantity: 1, portion: '' }
      ],
      totalPrice: 740,
      discount: 20,
      finalPrice: 592,
      image: '🍕'
    },
    {
      id: 'combo2',
      name: 'Weekend Special (Butter Chicken + Naan + Soft Drink)',
      items: [
        { id: 'nv8', name: 'Chicken Butter Masala', price: 350, quantity: 1, portion: '' },
        { id: 'b8', name: 'Garlic Naan', price: 70, quantity: 2, portion: '' },
        { id: 'd10', name: 'Cold Drink', price: 50, quantity: 2, portion: '' }
      ],
      totalPrice: 590,
      discount: 25,
      finalPrice: 442,
      image: '🍗'
    }
  ];
  const flashSaleItems = [
    { id: 'nv19', name: 'Fish Curry', price: 449, discountPrice: 299, stock: 10 }
  ];

  // ---------- Derived state ----------
  const filteredItems = useMemo(() => {
    let items = searchQuery.trim() ? menu : menu.filter((m) => m.category === category);
    items = items.filter((m) => {
      if (vegOnly && !m.veg) return false;
      if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); return m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q); }
      return true;
    });
    return items;
  }, [menu, category, searchQuery, vegOnly]);

  const emptyReason = searchQuery.trim() ? "search_no_results" : (vegOnly ? "veg_filtered" : "category_empty");

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

  // ---------- Toast helper ----------
  const showToast = useCallback((msg, type = 'info') => {
    const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
    if (type === 'reward' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
    if (type === 'order') playNotificationSound();
    setToast(msg); setToastType(type);
    const timeout = setTimeout(() => setToast(null), config.duration);
    return () => clearTimeout(timeout);
  }, []);

  // ---------- Persistence ----------
  useEffect(() => {
    const savedCustomer = localStorage.getItem('eatpark_customer');
    if (savedCustomer) {
      try {
        const data = JSON.parse(savedCustomer);
        if (data.name) setCustName(data.name);
        if (data.phone) setCustPhone(data.phone);
        if (data.address) setCustAddress(data.address);
        if (data.isLoggedIn) setIsLoggedIn(true);
      } catch(e) {}
    }
    const savedCart = localStorage.getItem('eatpark_cart');
    if (savedCart) {
      try { setCart(JSON.parse(savedCart)); } catch(e) {}
    }
    const savedOrders = localStorage.getItem('eatpark_orders');
    if (savedOrders) {
      try {
        const ordersData = JSON.parse(savedOrders);
        setMyOrderIds(ordersData.map(o => o.id));
      } catch(e) {}
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (custName || custPhone) {
      localStorage.setItem('eatpark_customer', JSON.stringify({
        name: custName,
        phone: custPhone,
        address: custAddress,
        isLoggedIn: isLoggedIn
      }));
    }
  }, [custName, custPhone, custAddress, isLoggedIn]);

  useEffect(() => {
    if (Object.keys(cart).length > 0) {
      localStorage.setItem('eatpark_cart', JSON.stringify(cart));
    }
  }, [cart]);

  // ---------- Handlers ----------
  const handleSetQty = useCallback((id, q) => {
    const oldQ = cart[id] || 0;
    setCart((c) => ({ ...c, [id]: q }));
    if (q > oldQ && q === 1) {
       const options = getSmartSuggestionPool(menu, cart);
       if (options.length > 0) {
          const randomSug = options[Math.floor(Math.random() * options.length)];
          setAiSuggestion(randomSug);
          setTimeout(() => setAiSuggestion(null), 6000);
       }
    }
  }, [cart, menu]);

  const toggleFavorite = useCallback((itemId) => {
    setFavorites(prev => {
      if (prev.includes(itemId)) {
        showToast('Removed from favorites', 'info');
        return prev.filter(id => id !== itemId);
      } else {
        showToast('Added to favorites!', 'success');
        return [...prev, itemId];
      }
    });
  }, [setFavorites, showToast]);

  const sendPushNotification = useCallback((title, message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/icon-192.png',
        vibrate: [200, 100, 200],
        requireInteraction: true
      });
    }
  }, []);

  const cancelOrder = useCallback(async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    try {
      await updateDoc(doc(db, "orders", orderId), { status: "cancelled", cancelledAt: Date.now() });
      setOrdersState(prev => prev.map(o => o.id === orderId ? { ...o, status: "cancelled", cancelledAt: Date.now() } : o));
      showToast("❌ Order cancelled successfully", 'warning');
      sendPushNotification("Order Cancelled", `Order #${orderId.slice(1,5)} has been cancelled`);
    } catch(e) {
      console.error("Cancel error:", e);
      showToast("⚠️ Failed to cancel order", 'error');
    }
  }, [setOrdersState, showToast, sendPushNotification]);

  const reorderOrder = useCallback((order) => {
    const newCart = {};
    order.items.forEach(item => {
      newCart[item.itemId] = (newCart[item.itemId] || 0) + item.qty;
    });
    setCart(newCart);
    setCartOpen(true);
    showToast("🔄 Order items added to cart!", 'success');
  }, [setCart, showToast]);

  const addToExistingOrder = useCallback(async (orderId, items) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        const existingItems = orderData.items || [];
        const newItems = [...existingItems];
        items.forEach(item => {
          const existing = newItems.find(i => i.itemId === item.id);
          if (existing) existing.qty += 1;
          else newItems.push({ itemId: item.id, name: item.name, price: item.price, qty: 1, portion: item.portion || "" });
        });
        await updateDoc(orderRef, { items: newItems, updatedAt: Date.now() });
        showToast("✅ Items added to existing order!", 'success');
        playNotificationSound();
        sendPushNotification("Order Updated", `New items added to order #${orderId.slice(1,5)}`);
      }
    } catch(e) {
      console.error("Add to order error:", e);
      showToast("⚠️ Failed to add items", 'error');
    }
  }, [showToast, sendPushNotification]);

  // ---------- OTP handlers ----------
  const handleSendOtp = () => {
    if (!custPhone || custPhone.length < 10) { showToast("⚠️ Enter valid 10-digit phone", 'error'); return; }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(code);
    setOtpStep("verify");
    showToast(`🔐 Demo OTP sent: ${code}`, 'success');
  };

  const handleVerifyOtp = () => {
    if (otpCode === generatedOtp || otpCode === "1234") {
      setIsLoggedIn(true);
      setOtpStep("phone");
      const saveUserToFirebase = async () => {
        try {
          const userRef = doc(db, "customers", custPhone);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              phone: custPhone,
              name: custName || "Guest",
              address: custAddress || "",
              createdAt: Date.now(),
              lastLogin: Date.now(),
              totalOrders: 0,
              totalSpent: 0
            });
            showToast("✅ New customer registered!", 'success');
          } else {
            await updateDoc(userRef, { lastLogin: Date.now(), name: custName || userSnap.data().name });
            showToast("✅ Welcome back!", 'success');
          }
          localStorage.setItem('eatpark_customer', JSON.stringify({
            name: custName,
            phone: custPhone,
            address: custAddress,
            isLoggedIn: true
          }));
        } catch (error) {
          console.error("Error saving user:", error);
          showToast("⚠️ Could not save user info", 'error');
        }
      };
      saveUserToFirebase();
    } else {
      showToast("❌ Incorrect OTP", 'error');
    }
  };

  const checkExistingCustomer = useCallback(async (phone) => {
    if (phone.length === 10) {
      try {
        const userRef = doc(db, "customers", phone);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setCustName(data.name || "");
          setCustAddress(data.address || "");
          setIsLoggedIn(true);
          showToast(`👋 Welcome back ${data.name || 'Guest'}!`, 'success');
        }
      } catch(e) {
        console.log("Customer check error:", e);
      }
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

  // ---------- Place Order ----------
  const handlePlaceOrder = useCallback(async () => {
    if (cartItems.length === 0) return;
    if (!custName.trim()) { showToast("⚠️ Please enter your Name", 'error'); return; }
    if (!custPhone.trim() || custPhone.length < 10) { showToast("⚠️ Please enter valid 10-digit Phone", 'error'); return; }
    if (orderType === "parcel" && !custAddress.trim()) { showToast("⚠️ Please enter Delivery Address", 'error'); return; }

    setIsProcessingPayment(true);
    try {
      if (paymentMethod === "razorpay") {
        const success = await processRazorpayPayment(finalTotal, uid("o"), custName, custPhone);
        if (!success) {
          setIsProcessingPayment(false);
          return;
        }
      } else if (paymentMethod === "phonepe") {
        showToast("📱 Redirecting to PhonePe...", 'info');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const orderId = uid("o");
      const itemStrings = cartItems.map(([id, qty]) => { const m = menu.find((mi) => mi.id === id); return `${qty}x ${m.name}`; }).join(", ");
      const claimedText = claimedReward ? `\n🎁 *Free Reward Claimed:* ${claimedReward.item}` : "";
      const scheduleText = isScheduled && scheduleDate && scheduleTime ? `\n📅 *Scheduled:* ${scheduleDate} at ${scheduleTime}` : "";

      const waText = `🚨 *NEW ORDER ALERT* (#${orderId.slice(1,5).toUpperCase()})\n\n`
                 + `*Type:* ${orderType === 'parcel' ? '🛍️ Parcel (Delivery ₹40)' : `🍽️ Table ${table}`}\n`
                 + `*Customer:* ${custName} (${custPhone})\n`
                 + (orderType === 'parcel' ? `*Address:* ${custAddress}\n\n` : `\n`)
                 + `*Items:* ${itemStrings}${claimedText}\n`
                 + (appliedDiscount > 0 ? `*Coupon Discount:* ${appliedDiscount}%\n` : ``)
                 + (loyaltyDiscount > 0 ? `*Loyalty Discount:* ${loyaltyTier.name} (${loyaltyTier.discount * 100}%)\n` : ``)
                 + `*Total Bill:* ₹${finalTotal}\n`
                 + `*Payment:* ${paymentMethod}\n`
                 + scheduleText
                 + (notes ? `*Notes:* ${notes}` : ``);
                 
      const link = document.createElement('a'); link.href = `https://wa.me/${RESTAURANT.whatsapp}?text=${encodeURIComponent(waText)}`; link.target = '_blank'; document.body.appendChild(link); link.click(); document.body.removeChild(link);

      const order = { 
        id: orderId, 
        table, 
        orderType, 
        customer: { name: custName, phone: custPhone, address: orderType === "parcel" ? custAddress : "" }, 
        items: cartItems.map(([id, qty]) => { const m = menu.find((mi) => mi.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty }; }), 
        claimedReward: claimedReward ? claimedReward.item : null, 
        rewardUsedCoins: claimedReward ? claimedReward.cost : 0, 
        earnedCoins: newEarnedCoins, 
        discount: appliedDiscount, 
        loyaltyDiscount: loyaltyDiscount,
        loyaltyTier: loyaltyTier.name,
        deliveryFee, 
        notes, 
        payment: paymentMethod,
        paymentStatus: paymentMethod === "cash" ? "pending" : "paid",
        status: "new", 
        paid: paymentMethod !== "cash",
        createdAt: Date.now(),
        scheduledDate: isScheduled ? scheduleDate : null,
        scheduledTime: isScheduled ? scheduleTime : null,
        isScheduled: isScheduled
      };
      
      const orderHistory = JSON.parse(localStorage.getItem('eatpark_orders') || '[]');
      orderHistory.push(order);
      localStorage.setItem('eatpark_orders', JSON.stringify(orderHistory));
      localStorage.setItem('eatpark_last_order', JSON.stringify(order));
      
      const customerData = JSON.parse(localStorage.getItem('eatpark_customer') || '{}');
      customerData.totalOrders = (customerData.totalOrders || 0) + 1;
      customerData.totalSpent = (customerData.totalSpent || 0) + finalTotal;
      customerData.lastOrderDate = Date.now();
      localStorage.setItem('eatpark_customer', JSON.stringify(customerData));
      
      await placeOrder(order, claimedReward ? claimedReward.cost : 0); 
      
      try {
        const userRef = doc(db, "customers", custPhone);
        await updateDoc(userRef, {
          totalOrders: customerData.totalOrders,
          totalSpent: customerData.totalSpent,
          lastOrderDate: Date.now()
        });
      } catch(e) {
        console.log("Customer update error:", e);
      }
      
      playNotificationSound();
      sendPushNotification(
        "🛎️ New Order Received!",
        `Order #${orderId.slice(1,5)} from ${custName} - ₹${finalTotal}`
      );
      
      setMyOrderIds([...myOrderIds, order.id]); 
      setCart({}); 
      localStorage.removeItem('eatpark_cart');
      setNotes(""); 
      setClaimedReward(null);
      setCartOpen(false); 
      setActiveModal('track'); 
      setIsScheduled(false);
      setScheduleDate("");
      setScheduleTime("");
      showToast("🎉 Order Placed Successfully!", 'success');
      
      setTimeout(() => {
        showToast("⭐ Love our food? Rate us on Google!", 'info');
      }, 4000);
      
    } catch(e) {
      console.error("Order error:", e);
      showToast("⚠️ Failed to place order. Please try again.", 'error');
    } finally {
      setIsProcessingPayment(false);
    }
  }, [cartItems, custName, custPhone, custAddress, orderType, table, paymentMethod, finalTotal, claimedReward, isScheduled, scheduleDate, scheduleTime, appliedDiscount, loyaltyDiscount, loyaltyTier, notes, menu, placeOrder, sendPushNotification, myOrderIds, showToast]);

  // ---------- Booking handler ----------
  const handleBooking = async () => {
    if(!bookData.name || !bookData.phone || !bookData.date || !bookData.time || !bookData.guests) { showToast("⚠️ Please fill all fields", 'error'); return; }
    const newBooking = { ...bookData, type: bookType, id: uid("b"), status: "pending", createdAt: Date.now() };
    await bookEvent(newBooking); setConfirmedBooking(newBooking); setBookData({ name: "", phone: "", date: "", time: "", guests: "" }); showToast("✅ Booking Request Sent!", 'success');
  };

  // ---------- Combo & Flash handlers ----------
  const addComboToCart = useCallback((combo) => {
    combo.items.forEach(item => {
      setCart(prev => {
        const existing = prev[item.id];
        return { ...prev, [item.id]: existing ? existing + item.quantity : item.quantity };
      });
    });
    showToast(`🎉 ${combo.name} added to cart!`, 'success');
  }, [showToast]);

  const addFlashSaleToCart = useCallback((item) => {
    setCart(prev => {
      const existing = prev[item.id];
      return { ...prev, [item.id]: existing ? existing + 1 : 1 };
    });
    showToast(`⚡ ${item.name} added to cart at special price!`, 'success');
  }, [showToast]);

  // ---------- Render ----------
  const inputStyle = { padding: "12px 16px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", width: "100%", boxSizing: "border-box", transition: "all 0.2s ease" };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: cartCount ? 120 : 60, background: "var(--bg-color, #fff)", minHeight: "100vh", position: "relative" }}>
      {toast && <Toast message={toast} type={toastType} />}

      {orders.filter(o => o.status === "new" && !myOrderIds.includes(o.id)).length > 0 && (
        <div style={{ position: "fixed", top: 16, right: 16, background: COLORS.copper, color: "#fff", padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, zIndex: 100, boxShadow: "0 4px 12px rgba(226,89,56,0.4)", animation: "notificationPulse 2s ease-in-out infinite" }} className="notification-pulse">🔔 New Order!</div>
      )}

      <button onClick={() => {requestWaiter(table); showToast("🔔 Waiter has been notified!", 'success');}} aria-label="Call waiter to your table" style={{ position: "fixed", top: 80, right: 16, background: COLORS.rust, color: "#fff", border: "none", borderRadius: 20, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 8px 24px rgba(192,57,43,0.4)", cursor: "pointer", zIndex: 60, fontSize: 13, fontWeight: 800 }} className="smooth-transition hover-lift scale-bounce" title="Call Waiter">🔔 Waiter Call</button>

      <div style={{ position: "relative", height: 220, borderRadius: "0 0 24px 24px", overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", marginBottom: 16 }}>
        <div className="keep-color" style={{ position: "absolute", inset: 0, backgroundImage: `url('${settings?.heroImage || "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80"}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="keep-color" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,26,26,0.9) 0%, rgba(26,26,26,0.3) 60%, rgba(26,26,26,0.1) 100%)" }} />
        <div className="keep-color" style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.25)", backdropFilter: "blur(12px)", padding: "6px 12px", borderRadius: 20, color: "#fff", display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.3)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>Table</span>
          <select value={table} onChange={(e) => setTable(Number(e.target.value))} aria-label="Select table number" style={{ background: "transparent", color: "#fff", border: "none", fontWeight: 800, fontSize: 16, outline: "none", appearance: "none" }}>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (<option key={n} value={n} style={{color: '#000'}}>{n}</option>))}</select>
        </div>
        <div className="keep-color" style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, color: "#fff", margin: "0 0 4px", textShadow: "0 4px 12px rgba(0,0,0,0.6)", fontWeight: 800 }}>{RESTAURANT.name}</h1>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.9)", margin: 0, fontWeight: 500 }}>{RESTAURANT.tagline}</p>
        </div>
      </div>

      {/* Daily Specials Banner */}
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
        <div style={{ padding: "0 16px", marginBottom: 12 }}>
          <button onClick={() => setActiveModal('track')} style={{ width: "100%", background: COLORS.sageLight, border: `2px solid ${COLORS.sage}`, color: COLORS.sageDark, borderRadius: 14, padding: "12px", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: 14 }} className="smooth-transition hover-lift"><span>📦 {myActiveOrders.length} Active Order{myActiveOrders.length > 1 ? 's' : ''}</span><span>Track ➔</span></button>
        </div>
      )}

      {/* COMBO OFFERS SECTION */}
      {!searchQuery.trim() && (
        <div style={{ padding: "16px", borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: COLORS.ink, marginBottom: 12 }}>🎯 Combo Offers</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {comboOffers.map(combo => <ComboCard key={combo.id} combo={combo} onAdd={() => addComboToCart(combo)} />)}
          </div>
        </div>
      )}

      {/* FLASH SALE SECTION */}
      {!searchQuery.trim() && flashSaleItems.length > 0 && (
        <div style={{ padding: "16px", borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: COLORS.rust, marginBottom: 12 }}>⚡ Flash Sale</h3>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
            {flashSaleItems.map(item => <FlashSaleItem key={item.id} item={item} onAdd={() => addFlashSaleToCart(item)} />)}
          </div>
        </div>
      )}

      {!searchQuery.trim() && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "8px 16px", scrollbarWidth: "none", borderBottom: `1px solid ${COLORS.line}` }}>
          {CATEGORIES.map((c) => ( <button key={c} onClick={() => setCategory(c)} style={{ whiteSpace: "nowrap", padding: "8px 16px", borderRadius: 12, border: `1.5px solid ${category === c ? COLORS.copper : COLORS.line}`, background: category === c ? COLORS.copper : "transparent", color: category === c ? "#fff" : COLORS.ink, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }} className="smooth-transition">{c}</button> ))}
        </div>
      )}

      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <button onClick={() => setVegOnly(!vegOnly)} aria-label={vegOnly ? "Showing vegetarian only, tap to show all" : "Showing all items, tap to filter vegetarian"} style={{ padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${vegOnly ? COLORS.sage : COLORS.line}`, background: vegOnly ? COLORS.sageLight : "transparent", color: vegOnly ? COLORS.sageDark : COLORS.textLight, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><VegDot veg={true} /> <span style={{fontSize: 13}}>{vegOnly ? "Veg" : "All"}</span></button>
        </div>

        {filteredItems.length === 0 && <EmptyState reason={emptyReason} />}

        {filteredItems.map((item) => {
          const isFavorite = favorites.includes(item.id);
          return (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${COLORS.line}`, gap: 12, opacity: item.available ? 1 : 0.6 }} className="smooth-slide-up">
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <VegDot veg={item.veg} />
                  {item.portion && <span style={{fontSize: 11, background: COLORS.paper2, color: COLORS.text, padding: "2px 6px", borderRadius: 4, fontWeight: 700}}>{item.portion}</span>}
                  {item.isBestseller && <span style={{fontSize: 11, background: COLORS.copperLight, color: COLORS.copperDark, padding: "2px 6px", borderRadius: 4, fontWeight: 800}}>🔥 Bestseller</span>}
                  {!item.available && <span style={{fontSize: 11, color: COLORS.rust, fontWeight: 800}}>Out of Stock</span>}
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: COLORS.ink, fontWeight: 700, marginBottom: 2 }}>{item.name}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: COLORS.copper, fontWeight: 800, marginBottom: 4 }}>{inr(item.price)}</div>
                {item.desc && <div style={{ fontSize: 12, color: COLORS.textLight, lineHeight: 1.4, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.desc}</div>}
              </div>
              <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
                <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="keep-color" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, filter: item.available ? 'none' : 'grayscale(100%)' }} 
                  onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; }} 
                />
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
         <div className="smooth-slide-up" style={{position: 'fixed', bottom: cartCount>0 ? 100 : 20, left: 16, right: 16, background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', padding: 14, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 4, boxShadow: '0 8px 24px rgba(253, 160, 133, 0.4)'}}>
            <div>
              <div style={{fontSize: 12, fontWeight: 800, color: '#d35400', marginBottom: 2}}>🤖 AI Suggests pairing:</div>
              <div style={{fontSize: 16, fontWeight: 800, color: COLORS.ink}}>{aiSuggestion.name}</div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
               <button onClick={() => { handleSetQty(aiSuggestion.id, 1); setAiSuggestion(null); }} style={{background: COLORS.ink, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10, fontWeight: 800, cursor: 'pointer'}}>+ Add</button>
               <button onClick={() => setAiSuggestion(null)} aria-label="Dismiss suggestion" style={{background: 'transparent', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer'}}>&times;</button>
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
              <SidebarBtn icon="🎁" text="Today's Offers" onClick={() => {setShowSidebar(false); setActiveModal('offers');}} />
              <SidebarBtn icon="🍽️" text="Table Booking" onClick={() => {setShowSidebar(false); setBookType("table"); setActiveModal('booking');}} />
              <SidebarBtn icon="🎉" text="Party Booking" onClick={() => {setShowSidebar(false); setBookType("party"); setActiveModal('booking');}} />
              <SidebarBtn icon="👑" text="VIP Loyalty Partner" onClick={() => {setShowSidebar(false); setActiveModal('loyalty');}} />
              <SidebarBtn icon="⭐" text="Rate us on Google" onClick={() => { setShowSidebar(false); window.open(GOOGLE_REVIEW_URL, '_blank'); }} highlight={true} />
              <div style={{ marginTop: 16, padding: 12, background: COLORS.paper, borderRadius: 12, textAlign: 'center', border: `1px solid ${COLORS.line}` }}>
                <QRCode value={window.location.href} size={100} />
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", zIndex: 70 }} onClick={() => {setCartOpen(false); setActiveModal(null); setConfirmedBooking(null);}}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: "24px 20px 30px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -10px 40px rgba(0,0,0,0.15)" }} className="slide-up">
            
            {cartOpen && (
              <>
                <ModalHeader title="Checkout" onClose={() => setCartOpen(false)} />
                {cartItems.map(([id, q]) => {
                  const item = menu.find((m) => m.id === id);
                  return ( <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "12px", background: COLORS.paper, borderRadius: 12, border: `1px solid ${COLORS.line}` }}><div style={{ fontSize: 15, fontWeight: 700 }}>{item.name} {item.portion && <span style={{fontSize: 12, color: COLORS.textLight}}>({item.portion})</span>}</div><Stepper qty={q} onChange={(nq) => handleSetQty(id, nq)} /></div> );
                })}
                
                <div style={{ display: "flex", gap: 12, marginTop: 20, marginBottom: 16 }}>
                  <button onClick={() => setOrderType("dine_in")} style={{ flex: 1, padding: "12px", border: `2px solid ${orderType === "dine_in" ? COLORS.copper : COLORS.line}`, background: orderType === "dine_in" ? COLORS.copper : "#fff", color: orderType === "dine_in" ? "#fff" : COLORS.ink, borderRadius: 12, fontWeight: 800, cursor: "pointer", transition: "all 0.2s ease" }}>🍽️ Dine-in</button>
                  <button onClick={() => setOrderType("parcel")} style={{ flex: 1, padding: "12px", border: `2px solid ${orderType === "parcel" ? COLORS.copper : COLORS.line}`, background: orderType === "parcel" ? COLORS.copper : "#fff", color: orderType === "parcel" ? "#fff" : COLORS.ink, borderRadius: 12, fontWeight: 800, cursor: "pointer", transition: "all 0.2s ease" }}>🛍️ Parcel (+₹40)</button>
                </div>

                {/* Scheduled Order */}
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
                          <input type="tel" placeholder="10-digit Phone" value={custPhone} onChange={(e) => { setCustPhone(e.target.value); checkExistingCustomer(e.target.value); }} style={{...inputStyle, flex: 1}} />
                          <button onClick={handleSendOtp} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer" }}>Send OTP</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="text" placeholder="Enter OTP (e.g. 1234)" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} style={{...inputStyle, flex: 1}} />
                          <button onClick={handleVerifyOtp} style={{ background: COLORS.success, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer" }}>Verify</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: COLORS.success, fontWeight: 800, fontSize: 14 }}>✓ Verified Customer ({custPhone})</div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 20 }}>
                  <div style={{fontSize: 13, fontWeight: 800, color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 1}}>Your Details</div>
                  <input type="text" placeholder="Your Name *" value={custName} onChange={(e) => setCustName(e.target.value)} style={inputStyle} />
                  <input type="tel" placeholder="Phone Number *" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} style={inputStyle} />
                  
                  {orderType === "parcel" && (
                    <div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <textarea placeholder="Delivery Address *" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} style={{...inputStyle, resize: "none", flex: 1}} rows={2} />
                        <button onClick={handleGetLocation} title="Get GPS Location" aria-label="Get GPS location for delivery address" style={{ background: COLORS.sage, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>📍 GPS</button>
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
                    <div style={{fontWeight: 800, fontSize: 16, color: COLORS.ink}}>🪙 EatCoins</div>
                    {custPhone.length >= 10 ? (
                      <div>
                        <div style={{fontSize: 14, fontWeight: 800, color: COLORS.sageDark}}>Bal: {currentCoins}</div>
                        <div style={{fontSize: 11, color: COLORS.gold, fontWeight: 700}}>{loyaltyTier.name} ({loyaltyTier.discount * 100}% off)</div>
                      </div>
                    ) : (
                      <div style={{fontSize: 12, color: COLORS.textLight}}>Enter Phone to check</div>
                    )}
                  </div>
                  
                  {custPhone.length >= 10 && (
                    <LoyaltyProgress 
                      currentPoints={currentCoins} 
                      nextTier={LOYALTY_TIERS.find((t) => t.points > currentCoins) || null}
                      loyaltyRules={loyaltyRules}
                    />
                  )}
                  
                  {custPhone.length >= 10 && (
                    <div style={{ marginTop: 12 }}>
                      {loyaltyRules.rewards.map(r => {
                        const canAfford = currentCoins >= r.cost;
                        const isClaimed = claimedReward?.id === r.id;
                        const pointsNeeded = Math.max(0, r.cost - currentCoins);
                        const progress = Math.min((currentCoins / r.cost) * 100, 100);
                        
                        return (
                          <div key={r.id} style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            background: '#fff', 
                            padding: 12, 
                            borderRadius: 10, 
                            marginBottom: 8, 
                            border: `1px solid ${isClaimed ? COLORS.success : COLORS.line}` 
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{r.item}</div>
                                <div style={{ fontSize: 12, color: COLORS.gold, fontWeight: 800 }}>{r.cost} Coins</div>
                              </div>
                              <button 
                                onClick={() => { 
                                  setClaimedReward(isClaimed ? null : r); 
                                  if(!isClaimed) showToast(`🎁 ${r.item} claimed!`, 'reward');
                                }}
                                disabled={!canAfford && !isClaimed}
                                style={{ 
                                  padding: '6px 16px', 
                                  borderRadius: 8, 
                                  border: 'none', 
                                  background: isClaimed ? COLORS.success : (canAfford ? COLORS.ink : COLORS.paper2),
                                  color: isClaimed || canAfford ? '#fff' : COLORS.textLight,
                                  fontWeight: 800,
                                  cursor: canAfford ? 'pointer' : 'not-allowed',
                                  fontSize: 13
                                }}
                              >
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
                                <div style={{ fontSize: 10, color: COLORS.textLight, marginTop: 2 }}>
                                  🪙 Need {pointsNeeded} more coins (₹{Math.ceil(pointsNeeded * loyaltyRules.rate)} spend)
                                </div>
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
                
                {/* Payment Method Selection */}
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
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.textLight }}>
                    <span>Subtotal</span><span>{inr(subtotal)}</span>
                  </div>
                  {appliedDiscount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.success }}>
                      <span>Coupon Discount ({appliedDiscount}%)</span><span>-{inr(discountAmount)}</span>
                    </div>
                  )}
                  {loyaltyDiscount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.gold }}>
                      <span>Loyalty Discount ({loyaltyTier.name})</span><span>-{inr(loyaltyDiscount)}</span>
                    </div>
                  )}
                  {orderType === "parcel" && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.copper }}>
                      <span>Delivery Charge</span><span>+{inr(deliveryFee)}</span>
                    </div>
                  )}
                  {isScheduled && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.info }}>
                      <span>📅 Scheduled</span>
                      <span>{scheduleDate} {scheduleTime}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18, borderTop: `1px solid ${COLORS.line}`, paddingTop: 8, marginTop: 4 }}>
                    <span>Grand Total</span><span style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.copper }}>{inr(finalTotal)}</span>
                  </div>
                  {claimedReward && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, color: COLORS.success, marginTop: 4 }}>
                      <span>+ Free Reward</span><span>{claimedReward.item}</span>
                    </div>
                  )}
                </div>
                
                {orderType === "parcel" && paymentMethod === "cash" && (
                  <div style={{ textAlign: "center", padding: "20px", background: COLORS.paper, border: `2px dashed ${COLORS.line}`, borderRadius: 16, marginBottom: 20 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.ink, marginBottom: 12 }}>Scan to Pay {inr(finalTotal)}</div>
                    <img src={cartQrSrc} alt="UPI QR Code" loading="lazy" style={{ width: 160, height: 160, borderRadius: 14, border: '4px solid #fff', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} />
                  </div>
                )}
                <button onClick={handlePlaceOrder} disabled={isProcessingPayment} style={{ 
                  background: COLORS.ink, 
                  color: "#fff", 
                  border: "none", 
                  borderRadius: 14, 
                  padding: "16px", 
                  fontWeight: 800, 
                  fontSize: 16, 
                  cursor: isProcessingPayment ? 'not-allowed' : 'pointer', 
                  width: "100%", 
                  opacity: isProcessingPayment ? 0.6 : 1,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.2)" 
                }} className="hover-lift smooth-transition">
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
                      onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; }} 
                    />
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
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                    No past orders found.
                    <div style={{ fontSize: 13, marginTop: 8 }}>Start ordering now! 🍽️</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[...myOrders].reverse().map(o => {
                      const orderTotal = o.items.reduce((s,i)=>s+(i.price*i.qty),0) + (o.deliveryFee||0) - (o.loyaltyDiscount||0);
                      const isCompleted = o.status === "served";
                      const isCancelled = o.status === "cancelled";
                      
                      return (
                        <div key={o.id} style={{ 
                          background: COLORS.paper, 
                          border: `1px solid ${isCancelled ? COLORS.error : isCompleted ? COLORS.sage : COLORS.line}`, 
                          padding: 16, 
                          borderRadius: 14,
                          transition: 'all 0.2s ease',
                          borderLeft: isCancelled ? `4px solid ${COLORS.error}` : isCompleted ? `4px solid ${COLORS.sage}` : `4px solid ${COLORS.copper}`,
                          opacity: isCancelled ? 0.6 : 1
                        }} className="smooth-transition hover-lift">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontWeight: 800 }}>
                            <span style={{ fontSize: 15 }}>#{o.id.slice(1,5).toUpperCase()}</span>
                            <span style={{ 
                              color: isCancelled ? COLORS.error : isCompleted ? COLORS.sage : STATUS_COLOR[o.status] || COLORS.ink, 
                              textTransform: 'uppercase', 
                              fontSize: 11,
                              background: isCancelled ? 'rgba(239,68,68,0.1)' : isCompleted ? COLORS.sageLight : COLORS.paper2,
                              padding: '2px 10px',
                              borderRadius: 12
                            }}>
                              {isCancelled ? "❌ Cancelled" : isCompleted ? "✅ Completed" : 
                               o.status === "new" ? "🆕 New" : 
                               o.status === "preparing" ? "👨‍🍳 Cooking" : 
                               o.status === "ready" ? "✅ Ready" : o.status}
                            </span>
                          </div>
                          
                          <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>
                            📅 {new Date(o.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {o.isScheduled && (
                              <span style={{ display: 'block', color: COLORS.info, fontSize: 11 }}>
                                📅 Scheduled: {o.scheduledDate} at {o.scheduledTime}
                              </span>
                            )}
                          </div>
                          
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: COLORS.ink }}>
                            {o.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
                          </div>
                          
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            borderTop: `1px solid ${COLORS.line}`,
                            paddingTop: 10,
                            marginTop: 4,
                            flexWrap: 'wrap',
                            gap: 8
                          }}>
                            <div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: isCancelled ? COLORS.error : COLORS.copper }}>
                                💰 {inr(orderTotal)}
                              </div>
                              {o.loyaltyDiscount > 0 && (
                                <div style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700 }}>
                                  👑 {o.loyaltyTier || 'Loyalty'} discount applied
                                </div>
                              )}
                              {o.payment && (
                                <div style={{ fontSize: 10, color: COLORS.textLight }}>
                                  💳 {o.payment}
                                </div>
                              )}
                            </div>
                            
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {!isCancelled && (
                                <button onClick={() => reorderOrder(o)} style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${COLORS.sage}`, background: 'transparent', color: COLORS.sage, fontWeight: 700, fontSize: 11, cursor: 'pointer' }} className="smooth-transition hover-lift">🔄 Reorder</button>
                              )}
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
                  <div style={{ textAlign: 'center', padding: "30px 0", color: COLORS.textLight, fontWeight: 600 }}>Please enter your phone number during checkout or login to view coin history.</div>
                ) : myCoinLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: "40px 0", color: COLORS.textLight, fontWeight: 600 }}>No coin transactions recorded yet. (Current Balance: {currentCoins})</div>
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
                  <div style={{textAlign: 'center', padding: "40px 0", color: COLORS.textLight, fontWeight: 600}}>No active offers currently.</div>
                ) : (
                  <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
                    {offersList.map(offer => (
                      <div key={offer.id} style={{background: 'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)', padding: 20, borderRadius: 16, boxShadow: '0 8px 20px rgba(255,154,158,0.3)', position: 'relative', overflow: 'hidden'}}>
                        <div style={{fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: COLORS.ink, marginBottom: 8}}>{offer.title}</div>
                        <div style={{fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,0.7)', lineHeight: 1.5}}>{offer.desc}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeModal === 'loyalty' && (
              <>
                <ModalHeader title="VIP Loyalty Partner 👑" onClose={() => setActiveModal(null)} />
                <div style={{ background: "linear-gradient(135deg, #1A1A1A 0%, #3C3C3C 100%)", borderRadius: 20, padding: 28, color: "#fff", textAlign: "center", marginBottom: 24, boxShadow: "0 16px 32px rgba(0,0,0,0.25)" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>💎</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 10, color: COLORS.gold }}>Eat & Park Elite</div>
                  <div style={{ fontSize: 15, opacity: 0.9, marginBottom: 24, lineHeight: 1.6, fontWeight: 500 }}>Become a premium partner for just <strong style={{fontSize: 20, color: COLORS.gold}}>₹999/month</strong>. Get exclusive 20% off on all dine-in orders!</div>
                  <div style={{ background: "#fff", padding: 20, borderRadius: 16 }}>
                    <div style={{ color: COLORS.ink, fontWeight: 800, marginBottom: 10, fontSize: 15 }}>Scan to Join</div>
                    <img src={loyaltyQrSrc} alt="Pay 999" loading="lazy" className="keep-color" style={{ width: 160, height: 160 }} />
                  </div>
                </div>
              </>
            )}

            {activeModal === 'booking' && (
              <>
                <ModalHeader title={bookType === "party" ? "Party Booking 🎉" : "Table Booking 🍽️"} onClose={() => {setActiveModal(null); setConfirmedBooking(null);}} />
                {confirmedBooking ? (
                  <div style={{textAlign: "center", padding: "30px 0"}}>
                    <div style={{fontSize: 56, marginBottom: 16, animation: 'scaleInBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'}}>✅</div>
                    <h3 style={{fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, color: COLORS.ink, marginBottom: 10}}>Request Sent!</h3>
                    <p style={{fontSize: 15, color: COLORS.textLight, marginBottom: 28, fontWeight: 500}}>Your booking has been sent successfully.</p>
                    <button onClick={() => {setActiveModal(null); setConfirmedBooking(null);}} style={{ background: COLORS.paper2, color: COLORS.ink, border: 'none', padding: '12px', borderRadius: 12, width: '100%', fontWeight: 800, cursor: 'pointer' }}>Close</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                    <input type="text" placeholder="Your Name" value={bookData.name} onChange={(e) => setBookData({...bookData, name: e.target.value})} style={inputStyle} />
                    <input type="tel" placeholder="Phone Number" value={bookData.phone} onChange={(e) => setBookData({...bookData, phone: e.target.value})} style={inputStyle} />
                    <div style={{ display: "flex", gap: 14 }}><input type="date" value={bookData.date} onChange={(e) => setBookData({...bookData, date: e.target.value})} style={inputStyle} /><input type="time" value={bookData.time} onChange={(e) => setBookData({...bookData, time: e.target.value})} style={inputStyle} /></div>
                    <input type="number" placeholder="Number of Guests" value={bookData.guests} onChange={(e) => setBookData({...bookData, guests: e.target.value})} style={inputStyle} />
                    <button onClick={handleBooking} style={{ background: COLORS.copper, color: '#fff', border: 'none', borderRadius: 14, padding: '13px 20px', fontWeight: 800, width: "100%", marginTop: 10, cursor: 'pointer' }}>Send Request</button>
                  </div>
                )}
              </>
            )}

            {activeModal === 'track' && (
              <>
                <ModalHeader title="Your Active Orders" onClose={() => setActiveModal(null)} />
                {myActiveOrders.length === 0 ? (
                  <div style={{textAlign: 'center', padding: "50px 0", color: COLORS.textLight, fontWeight: 600}}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
                    No active orders right now.
                    <div style={{ fontSize: 13, marginTop: 8 }}>Place a new order! 🍽️</div>
                  </div>
                ) : myActiveOrders.map(o => {
                  const estimatedTime = getEstimatedTime(o.items);
                  const isCancellable = o.status === "new" || o.status === "preparing";
                  return (
                    <div key={o.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, color: COLORS.ink }}>
                          Order #{o.id.slice(1,5).toUpperCase()}
                        </div>
                        {o.isScheduled && (
                          <span style={{ fontSize: 11, color: COLORS.info, fontWeight: 600 }}>
                            📅 Scheduled
                          </span>
                        )}
                      </div>
                      <OrderTimer createdAt={o.createdAt} estimatedTime={estimatedTime} />
                      <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
                        <ProgressRing progress={getOrderProgress(o.status)} size={80} />
                      </div>
                      
                      <div style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 12 }}>
                        {o.items.map(i => `${i.qty}x ${i.name}`).join(", ")}
                      </div>
                      
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button onClick={() => setActiveModal(null)} style={{ flex: 1, background: "transparent", color: COLORS.copper, border: `2px solid ${COLORS.copper}`, borderRadius: 14, padding: "13px 20px", fontWeight: 800, cursor: 'pointer' }}>Back to Menu</button>
                        <button onClick={() => { setActiveModal(null); setCartOpen(true); }} style={{ padding: "13px 20px", background: COLORS.sage, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>➕ Add Items</button>
                        {isCancellable && (
                          <button onClick={() => cancelOrder(o.id)} style={{ padding: "13px 20px", background: 'transparent', color: COLORS.error, border: `2px solid ${COLORS.error}`, borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>❌ Cancel</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {activeModal === 'chat' && (
              <>
                <ModalHeader title="💬 Chat with Restaurant" onClose={() => setActiveModal(null)} />
                <ChatBox orderId={activeOrderIdForChat || 'general'} customerId={custPhone || 'customer'} />
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 13. STAFF VIEW (with keyboard shortcuts & scheduled badge)
// ============================================

const STAFF_SHORTCUTS = {
  'Ctrl+K': 'Focus first order',
  '↑ / ↓': 'Navigate between orders',
  'P': 'Start preparation (on New order)',
  'R': 'Mark ready (on Preparing order)',
  'Shift+?': 'Toggle this help panel',
};

const KeyboardHelpModal = memo(({ onClose }) => {
  return (
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
  );
});

function StaffView({ orders, advanceStatus, requestPinPrompt, calls, resolveCall }) {
  const active = orders.filter((o) => o.status !== "served" && o.status !== "cancelled").sort((a, b) => a.createdAt - b.createdAt);
  const activeCalls = calls.filter(c => c.status === 'active');
  const columns = ["new", "preparing", "ready"];
  const newOrderCount = active.filter(o => o.status === "new").length;
  const prevCountRef = useRef(newOrderCount);
  const activeCallsCount = activeCalls.length;
  const prevCallsCountRef = useRef(activeCallsCount);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    if (newOrderCount > prevCountRef.current) {
      playNotificationSound();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🛎️ New Order Received!', {
          body: `${newOrderCount} new order${newOrderCount > 1 ? 's' : ''} waiting`,
          icon: '/icon-192.png',
          vibrate: [200, 100, 200]
        });
      }
    }
    prevCountRef.current = newOrderCount;
  }, [newOrderCount]);

  useEffect(() => {
    if (activeCallsCount > prevCallsCountRef.current) {
      const bellAudio = new Audio("https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3");
      bellAudio.play().catch(e => console.log(e));
    }
    prevCallsCountRef.current = activeCallsCount;
  }, [activeCallsCount]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'k' && e.ctrlKey) { e.preventDefault(); const firstOrder = active[0]; if (firstOrder) setSelectedOrderId(firstOrder.id); }
      if (e.key === 'ArrowUp') { const currentIndex = active.findIndex(o => o.id === selectedOrderId); if (currentIndex > 0) setSelectedOrderId(active[currentIndex - 1].id); }
      if (e.key === 'ArrowDown') { const currentIndex = active.findIndex(o => o.id === selectedOrderId); if (currentIndex < active.length - 1) setSelectedOrderId(active[currentIndex + 1].id); }
      if ((e.key === 'p' || e.key === 'P') && selectedOrderId && !e.ctrlKey) { const order = active.find(o => o.id === selectedOrderId); if (order && order.status === "new") advanceStatus(selectedOrderId, "new"); }
      if ((e.key === 'r' || e.key === 'R') && selectedOrderId && !e.ctrlKey) { const order = active.find(o => o.id === selectedOrderId); if (order && order.status === "preparing") advanceStatus(selectedOrderId, "preparing"); }
      if ((e.key === '?' || e.key === '/') && e.shiftKey) { e.preventDefault(); setShowHelpModal(v => !v); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrderId, active, advanceStatus]);

  const handlePrintReceipt = (order) => {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) return;
    const itemsHtml = order.items.map(it => `<tr><td>${it.qty}x ${it.name}</td><td style="text-align:right">₹${it.price * it.qty}</td></tr>`).join('');
    const totalAmount = order.items.reduce((s, it) => s + (it.price * it.qty), 0) + (order.deliveryFee || 0) - (order.loyaltyDiscount || 0);
    printWindow.document.write(`
      <html>
        <head>
          <title>KOT / Bill - #${order.id.slice(1,5)}</title>
          <style>
            body { font-family: 'JetBrains Mono', monospace; font-size: 12px; padding: 10px; width: 260px; color: #000; }
            h2, h4 { text-align: center; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 4px 0; border-bottom: 1px dashed #000; }
            .total { font-weight: bold; font-size: 14px; text-align: right; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h2>${RESTAURANT.name}</h2>
          <h4>${order.orderType === 'parcel' ? '🛍️ PARCEL ORDER' : `🍽️ TABLE ${order.table}`}</h4>
          <p>Order ID: #${order.id.toUpperCase()}<br/>Customer: ${order.customer.name} (${order.customer.phone})</p>
          ${order.isScheduled ? `<p>📅 Scheduled: ${order.scheduledDate} at ${order.scheduledTime}</p>` : ''}
          <table>
            <tr><th>Item</th><th style="text-align:right">Amt</th></tr>
            ${itemsHtml}
          </table>
          ${order.deliveryFee ? `<p>Delivery Fee: ₹${order.deliveryFee}</p>` : ''}
          ${order.loyaltyDiscount ? `<p style="color:green">Loyalty Discount: -₹${order.loyaltyDiscount}</p>` : ''}
          <div class="total">Total: ₹${totalAmount}</div>
          <script>window.print(); setTimeout(() => window.close(), 500);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div style={{ padding: "26px 20px 60px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: 'center' }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, color: COLORS.ink, fontWeight: 800 }}>🍳 Kitchen Board</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowHelpModal(true)} aria-label="Show keyboard shortcuts" title="Keyboard Shortcuts (Shift + ?)" style={{ background: COLORS.paper2, border: `1.5px solid ${COLORS.line}`, borderRadius: 12, padding: "10px 16px", cursor: "pointer", fontWeight: 700 }}>⌨️ Shortcuts</button>
          <button onClick={() => requestPinPrompt("admin")} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 14, padding: "13px 20px", fontWeight: 700, cursor: 'pointer' }}>⚙️ Admin</button>
        </div>
      </div>
      <div style={{ fontSize: 15, color: COLORS.textLight, marginBottom: 24, fontWeight: 600 }}>Use ↑↓ to navigate, P/R to advance, Shift+? for help</div>

      {newOrderCount > 0 && (
        <div style={{ background: 'rgba(226,89,56,0.1)', border: `2px solid ${COLORS.copper}`, borderRadius: 16, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }} className="slide-up">
          <span style={{ fontSize: 24 }}>🛎️</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.copper }}>{newOrderCount} New Order{newOrderCount > 1 ? 's' : ''}!</div>
            <div style={{ fontSize: 13, color: COLORS.textLight }}>{newOrderCount === 1 ? 'Order is waiting for your attention' : 'Orders are waiting for your attention'}</div>
          </div>
        </div>
      )}

      {showHelpModal && <KeyboardHelpModal onClose={() => setShowHelpModal(false)} />}

      {activeCalls.length > 0 && (
        <div style={{ background: "rgba(239, 68, 68, 0.1)", border: `2px solid ${COLORS.error}`, borderRadius: 16, padding: 16, marginBottom: 24 }} className="slide-up">
          <h3 style={{ color: COLORS.error, margin: "0 0 12px 0" }}>🚨 Waiter Requested!</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {activeCalls.map(c => (
              <div key={c.id} style={{ background: '#fff', padding: "12px 16px", borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: COLORS.ink }}>Table {c.table}</span>
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
                  return (
                    <div key={o.id} onClick={() => setSelectedOrderId(o.id)} style={{ background: isSelected ? COLORS.copper : '#fff', border: `2px solid ${isSelected ? COLORS.copper : COLORS.line}`, borderRadius: 16, padding: 20, boxShadow: isSelected ? '0 12px 24px rgba(226,89,56,0.2)' : '0 8px 24px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: isSelected ? '#fff' : (o.orderType === "parcel" ? COLORS.rust : COLORS.ink) }}>
                          {o.orderType === "parcel" ? "🛍️ PARCEL" : `🍽️ Table ${o.table}`}
                          {o.isScheduled && (
                            <span style={{ fontSize: 14, marginLeft: 8, color: isSelected ? 'rgba(255,255,255,0.9)' : COLORS.info, fontWeight: 700, background: isSelected ? 'rgba(255,255,255,0.2)' : COLORS.paper2, padding: '2px 8px', borderRadius: 12 }}>📅 Scheduled</span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: isSelected ? 'rgba(255,255,255,0.8)' : COLORS.textLight, fontWeight: 700, background: isSelected ? 'rgba(255,255,255,0.25)' : COLORS.paper2, padding: '4px 10px', borderRadius: 12 }}>{timeAgo(o.createdAt)}</div>
                      </div>
                      <div style={{ borderTop: isSelected ? `1px solid rgba(255,255,255,0.3)` : `1.5px dashed ${COLORS.line}`, paddingTop: 16, marginBottom: 16 }}>
                        {o.items.map((it) => ( <div key={it.itemId} style={{ fontSize: 15, marginBottom: 8, fontWeight: 600, color: isSelected ? '#fff' : COLORS.ink }}><span style={{ fontWeight: 800, display: 'inline-block', width: 28 }}>{it.qty}×</span> {it.name} <span style={{color: isSelected ? 'rgba(255,255,255,0.7)' : COLORS.textLight, fontSize: 13}}>{it.portion}</span></div> ))}
                        {o.claimedReward && (
                          <div style={{ fontSize: 15, marginTop: 12, padding: '8px 12px', background: isSelected ? 'rgba(255,255,255,0.2)' : COLORS.sageLight, color: isSelected ? '#fff' : COLORS.sageDark, borderRadius: 8, fontWeight: 800 }}>
                            🎁 FREE: {o.claimedReward}
                          </div>
                        )}
                        {o.isScheduled && (
                          <div style={{ fontSize: 12, marginTop: 8, color: isSelected ? 'rgba(255,255,255,0.7)' : COLORS.info, fontWeight: 600 }}>
                            📅 Scheduled: {o.scheduledDate} at {o.scheduledTime}
                          </div>
                        )}
                        {o.payment && (
                          <div style={{ fontSize: 12, marginTop: 4, color: isSelected ? 'rgba(255,255,255,0.6)' : COLORS.textLight, fontWeight: 500 }}>
                            💳 {o.payment} {o.paid ? '✅' : '⏳'}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 20, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}><SlideButton text={status === "new" ? "Slide to Prep (P)" : status === "preparing" ? "Slide to Ready (R)" : "Slide to Serve"} bg={isSelected ? '#fff' : STATUS_COLOR[status]} onComplete={() => advanceStatus(o.id, status)} /></div>
                        <button onClick={() => handlePrintReceipt(o)} aria-label="Print KOT and bill" style={{ background: isSelected ? 'rgba(255,255,255,0.25)' : COLORS.paper2, color: isSelected ? '#fff' : COLORS.ink, border: isSelected ? '1px solid rgba(255,255,255,0.3)' : 'none', width: 48, height: 48, borderRadius: 14, fontSize: 20, cursor: 'pointer' }} title="Print KOT / Bill">🖨️</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// 14. ADMIN VIEW (with PDF report, CSV, inventory, etc.)
// ============================================

function KitchenMetrics({ filteredOrders }) {
  const servedOrders = filteredOrders.filter(o => o.status === "served");
  if (servedOrders.length === 0) return null;

  const hourCounts = {};
  filteredOrders.forEach(o => {
    const hr = new Date(o.createdAt).getHours();
    hourCounts[hr] = (hourCounts[hr] || 0) + 1;
  });
  const peakHourEntry = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  const peakHourLabel = peakHourEntry ? `${peakHourEntry[0]}:00` : "—";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
      <StatCard label="Completed Orders" value={servedOrders.length} icon="✅" color={COLORS.sage} />
      <StatCard label="Peak Hour" value={peakHourLabel} icon="🔥" color={COLORS.copper} />
      <StatCard label="Total Orders Today" value={filteredOrders.length} icon="📋" color={COLORS.gold} />
    </div>
  );
}

function InventoryAlertBanner({ inventory }) {
  const critical = inventory.filter(i => i.stock < 2);
  const warning = inventory.filter(i => i.stock >= 2 && i.stock < 5);
  if (critical.length === 0 && warning.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      {critical.length > 0 && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: `2px solid ${COLORS.error}`, padding: 16, borderRadius: 12, marginBottom: 12 }}>
          <h4 style={{ color: COLORS.error, margin: '0 0 10px' }}>🚨 CRITICAL — Restock Immediately</h4>
          {critical.map(item => (<div key={item.id} style={{ color: COLORS.error, fontWeight: 700, marginBottom: 4, fontSize: 14 }}>❌ {item.name}: {item.stock} {item.unit} left</div>))}
        </div>
      )}
      {warning.length > 0 && (
        <div style={{ background: 'rgba(255, 152, 0, 0.1)', border: `2px solid ${COLORS.warning}`, padding: 16, borderRadius: 12 }}>
          <h4 style={{ color: COLORS.warning, margin: '0 0 10px' }}>⚠️ LOW STOCK — Reorder Soon</h4>
          {warning.map(item => (<div key={item.id} style={{ color: COLORS.warning, fontWeight: 600, marginBottom: 4, fontSize: 14 }}>⚠️ {item.name}: {item.stock} {item.unit} left</div>))}
        </div>
      )}
    </div>
  );
}

function AdminView({ menu, setMenuState, bookings, orders, markPaid, requestPinPrompt, inventory, addInventory, updateStock, deleteBooking, offersList, addOffer, removeOffer, loyaltyRules, setLoyaltyRules, loyaltyUsers, settings, setSettings, gallery, setGallery }) {
  const [tab, setTab] = useState("overview");
  const [filterDate, setFilterDate] = useState(toLocalISODate(Date.now()));
  const [newInv, setNewInv] = useState({ name: "", stock: "", unit: "kg" });
  const [newOffer, setNewOffer] = useState({ title: "", desc: "" });
  const [newReward, setNewReward] = useState({ cost: "", item: "" });
  const [editingItem, setEditingItem] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCat, setNewItemCat] = useState(CATEGORIES[0]);
  const [newItemImage, setNewItemImage] = useState("");
  const [addMenuName, setAddMenuName] = useState("");
  const [addMenuPrice, setAddMenuPrice] = useState("");
  const [addMenuCat, setAddMenuCat] = useState(CATEGORIES[0]);
  const [addMenuVeg, setAddMenuVeg] = useState(true);
  const [addMenuDesc, setAddMenuDesc] = useState("");
  const [addMenuImage, setAddMenuImage] = useState("");
  const [newGalleryImg, setNewGalleryImg] = useState("");
  const [heroImgInput, setHeroImgInput] = useState(settings?.heroImage || "");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => toLocalISODate(o.createdAt) === filterDate);
  }, [orders, filterDate]);

  const revenue = filteredOrders.filter((o) => o.paid).reduce((s, o) => s + o.items.reduce((a, it) => a + it.price * it.qty, 0) + (o.deliveryFee || 0) - (o.loyaltyDiscount || 0), 0);
  const avgOrderValue = filteredOrders.length > 0 ? Math.round(filteredOrders.reduce((s, o) => s + o.items.reduce((a, it) => a + it.price * it.qty, 0) - (o.loyaltyDiscount || 0), 0) / filteredOrders.length) : 0;

  // ---------- PDF Report ----------
const generatePDFReport = async () => {
  setIsGeneratingPDF(true);
  try {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');

    const html2canvas = window.html2canvas;
    const jsPDF = window.jspdf.jsPDF;

    const reportElement = document.getElementById('report-content');
    if (!reportElement) {
      alert('Report content not found.');
      setIsGeneratingPDF(false);
      return;
    }

    const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, logging: false });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`Sales_Report_${filterDate}.pdf`);
  } catch (e) {
    console.error('PDF Error:', e);
    alert('⚠️ Could not generate PDF. Please check your internet connection and try again.');
  } finally {
    setIsGeneratingPDF(false);
  }
};

    const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, logging: false });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`Sales_Report_${filterDate}.pdf`);
  } catch (e) {
    console.error('PDF Error:', e);
    alert('⚠️ Could not generate PDF. Please check your internet connection and try again.');
  } finally {
    setIsGeneratingPDF(false);
  }
};

      const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Sales_Report_${filterDate}.pdf`);
    } catch (e) {
      console.error('PDF Error:', e);
      alert('⚠️ Could not generate PDF. Please check your internet connection and try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ---------- Handlers ----------
  const handleAddOffer = () => { if(newOffer.title) { addOffer({ id: uid("off"), title: newOffer.title, desc: newOffer.desc }); setNewOffer({ title: "", desc: "" }); } };
  const handleAddReward = () => {
    if(newReward.cost && newReward.item) {
      setLoyaltyRules({ ...loyaltyRules, rewards: [...loyaltyRules.rewards, { id: uid("rwd"), cost: Number(newReward.cost), item: newReward.item }] });
      setNewReward({ cost: "", item: "" });
    }
  };
  const handleSaveMenuItem = async () => {
    if (!editingItem) return;
    const updatedMenu = menu.map(m => m.id === editingItem.id ? { ...m, name: newItemName, price: Number(newItemPrice), category: newItemCat, ...(newItemImage ? { image: newItemImage } : {}) } : m);
    setMenuState(updatedMenu);
    try { await setDoc(doc(db, "settings", "menu"), { items: updatedMenu }); } catch(e) { alert("⚠️ Failed to save menu to Firebase."); }
    setEditingItem(null);
    setNewItemImage("");
  };
  const handleDeleteMenuItem = async (id) => {
    if (window.confirm("Are you sure you want to delete this menu item?")) {
      const updatedMenu = menu.filter(m => m.id !== id);
      setMenuState(updatedMenu);
      try { await setDoc(doc(db, "settings", "menu"), { items: updatedMenu }); } catch(e) { alert("⚠️ Failed to delete from Firebase."); }
    }
  };
  const handleAddNewDish = async () => {
    if (!addMenuName.trim() || !addMenuPrice) { alert("Please enter dish name and price."); return; }
    const newDish = mi(uid("m"), addMenuName.trim(), Number(addMenuPrice), addMenuCat, addMenuVeg, addMenuDesc.trim(), "", false, true, addMenuImage.trim());
    const updatedMenu = [newDish, ...menu];
    setMenuState(updatedMenu);
    try { await setDoc(doc(db, "settings", "menu"), { items: updatedMenu }); } catch(e) { alert("⚠️ Failed to save dish."); }
    setAddMenuName(""); setAddMenuPrice(""); setAddMenuDesc(""); setAddMenuImage("");
    alert("✅ New dish added successfully!");
  };
  const handleAddGalleryPhoto = async () => {
    if (!newGalleryImg.trim()) return;
    const updatedGallery = [...gallery, newGalleryImg.trim()];
    setGallery(updatedGallery);
    try { await setDoc(doc(db, "settings", "gallery"), { images: updatedGallery }); } catch(e) { alert("⚠️ Failed to save gallery."); }
    setNewGalleryImg("");
    alert("✅ Photo added to gallery!");
  };
  const handleDeleteGalleryPhoto = async (index) => {
    const updatedGallery = gallery.filter((_, i) => i !== index);
    setGallery(updatedGallery);
    try { await setDoc(doc(db, "settings", "gallery"), { images: updatedGallery }); } catch(e) { alert("⚠️ Failed to update gallery."); }
  };
  const handleSaveHeroImage = async () => {
    if (!heroImgInput.trim()) return;
    const newSettings = { ...settings, heroImage: heroImgInput.trim() };
    setSettings(newSettings);
    try { await setDoc(doc(db, "settings", "appSettings"), newSettings); } catch(e) { alert("⚠️ Failed to save hero image."); }
    alert("✅ Hero front image updated successfully!");
  };
  const handleExportCSV = () => {
    const rows = [["Time", "Type", "Items", "Total", "Paid", "Loyalty Tier", "Payment Method"]];
    filteredOrders.forEach(o => {
      const total = o.items.reduce((s, it) => s + it.price * it.qty, 0) + (o.deliveryFee || 0) - (o.loyaltyDiscount || 0);
      rows.push([
        new Date(o.createdAt).toLocaleTimeString('en-IN'),
        o.orderType === "parcel" ? "Parcel" : `Table ${o.table}`,
        o.items.map(it => `${it.qty}x ${it.name}`).join("; "),
        total,
        o.paid ? "Yes" : "No",
        o.loyaltyTier || "—",
        o.payment || "cash"
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    link.download = `orders_${filterDate}.csv`;
    link.click();
  };

  const inputStyle = { padding: "12px 16px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", width: "100%", boxSizing: "border-box", transition: "all 0.2s ease" };
  const primaryBtn = { background: COLORS.copper, color: "#fff", border: "none", borderRadius: 14, padding: "13px 20px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.3s ease", boxShadow: "0 4px 12px rgba(226,89,56,0.2)" };
  const th = { padding: "12px 14px", borderBottom: `2px solid ${COLORS.line}`, fontFamily: "'Plus Jakarta Sans', sans-serif" }; 
  const td = { padding: "12px 14px", borderBottom: `1px solid ${COLORS.line}` };

  return (
    <div style={{ padding: "26px 20px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, alignItems: 'center' }}><div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, color: COLORS.ink, fontWeight: 800 }}>📊 Admin Dashboard</div><button onClick={() => requestPinPrompt("customer")} style={{ background: COLORS.paper2, border: "none", padding: "10px 20px", borderRadius: 12, cursor: "pointer", fontWeight: 700 }}>← Exit</button></div>
      
      <div style={{ display: "flex", gap: 10, marginBottom: 28, borderBottom: `2px solid ${COLORS.line}`, overflowX: "auto", scrollbarWidth: "none" }}>
        {["overview", "menu", "gallery", "settings", "offers", "loyalty", "inventory", "orders", "bookings"].map((t) => ( <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", padding: "14px 20px", marginRight: 10, fontWeight: 800, fontSize: 15, textTransform: "capitalize", color: tab === t ? COLORS.copper : COLORS.textLight, borderBottom: tab === t ? `3px solid ${COLORS.copper}` : "3px solid transparent", cursor: "pointer", whiteSpace: "nowrap" }}>{t}</button> ))}
      </div>

      {tab === "overview" && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{fontWeight: 700, fontSize: 15}}>📅 Select Date:</span>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{...inputStyle, width: 150, background: COLORS.paper}} />
            <button onClick={handleExportCSV} style={{ background: COLORS.paper2, border: `1.5px solid ${COLORS.line}`, borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontWeight: 700 }}>📊 Export CSV</button>
            <button onClick={generatePDFReport} disabled={isGeneratingPDF} style={{ background: COLORS.copper, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", cursor: isGeneratingPDF ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: isGeneratingPDF ? 0.6 : 1 }}>{isGeneratingPDF ? '⏳ Generating...' : '📄 PDF Report'}</button>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 28 }}>
            <StatCard label={`Orders (${filterDate})`} value={filteredOrders.length} icon="📋" color={COLORS.copper} />
            <StatCard label="Revenue (paid)" value={inr(revenue)} icon="💰" color={COLORS.sage} />
            <StatCard label="Avg Order Value" value={inr(avgOrderValue)} icon="📈" color={COLORS.gold} />
          </div>
          
          <KitchenMetrics filteredOrders={filteredOrders} />

          <div id="report-content" style={{ display: 'none' }}>
            <div style={{ padding: 20 }}>
              <h2>{RESTAURANT.name} - Sales Report</h2>
              <p>Date: {filterDate}</p>
              <p>Total Orders: {filteredOrders.length}</p>
              <p>Revenue: {inr(revenue)}</p>
              <p>Average Order Value: {inr(avgOrderValue)}</p>
            </div>
          </div>
        </>
      )}

      {tab === "settings" && (
        <div className="slide-up" style={{ background: COLORS.paper, padding: 24, borderRadius: 16, border: `1px solid ${COLORS.line}` }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", marginTop: 0, marginBottom: 16 }}>🖼️ Change Hero Front Image</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <input type="url" placeholder="Paste Image URL here..." value={heroImgInput} onChange={e => setHeroImgInput(e.target.value)} style={{ ...inputStyle, flex: 2, minWidth: 260 }} />
            <button onClick={handleSaveHeroImage} style={{ ...primaryBtn, flex: 1, minWidth: 140 }}>Save Hero Image</button>
          </div>
          {heroImgInput && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: COLORS.textLight }}>Preview:</div>
              <img src={heroImgInput} alt="Hero Preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 12 }} 
                onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80"; }} 
              />
            </div>
          )}
        </div>
      )}

      {tab === "gallery" && (
        <div className="slide-up">
          <div style={{ background: COLORS.paper, padding: 24, borderRadius: 16, marginBottom: 30, border: `1px solid ${COLORS.line}` }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", marginTop: 0, marginBottom: 16 }}>📸 Add Photo to Gallery</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <input type="url" placeholder="Paste Image URL here..." value={newGalleryImg} onChange={e => setNewGalleryImg(e.target.value)} style={{ ...inputStyle, flex: 2, minWidth: 260 }} />
              <button onClick={handleAddGalleryPhoto} style={{ ...primaryBtn, flex: 1, minWidth: 140 }}>+ Add Photo</button>
            </div>
          </div>

          <h3 style={{ fontFamily: "'Outfit', sans-serif", marginBottom: 16 }}>Manage Photo Gallery</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {gallery.map((imgUrl, idx) => (
              <div key={idx} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: 'hidden', padding: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                <img src={imgUrl} alt="Gallery item" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} 
                  onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; }} 
                />
                <button onClick={() => handleDeleteGalleryPhoto(idx)} style={{ width: "100%", background: 'transparent', border: `1px solid ${COLORS.rust}`, color: COLORS.rust, padding: '6px 0', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Delete Photo</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "menu" && (
        <div className="slide-up">
          <div style={{ background: COLORS.paper, padding: 24, borderRadius: 16, marginBottom: 30, border: `1px solid ${COLORS.line}` }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", marginTop: 0, marginBottom: 16 }}>➕ Add New Menu Item (with Image)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
              <input type="text" placeholder="Dish Name *" value={addMenuName} onChange={e => setAddMenuName(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="Price (₹) *" value={addMenuPrice} onChange={e => setAddMenuPrice(e.target.value)} style={inputStyle} />
              <select value={addMenuCat} onChange={e => setAddMenuCat(e.target.value)} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={addMenuVeg} onChange={e => setAddMenuVeg(e.target.value === 'true')} style={inputStyle}>
                <option value="true">🟢 Vegetarian</option>
                <option value="false">🔴 Non-Vegetarian</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
              <input type="url" placeholder="Dish Image URL (optional)" value={addMenuImage} onChange={e => setAddMenuImage(e.target.value)} style={inputStyle} />
            </div>
            <textarea placeholder="Short description (optional)" value={addMenuDesc} onChange={e => setAddMenuDesc(e.target.value)} style={{ ...inputStyle, marginBottom: 16, resize: 'none' }} rows={2} />
            <button onClick={handleAddNewDish} style={primaryBtn}>+ Add Dish to Menu</button>
          </div>

          <h3 style={{ fontFamily: "'Outfit', sans-serif", marginBottom: 16 }}>Existing Menu Management</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {menu.map(item => (
              <div key={item.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, padding: 16, borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <img src={item.image} alt={item.name} style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 10 }} 
                  onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; }} 
                />
                <div style={{ flex: 1 }}>
                  <div style={{fontWeight: 800, fontSize: 16, color: COLORS.ink}}>{item.name} <span style={{fontSize: 12, color: COLORS.textLight}}>({item.category})</span></div>
                  <div style={{fontFamily: "'JetBrains Mono', monospace", color: COLORS.copper, fontWeight: 800}}>{inr(item.price)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setEditingItem(item); setNewItemName(item.name); setNewItemPrice(item.price); setNewItemCat(item.category); setNewItemImage(item.image); }} style={{ background: COLORS.paper2, border: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => handleDeleteMenuItem(item.id)} style={{ background: 'transparent', border: `1px solid ${COLORS.rust}`, color: COLORS.rust, padding: '8px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>

          {editingItem && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99 }}>
              <div style={{ background: '#fff', padding: 24, borderRadius: 20, width: '90%', maxWidth: 400 }}>
                <h3 style={{ marginTop: 0 }}>Edit Menu Item & Image</h3>
                <input type="text" value={newItemName} onChange={e=>setNewItemName(e.target.value)} style={{...inputStyle, marginBottom: 12}} />
                <input type="number" value={newItemPrice} onChange={e=>setNewItemPrice(e.target.value)} style={{...inputStyle, marginBottom: 12}} />
                <select value={newItemCat} onChange={e=>setNewItemCat(e.target.value)} style={{...inputStyle, marginBottom: 12}}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="url" placeholder="Image URL" value={newItemImage} onChange={e=>setNewItemImage(e.target.value)} style={{...inputStyle, marginBottom: 20}} />
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => setEditingItem(null)} style={{ flex: 1, padding: 12, border: `1px solid ${COLORS.line}`, background: 'transparent', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleSaveMenuItem} style={{ flex: 1, padding: 12, background: COLORS.copper, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>Save</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "loyalty" && (
        <div className="slide-up">
          <div style={{ background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', padding: 24, borderRadius: 16, marginBottom: 24, border: `1.5px solid ${COLORS.gold}` }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, marginBottom: 16, fontWeight: 800, color: COLORS.ink }}>🪙 EatCoin Settings</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{ fontWeight: 700 }}>₹ Spend = 1 Coin :</span>
              <input type="number" value={loyaltyRules.rate} onChange={(e) => setLoyaltyRules({...loyaltyRules, rate: Number(e.target.value)})} style={{...inputStyle, width: 120}} />
              <span style={{ fontSize: 14, color: COLORS.textLight }}>*(Currently: ₹{loyaltyRules.rate} = 1 EatCoin)*</span>
            </div>
            
            <div style={{ borderTop: `1px solid ${COLORS.line}`, margin: '20px 0' }} />
            
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Add New Reward Tier</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input type="number" placeholder="Cost (e.g. 300)" value={newReward.cost} onChange={e=>setNewReward({...newReward, cost: e.target.value})} style={{...inputStyle, flex: 1, minWidth: 120}} />
              <input type="text" placeholder="Free Item Name (e.g. French Fry)" value={newReward.item} onChange={e=>setNewReward({...newReward, item: e.target.value})} style={{...inputStyle, flex: 2, minWidth: 200}} />
              <button onClick={handleAddReward} style={{...primaryBtn, flex: 'none', minWidth: 120, background: COLORS.gold, color: COLORS.ink}}>+ Add Reward</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            {loyaltyRules.rewards.map(r => (
              <div key={r.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, padding: 20, borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{fontWeight: 800, fontSize: 18, color: COLORS.ink, marginBottom: 4}}>{r.item}</div>
                  <div style={{color: COLORS.gold, fontWeight: 800, fontSize: 14}}>{r.cost} EatCoins needed</div>
                </div>
                <button onClick={() => setLoyaltyRules({...loyaltyRules, rewards: loyaltyRules.rewards.filter(rw => rw.id !== r.id)})} style={{background: 'transparent', border: `1.5px solid ${COLORS.rust}`, color: COLORS.rust, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 800}}>Remove</button>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 40, fontFamily: "'Outfit', sans-serif" }}>Top Customers (Coin Balance)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, overflow: 'hidden' }}>
            <thead><tr style={{ textAlign: "left", background: COLORS.paper }}><th style={th}>Customer</th><th style={th}>Phone</th><th style={th}>EatCoins 🪙</th><th style={th}>Tier</th></tr></thead>
            <tbody>
              {loyaltyUsers.sort((a,b)=>b.coins-a.coins).map((u, i) => (
                <tr key={i}><td style={td}>{u.name}</td><td style={td}>{u.phone}</td><td style={{...td, fontWeight: 800, color: COLORS.sageDark}}>{u.coins}</td><td style={td}>{getLoyaltyTier(u.coins).name}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "offers" && (
        <div className="slide-up">
          <div style={{ background: COLORS.paper, padding: 24, borderRadius: 16, marginBottom: 24, border: `1px solid ${COLORS.line}` }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, marginBottom: 16, fontWeight: 700 }}>Create New Offer</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input type="text" placeholder="Offer Title (e.g. 20% OFF 🍜)" value={newOffer.title} onChange={e=>setNewOffer({...newOffer, title: e.target.value})} style={{...inputStyle, flex: 1, minWidth: 200}} />
              <input type="text" placeholder="Description (e.g. Valid on all Chinese today)" value={newOffer.desc} onChange={e=>setNewOffer({...newOffer, desc: e.target.value})} style={{...inputStyle, flex: 2, minWidth: 200}} />
              <button onClick={handleAddOffer} style={{...primaryBtn, flex: 'none', minWidth: 120}}>+ Add Offer</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            {offersList.map(off => (
              <div key={off.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, padding: 20, borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{fontWeight: 800, fontSize: 18, color: COLORS.ink, marginBottom: 4}}>{off.title}</div>
                  <div style={{color: COLORS.textLight, fontWeight: 600, fontSize: 14}}>{off.desc}</div>
                </div>
                <button onClick={() => removeOffer(off.id)} style={{background: 'transparent', border: `1.5px solid ${COLORS.rust}`, color: COLORS.rust, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 800}}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "inventory" && (
        <div className="slide-up">
          <InventoryAlertBanner inventory={inventory} />
          <div style={{ background: COLORS.paper, padding: 24, borderRadius: 16, marginBottom: 24, border: `1px solid ${COLORS.line}` }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, marginBottom: 16, fontWeight: 700 }}>Add Raw Material</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input type="text" placeholder="Item Name (e.g., Paneer, Rice)" value={newInv.name} onChange={e=>setNewInv({...newInv, name: e.target.value})} style={{...inputStyle, flex: 2, minWidth: 200}} />
              <input type="number" placeholder="Qty" value={newInv.stock} onChange={e=>setNewInv({...newInv, stock: e.target.value})} style={{...inputStyle, flex: 1, minWidth: 100}} />
              <select value={newInv.unit} onChange={e=>setNewInv({...newInv, unit: e.target.value})} style={{...inputStyle, flex: 1, minWidth: 100}}>
                <option value="kg">KG</option><option value="liters">Liters</option><option value="pcs">Pieces</option>
              </select>
              <button onClick={() => {if(newInv.name && newInv.stock) {addInventory({...newInv, id: uid('inv'), stock: Number(newInv.stock)}); setNewInv({name:"", stock:"", unit:"kg"})}}} style={{...primaryBtn, flex: 1, minWidth: 120}}>Add Stock</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {inventory.map(inv => (
              <div key={inv.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, padding: 20, borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div><div style={{fontWeight: 800, fontSize: 17, color: COLORS.ink, marginBottom: 4}}>{inv.name}</div><div style={{color: inv.stock < 2 ? COLORS.error : COLORS.textLight, fontWeight: 700, fontSize: 14}}>{Number(inv.stock).toFixed(2)} {inv.unit} remaining</div></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => updateStock(inv.id, Math.max(0, inv.stock - 1))} style={{width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${COLORS.line}`, background: COLORS.paper, cursor: 'pointer', fontWeight: 800, fontSize: 18}}>-</button>
                  <button onClick={() => updateStock(inv.id, inv.stock + 1)} style={{width: 36, height: 36, borderRadius: 10, border: 'none', background: COLORS.sageLight, color: COLORS.sageDark, cursor: 'pointer', fontWeight: 800, fontSize: 18}}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div style={{ overflowX: "auto", borderRadius: 16, border: `1px solid ${COLORS.line}`, boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, background: "#fff" }}>
            <thead><tr style={{ textAlign: "left", color: COLORS.textLight, fontSize: 13, background: COLORS.paper, fontWeight: 800 }}><th style={th}>Time</th><th style={th}>Table/Type</th><th style={th}>Items</th><th style={th}>Total</th><th style={th}>Tier</th><th style={th}>Payment</th><th style={th}>Action</th></tr></thead>
            <tbody>
              {[...filteredOrders].sort((a, b) => b.createdAt - a.createdAt).map((o, idx) => (
                <tr key={o.id} style={{ background: idx % 2 === 0 ? "#fff" : COLORS.paper, opacity: o.status === "cancelled" ? 0.5 : 1 }}>
                  <td style={{...td, fontSize: 13, color: COLORS.textLight, fontWeight: 600}}>{new Date(o.createdAt).toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}</td>
                  <td style={td}>
                    {o.orderType === "parcel" ? <Badge color={COLORS.copper}>Parcel</Badge> : <span style={{ fontWeight: 800, fontSize: 15 }}>T-{o.table}</span>}
                    {o.isScheduled && <span style={{ fontSize: 10, color: COLORS.info, display: 'block' }}>📅 Scheduled</span>}
                    {o.status === "cancelled" && <span style={{ color: COLORS.error, fontSize: 11, fontWeight: 700 }}>❌ Cancelled</span>}
                  </td>
                  <td style={{...td, fontSize: 14, fontWeight: 500}}>
                    {o.items.map((it) => `${it.qty}×${it.name}`).join(", ")}
                    {o.claimedReward && <span style={{display: 'block', color: COLORS.sageDark, fontWeight: 800, fontSize: 12, marginTop: 4}}>🎁 Free: {o.claimedReward}</span>}
                  </td>
                  <td style={{...td, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15}}>{inr(o.items.reduce((s, it) => s + it.price * it.qty, 0) + (o.deliveryFee || 0) - (o.loyaltyDiscount || 0))}</td>
                  <td style={td}>{o.loyaltyTier || "—"}</td>
                  <td style={td}>
                    {o.payment || "cash"}
                    <span style={{ fontSize: 11, color: o.paid ? COLORS.sage : COLORS.textLight, display: 'block' }}>
                      {o.paid ? "✅ Paid" : "⏳ Pending"}
                    </span>
                  </td>
                  <td style={td}>
                    <button onClick={() => markPaid(o.id, !o.paid)} style={{ border: `1.5px solid ${o.paid ? COLORS.sage : COLORS.line}`, background: o.paid ? COLORS.sage : "transparent", color: o.paid ? "#fff" : COLORS.ink, borderRadius: 10, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>{o.paid ? "✓ Paid" : "Mark paid"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "bookings" && (
        <div style={{ overflowX: "auto", borderRadius: 16, border: `1px solid ${COLORS.line}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, background: "#fff" }}>
            <thead><tr style={{ textAlign: "left", background: COLORS.paper }}><th style={th}>Type</th><th style={th}>Details</th><th style={th}>Date & Time</th><th style={th}>Action</th></tr></thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id}>
                  <td style={td}>{b.type === "party" ? "🎉 Party" : "🍽️ Table"}</td>
                  <td style={td}><strong>{b.name}</strong><br/>{b.phone}<br/>{b.guests} Guests</td>
                  <td style={td}>{b.date} at {b.time}</td>
                  <td style={td}><button onClick={() => deleteBooking(b.id)} style={{background: 'transparent', border: `1.5px solid ${COLORS.rust}`, color: COLORS.rust, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700}}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================
// 15. DEFAULT DATA
// ============================================

const DEFAULT_MENU = [
  mi("d1", "Mint Mojito", 90, "Drinks", true, "Refreshing blend of fresh mint, lemon, and sparkling soda.", "", true), 
  mi("d2", "Blue Lagoon", 90, "Drinks", true, "Tropical blue curacao cooler with a citrusy kick."), 
  mi("d3", "Vanilla Shake", 120, "Drinks", true, "Classic thick and creamy vanilla milkshake."), 
  mi("d4", "Chocolate Shake", 130, "Drinks", true, "Rich cocoa blended with milk and ice cream."), 
  mi("d5", "Kitkat Oreo Shake", 150, "Drinks", true, "Ultimate crunch of KitKat and Oreo cookies."), 
  mi("d9", "Cold Coffee", 120, "Drinks", true, "Chilled, frothy coffee perfection.", "", true), 
  mi("d10", "Cold Drink", 50, "Drinks", true, "Chilled aerated beverage."),
  mi("f1", "Veg Burger", 90, "Fun Food", true, "Crispy veggie patty with fresh lettuce and creamy mayo."), 
  mi("f2", "Eat & Park Special Pizza", 280, "Fun Food", true, "Loaded with exotic veggies, extra cheese and secret sauce.", "", true), 
  mi("f3", "Veg Roll", 90, "Fun Food", true, "Spiced veggies wrapped in a soft, flaky paratha."), 
  mi("f4", "Paneer Roll", 100, "Fun Food", true, "Tandoori paneer chunks rolled to perfection."), 
  mi("f8", "Eat & Park Egg Roll", 100, "Fun Food", false, "Double egg wrapped with crispy onions and sauces."), 
  mi("f9", "Eat & Park Chicken Roll", 150, "Fun Food", false, "Juicy chicken tikka rolled in a crispy paratha."), 
  mi("f11", "White Sauce Pasta", 180, "Fun Food", true, "Penne in a rich, creamy, and cheesy garlic sauce."), 
  mi("f14", "Veg Sandwich", 120, "Fun Food", true, "Freshly grilled with layers of healthy veggies and cheese."), 
  mi("f15", "Chicken Sandwich", 150, "Fun Food", false, "Grilled sandwich stuffed with creamy chicken filling."),
  mi("cs1", "Paneer Chilli", 240, "Chinese Starter", true, "Crispy paneer tossed in spicy soy and garlic sauce.", "Dry / Gravy", true), 
  mi("cs2", "Mushroom Chilli", 250, "Chinese Starter", true, "Fresh button mushrooms in a tangy chili glaze.", "Dry / Gravy"), 
  mi("cs3", "Veg Manchurian", 180, "Chinese Starter", true, "Vegetable dumplings in a classic dark soy gravy.", "Dry / Gravy"), 
  mi("cs8", "Chicken Chilli", 240, "Chinese Starter", false, "Diced chicken tossed with capsicum, onion, and hot sauces.", "Dry / Gravy", true), 
  mi("cs9", "Chicken Manchurian", 260, "Chinese Starter", false, "Minced chicken balls in sweet and savory Chinese sauce.", "Dry / Gravy"), 
  mi("cs10", "Chicken Lollipop", 300, "Chinese Starter", false, "Crispy fried chicken wings served with hot garlic dip.", "Dry / Gravy"), 
  mi("mg1", "Tandoori Chicken", 450, "Mughlai", false, "Classic bone-in chicken marinated in yogurt and Indian spices, roasted in clay oven."), 
  mi("mg3", "Chicken Tikka", 350, "Mughlai", false, "Boneless chicken chunks marinated in fiery spices and grilled."), 
  mi("t1", "Paneer Tikka", 299, "Tandoori", true, "Cottage cheese marinated in spices and grilled in a tandoor.", "", true), 
  mi("t2", "Mushroom Tikka", 285, "Tandoori", true, "Juicy mushrooms roasted with smoky tandoori flavors."),
  mi("s1", "Tomato Soup", 120, "Soup", true, "Warm, creamy, and comforting fresh tomato soup."), 
  mi("s3", "Veg Manchow Soup", 120, "Soup", true, "Spicy and thick soup topped with crispy fried noodles."), 
  mi("s6", "Chicken Manchow Soup", 150, "Soup", false, "Rich chicken broth with veggies and crispy noodles."), 
  mi("b1", "Tandoori Roti", 15, "Indian Bread", true, "Whole wheat bread baked in a clay oven."), 
  mi("b2", "Tandoori Butter Roti", 20, "Indian Bread", true, "Hot tandoori roti glazed with fresh butter."), 
  mi("b6", "Plain Naan", 50, "Indian Bread", true, "Soft and fluffy refined flour Indian bread."), 
  mi("b7", "Butter Naan", 60, "Indian Bread", true, "Classic naan generously brushed with butter."), 
  mi("b8", "Garlic Naan", 70, "Indian Bread", true, "Naan topped with minced garlic and fresh coriander.", "", true), 
  mi("sn3", "French Fries", 100, "Snacks", true, "Crispy golden potato fries."), 
  mi("sn5", "Crispy Chilli Potato", 160, "Snacks", true, "Fried potato fingers tossed in sweet and spicy chili sauce."), 
  mi("sn9", "Chicken Pakoda", 200, "Snacks", false, "Crunchy batter-fried chicken bites."),
  mi("cm1", "Veg Chowmein", 130, "Chinese Mains", true, "Wok-tossed noodles with shredded vegetables."), 
  mi("cm2", "Veg Hakka Noodles", 160, "Chinese Mains", true, "Classic non-spicy noodles tossed with veggies."), 
  mi("cm8", "Chicken Noodles", 180, "Chinese Mains", false, "Flavorful noodles stir-fried with juicy chicken bits."), 
  mi("cm12", "Veg Fried Rice", 170, "Chinese Mains", true, "Aromatic rice wok-tossed with fresh finely chopped veggies."), 
  mi("cm15", "Chicken Fried Rice", 200, "Chinese Mains", false, "Classic Chinese style rice tossed with chicken and egg."), 
  mi("p2", "Jeera Rice", 110, "Pulao", true, "Basmati rice tempered with roasted cumin seeds."), 
  mi("p3", "Veg Pulao", 180, "Pulao", true, "Fragrant rice cooked with mixed vegetables and whole spices."), 
  mi("pn1", "Paneer Masala", 250, "Paneer & Mushroom", true, "Paneer cooked in a rich onion-tomato spiced gravy."), 
  mi("pn4", "Paneer Karahi", 260, "Paneer & Mushroom", true, "Cottage cheese and bell peppers cooked in a traditional iron wok."), 
  mi("pn6", "Paneer Butter Masala", 260, "Paneer & Mushroom", true, "Soft paneer in a creamy, slightly sweet makhani gravy."), 
  mi("pn16", "Mushroom Masala", 250, "Paneer & Mushroom", true, "Earthy mushrooms in a robust and spicy masala."), 
  mi("pn17", "Mushroom Karahi", 260, "Paneer & Mushroom", true, "Mushrooms and diced capsicum tossed in kadhai spices."), 
  mi("nv1", "Chicken Dehati", 550, "Chicken, Mutton, Fish & Egg", false, "Spicy, homestyle rustic chicken curry with bold flavors."), 
  mi("nv2", "Chicken Curry", 280, "Chicken, Mutton, Fish & Egg", false, "Classic, comforting Indian style chicken curry."), 
  mi("nv6", "Chicken Do Pyaza", 280, "Chicken, Mutton, Fish & Egg", false, "Chicken cooked with a generous amount of crunchy onions."), 
  mi("nv8", "Chicken Butter Masala", 350, "Chicken, Mutton, Fish & Egg", false, "Tandoori chicken pieces in a rich, buttery tomato gravy.", "", true), 
  mi("nv10", "Mutton Curry", 340, "Chicken, Mutton, Fish & Egg", false, "Tender mutton slow-cooked in traditional Indian spices."), 
  mi("nv12", "Mutton Handi", 650, "Chicken, Mutton, Fish & Egg", false, "Mutton cooked slowly in a sealed earthen pot for rich aroma.", "500g", true), 
  mi("nv13", "Mutton Handi", 1200, "Chicken, Mutton, Fish & Egg", false, "Mutton cooked slowly in a sealed earthen pot for rich aroma.", "1 Kg"), 
  mi("nv15", "Mutton Dehati", 440, "Chicken, Mutton, Fish & Egg", false, "Village style spicy and robust mutton preparation."), 
  mi("nv16", "Mutton Ahuna", 1250, "Chicken, Mutton, Fish & Egg", false, "Champaran special whole garlic and mutton cooked in a clay pot."), 
  mi("nv19", "Fish Curry", 120, "Chicken, Mutton, Fish & Egg", false, "Homestyle fish cooked in a tangy mustard and tomato gravy.", "Small"), 
  mi("nv20", "Fish Curry", 220, "Chicken, Mutton, Fish & Egg", false, "Homestyle fish cooked in a tangy mustard and tomato gravy.", "Large"), 
  mi("nv25", "Egg Curry", 200, "Chicken, Mutton, Fish & Egg", false, "Boiled eggs simmered in a flavorful spiced gravy.", "4 pc"), 
  mi("br1", "Veg Biryani", 180, "Biryani & Thali", true, "Aromatic basmati rice layered with spiced vegetables."), 
  mi("br5", "Chicken Biryani", 210, "Biryani & Thali", false, "Classic fragrant rice and chicken cooked with dum technique.", "", true), 
  mi("br12", "Mutton Biryani", 280, "Biryani & Thali", false, "Rich, royal biryani made with succulent mutton pieces."), 
  mi("br15", "Veg Thali", 250, "Biryani & Thali", true, "A complete meal platter with flatbreads, rice, sides, and curries.", "2 Roti, Half Rice, Manchurian, Paneer, Salad, Aachar, Dal"), 
  mi("br16", "Non Veg Thali", 280, "Biryani & Thali", false, "Hearty non-veg platter for a fulfilling meal experience.", "2 Roti, Half Rice, Chicken, Salad, Aachar"),
  mi("al10", "Dal Fry", 70, "Aloo, Dal & Sides", true, "Yellow lentils tempered with cumin and garlic."), 
  mi("al11", "Dal Tadka", 100, "Aloo, Dal & Sides", true, "Dhaba-style dal with a smoky double tadka of ghee and spices."), 
  mi("al14", "Veg Raita", 60, "Aloo, Dal & Sides", true, "Cooling yogurt mixed with finely chopped cucumber and onions."), 
  mi("al15", "Green Salad", 80, "Aloo, Dal & Sides", true, "Fresh slices of cucumber, tomato, onion, and carrots."), 
  mi("mo1", "Veg Momo", 80, "Momo", true, "Steamed dumplings filled with finely minced vegetables.", "Steam"), 
  mi("mo2", "Veg Momo", 100, "Momo", true, "Crispy fried vegetable dumplings.", "Fry"), 
  mi("mo11", "Chicken Momo", 150, "Momo", false, "Steamed dumplings stuffed with juicy minced chicken.", "Steam"), 
  mi("mo12", "Chicken Momo", 160, "Momo", false, "Golden fried chicken dumplings.", "Fry")
];

const DEFAULT_OFFERS = [
  { id: "off1", title: "Flat 20% OFF 🍜", desc: "Enjoy flat 20% off on all Chinese items today!" },
  { id: "off2", title: "Free Cold Drink 🥤", desc: "Get a free cold drink on orders above ₹499." }
];

const DEFAULT_GALLERY = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80"
];

// ============================================
// 16. MyOrderStats (used inside CustomerView)
// ============================================

const MyOrderStats = memo(({ myOrders, loyaltyCoins }) => {
  if (!myOrders || myOrders.length === 0) return null;
  const totalSpent = myOrders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.price * i.qty, 0), 0);
  const favoriteDish = (() => {
    const dishes = {};
    myOrders.forEach(o => o.items.forEach(i => { dishes[i.name] = (dishes[i.name] || 0) + i.qty; }));
    const sorted = Object.entries(dishes).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : "—";
  })();

  return (
    <div style={{ background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', padding: 16, borderRadius: 14, marginBottom: 20, border: `1px solid ${COLORS.line}` }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: COLORS.ink }}>📊 Your Journey</div>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#fff', borderRadius: 8, fontSize: 13 }}>
          <span style={{ color: COLORS.textLight, fontWeight: 600 }}>Total Spent</span>
          <strong style={{ color: COLORS.copper }}>{inr(totalSpent)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#fff', borderRadius: 8, fontSize: 13 }}>
          <span style={{ color: COLORS.textLight, fontWeight: 600 }}>Orders</span>
          <strong style={{ color: COLORS.sage }}>{myOrders.length}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#fff', borderRadius: 8, fontSize: 13 }}>
          <span style={{ color: COLORS.textLight, fontWeight: 600 }}>Favorite</span>
          <strong style={{ color: COLORS.ink, fontSize: 12 }}>{favoriteDish}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#fff', borderRadius: 8, fontSize: 13 }}>
          <span style={{ color: COLORS.textLight, fontWeight: 600 }}>EatCoins</span>
          <strong style={{ color: COLORS.gold }}>{loyaltyCoins} 🪙</strong>
        </div>
      </div>
    </div>
  );
});

// ============================================
// 17. ProgressRing & OrderTimer
// ============================================

const ProgressRing = memo(({ progress, size = 60, strokeWidth = 3 }) => {
  const circumference = 2 * Math.PI * ((size - strokeWidth) / 2);
  const offset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={(size-strokeWidth)/2} fill="none" stroke={COLORS.line} strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={(size-strokeWidth)/2} fill="none" stroke={COLORS.sage} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.3em" fontSize="16" fontWeight="700" fill={COLORS.sage}>{progress}%</text>
    </svg>
  );
});

const OrderTimer = memo(({ createdAt, estimatedTime }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const timer = setInterval(() => setElapsed(Math.floor((Date.now() - createdAt) / 1000)), 1000); return () => clearInterval(timer); }, [createdAt]);
  const minutes = Math.floor(elapsed / 60); const seconds = elapsed % 60; const isOvertime = elapsed > (estimatedTime * 60);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: isOvertime ? 'rgba(239, 68, 68, 0.1)' : COLORS.sageLight, borderRadius: 10, borderLeft: `3px solid ${isOvertime ? COLORS.error : COLORS.sage}` }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: isOvertime ? COLORS.error : COLORS.sageDark }}>⏱️ {minutes}:{seconds.toString().padStart(2, '0')}</span>
      <span style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600 }}>/ {estimatedTime}m</span>
    </div>
  );
});

// ============================================
// 18. MAIN APP COMPONENT
// ============================================

export default function App() {
  const [role, setRole] = useState("customer");
  const [isDark, setIsDark] = useState(false);
  const [calls, setCalls] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [offersList, setOffersList] = useState(DEFAULT_OFFERS);
  const [gallery, setGallery] = useState(DEFAULT_GALLERY);
  const [loyaltyRules, setLoyaltyRules] = useState({
    rate: 10, 
    rewards: [{ id: "r1", cost: 300, item: "Free French Fry" }]
  });
  const [loyaltyUsers, setLoyaltyUsers] = useState([]);
  const [coinHistory, setCoinHistory] = useState([]);
  const [table, setTable] = useState(() => { const params = new URLSearchParams(window.location.search); return params.has("table") ? Number(params.get("table")) : 1; });
  const [menu, setMenuState] = useState(DEFAULT_MENU);
  const [orders, setOrdersState] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState({ heroImage: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80", adminPin: "9876", staffPin: "5432" });
  const [loading, setLoading] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);
  const [targetRole, setTargetRole] = useState("staff");
  const [pinInput, setPinInput] = useState("");

  const requestPinPrompt = (target) => {
    setTargetRole(target);
    setShowPinModal(true);
    setPinInput("");
  };

  const handlePinSubmit = () => {
    const aPin = settings?.adminPin || "9876";
    const sPin = settings?.staffPin || "5432";
    
    if (targetRole === "admin" && pinInput === aPin) {
      setRole("admin");
      setShowPinModal(false);
      setPinInput("");
    } else if (targetRole === "staff" && (pinInput === sPin || pinInput === aPin)) {
      setRole("staff");
      setShowPinModal(false);
      setPinInput("");
    } else if (targetRole === "customer") {
      setRole("customer");
      setShowPinModal(false);
      setPinInput("");
    } else {
      alert("❌ Incorrect PIN!");
      setPinInput("");
    }
  };

  // Firebase initial fetch
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "loyaltyUsers"));
        const users = querySnapshot.docs.map(doc => doc.data());
        if (users.length > 0) setLoyaltyUsers(users);

        const historySnapshot = await getDocs(collection(db, "coinHistory"));
        const history = historySnapshot.docs.map(doc => doc.data());
        if (history.length > 0) setCoinHistory(history);

        const menuSnap = await getDocs(collection(db, "settings"));
        menuSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (docSnap.id === "menu" && data.items) setMenuState(data.items);
          if (docSnap.id === "gallery" && data.images) setGallery(data.images);
          if (docSnap.id === "appSettings") {
            setSettings(prev => ({ ...prev, ...data }));
          }
        });
      } catch (e) { 
        console.error("Firebase fetch error:", e); 
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();

    const unsubscribeOrders = onSnapshot(collection(db, "orders"), (snap) => {
      const ords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrdersState(ords);
    });

    return () => unsubscribeOrders();
  }, []);

  // ---------- Handlers passed to child views ----------
  const deleteBooking = async (id) => { 
    if(window.confirm("Delete this booking?")) {
      try { await deleteDoc(doc(db, "bookings", id)); } catch(e){}
      setBookings(bookings.filter(b=>b.id!==id)); 
    } 
  };

  const addInventory = async (item) => { 
    try { await setDoc(doc(db, "inventory", item.id), item); } catch(e){}
    setInventory([...inventory, item]); 
  };

  const updateStock = async (id, newStock) => { 
    try { await updateDoc(doc(db, "inventory", id), { stock: newStock }); } catch(e){}
    setInventory(inventory.map(i=>i.id===id?{...i,stock:newStock}:i)); 
  };

  const requestWaiter = async (tbl) => { setCalls([...calls, { id: uid("call"), table: tbl, time: Date.now(), status: "active" }]); };
  const resolveCall = async (id) => { setCalls(calls.filter(c=>c.id!==id)); };
  const addOffer = async (off) => { setOffersList([...offersList, off]); };
  const removeOffer = async (id) => { setOffersList(offersList.filter(o=>o.id!==id)); };

  const placeOrder = async (order, rewardCost = 0) => {  
    try {
      await setDoc(doc(db, "orders", order.id), order);
    } catch (e) { console.error(e); }

    if(order.customer.phone && order.customer.phone.length >= 10) {
       const netCoins = order.earnedCoins - rewardCost;
       const existingUserIndex = loyaltyUsers.findIndex(u => u.phone === order.customer.phone);
       let updatedUsers = [...loyaltyUsers];
       
       if(existingUserIndex >= 0) {
          updatedUsers[existingUserIndex].coins = Math.max(0, updatedUsers[existingUserIndex].coins + netCoins);
          updatedUsers[existingUserIndex].name = order.customer.name || updatedUsers[existingUserIndex].name;
       } else if (netCoins > 0) {
          updatedUsers.push({ phone: order.customer.phone, name: order.customer.name, coins: netCoins });
       }
       setLoyaltyUsers(updatedUsers);

       if(existingUserIndex >= 0) {
          try { await setDoc(doc(db, "loyaltyUsers", order.customer.phone), updatedUsers[existingUserIndex]); } catch(e){}
       } else {
          try { await setDoc(doc(db, "loyaltyUsers", order.customer.phone), { phone: order.customer.phone, name: order.customer.name, coins: netCoins }); } catch(e){}
       }

       let newLogs = [...coinHistory];
       if (order.earnedCoins > 0) {
          const logEarn = { phone: order.customer.phone, coins: order.earnedCoins, reason: `Earned from Order #${order.id.slice(1,5).toUpperCase()}`, timestamp: Date.now() };
          newLogs.push(logEarn);
          try { await setDoc(doc(db, "coinHistory", uid("ch")), logEarn); } catch(e){}
       }
       if (rewardCost > 0) {
          const logRedeem = { phone: order.customer.phone, coins: -rewardCost, reason: `Redeemed for reward`, timestamp: Date.now() };
          newLogs.push(logRedeem);
          try { await setDoc(doc(db, "coinHistory", uid("ch")), logRedeem); } catch(e){}
       }
       setCoinHistory(newLogs);
    }
  };

  const advanceStatus = async (orderId, currentStatus) => { 
    const idx = STATUS_FLOW.indexOf(currentStatus); 
    const nextStatus = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)]; 
    const updateData = { status: nextStatus, ...(nextStatus === "served" ? { servedAt: Date.now() } : {}) };
    try { await updateDoc(doc(db, "orders", orderId), updateData); } catch(e){}
    setOrdersState(orders.map(o=>o.id===orderId?{...o, ...updateData}:o)); 
  };

  const markPaid = async (orderId, paid) => { 
    try { await updateDoc(doc(db, "orders", orderId), { paid }); } catch(e){}
    setOrdersState(orders.map(o=>o.id===orderId?{...o,paid}:o)); 
  };

  const bookEvent = async (booking) => { 
    try { await setDoc(doc(db, "bookings", booking.id), booking); } catch(e){}
    setBookings([...bookings, booking]); 
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.paper, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 18, color: COLORS.copper }}>
        🍽️ Loading Eat & Park POS...
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={isDark ? "dark-theme" : ""} style={{ minHeight: "100vh", background: "var(--bg-color, #FAFAF8)", color: COLORS.ink, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <style>{FONTS}</style>
        <div className="app-content">
          {role === "customer" && <CustomerView menu={menu} orders={orders} placeOrder={placeOrder} bookEvent={bookEvent} gallery={gallery} offersList={offersList} table={table} setTable={setTable} requestPinPrompt={requestPinPrompt} settings={settings} isDark={isDark} setIsDark={setIsDark} requestWaiter={requestWaiter} loyaltyRules={loyaltyRules} loyaltyUsers={loyaltyUsers} coinHistory={coinHistory} setOrdersState={setOrdersState} />}
          {role === "staff" && <StaffView orders={orders} advanceStatus={advanceStatus} requestPinPrompt={requestPinPrompt} calls={calls} resolveCall={resolveCall} />}
          {role === "admin" && <AdminView menu={menu} setMenuState={setMenuState} bookings={bookings} orders={orders} markPaid={markPaid} requestPinPrompt={requestPinPrompt} inventory={inventory} addInventory={addInventory} updateStock={updateStock} deleteBooking={deleteBooking} offersList={offersList} addOffer={addOffer} removeOffer={removeOffer} loyaltyRules={loyaltyRules} setLoyaltyRules={setLoyaltyRules} loyaltyUsers={loyaltyUsers} settings={settings} setSettings={setSettings} gallery={gallery} setGallery={setGallery} />}
          
          {!["customer", "staff", "admin"].includes(role) && (
            <CustomerView menu={menu} orders={orders} placeOrder={placeOrder} bookEvent={bookEvent} gallery={gallery} offersList={offersList} table={table} setTable={setTable} requestPinPrompt={requestPinPrompt} settings={settings} isDark={isDark} setIsDark={setIsDark} requestWaiter={requestWaiter} loyaltyRules={loyaltyRules} loyaltyUsers={loyaltyUsers} coinHistory={coinHistory} setOrdersState={setOrdersState} />
          )}
        </div>

        {showPinModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowPinModal(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", padding: "28px", borderRadius: 20, width: "90%", maxWidth: 340, textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }} className="slide-up">
              <div style={{fontSize: 36, marginBottom: 16}}>🔒</div>
              <h3 style={{ margin: "0 0 20px", fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 700 }}>Enter Security PIN ({targetRole.toUpperCase()})</h3>
              <input type="password" placeholder="••••" autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handlePinSubmit(); }} aria-label="Security PIN" style={{ padding: "16px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 32, fontFamily: "'Plus Jakarta Sans', sans-serif", width: "100%", boxSizing: "border-box", textAlign: "center", letterSpacing: 12, marginBottom: 24, fontWeight: 800 }} />
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => { setShowPinModal(false); setPinInput(""); }} style={{ flex: 1, padding: "14px", borderRadius: 12, border: `2px solid ${COLORS.line}`, background: "transparent", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={handlePinSubmit} style={{ flex: 1, padding: "14px", borderRadius: 12, background: COLORS.ink, color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>Login</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}