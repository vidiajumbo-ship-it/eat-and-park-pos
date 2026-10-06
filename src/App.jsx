import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { db } from "./firebase";
import {
  collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc,
  getDocs, getDoc, addDoc, query, orderBy, serverTimestamp, where
} from "firebase/firestore";
import { QRCodeSVG } from 'qrcode.react';

/* ═══════════════════════════════════════════════════════════════════════
   🍽️ EAT & PARK RESTAURANT — V15 FINAL
   Waiter Mode · Running Items · KOT · Touch Kitchen · Live Notifications
   ═══════════════════════════════════════════════════════════════════════ */

// ============================================
// 1. CONSTANTS
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
  "Aloo, Dal & Sides", "Momo", "Tea & Coffee"
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
function timeAgo(ts) { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return s + "s ago"; const m = Math.floor(s / 60); if (m < 60) return m + "m ago"; return Math.floor(m / 60) + "h ago"; }
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
  order: { duration: 6000, bg: COLORS.copper, icon: "🛎️" }
};

const EMPTY_STATES = {
  veg_filtered: { icon: "🥬", title: "No vegetarian options here", subtitle: "Try 'All Items' or check our Paneer & Mushroom section!" },
  search_no_results: { icon: "🔍", title: "Dish not found", subtitle: "Try searching 'paneer', 'chicken', 'biryani', or 'tandoori'" },
  category_empty: { icon: "📂", title: "This category is empty", subtitle: "Check out our bestsellers in Fun Food or Tandoori!" }
};

// ============================================
// 4. REUSABLE COMPONENTS
// ============================================

const ErrorBoundary = React.memo(({ children }) => {
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    const handleError = (event) => { console.error('Uncaught error:', event.error); setHasError(true); };
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
  if (!item.active) return null;
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `2px solid ${COLORS.error}`, padding: 12, minWidth: 150, flexShrink: 0 }}>
      <div style={{ fontSize: 20 }}>🔥</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{item.name}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0' }}>
        <span style={{ fontWeight: 800, color: COLORS.error }}>₹{item.discountPrice}</span>
        <span style={{ textDecoration: 'line-through', fontSize: 12, color: COLORS.textLight }}>₹{item.price}</span>
      </div>
      <button onClick={onAdd} style={{ background: COLORS.error, color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 6, fontWeight: 700, width: '100%', cursor: 'pointer' }}>Add</button>
    </div>
  );
});

// ============================================
// 5. CUSTOM HOOKS
// ============================================

const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try { const item = window.localStorage.getItem(key); return item ? JSON.parse(item) : initialValue; } catch (error) { return initialValue; }
  });
  const setValue = useCallback((value) => {
    try { const v = value instanceof Function ? value(storedValue) : value; setStoredValue(v); window.localStorage.setItem(key, JSON.stringify(v)); } catch (error) { console.error(error); }
  }, [key, storedValue]);
  return [storedValue, setValue];
};

// ============================================
// 6. NOTIFICATION SOUND
// ============================================

const notificationAudio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
notificationAudio.volume = 0.5;
const playNotificationSound = () => {
  try { notificationAudio.currentTime = 0; notificationAudio.play().catch(e => console.log("Sound play error:", e)); } catch (e) { console.log("Sound error:", e); }
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
// 8. LOYALTY PROGRESS
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
        <span style={{ fontWeight: 700, color: pointsNeeded > 0 ? COLORS.copper : COLORS.success }}>{pointsNeeded > 0 ? `${pointsNeeded} away` : '🎉 Unlocked!'}</span>
      </div>
      <div style={{ width: '100%', height: 6, background: COLORS.paper2, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', background: `linear-gradient(90deg, ${COLORS.gold}, ${nextTier.color || COLORS.sage})`, borderRadius: 999, transition: 'width 0.8s ease' }} />
      </div>
      {pointsNeeded > 0 && (<div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>💰 Spend ₹{Math.ceil(pointsNeeded * loyaltyRules.rate)} more</div>)}
    </div>
  );
});

// ============================================
// 9. CHAT BOX
// ============================================

