import React, { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";

/* ═══════════════════════════════════════════════════════════════════════════════════
   🍽️ EAT & PARK RESTAURANT — PROFESSIONAL POS V7.0 (ULTIMATE FINAL)
   ✨ FULL MENU RESTORED | QR PAYMENT | EATCOIN | AI | OFFERS | NO VOICE SEARCH
═══════════════════════════════════════════════════════════════════════════════════ */

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
@keyframes flash { 0% { background-color: #E25938; } 50% { background-color: #C1442D; } 100% { background-color: #E25938; } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes slideRight { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes toastSlide { 0% { transform: translate(-50%, 100px); opacity: 0; } 10% { transform: translate(-50%, 0); opacity: 1; } 90% { transform: translate(-50%, 0); opacity: 1; } 100% { transform: translate(-50%, 100px); opacity: 0; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
@keyframes scaleInBounce { 0% { transform: scale(0.3); opacity: 0; } 50% { opacity: 1; } 100% { transform: scale(1); opacity: 1; } }

.flash-banner { animation: flash 2s infinite; }
.slide-up { animation: slideUp 0.4s ease-out; }
.slide-right { animation: slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-anim { animation: toastSlide 3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.smooth-transition { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.hover-lift:hover { transform: translateY(-3px); box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12) !important; }
.pulse-anim { animation: pulse 2s infinite; }
.scale-bounce { animation: scaleInBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }

/* ✨ VIP Dark Mode Styling */
.dark-theme { filter: invert(0.92) hue-rotate(180deg); background: #111; min-height: 100vh; }
.dark-theme img, .dark-theme .keep-color { filter: invert(1) hue-rotate(180deg); }

@media (prefers-reduced-motion: reduce) {
  .pulse-anim, .scale-bounce, .smooth-transition { animation: none !important; transition: none !important; }
}

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
  success: "#10B981", error: "#EF4444",
};

const RESTAURANT = {
  name: "Eat & Park", full: "Eat & Park Restaurant", tagline: "A Premium Family Restaurant",
  address: "Girja More, Ara – Buxar Main Road, Pakri, Ara", 
  phones: ["7303267750", "8271918062"], whatsapp: "917303267750", upiId: "apnanumber@upi" 
};

const CATEGORIES = [
  "Drinks", "Fun Food", "Chinese Starter", "Mughlai", "Tandoori", 
  "Soup", "Indian Bread", "Snacks", "Chinese Mains", "Pulao", 
  "Paneer & Mushroom", "Chicken, Mutton, Fish & Egg", "Biryani & Thali", 
  "Aloo, Dal & Sides", "Momo", "Tea & Coffee",
];

const VEG = COLORS.sage; const NONVEG = COLORS.rust;

function mi(id, name, price, category, veg, desc, portion, isBestseller = false, available = true) {
  let img = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; 
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
  return { id, name, desc: desc || "Freshly prepared with premium ingredients.", price, category, veg, available, image: img, portion: portion || "", isBestseller };
}

// ✨ FULL MENU RESTORED (Saare items yahan hain)
const DEFAULT_MENU = [
  mi("d1", "Mint Mojito", 90, "Drinks", true, "Refreshing blend of mint, lemon & soda.", "", true), 
  mi("d9", "Cold Coffee", 120, "Drinks", true, "Chilled, frothy coffee.", "", true), 
  mi("d10", "Cold Drink", 50, "Drinks", true),
  mi("f2", "Eat & Park Special Pizza", 280, "Fun Food", true, "Loaded with veggies & extra cheese.", "", true), 
  mi("f9", "Chicken Roll", 150, "Fun Food", false),
  mi("cs1", "Paneer Chilli", 240, "Chinese Starter", true, "Crispy paneer in soy garlic sauce.", "Dry/Gravy", true), 
  mi("cs8", "Chicken Chilli", 240, "Chinese Starter", false, "", "Dry/Gravy", true),
  mi("mg1", "Tandoori Chicken", 450, "Mughlai", false), 
  mi("t1", "Paneer Tikka", 299, "Tandoori", true, "", "", true),
  mi("b8", "Garlic Naan", 70, "Indian Bread", true, "Topped with minced garlic.", "", true),
  mi("pn1", "Paneer Masala", 250, "Paneer & Mushroom", true), 
  mi("nv8", "Chicken Butter Masala", 350, "Chicken, Mutton, Fish & Egg", false, "", "", true),
  mi("br5", "Chicken Biryani", 210, "Biryani & Thali", false, "Classic fragrant rice and chicken.", "", true), 
  mi("nv12", "Mutton Handi", 650, "Chicken, Mutton, Fish & Egg", false, "500g", true)
];

const DEFAULT_OFFERS = [
  { id: "off1", title: "Flat 20% OFF 🍜", desc: "Enjoy flat 20% off on all Chinese items today!" },
  { id: "off2", title: "Free Cold Drink 🥤", desc: "Get a free cold drink on orders above ₹499." }
];

const STATUS_FLOW = ["new", "preparing", "ready", "served"];
const STATUS_LABEL = { new: "New", preparing: "Preparing", ready: "Ready", served: "Served" };
const STATUS_COLOR = { new: COLORS.rust, preparing: COLORS.copper, ready: COLORS.sage, served: "#8A8375" };

const PREP_TIME_ESTIMATES = { "Drinks": 3, "Fun Food": 10, "Chinese Starter": 12, "Tandoori": 20, "Biryani & Thali": 25 };

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

const primaryBtn = { background: COLORS.copper, color: "#fff", border: "none", borderRadius: 14, padding: "13px 20px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.3s ease", boxShadow: "0 4px 12px rgba(226,89,56,0.2)" };
const th = { padding: "12px 14px", borderBottom: `2px solid ${COLORS.line}`, fontFamily: "'Plus Jakarta Sans', sans-serif" }; 
const td = { padding: "12px 14px", borderBottom: `1px solid ${COLORS.line}` };
const inputStyle = { padding: "12px 16px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", width: "100%", boxSizing: "border-box", transition: "all 0.2s ease" };

function Badge({ children, color }) { return <span style={{ background: color, color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 999, fontWeight: 700, display: "inline-block" }}>{children}</span>; }
function VegDot({ veg }) { const c = veg ? VEG : NONVEG; return <span style={{ width: 14, height: 14, border: `1.5px solid ${c}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} /></span>; }

function ProgressRing({ progress, size = 60, strokeWidth = 3 }) {
  const circumference = 2 * Math.PI * ((size - strokeWidth) / 2);
  const offset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={(size-strokeWidth)/2} fill="none" stroke={COLORS.line} strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={(size-strokeWidth)/2} fill="none" stroke={COLORS.sage} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.3em" fontSize="16" fontWeight="700" fill={COLORS.sage}>{progress}%</text>
    </svg>
  );
}

function OrderTimer({ createdAt, estimatedTime }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const timer = setInterval(() => setElapsed(Math.floor((Date.now() - createdAt) / 1000)), 1000); return () => clearInterval(timer); }, [createdAt]);
  const minutes = Math.floor(elapsed / 60); const seconds = elapsed % 60; const isOvertime = elapsed > (estimatedTime * 60);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: isOvertime ? 'rgba(239, 68, 68, 0.1)' : COLORS.sageLight, borderRadius: 10, borderLeft: `3px solid ${isOvertime ? COLORS.error : COLORS.sage}` }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: isOvertime ? COLORS.error : COLORS.sageDark }}>⏱️ {minutes}:{seconds.toString().padStart(2, '0')}</span>
      <span style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600 }}>/ {estimatedTime}m</span>
    </div>
  );
}

const stepBtnStyle = { width: 28, height: 28, borderRadius: "50%", border: `1.5px solid ${COLORS.copper}`, background: "transparent", color: COLORS.copper, fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" };

function Stepper({ qty, onChange }) { 
  return <div style={{ display: "flex", alignItems: "center", gap: 10 }}><button onClick={() => onChange(Math.max(0, qty - 1))} style={stepBtnStyle} className="smooth-transition">−</button><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, minWidth: 16, textAlign: "center", fontSize: 15 }}>{qty}</span><button onClick={() => onChange(qty + 1)} style={stepBtnStyle} className="smooth-transition">+</button></div>; 
}

function AddBtnStepper({ qty, onChange, available }) {
  if (!available) return <div style={{ color: COLORS.rust, background: COLORS.paper2, borderRadius: 8, fontWeight: 700, fontSize: 11, padding: "6px 10px", textAlign: "center", width: 80, boxSizing: "border-box" }}>Out of stock</div>;
  if (!qty) return <button onClick={() => onChange(1)} style={{ color: COLORS.sage, background: "#fff", border: `2px solid ${COLORS.sage}`, borderRadius: 8, fontWeight: 800, fontSize: 12, padding: "6px 16px", cursor: "pointer", width: 80, boxShadow: "0 4px 12px rgba(74,124,89,0.15)" }} className="smooth-transition hover-lift scale-bounce">ADD</button>;
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: 80, padding: "4px", background: "#fff", border: `2px solid ${COLORS.sage}`, borderRadius: 8, boxShadow: "0 4px 12px rgba(74,124,89,0.15)" }}><button onClick={() => onChange(Math.max(0, qty - 1))} style={{...stepBtnStyle, width: 22, height: 22, border: "none", color: COLORS.sage}} className="smooth-transition">−</button><span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 14, color: COLORS.sage }}>{qty}</span><button onClick={() => onChange(qty + 1)} style={{...stepBtnStyle, width: 22, height: 22, border: "none", color: COLORS.sage}} className="smooth-transition">+</button></div>;
}

// ✨ NORMAL SEARCH BAR (NO VOICE SEARCH - BUG FREE)
function SearchBar({ value, onChange, placeholder = "Search menu..." }) {
  return (
    <div style={{ position: "relative", flex: 1 }}>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{...inputStyle, paddingLeft: 42, background: "#fff"}} onFocus={(e) => { e.target.style.borderColor = COLORS.copper; }} onBlur={(e) => { e.target.style.borderColor = COLORS.line; }} />
      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: COLORS.textLight }}>🔍</span>
      {value && ( <button onClick={() => onChange("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: COLORS.textLight, padding: "4px 8px" }}>✕</button> )}
    </div>
  );
}

function SlideButton({ onComplete, text, bg = COLORS.sage }) {
  const [val, setVal] = useState(0);
  return (
    <div style={{position: 'relative', width: '100%', height: 48, background: COLORS.paper2, borderRadius: 14, overflow: 'hidden', border: `1px solid ${COLORS.line}`}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${val}%`, background: bg, transition: val === 0 ? 'width 0.3s' : 'none'}} />
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: val > 50 ? '#fff' : COLORS.text, pointerEvents: 'none', zIndex: 2}}>
        {text} <span style={{marginLeft: 8, fontSize: 18}}>»</span>
      </div>
      <input type="range" min="0" max="100" value={val} onChange={(e) => setVal(Number(e.target.value))} onMouseUp={() => { if(val > 85) onComplete(); setVal(0); }} onTouchEnd={() => { if(val > 85) onComplete(); setVal(0); }} style={{opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute', top: 0, left: 0, zIndex: 3}} />
    </div>
  );
}

function ModalHeader({ title, onClose }) { return <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 16 }}><div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 700 }}>{title}</div><button onClick={onClose} style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>✕</button></div>; }

