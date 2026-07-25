import React, { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";

/* ═══════════════════════════════════════════════════════════════════════════════════
   🍽️ EAT & PARK RESTAURANT — ENTERPRISE V3.0
   ✨ NEW: Smart Inventory Auto-Deduct | Waiter Call | Voice Search | Dark Mode
═══════════════════════════════════════════════════════════════════════════════════ */

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
@keyframes flash { 0% { background-color: #E25938; } 50% { background-color: #C1442D; } 100% { background-color: #E25938; } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes slideRight { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes toastSlide { 0% { transform: translate(-50%, 100px); opacity: 0; } 10% { transform: translate(-50%, 0); opacity: 1; } 90% { transform: translate(-50%, 0); opacity: 1; } 100% { transform: translate(-50%, 100px); opacity: 0; } }
@keyframes scaleInBounce { 0% { transform: scale(0.3); opacity: 0; } 50% { opacity: 1; } 100% { transform: scale(1); opacity: 1; } }

.flash-banner { animation: flash 2s infinite; }
.slide-up { animation: slideUp 0.4s ease-out; }
.slide-right { animation: slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-anim { animation: toastSlide 3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.smooth-transition { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.hover-lift:hover { transform: translateY(-3px); box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12) !important; }
.scale-bounce { animation: scaleInBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }

/* ✨ VIP Dark Mode Magic ✨ */
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
  success: "#10B981", error: "#EF4444",
};

const RESTAURANT = {
  name: "Eat & Park", tagline: "A Premium Family Restaurant",
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
  else if (category.includes("Paneer")) img = "https://images.unsplash.com/photo-1631452180519-c014fe946bc0?auto=format&fit=crop&w=400&q=80";
  else if (category.includes("Biryani") || category.includes("Pulao")) img = "https://images.unsplash.com/photo-1589302168068-964664d93cb0?auto=format&fit=crop&w=400&q=80";
  else if (category.includes("Chicken") || category.includes("Mutton")) img = "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=80";
  return { id, name, desc: desc || "Premium quality ingredients.", price, category, veg, available, image: img, portion: portion || "", isBestseller };
}

const DEFAULT_MENU = [
  mi("d1", "Mint Mojito", 90, "Drinks", true, "", "", true), mi("d9", "Cold Coffee", 120, "Drinks", true, "", "", true),
  mi("f2", "Eat & Park Special Pizza", 280, "Fun Food", true, "", "", true), mi("f9", "Eat & Park Chicken Roll", 150, "Fun Food", false),
  mi("cs1", "Paneer Chilli", 240, "Chinese Starter", true, "", "Dry/Gravy", true), mi("cs8", "Chicken Chilli", 240, "Chinese Starter", false, "", "", true),
  mi("t1", "Paneer Tikka", 299, "Tandoori", true, "", "", true), mi("mg1", "Tandoori Chicken", 450, "Mughlai", false),
  mi("pn1", "Paneer Masala", 250, "Paneer & Mushroom", true), mi("nv8", "Chicken Butter Masala", 350, "Chicken, Mutton, Fish & Egg", false, "", "", true),
  mi("br5", "Chicken Biryani", 210, "Biryani & Thali", false, "", "", true), mi("nv12", "Mutton Handi", 650, "Chicken, Mutton, Fish & Egg", false, "500g", true)
];

const STATUS_FLOW = ["new", "preparing", "ready", "served"];
const STATUS_LABEL = { new: "New", preparing: "Preparing", ready: "Ready", served: "Served" };
const STATUS_COLOR = { new: COLORS.rust, preparing: COLORS.copper, ready: COLORS.sage, served: "#8A8375" };

function inr(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 8); }
function timeAgo(ts) { const s = Math.floor((Date.now() - ts)/1000); if (s < 60) return s + "s ago"; const m = Math.floor(s/60); if (m < 60) return m + "m ago"; return Math.floor(m/60) + "h ago"; }
function toLocalISODate(timestamp) { const d = new Date(timestamp); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; }

const primaryBtn = { background: COLORS.copper, color: "#fff", border: "none", borderRadius: 14, padding: "13px 20px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.3s ease", boxShadow: "0 4px 12px rgba(226,89,56,0.2)" };
const inputStyle = { padding: "12px 16px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", width: "100%", boxSizing: "border-box", transition: "all 0.2s ease" };
const th = { padding: "12px 14px", borderBottom: `2px solid ${COLORS.line}` }; const td = { padding: "12px 14px", borderBottom: `1px solid ${COLORS.line}` };

function VegDot({ veg }) { const c = veg ? VEG : NONVEG; return <span style={{ width: 14, height: 14, border: `1.5px solid ${c}`, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} /></span>; }

/* =========================================================
   1. ENHANCED CUSTOMER VIEW 
========================================================= */
function CustomerView({ menu, orders, placeOrder, bookEvent, table, setTable, setRole, promo, settings, handlePrint, requestWaiter, isDark, setIsDark }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeModal, setActiveModal] = useState(null); 
  const [myOrderIds, setMyOrderIds] = useState([]); 
  const [orderType, setOrderType] = useState("dine_in");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState(null);

  const filteredItems = (searchQuery.trim() ? menu : menu.filter((m) => m.category === category)).filter((m) => {
    if (searchQuery.trim()) return m.name.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const cartCount = cartItems.reduce((s, [, q]) => s + q, 0);
  const cartTotal = cartItems.reduce((s, [id, q]) => { const item = menu.find((m) => m.id === id); return s + (item ? item.price * q : 0); }, 0);
  const setQty = (id, q) => setCart((c) => ({ ...c, [id]: q }));

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // 🎙️ Voice Search Logic
  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.onstart = () => showToast("🎙️ Listening... Please speak.");
      recognition.onresult = (e) => setSearchQuery(e.results[0][0].transcript);
      recognition.start();
    } else { showToast("⚠️ Voice search not supported in this browser"); }
  };

  async function handlePlaceOrder() {
    if (cartItems.length === 0) return;
    if (!custName.trim() || !custPhone.trim()) { showToast("⚠️ Please enter Name & Phone"); return; }
    const order = { id: uid("o"), table, orderType, customer: { name: custName, phone: custPhone }, items: cartItems.map(([id, qty]) => { const m = menu.find((mi) => mi.id === id); return { itemId: id, name: m.name, price: m.price, qty }; }), payment: "cash", status: "new", paid: false, createdAt: Date.now() };
    await placeOrder(order);
    setMyOrderIds([...myOrderIds, order.id]); setCart({}); setCartOpen(false); setActiveModal('track'); 
    showToast("🎉 Order Placed Successfully!");
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: cartCount ? 100 : 40, background: "var(--bg, #fff)", minHeight: "100vh", position: "relative" }}>
      
      {/* 🔔 Floating Waiter Call Button */}
      <button onClick={() => {requestWaiter(table); showToast("🔔 Waiter has been notified!");}} style={{ position: "fixed", top: 20, right: 20, background: COLORS.rust, color: "#fff", border: "none", borderRadius: 20, padding: "10px 16px", fontWeight: 800, fontSize: 14, zIndex: 50, boxShadow: "0 8px 24px rgba(192,57,43,0.4)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }} className="hover-lift scale-bounce">
        🔔 Call Waiter
      </button>

      {/* ☰ Top-Left Menu Button */}
      {!cartOpen && !activeModal && (
        <button onClick={() => setShowSidebar(true)} style={{ position: "fixed", top: 20, left: 20, background: COLORS.ink, color: "#fff", border: "none", borderRadius: "50%", width: 50, height: 50, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", cursor: "pointer", zIndex: 50, fontSize: 20 }} className="hover-lift keep-color">☰</button>
      )}

      {/* Hero Section */}
      <div style={{ position: "relative", height: 260, borderRadius: "0 0 28px 28px", overflow: "hidden", marginBottom: 16 }}>
        <img src={settings?.heroImage || "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80"} alt="Hero" className="keep-color" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,26,26,0.95) 0%, rgba(26,26,26,0.3) 100%)" }} className="keep-color" />
        <div style={{ position: "absolute", bottom: 20, left: 20, right: 20 }} className="keep-color">
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 36, color: "#fff", margin: "0 0 4px", fontWeight: 800 }}>{RESTAURANT.name}</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", margin: 0, fontSize: 14 }}>{RESTAURANT.tagline}</p>
        </div>
      </div>

      {/* Search & Mic */}
      <div style={{ padding: "0 20px 16px" }}>
        <div style={{ position: "relative", display: 'flex', gap: 10 }}>
          <div style={{position: 'relative', flex: 1}}>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search dishes..." style={{...inputStyle, paddingLeft: 40, paddingRight: 40}} />
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18 }}>🔍</span>
            <button onClick={handleVoiceSearch} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: COLORS.paper2, border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 16 }}>🎙️</button>
          </div>
        </div>
      </div>

      {/* Categories */}
      {!searchQuery && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 20px 16px", scrollbarWidth: "none" }}>
          {CATEGORIES.map((c) => ( <button key={c} onClick={() => setCategory(c)} style={{ whiteSpace: "nowrap", padding: "10px 16px", borderRadius: 12, border: `1.5px solid ${category === c ? COLORS.copper : COLORS.line}`, background: category === c ? COLORS.copper : "transparent", color: category === c ? "#fff" : COLORS.ink, fontWeight: 700, cursor: "pointer" }}>{c}</button> ))}
        </div>
      )}

      {/* Menu List */}
      <div style={{ padding: "0 20px" }}>
        {filteredItems.map((item) => (
          <div key={item.id} style={{ display: "flex", gap: 16, padding: "20px 0", borderBottom: `1px solid ${COLORS.line}` }}>
            <div style={{ flex: 1 }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8}}><VegDot veg={item.veg}/> {item.isBestseller && <span style={{fontSize: 10, background: COLORS.copperLight, color: COLORS.copperDark, padding: "3px 6px", borderRadius: 4, fontWeight: 800}}>🔥 Bestseller</span>}</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{item.name}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: COLORS.copper, fontWeight: 800 }}>{inr(item.price)}</div>
            </div>
            <div style={{ position: "relative", width: 110, height: 110 }}>
              <img src={item.image} alt={item.name} className="keep-color" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} />
              <div style={{ position: "absolute", bottom: -14, left: "50%", transform: "translateX(-50%)" }}>
                <div style={{ display: "flex", alignItems: "center", background: "#fff", border: `2px solid ${COLORS.sage}`, borderRadius: 10, overflow: 'hidden', height: 32, width: 85, boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
                  {!cart[item.id] ? (
                    <button onClick={() => setQty(item.id, 1)} style={{width: '100%', background: 'transparent', border: 'none', color: COLORS.sage, fontWeight: 800, cursor: 'pointer'}}>ADD</button>
                  ) : (
                    <>
                      <button onClick={() => setQty(item.id, cart[item.id]-1)} style={{flex: 1, border: 'none', background: 'transparent', color: COLORS.sage, fontSize: 18, fontWeight: 800, cursor: 'pointer'}}>-</button>
                      <span style={{fontWeight: 800, color: COLORS.sage}}>{cart[item.id]}</span>
                      <button onClick={() => setQty(item.id, cart[item.id]+1)} style={{flex: 1, border: 'none', background: 'transparent', color: COLORS.sage, fontSize: 18, fontWeight: 800, cursor: 'pointer'}}>+</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && !cartOpen && !activeModal && (
        <button onClick={() => setCartOpen(true)} style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 40px)", maxWidth: 400, background: COLORS.sage, color: "#fff", border: "none", borderRadius: 18, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, fontSize: 16, cursor: "pointer", zIndex: 5, boxShadow: "0 12px 28px rgba(74,124,89,0.35)" }} className="hover-lift">
          <span>{cartCount} items</span><span>{inr(cartTotal)} ➔</span>
        </button>
      )}

      {/* Sidebar with Dark Mode VIP Toggle */}
      {showSidebar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex" }}>
          <div style={{ width: "80%", maxWidth: 320, background: "#fff", height: "100%", padding: "24px", display: "flex", flexDirection: "column" }} className="slide-right">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 30 }}><h2 style={{margin:0, color: COLORS.copper}}>Eat & Park</h2><button onClick={() => setShowSidebar(false)} style={{background:'none', border:'none', fontSize:24}}>✕</button></div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
              <button onClick={() => {setShowSidebar(false); setRole('staff');}} style={{padding: 14, borderRadius: 12, border: `1px solid ${COLORS.line}`, background: 'transparent', fontWeight: 700, textAlign: 'left'}}>👨‍🍳 Staff / Admin Login</button>
              {/* ✨ DARK MODE TOGGLE */}
              <button onClick={() => {setIsDark(!isDark); setShowSidebar(false); showToast(isDark ? "☀️ Light Mode Active" : "🌙 VIP Dark Mode Active");}} style={{padding: 14, borderRadius: 12, border: `none`, background: COLORS.ink, color: '#fff', fontWeight: 700, textAlign: 'left', display: 'flex', justifyContent: 'space-between'}}>
                <span>{isDark ? "☀️ Switch to Light Mode" : "🌙 VIP Dark Mode"}</span>
              </button>
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.6)" }} onClick={() => setShowSidebar(false)} />
        </div>
      )}

      {/* Cart Modal */}
      {cartOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 70 }} onClick={() => setCartOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", width: "100%", borderRadius: "24px 24px 0 0", padding: "24px", maxHeight: "80vh", overflowY: "auto" }} className="slide-up">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}><h2 style={{margin:0}}>Checkout</h2><button onClick={() => setCartOpen(false)} style={{background:'none', border:'none', fontSize:20}}>✕</button></div>
            
            <input type="text" placeholder="Your Name" value={custName} onChange={(e) => setCustName(e.target.value)} style={{...inputStyle, marginBottom: 12}} />
            <input type="tel" placeholder="Phone Number" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} style={{...inputStyle, marginBottom: 24}} />
            
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 20, marginBottom: 20 }}><span>Total:</span><span style={{ color: COLORS.copper }}>{inr(cartTotal)}</span></div>
            <button onClick={handlePlaceOrder} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 16, padding: "16px", fontWeight: 800, fontSize: 16, width: "100%" }}>🎉 Place Order</button>
          </div>
        </div>
      )}

      {toast && <div className="toast-anim" style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', background: COLORS.ink, color: '#fff', padding: '14px 24px', borderRadius: 30, zIndex: 100, fontWeight: 700 }}>{toast}</div>}
    </div>
  );
}