const ChatBox = memo(({ orderId, customerId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesRef = collection(db, 'chats', orderId, 'messages');
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

// ============================================
// 10. GOOGLE REVIEW BUTTON
// ============================================

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
  const loaded = await loadRazorpayScript();
  if (!loaded) { alert("⚠️ Payment gateway could not load."); return false; }
  const options = {
    key: RAZORPAY_KEY, amount: Math.round(amount * 100), currency: "INR",
    name: RESTAURANT.name, description: `Order #${orderId}`,
    prefill: { name: customerName, contact: customerPhone },
    theme: { color: COLORS.copper },
    handler: function (response) { console.log("Payment successful:", response); return true; }
  };
  const razorpay = new window.Razorpay(options);
  razorpay.open();
  return true;
};

// ============================================
// 12. KOT BADGE (V15 NEW)
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
// 13. KITCHEN NOTIFICATION COLUMN (V15 NEW)
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

// ============================================
// 14. RUNNING ORDER MODAL (V15 NEW)
// ============================================

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
            <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>Order #{order.id.slice(1, 5).toUpperCase()} · New KOT #{((order.kots?.length || 1) + 1)}</div>
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

// ============================================
// 15. WAITER ORDER PANEL (V15 NEW)
// ============================================

const WaiterOrderPanel = memo(({ menu, table, setTable, onSubmit, onClose, onAddMoreItems }) => {
  const [cart, setCart] = useState({});
  const [search, setSearch] = useState("");
  const [waiterName, setWaiterName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [placedOrder, setPlacedOrder] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = menu.filter(m => m.available && (!search.trim() || m.name.toLowerCase().includes(search.toLowerCase())));
  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const subtotal = cartItems.reduce((s, [id, q]) => { const m = menu.find(x => x.id === id); return s + (m ? m.price * q : 0); }, 0);
  const setQty = (id, q) => { setCart(prev => { const next = { ...prev, [id]: q }; if (q <= 0) delete next[id]; return next; }); };
  const inputStyle = { padding: 12, border: `1.5px solid ${COLORS.line}`, borderRadius: 10, fontSize: 14, width: "100%", boxSizing: "border-box", fontFamily: "'Plus Jakarta Sans', sans-serif" };

  const handleSubmit = async () => {
    if (cartItems.length === 0) return;
    setIsSubmitting(true);
    try {
      const items = cartItems.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty }; });
      const created = await onSubmit({ table, items, waiterName, customerName: customerName || "Walk-in", customerPhone: customerPhone || "", notes });
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
    const totalAmount = order.items.reduce((s, it) => s + (it.price * it.qty), 0);
    w.document.write(`<html><head><title>KOT</title>
      <style>body{font-family:monospace;font-size:13px;padding:12px;width:280px}
      h2,h4{text-align:center;margin:4px 0}
      .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #000}</style></head><body>
      <h2>${RESTAURANT.name}</h2>
      <h4>WAITER ORDER — TABLE ${order.table}</h4>
      <p>Order: #${order.id.toUpperCase()}<br/>Waiter: ${order.waiter || "-"}<br/>Customer: ${order.customer.name}</p>
      <div style="margin-top:10px">
        ${order.items.map(it => `<div class="row"><span>${it.qty}x ${it.name}</span><span>₹${it.price * it.qty}</span></div>`).join('')}
      </div>
      <div style="text-align:right;font-weight:bold;margin-top:12px;font-size:15px">Total: ₹${totalAmount}</div>
      <p style="text-align:center;margin-top:12px;font-size:11px">— Thank You —</p>
      <script>window.print();setTimeout(()=>window.close(),500)</script></body></html>`);
    w.document.close();
  };

  // ✅ ORDER PLACED — Confirmation view
  if (placedOrder) {
    const total = placedOrder.items.reduce((s, it) => s + (it.price * it.qty), 0);
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 85, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="slide-up" style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: "20px", maxHeight: "92vh", overflowY: "auto" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 56, marginBottom: 8 }} className="scale-bounce">✅</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: COLORS.sage }}>Order Placed!</div>
            <div style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>KOT sent to kitchen successfully</div>
          </div>

          <div style={{ background: COLORS.paper, borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textLight, textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>Order</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800 }}>#{placedOrder.id.slice(1, 5).toUpperCase()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: COLORS.textLight, textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>Table</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: COLORS.copper }}>{placedOrder.table}</div>
              </div>
            </div>
            {placedOrder.waiter && (
              <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>
                🧑‍🍳 Waiter: <strong style={{ color: COLORS.ink }}>{placedOrder.waiter}</strong>
              </div>
            )}
            <div style={{ borderTop: `1px dashed ${COLORS.line}`, paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Items ({placedOrder.items.length})</div>
              {placedOrder.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0', fontWeight: 600 }}>
                  <span>{it.qty}× {it.name}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>₹{it.price * it.qty}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${COLORS.line}`, marginTop: 12, paddingTop: 12, fontWeight: 800, fontSize: 18 }}>
              <span>Total</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.copper }}>₹{total}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <button onClick={() => handlePrintKOT(placedOrder)}
              style={{ padding: 14, borderRadius: 12, border: `2px solid ${COLORS.ink}`, background: 'transparent', color: COLORS.ink, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              🖨️ Print KOT
            </button>
            <button onClick={() => onAddMoreItems(placedOrder.id)}
              style={{ padding: 14, borderRadius: 12, border: 'none', background: COLORS.info, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              ➕ Add More Items
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button onClick={() => { setPlacedOrder(null); setWaiterName(""); setCustomerName(""); setCustomerPhone(""); }}
              style={{ padding: 14, borderRadius: 12, border: `2px solid ${COLORS.sage}`, background: 'transparent', color: COLORS.sage, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              🆕 New Order
            </button>
            <button onClick={onClose}
              style={{ padding: 14, borderRadius: 12, border: 'none', background: COLORS.sage, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              ✓ Done
            </button>
          </div>

          <div style={{ fontSize: 11, color: COLORS.textLight, textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
            💡 <strong>Add More Items</strong> opens same order and creates a new KOT for kitchen.
          </div>
        </div>
      </div>
    );
  }

  // Default: Order form
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 85, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="slide-up" style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: "20px", maxHeight: "92vh", overflowY: "auto" }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><VegDot veg={item.veg} /><strong style={{ fontSize: 14 }}>{item.name}</strong></div>
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
          <button disabled={cartItems.length === 0 || isSubmitting}
            onClick={handleSubmit}
            style={{ width: "100%", padding: 16, border: "none", borderRadius: 14, background: cartItems.length ? COLORS.sage : COLORS.paper2, color: cartItems.length ? "#fff" : COLORS.textLight, fontWeight: 800, fontSize: 16, cursor: cartItems.length && !isSubmitting ? "pointer" : "not-allowed" }}>
            {isSubmitting ? "⏳ Sending..." : "🍳 Send Order to Kitchen"}
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
  const [runningOrderId, setRunningOrderId] = useState(null);
  const [showWaiterMode, setShowWaiterMode] = useState(false);
    const [showWaiterPinModal, setShowWaiterPinModal] = useState(false);
  const [waiterPinInput, setWaiterPinInput] = useState("");
  const [waiterUnlocked, setWaiterUnlocked] = useState(false);

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
    setTimeout(() => setToast(null), config.duration);
  }, []);

  useEffect(() => {
    const savedCustomer = localStorage.getItem('eatpark_customer');
    if (savedCustomer) { try { const data = JSON.parse(savedCustomer); if (data.name) setCustName(data.name); if (data.phone) setCustPhone(data.phone); if (data.address) setCustAddress(data.address); if (data.isLoggedIn) setIsLoggedIn(true); } catch (e) { } }
    const savedCart = localStorage.getItem('eatpark_cart');
    if (savedCart) { try { setCart(JSON.parse(savedCart)); } catch (e) { } }
    const savedOrders = localStorage.getItem('eatpark_orders');
    if (savedOrders) { try { const ordersData = JSON.parse(savedOrders); setMyOrderIds(ordersData.map(o => o.id)); } catch (e) { } }
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  useEffect(() => {
    if (custName || custPhone) localStorage.setItem('eatpark_customer', JSON.stringify({ name: custName, phone: custPhone, address: custAddress, isLoggedIn }));
  }, [custName, custPhone, custAddress, isLoggedIn]);

  useEffect(() => { if (Object.keys(cart).length > 0) localStorage.setItem('eatpark_cart', JSON.stringify(cart)); }, [cart]);

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
  }, [myOrderIds.join(",")]);

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
      new Notification(title, { body: message, icon: '/icon-192.png' });
    }
  }, []);

  const cancelOrder = useCallback(async (orderId) => {
    if (!window.confirm("Cancel this order?")) return;
    try {
      await updateDoc(doc(db, "orders", orderId), { status: "cancelled", cancelledAt: Date.now() });
      setOrdersState(prev => prev.map(o => o.id === orderId ? { ...o, status: "cancelled" } : o));
      showToast("❌ Order cancelled", 'warning');
    } catch (e) { showToast("⚠️ Failed to cancel", 'error'); }
  }, [setOrdersState, showToast]);

  const reorderOrder = useCallback((order) => {
    const newCart = {};
    order.items.forEach(item => { newCart[item.itemId] = (newCart[item.itemId] || 0) + item.qty; });
    setCart(newCart);
    setCartOpen(true);
    showToast("🔄 Items added to cart!", 'success');
  }, [showToast]);

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
    } catch (e) { showToast("⚠️ Failed to add items", "error"); }
  }, [orders, showToast]);

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
      deliveryFee: 0, loyaltyDiscount: 0, discount: 0
    };
    await placeOrder(order, 0);
    playNotificationSound();
    const waText = `🧑‍🍳 *WAITER ORDER* (#${orderId.slice(1, 5).toUpperCase()})\nTable ${t} · Waiter: ${waiterName || "Staff"}\nCustomer: ${customerName}\n` + items.map(i => `• ${i.qty}x ${i.name}`).join("\n") + (orderNotes ? `\nNotes: ${orderNotes}` : "") + `\n\nTotal: ₹${total}`;
    window.open(`https://wa.me/${RESTAURANT.whatsapp}?text=${encodeURIComponent(waText)}`, "_blank");
       return order;
  }, [placeOrder, showToast]);

    const handleWaiterPinSubmit = () => {
    const wPin = settings?.waiterPin || "1234";
    const sPin = settings?.staffPin || "5432";
    const aPin = settings?.adminPin || "9876";
    if (waiterPinInput === wPin || waiterPinInput === sPin || waiterPinInput === aPin) {
      setWaiterUnlocked(true);
      setShowWaiterPinModal(false);
      setWaiterPinInput("");
      setShowWaiterMode(true);
      showToast("🔓 Waiter Mode Unlocked!", "success");
    } else {
      showToast("❌ Incorrect Waiter PIN", "error");
      setWaiterPinInput("");
    }
  };

  const handleSendOtp = () => {
    if (!custPhone || custPhone.length < 10) { showToast("⚠️ Enter valid phone", 'error'); return; }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(code); setOtpStep("verify");
    showToast(`🔐 OTP: ${code}`, 'success');
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
          setCustName(data.name || ""); setCustAddress(data.address || ""); setIsLoggedIn(true);
          showToast(`👋 Welcome back ${data.name || 'Guest'}!`, 'success');
        }
      } catch (e) { }
    }
  }, [showToast]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) { showToast("Geolocation not supported", 'error'); return; }
    showToast("📍 Fetching location...", 'info');
    navigator.geolocation.getCurrentPosition(
      (position) => { const { latitude, longitude } = position.coords; setCustAddress(`Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`); showToast("✅ Location fetched!", 'success'); },
      () => { showToast("⚠️ Unable to get location", 'error'); }
    );
  };

  const handleApplyCoupon = () => {
    const code = couponCode.toUpperCase().trim();
    const coupons = {
      "EAT20": { discount: 20, min: 0, ok: () => true, msg: "🎉 20% Applied!" },
      "EATS10": { discount: 10, min: 0, ok: () => true, msg: "🎉 10% Applied!" },
      "WELCOME20": { discount: 20, min: 0, ok: () => myOrderIds.length === 0, msg: "🎉 Welcome 20% Applied!", failMsg: "💳 First order only" },
      "COMEBACK15": { discount: 15, min: 199, ok: () => true, msg: "🎉 15% Applied!" },
      "LOYALTY50": { discount: 50, min: 0, ok: () => currentCoins >= 500, msg: "👑 VIP 50% Applied!", failMsg: "👑 Requires 500+ coins" }
    };
    const coupon = coupons[code];
    if (!coupon) { showToast("❌ Invalid coupon", 'error'); return; }
    if (!coupon.ok()) { showToast(coupon.failMsg || "⚠️ Conditions not met", 'warning'); return; }
    if (subtotal < coupon.min) { showToast(`⚠️ Min ₹${coupon.min} required`, 'warning'); return; }
    setAppliedDiscount(coupon.discount);
    showToast(coupon.msg, 'success');
  };

  const handlePlaceOrder = useCallback(async () => {
    if (cartItems.length === 0) return;
    if (!custName.trim()) { showToast("⚠️ Enter Name", 'error'); return; }
    if (!custPhone.trim() || custPhone.length < 10) { showToast("⚠️ Enter valid Phone", 'error'); return; }
    if (orderType === "parcel" && !custAddress.trim()) { showToast("⚠️ Enter Address", 'error'); return; }

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
      const claimedText = claimedReward ? `\n🎁 *Free Reward:* ${claimedReward.item}` : "";
      const scheduleText = isScheduled && scheduleDate && scheduleTime ? `\n📅 *Scheduled:* ${scheduleDate} at ${scheduleTime}` : "";
      const waText = `🚨 *NEW ORDER* (#${orderId.slice(1, 5).toUpperCase()})\n\n*Type:* ${orderType === 'parcel' ? '🛍️ Parcel' : `🍽️ Table ${table}`}\n*Customer:* ${custName} (${custPhone})\n` + (orderType === 'parcel' ? `*Address:* ${custAddress}\n\n` : `\n`) + `*Items:* ${itemStrings}${claimedText}\n` + (appliedDiscount > 0 ? `*Coupon:* ${appliedDiscount}%\n` : ``) + (loyaltyDiscount > 0 ? `*Loyalty:* ${loyaltyTier.name}\n` : ``) + `*Total:* ₹${finalTotal}\n*Payment:* ${paymentMethod}\n` + scheduleText + (notes ? `*Notes:* ${notes}` : ``);

      const link = document.createElement('a');
      link.href = `https://wa.me/${RESTAURANT.whatsapp}?text=${encodeURIComponent(waText)}`;
      link.target = '_blank'; document.body.appendChild(link); link.click(); document.body.removeChild(link);

      const initialItems = cartItems.map(([id, qty]) => { const m = menu.find((mi) => mi.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty, kotNumber: 1 }; });

      const order = {
        id: orderId, table, orderType,
        customer: { name: custName, phone: custPhone, address: orderType === "parcel" ? custAddress : "" },
        items: initialItems,
        claimedReward: claimedReward ? claimedReward.item : null,
        rewardUsedCoins: claimedReward ? claimedReward.cost : 0,
        earnedCoins: newEarnedCoins,
        discount: appliedDiscount,
        loyaltyDiscount, loyaltyTier: loyaltyTier.name,
        deliveryFee, notes, payment: paymentMethod,
        paymentStatus: paymentMethod === "cash" ? "pending" : "paid",
        status: "new", paid: paymentMethod !== "cash",
        createdAt: Date.now(),
        scheduledDate: isScheduled ? scheduleDate : null,
        scheduledTime: isScheduled ? scheduleTime : null,
        isScheduled,
        coinsClaimed: false,
        kots: [{ id: uid("kot"), kotNumber: 1, items: initialItems, createdAt: Date.now(), status: "new", isRunning: false }]
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
      try { await updateDoc(doc(db, "customers", custPhone), { totalOrders: customerData.totalOrders, totalSpent: customerData.totalSpent, lastOrderDate: Date.now() }); } catch (e) { }

      playNotificationSound();
      sendPushNotification("🛎️ New Order", `Order #${orderId.slice(1, 5)} - ₹${finalTotal}`);
      setMyOrderIds([...myOrderIds, order.id]);
      setCart({});
      localStorage.removeItem('eatpark_cart');
      setNotes(""); setClaimedReward(null); setCartOpen(false); setActiveModal('track');
      setIsScheduled(false); setScheduleDate(""); setScheduleTime("");
      showToast("🎉 Order Placed!", 'success');
    } catch (e) {
      console.error("Order error:", e);
      showToast("⚠️ Failed. Try again.", 'error');
    } finally { setIsProcessingPayment(false); }
  }, [cartItems, custName, custPhone, custAddress, orderType, table, paymentMethod, finalTotal, claimedReward, isScheduled, scheduleDate, scheduleTime, appliedDiscount, loyaltyDiscount, loyaltyTier, notes, menu, placeOrder, sendPushNotification, myOrderIds, showToast]);

  const handleBooking = async () => {
    if (!bookData.name || !bookData.phone || !bookData.date || !bookData.time || !bookData.guests) { showToast("⚠️ Fill all fields", 'error'); return; }
    const newBooking = { ...bookData, type: bookType, id: uid("b"), status: "pending", createdAt: Date.now() };
    await bookEvent(newBooking);
    setConfirmedBooking(newBooking);
    setBookData({ name: "", phone: "", date: "", time: "", guests: "" });
    showToast("✅ Booking Sent!", 'success');
  };

  const addComboToCart = useCallback((combo) => {
    combo.items.forEach(item => { setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + item.quantity })); });
    showToast(`🎉 ${combo.name} added!`, 'success');
  }, [showToast]);

  const addFlashSaleToCart = useCallback((item) => {
    setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
    showToast(`⚡ ${item.name} added!`, 'success');
  }, [showToast]);

  const inputStyle = { padding: "12px 16px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 16, width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: cartCount ? 120 : 60, background: "var(--bg-color, #fff)", minHeight: "100vh", position: "relative" }}>
      {toast && <Toast message={toast} type={toastType} />}

      <button onClick={() => { requestWaiter(table); showToast("🔔 Waiter notified!", 'success'); }}
        style={{ position: "fixed", top: 80, right: 16, background: COLORS.rust, color: "#fff", border: "none", borderRadius: 20, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 8px 24px rgba(192,57,43,0.4)", cursor: "pointer", zIndex: 60, fontSize: 13, fontWeight: 800 }}>🔔 Waiter Call</button>

            <button onClick={() => {
        if (waiterUnlocked) setShowWaiterMode(true);
        else setShowWaiterPinModal(true);
      }}
        style={{ position: "fixed", top: 130, right: 16, background: waiterUnlocked ? COLORS.info : COLORS.ink, color: "#fff", border: "none", borderRadius: 20, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 8px 24px rgba(59,130,246,0.4)", cursor: "pointer", zIndex: 60, fontSize: 13, fontWeight: 800 }}>{waiterUnlocked ? "🧑‍🍳 Waiter Mode" : "🔒 Waiter Mode"}</button>

      <div style={{ position: "relative", height: 220, borderRadius: "0 0 24px 24px", overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", marginBottom: 16 }}>
        <div className="keep-color" style={{ position: "absolute", inset: 0, backgroundImage: `url('${settings?.heroImage || "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80"}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="keep-color" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,26,26,0.9) 0%, rgba(26,26,26,0.3) 60%, rgba(26,26,26,0.1) 100%)" }} />
        <div className="keep-color" style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.25)", backdropFilter: "blur(12px)", padding: "6px 12px", borderRadius: 20, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>Table</span>
          <select value={table} onChange={(e) => setTable(Number(e.target.value))} style={{ background: "transparent", color: "#fff", border: "none", fontWeight: 800, fontSize: 16, outline: "none" }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (<option key={n} value={n} style={{ color: '#000' }}>{n}</option>))}
          </select>
        </div>
        <div className="keep-color" style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, color: "#fff", margin: "0 0 4px", fontWeight: 800 }}>{RESTAURANT.name}</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", margin: 0, fontWeight: 500 }}>{RESTAURANT.tagline}</p>
        </div>
      </div>

      {myActiveOrders.length > 0 && (
        <div style={{ padding: "0 16px", marginBottom: 12, display: "flex", gap: 8 }}>
          <button onClick={() => setActiveModal('track')} style={{ flex: 1, background: COLORS.sageLight, border: `2px solid ${COLORS.sage}`, color: COLORS.sageDark, borderRadius: 14, padding: "12px", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: 14 }}>
            <span>📦 {myActiveOrders.length} Active Order{myActiveOrders.length > 1 ? 's' : ''}</span><span>Track ➔</span>
          </button>
          <button onClick={() => setRunningOrderId(myActiveOrders[0].id)} style={{ background: COLORS.info, color: "#fff", border: "none", borderRadius: 14, padding: "0 16px", fontWeight: 800, cursor: "pointer", fontSize: 18 }}>➕</button>
        </div>
      )}

      {!searchQuery.trim() && comboOffers && comboOffers.filter(c => c.active).length > 0 && (
        <div style={{ padding: "16px", borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 12 }}>🎯 Combo Offers</h3>
          <div style={{ display: 'grid', gap: 12 }}>
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
        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "8px 16px", borderBottom: `1px solid ${COLORS.line}` }}>
          {categories.map((c) => (<button key={c} onClick={() => setCategory(c)} style={{ whiteSpace: "nowrap", padding: "8px 16px", borderRadius: 12, border: `1.5px solid ${category === c ? COLORS.copper : COLORS.line}`, background: category === c ? COLORS.copper : "transparent", color: category === c ? "#fff" : COLORS.ink, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{c}</button>))}
        </div>
      )}

      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <button onClick={() => setVegOnly(!vegOnly)} style={{ padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${vegOnly ? COLORS.sage : COLORS.line}`, background: vegOnly ? COLORS.sageLight : "transparent", color: vegOnly ? COLORS.sageDark : COLORS.textLight, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <VegDot veg={true} /><span style={{ fontSize: 13 }}>{vegOnly ? "Veg" : "All"}</span>
          </button>
        </div>

        {filteredItems.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: COLORS.textLight }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>{EMPTY_STATES[emptyReason].icon}</div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{EMPTY_STATES[emptyReason].title}</div>
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
                  {item.portion && <span style={{ fontSize: 11, background: COLORS.paper2, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{item.portion}</span>}
                  {item.isBestseller && <span style={{ fontSize: 11, background: COLORS.copperLight, color: COLORS.copperDark, padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>🔥 Bestseller</span>}
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{item.name}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: COLORS.copper, fontWeight: 800, marginBottom: 4 }}>{inr(item.price)}</div>
                {item.desc && <div style={{ fontSize: 12, color: COLORS.textLight, lineHeight: 1.4 }}>{item.desc}</div>}
              </div>
              <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
                <img src={item.image} alt={item.name} loading="lazy" className="keep-color" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; }} />
                <div style={{ position: "absolute", top: -4, right: -4 }}>
                  <button onClick={() => toggleFavorite(item.id)} style={{ background: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }}>
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

      <div style={{ textAlign: "center", padding: "20px 20px 60px", fontSize: 13, color: COLORS.textLight, lineHeight: 1.6 }}>
        {RESTAURANT.address}<br />{RESTAURANT.phones.join(" · ")}<br /><br />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button onClick={() => requestPinPrompt("staff")} style={{ background: "none", border: `1px solid ${COLORS.line}`, color: COLORS.textLight, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>🔒 Staff Login</button>
          <button onClick={() => requestPinPrompt("admin")} style={{ background: "none", border: `1px solid ${COLORS.line}`, color: COLORS.textLight, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>⚙️ Admin Login</button>
        </div>
      </div>

      {aiSuggestion && !cartOpen && !activeModal && (
        <div className="smooth-slide-up" style={{ position: 'fixed', bottom: cartCount > 0 ? 100 : 20, left: 16, right: 16, background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', padding: 14, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 4 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#d35400' }}>🤖 AI Suggests:</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{aiSuggestion.name}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => { handleSetQty(aiSuggestion.id, 1); setAiSuggestion(null); }} style={{ background: COLORS.ink, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>+ Add</button>
            <button onClick={() => setAiSuggestion(null)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>&times;</button>
          </div>
        </div>
      )}

      {!cartOpen && !activeModal && (
        <button className="keep-color" onClick={() => setShowSidebar(true)} style={{ position: "fixed", top: 16, left: 16, background: COLORS.ink, color: "#fff", border: "none", borderRadius: "50%", width: 50, height: 50, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 50, fontSize: 20 }}>☰</button>
      )}

      {cartCount > 0 && !cartOpen && !activeModal && (
        <button onClick={() => setCartOpen(true)} style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 400, background: COLORS.sage, color: "#fff", border: "none", borderRadius: 16, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, fontSize: 16, cursor: "pointer", zIndex: 5, boxShadow: "0 12px 28px rgba(74,124,89,0.35)" }}>
          <span>{cartCount} item{cartCount > 1 ? "s" : ""}</span><span>{inr(finalTotal)} ➔</span>
        </button>
      )}

      {showSidebar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex" }}>
          <div style={{ width: "80%", maxWidth: 300, background: "#fff", height: "100%", padding: "24px", display: "flex", flexDirection: "column", overflowY: "auto" }} className="slide-right">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: COLORS.copper }}>Eat & Park</div>
              <button onClick={() => setShowSidebar(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <SidebarBtn icon={isDark ? "☀️" : "🌙"} text={isDark ? "Light Mode" : "Dark Mode"} onClick={() => { setIsDark(!isDark); setShowSidebar(false); }} highlight />
              <SidebarBtn icon="🖼️" text="Photo Gallery" onClick={() => { setShowSidebar(false); setActiveModal('gallery'); }} />
              <SidebarBtn icon="📜" text="Order History" onClick={() => { setShowSidebar(false); setActiveModal('orderHistory'); }} />
              <SidebarBtn icon="🪙" text="Coin History" onClick={() => { setShowSidebar(false); setActiveModal('coinHistory'); }} />
              <SidebarBtn icon="🎁" text="Today's Offers" onClick={() => { setShowSidebar(false); setActiveModal('offers'); }} />
              <SidebarBtn icon="🍽️" text="Table Booking" onClick={() => { setShowSidebar(false); setBookType("table"); setActiveModal('booking'); }} />
              <SidebarBtn icon="🎉" text="Party Booking" onClick={() => { setShowSidebar(false); setBookType("party"); setActiveModal('booking'); }} />
              <SidebarBtn icon="👑" text="VIP Loyalty" onClick={() => { setShowSidebar(false); setActiveModal('loyalty'); }} />
              <SidebarBtn icon="⭐" text="Rate on Google" onClick={() => { setShowSidebar(false); window.open(GOOGLE_REVIEW_URL, '_blank'); }} highlight />
              <div style={{ marginTop: 16, padding: 12, background: COLORS.paper, borderRadius: 12, textAlign: 'center' }}>
                <QRCodeSVG value={window.location.href} size={100} />
                <p style={{ fontSize: 11, color: COLORS.textLight, marginTop: 6 }}>📲 Scan to order</p>
              </div>
              <SidebarBtn icon="💬" text="Chat with Restaurant" onClick={() => { setShowSidebar(false); setActiveOrderIdForChat(myActiveOrders[0]?.id || 'general'); setActiveModal('chat'); }} />
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.6)" }} onClick={() => setShowSidebar(false)} />
        </div>
      )}

      {(cartOpen || activeModal) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 70 }} onClick={() => { setCartOpen(false); setActiveModal(null); setConfirmedBooking(null); }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: "24px 20px 30px", maxHeight: "85vh", overflowY: "auto" }} className="slide-up">

            {cartOpen && (
              <>
                <ModalHeader title="Checkout" onClose={() => setCartOpen(false)} />
                {cartItems.map(([id, q]) => {
                  const item = menu.find((m) => m.id === id);
                  return (<div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "12px", background: COLORS.paper, borderRadius: 12 }}><div style={{ fontSize: 15, fontWeight: 700 }}>{item.name}</div><Stepper qty={q} onChange={(nq) => handleSetQty(id, nq)} /></div>);
                })}

                <div style={{ display: "flex", gap: 12, marginTop: 20, marginBottom: 16 }}>
                  <button onClick={() => setOrderType("dine_in")} style={{ flex: 1, padding: "12px", border: `2px solid ${orderType === "dine_in" ? COLORS.copper : COLORS.line}`, background: orderType === "dine_in" ? COLORS.copper : "#fff", color: orderType === "dine_in" ? "#fff" : COLORS.ink, borderRadius: 12, fontWeight: 800, cursor: "pointer" }}>🍽️ Dine-in</button>
                  <button onClick={() => setOrderType("parcel")} style={{ flex: 1, padding: "12px", border: `2px solid ${orderType === "parcel" ? COLORS.copper : COLORS.line}`, background: orderType === "parcel" ? COLORS.copper : "#fff", color: orderType === "parcel" ? "#fff" : COLORS.ink, borderRadius: 12, fontWeight: 800, cursor: "pointer" }}>🛍️ Parcel</button>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>📅 Schedule Order</span>
                  </label>
                  {isScheduled && (<div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                    <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  </div>)}
                </div>

                <div style={{ background: COLORS.paper2, padding: 16, borderRadius: 16, marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>🔐 Quick OTP</div>
                  {!isLoggedIn ? (
                    <div>
                      {otpStep === "phone" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="tel" placeholder="10-digit Phone" value={custPhone} onChange={(e) => { setCustPhone(e.target.value); checkExistingCustomer(e.target.value); }} style={{ ...inputStyle, flex: 1 }} />
                          <button onClick={handleSendOtp} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer" }}>Send</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="text" placeholder="Enter OTP" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                          <button onClick={handleVerifyOtp} style={{ background: COLORS.success, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer" }}>Verify</button>
                        </div>
                      )}
                    </div>
                  ) : (<div style={{ color: COLORS.success, fontWeight: 800, fontSize: 14 }}>✓ Verified ({custPhone})</div>)}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 20 }}>
                  <input type="text" placeholder="Your Name *" value={custName} onChange={(e) => setCustName(e.target.value)} style={inputStyle} />
                  <input type="tel" placeholder="Phone *" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} style={inputStyle} />
                  {orderType === "parcel" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <textarea placeholder="Address *" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} style={{ ...inputStyle, resize: "none", flex: 1 }} rows={2} />
                      <button onClick={handleGetLocation} style={{ background: COLORS.sage, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer" }}>📍</button>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <input type="text" placeholder="Coupon (EAT20)" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} style={inputStyle} />
                  <button onClick={handleApplyCoupon} style={{ background: COLORS.gold, color: COLORS.ink, border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer" }}>Apply</button>
                </div>

                {custPhone.length >= 10 && (
                  <div style={{ background: 'linear-gradient(135deg, #fdfbfb, #ebedee)', borderRadius: 16, padding: 16, marginBottom: 20, border: `1.5px solid ${COLORS.gold}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>🪙 EatCoins</div>
                      <div><div style={{ fontSize: 14, fontWeight: 800, color: COLORS.sageDark }}>Bal: {currentCoins}</div><div style={{ fontSize: 11, color: COLORS.gold, fontWeight: 700 }}>{loyaltyTier.name}</div></div>
                    </div>
                    <LoyaltyProgress currentPoints={currentCoins} nextTier={LOYALTY_TIERS.find((t) => t.points > currentCoins) || null} loyaltyRules={loyaltyRules} />
                    {loyaltyRules.rewards.map(r => {
                      const canAfford = currentCoins >= r.cost;
                      const isClaimed = claimedReward?.id === r.id;
                      return (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: 12, borderRadius: 10, marginTop: 8, border: `1px solid ${isClaimed ? COLORS.success : COLORS.line}` }}>
                          <div><div style={{ fontWeight: 700, fontSize: 14 }}>{r.item}</div><div style={{ fontSize: 12, color: COLORS.gold, fontWeight: 800 }}>{r.cost} Coins</div></div>
                          <button onClick={() => { setClaimedReward(isClaimed ? null : r); if (!isClaimed) showToast(`🎁 ${r.item} claimed!`, 'reward'); }} disabled={!canAfford && !isClaimed}
                            style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: isClaimed ? COLORS.success : (canAfford ? COLORS.ink : COLORS.paper2), color: isClaimed || canAfford ? '#fff' : COLORS.textLight, fontWeight: 800, cursor: canAfford ? 'pointer' : 'not-allowed', fontSize: 13 }}>
                            {isClaimed ? "✓ Claimed" : (canAfford ? "Claim 🎁" : `${r.cost - currentCoins} more`)}
                          </button>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 12, color: COLORS.copper, fontWeight: 700, textAlign: 'center', marginTop: 8 }}>🎁 You'll earn +{newEarnedCoins} coins!</div>
                  </div>
                )}

                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special instructions?" style={{ ...inputStyle, marginBottom: 20, resize: "none" }} rows={2} />

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 10 }}>Payment</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <button onClick={() => setPaymentMethod('cash')} style={{ padding: '10px', borderRadius: 10, border: `2px solid ${paymentMethod === 'cash' ? COLORS.copper : COLORS.line}`, background: paymentMethod === 'cash' ? COLORS.copperLight : 'transparent', fontWeight: 700, cursor: 'pointer' }}>💵 Cash</button>
                    <button onClick={() => setPaymentMethod('razorpay')} style={{ padding: '10px', borderRadius: 10, border: `2px solid ${paymentMethod === 'razorpay' ? COLORS.copper : COLORS.line}`, background: paymentMethod === 'razorpay' ? COLORS.copperLight : 'transparent', fontWeight: 700, cursor: 'pointer' }}>💳 Razorpay</button>
                    <button onClick={() => setPaymentMethod('phonepe')} style={{ padding: '10px', borderRadius: 10, border: `2px solid ${paymentMethod === 'phonepe' ? COLORS.copper : COLORS.line}`, background: paymentMethod === 'phonepe' ? COLORS.copperLight : 'transparent', fontWeight: 700, cursor: 'pointer' }}>📱 PhonePe</button>
                    <button onClick={() => setPaymentMethod('gpay')} style={{ padding: '10px', borderRadius: 10, border: `2px solid ${paymentMethod === 'gpay' ? COLORS.copper : COLORS.line}`, background: paymentMethod === 'gpay' ? COLORS.copperLight : 'transparent', fontWeight: 700, cursor: 'pointer' }}>🟢 GPay</button>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.textLight }}><span>Subtotal</span><span>{inr(subtotal)}</span></div>
                  {appliedDiscount > 0 && (<div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.success }}><span>Coupon ({appliedDiscount}%)</span><span>-{inr(discountAmount)}</span></div>)}
                  {loyaltyDiscount > 0 && (<div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.gold }}><span>Loyalty</span><span>-{inr(loyaltyDiscount)}</span></div>)}
                  {orderType === "parcel" && (<div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.copper }}><span>Delivery</span><span>+{inr(deliveryFee)}</span></div>)}
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18, borderTop: `1px solid ${COLORS.line}`, paddingTop: 8, marginTop: 4 }}>
                    <span>Total</span><span style={{ color: COLORS.copper, fontFamily: "'JetBrains Mono', monospace" }}>{inr(finalTotal)}</span>
                  </div>
                </div>

                <button onClick={handlePlaceOrder} disabled={isProcessingPayment} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 14, padding: "16px", fontWeight: 800, fontSize: 16, cursor: isProcessingPayment ? 'not-allowed' : 'pointer', width: "100%", opacity: isProcessingPayment ? 0.6 : 1 }}>
                  {isProcessingPayment ? '⏳ Processing...' : '🎉 Place Order'}
                </button>
              </>
            )}

            {activeModal === 'gallery' && (<><ModalHeader title="🖼️ Photo Gallery" onClose={() => setActiveModal(null)} /><div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>{gallery.map((imgUrl, idx) => (<img key={idx} src={imgUrl} alt="" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 12 }} onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; }} />))}</div></>)}

            {activeModal === 'orderHistory' && (
              <><ModalHeader title="📜 Order History" onClose={() => setActiveModal(null)} />
                {myOrders.length === 0 ? (<div style={{ textAlign: 'center', padding: "40px 0", color: COLORS.textLight }}>No orders yet</div>) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[...myOrders].reverse().map(o => {
                      const orderTotal = o.items.reduce((s, i) => s + (i.price * i.qty), 0) + (o.deliveryFee || 0) - (o.loyaltyDiscount || 0);
                      const isCancelled = o.status === "cancelled";
                      const isCompleted = o.status === "served";
                      return (
                        <div key={o.id} style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, padding: 16, borderRadius: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontWeight: 800 }}>
                            <span>#{o.id.slice(1, 5).toUpperCase()}</span>
                            <span style={{ fontSize: 11, color: isCancelled ? COLORS.error : isCompleted ? COLORS.sage : COLORS.copper }}>{isCancelled ? "❌ Cancelled" : isCompleted ? "✅ Done" : o.status}</span>
                          </div>
                          <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>{new Date(o.createdAt).toLocaleString('en-IN')}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{o.items.map(i => `${i.qty}× ${i.name}`).join(", ")}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${COLORS.line}`, paddingTop: 10, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: COLORS.copper }}>💰 {inr(orderTotal)}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {!isCancelled && (<button onClick={() => reorderOrder(o)} style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${COLORS.sage}`, background: 'transparent', color: COLORS.sage, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>🔄 Reorder</button>)}
                              <GoogleReviewButton variant="primary" size="sm" />
                              {!isCompleted && !isCancelled && (
                                <button onClick={() => cancelOrder(o.id)} style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${COLORS.error}`, background: 'transparent', color: COLORS.error, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>❌ Cancel</button>
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

            {activeModal === 'coinHistory' && (<><ModalHeader title="🪙 Coin History" onClose={() => setActiveModal(null)} />{myCoinLogs.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: COLORS.textLight }}>No transactions</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[...myCoinLogs].reverse().map((log, idx) => (<div key={idx} style={{ background: COLORS.paper, padding: 14, borderRadius: 12, display: 'flex', justifyContent: 'space-between' }}><div><div style={{ fontWeight: 700, fontSize: 14 }}>{log.reason}</div><div style={{ fontSize: 11, color: COLORS.textLight }}>{new Date(log.timestamp).toLocaleString('en-IN')}</div></div><div style={{ fontWeight: 800, color: log.coins > 0 ? COLORS.success : COLORS.error }}>{log.coins > 0 ? `+${log.coins}` : log.coins} 🪙</div></div>))}</div>}</>)}

            {activeModal === 'offers' && (<><ModalHeader title="🎁 Offers" onClose={() => setActiveModal(null)} />{offersList.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: COLORS.textLight }}>No offers</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{offersList.map(offer => (<div key={offer.id} onClick={() => { setSearchQuery(offer.title); setActiveModal(null); }} style={{ background: 'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)', padding: 20, borderRadius: 16, cursor: 'pointer' }}><div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{offer.title}</div><div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{offer.desc}</div></div>))}</div>}</>)}

            {activeModal === 'loyalty' && (<><ModalHeader title="VIP Loyalty 👑" onClose={() => setActiveModal(null)} /><div style={{ background: "linear-gradient(135deg, #1A1A1A 0%, #3C3C3C 100%)", borderRadius: 20, padding: 28, color: "#fff", textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>💎</div><div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 10, color: COLORS.gold }}>Eat & Park Elite</div><div style={{ fontSize: 15, marginBottom: 24 }}>Become premium for <strong style={{ fontSize: 20, color: COLORS.gold }}>₹999/month</strong>. Get 20% off!</div><div style={{ background: "#fff", padding: 20, borderRadius: 16 }}><div style={{ color: COLORS.ink, fontWeight: 800, marginBottom: 10 }}>Scan to Join</div><img src={loyaltyQrSrc} alt="" style={{ width: 160, height: 160 }} /></div></div></>)}

            {activeModal === 'booking' && (<><ModalHeader title={bookType === "party" ? "Party Booking 🎉" : "Table Booking 🍽️"} onClose={() => { setActiveModal(null); setConfirmedBooking(null); }} />{confirmedBooking ? (<div style={{ textAlign: "center", padding: "30px 0" }}><div style={{ fontSize: 56, marginBottom: 16 }}>✅</div><h3 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Request Sent!</h3><button onClick={() => { setActiveModal(null); setConfirmedBooking(null); }} style={{ background: COLORS.paper2, border: 'none', padding: '12px', borderRadius: 12, width: '100%', fontWeight: 800, cursor: 'pointer' }}>Close</button></div>) : (<div style={{ display: "flex", flexDirection: "column", gap: 14 }}><input type="text" placeholder="Name" value={bookData.name} onChange={(e) => setBookData({ ...bookData, name: e.target.value })} style={inputStyle} /><input type="tel" placeholder="Phone" value={bookData.phone} onChange={(e) => setBookData({ ...bookData, phone: e.target.value })} style={inputStyle} /><div style={{ display: "flex", gap: 14 }}><input type="date" value={bookData.date} onChange={(e) => setBookData({ ...bookData, date: e.target.value })} style={inputStyle} /><input type="time" value={bookData.time} onChange={(e) => setBookData({ ...bookData, time: e.target.value })} style={inputStyle} /></div><input type="number" placeholder="Guests" value={bookData.guests} onChange={(e) => setBookData({ ...bookData, guests: e.target.value })} style={inputStyle} /><button onClick={handleBooking} style={{ background: COLORS.copper, color: '#fff', border: 'none', borderRadius: 14, padding: '13px 20px', fontWeight: 800, cursor: 'pointer' }}>Send Request</button></div>)}</>)}

            {activeModal === 'track' && (<><ModalHeader title="Active Orders" onClose={() => setActiveModal(null)} />{myActiveOrders.length === 0 ? (<div style={{ textAlign: 'center', padding: 50, color: COLORS.textLight }}>No active orders</div>) : myActiveOrders.map(o => { const estimatedTime = getEstimatedTime(o.items); const isCancellable = o.status === "new" || o.status === "preparing"; return (<div key={o.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 20, marginBottom: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><div style={{ fontSize: 20, fontWeight: 700 }}>Order #{o.id.slice(1, 5).toUpperCase()}</div>{o.kots?.length > 1 && <KotBadge kots={o.kots} />}</div><OrderTimer createdAt={o.createdAt} estimatedTime={estimatedTime} /><div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}><ProgressRing progress={getOrderProgress(o.status)} size={80} /></div><div style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 12 }}>{o.items.map(i => `${i.qty}x ${i.name}`).join(", ")}</div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button onClick={() => setActiveModal(null)} style={{ flex: 1, background: "transparent", color: COLORS.copper, border: `2px solid ${COLORS.copper}`, borderRadius: 14, padding: "13px 20px", fontWeight: 800, cursor: 'pointer' }}>Back</button><button onClick={() => setRunningOrderId(o.id)} style={{ padding: "13px 20px", background: COLORS.info, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>➕ Running</button>{isCancellable && (<button onClick={() => cancelOrder(o.id)} style={{ padding: "13px 20px", background: 'transparent', color: COLORS.error, border: `2px solid ${COLORS.error}`, borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>❌ Cancel</button>)}</div></div>); })}</>)}

            {activeModal === 'chat' && (<><ModalHeader title="💬 Chat" onClose={() => setActiveModal(null)} /><ChatBox orderId={activeOrderIdForChat || 'general'} customerId={custPhone || 'customer'} /></>)}
          </div>
        </div>
      )}

      {showWaiterMode && (
        <WaiterOrderPanel
          menu={menu}
          table={table}
          setTable={setTable}
          onSubmit={handleWaiterOrder}
          onClose={() => setShowWaiterMode(false)}
          onAddMoreItems={(orderId) => {
            setShowWaiterMode(false);
            setRunningOrderId(orderId);
          }}
        />
      )}

      {showWaiterPinModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowWaiterPinModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", padding: "28px", borderRadius: 20, width: "90%", maxWidth: 340, textAlign: "center" }} className="slide-up">
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧑‍🍳</div>
            <h3 style={{ margin: "0 0 8px", fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800 }}>Waiter Access</h3>
            <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 20 }}>Enter waiter PIN to continue</div>
            <input type="password" placeholder="••••" autoFocus value={waiterPinInput}
              onChange={(e) => setWaiterPinInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleWaiterPinSubmit(); }}
              style={{ padding: "14px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 28, width: "100%", boxSizing: "border-box", textAlign: "center", letterSpacing: 10, marginBottom: 20, fontWeight: 800 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowWaiterPinModal(false); setWaiterPinInput(""); }}
                style={{ flex: 1, padding: "13px", borderRadius: 12, border: `2px solid ${COLORS.line}`, background: "transparent", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleWaiterPinSubmit}
                style={{ flex: 1, padding: "13px", borderRadius: 12, background: COLORS.info, color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>Unlock</button>
            </div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 12 }}>Default PIN: <strong>1234</strong></div>
          </div>
        </div>
      )}
      {runningOrderId && orders.find(o => o.id === runningOrderId) && (
        <RunningOrderModal order={orders.find(o => o.id === runningOrderId)} menu={menu} onConfirm={(items) => addRunningItems(runningOrderId, items)} onClose={() => setRunningOrderId(null)} />
      )}
    </div>
  );
}

// ============================================
// 17. STAFF VIEW (V15 — TOUCH TO PROCEED)
// ============================================

const STAFF_SHORTCUTS = {
  'Ctrl+K': 'Focus first order',
  '↑ / ↓': 'Navigate',
  'Enter / Space': 'Advance selected',
  'Shift+?': 'Toggle help'
};

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
    const kots = order.kots?.length ? order.kots : [{ kotNumber: 1, items: order.items }];
    const itemsHtml = kots.map(kot => `<div style="margin-top:10px;border-top:1px dashed #000;padding-top:6px"><strong>KOT #${kot.kotNumber}${kot.isRunning ? ' (RUNNING)' : ''}</strong>${kot.items.map(it => `<div>${it.qty}x ${it.name}</div>`).join('')}</div>`).join('');
    const totalAmount = order.items.reduce((s, it) => s + (it.price * it.qty), 0) + (order.deliveryFee || 0) - (order.loyaltyDiscount || 0);
    w.document.write(`<html><head><title>KOT</title><style>body{font-family:monospace;font-size:12px;padding:10px;width:260px}h2,h4{text-align:center;margin:4px 0}</style></head><body><h2>${RESTAURANT.name}</h2><h4>${order.orderType === 'parcel' ? 'PARCEL' : `TABLE ${order.table}`}</h4><p>Order: #${order.id.toUpperCase()}<br/>Customer: ${order.customer.name}</p>${itemsHtml}<div style="text-align:right;font-weight:bold;margin-top:10px">Total: ₹${totalAmount}</div><script>window.print();setTimeout(()=>window.close(),500)</script></body></html>`);
    w.document.close();
  };

  return (
    <div style={{ padding: "26px 20px 60px", maxWidth: 1200, margin: "0 auto" }}>
      <KitchenNotificationColumn orders={active} selectedOrderId={selectedOrderId} onSelect={setSelectedOrderId} />

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800 }}>🍳 Kitchen Board</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowHelpModal(true)} style={{ background: COLORS.paper2, border: `1.5px solid ${COLORS.line}`, borderRadius: 12, padding: "10px 16px", cursor: "pointer", fontWeight: 700 }}>⌨️ Shortcuts</button>
          <button onClick={() => requestPinPrompt("admin")} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 14, padding: "13px 20px", fontWeight: 700, cursor: 'pointer' }}>⚙️ Admin</button>
        </div>
      </div>
      <div style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 24, fontWeight: 600 }}>👆 Tap to advance. No sliding needed.</div>

      {newOrderCount > 0 && (
        <div className="slide-up" style={{ background: 'rgba(226,89,56,0.1)', border: `2px solid ${COLORS.copper}`, borderRadius: 16, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🛎️</span>
          <div><div style={{ fontWeight: 800, fontSize: 16, color: COLORS.copper }}>{newOrderCount} New Order{newOrderCount > 1 ? 's' : ''}!</div><div style={{ fontSize: 13, color: COLORS.textLight }}>Tap the card to advance</div></div>
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
                <button onClick={() => resolveCall(c.id)} style={{ background: COLORS.success, color: '#fff', border: 'none', padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>✓ Done</button>
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
                <span style={{ fontSize: 13, background: STATUS_COLOR[status], color: "#fff", padding: "3px 10px", borderRadius: 14, fontWeight: 700, marginLeft: "auto" }}>{list.length}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {list.map((o) => {
                  const isSelected = selectedOrderId === o.id;
                  const runningCount = (o.kots || []).filter(k => k.isRunning).length;
                  return (
                    <div key={o.id} onClick={() => setSelectedOrderId(o.id)} style={{ background: isSelected ? COLORS.copper : '#fff', border: `2px solid ${isSelected ? COLORS.copper : COLORS.line}`, borderRadius: 16, padding: 18, cursor: 'pointer', transition: 'all 0.2s ease' }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: isSelected ? '#fff' : (o.orderType === "parcel" ? COLORS.rust : COLORS.ink), display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
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
                        <button onClick={(e) => { e.stopPropagation(); advanceStatus(o.id, status); }} style={{ flex: 1, padding: "14px 12px", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", background: status === "ready" ? COLORS.sage : (status === "preparing" ? COLORS.copper : COLORS.ink), color: "#fff" }}>
                          {status === "new" ? "👨‍🍳 Start Cooking" : status === "preparing" ? "✅ Mark Ready" : "🍽️ Mark Served"}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handlePrintReceipt(o); }} style={{ background: isSelected ? 'rgba(255,255,255,0.25)' : COLORS.paper2, color: isSelected ? '#fff' : COLORS.ink, border: 'none', width: 48, height: 48, borderRadius: 12, fontSize: 20, cursor: 'pointer' }}>🖨️</button>
                        <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Cancel order #${o.id.slice(1, 5)}?`)) { cancelOrderByStaff && cancelOrderByStaff(o.id); } }} style={{ background: 'transparent', color: isSelected ? '#fff' : COLORS.error, border: `1.5px solid ${isSelected ? 'rgba(255,255,255,0.5)' : COLORS.error}`, width: 48, height: 48, borderRadius: 12, fontSize: 18, cursor: 'pointer', fontWeight: 800 }}>✕</button>
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && (<div style={{ textAlign: "center", padding: "20px 0", color: COLORS.textLight, fontSize: 13, fontStyle: "italic" }}>No orders</div>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// 18. ADMIN VIEW
// ============================================

function KitchenMetrics({ filteredOrders }) {
  const servedOrders = filteredOrders.filter(o => o.status === "served");
  if (servedOrders.length === 0) return null;
  const hourCounts = {};
  filteredOrders.forEach(o => { const hr = new Date(o.createdAt).getHours(); hourCounts[hr] = (hourCounts[hr] || 0) + 1; });
  const peakHourEntry = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  const peakHourLabel = peakHourEntry ? `${peakHourEntry[0]}:00` : "—";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
      <StatCard label="Completed" value={servedOrders.length} icon="✅" color={COLORS.sage} />
      <StatCard label="Peak Hour" value={peakHourLabel} icon="🔥" color={COLORS.copper} />
      <StatCard label="Total" value={filteredOrders.length} icon="📋" color={COLORS.gold} />
    </div>
  );
}

function InventoryAlertBanner({ inventory }) {
  const critical = inventory.filter(i => i.stock < 2);
  const warning = inventory.filter(i => i.stock >= 2 && i.stock < 5);
  if (critical.length === 0 && warning.length === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      {critical.length > 0 && (<div style={{ background: 'rgba(239, 68, 68, 0.1)', border: `2px solid ${COLORS.error}`, padding: 16, borderRadius: 12, marginBottom: 12 }}><h4 style={{ color: COLORS.error, margin: '0 0 10px' }}>🚨 CRITICAL</h4>{critical.map(item => (<div key={item.id} style={{ color: COLORS.error, fontWeight: 700, fontSize: 14 }}>❌ {item.name}: {item.stock} {item.unit}</div>))}</div>)}
      {warning.length > 0 && (<div style={{ background: 'rgba(255, 152, 0, 0.1)', border: `2px solid ${COLORS.warning}`, padding: 16, borderRadius: 12 }}><h4 style={{ color: COLORS.warning, margin: '0 0 10px' }}>⚠️ LOW STOCK</h4>{warning.map(item => (<div key={item.id} style={{ color: COLORS.warning, fontWeight: 600, fontSize: 14 }}>⚠️ {item.name}: {item.stock} {item.unit}</div>))}</div>)}
    </div>
  );
}

function AdminView({ menu, setMenuState, bookings, orders, markPaid, requestPinPrompt, inventory, addInventory, updateStock, deleteBooking, offersList, addOffer, removeOffer, loyaltyRules, setLoyaltyRules, loyaltyUsers, settings, setSettings, gallery, setGallery, categories, updateCategories, flashSaleItems, setFlashSaleItems, comboOffers, setComboOffers, savePromotions }) {
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
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const filteredOrders = useMemo(() => orders.filter(o => toLocalISODate(o.createdAt) === filterDate), [orders, filterDate]);
  const revenue = filteredOrders.filter((o) => o.paid).reduce((s, o) => s + o.items.reduce((a, it) => a + it.price * it.qty, 0) + (o.deliveryFee || 0) - (o.loyaltyDiscount || 0), 0);
  const avgOrderValue = filteredOrders.length > 0 ? Math.round(filteredOrders.reduce((s, o) => s + o.items.reduce((a, it) => a + it.price * it.qty, 0) - (o.loyaltyDiscount || 0), 0) / filteredOrders.length) : 0;

  const handleAddCategory = () => { if (!newCategoryInput.trim()) return; updateCategories([...categories, newCategoryInput.trim()]); setNewCategoryInput(''); };
  const handleMoveCategory = (index, direction) => { const ni = index + direction; if (ni < 0 || ni >= categories.length) return; const u = [...categories]; const [r] = u.splice(index, 1); u.splice(ni, 0, r); updateCategories(u); };
  const handleDeleteCategory = (index) => { if (window.confirm("Delete this category?")) { updateCategories(categories.filter((_, i) => i !== index)); } };

  const generatePDFReport = async () => {
    setIsGeneratingPDF(true);
    try {
      const loadScript = (src) => new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s); });
      await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
      const html2canvas = window.html2canvas;
      const jsPDF = window.jspdf.jsPDF;
      const reportElement = document.getElementById('report-content');
      if (!reportElement) { alert('Report not found'); setIsGeneratingPDF(false); return; }
      const canvas = await html2canvas(reportElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Sales_Report_${filterDate}.pdf`);
    } catch (e) { alert('⚠️ Could not generate PDF.'); } finally { setIsGeneratingPDF(false); }
  };

  const handleAddOffer = () => { if (newOffer.title) { addOffer({ id: uid("off"), title: newOffer.title, desc: newOffer.desc }); setNewOffer({ title: "", desc: "" }); } };
  const handleAddReward = () => { if (newReward.cost && newReward.item) { setLoyaltyRules({ ...loyaltyRules, rewards: [...loyaltyRules.rewards, { id: uid("rwd"), cost: Number(newReward.cost), item: newReward.item }] }); setNewReward({ cost: "", item: "" }); } };

  const handleSaveMenuItem = async () => {
    if (!editingItem) return;
    const updatedMenu = menu.map(m => m.id === editingItem.id ? { ...m, name: newItemName, price: Number(newItemPrice), category: newItemCat, ...(newItemImage ? { image: newItemImage } : {}) } : m);
    setMenuState(updatedMenu);
    try { await setDoc(doc(db, "settings", "menu"), { items: updatedMenu }); } catch (e) { alert("⚠️ Failed to save"); }
    setEditingItem(null); setNewItemImage("");
  };
  const handleDeleteMenuItem = async (id) => { if (window.confirm("Delete this item?")) { const u = menu.filter(m => m.id !== id); setMenuState(u); try { await setDoc(doc(db, "settings", "menu"), { items: u }); } catch (e) { } } };
  const handleAddNewDish = async () => {
    if (!addMenuName.trim() || !addMenuPrice) { alert("Enter name and price"); return; }
    const newDish = mi(uid("m"), addMenuName.trim(), Number(addMenuPrice), addMenuCat, addMenuVeg, addMenuDesc.trim(), "", false, true, addMenuImage.trim());
    const u = [newDish, ...menu];
    setMenuState(u);
    try { await setDoc(doc(db, "settings", "menu"), { items: u }); } catch (e) { }
    setAddMenuName(""); setAddMenuPrice(""); setAddMenuDesc(""); setAddMenuImage("");
    alert("✅ Dish added!");
  };
  const handleAddGalleryPhoto = async () => { if (!newGalleryImg.trim()) return; const u = [...gallery, newGalleryImg.trim()]; setGallery(u); try { await setDoc(doc(db, "settings", "gallery"), { images: u }); } catch (e) { } setNewGalleryImg(""); };
  const handleDeleteGalleryPhoto = async (index) => { const u = gallery.filter((_, i) => i !== index); setGallery(u); try { await setDoc(doc(db, "settings", "gallery"), { images: u }); } catch (e) { } };
  const handleSaveHeroImage = async () => { if (!heroImgInput.trim()) return; const n = { ...settings, heroImage: heroImgInput.trim() }; setSettings(n); try { await setDoc(doc(db, "settings", "appSettings"), n); } catch (e) { } alert("✅ Saved!"); };
  const handleExportCSV = () => {
    const rows = [["Time", "Type", "Items", "Total", "Paid"]];
    filteredOrders.forEach(o => { const t = o.items.reduce((s, it) => s + it.price * it.qty, 0) + (o.deliveryFee || 0) - (o.loyaltyDiscount || 0); rows.push([new Date(o.createdAt).toLocaleTimeString('en-IN'), o.orderType === "parcel" ? "Parcel" : `Table ${o.table}`, o.items.map(it => `${it.qty}x ${it.name}`).join("; "), t, o.paid ? "Yes" : "No"]); });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    link.download = `orders_${filterDate}.csv`; link.click();
  };

  const inputStyle = { padding: "12px 16px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 16, width: "100%", boxSizing: "border-box" };
  const primaryBtn = { background: COLORS.copper, color: "#fff", border: "none", borderRadius: 14, padding: "13px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" };
  const th = { padding: "12px 14px", borderBottom: `2px solid ${COLORS.line}` };
  const td = { padding: "12px 14px", borderBottom: `1px solid ${COLORS.line}` };

  return (
    <div style={{ padding: "26px 20px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, alignItems: 'center' }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800 }}>📊 Admin Dashboard</div>
        <button onClick={() => requestPinPrompt("customer")} style={{ background: COLORS.paper2, border: "none", padding: "10px 20px", borderRadius: 12, cursor: "pointer", fontWeight: 700 }}>← Exit</button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 28, borderBottom: `2px solid ${COLORS.line}`, overflowX: "auto" }}>
        {["overview", "menu", "gallery", "settings", "offers", "loyalty", "inventory", "orders", "bookings", "promotions"].map((t) => (<button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", padding: "14px 20px", fontWeight: 800, fontSize: 15, textTransform: "capitalize", color: tab === t ? COLORS.copper : COLORS.textLight, borderBottom: tab === t ? `3px solid ${COLORS.copper}` : "3px solid transparent", cursor: "pointer", whiteSpace: "nowrap" }}>{t}</button>))}
      </div>

      {tab === "overview" && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>📅 Date:</span>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...inputStyle, width: 150 }} />
            <button onClick={handleExportCSV} style={{ background: COLORS.paper2, border: `1.5px solid ${COLORS.line}`, borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontWeight: 700 }}>📊 CSV</button>
            <button onClick={generatePDFReport} disabled={isGeneratingPDF} style={{ background: COLORS.copper, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", cursor: isGeneratingPDF ? 'not-allowed' : 'pointer', fontWeight: 700 }}>{isGeneratingPDF ? '⏳' : '📄 PDF'}</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 28 }}>
            <StatCard label={`Orders`} value={filteredOrders.length} icon="📋" color={COLORS.copper} />
            <StatCard label="Revenue" value={inr(revenue)} icon="💰" color={COLORS.sage} />
            <StatCard label="Avg Order" value={inr(avgOrderValue)} icon="📈" color={COLORS.gold} />
          </div>
          <KitchenMetrics filteredOrders={filteredOrders} />
          <div id="report-content" style={{ display: 'none' }}><div style={{ padding: 20 }}><h2>{RESTAURANT.name} - Report</h2><p>Date: {filterDate}</p><p>Orders: {filteredOrders.length}</p><p>Revenue: {inr(revenue)}</p></div></div>
        </>
      )}

            {tab === "settings" && (
        <div style={{ background: COLORS.paper, padding: 24, borderRadius: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>🖼️ Hero Image</h3>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <input type="url" placeholder="Image URL..." value={heroImgInput} onChange={e => setHeroImgInput(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
            <button onClick={handleSaveHeroImage} style={{ ...primaryBtn, flex: 1 }}>Save</button>
          </div>
          {heroImgInput && (<img src={heroImgInput} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 12 }} onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80"; }} />)}

          {/* ═══════════════════════════════════════════════
              🔐 SECURITY PINs — Manage All
             ═══════════════════════════════════════════════ */}
          <div style={{ borderTop: `1px solid ${COLORS.line}`, marginTop: 28, paddingTop: 24 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>🔐 Security PINs</h3>
            <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 18 }}>
              Manage PINs for Waiter, Staff, and Admin access. Changes apply instantly.
            </div>

            {/* Waiter PIN */}
            <div style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>🧑‍🍳</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>Waiter PIN</div>
                    <div style={{ fontSize: 11, color: COLORS.textLight }}>Unlocks Waiter Mode on customer screen</div>
                  </div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", background: COLORS.info, color: '#fff', padding: '4px 10px', borderRadius: 8, fontWeight: 800, fontSize: 13 }}>
                  {settings?.waiterPin || "1234"}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" inputMode="numeric" maxLength={6} value={settings?.waiterPin || "1234"}
                  onChange={e => setSettings({ ...settings, waiterPin: e.target.value.replace(/\D/g, '') })}
                  placeholder="4-6 digits"
                  style={{ ...inputStyle, flex: 1, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 18, letterSpacing: 4, fontWeight: 800 }} />
                <button onClick={async () => {
                  const pin = (settings?.waiterPin || "1234").toString();
                  if (pin.length < 4) { alert("⚠️ PIN must be at least 4 digits"); return; }
                  try { await setDoc(doc(db, "settings", "appSettings"), settings); alert("✅ Waiter PIN updated to: " + pin); }
                  catch (e) { alert("⚠️ Failed to save"); }
                }} style={{ ...primaryBtn, whiteSpace: 'nowrap' }}>💾 Save</button>
              </div>
            </div>

            {/* Staff PIN */}
            <div style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>🍳</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>Staff PIN</div>
                    <div style={{ fontSize: 11, color: COLORS.textLight }}>Unlocks Kitchen Board</div>
                  </div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", background: COLORS.copper, color: '#fff', padding: '4px 10px', borderRadius: 8, fontWeight: 800, fontSize: 13 }}>
                  {settings?.staffPin || "5432"}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" inputMode="numeric" maxLength={6} value={settings?.staffPin || "5432"}
                  onChange={e => setSettings({ ...settings, staffPin: e.target.value.replace(/\D/g, '') })}
                  placeholder="4-6 digits"
                  style={{ ...inputStyle, flex: 1, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 18, letterSpacing: 4, fontWeight: 800 }} />
                <button onClick={async () => {
                  const pin = (settings?.staffPin || "5432").toString();
                  if (pin.length < 4) { alert("⚠️ PIN must be at least 4 digits"); return; }
                  try { await setDoc(doc(db, "settings", "appSettings"), settings); alert("✅ Staff PIN updated to: " + pin); }
                  catch (e) { alert("⚠️ Failed to save"); }
                }} style={{ ...primaryBtn, whiteSpace: 'nowrap' }}>💾 Save</button>
              </div>
            </div>

            {/* Admin PIN */}
            <div style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>⚙️</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>Admin PIN</div>
                    <div style={{ fontSize: 11, color: COLORS.textLight }}>Unlocks Admin Dashboard (highest access)</div>
                  </div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", background: COLORS.ink, color: '#fff', padding: '4px 10px', borderRadius: 8, fontWeight: 800, fontSize: 13 }}>
                  {settings?.adminPin || "9876"}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" inputMode="numeric" maxLength={6} value={settings?.adminPin || "9876"}
                  onChange={e => setSettings({ ...settings, adminPin: e.target.value.replace(/\D/g, '') })}
                  placeholder="4-6 digits"
                  style={{ ...inputStyle, flex: 1, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 18, letterSpacing: 4, fontWeight: 800 }} />
                <button onClick={async () => {
                  const pin = (settings?.adminPin || "9876").toString();
                  if (pin.length < 4) { alert("⚠️ PIN must be at least 4 digits"); return; }
                  try { await setDoc(doc(db, "settings", "appSettings"), settings); alert("✅ Admin PIN updated to: " + pin); }
                  catch (e) { alert("⚠️ Failed to save"); }
                }} style={{ ...primaryBtn, whiteSpace: 'nowrap' }}>💾 Save</button>
              </div>
            </div>

            {/* 🔄 Reset All PINs */}
            <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: `1.5px dashed ${COLORS.error}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 26 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.error }}>Reset All PINs</div>
                  <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2, lineHeight: 1.5 }}>
                    Restores all PINs to factory defaults. Use if you forgot any PIN.
                  </div>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: COLORS.textLight, fontWeight: 600 }}>🧑‍🍳 Waiter</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800 }}>1234</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: COLORS.textLight, fontWeight: 600 }}>🍳 Staff</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800 }}>5432</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: COLORS.textLight, fontWeight: 600 }}>⚙️ Admin</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800 }}>9876</span>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!window.confirm("⚠️ Reset ALL PINs to defaults?\n\nWaiter: 1234\nStaff: 5432\nAdmin: 9876\n\nThis will overwrite your current PINs.")) return;
                  const resetSettings = { ...settings, waiterPin: "1234", staffPin: "5432", adminPin: "9876" };
                  setSettings(resetSettings);
                  try {
                    await setDoc(doc(db, "settings", "appSettings"), resetSettings);
                    alert("✅ All PINs reset to defaults!\n\nWaiter: 1234\nStaff: 5432\nAdmin: 9876");
                  } catch (e) {
                    alert("⚠️ Failed to reset. Check your internet.");
                  }
                }}
                style={{
                  width: '100%', padding: 14, border: 'none', borderRadius: 12,
                  background: COLORS.error, color: '#fff', fontWeight: 800,
                  fontSize: 14, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                🔄 Reset All PINs to Default
              </button>
            </div>
          </div>
          {/* ═══════════════════════════════════════════════ */}
        </div>
      )}

      {tab === "gallery" && (
        <>
          <div style={{ background: COLORS.paper, padding: 24, borderRadius: 16, marginBottom: 30 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>📸 Add Photo</h3>
            <div style={{ display: "flex", gap: 12 }}>
              <input type="url" placeholder="Image URL..." value={newGalleryImg} onChange={e => setNewGalleryImg(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
              <button onClick={handleAddGalleryPhoto} style={{ ...primaryBtn, flex: 1 }}>+ Add</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {gallery.map((imgUrl, idx) => (
              <div key={idx} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 10 }}>
                <img src={imgUrl} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; }} />
                <button onClick={() => handleDeleteGalleryPhoto(idx)} style={{ width: "100%", background: 'transparent', border: `1px solid ${COLORS.rust}`, color: COLORS.rust, padding: '6px 0', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "menu" && (
        <>
          <div style={{ background: COLORS.paper, padding: 24, borderRadius: 16, marginBottom: 30 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>📂 Categories</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <input type="text" placeholder="New category name" value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} style={inputStyle} />
              <button onClick={handleAddCategory} style={{ ...primaryBtn, whiteSpace: 'nowrap' }}>+ Add</button>
            </div>
            {categories.map((cat, index) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', background: '#fff', padding: '10px 16px', borderRadius: 10, marginBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>{index + 1}. {cat}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleMoveCategory(index, -1)} disabled={index === 0} style={{ padding: '4px 10px', opacity: index === 0 ? 0.4 : 1 }}>⬆️</button>
                  <button onClick={() => handleMoveCategory(index, 1)} disabled={index === categories.length - 1} style={{ padding: '4px 10px', opacity: index === categories.length - 1 ? 0.4 : 1 }}>⬇️</button>
                  <button onClick={() => handleDeleteCategory(index)} style={{ padding: '4px 10px', color: COLORS.error, background: 'transparent', border: `1.5px solid ${COLORS.error}`, borderRadius: 6, fontWeight: 700 }}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: COLORS.paper, padding: 24, borderRadius: 16, marginBottom: 30 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>➕ Add Dish</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
              <input type="text" placeholder="Dish Name *" value={addMenuName} onChange={e => setAddMenuName(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="Price *" value={addMenuPrice} onChange={e => setAddMenuPrice(e.target.value)} style={inputStyle} />
              <select value={addMenuCat} onChange={e => setAddMenuCat(e.target.value)} style={inputStyle}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
              <select value={addMenuVeg} onChange={e => setAddMenuVeg(e.target.value === 'true')} style={inputStyle}><option value="true">🟢 Veg</option><option value="false">🔴 Non-Veg</option></select>
            </div>
            <input type="url" placeholder="Image URL (optional)" value={addMenuImage} onChange={e => setAddMenuImage(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
            <textarea placeholder="Description" value={addMenuDesc} onChange={e => setAddMenuDesc(e.target.value)} style={{ ...inputStyle, marginBottom: 16, resize: 'none' }} rows={2} />
            <button onClick={handleAddNewDish} style={primaryBtn}>+ Add Dish</button>
          </div>

          <h3 style={{ marginBottom: 16 }}>Existing Menu</h3>
          {menu.map(item => (
            <div key={item.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, padding: 16, borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <img src={item.image} alt="" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 10 }} onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; }} />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 16 }}>{item.name} <span style={{ fontSize: 12, color: COLORS.textLight }}>({item.category})</span></div><div style={{ color: COLORS.copper, fontWeight: 800 }}>{inr(item.price)}</div></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setEditingItem(item); setNewItemName(item.name); setNewItemPrice(item.price); setNewItemCat(item.category); setNewItemImage(item.image); }} style={{ background: COLORS.paper2, border: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => handleDeleteMenuItem(item.id)} style={{ background: 'transparent', border: `1px solid ${COLORS.rust}`, color: COLORS.rust, padding: '8px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}

          {editingItem && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99 }}>
              <div style={{ background: '#fff', padding: 24, borderRadius: 20, width: '90%', maxWidth: 400 }}>
                <h3 style={{ marginTop: 0 }}>Edit Item</h3>
                <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
                <input type="number" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
                <select value={newItemCat} onChange={e => setNewItemCat(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <input type="url" value={newItemImage} onChange={e => setNewItemImage(e.target.value)} placeholder="Image URL" style={{ ...inputStyle, marginBottom: 20 }} />
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => setEditingItem(null)} style={{ flex: 1, padding: 12, border: `1px solid ${COLORS.line}`, background: 'transparent', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleSaveMenuItem} style={{ flex: 1, padding: 12, background: COLORS.copper, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>Save</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "loyalty" && (
        <>
          <div style={{ background: 'linear-gradient(135deg, #fdfbfb, #ebedee)', padding: 24, borderRadius: 16, marginBottom: 24, border: `1.5px solid ${COLORS.gold}` }}>
            <div style={{ fontSize: 20, marginBottom: 16, fontWeight: 800 }}>🪙 EatCoin Settings</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{ fontWeight: 700 }}>₹ Spend = 1 Coin :</span>
              <input type="number" value={loyaltyRules.rate} onChange={(e) => setLoyaltyRules({ ...loyaltyRules, rate: Number(e.target.value) })} style={{ ...inputStyle, width: 120 }} />
            </div>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Add Reward</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <input type="number" placeholder="Cost" value={newReward.cost} onChange={e => setNewReward({ ...newReward, cost: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              <input type="text" placeholder="Free item" value={newReward.item} onChange={e => setNewReward({ ...newReward, item: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
              <button onClick={handleAddReward} style={{ ...primaryBtn, background: COLORS.gold, color: COLORS.ink }}>+ Add</button>
            </div>
          </div>
          {loyaltyRules.rewards.map(r => (
            <div key={r.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, padding: 20, borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div><div style={{ fontWeight: 800, fontSize: 18 }}>{r.item}</div><div style={{ color: COLORS.gold, fontWeight: 800 }}>{r.cost} Coins</div></div>
              <button onClick={() => setLoyaltyRules({ ...loyaltyRules, rewards: loyaltyRules.rewards.filter(rw => rw.id !== r.id) })} style={{ background: 'transparent', border: `1.5px solid ${COLORS.rust}`, color: COLORS.rust, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 800 }}>Remove</button>
            </div>
          ))}
          <h3 style={{ marginTop: 40 }}>Top Customers</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, overflow: 'hidden' }}>
            <thead><tr style={{ background: COLORS.paper }}><th style={th}>Name</th><th style={th}>Phone</th><th style={th}>Coins</th><th style={th}>Tier</th></tr></thead>
            <tbody>{loyaltyUsers.sort((a, b) => b.coins - a.coins).map((u, i) => (<tr key={i}><td style={td}>{u.name}</td><td style={td}>{u.phone}</td><td style={{ ...td, fontWeight: 800, color: COLORS.sageDark }}>{u.coins}</td><td style={td}>{getLoyaltyTier(u.coins).name}</td></tr>))}</tbody>
          </table>
        </>
      )}

      {tab === "offers" && (
        <>
          <div style={{ background: COLORS.paper, padding: 24, borderRadius: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 20, marginBottom: 16, fontWeight: 700 }}>Create Offer</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <input type="text" placeholder="Title" value={newOffer.title} onChange={e => setNewOffer({ ...newOffer, title: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              <input type="text" placeholder="Description" value={newOffer.desc} onChange={e => setNewOffer({ ...newOffer, desc: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
              <button onClick={handleAddOffer} style={primaryBtn}>+ Add</button>
            </div>
          </div>
          {offersList.map((off) => (
            <div key={off.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, padding: 20, borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div><div style={{ fontWeight: 800, fontSize: 18 }}>{off.title}</div><div style={{ color: COLORS.textLight, fontWeight: 600 }}>{off.desc}</div></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { const nt = prompt("Title:", off.title); if (nt !== null) { const nd = prompt("Desc:", off.desc); if (nd !== null) { removeOffer(off.id); addOffer({ ...off, title: nt.trim(), desc: nd.trim() }); } } }} style={{ background: COLORS.copperLight, border: `1.5px solid ${COLORS.copper}`, color: COLORS.copperDark, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                <button onClick={() => removeOffer(off.id)} style={{ background: 'transparent', border: `1.5px solid ${COLORS.rust}`, color: COLORS.rust, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 800 }}>Delete</button>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "inventory" && (
        <>
          <InventoryAlertBanner inventory={inventory} />
          <div style={{ background: COLORS.paper, padding: 24, borderRadius: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 20, marginBottom: 16, fontWeight: 700 }}>Add Material</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <input type="text" placeholder="Name" value={newInv.name} onChange={e => setNewInv({ ...newInv, name: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
              <input type="number" placeholder="Qty" value={newInv.stock} onChange={e => setNewInv({ ...newInv, stock: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              <select value={newInv.unit} onChange={e => setNewInv({ ...newInv, unit: e.target.value })} style={{ ...inputStyle, flex: 1 }}><option value="kg">KG</option><option value="liters">L</option><option value="pcs">Pcs</option></select>
              <button onClick={() => { if (newInv.name && newInv.stock) { addInventory({ ...newInv, id: uid('inv'), stock: Number(newInv.stock) }); setNewInv({ name: "", stock: "", unit: "kg" }) } }} style={primaryBtn}>Add</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {inventory.map(inv => (
              <div key={inv.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, padding: 20, borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div style={{ fontWeight: 800, fontSize: 17 }}>{inv.name}</div><div style={{ color: inv.stock < 2 ? COLORS.error : COLORS.textLight, fontWeight: 700 }}>{Number(inv.stock).toFixed(2)} {inv.unit}</div></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => updateStock(inv.id, Math.max(0, inv.stock - 1))} style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${COLORS.line}`, background: COLORS.paper, cursor: 'pointer', fontWeight: 800, fontSize: 18 }}>-</button>
                  <button onClick={() => updateStock(inv.id, inv.stock + 1)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: COLORS.sageLight, color: COLORS.sageDark, cursor: 'pointer', fontWeight: 800, fontSize: 18 }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "orders" && (
        <div style={{ overflowX: "auto", borderRadius: 16, border: `1px solid ${COLORS.line}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, background: "#fff" }}>
            <thead><tr style={{ textAlign: "left", background: COLORS.paper }}><th style={th}>Time</th><th style={th}>Table</th><th style={th}>Items</th><th style={th}>Total</th><th style={th}>Payment</th><th style={th}>Action</th></tr></thead>
            <tbody>
              {[...filteredOrders].sort((a, b) => b.createdAt - a.createdAt).map((o) => (
                <tr key={o.id} style={{ opacity: o.status === "cancelled" ? 0.5 : 1 }}>
                  <td style={{ ...td, color: COLORS.textLight, fontWeight: 600 }}>{new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={td}>{o.orderType === "parcel" ? <Badge color={COLORS.copper}>Parcel</Badge> : <strong>T-{o.table}</strong>}{o.status === "cancelled" && <span style={{ color: COLORS.error, fontSize: 11, fontWeight: 700, display: 'block' }}>❌ Cancelled</span>}</td>
                  <td style={td}>{o.items.map((it) => `${it.qty}×${it.name}`).join(", ")}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{inr(o.items.reduce((s, it) => s + it.price * it.qty, 0) + (o.deliveryFee || 0) - (o.loyaltyDiscount || 0))}</td>
                  <td style={td}>{o.payment || "cash"}<span style={{ fontSize: 11, color: o.paid ? COLORS.sage : COLORS.textLight, display: 'block' }}>{o.paid ? "✅" : "⏳"}</span></td>
                  <td style={td}><button onClick={() => markPaid(o.id, !o.paid)} style={{ border: `1.5px solid ${o.paid ? COLORS.sage : COLORS.line}`, background: o.paid ? COLORS.sage : "transparent", color: o.paid ? "#fff" : COLORS.ink, borderRadius: 10, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>{o.paid ? "✓ Paid" : "Mark paid"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "bookings" && (
        <div style={{ overflowX: "auto", borderRadius: 16, border: `1px solid ${COLORS.line}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, background: "#fff" }}>
            <thead><tr style={{ background: COLORS.paper }}><th style={th}>Type</th><th style={th}>Details</th><th style={th}>Date</th><th style={th}>Action</th></tr></thead>
            <tbody>
              {bookings.map(b => (<tr key={b.id}><td style={td}>{b.type === "party" ? "🎉 Party" : "🍽️ Table"}</td><td style={td}><strong>{b.name}</strong><br />{b.phone}<br />{b.guests} Guests</td><td style={td}>{b.date} at {b.time}</td><td style={td}><button onClick={() => deleteBooking(b.id)} style={{ background: 'transparent', border: `1.5px solid ${COLORS.rust}`, color: COLORS.rust, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Delete</button></td></tr>))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "promotions" && (
        <>
          <h3 style={{ marginBottom: 16 }}>⚡ Flash Sale</h3>
          {flashSaleItems.map((item, idx) => (
            <div key={item.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, padding: 16, borderRadius: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={item.name} onChange={e => { const u = [...flashSaleItems]; u[idx].name = e.target.value; setFlashSaleItems(u); }} style={{ ...inputStyle, flex: 2 }} />
                <input type="number" value={item.discountPrice} onChange={e => { const u = [...flashSaleItems]; u[idx].discountPrice = Number(e.target.value); setFlashSaleItems(u); }} style={{ ...inputStyle, width: 100 }} />
                <input type="number" value={item.stock} onChange={e => { const u = [...flashSaleItems]; u[idx].stock = Number(e.target.value); setFlashSaleItems(u); }} style={{ ...inputStyle, width: 80 }} />
                <button onClick={() => { const u = [...flashSaleItems]; u[idx].active = !u[idx].active; setFlashSaleItems(u); }} style={{ background: item.active ? COLORS.sage : COLORS.error, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>{item.active ? '✅ Active' : '❌ Inactive'}</button>
                <button onClick={() => { if (window.confirm('Delete?')) setFlashSaleItems(flashSaleItems.filter((_, i) => i !== idx)); }} style={{ background: 'transparent', border: `1px solid ${COLORS.rust}`, color: COLORS.rust, padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
          <button onClick={() => setFlashSaleItems([...flashSaleItems, { id: 'flash' + Date.now(), name: 'New', price: 0, discountPrice: 0, stock: 0, active: true }])} style={{ ...primaryBtn, background: COLORS.sage, marginBottom: 30 }}>+ Add Flash Item</button>

          <h3 style={{ marginBottom: 16 }}>🎯 Combo Offers</h3>
          {comboOffers.map((combo, idx) => (
            <div key={combo.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, padding: 16, borderRadius: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={combo.name} onChange={e => { const u = [...comboOffers]; u[idx].name = e.target.value; setComboOffers(u); }} style={{ ...inputStyle, flex: 2 }} />
                <input type="number" value={combo.discount} onChange={e => { const u = [...comboOffers]; u[idx].discount = Number(e.target.value); u[idx].finalPrice = Math.round(u[idx].totalPrice * (1 - u[idx].discount / 100)); setComboOffers(u); }} style={{ ...inputStyle, width: 100 }} />
                <input value={combo.image} onChange={e => { const u = [...comboOffers]; u[idx].image = e.target.value; setComboOffers(u); }} style={{ ...inputStyle, width: 80 }} />
                <button onClick={() => { const u = [...comboOffers]; u[idx].active = !u[idx].active; setComboOffers(u); }} style={{ background: combo.active ? COLORS.sage : COLORS.error, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>{combo.active ? '✅' : '❌'}</button>
                <button onClick={() => { if (window.confirm('Delete?')) setComboOffers(comboOffers.filter((_, i) => i !== idx)); }} style={{ background: 'transparent', border: `1px solid ${COLORS.rust}`, color: COLORS.rust, padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
          <button onClick={() => setComboOffers([...comboOffers, { id: 'combo' + Date.now(), name: 'New Combo', items: [{ id: 'f2', name: 'Pizza', price: 280, quantity: 1 }], totalPrice: 280, discount: 10, finalPrice: 252, image: '🍽️', active: true }])} style={{ ...primaryBtn, background: COLORS.gold, marginBottom: 20 }}>+ Add Combo</button>
          <button onClick={savePromotions} style={{ ...primaryBtn, width: '100%' }}>💾 Save All</button>
        </>
      )}
    </div>
  );
}

// ============================================
// 19. DEFAULT DATA
// ============================================

const DEFAULT_MENU = [
  mi("d1", "Mint Mojito", 90, "Drinks", true, "Refreshing mint, lemon, soda.", "", true),
  mi("d2", "Blue Lagoon", 90, "Drinks", true, "Tropical blue curacao cooler."),
  mi("d3", "Vanilla Shake", 120, "Drinks", true, "Creamy vanilla milkshake."),
  mi("d4", "Chocolate Shake", 130, "Drinks", true, "Rich cocoa milkshake."),
  mi("d5", "Kitkat Oreo Shake", 150, "Drinks", true, "KitKat + Oreo shake."),
  mi("d9", "Cold Coffee", 120, "Drinks", true, "Chilled frothy coffee.", "", true),
  mi("d10", "Cold Drink", 50, "Drinks", true, "Chilled beverage."),
  mi("f1", "Veg Burger", 90, "Fun Food", true, "Crispy veggie patty."),
  mi("f2", "Eat & Park Special Pizza", 280, "Fun Food", true, "Loaded with veggies.", "", true),
  mi("f3", "Veg Roll", 90, "Fun Food", true, "Spiced veggies wrapped."),
  mi("f4", "Paneer Roll", 100, "Fun Food", true, "Tandoori paneer roll."),
  mi("f8", "Eat & Park Egg Roll", 100, "Fun Food", false, "Double egg roll."),
  mi("f9", "Eat & Park Chicken Roll", 150, "Fun Food", false, "Chicken tikka roll."),
  mi("f11", "White Sauce Pasta", 180, "Fun Food", true, "Creamy garlic pasta."),
  mi("f14", "Veg Sandwich", 120, "Fun Food", true, "Grilled veggies sandwich."),
  mi("f15", "Chicken Sandwich", 150, "Fun Food", false, "Creamy chicken sandwich."),
  mi("cs1", "Paneer Chilli", 240, "Chinese Starter", true, "Crispy paneer in soy sauce.", "Dry/Gravy", true),
  mi("cs2", "Mushroom Chilli", 250, "Chinese Starter", true, "Mushrooms in chili glaze.", "Dry/Gravy"),
  mi("cs3", "Veg Manchurian", 180, "Chinese Starter", true, "Veg dumplings in soy gravy.", "Dry/Gravy"),
  mi("cs8", "Chicken Chilli", 240, "Chinese Starter", false, "Diced chicken in hot sauce.", "Dry/Gravy", true),
  mi("cs9", "Chicken Manchurian", 260, "Chinese Starter", false, "Minced chicken in sauce.", "Dry/Gravy"),
  mi("cs10", "Chicken Lollipop", 300, "Chinese Starter", false, "Crispy chicken wings.", "Dry/Gravy"),
  mi("mg1", "Tandoori Chicken", 450, "Mughlai", false, "Classic yogurt marinated chicken."),
  mi("mg3", "Chicken Tikka", 350, "Mughlai", false, "Boneless spicy grilled chicken."),
  mi("t1", "Paneer Tikka", 299, "Tandoori", true, "Grilled marinated paneer.", "", true),
  mi("t2", "Mushroom Tikka", 285, "Tandoori", true, "Smoky grilled mushrooms."),
  mi("s1", "Tomato Soup", 120, "Soup", true, "Creamy tomato soup."),
  mi("s3", "Veg Manchow Soup", 120, "Soup", true, "Spicy soup with noodles."),
  mi("s6", "Chicken Manchow Soup", 150, "Soup", false, "Rich chicken broth."),
  mi("b1", "Tandoori Roti", 15, "Indian Bread", true, "Whole wheat clay oven roti."),
  mi("b2", "Tandoori Butter Roti", 20, "Indian Bread", true, "Butter-glazed roti."),
  mi("b6", "Plain Naan", 50, "Indian Bread", true, "Soft flour bread."),
  mi("b7", "Butter Naan", 60, "Indian Bread", true, "Buttery naan."),
  mi("b8", "Garlic Naan", 70, "Indian Bread", true, "Garlic + coriander naan.", "", true),
  mi("sn3", "French Fries", 100, "Snacks", true, "Crispy potato fries."),
  mi("sn5", "Crispy Chilli Potato", 160, "Snacks", true, "Sweet spicy fried potato."),
  mi("sn9", "Chicken Pakoda", 200, "Snacks", false, "Batter-fried chicken."),
  mi("cm1", "Veg Chowmein", 130, "Chinese Mains", true, "Wok-tossed noodles."),
  mi("cm2", "Veg Hakka Noodles", 160, "Chinese Mains", true, "Classic noodles with veggies."),
  mi("cm8", "Chicken Noodles", 180, "Chinese Mains", false, "Noodles with chicken."),
  mi("cm12", "Veg Fried Rice", 170, "Chinese Mains", true, "Veg fried rice."),
  mi("cm15", "Chicken Fried Rice", 200, "Chinese Mains", false, "Chicken + egg rice."),
  mi("p2", "Jeera Rice", 110, "Pulao", true, "Cumin-tempered rice."),
  mi("p3", "Veg Pulao", 180, "Pulao", true, "Fragrant veg pulao."),
  mi("pn1", "Paneer Masala", 250, "Paneer & Mushroom", true, "Paneer in spiced gravy."),
  mi("pn4", "Paneer Karahi", 260, "Paneer & Mushroom", true, "Paneer + peppers in kadhai."),
  mi("pn6", "Paneer Butter Masala", 260, "Paneer & Mushroom", true, "Creamy makhani paneer."),
  mi("pn16", "Mushroom Masala", 250, "Paneer & Mushroom", true, "Spicy mushroom masala."),
  mi("pn17", "Mushroom Karahi", 260, "Paneer & Mushroom", true, "Mushrooms in kadhai spices."),
  mi("nv1", "Chicken Dehati", 550, "Chicken, Mutton, Fish & Egg", false, "Rustic chicken curry."),
  mi("nv2", "Chicken Curry", 280, "Chicken, Mutton, Fish & Egg", false, "Classic chicken curry."),
  mi("nv6", "Chicken Do Pyaza", 280, "Chicken, Mutton, Fish & Egg", false, "Chicken with onions."),
  mi("nv8", "Chicken Butter Masala", 350, "Chicken, Mutton, Fish & Egg", false, "Butter chicken.", "", true),
  mi("nv10", "Mutton Curry", 340, "Chicken, Mutton, Fish & Egg", false, "Slow-cooked mutton."),
  mi("nv12", "Mutton Handi", 650, "Chicken, Mutton, Fish & Egg", false, "Earthen pot mutton.", "500g", true),
  mi("nv13", "Mutton Handi", 1200, "Chicken, Mutton, Fish & Egg", false, "Earthen pot mutton.", "1 Kg"),
  mi("nv15", "Mutton Dehati", 440, "Chicken, Mutton, Fish & Egg", false, "Village style mutton."),
  mi("nv16", "Mutton Ahuna", 1250, "Chicken, Mutton, Fish & Egg", false, "Champaran special mutton."),
  mi("nv19", "Fish Curry", 120, "Chicken, Mutton, Fish & Egg", false, "Mustard fish curry.", "Small"),
  mi("nv20", "Fish Curry", 220, "Chicken, Mutton, Fish & Egg", false, "Mustard fish curry.", "Large"),
  mi("nv25", "Egg Curry", 200, "Chicken, Mutton, Fish & Egg", false, "Boiled eggs in gravy.", "4 pc"),
  mi("br1", "Veg Biryani", 180, "Biryani & Thali", true, "Aromatic veg biryani."),
  mi("br5", "Chicken Biryani", 210, "Biryani & Thali", false, "Classic chicken biryani.", "", true),
  mi("br12", "Mutton Biryani", 280, "Biryani & Thali", false, "Royal mutton biryani."),
  mi("br15", "Veg Thali", 250, "Biryani & Thali", true, "Complete veg platter.", "2 Roti, Rice, Manchurian, Paneer, Salad"),
  mi("br16", "Non Veg Thali", 280, "Biryani & Thali", false, "Hearty non-veg platter.", "2 Roti, Rice, Chicken, Salad"),
  mi("al10", "Dal Fry", 70, "Aloo, Dal & Sides", true, "Cumin-tempered dal."),
  mi("al11", "Dal Tadka", 100, "Aloo, Dal & Sides", true, "Dhaba-style dal."),
  mi("al14", "Veg Raita", 60, "Aloo, Dal & Sides", true, "Cooling yogurt."),
  mi("al15", "Green Salad", 80, "Aloo, Dal & Sides", true, "Fresh salad."),
  mi("mo1", "Veg Momo", 80, "Momo", true, "Steamed veg momo.", "Steam"),
  mi("mo2", "Veg Momo", 100, "Momo", true, "Fried veg momo.", "Fry"),
  mi("mo11", "Chicken Momo", 150, "Momo", false, "Steamed chicken momo.", "Steam"),
  mi("mo12", "Chicken Momo", 160, "Momo", false, "Fried chicken momo.", "Fry")
];

const DEFAULT_OFFERS = [
  { id: "off1", title: "Flat 20% OFF 🍜", desc: "Enjoy 20% off on all Chinese today!" },
  { id: "off2", title: "Free Cold Drink 🥤", desc: "Free cold drink on orders above ₹499." }
];

const DEFAULT_GALLERY = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80"
];

// ============================================
// 20. ProgressRing & OrderTimer
// ============================================

const ProgressRing = memo(({ progress, size = 60, strokeWidth = 3 }) => {
  const circumference = 2 * Math.PI * ((size - strokeWidth) / 2);
  const offset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={(size - strokeWidth) / 2} fill="none" stroke={COLORS.line} strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={(size - strokeWidth) / 2} fill="none" stroke={COLORS.sage} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.3em" fontSize="16" fontWeight="700" fill={COLORS.sage}>{progress}%</text>
    </svg>
  );
});

const OrderTimer = memo(({ createdAt, estimatedTime }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const t = setInterval(() => setElapsed(Math.floor((Date.now() - createdAt) / 1000)), 1000); return () => clearInterval(t); }, [createdAt]);
  const minutes = Math.floor(elapsed / 60); const seconds = elapsed % 60; const isOvertime = elapsed > (estimatedTime * 60);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: isOvertime ? 'rgba(239, 68, 68, 0.1)' : COLORS.sageLight, borderRadius: 10, borderLeft: `3px solid ${isOvertime ? COLORS.error : COLORS.sage}` }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: isOvertime ? COLORS.error : COLORS.sageDark }}>⏱️ {minutes}:{seconds.toString().padStart(2, '0')}</span>
      <span style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600 }}>/ {estimatedTime}m</span>
    </div>
  );
});

// ============================================
// 21. MAIN APP
// ============================================

export default function App() {
  const [role, setRole] = useState("customer");
  const [isDark, setIsDark] = useState(false);
  const [calls, setCalls] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [offersList, setOffersList] = useState(DEFAULT_OFFERS);
  const [gallery, setGallery] = useState(DEFAULT_GALLERY);
  const [loyaltyRules, setLoyaltyRules] = useState({ rate: 10, rewards: [{ id: "r1", cost: 300, item: "Free French Fry" }] });
  const [loyaltyUsers, setLoyaltyUsers] = useState([]);
  const [coinHistory, setCoinHistory] = useState([]);
  const [table, setTable] = useState(() => { const params = new URLSearchParams(window.location.search); return params.has("table") ? Number(params.get("table")) : 1; });
  const [menu, setMenuState] = useState(DEFAULT_MENU);
  const [orders, setOrdersState] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState({ heroImage: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80", adminPin: "9876", staffPin: "5432", waiterPin: "1234" });
  const [loading, setLoading] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);
  const [targetRole, setTargetRole] = useState("staff");
  const [pinInput, setPinInput] = useState("");
  const [categories, setCategories] = useState(CATEGORIES);
  const [flashSaleItems, setFlashSaleItems] = useState([
    { id: 'nv19', name: 'Fish Curry', price: 449, discountPrice: 299, stock: 10, active: true }
  ]);
  const [comboOffers, setComboOffers] = useState([
    { id: 'combo1', name: 'Family Combo', items: [{ id: 'f2', name: 'Special Pizza', price: 280, quantity: 1 }, { id: 'br5', name: 'Chicken Biryani', price: 210, quantity: 1 }, { id: 'pn1', name: 'Paneer Masala', price: 250, quantity: 1 }], totalPrice: 740, discount: 20, finalPrice: 592, image: '🍕', active: true },
    { id: 'combo2', name: 'Weekend Special', items: [{ id: 'nv8', name: 'Butter Chicken', price: 350, quantity: 1 }, { id: 'b8', name: 'Garlic Naan', price: 70, quantity: 2 }, { id: 'd10', name: 'Cold Drink', price: 50, quantity: 2 }], totalPrice: 590, discount: 25, finalPrice: 442, image: '🍗', active: true }
  ]);

  const requestPinPrompt = (target) => { setTargetRole(target); setShowPinModal(true); setPinInput(""); };

  const handlePinSubmit = () => {
    const aPin = settings?.adminPin || "9876";
    const sPin = settings?.staffPin || "5432";
    if (targetRole === "admin" && pinInput === aPin) { setRole("admin"); setShowPinModal(false); setPinInput(""); }
    else if (targetRole === "staff" && (pinInput === sPin || pinInput === aPin)) { setRole("staff"); setShowPinModal(false); setPinInput(""); }
    else if (targetRole === "customer") { setRole("customer"); setShowPinModal(false); setPinInput(""); }
    else { alert("❌ Incorrect PIN!"); setPinInput(""); }
  };

  const updateCategories = async (newCategories) => {
    setCategories(newCategories);
    try { await setDoc(doc(db, "settings", "categories"), { categories: newCategories }); } catch (e) { console.error(e); }
  };

  const savePromotions = async () => {
    try { await setDoc(doc(db, "settings", "promotions"), { flashSale: flashSaleItems, comboOffers }); alert("✅ Saved!"); } catch (e) { alert("❌ Failed: " + e.message); }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const lq = await getDocs(collection(db, "loyaltyUsers"));
        const users = lq.docs.map(d => d.data());
        if (users.length > 0) setLoyaltyUsers(users);
        const hq = await getDocs(collection(db, "coinHistory"));
        const hist = hq.docs.map(d => d.data());
        if (hist.length > 0) setCoinHistory(hist);
        const ms = await getDocs(collection(db, "settings"));
        ms.forEach(ds => {
          const data = ds.data();
          if (ds.id === "menu" && data.items) setMenuState(data.items);
          if (ds.id === "gallery" && data.images) setGallery(data.images);
          if (ds.id === "appSettings") setSettings(prev => ({ ...prev, ...data }));
          if (ds.id === "categories" && data.categories) setCategories(data.categories);
          if (ds.id === "promotions") {
            if (data.flashSale) setFlashSaleItems(data.flashSale);
            if (data.comboOffers) setComboOffers(data.comboOffers);
          }
        });
      } catch (e) { console.error("Fetch error:", e); } finally { setLoading(false); }
    };
    fetchAllData();

    const qCalls = query(collection(db, "calls"), where("status", "==", "active"));
    const unsubCalls = onSnapshot(qCalls, (snap) => { setCalls(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => { setOrdersState(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
    return () => { unsubCalls(); unsubOrders(); };
  }, []);

  const deleteBooking = async (id) => { if (window.confirm("Delete?")) { try { await deleteDoc(doc(db, "bookings", id)); } catch (e) { } setBookings(bookings.filter(b => b.id !== id)); } };
  const addInventory = async (item) => { try { await setDoc(doc(db, "inventory", item.id), item); } catch (e) { } setInventory([...inventory, item]); };
  const updateStock = async (id, ns) => { try { await updateDoc(doc(db, "inventory", id), { stock: ns }); } catch (e) { } setInventory(inventory.map(i => i.id === id ? { ...i, stock: ns } : i)); };

  const requestWaiter = async (tbl) => {
    try { await setDoc(doc(db, "calls", uid("call")), { id: uid("call"), table: tbl, time: Date.now(), status: "active" }); } catch (e) { console.error(e); }
  };
  const resolveCall = async (id) => { try { await updateDoc(doc(db, "calls", id), { status: "resolved" }); } catch (e) { } };

  const addOffer = async (off) => { setOffersList([...offersList, off]); };
  const removeOffer = async (id) => { setOffersList(offersList.filter(o => o.id !== id)); };

  const placeOrder = async (order) => {
    try { order.coinsClaimed = false; await setDoc(doc(db, "orders", order.id), order); } catch (e) { console.error(e); }
  };

  const advanceStatus = async (orderId, currentStatus) => {
    const idx = STATUS_FLOW.indexOf(currentStatus);
    const nextStatus = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    const updateData = { status: nextStatus, ...(nextStatus === "served" ? { servedAt: Date.now() } : {}) };
    try { await updateDoc(doc(db, "orders", orderId), updateData); } catch (e) { }
    setOrdersState(orders.map(o => o.id === orderId ? { ...o, ...updateData } : o));
  };

  const markPaid = async (orderId, paid) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    if (paid && !order.coinsClaimed) {
      const earned = order.earnedCoins || 0;
      const used = order.rewardUsedCoins || 0;
      const phone = order.customer?.phone;
      if (phone && phone.length >= 10) {
        try {
          const userRef = doc(db, "loyaltyUsers", phone);
          const userSnap = await getDoc(userRef);
          const curCoins = userSnap.exists() ? (userSnap.data().coins || 0) : 0;
          const newCoins = Math.max(0, curCoins + earned - used);
          if (userSnap.exists()) await updateDoc(userRef, { coins: newCoins });
          else await setDoc(userRef, { phone, name: order.customer.name || "Guest", coins: newCoins });
          if (earned > 0) await addDoc(collection(db, "coinHistory"), { phone, coins: earned, reason: `Order #${order.id.slice(1, 5).toUpperCase()}`, timestamp: Date.now() });
          if (used > 0) await addDoc(collection(db, "coinHistory"), { phone, coins: -used, reason: `Redeemed #${order.id.slice(1, 5).toUpperCase()}`, timestamp: Date.now() });
          setLoyaltyUsers(prev => { const ex = prev.find(u => u.phone === phone); if (ex) return prev.map(u => u.phone === phone ? { ...u, coins: newCoins } : u); return [...prev, { phone, name: order.customer?.name || "Guest", coins: newCoins }]; });
        } catch (e) { console.error(e); }
      }
      await updateDoc(doc(db, "orders", orderId), { paid: true, coinsClaimed: true });
    } else {
      await updateDoc(doc(db, "orders", orderId), { paid });
    }
    setOrdersState(prev => prev.map(o => o.id === orderId ? { ...o, paid, coinsClaimed: paid ? true : o.coinsClaimed } : o));
  };

  const bookEvent = async (booking) => { try { await setDoc(doc(db, "bookings", booking.id), booking); } catch (e) { } setBookings([...bookings, booking]); };

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
          {role === "customer" && <CustomerView menu={menu} orders={orders} placeOrder={placeOrder} bookEvent={bookEvent} gallery={gallery} offersList={offersList} table={table} setTable={setTable} requestPinPrompt={requestPinPrompt} settings={settings} isDark={isDark} setIsDark={setIsDark} requestWaiter={requestWaiter} loyaltyRules={loyaltyRules} loyaltyUsers={loyaltyUsers} coinHistory={coinHistory} setOrdersState={setOrdersState} categories={categories} flashSaleItems={flashSaleItems} comboOffers={comboOffers} />}
          {role === "staff" && <StaffView orders={orders} advanceStatus={advanceStatus} requestPinPrompt={requestPinPrompt} calls={calls} resolveCall={resolveCall} cancelOrderByStaff={cancelOrderByStaff} />}
          {role === "admin" && <AdminView menu={menu} setMenuState={setMenuState} bookings={bookings} orders={orders} markPaid={markPaid} requestPinPrompt={requestPinPrompt} inventory={inventory} addInventory={addInventory} updateStock={updateStock} deleteBooking={deleteBooking} offersList={offersList} addOffer={addOffer} removeOffer={removeOffer} loyaltyRules={loyaltyRules} setLoyaltyRules={setLoyaltyRules} loyaltyUsers={loyaltyUsers} settings={settings} setSettings={setSettings} gallery={gallery} setGallery={setGallery} categories={categories} updateCategories={updateCategories} flashSaleItems={flashSaleItems} setFlashSaleItems={setFlashSaleItems} comboOffers={comboOffers} setComboOffers={setComboOffers} savePromotions={savePromotions} />}
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
              <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 16 }}>Staff: 5432 · Admin: 9876</div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