function Toast({ message, type = 'info' }) {
  return (
    <div className="toast-anim" style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', background: type === 'success' ? COLORS.success : type === 'error' ? COLORS.error : COLORS.ink, color: '#fff', padding: '16px 28px', borderRadius: 30, boxShadow: '0 12px 28px rgba(0,0,0,0.3)', zIndex: 100, fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 16 }}>
      <span>{message}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════
   1. ENHANCED CUSTOMER VIEW
═══════════════════════════════════════════════════════════════════════════════════ */

function CustomerView({ menu, orders, placeOrder, bookEvent, gallery, offersList, table, setTable, setRole, promo, settings, installApp, handlePrint, isDark, setIsDark, requestWaiter, loyaltyRules, loyaltyUsers }) {
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

  const [bookType, setBookType] = useState("table");
  const [bookData, setBookData] = useState({ name: "", phone: "", date: "", time: "", guests: "" });
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pinInput, setPinInput] = useState("");

  const filteredItems = (searchQuery.trim() ? menu : menu.filter((m) => m.category === category)).filter((m) => {
    if (vegOnly && !m.veg) return false;
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); return m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q); }
    return true;
  });

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const cartCount = cartItems.reduce((s, [, q]) => s + q, 0);
  const cartTotal = cartItems.reduce((s, [id, q]) => { const item = menu.find((m) => m.id === id); return s + (item ? item.price * q : 0); }, 0);
  
  const handleSetQty = (id, q) => {
    const oldQ = cart[id] || 0;
    setCart((c) => ({ ...c, [id]: q }));
    if (q > oldQ && q === 1) {
       const addedItem = menu.find(m => m.id === id);
       if(addedItem) {
          let targetCat = "Drinks";
          if(addedItem.category.includes("Starter")) targetCat = "Chinese Mains";
          else if(addedItem.category.includes("Mains")) targetCat = "Drinks";
          else if(addedItem.category.includes("Tandoori")) targetCat = "Indian Bread";
          else if(addedItem.category.includes("Bread")) targetCat = "Paneer & Mushroom";
          
          const options = menu.filter(m => m.category === targetCat && m.available);
          if(options.length > 0) {
             const randomSug = options[Math.floor(Math.random() * options.length)];
             setAiSuggestion(randomSug);
             setTimeout(() => setAiSuggestion(null), 5000);
          }
       }
    }
  };

  const myActiveOrders = orders.filter(o => myOrderIds.includes(o.id) && o.status !== "served");
  // ✨ PAYMENT QR CODE LOGIC (UPI)
  const cartQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=${RESTAURANT.upiId}&pn=${encodeURIComponent(RESTAURANT.name)}&am=${cartTotal}&cu=INR`)}`;
  const loyaltyQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=${RESTAURANT.upiId}&pn=${encodeURIComponent(RESTAURANT.name)}&am=999&cu=INR`)}`;

  const showToast = (msg, type = 'info') => { setToast(msg); setToastType(type); setTimeout(() => setToast(null), 3000); };

  const activeUser = loyaltyUsers.find(u => u.phone === custPhone);
  const currentCoins = activeUser ? activeUser.coins : 0;
  const newEarnedCoins = Math.floor(cartTotal / loyaltyRules.rate);

  async function handlePlaceOrder() {
    if (cartItems.length === 0) return;
    if (!custName.trim() || !custPhone.trim()) { showToast("⚠️ Please enter Name & Phone", 'error'); return; }
    if (orderType === "parcel" && !custAddress.trim()) { showToast("⚠️ Please enter Address", 'error'); return; }

    const orderId = uid("o");
    const itemStrings = cartItems.map(([id, qty]) => { const m = menu.find((mi) => mi.id === id); return `${qty}x ${m.name}` }).join(", ");
    const claimedText = claimedReward ? `\n🎁 *Free Reward Claimed:* ${claimedReward.item}` : "";

    const waText = `🚨 *NEW ORDER ALERT* (#${orderId.slice(1,5).toUpperCase()})\n\n`
                 + `*Type:* ${orderType === 'parcel' ? '🛍️ Parcel' : `🍽️ Table ${table}`}\n`
                 + `*Customer:* ${custName} (${custPhone})\n`
                 + (orderType === 'parcel' ? `*Address:* ${custAddress}\n\n` : `\n`)
                 + `*Items:* ${itemStrings}${claimedText}\n`
                 + `*Total Bill:* ₹${cartTotal}\n`
                 + (notes ? `*Notes:* ${notes}` : ``);
                 
    const link = document.createElement('a'); link.href = `https://wa.me/${RESTAURANT.whatsapp}?text=${encodeURIComponent(waText)}`; link.target = '_blank'; document.body.appendChild(link); link.click(); document.body.removeChild(link);

    const order = { id: orderId, table, orderType, customer: { name: custName, phone: custPhone, address: orderType === "parcel" ? custAddress : "" }, items: cartItems.map(([id, qty]) => { const m = menu.find((mi) => mi.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty }; }), claimedReward: claimedReward ? claimedReward.item : null, rewardUsedCoins: claimedReward ? claimedReward.cost : 0, earnedCoins: newEarnedCoins, notes, payment: "cash", status: "new", paid: false, createdAt: Date.now() };
    
    await placeOrder(order); 
    setMyOrderIds([...myOrderIds, order.id]); 
    setCart({}); 
    setNotes(""); 
    setClaimedReward(null);
    setCartOpen(false); 
    setActiveModal('track'); 
    showToast("🎉 Order Placed Successfully!", 'success');
  }

  async function handleBooking() {
    if(!bookData.name || !bookData.phone || !bookData.date || !bookData.time || !bookData.guests) { showToast("⚠️ Please fill all fields", 'error'); return; }
    const newBooking = { ...bookData, type: bookType, id: uid("b"), status: "pending", createdAt: Date.now() };
    await bookEvent(newBooking); setConfirmedBooking(newBooking); setBookData({ name: "", phone: "", date: "", time: "", guests: "" }); showToast("✅ Booking Request Sent!", 'success');
  }

  function handleLoginSubmit() {
    const aPin = settings?.adminPin || "9876"; const sPin = settings?.staffPin || "5432";
    if (pinInput === aPin) { setRole("admin"); setShowLoginModal(false); setPinInput(""); showToast("🔓 Admin access", 'success'); } 
    else if (pinInput === sPin) { setRole("staff"); setShowLoginModal(false); setPinInput(""); showToast("🔓 Staff access", 'success'); } 
    else { showToast("❌ Incorrect PIN", 'error'); setPinInput(""); }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: cartCount ? 120 : 60, background: "var(--bg-color, #fff)", minHeight: "100vh", position: "relative" }}>
      {promo && promo.show && promo.text && ( <div className="flash-banner" style={{ color: "#fff", padding: "10px 16px", textAlign: "center", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700 }}>🎉 {promo.text}</div> )}
      
      <button onClick={() => {requestWaiter(table); showToast("🔔 Waiter has been notified!", 'success');}} style={{ position: "fixed", top: 80, right: 16, background: COLORS.rust, color: "#fff", border: "none", borderRadius: 20, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 8px 24px rgba(192,57,43,0.4)", cursor: "pointer", zIndex: 60, fontSize: 13, fontWeight: 800 }} className="smooth-transition hover-lift scale-bounce" title="Call Waiter">🔔 Waiter Call</button>

      <div style={{ position: "relative", height: 220, borderRadius: "0 0 24px 24px", overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", marginBottom: 16 }}>
        <div className="keep-color" style={{ position: "absolute", inset: 0, backgroundImage: `url('${settings?.heroImage || "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80"}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="keep-color" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,26,26,0.9) 0%, rgba(26,26,26,0.3) 60%, rgba(26,26,26,0.1) 100%)" }} />
        <div className="keep-color" style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.25)", backdropFilter: "blur(12px)", padding: "6px 12px", borderRadius: 20, color: "#fff", display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.3)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>Table</span>
          <select value={table} onChange={(e) => setTable(Number(e.target.value))} style={{ background: "transparent", color: "#fff", border: "none", fontWeight: 800, fontSize: 16, outline: "none", appearance: "none" }}>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (<option key={n} value={n} style={{color: '#000'}}>{n}</option>))}</select>
        </div>
        <div className="keep-color" style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, color: "#fff", margin: "0 0 4px", textShadow: "0 4px 12px rgba(0,0,0,0.6)", fontWeight: 800 }}>{RESTAURANT.name}</h1>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.9)", margin: 0, fontWeight: 500 }}>{RESTAURANT.tagline}</p>
        </div>
      </div>

      {myActiveOrders.length > 0 && (
        <div style={{ padding: "0 16px", marginBottom: 12 }}>
          <button onClick={() => setActiveModal('track')} style={{ width: "100%", background: COLORS.sageLight, border: `2px solid ${COLORS.sage}`, color: COLORS.sageDark, borderRadius: 14, padding: "12px", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: 14 }} className="smooth-transition hover-lift"><span>📦 {myActiveOrders.length} Active Order{myActiveOrders.length > 1 ? 's' : ''}</span><span>Track ➔</span></button>
        </div>
      )}

      {!searchQuery.trim() && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "8px 16px", scrollbarWidth: "none", borderBottom: `1px solid ${COLORS.line}` }}>
          {CATEGORIES.map((c) => ( <button key={c} onClick={() => setCategory(c)} style={{ whiteSpace: "nowrap", padding: "8px 16px", borderRadius: 12, border: `1.5px solid ${category === c ? COLORS.copper : COLORS.line}`, background: category === c ? COLORS.copper : "transparent", color: category === c ? "#fff" : COLORS.ink, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }} className="smooth-transition">{c}</button> ))}
        </div>
      )}

      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
          <SearchBar value={searchQuery} onChange={(val) => setSearchQuery(val)} />
          <button onClick={() => setVegOnly(!vegOnly)} style={{ padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${vegOnly ? COLORS.sage : COLORS.line}`, background: vegOnly ? COLORS.sageLight : "transparent", color: vegOnly ? COLORS.sageDark : COLORS.textLight, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><VegDot veg={true} /> <span style={{fontSize: 13}}>{vegOnly ? "Veg" : "All"}</span></button>
        </div>

        {filteredItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: COLORS.textLight }}><div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div><div style={{ fontWeight: 600, fontSize: 15 }}>No items found</div></div>
        )}

        {filteredItems.map((item) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${COLORS.line}`, gap: 12, opacity: item.available ? 1 : 0.6 }} className="slide-up">
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
              <img src={item.image} alt={item.name} loading="lazy" className="keep-color" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, filter: item.available ? 'none' : 'grayscale(100%)' }} />
              <div style={{ position: "absolute", bottom: -12, left: "50%", transform: "translateX(-50%)", zIndex: 2 }}>
                <AddBtnStepper qty={cart[item.id] || 0} onChange={(q) => handleSetQty(item.id, q)} available={item.available} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "20px 20px 60px", fontSize: 13, color: COLORS.textLight, lineHeight: 1.6, fontWeight: 500 }}>
        {RESTAURANT.address}<br />{RESTAURANT.phones.join(" · ")}<br /><br />
        <button onClick={() => setShowLoginModal(true)} style={{ background: "none", border: `1px solid ${COLORS.line}`, color: COLORS.textLight, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }} className="smooth-transition hover-lift">🔒 Staff Login</button>
      </div>

      {aiSuggestion && !cartOpen && !activeModal && (
         <div className="slide-up" style={{position: 'fixed', bottom: cartCount>0 ? 100 : 20, left: 16, right: 16, background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', padding: 14, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 4, boxShadow: '0 8px 24px rgba(253, 160, 133, 0.4)'}}>
            <div>
              <div style={{fontSize: 12, fontWeight: 800, color: '#d35400', marginBottom: 2}}>🤖 AI Suggests pairing:</div>
              <div style={{fontSize: 16, fontWeight: 800, color: COLORS.ink}}>{aiSuggestion.name}</div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
               <button onClick={() => { handleSetQty(aiSuggestion.id, 1); setAiSuggestion(null); }} style={{background: COLORS.ink, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10, fontWeight: 800, cursor: 'pointer'}}>+ Add</button>
               <button onClick={() => setAiSuggestion(null)} style={{background: 'transparent', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer'}}>&times;</button>
            </div>
         </div>
      )}

      {!cartOpen && !activeModal && (
        <button className="keep-color smooth-transition hover-lift" onClick={() => setShowSidebar(true)} style={{ position: "fixed", top: 16, left: 16, background: COLORS.ink, color: "#fff", border: "none", borderRadius: "50%", width: 50, height: 50, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", cursor: "pointer", zIndex: 50, fontSize: 20 }}>☰</button>
      )}

      {cartCount > 0 && !cartOpen && !activeModal && (
        <button onClick={() => setCartOpen(true)} style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 400, background: COLORS.sage, color: "#fff", border: "none", borderRadius: 16, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, fontSize: 16, cursor: "pointer", zIndex: 5, boxShadow: "0 12px 28px rgba(74,124,89,0.35)" }} className="smooth-transition hover-lift">
          <span>{cartCount} item{cartCount > 1 ? "s" : ""}</span><span>{inr(cartTotal)} ➔</span>
        </button>
      )}

      {showSidebar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex" }}>
          <div style={{ width: "80%", maxWidth: 300, background: "#fff", height: "100%", padding: "24px", display: "flex", flexDirection: "column", boxShadow: "4px 0 30px rgba(0,0,0,0.2)", overflowY: "auto" }} className="slide-right">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: COLORS.copper }}>Eat & Park</div>
              <button onClick={() => setShowSidebar(false)} style={{ background: "none", border: "none", fontSize: 22, color: COLORS.textLight, cursor: "pointer" }}>✕</button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <SidebarBtn icon={isDark ? "☀️" : "🌙"} text={isDark ? "Switch to Light Mode" : "VIP Dark Mode"} onClick={() => { setIsDark(!isDark); setShowSidebar(false); showToast(isDark ? "☀️ Light Mode Active" : "🌙 VIP Dark Mode Active", "success"); }} highlight />
              <SidebarBtn icon="🎁" text="Today's Offers" onClick={() => {setShowSidebar(false); setActiveModal('offers');}} />
              <SidebarBtn icon="🍽️" text="Table Booking" onClick={() => {setShowSidebar(false); setBookType("table"); setActiveModal('booking');}} />
              <SidebarBtn icon="🎉" text="Party Booking" onClick={() => {setShowSidebar(false); setBookType("party"); setActiveModal('booking');}} />
              <SidebarBtn icon="👑" text="VIP Loyalty Partner" onClick={() => {setShowSidebar(false); setActiveModal('loyalty');}} />
              <div style={{ borderTop: `1px solid ${COLORS.line}`, marginTop: 10, paddingTop: 14 }}>
                <SidebarBtn icon="📱" text="Install App" onClick={() => {setShowSidebar(false); installApp();}} />
              </div>
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }} onClick={() => setShowSidebar(false)} className="fade-in" />
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
                  <button onClick={() => setOrderType("parcel")} style={{ flex: 1, padding: "12px", border: `2px solid ${orderType === "parcel" ? COLORS.copper : COLORS.line}`, background: orderType === "parcel" ? COLORS.copper : "#fff", color: orderType === "parcel" ? "#fff" : COLORS.ink, borderRadius: 12, fontWeight: 800, cursor: "pointer", transition: "all 0.2s ease" }}>🛍️ Parcel</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 20 }}>
                  <div style={{fontSize: 13, fontWeight: 800, color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 1}}>Your Details</div>
                  <input type="tel" placeholder="Phone Number *" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} style={{...inputStyle, borderColor: custPhone.length >= 10 ? COLORS.sage : COLORS.line}} />
                  <input type="text" placeholder="Your Name *" value={custName} onChange={(e) => setCustName(e.target.value)} style={inputStyle} />
                  {orderType === "parcel" && <textarea placeholder="Delivery Address *" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} style={{...inputStyle, resize: "none"}} rows={2} />}
                </div>

                {/* 🪙 EATCOIN LOYALTY SYSTEM UI */}
                <div style={{ background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', borderRadius: 16, padding: 16, marginBottom: 20, border: `1.5px solid ${COLORS.gold}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{fontWeight: 800, fontSize: 16, color: COLORS.ink}}>🪙 EatCoins</div>
                    {custPhone.length >= 10 ? (
                      <div style={{fontSize: 14, fontWeight: 800, color: COLORS.sageDark}}>Bal: {currentCoins}</div>
                    ) : (
                      <div style={{fontSize: 12, color: COLORS.textLight}}>Enter Phone to check</div>
                    )}
                  </div>
                  
                  {custPhone.length >= 10 && (
                    <div style={{ marginBottom: 12 }}>
                      {loyaltyRules.rewards.map(r => {
                        const canAfford = currentCoins >= r.cost;
                        const isClaimed = claimedReward?.id === r.id;
                        return (
                          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: 10, borderRadius: 10, marginBottom: 8, border: `1px solid ${isClaimed ? COLORS.success : COLORS.line}` }}>
                            <div>
                              <div style={{fontWeight: 700, fontSize: 14, color: COLORS.ink}}>{r.item}</div>
                              <div style={{fontSize: 12, color: COLORS.gold, fontWeight: 800}}>{r.cost} Coins</div>
                            </div>
                            <button 
                              onClick={() => setClaimedReward(isClaimed ? null : r)}
                              disabled={!canAfford && !isClaimed} 
                              style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: isClaimed ? COLORS.success : (canAfford ? COLORS.ink : COLORS.paper2), color: isClaimed || canAfford ? '#fff' : COLORS.textLight, fontWeight: 800, cursor: canAfford ? 'pointer' : 'not-allowed' }}>
                              {isClaimed ? "✓ Claimed" : "Claim"}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: COLORS.copper, fontWeight: 700, textAlign: 'center', marginTop: 8 }}>
                    🎁 You will earn +{newEarnedCoins} EatCoins on this order!
                  </div>
                </div>

                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special cooking instructions?" style={{ ...inputStyle, marginBottom: 20, resize: "none" }} rows={2} />
                
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18 }}>
                    <span>Grand Total</span><span style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.copper }}>{inr(cartTotal)}</span>
                  </div>
                  {claimedReward && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, color: COLORS.success, marginTop: 4 }}>
                      <span>+ Free Reward</span><span>{claimedReward.item}</span>
                    </div>
                  )}
                </div>
                
                {/* ✨ UPI PAYMENT QR CODE FOR PARCEL */}
                {orderType === "parcel" && (
                  <div style={{ textAlign: "center", padding: "20px", background: COLORS.paper, border: `2px dashed ${COLORS.line}`, borderRadius: 16, marginBottom: 20 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.ink, marginBottom: 12 }}>Scan to Pay {inr(cartTotal)}</div>
                    <img src={cartQrSrc} alt="UPI QR Code" style={{ width: 160, height: 160, borderRadius: 14, border: '4px solid #fff', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} />
                  </div>
                )}
                <button onClick={handlePlaceOrder} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 14, padding: "16px", fontWeight: 800, fontSize: 16, cursor: "pointer", width: "100%", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }} className="hover-lift smooth-transition">🎉 Place Order</button>
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
                    <img src={loyaltyQrSrc} alt="Pay 999" className="keep-color" style={{ width: 160, height: 160 }} />
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
                    <button onClick={() => {setActiveModal(null); setConfirmedBooking(null);}} style={{ ...primaryBtn, width: "100%", background: COLORS.paper2, color: COLORS.ink, boxShadow: "none" }}>Close</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                    <input type="text" placeholder="Your Name" value={bookData.name} onChange={(e) => setBookData({...bookData, name: e.target.value})} style={inputStyle} />
                    <input type="tel" placeholder="Phone Number" value={bookData.phone} onChange={(e) => setBookData({...bookData, phone: e.target.value})} style={inputStyle} />
                    <div style={{ display: "flex", gap: 14 }}><input type="date" value={bookData.date} onChange={(e) => setBookData({...bookData, date: e.target.value})} style={inputStyle} /><input type="time" value={bookData.time} onChange={(e) => setBookData({...bookData, time: e.target.value})} style={inputStyle} /></div>
                    <input type="number" placeholder="Number of Guests" value={bookData.guests} onChange={(e) => setBookData({...bookData, guests: e.target.value})} style={inputStyle} />
                    <button onClick={handleBooking} style={{ ...primaryBtn, width: "100%", marginTop: 10 }}>Send Request</button>
                  </div>
                )}
              </>
            )}
            {activeModal === 'track' && (
              <>
                <ModalHeader title="Your Active Orders" onClose={() => setActiveModal(null)} />
                {myActiveOrders.length === 0 ? <div style={{textAlign: 'center', padding: "50px 0", color: COLORS.textLight, fontWeight: 600}}>No active orders right now.</div> : myActiveOrders.map(o => {
                  const stepIdx = STATUS_FLOW.indexOf(o.status); const estimatedTime = getEstimatedTime(o.items);
                  return (
                    <div key={o.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, color: COLORS.ink, marginBottom: 6 }}>Order #{o.id.slice(1,5).toUpperCase()}</div>
                      <OrderTimer createdAt={o.createdAt} estimatedTime={estimatedTime} />
                      <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}><ProgressRing progress={getOrderProgress(o.status)} size={80} /></div>
                      <button onClick={() => setActiveModal(null)} style={{ ...primaryBtn, width: "100%", background: "transparent", color: COLORS.copper, border: `2px solid ${COLORS.copper}`, boxShadow: "none", marginTop: 16 }}>Back to Menu</button>
                    </div>
                  )
                })}
              </>
            )}

          </div>
        </div>
      )}
      
      {showLoginModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowLoginModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", padding: "28px", borderRadius: 20, width: "90%", maxWidth: 340, textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }} className="slide-up">
            <div style={{fontSize: 36, marginBottom: 16}}>🔒</div>
            <h3 style={{ margin: "0 0 20px", fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 700 }}>Enter Security PIN</h3>
            <input type="password" placeholder="••••" autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleLoginSubmit(); }} style={{ ...inputStyle, textAlign: "center", fontSize: 32, letterSpacing: 12, marginBottom: 24, fontWeight: 800, padding: "16px" }} />
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => { setShowLoginModal(false); setPinInput(""); }} style={{ flex: 1, padding: "14px", borderRadius: 12, border: `2px solid ${COLORS.line}`, background: "transparent", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleLoginSubmit} style={{ flex: 1, padding: "14px", borderRadius: 12, background: COLORS.ink, color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>Login</button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}

function SidebarBtn({ icon, text, onClick, highlight }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderRadius: 14, background: highlight ? COLORS.copperLight : COLORS.paper, border: highlight ? `1.5px solid ${COLORS.copper}` : `1px solid ${COLORS.line}`, color: highlight ? COLORS.copperDark : COLORS.ink, fontSize: 15, fontWeight: 700, cursor: "pointer", textAlign: "left", transition: "all 0.2s ease", width: '100%', boxShadow: highlight ? "0 4px 12px rgba(226,89,56,0.15)" : "none" }}>
      <span style={{ fontSize: 20 }}>{icon}</span> <span>{text}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════
   2. STAFF VIEW
═══════════════════════════════════════════════════════════════════════════════════ */

function StaffView({ orders, advanceStatus, setRole, handlePrint, calls, resolveCall }) {
  const active = orders.filter((o) => o.status !== "served").sort((a, b) => a.createdAt - b.createdAt);
  const activeCalls = calls.filter(c => c.status === 'active');
  const columns = ["new", "preparing", "ready"];
  const newOrderCount = active.filter(o => o.status === "new").length;
  const prevCountRef = useRef(newOrderCount);
  const activeCallsCount = activeCalls.length;
  const prevCallsCountRef = useRef(activeCallsCount);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  useEffect(() => {
    if (newOrderCount > prevCountRef.current) {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.play().catch(e => console.log(e));
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrderId, active]);

  return (
    <div style={{ padding: "26px 20px 60px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: 'center' }}><div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, color: COLORS.ink, fontWeight: 800 }}>🍳 Kitchen Board</div><button onClick={() => setRole("admin")} style={{ ...primaryBtn, background: COLORS.ink }}>⚙️ Admin</button></div>
      <div style={{ fontSize: 15, color: COLORS.textLight, marginBottom: 24, fontWeight: 600 }}>Use ↑↓ to navigate, P/R to advance</div>

      {activeCalls.length > 0 && (
        <div style={{ background: "rgba(239, 68, 68, 0.1)", border: `2px solid ${COLORS.error}`, borderRadius: 16, padding: 16, marginBottom: 24 }} className="slide-up">
          <h3 style={{ color: COLORS.error, margin: "0 0 12px 0", display: 'flex', alignItems: 'center', gap: 8 }}>🚨 Waiter Requested!</h3>
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
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: isSelected ? '#fff' : (o.orderType === "parcel" ? COLORS.rust : COLORS.ink) }}>{o.orderType === "parcel" ? "🛍️ PARCEL" : `🍽️ Table ${o.table}`}</div>
                        <div style={{ fontSize: 13, color: isSelected ? 'rgba(255,255,255,0.8)' : COLORS.textLight, fontWeight: 700, background: isSelected ? 'rgba(255,255,255,0.25)' : COLORS.paper2, padding: '4px 10px', borderRadius: 12 }}>{timeAgo(o.createdAt)}</div>
                      </div>
                      <div style={{ borderTop: isSelected ? `1px solid rgba(255,255,255,0.3)` : `1.5px dashed ${COLORS.line}`, paddingTop: 16, marginBottom: 16 }}>
                        {o.items.map((it) => ( <div key={it.itemId} style={{ fontSize: 15, marginBottom: 8, fontWeight: 600, color: isSelected ? '#fff' : COLORS.ink }}><span style={{ fontWeight: 800, display: 'inline-block', width: 28 }}>{it.qty}×</span> {it.name} <span style={{color: isSelected ? 'rgba(255,255,255,0.7)' : COLORS.textLight, fontSize: 13}}>{it.portion}</span></div> ))}
                        {/* ✨ SHOW FREE REWARD IN KITCHEN */}
                        {o.claimedReward && (
                          <div style={{ fontSize: 15, marginTop: 12, padding: '8px 12px', background: isSelected ? 'rgba(255,255,255,0.2)' : COLORS.sageLight, color: isSelected ? '#fff' : COLORS.sageDark, borderRadius: 8, fontWeight: 800 }}>
                            🎁 FREE: {o.claimedReward}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 20, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}><SlideButton text={status === "new" ? "Slide to Prep (P)" : status === "preparing" ? "Slide to Ready (R)" : "Slide to Serve"} bg={isSelected ? '#fff' : STATUS_COLOR[status]} onComplete={() => advanceStatus(o.id, status)} /></div>
                        <button onClick={() => handlePrint(o, "kot")} style={{ background: isSelected ? 'rgba(255,255,255,0.25)' : COLORS.paper2, color: isSelected ? '#fff' : COLORS.ink, border: isSelected ? '1px solid rgba(255,255,255,0.3)' : 'none', width: 48, height: 48, borderRadius: 14, fontSize: 20, cursor: 'pointer' }}>🖨️</button>
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

/* ═══════════════════════════════════════════════════════════════════════════════════
   3. ADMIN VIEW
═══════════════════════════════════════════════════════════════════════════════════ */

function AdminView({ menu, bookings, orders, markPaid, deleteOrder, setRole, inventory, addInventory, updateStock, deleteBooking, offersList, addOffer, removeOffer, loyaltyRules, setLoyaltyRules, loyaltyUsers }) {
  const [tab, setTab] = useState("overview");
  const [filterDate, setFilterDate] = useState(toLocalISODate(Date.now()));
  const [newInv, setNewInv] = useState({ name: "", stock: "", unit: "kg" });
  const [newOffer, setNewOffer] = useState({ title: "", desc: "" });
  const [newReward, setNewReward] = useState({ cost: "", item: "" });

  const filteredOrders = orders.filter(o => toLocalISODate(o.createdAt) === filterDate);
  const revenue = filteredOrders.filter((o) => o.paid).reduce((s, o) => s + o.items.reduce((a, it) => a + it.price * it.qty, 0), 0);
  const avgOrderValue = filteredOrders.length > 0 ? Math.round(filteredOrders.reduce((s, o) => s + o.items.reduce((a, it) => a + it.price * it.qty, 0), 0) / filteredOrders.length) : 0;
  const paidOrders = filteredOrders.filter(o => o.paid).length;
  const dineInOrders = filteredOrders.filter(o => o.orderType === "dine_in").length;

  const handleAddOffer = () => { if(newOffer.title) { addOffer({ id: uid("off"), title: newOffer.title, desc: newOffer.desc }); setNewOffer({ title: "", desc: "" }); } }

  const handleAddReward = () => {
    if(newReward.cost && newReward.item) {
      setLoyaltyRules({ ...loyaltyRules, rewards: [...loyaltyRules.rewards, { id: uid("rwd"), cost: Number(newReward.cost), item: newReward.item }] });
      setNewReward({ cost: "", item: "" });
    }
  }

  return (
    <div style={{ padding: "26px 20px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, alignItems: 'center' }}><div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, color: COLORS.ink, fontWeight: 800 }}>📊 Admin Dashboard</div><button onClick={() => setRole("customer")} style={{ background: COLORS.paper2, border: "none", padding: "10px 20px", borderRadius: 12, cursor: "pointer", fontWeight: 700 }}>← Exit</button></div>
      
      <div style={{ display: "flex", gap: 10, marginBottom: 28, borderBottom: `2px solid ${COLORS.line}`, overflowX: "auto", scrollbarWidth: "none" }}>
        {["overview", "offers", "loyalty", "inventory", "orders", "bookings"].map((t) => ( <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", padding: "14px 20px", marginRight: 10, fontWeight: 800, fontSize: 15, textTransform: "capitalize", color: tab === t ? COLORS.copper : COLORS.textLight, borderBottom: tab === t ? `3px solid ${COLORS.copper}` : "3px solid transparent", cursor: "pointer", whiteSpace: "nowrap" }}>{t}</button> ))}
      </div>

      {tab === "overview" && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{fontWeight: 700, fontSize: 15}}>📅 Select Date:</span>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{...inputStyle, width: 150, background: COLORS.paper}} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 28 }}>
            <StatCard label={`Orders (${filterDate})`} value={filteredOrders.length} icon="📋" color={COLORS.copper} />
            <StatCard label="Revenue (paid)" value={inr(revenue)} icon="💰" color={COLORS.sage} />
            <StatCard label="Avg Order Value" value={inr(avgOrderValue)} icon="📈" color={COLORS.gold} />
          </div>
        </>
      )}

      {/* LOYALTY MANAGER */}
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
            <thead><tr style={{ textAlign: "left", background: COLORS.paper }}><th style={th}>Customer</th><th style={th}>Phone</th><th style={th}>EatCoins 🪙</th></tr></thead>
            <tbody>
              {loyaltyUsers.sort((a,b)=>b.coins-a.coins).map((u, i) => (
                <tr key={i}><td style={td}>{u.name}</td><td style={td}>{u.phone}</td><td style={{...td, fontWeight: 800, color: COLORS.sageDark}}>{u.coins}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* OFFERS TAB */}
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

      {/* INVENTORY TAB */}
      {tab === "inventory" && (
        <div className="slide-up">
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
            <thead><tr style={{ textAlign: "left", color: COLORS.textLight, fontSize: 13, background: COLORS.paper, fontWeight: 800 }}><th style={th}>Time</th><th style={th}>Table/Type</th><th style={th}>Items</th><th style={th}>Total</th><th style={th}>Action</th></tr></thead>
            <tbody>
              {[...filteredOrders].sort((a, b) => b.createdAt - a.createdAt).map((o, idx) => (
                <tr key={o.id} style={{ background: idx % 2 === 0 ? "#fff" : COLORS.paper }}>
                  <td style={{...td, fontSize: 13, color: COLORS.textLight, fontWeight: 600}}>{new Date(o.createdAt).toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}</td>
                  <td style={td}>{o.orderType === "parcel" ? <Badge color={COLORS.copper}>Parcel</Badge> : <span style={{ fontWeight: 800, fontSize: 15 }}>T-{o.table}</span>}</td>
                  <td style={{...td, fontSize: 14, fontWeight: 500}}>
                    {o.items.map((it) => `${it.qty}×${it.name}`).join(", ")}
                    {o.claimedReward && <span style={{display: 'block', color: COLORS.sageDark, fontWeight: 800, fontSize: 12, marginTop: 4}}>🎁 Free: {o.claimedReward}</span>}
                  </td>
                  <td style={{...td, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15}}>{inr(o.items.reduce((s, it) => s + it.price * it.qty, 0))}</td>
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
            <thead><tr style={{ textAlign: "left", background: COLORS.paper }}><th style={th}>Type</th><th style={th}>Details</th><th style={th}>Date & Time</th><th style={th}>Action</th></tr></thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id}>
                  <td style={td}>{b.type === "party" ? "🎉 Party" : "🍽️ Table"}</td>
                  <td style={td}><strong>{b.name}</strong><br/>{b.phone}<br/>{b.guests} Guests</td>
                  <td style={td}>{b.date} at {b.time}</td>
                  <td style={td}><button onClick={() => deleteBooking(b.id)} style={{background: 'transparent', border: `1px solid ${COLORS.rust}`, color: COLORS.rust, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700}}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }) { 
  return <div style={{ background: "#fff", border: `1.5px solid ${COLORS.line}`, borderRadius: 18, padding: "24px 20px", transition: "all 0.3s ease", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }} className="smooth-transition hover-lift">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}><div style={{ fontSize: 13, color: COLORS.textLight, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em" }}>{label}</div><span style={{ fontSize: 28 }}>{icon}</span></div>
    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, color: color }}>{value}</div>
  </div>; 
}

/* ═══════════════════════════════════════════════════════════════════════════════════
   4. MAIN APP COMPONENT 
═══════════════════════════════════════════════════════════════════════════════════ */

export default function App() {
  const [role, setRole] = useState("customer");
  const [isDark, setIsDark] = useState(false);
  const [calls, setCalls] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [offersList, setOffersList] = useState(DEFAULT_OFFERS);

  // 🪙 LOYALTY STATE
  const [loyaltyRules, setLoyaltyRules] = useState({
    rate: 10, 
    rewards: [{ id: "r1", cost: 300, item: "Free French Fry" }]
  });
  const [loyaltyUsers, setLoyaltyUsers] = useState([
    { phone: "9876543210", name: "Demo User", coins: 350 }
  ]);

  const [table, setTable] = useState(() => { const params = new URLSearchParams(window.location.search); return params.has("table") ? Number(params.get("table")) : 1; });
  const [menu, setMenuState] = useState(DEFAULT_MENU);
  const [orders, setOrdersState] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState({ heroImage: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80", adminPin: "9876", staffPin: "5432" });
  const [ready, setReady] = useState(true);

  const deleteBooking = async (id) => { if(window.confirm("Delete this booking?")) setBookings(bookings.filter(b=>b.id!==id)); };
  const addInventory = async (item) => { setInventory([...inventory, item]); };
  const updateStock = async (id, newStock) => { setInventory(inventory.map(i=>i.id===id?{...i,stock:newStock}:i)); };
  const requestWaiter = async (tbl) => { setCalls([...calls, { id: uid("call"), table: tbl, time: Date.now(), status: "active" }]); };
  const resolveCall = async (id) => { setCalls(calls.filter(c=>c.id!==id)); };
  
  const addOffer = async (off) => { setOffersList([...offersList, off]); };
  const removeOffer = async (id) => { setOffersList(offersList.filter(o=>o.id!==id)); };

  const placeOrder = async (order) => { 
    setOrdersState([...orders, order]);
    
    // ✨ EATCOIN BALANCE UPDATE LOGIC
    if(order.customer.phone && order.customer.phone.length >= 10) {
       const netCoins = order.earnedCoins - (order.rewardUsedCoins || 0);
       const existingUserIndex = loyaltyUsers.findIndex(u => u.phone === order.customer.phone);
       if(existingUserIndex >= 0) {
          const newArr = [...loyaltyUsers];
          newArr[existingUserIndex].coins = Math.max(0, newArr[existingUserIndex].coins + netCoins);
          newArr[existingUserIndex].name = order.customer.name || newArr[existingUserIndex].name;
          setLoyaltyUsers(newArr);
       } else if (netCoins > 0) {
          setLoyaltyUsers([...loyaltyUsers, { phone: order.customer.phone, name: order.customer.name, coins: netCoins }]);
       }
    }

    // 📦 INVENTORY AUTO-DEDUCT
    order.items.forEach(cartItem => {
      const itemName = cartItem.name.toLowerCase();
      let newInv = [...inventory];
      newInv = newInv.map(inv => {
        if (itemName.includes(inv.name.toLowerCase())) {
          const deductAmt = inv.unit === 'pcs' ? 1 : 0.2;
          return {...inv, stock: Math.max(0, inv.stock - (deductAmt * cartItem.qty))};
        }
        return inv;
      });
      setInventory(newInv);
    });
  };

  const advanceStatus = async (orderId, currentStatus) => { const idx = STATUS_FLOW.indexOf(currentStatus); const nextStatus = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)]; setOrdersState(orders.map(o=>o.id===orderId?{...o,status:nextStatus}:o)); };
  const markPaid = async (orderId, paid) => { setOrdersState(orders.map(o=>o.id===orderId?{...o,paid}:o)); };
  const bookEvent = async (booking) => { setBookings([...bookings, booking]); };

  if (!ready) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.paper, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>Loading menu...</div>;

  return (
    <div className={isDark ? "dark-theme" : ""} style={{ minHeight: "100vh", background: "var(--bg-color, #FAFAF8)", color: COLORS.ink, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{FONTS}</style>
      <div className="app-content">
        {role === "customer" && <CustomerView menu={menu} orders={orders} placeOrder={placeOrder} bookEvent={bookEvent} offersList={offersList} table={table} setTable={setTable} setRole={setRole} settings={settings} isDark={isDark} setIsDark={setIsDark} requestWaiter={requestWaiter} loyaltyRules={loyaltyRules} loyaltyUsers={loyaltyUsers} />}
        {role === "staff" && <StaffView orders={orders} advanceStatus={advanceStatus} setRole={setRole} handlePrint={() => {}} calls={calls} resolveCall={resolveCall} />}
        {role === "admin" && <AdminView menu={menu} bookings={bookings} orders={orders} markPaid={markPaid} setRole={setRole} inventory={inventory} addInventory={addInventory} updateStock={updateStock} deleteBooking={deleteBooking} offersList={offersList} addOffer={addOffer} removeOffer={removeOffer} loyaltyRules={loyaltyRules} setLoyaltyRules={setLoyaltyRules} loyaltyUsers={loyaltyUsers} />}
      </div>
    </div>
  );
}