/* =========================================================
   2. STAFF VIEW (With Waiter Calls)
========================================================= */
function StaffView({ orders, calls, resolveCall, advanceStatus, setRole }) {
  const activeOrders = orders.filter((o) => o.status !== "served").sort((a, b) => a.createdAt - b.createdAt);
  const activeCalls = calls.filter(c => c.status === 'active');

  return (
    <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{margin:0, fontFamily: "'Outfit', sans-serif"}}>🍳 Kitchen & Staff Board</h1>
        <button onClick={() => setRole("admin")} style={{...primaryBtn, background: COLORS.ink}}>⚙️ Admin Panel</button>
      </div>

      {/* 🔔 Active Waiter Calls Alert */}
      {activeCalls.length > 0 && (
        <div style={{ background: "rgba(239, 68, 68, 0.1)", border: `2px solid ${COLORS.error}`, borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <h3 style={{ color: COLORS.error, margin: "0 0 12px 0", display: 'flex', alignItems: 'center', gap: 8 }}>🚨 Waiter Requested!</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {activeCalls.map(c => (
              <div key={c.id} style={{ background: '#fff', padding: "12px 16px", borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>Table {c.table}</span>
                <span style={{ fontSize: 12, color: COLORS.textLight }}>{timeAgo(c.time)}</span>
                <button onClick={() => resolveCall(c.id)} style={{ background: COLORS.success, color: '#fff', border: 'none', padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>✓ Resolved</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders Board */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {["new", "preparing", "ready"].map((status) => {
          const list = activeOrders.filter((o) => o.status === status);
          return (
            <div key={status} style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 20 }}>
              <h3 style={{ textTransform: "uppercase", color: STATUS_COLOR[status], margin: "0 0 16px 0" }}>{STATUS_LABEL[status]} ({list.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {list.map((o) => (
                  <div key={o.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontWeight: 800, fontSize: 18 }}>
                      <span>{o.orderType === "parcel" ? "🛍️ PARCEL" : `🍽️ Table ${o.table}`}</span>
                      <span style={{fontSize: 12, color: COLORS.textLight}}>{timeAgo(o.createdAt)}</span>
                    </div>
                    <div style={{ borderTop: `1px dashed ${COLORS.line}`, paddingTop: 12, marginBottom: 16 }}>
                      {o.items.map((it) => ( <div key={it.itemId} style={{ fontWeight: 600, marginBottom: 6 }}>{it.qty}× {it.name}</div> ))}
                    </div>
                    <button onClick={() => advanceStatus(o.id, status)} style={{ ...primaryBtn, width: '100%', background: STATUS_COLOR[status] }}>
                      {status === 'new' ? 'Start Preparing' : status === 'preparing' ? 'Mark Ready' : 'Mark Served'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   3. ADMIN VIEW (With Inventory & Delete Bookings)
========================================================= */
function AdminView({ menu, bookings, inventory, deleteBooking, addInventory, updateStock, orders, setRole }) {
  const [tab, setTab] = useState("overview");
  const [newInv, setNewInv] = useState({ name: "", stock: "", unit: "kg" });

  const handleAddInv = () => {
    if(newInv.name && newInv.stock) {
      addInventory({ id: uid("inv"), name: newInv.name, stock: Number(newInv.stock), unit: newInv.unit });
      setNewInv({ name: "", stock: "", unit: "kg" });
    }
  }

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{margin:0, fontFamily: "'Outfit', sans-serif"}}>📊 Admin Dashboard</h1>
        <button onClick={() => setRole("customer")} style={{...primaryBtn, background: COLORS.paper2, color: COLORS.ink}}>← Exit</button>
      </div>
      
      <div style={{ display: "flex", gap: 10, marginBottom: 24, borderBottom: `2px solid ${COLORS.line}`, overflowX: "auto" }}>
        {["overview", "inventory", "bookings"].map((t) => ( <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", padding: "12px 20px", fontWeight: 800, fontSize: 15, textTransform: "capitalize", color: tab === t ? COLORS.copper : COLORS.textLight, borderBottom: tab === t ? `3px solid ${COLORS.copper}` : "3px solid transparent", cursor: "pointer" }}>{t}</button> ))}
      </div>

      {tab === "overview" && <h3>Today's Total Orders: {orders.length}</h3>}

      {/* 📦 INVENTORY TAB */}
      {tab === "inventory" && (
        <div>
          <div style={{ background: COLORS.paper, padding: 24, borderRadius: 16, marginBottom: 24, border: `1px solid ${COLORS.line}` }}>
            <h3 style={{margin: "0 0 16px 0"}}>Add Raw Material (Daily Feed)</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <input type="text" placeholder="Item Name (e.g., Paneer, Chicken)" value={newInv.name} onChange={e=>setNewInv({...newInv, name: e.target.value})} style={{...inputStyle, flex: 2}} />
              <input type="number" placeholder="Qty" value={newInv.stock} onChange={e=>setNewInv({...newInv, stock: e.target.value})} style={{...inputStyle, flex: 1}} />
              <select value={newInv.unit} onChange={e=>setNewInv({...newInv, unit: e.target.value})} style={{...inputStyle, flex: 1}}>
                <option value="kg">KG</option><option value="liters">Liters</option><option value="pcs">Pieces</option>
              </select>
              <button onClick={handleAddInv} style={{...primaryBtn, flex: 1}}>Add Stock</button>
            </div>
            <p style={{fontSize: 12, color: COLORS.sage, marginTop: 12}}>* Magic Auto-Deduct is active! Orders containing these names will automatically reduce stock.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
            {inventory.map(inv => (
              <div key={inv.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, padding: 16, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{fontWeight: 800, fontSize: 16}}>{inv.name}</div>
                  <div style={{color: inv.stock < 2 ? COLORS.error : COLORS.textLight, fontWeight: 700}}>{inv.stock.toFixed(2)} {inv.unit} left</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => updateStock(inv.id, inv.stock - 1)} style={{width: 32, height: 32, borderRadius: 8, border: 'none', background: COLORS.paper2, cursor: 'pointer', fontWeight: 800}}>-</button>
                  <button onClick={() => updateStock(inv.id, inv.stock + 1)} style={{width: 32, height: 32, borderRadius: 8, border: 'none', background: COLORS.sageLight, color: COLORS.sageDark, cursor: 'pointer', fontWeight: 800}}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📅 BOOKINGS TAB WITH DELETE OPTION */}
      {tab === "bookings" && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, background: "#fff", borderRadius: 16, overflow: 'hidden' }}>
          <thead><tr style={{ textAlign: "left", background: COLORS.paper, fontWeight: 800 }}><th style={th}>Date</th><th style={th}>Name</th><th style={th}>Type</th><th style={th}>Action</th></tr></thead>
          <tbody>
            {bookings.length === 0 ? <tr><td colSpan="4" style={{padding: 20, textAlign: 'center'}}>No bookings.</td></tr> : bookings.map((b) => (
              <tr key={b.id}>
                <td style={td}>{b.date} {b.time}</td><td style={{...td, fontWeight: 800}}>{b.name} ({b.phone})</td><td style={td}>{b.type}</td>
                <td style={td}><button onClick={() => deleteBooking(b.id)} style={{background: 'transparent', border: `1px solid ${COLORS.error}`, color: COLORS.error, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700}}>🗑️ Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* =========================================================
   MAIN APP SHELL (Handles Magic Auto-Deduct)
========================================================= */
export default function App() {
  const [role, setRole] = useState("customer");
  const [isDark, setIsDark] = useState(false); // VIP Dark Mode State
  const [table, setTable] = useState(1);
  const [menu, setMenuState] = useState(DEFAULT_MENU);
  const [orders, setOrdersState] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [calls, setCalls] = useState([]); // Waiter Calls State
  const [inventory, setInventory] = useState([]); // Inventory State

  useEffect(() => {
    // Simulated Firebase Listeners for Demo (In real app, use onSnapshot)
    // For this exact single-file structure, I am using local state simulated updates.
    // In actual Firebase, you will replace these with onSnapshot(collection(db, 'inventory')) etc.
  }, []);

  // ✨ Auto-Deduct Logic!
  const placeOrder = async (order) => {
    setOrdersState([...orders, order]);
    
    // Magic Deduction
    let updatedInv = [...inventory];
    order.items.forEach(cartItem => {
      const itemName = cartItem.name.toLowerCase();
      updatedInv = updatedInv.map(inv => {
        if(itemName.includes(inv.name.toLowerCase())) {
           // Default deduct: 0.2 units per portion for raw materials (kg/liters), 1 for pcs
           const deductAmt = inv.unit === 'pcs' ? 1 : 0.2; 
           return { ...inv, stock: Math.max(0, inv.stock - (deductAmt * cartItem.qty)) };
        }
        return inv;
      });
    });
    setInventory(updatedInv);
  };

  const advanceStatus = (id, currentStatus) => {
    const idx = STATUS_FLOW.indexOf(currentStatus);
    const nextStatus = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    setOrdersState(orders.map(o => o.id === id ? { ...o, status: nextStatus } : o));
  };

  // Waiter & Bookings Functions
  const requestWaiter = (tbl) => setCalls([...calls, { id: uid('call'), table: tbl, time: Date.now(), status: 'active' }]);
  const resolveCall = (id) => setCalls(calls.filter(c => c.id !== id));
  const bookEvent = (b) => setBookings([...bookings, b]);
  const deleteBooking = (id) => { if(window.confirm("Delete booking?")) setBookings(bookings.filter(b => b.id !== id)); };

  // Inventory Functions
  const addInventory = (item) => setInventory([...inventory, item]);
  const updateStock = (id, newStock) => setInventory(inventory.map(i => i.id === id ? {...i, stock: newStock} : i));

  return (
    <div className={isDark ? "dark-theme" : ""} style={{ minHeight: "100vh", background: "var(--bg, #FAFAF8)", color: COLORS.ink, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{FONTS}</style>
      <div className="app-content">
        {role === "customer" && <CustomerView menu={menu} orders={orders} placeOrder={placeOrder} bookEvent={bookEvent} table={table} setTable={setTable} setRole={setRole} isDark={isDark} setIsDark={setIsDark} requestWaiter={requestWaiter} />}
        {role === "staff" && <StaffView orders={orders} calls={calls} resolveCall={resolveCall} advanceStatus={advanceStatus} setRole={setRole} />}
        {role === "admin" && <AdminView menu={menu} bookings={bookings} deleteBooking={deleteBooking} inventory={inventory} addInventory={addInventory} updateStock={updateStock} orders={orders} setRole={setRole} />}
      </div>
    </div>
  );
}