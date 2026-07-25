import React, { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc, writeBatch, getDocs } from "firebase/firestore";

/* ---------------------------------------------------------------
   Eat & Park Restaurant — Enterprise POS 
   ✨ FIX: Advanced Login Security + Editable PINs in Settings
------------------------------------------------------------------ */

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
@keyframes flash { 0% { background-color: #E25938; } 50% { background-color: #C1442D; } 100% { background-color: #E25938; } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes slideRight { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes toastSlide { 0% { transform: translate(-50%, 100px); opacity: 0; } 10% { transform: translate(-50%, 0); opacity: 1; } 90% { transform: translate(-50%, 0); opacity: 1; } 100% { transform: translate(-50%, 100px); opacity: 0; } }

.flash-banner { animation: flash 2s infinite; }
.slide-up { animation: slideUp 0.4s ease-out; }
.slide-right { animation: slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-anim { animation: toastSlide 3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.smooth-transition { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1) !important; }

@media print {
  .app-content { display: none !important; }
  .print-area { display: block !important; color: #000; font-family: 'IBM Plex Mono', monospace; }
  @page { margin: 0; }
  body { background: #fff; margin: 0; padding: 0; }
}
`;

const COLORS = {
  ink: "#1A1A1A", paper: "#FAFAF8", paper2: "#F0EFEB",
  copper: "#E25938", copperDark: "#C1442D", copperLight: "#F5E8E3",
  rust: "#C0392B", sage: "#4A7C59", sageDark: "#2F5C3F", sageLight: "#E8F0EB",
  gold: "#D4A574", line: "#E8E6DC", text: "#3C3C3C", textLight: "#8A8375",
};

const RESTAURANT = {
  name: "Eat & Park", full: "Eat & Park Restaurant", tagline: "A Premium Family Restaurant",
  address: "Girja More, Ara – Buxar Main Road, Pakri, Ara", 
  phones: ["7303267750", "8271918062"], 
  whatsapp: "917303267750", 
  upiId: "apnanumber@upi" 
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
  
  return { id, name, desc: desc || "Freshly prepared with premium ingredients and authentic spices.", price, category, veg, available, image: img, portion: portion || "", isBestseller };
}

const DEFAULT_MENU = [
  mi("d1", "Mint Mojito", 90, "Drinks", true, "Refreshing blend of fresh mint, lemon, and sparkling soda.", "", true), mi("d2", "Blue Lagoon", 90, "Drinks", true, "Tropical blue curacao cooler with a citrusy kick."), mi("d3", "Vanilla Shake", 120, "Drinks", true, "Classic thick and creamy vanilla milkshake."), mi("d4", "Chocolate Shake", 130, "Drinks", true, "Rich cocoa blended with milk and ice cream."), mi("d5", "Kitkat Oreo Shake", 150, "Drinks", true, "Ultimate crunch of KitKat and Oreo cookies."), mi("d9", "Cold Coffee", 120, "Drinks", true, "Chilled, frothy coffee perfection.", "", true), mi("d10", "Cold Drink", 50, "Drinks", true, "Chilled aerated beverage."),
  mi("f1", "Veg Burger", 90, "Fun Food", true, "Crispy veggie patty with fresh lettuce and creamy mayo."), mi("f2", "Eat & Park Special Pizza", 280, "Fun Food", true, "Loaded with exotic veggies, extra cheese and secret sauce.", "", true), mi("f3", "Veg Roll", 90, "Fun Food", true, "Spiced veggies wrapped in a soft, flaky paratha."), mi("f4", "Paneer Roll", 100, "Fun Food", true, "Tandoori paneer chunks rolled to perfection."), mi("f8", "Eat & Park Egg Roll", 100, "Fun Food", false, "Double egg wrapped with crispy onions and sauces."), mi("f9", "Eat & Park Chicken Roll", 150, "Fun Food", false, "Juicy chicken tikka wrapped in a crispy paratha."), mi("f11", "White Sauce Pasta", 180, "Fun Food", true, "Penne in a rich, creamy, and cheesy garlic sauce."), mi("f14", "Veg Sandwich", 120, "Fun Food", true, "Freshly grilled with layers of healthy veggies and cheese."), mi("f15", "Chicken Sandwich", 150, "Fun Food", false, "Grilled sandwich stuffed with creamy chicken filling."),
  mi("cs1", "Paneer Chilli", 240, "Chinese Starter", true, "Crispy paneer tossed in spicy soy and garlic sauce.", "Dry / Gravy", true), mi("cs2", "Mushroom Chilli", 250, "Chinese Starter", true, "Fresh button mushrooms in a tangy chili glaze.", "Dry / Gravy"), mi("cs3", "Veg Manchurian", 180, "Chinese Starter", true, "Vegetable dumplings in a classic dark soy gravy.", "Dry / Gravy"), mi("cs8", "Chicken Chilli", 240, "Chinese Starter", false, "Diced chicken tossed with capsicum, onion, and hot sauces.", "Dry / Gravy", true), mi("cs9", "Chicken Manchurian", 260, "Chinese Starter", false, "Minced chicken balls in sweet and savory Chinese sauce.", "Dry / Gravy"), mi("cs10", "Chicken Lollipop", 300, "Chinese Starter", false, "Crispy fried chicken wings served with hot garlic dip.", "Dry / Gravy"), 
  mi("mg1", "Tandoori Chicken", 450, "Mughlai", false, "Classic bone-in chicken marinated in yogurt and Indian spices, roasted in clay oven."), mi("mg3", "Chicken Tikka", 350, "Mughlai", false, "Boneless chicken chunks marinated in fiery spices and grilled."), 
  mi("t1", "Paneer Tikka", 299, "Tandoori", true, "Cottage cheese marinated in spices and grilled in a tandoor.", "", true), mi("t2", "Mushroom Tikka", 285, "Tandoori", true, "Juicy mushrooms roasted with smoky tandoori flavors."),
  mi("s1", "Tomato Soup", 120, "Soup", true, "Warm, creamy, and comforting fresh tomato soup."), mi("s3", "Veg Manchow Soup", 120, "Soup", true, "Spicy and thick soup topped with crispy fried noodles."), mi("s6", "Chicken Manchow Soup", 150, "Soup", false, "Rich chicken broth with veggies and crispy noodles."), 
  mi("b1", "Tandoori Roti", 15, "Indian Bread", true, "Whole wheat bread baked in a clay oven."), mi("b2", "Tandoori Butter Roti", 20, "Indian Bread", true, "Hot tandoori roti glazed with fresh butter."), mi("b6", "Plain Naan", 50, "Indian Bread", true, "Soft and fluffy refined flour Indian bread."), mi("b7", "Butter Naan", 60, "Indian Bread", true, "Classic naan generously brushed with butter."), mi("b8", "Garlic Naan", 70, "Indian Bread", true, "Naan topped with minced garlic and fresh coriander.", "", true), 
  mi("sn3", "French Fries", 100, "Snacks", true, "Crispy golden potato fries."), mi("sn5", "Crispy Chilli Potato", 160, "Snacks", true, "Fried potato fingers tossed in sweet and spicy chili sauce."), mi("sn9", "Chicken Pakoda", 200, "Snacks", false, "Crunchy batter-fried chicken bites."),
  mi("cm1", "Veg Chowmein", 130, "Chinese Mains", true, "Wok-tossed noodles with shredded vegetables."), mi("cm2", "Veg Hakka Noodles", 160, "Chinese Mains", true, "Classic non-spicy noodles tossed with veggies."), mi("cm8", "Chicken Noodles", 180, "Chinese Mains", false, "Flavorful noodles stir-fried with juicy chicken bits."), mi("cm12", "Veg Fried Rice", 170, "Chinese Mains", true, "Aromatic rice wok-tossed with fresh finely chopped veggies."), mi("cm15", "Chicken Fried Rice", 200, "Chinese Mains", false, "Classic Chinese style rice tossed with chicken and egg."), 
  mi("p2", "Jeera Rice", 110, "Pulao", true, "Basmati rice tempered with roasted cumin seeds."), mi("p3", "Veg Pulao", 180, "Pulao", true, "Fragrant rice cooked with mixed vegetables and whole spices."), 
  mi("pn1", "Paneer Masala", 250, "Paneer & Mushroom", true, "Paneer cooked in a rich onion-tomato spiced gravy."), mi("pn4", "Paneer Karahi", 260, "Paneer & Mushroom", true, "Cottage cheese and bell peppers cooked in a traditional iron wok."), mi("pn6", "Paneer Butter Masala", 260, "Paneer & Mushroom", true, "Soft paneer in a creamy, slightly sweet makhani gravy."), mi("pn16", "Mushroom Masala", 250, "Paneer & Mushroom", true, "Earthy mushrooms in a robust and spicy masala."), mi("pn17", "Mushroom Karahi", 260, "Paneer & Mushroom", true, "Mushrooms and diced capsicum tossed in kadhai spices."), 
  mi("nv1", "Chicken Dehati", 550, "Chicken, Mutton, Fish & Egg", false, "Spicy, homestyle rustic chicken curry with bold flavors."), mi("nv2", "Chicken Curry", 280, "Chicken, Mutton, Fish & Egg", false, "Classic, comforting Indian style chicken curry."), mi("nv6", "Chicken Do Pyaza", 280, "Chicken, Mutton, Fish & Egg", false, "Chicken cooked with a generous amount of crunchy onions."), mi("nv8", "Chicken Butter Masala", 350, "Chicken, Mutton, Fish & Egg", false, "Tandoori chicken pieces in a rich, buttery tomato gravy.", "", true), mi("nv10", "Mutton Curry", 340, "Chicken, Mutton, Fish & Egg", false, "Tender mutton slow-cooked in traditional Indian spices."), mi("nv12", "Mutton Handi", 650, "Chicken, Mutton, Fish & Egg", false, "Mutton cooked slowly in a sealed earthen pot for rich aroma.", "500g", true), mi("nv13", "Mutton Handi", 1200, "Chicken, Mutton, Fish & Egg", false, "Mutton cooked slowly in a sealed earthen pot for rich aroma.", "1 Kg"), mi("nv15", "Mutton Dehati", 440, "Chicken, Mutton, Fish & Egg", false, "Village style spicy and robust mutton preparation."), mi("nv16", "Mutton Ahuna", 1250, "Chicken, Mutton, Fish & Egg", false, "Champaran special whole garlic and mutton cooked in a clay pot."), mi("nv19", "Fish Curry", 120, "Chicken, Mutton, Fish & Egg", false, "Homestyle fish cooked in a tangy mustard and tomato gravy.", "Small"), mi("nv20", "Fish Curry", 220, "Chicken, Mutton, Fish & Egg", false, "Homestyle fish cooked in a tangy mustard and tomato gravy.", "Large"), mi("nv25", "Egg Curry", 200, "Chicken, Mutton, Fish & Egg", false, "Boiled eggs simmered in a flavorful spiced gravy.", "4 pc"), 
  mi("br1", "Veg Biryani", 180, "Biryani & Thali", true, "Aromatic basmati rice layered with spiced vegetables."), mi("br5", "Chicken Biryani", 210, "Biryani & Thali", false, "Classic fragrant rice and chicken cooked with dum technique.", "", true), mi("br12", "Mutton Biryani", 280, "Biryani & Thali", false, "Rich, royal biryani made with succulent mutton pieces."), mi("br15", "Veg Thali", 250, "Biryani & Thali", true, "A complete meal platter with flatbreads, rice, sides, and curries.", "2 Roti, Half Rice, Manchurian, Paneer, Salad, Aachar, Dal"), mi("br16", "Non Veg Thali", 280, "Biryani & Thali", false, "Hearty non-veg platter for a fulfilling meal experience.", "2 Roti, Half Rice, Chicken, Salad, Aachar"),
  mi("al10", "Dal Fry", 70, "Aloo, Dal & Sides", true, "Yellow lentils tempered with cumin and garlic."), mi("al11", "Dal Tadka", 100, "Aloo, Dal & Sides", true, "Dhaba-style dal with a smoky double tadka of ghee and spices."), mi("al14", "Veg Raita", 60, "Aloo, Dal & Sides", true, "Cooling yogurt mixed with finely chopped cucumber and onions."), mi("al15", "Green Salad", 80, "Aloo, Dal & Sides", true, "Fresh slices of cucumber, tomato, onion, and carrots."), 
  mi("mo1", "Veg Momo", 80, "Momo", true, "Steamed dumplings filled with finely minced vegetables.", "Steam"), mi("mo2", "Veg Momo", 100, "Momo", true, "Crispy fried vegetable dumplings.", "Fry"), mi("mo11", "Chicken Momo", 150, "Momo", false, "Steamed dumplings stuffed with juicy minced chicken.", "Steam"), mi("mo12", "Chicken Momo", 160, "Momo", false, "Golden fried chicken dumplings.", "Fry")
];

const STATUS_FLOW = ["new", "preparing", "ready", "served"];
const STATUS_LABEL = { new: "New", preparing: "Preparing", ready: "Ready", served: "Served" };
const STATUS_COLOR = { new: COLORS.rust, preparing: COLORS.copper, ready: COLORS.sage, served: "#8A8375" };

function inr(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 8); }
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + "s ago"; const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago"; return Math.floor(m / 60) + "h ago";
}
function toLocalISODate(timestamp) {
  const d = new Date(timestamp);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

const primaryBtn = { background: COLORS.copper, color: "#fff", border: "none", borderRadius: 12, padding: "13px 20px", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.3s ease" };
const th = { padding: "10px 12px", borderBottom: `2px solid ${COLORS.line}` }; const td = { padding: "10px 12px", borderBottom: `1px solid ${COLORS.line}` };
const inputStyle = { padding: "12px 14px", border: `1.5px solid ${COLORS.line}`, borderRadius: 10, fontSize: 14, fontFamily: "Inter, sans-serif", width: "100%", boxSizing: "border-box", transition: "all 0.2s ease" };

/* ✨ UI COMPONENTS ✨ */
function Badge({ children, color }) { return <span style={{ background: color, color: "#fff", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 999, fontWeight: 600, display: "inline-block" }}>{children}</span>; }
function VegDot({ veg }) { const c = veg ? VEG : NONVEG; return <span style={{ width: 14, height: 14, border: `1.5px solid ${c}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 3 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} /></span>; }
const stepBtnStyle = { width: 28, height: 28, borderRadius: "50%", border: `1px solid ${COLORS.copper}`, background: "transparent", color: COLORS.copper, fontSize: 16, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" };
function Stepper({ qty, onChange }) { return <div style={{ display: "flex", alignItems: "center", gap: 10 }}><button onClick={() => onChange(Math.max(0, qty - 1))} style={stepBtnStyle} className="smooth-transition">−</button><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, minWidth: 16, textAlign: "center" }}>{qty}</span><button onClick={() => onChange(qty + 1)} style={stepBtnStyle} className="smooth-transition">+</button></div>; }

function AddBtnStepper({ qty, onChange, available }) {
  if (!available) return <div style={{ color: COLORS.rust, background: COLORS.paper2, borderRadius: 8, fontWeight: 700, fontSize: 11, padding: "8px 12px", textAlign: "center", width: 90, boxSizing: "border-box" }}>Out of stock</div>;
  if (!qty) return <button onClick={() => onChange(1)} style={{ color: COLORS.sage, background: "#fff", border: `1.5px solid ${COLORS.sage}`, borderRadius: 8, fontWeight: 800, fontSize: 13, padding: "8px 20px", cursor: "pointer", width: 90, boxShadow: "0 2px 8px rgba(74,124,89,0.12)" }} className="smooth-transition hover-lift">ADD</button>;
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: 90, padding: "4px", background: "#fff", border: `1.5px solid ${COLORS.sage}`, borderRadius: 8, boxShadow: "0 2px 8px rgba(74,124,89,0.12)" }}><button onClick={() => onChange(Math.max(0, qty - 1))} style={{...stepBtnStyle, width: 24, height: 24, border: "none", color: COLORS.sage}} className="smooth-transition">−</button><span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, color: COLORS.sage }}>{qty}</span><button onClick={() => onChange(qty + 1)} style={{...stepBtnStyle, width: 24, height: 24, border: "none", color: COLORS.sage}} className="smooth-transition">+</button></div>;
}

function SearchBar({ value, onChange, placeholder = "Search menu..." }) {
  return (
    <div style={{ position: "relative", flex: 1 }}>
      <input type="text" value={value} onChange={onChange} placeholder={placeholder} style={{...inputStyle, paddingLeft: 40}} onFocus={(e) => { e.target.style.borderColor = COLORS.copper; }} onBlur={(e) => { e.target.style.borderColor = COLORS.line; }} />
      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: COLORS.textLight }}>🔍</span>
      {value && ( <button onClick={() => onChange({ target: { value: "" } })} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: COLORS.textLight, padding: "4px 8px" }}>✕</button> )}
    </div>
  );
}

function SlideButton({ onComplete, text, bg = COLORS.sage }) {
  const [val, setVal] = useState(0);
  return (
    <div style={{position: 'relative', width: '100%', height: 44, background: COLORS.paper2, borderRadius: 12, overflow: 'hidden', border: `1px solid ${COLORS.line}`}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${val}%`, background: bg, transition: val === 0 ? 'width 0.3s' : 'none'}} />
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: val > 50 ? '#fff' : COLORS.text, pointerEvents: 'none', zIndex: 2}}>
        {text} <span style={{marginLeft: 8, fontSize: 16}}>»</span>
      </div>
      <input type="range" min="0" max="100" value={val} 
        onChange={(e) => setVal(Number(e.target.value))} 
        onMouseUp={(e) => { if(val > 85) onComplete(); setVal(0); }} 
        onTouchEnd={(e) => { if(val > 85) onComplete(); setVal(0); }} 
        style={{opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute', top: 0, left: 0, zIndex: 3}} 
      />
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  return <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 16 }}><div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600 }}>{title}</div><button onClick={onClose} style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 18 }} className="smooth-transition">✕</button></div>;
}

/* =========================================================
   1. CUSTOMER VIEW 
========================================================= */
function CustomerView({ menu, orders, placeOrder, bookEvent, gallery, table, setTable, setRole, promo, settings, installApp, handlePrint }) {
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

  const [bookType, setBookType] = useState("table");
  const [bookData, setBookData] = useState({ name: "", phone: "", date: "", time: "", guests: "" });
  
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // ✨ FIX: Secure PIN Login States
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pinInput, setPinInput] = useState("");

  const filteredItems = (searchQuery.trim() ? menu : menu.filter((m) => m.category === category)).filter((m) => {
    if (vegOnly && !m.veg) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q);
    }
    return true;
  });

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const cartCount = cartItems.reduce((s, [, q]) => s + q, 0);
  const cartTotal = cartItems.reduce((s, [id, q]) => { const item = menu.find((m) => m.id === id); return s + (item ? item.price * q : 0); }, 0);
  const setQty = (id, q) => setCart((c) => ({ ...c, [id]: q }));
  
  const myActiveOrders = orders.filter(o => myOrderIds.includes(o.id) && o.status !== "served");

  const upiUrl = `upi://pay?pa=${RESTAURANT.upiId}&pn=${encodeURIComponent(RESTAURANT.name)}&am=${cartTotal}&cu=INR`;
  const cartQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUrl)}`;
  const loyaltyQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=${RESTAURANT.upiId}&pn=${encodeURIComponent(RESTAURANT.name)}&am=999&cu=INR`)}`;

  async function handlePlaceOrder() {
    if (cartItems.length === 0) return;
    if (!custName.trim() || !custPhone.trim()) { setToast("⚠️ Please enter Name & Phone"); setTimeout(() => setToast(null), 3000); return; }
    if (orderType === "parcel" && !custAddress.trim()) { setToast("⚠️ Please enter Address"); setTimeout(() => setToast(null), 3000); return; }

    const orderId = uid("o");
    const itemStrings = cartItems.map(([id, qty]) => { const m = menu.find((mi) => mi.id === id); return `${qty}x ${m.name}` }).join(", ");

    const waText = `🚨 *NEW ORDER ALERT* (#${orderId.slice(1,5).toUpperCase()})\n\n`
                 + `*Type:* ${orderType === 'parcel' ? '🛍️ Parcel' : `🍽️ Table ${table}`}\n`
                 + `*Customer:* ${custName} (${custPhone})\n`
                 + (orderType === 'parcel' ? `*Address:* ${custAddress}\n\n` : `\n`)
                 + `*Items:* ${itemStrings}\n`
                 + `*Total Bill:* ₹${cartTotal}\n`
                 + (notes ? `*Notes:* ${notes}` : ``);
                 
    const link = document.createElement('a');
    link.href = `https://wa.me/${RESTAURANT.whatsapp}?text=${encodeURIComponent(waText)}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const order = {
      id: orderId, table, orderType,
      customer: { name: custName, phone: custPhone, address: orderType === "parcel" ? custAddress : "" },
      items: cartItems.map(([id, qty]) => { const m = menu.find((mi) => mi.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty }; }),
      notes, payment: "cash", status: "new", paid: false, createdAt: Date.now(),
    };
    
    await placeOrder(order);
    setMyOrderIds([...myOrderIds, order.id]);
    setCart({}); setNotes(""); setCartOpen(false);
    setActiveModal('track'); 
    setToast("🎉 Order Placed Successfully!"); setTimeout(() => setToast(null), 3000);
  }

  async function handleBooking() {
    if(!bookData.name || !bookData.phone || !bookData.date || !bookData.time || !bookData.guests) { setToast("⚠️ Please fill all fields"); setTimeout(() => setToast(null), 3000); return; }
    
    const newBooking = { ...bookData, type: bookType, id: uid("b"), status: "pending", createdAt: Date.now() };

    const waText = `📅 *NEW BOOKING REQUEST*\n\n`
                 + `*Type:* ${bookType === 'party' ? '🎉 Party' : '🍽️ Table'} Booking\n`
                 + `*Name:* ${bookData.name}\n`
                 + `*Phone:* ${bookData.phone}\n`
                 + `*Date:* ${bookData.date} at ${bookData.time}\n`
                 + `*Guests:* ${bookData.guests}`;
                 
    const link = document.createElement('a');
    link.href = `https://wa.me/${RESTAURANT.whatsapp}?text=${encodeURIComponent(waText)}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    await bookEvent(newBooking);
    
    setConfirmedBooking(newBooking);
    setBookData({ name: "", phone: "", date: "", time: "", guests: "" });
    setToast("✅ Booking Request Sent!"); setTimeout(() => setToast(null), 3000);
  }

  // ✨ FIX: Secure PIN Validator Function
  function handleLoginSubmit() {
    const aPin = settings?.adminPin || "9876";
    const sPin = settings?.staffPin || "5432";

    if (pinInput === aPin) {
      setRole("admin");
      setShowLoginModal(false);
      setPinInput("");
    } else if (pinInput === sPin) {
      setRole("staff");
      setShowLoginModal(false);
      setPinInput("");
    } else {
      setToast("❌ Incorrect PIN");
      setTimeout(() => setToast(null), 3000);
      setPinInput("");
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: cartCount ? 90 : 30, background: "#fff", minHeight: "100vh", position: "relative" }}>
      
      {promo && promo.show && promo.text && (
        <div className="flash-banner" style={{ color: "#fff", padding: "12px 16px", textAlign: "center", fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700 }}>🎉 {promo.text}</div>
      )}
      
      <div style={{ position: "relative", height: 260, borderRadius: "0 0 24px 24px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", marginBottom: 12 }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url('${settings?.heroImage || "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80"}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,26,26,0.95) 0%, rgba(26,26,26,0.3) 60%, rgba(26,26,26,0.1) 100%)" }} />
        
        <div style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.2)", backdropFilter: "blur(10px)", padding: "6px 12px", borderRadius: 20, color: "#fff", display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.3)" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Table</span>
          <select value={table} onChange={(e) => setTable(Number(e.target.value))} style={{ background: "transparent", color: "#fff", border: "none", fontWeight: 800, fontSize: 16, outline: "none", appearance: "none" }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (<option key={n} value={n} style={{color: '#000'}}>{n}</option>))}
          </select>
        </div>

        <div style={{ position: "absolute", bottom: 24, left: 20, right: 20 }}>
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 36, color: "#fff", margin: "8px 0 4px", lineHeight: 1.1, textShadow: "0 2px 8px rgba(0,0,0,0.5)", fontWeight: 700 }}>{RESTAURANT.name}</h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: COLORS.paper, opacity: 0.9, margin: 0, fontWeight: 500 }}>{RESTAURANT.tagline}</p>
        </div>
      </div>

      {myActiveOrders.length > 0 && (
        <div style={{ padding: "0 16px", marginBottom: 12 }}>
          <button onClick={() => setActiveModal('track')} style={{ width: "100%", background: COLORS.sageLight, border: `1.5px solid ${COLORS.sage}`, color: COLORS.sageDark, borderRadius: 12, padding: "12px", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} className="smooth-transition hover-lift">
            <span>📦 {myActiveOrders.length} Order{myActiveOrders.length > 1 ? 's' : ''} Active</span>
            <span>Track Status ➔</span>
          </button>
        </div>
      )}

      {!searchQuery.trim() && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "10px 16px", scrollbarWidth: "none", borderBottom: `1px solid ${COLORS.line}` }}>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} style={{ whiteSpace: "nowrap", padding: "10px 16px", borderRadius: 12, border: `1.5px solid ${category === c ? COLORS.copper : COLORS.line}`, background: category === c ? COLORS.copper : "transparent", color: category === c ? "#fff" : COLORS.ink, fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }} className="smooth-transition">{c}</button>
          ))}
        </div>
      )}

      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 4, alignItems: "center" }}>
          <SearchBar value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <button onClick={() => setVegOnly(!vegOnly)} style={{ padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${vegOnly ? COLORS.sage : COLORS.line}`, background: vegOnly ? COLORS.sageLight : "transparent", color: vegOnly ? COLORS.sageDark : COLORS.textLight, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s ease", cursor: "pointer" }}>
            <VegDot veg={true} /> <span style={{fontSize: 13}}>{vegOnly ? "Veg Only" : "All"}</span>
          </button>
        </div>

        {filteredItems.map((item) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "20px 0", borderBottom: `1px solid ${COLORS.line}`, gap: 16, opacity: item.available ? 1 : 0.6 }} className="slide-up">
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <VegDot veg={item.veg} />
                {item.portion && <span style={{fontSize: 11, background: COLORS.paper2, color: COLORS.text, padding: "3px 8px", borderRadius: 4, fontWeight: 600}}>{item.portion}</span>}
                {item.isBestseller && <span style={{fontSize: 11, background: COLORS.copperLight, color: COLORS.copperDark, padding: "3px 8px", borderRadius: 4, fontWeight: 700}}>🔥 Bestseller</span>}
                {!item.available && <span style={{fontSize: 11, color: COLORS.rust, fontWeight: 700}}>Unavailable</span>}
              </div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, color: COLORS.ink, fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: COLORS.copper, fontWeight: 700, marginBottom: 8 }}>{inr(item.price)}</div>
              {item.desc && <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.4 }}>{item.desc}</div>}
            </div>
            <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
              <img src={item.image} alt={item.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", filter: item.available ? 'none' : 'grayscale(100%)' }} />
              <div style={{ position: "absolute", bottom: -16, left: "50%", transform: "translateX(-50%)", zIndex: 2 }}>
                <AddBtnStepper qty={cart[item.id] || 0} onChange={(q) => setQty(item.id, q)} available={item.available} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "30px 16px 50px", fontSize: 13, color: COLORS.textLight, lineHeight: 1.7 }}>
        {RESTAURANT.address}<br />{RESTAURANT.phones.join(" · ")}<br /><br />
        
        {/* ✨ FIX: Changed from default prompt to custom secure Modal */}
        <button onClick={() => setShowLoginModal(true)} style={{ background: "none", border: `1px solid ${COLORS.line}`, color: COLORS.textLight, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", opacity: 0.7, transition: "all 0.2s ease" }} className="smooth-transition">🔒 Staff Login</button>
      </div>

      {/* ✨ FIX: New Secure PIN Login Modal (Password masked UI) */}
      {showLoginModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowLoginModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", padding: "24px", borderRadius: 16, width: "90%", maxWidth: 320, textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }} className="slide-up">
            <div style={{fontSize: 32, marginBottom: 12}}>🔒</div>
            <h3 style={{ margin: "0 0 16px", fontFamily: "Fraunces, serif", fontSize: 20 }}>Enter Security PIN</h3>
            
            <input 
              type="password" 
              placeholder="••••" 
              autoFocus 
              value={pinInput} 
              onChange={(e) => setPinInput(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter') handleLoginSubmit(); }} 
              style={{ ...inputStyle, textAlign: "center", fontSize: 28, letterSpacing: 8, marginBottom: 20, fontWeight: 800 }} 
            />
            
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowLoginModal(false); setPinInput(""); }} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1.5px solid ${COLORS.line}`, background: "transparent", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleLoginSubmit} style={{ flex: 1, padding: "12px", borderRadius: 10, background: COLORS.ink, color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>Login</button>
            </div>
          </div>
        </div>
      )}

      {!cartOpen && !activeModal && (
        <button onClick={() => setShowSidebar(true)} style={{ position: "fixed", bottom: cartCount > 0 ? 95 : 25, right: 20, background: COLORS.ink, color: "#fff", border: "none", borderRadius: "50%", width: 54, height: 54, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(0,0,0,0.25)", cursor: "pointer", zIndex: 10, fontSize: 24, transition: "all 0.2s ease" }} className="smooth-transition hover-lift">
          ☰
        </button>
      )}

      {cartCount > 0 && !cartOpen && !activeModal && (
        <button onClick={() => setCartOpen(true)} style={{ position: "fixed", bottom: 25, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 100px)", maxWidth: 350, background: COLORS.sage, color: "#fff", border: "none", borderRadius: 16, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: 16, cursor: "pointer", zIndex: 5, boxShadow: "0 8px 20px rgba(74,124,89,0.25)", transition: "all 0.2s ease", marginLeft: "-35px" }} className="smooth-transition hover-lift">
          <span>{cartCount} item{cartCount > 1 ? "s" : ""}</span><span>{inr(cartTotal)} ➔</span>
        </button>
      )}

      {showSidebar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex" }}>
          <div style={{ width: "75%", maxWidth: 320, background: "#fff", height: "100%", padding: "24px 20px", display: "flex", flexDirection: "column", boxShadow: "4px 0 20px rgba(0,0,0,0.15)", overflowY: "auto" }} className="slide-right">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 700, color: COLORS.copper }}>Eat & Park</div>
              <button onClick={() => setShowSidebar(false)} style={{ background: "none", border: "none", fontSize: 22, color: COLORS.textLight, cursor: "pointer" }}>✕</button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
              <SidebarBtn icon="🏨" text="About Restaurant" onClick={() => {setShowSidebar(false); setActiveModal('about');}} />
              <SidebarBtn icon="🖼️" text="Gallery" onClick={() => {setShowSidebar(false); setActiveModal('gallery');}} />
              <SidebarBtn icon="🍽️" text="Table Booking" onClick={() => {setShowSidebar(false); setBookType("table"); setActiveModal('booking');}} />
              <SidebarBtn icon="🎉" text="Party Booking" onClick={() => {setShowSidebar(false); setBookType("party"); setActiveModal('booking');}} />
              <SidebarBtn icon="👑" text="VIP Loyalty Partner" onClick={() => {setShowSidebar(false); setActiveModal('loyalty');}} highlight />
              
              <div style={{ borderTop: `1px solid ${COLORS.line}`, marginTop: 10, paddingTop: 14 }}>
                <SidebarBtn icon="📱" text="Install App" onClick={() => {setShowSidebar(false); installApp();}} />
              </div>
            </div>

            <div style={{ marginTop: "auto", paddingTop: 20, borderTop: `1px dashed ${COLORS.line}`, textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textLight, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Need Help? Call Us</div>
              {RESTAURANT.phones.map(p => <div key={p} style={{ fontSize: 16, fontWeight: 800, color: COLORS.ink, marginBottom: 4 }}>📞 {p}</div>)}
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} onClick={() => setShowSidebar(false)} className="fade-in" />
        </div>
      )}

      {(cartOpen || activeModal) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 70 }} onClick={() => {setCartOpen(false); setActiveModal(null); setConfirmedBooking(null);}}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: "24px 20px 30px", maxHeight: "85vh", overflowY: "auto" }} className="slide-up">
            
            {/* 🛒 CART MODAL */}
            {cartOpen && (
              <>
                <ModalHeader title="Checkout" onClose={() => setCartOpen(false)} />
                {cartItems.map(([id, q]) => { 
                  const item = menu.find((m) => m.id === id); 
                  return ( <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "12px", background: COLORS.paper, borderRadius: 10 }}><div style={{ fontSize: 15, fontWeight: 500 }}>{item.name} {item.portion && <span style={{fontSize: 12, color: COLORS.textLight}}>({item.portion})</span>}</div><Stepper qty={q} onChange={(nq) => setQty(id, nq)} /></div> ); 
                })}
                
                <div style={{ display: "flex", gap: 12, marginTop: 20, marginBottom: 16 }}>
                  <button onClick={() => setOrderType("dine_in")} style={{ flex: 1, padding: "12px", border: `1.5px solid ${orderType === "dine_in" ? COLORS.copper : COLORS.line}`, background: orderType === "dine_in" ? COLORS.copper : "#fff", color: orderType === "dine_in" ? "#fff" : COLORS.ink, borderRadius: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" }}>🍽️ Dine-in</button>
                  <button onClick={() => setOrderType("parcel")} style={{ flex: 1, padding: "12px", border: `1.5px solid ${orderType === "parcel" ? COLORS.copper : COLORS.line}`, background: orderType === "parcel" ? COLORS.copper : "#fff", color: orderType === "parcel" ? "#fff" : COLORS.ink, borderRadius: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" }}>🛍️ Parcel</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 20 }}>
                  <div style={{fontSize: 13, fontWeight: 700, color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 1}}>Your Details</div>
                  <input type="text" placeholder="Your Name *" value={custName} onChange={(e) => setCustName(e.target.value)} style={inputStyle} />
                  <input type="tel" placeholder="Phone Number *" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} style={inputStyle} />
                  {orderType === "parcel" && <textarea placeholder="Delivery Address *" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} style={{...inputStyle, resize: "none"}} rows={2} />}
                </div>

                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special cooking instructions?" style={{ ...inputStyle, marginBottom: 20, resize: "none" }} rows={2} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18, marginBottom: 20 }}><span>Grand Total</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.copper }}>{inr(cartTotal)}</span></div>
                
                {orderType === "parcel" && (
                  <div style={{ textAlign: "center", padding: "20px 16px", background: COLORS.paper, border: `1px dashed ${COLORS.line}`, borderRadius: 16, marginBottom: 20 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.ink, marginBottom: 12 }}>Scan to Pay {inr(cartTotal)}</div>
                    <img src={cartQrSrc} alt="UPI QR Code" style={{ width: 160, height: 160, borderRadius: 12, border: '4px solid #fff' }} />
                    <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 12, fontWeight: 500 }}>Please make payment to confirm delivery</div>
                  </div>
                )}
                <button onClick={handlePlaceOrder} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 14, padding: "16px", fontWeight: 700, fontSize: 16, cursor: "pointer", width: "100%" }}>🎉 Place Order</button>
              </>
            )}

            {/* 📦 TRACK ORDER MODAL */}
            {activeModal === 'track' && (
              <>
                <ModalHeader title="Your Active Orders" onClose={() => setActiveModal(null)} />
                {myActiveOrders.length === 0 ? (
                  <div style={{textAlign: 'center', padding: "40px 0", color: COLORS.textLight}}>No active orders right now.</div>
                ) : (
                  myActiveOrders.map(o => {
                    const stepIdx = STATUS_FLOW.indexOf(o.status);
                    return (
                      <div key={o.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: COLORS.ink, marginBottom: 4 }}>Order #{o.id.slice(1,5).toUpperCase()}</div>
                        <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 20 }}>{o.orderType === "parcel" ? "🛍️ Parcel" : `🍽️ Table ${o.table}`} · {timeAgo(o.createdAt)}</div>
                        
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, position: 'relative' }}>
                          <div style={{position: 'absolute', top: 6, left: 20, right: 20, height: 2, background: COLORS.line, zIndex: 0}} />
                          {STATUS_FLOW.map((s, i) => (
                            <div key={s} style={{ textAlign: "center", flex: 1, zIndex: 1, opacity: i <= stepIdx ? 1 : 0.4 }}>
                              <div style={{ width: 14, height: 14, borderRadius: "50%", background: i <= stepIdx ? STATUS_COLOR[o.status] : COLORS.line, margin: "0 auto 6px", border: `2px solid #fff` }} />
                              <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" }}>{STATUS_LABEL[s]}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ borderTop: `1px dashed ${COLORS.line}`, paddingTop: 12 }}>
                          {o.items.map((it) => ( <div key={it.itemId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span>{it.qty}× {it.name}</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{inr(it.price * it.qty)}</span></div> ))}
                        </div>
                      </div>
                    )
                  })
                )}
                <button onClick={() => setActiveModal(null)} style={{ ...primaryBtn, width: "100%", background: "transparent", color: COLORS.copper, border: `1.5px solid ${COLORS.copper}` }}>Back to Menu</button>
              </>
            )}

            {/* 🏨 ABOUT MODAL */}
            {activeModal === 'about' && (
              <>
                <ModalHeader title="About Eat & Park" onClose={() => setActiveModal(null)} />
                <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 700, marginBottom: 8, color: COLORS.ink }}>Eat & Park Restaurant</div>
                  <div style={{ fontSize: 14, color: COLORS.textLight, lineHeight: 1.6, marginBottom: 20 }}>Welcome to Eat & Park, Ara's premium destination for family dining. We serve authentic multi-cuisine dishes prepared with the freshest ingredients and utmost hygiene.</div>
                  <div style={{ background: COLORS.paper, padding: 16, borderRadius: 12, border: `1px solid ${COLORS.line}` }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>📍 Location</div>
                    <div style={{ fontSize: 13, color: COLORS.text }}>{RESTAURANT.address}</div>
                  </div>
                </div>
              </>
            )}

            {/* 🖼️ GALLERY MODAL */}
            {activeModal === 'gallery' && (
              <>
                <ModalHeader title="Our Gallery" onClose={() => setActiveModal(null)} />
                {gallery.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: COLORS.textLight }}>No photos uploaded yet.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {gallery.map(g => (
                      <div key={g.id} style={{ borderRadius: 12, overflow: "hidden", height: 140, boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
                        <img src={g.url} alt="Gallery" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* 📅 BOOKING MODAL */}
            {activeModal === 'booking' && (
              <>
                <ModalHeader title={bookType === "party" ? "Party Booking 🎉" : "Table Booking 🍽️"} onClose={() => {setActiveModal(null); setConfirmedBooking(null);}} />
                
                {confirmedBooking ? (
                  <div style={{textAlign: "center", padding: "20px 0"}}>
                    <div style={{fontSize: 50, marginBottom: 12}}>✅</div>
                    <h3 style={{fontFamily: "Fraunces, serif", fontSize: 24, color: COLORS.ink, marginBottom: 8}}>Request Sent!</h3>
                    <p style={{fontSize: 14, color: COLORS.textLight, marginBottom: 24}}>Your booking has been sent successfully. We will confirm it shortly.</p>
                    
                    <button onClick={() => handlePrint(confirmedBooking, "booking")} style={{ ...primaryBtn, width: "100%", marginBottom: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                      <span style={{fontSize: 18}}>🖨️</span> Download / Print Receipt
                    </button>
                    
                    <button onClick={() => {setActiveModal(null); setConfirmedBooking(null);}} style={{ ...primaryBtn, width: "100%", background: COLORS.paper2, color: COLORS.ink }}>Close</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                    <input type="text" placeholder="Your Name" value={bookData.name} onChange={(e) => setBookData({...bookData, name: e.target.value})} style={inputStyle} />
                    <input type="tel" placeholder="Phone Number" value={bookData.phone} onChange={(e) => setBookData({...bookData, phone: e.target.value})} style={inputStyle} />
                    <div style={{ display: "flex", gap: 12 }}>
                      <input type="date" value={bookData.date} onChange={(e) => setBookData({...bookData, date: e.target.value})} style={inputStyle} />
                      <input type="time" value={bookData.time} onChange={(e) => setBookData({...bookData, time: e.target.value})} style={inputStyle} />
                    </div>
                    <input type="number" placeholder="Number of Guests" value={bookData.guests} onChange={(e) => setBookData({...bookData, guests: e.target.value})} style={inputStyle} />
                    <button onClick={handleBooking} style={{ ...primaryBtn, width: "100%", marginTop: 8 }}>Send Request</button>
                  </div>
                )}
              </>
            )}

            {/* 👑 VIP LOYALTY MODAL */}
            {activeModal === 'loyalty' && (
              <>
                <ModalHeader title="VIP Loyalty Partner 👑" onClose={() => setActiveModal(null)} />
                <div style={{ background: "linear-gradient(135deg, #1A1A1A 0%, #3C3C3C 100%)", borderRadius: 16, padding: 24, color: "#fff", textAlign: "center", marginBottom: 20, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>💎</div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 700, marginBottom: 8, color: COLORS.gold }}>Eat & Park Elite</div>
                  <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 20, lineHeight: 1.5 }}>Become a premium partner for just <strong style={{fontSize: 18, color: COLORS.gold}}>₹999/month</strong>. Get exclusive 20% off on all dine-in orders and special surprises!</div>
                  
                  <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
                    <div style={{ color: COLORS.ink, fontWeight: 800, marginBottom: 8 }}>Scan to Join</div>
                    <img src={loyaltyQrSrc} alt="Pay 999" style={{ width: 140, height: 140 }} />
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 12 }}>Show payment screenshot at counter to activate.</div>
                </div>
              </>
            )}

          </div>
        </div>
      )}
      
      {toast && <div className="toast-anim" style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: COLORS.ink, color: '#fff', padding: '14px 24px', borderRadius: 30, boxShadow: '0 8px 20px rgba(0,0,0,0.3)', zIndex: 100, fontWeight: 600, fontSize: 14 }}>{toast}</div>}
    </div>
  );
}

function SidebarBtn({ icon, text, onClick, highlight }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, background: highlight ? COLORS.copperLight : COLORS.paper, border: highlight ? `1px solid ${COLORS.copper}` : "none", color: highlight ? COLORS.copperDark : COLORS.ink, fontSize: 16, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "all 0.2s ease", width: '100%' }}>
      <span style={{ fontSize: 20 }}>{icon}</span> <span>{text}</span>
    </button>
  );
}

/* =========================================================
   2. STAFF VIEW 
========================================================= */
function StaffView({ orders, advanceStatus, setRole, handlePrint }) {
  const active = orders.filter((o) => o.status !== "served").sort((a, b) => a.createdAt - b.createdAt);
  const columns = ["new", "preparing", "ready"];
  const newOrderCount = active.filter(o => o.status === "new").length;
  const prevCountRef = useRef(newOrderCount);

  useEffect(() => {
    if (newOrderCount > prevCountRef.current) {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      let playCount = 0;
      audio.addEventListener('ended', () => {
        playCount++;
        if (playCount < 4) { audio.play().catch(e => console.log(e)); }
      });
      audio.play().catch(e => console.log("Click screen to enable sound."));
    }
    prevCountRef.current = newOrderCount;
  }, [newOrderCount]);

  return (
    <div style={{ padding: "22px 16px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: 'center' }}><div style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: COLORS.ink, fontWeight: 600 }}>🍳 Kitchen Board</div><button onClick={() => setRole("customer")} style={{ background: COLORS.paper2, border: "none", padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 600, transition: "all 0.2s ease" }} className="smooth-transition">← Back</button></div>
      <div style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 20, fontWeight: 500 }}>{active.length} active order{active.length !== 1 ? "s" : ""}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {columns.map((status) => {
          const list = active.filter((o) => o.status === status);
          return (
            <div key={status} style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_COLOR[status] }} />
                <div style={{ fontSize: 14, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em", color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, background: STATUS_COLOR[status], color: "#fff", padding: "2px 8px", borderRadius: 12, fontWeight: 600, marginLeft: "auto" }}>{list.length}</span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {list.length === 0 && (
                  <div style={{ textAlign: "center", padding: "30px 0", color: COLORS.textLight, fontSize: 14, background: '#fff', borderRadius: 12, border: `1px dashed ${COLORS.line}` }}>All clear! ✨</div>
                )}
                {list.map((o) => (
                  <div key={o.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16, boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }} className="slide-up">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 700, color: o.orderType === "parcel" ? COLORS.rust : COLORS.ink }}>
                        {o.orderType === "parcel" ? "🛍️ PARCEL" : `🍽️ Table ${o.table}`}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.textLight, fontWeight: 500, background: COLORS.paper2, padding: '2px 8px', borderRadius: 10 }}>{timeAgo(o.createdAt)}</div>
                    </div>
                    
                    {o.customer && (
                      <div style={{background: COLORS.paper, padding: "8px 10px", borderRadius: 8, marginBottom: 12, border: `1px solid ${COLORS.line}`}}>
                        <div style={{fontSize: 13, fontWeight: 700, color: COLORS.ink}}>👤 {o.customer.name} <span style={{fontWeight: 500, color: COLORS.textLight}}>({o.customer.phone})</span></div>
                        {o.orderType === "parcel" && o.customer.address && (
                           <div style={{fontSize: 12, color: COLORS.text, marginTop: 4}}>📍 {o.customer.address}</div>
                        )}
                      </div>
                    )}
                    
                    <div style={{ borderTop: `1px dashed ${COLORS.line}`, paddingTop: 12, marginBottom: 12 }}>
                      {o.items.map((it) => ( <div key={it.itemId} style={{ fontSize: 14, marginBottom: 6, fontWeight: 500 }}><span style={{ fontWeight: 700, color: COLORS.ink, display: 'inline-block', width: 24 }}>{it.qty}×</span> {it.name} <span style={{color: COLORS.textLight, fontSize: 12}}>{it.portion}</span></div> ))}
                    </div>
                    {o.notes && <div style={{ fontSize: 13, color: COLORS.rust, marginTop: 8, fontStyle: "italic", padding: "8px 10px", background: COLORS.copperLight, borderRadius: 8, marginBottom: 12 }}>💬 "{o.notes}"</div>}
                    
                    <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <SlideButton text={status === "new" ? "Slide to Prep" : status === "preparing" ? "Slide to Ready" : "Slide to Serve"} bg={STATUS_COLOR[status]} onComplete={() => advanceStatus(o.id, status)} />
                      </div>
                      <button onClick={() => handlePrint(o, "kot")} style={{ background: COLORS.paper2, color: COLORS.ink, border: 'none', width: 44, height: 44, borderRadius: 12, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="smooth-transition hover-lift">🖨️</button>
                    </div>
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
   3. ADMIN VIEW 
========================================================= */
function AdminView({ menu, bookings, gallery, addGalleryImage, deleteGalleryImage, addMenuItem, updateMenuItem, removeMenuItem, orders, markPaid, deleteOrder, setRole, promo, settings, setPromoFirebase, setSettingsFirebase, handlePrint }) {
  const [tab, setTab] = useState("overview");
  const [filterDate, setFilterDate] = useState(toLocalISODate(Date.now()));
  const [newImg, setNewImg] = useState("");

  const filteredOrders = orders.filter(o => toLocalISODate(o.createdAt) === filterDate);
  const revenue = filteredOrders.filter((o) => o.paid).reduce((s, o) => s + o.items.reduce((a, it) => a + it.price * it.qty, 0), 0);
  
  const handleExportCSV = () => {
    if(filteredOrders.length === 0) return alert("No orders found for this date.");
    const headers = "Order ID,Time,Type,Customer Name,Phone,Address,Items,Total,Status,Paid\n";
    const rows = filteredOrders.map(o => {
      const time = new Date(o.createdAt).toLocaleTimeString('en-IN');
      const type = o.orderType === "parcel" ? "Parcel" : `Table ${o.table}`;
      const cName = o.customer?.name || "N/A";
      const cPhone = o.customer?.phone || "N/A";
      const cAddr = (o.customer?.address || "N/A").replace(/,/g, " ");
      const items = o.items.map(i => `${i.qty}x ${i.name}`).join(" | ");
      const total = o.items.reduce((s, it) => s + (it.price * it.qty), 0);
      return `${o.id},${time},${type},${cName},${cPhone},${cAddr},"${items}",${total},${o.status},${o.paid ? 'Yes' : 'No'}`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `EatAndPark_Sales_${filterDate}.csv`; a.click();
  };

  return (
    <div style={{ padding: "22px 16px 60px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, alignItems: 'center' }}><div style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: COLORS.ink, fontWeight: 600 }}>📊 Admin Dashboard</div><button onClick={() => setRole("customer")} style={{ background: COLORS.paper2, border: "none", padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 600, transition: "all 0.2s ease" }} className="smooth-transition">← Back</button></div>
      
      <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: `2px solid ${COLORS.line}`, overflowX: "auto", scrollbarWidth: "none" }}>
        {["overview", "menu", "orders", "bookings", "gallery", "settings"].map((t) => ( <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", padding: "12px 16px", marginRight: 8, fontWeight: 700, fontSize: 14, textTransform: "capitalize", color: tab === t ? COLORS.copper : COLORS.textLight, borderBottom: tab === t ? `3px solid ${COLORS.copper}` : "3px solid transparent", cursor: "pointer", transition: "all 0.2s ease", whiteSpace: "nowrap" }} className="smooth-transition">{t}</button> ))}
      </div>

      {(tab === "overview" || tab === "orders") && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, background: '#fff', padding: 12, borderRadius: 12, border: `1px solid ${COLORS.line}`, flexWrap: 'wrap', gap: 10 }}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <span style={{fontWeight: 600, fontSize: 14}}>📅 Select Date:</span>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{...inputStyle, width: 140, flex: 'none', background: COLORS.paper}} />
          </div>
          {tab === "overview" && (
            <button onClick={handleExportCSV} style={{ ...primaryBtn, padding: "9px 16px", background: COLORS.sage }} className="smooth-transition hover-lift">⬇️ Export CSV</button>
          )}
        </div>
      )}

      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18 }}>
          <StatCard label={`Orders (${filterDate})`} value={filteredOrders.length} icon="📋" color={COLORS.copper} />
          <StatCard label="Revenue (paid)" value={inr(revenue)} icon="💰" color={COLORS.sage} />
          <StatCard label="Active Now" value={orders.filter(o => o.status !== "served").length} icon="🔥" color={COLORS.gold} />
        </div>
      )}

      {tab === "menu" && <MenuEditor menu={menu} addMenuItem={addMenuItem} updateMenuItem={updateMenuItem} removeMenuItem={removeMenuItem} />}

      {tab === "orders" && (
        <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${COLORS.line}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, background: "#fff" }}>
            <thead><tr style={{ textAlign: "left", color: COLORS.textLight, fontSize: 12, background: COLORS.paper, fontWeight: 700 }}><th style={th}>Time</th><th style={th}>Table/Type</th><th style={th}>Customer</th><th style={th}>Items</th><th style={th}>Total</th><th style={th}>Status</th><th style={th}>Action</th></tr></thead>
            <tbody>
              {filteredOrders.length === 0 && <tr><td colSpan="7" style={{padding: 30, textAlign: 'center', color: COLORS.textLight}}>No orders found for this date.</td></tr>}
              {[...filteredOrders].sort((a, b) => b.createdAt - a.createdAt).map((o, idx) => (
                <tr key={o.id} style={{ background: idx % 2 === 0 ? "#fff" : COLORS.paper, transition: "all 0.2s ease" }} className="smooth-transition">
                  <td style={{...td, fontSize: 12, color: COLORS.textLight}}>{new Date(o.createdAt).toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}</td>
                  <td style={td}>{o.orderType === "parcel" ? <Badge color={COLORS.copper}>Parcel</Badge> : <span style={{ fontWeight: 600 }}>T-{o.table}</span>}</td>
                  <td style={td}>
                    {o.customer ? (
                      <div style={{fontSize: 12}}>
                        <div style={{fontWeight: 700, color: COLORS.ink}}>{o.customer.name}</div>
                        <div style={{color: COLORS.textLight}}>{o.customer.phone}</div>
                        {o.orderType === 'parcel' && <div style={{fontSize: 11, color: COLORS.rust, marginTop: 2, maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{o.customer.address}</div>}
                      </div>
                    ) : <span style={{color: COLORS.textLight, fontSize: 12}}>N/A</span>}
                  </td>
                  <td style={{...td, fontSize: 13}}>{o.items.map((it) => `${it.qty}×${it.name}`).join(", ")}</td>
                  <td style={{...td, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600}}>{inr(o.items.reduce((s, it) => s + it.price * it.qty, 0))}</td>
                  <td style={td}><Badge color={STATUS_COLOR[o.status]}>{STATUS_LABEL[o.status]}</Badge></td>
                  <td style={td}>
                    <div style={{display: 'flex', gap: 6, flexWrap: 'wrap'}}>
                      <button onClick={() => markPaid(o.id, !o.paid)} style={{ border: `1px solid ${o.paid ? COLORS.sage : COLORS.line}`, background: o.paid ? COLORS.sage : "transparent", color: o.paid ? "#fff" : COLORS.ink, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", minWidth: 75, fontWeight: 600, transition: "all 0.2s ease" }} className="smooth-transition">{o.paid ? "✓ Paid" : "Mark paid"}</button>
                      <button onClick={() => handlePrint(o, "bill")} style={{ border: `1px solid ${COLORS.ink}`, background: "transparent", color: COLORS.ink, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700, transition: "all 0.2s ease" }} className="smooth-transition">🖨️</button>
                      <button onClick={() => deleteOrder(o.id)} style={{ border: `1px solid ${COLORS.rust}`, background: "transparent", color: COLORS.rust, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700, transition: "all 0.2s ease" }} className="smooth-transition">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "bookings" && (
        <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${COLORS.line}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, background: "#fff" }}>
            <thead><tr style={{ textAlign: "left", background: COLORS.paper, color: COLORS.textLight, fontSize: 12 }}><th style={th}>Date & Time</th><th style={th}>Name</th><th style={th}>Phone</th><th style={th}>Type</th><th style={th}>Guests</th></tr></thead>
            <tbody>
              {bookings.length === 0 && <tr><td colSpan="5" style={{padding: 20, textAlign: 'center'}}>No bookings yet.</td></tr>}
              {bookings.map((b) => (
                <tr key={b.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                  <td style={td}>{b.date} at {b.time}</td>
                  <td style={{...td, fontWeight: 700}}>{b.name}</td>
                  <td style={td}>{b.phone}</td>
                  <td style={td}>{b.type === "party" ? "🎉 Party" : "🍽️ Table"}</td>
                  <td style={td}>{b.guests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "gallery" && (
        <div style={{ background: COLORS.paper, borderRadius: 14, padding: 20 }}>
          <div style={{display: 'flex', gap: 10, marginBottom: 20}}>
            <input type="text" placeholder="Paste Image URL here (e.g. from Unsplash)" value={newImg} onChange={(e) => setNewImg(e.target.value)} style={{...inputStyle, marginBottom: 0}} />
            <button onClick={() => {if(newImg) {addGalleryImage(newImg); setNewImg("");}}} style={{...primaryBtn, flex: 'none'}}>Add Photo</button>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16}}>
            {gallery.map(g => (
              <div key={g.id} style={{position: 'relative', height: 150, borderRadius: 12, overflow: 'hidden'}}>
                <img src={g.url} alt="Gallery" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                <button onClick={() => deleteGalleryImage(g.id)} style={{position: 'absolute', top: 8, right: 8, background: 'rgba(255,0,0,0.8)', color: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer'}}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20 }}>
          
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, marginBottom: 14, fontWeight: 600 }}>Front Hero Image (Restaurant Photo)</div>
          <input type="text" value={settings?.heroImage || ""} onChange={(e) => setSettingsFirebase({ ...settings, heroImage: e.target.value })} placeholder="Paste Image URL here" style={{ ...inputStyle, width: "100%", marginBottom: 16, boxSizing: "border-box", fontSize: 14 }} />

          <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, marginBottom: 14, marginTop: 24, fontWeight: 600, borderTop: `1px solid ${COLORS.line}`, paddingTop: 20 }}>Flash Offer Banner</div>
          <input type="text" value={promo.text} onChange={(e) => setPromoFirebase({ ...promo, text: e.target.value })} placeholder="E.g. Get 20% off on all Chinese items today!" style={{ ...inputStyle, width: "100%", marginBottom: 16, boxSizing: "border-box", fontSize: 14 }} />
          <button onClick={() => setPromoFirebase({ ...promo, show: !promo.show })} style={{ border: `1.5px solid ${promo.show ? COLORS.sage : COLORS.line}`, background: promo.show ? COLORS.sage : "transparent", color: promo.show ? "#fff" : COLORS.ink, borderRadius: 10, padding: "10px 18px", fontSize: 14, cursor: "pointer", fontWeight: 600, transition: "all 0.2s ease" }} className="smooth-transition hover-lift">
            {promo.show ? "🔴 Banner is LIVE" : "⚪ Banner is HIDDEN"}
          </button>

          {/* ✨ FIX: Dynamic PIN Settings Input */}
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, marginBottom: 14, marginTop: 24, fontWeight: 600, borderTop: `1px solid ${COLORS.line}`, paddingTop: 20 }}>🔒 Security Settings (PIN)</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{flex: 1}}>
              <div style={{fontSize: 13, fontWeight: 700, color: COLORS.textLight, marginBottom: 8}}>Admin PIN</div>
              <input type="text" value={settings?.adminPin || "9876"} onChange={(e) => setSettingsFirebase({ ...settings, adminPin: e.target.value })} style={{...inputStyle, letterSpacing: 2, fontWeight: 700}} />
            </div>
            <div style={{flex: 1}}>
              <div style={{fontSize: 13, fontWeight: 700, color: COLORS.textLight, marginBottom: 8}}>Staff PIN</div>
              <input type="text" value={settings?.staffPin || "5432"} onChange={(e) => setSettingsFirebase({ ...settings, staffPin: e.target.value })} style={{...inputStyle, letterSpacing: 2, fontWeight: 700}} />
            </div>
          </div>
          <div style={{fontSize: 12, color: COLORS.rust, background: COLORS.copperLight, padding: 10, borderRadius: 8}}>
            ⚠️ <strong>Warning:</strong> Don't forget your Admin PIN! By default, the Admin PIN is <strong>9876</strong> and Staff PIN is <strong>5432</strong>.
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }) { 
  return <div style={{ background: "#fff", border: `1.5px solid ${COLORS.line}`, borderRadius: 14, padding: "18px 16px", transition: "all 0.3s ease" }} className="smooth-transition hover-lift">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: COLORS.textLight, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>{label}</div>
      <span style={{ fontSize: 24 }}>{icon}</span>
    </div>
    <div style={{ fontFamily: "Fraunces, serif", fontSize: 28, fontWeight: 700, color: color }}>{value}</div>
  </div>; 
}

function MenuEditor({ menu, addMenuItem, updateMenuItem, removeMenuItem }) {
  const [newItem, setNewItem] = useState({ name: "", price: "", category: CATEGORIES[0], portion: "", veg: true, isBestseller: false, available: true, image: "" });
  function add() { 
    if (!newItem.name || !newItem.price) return; 
    const itemToSave = mi(uid("m"), newItem.name, Number(newItem.price), newItem.category, newItem.veg, "", newItem.portion, newItem.isBestseller, true);
    if (newItem.image) itemToSave.image = newItem.image; 
    addMenuItem(itemToSave); 
    setNewItem({ name: "", price: "", category: newItem.category, portion: "", veg: true, isBestseller: false, available: true, image: "" }); 
  }
  return (
    <div>
      {CATEGORIES.map((cat) => {
        const catItems = menu.filter((m) => m.category === cat);
        if(catItems.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, marginBottom: 12, fontWeight: 600, color: COLORS.ink }}>{cat}</div>
            <div style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 12, marginBottom: 16 }}>
              {catItems.map((item, idx) => (
                <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 0", borderBottom: idx < catItems.length - 1 ? `1px solid ${COLORS.line}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: 'wrap' }}>
                    <VegDot veg={item.veg} />
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 600, minWidth: 150 }}>{item.name} {item.portion && <span style={{fontSize: 12, color: COLORS.textLight}}>({item.portion})</span>}</div>
                    <button onClick={() => updateMenuItem(item.id, { available: !item.available })} style={{ padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: item.available ? COLORS.sageLight : COLORS.copperLight, color: item.available ? COLORS.sageDark : COLORS.copperDark, transition: "all 0.2s ease" }}>
                      {item.available ? "✅ In Stock" : "🚫 Out"}
                    </button>
                    <input type="number" value={item.price} onChange={(e) => updateMenuItem(item.id, { price: Number(e.target.value) })} style={{ width: 70, padding: "6px 8px", border: `1px solid ${COLORS.line}`, borderRadius: 8, fontSize: 14, fontWeight: 600 }} />
                    <button onClick={() => removeMenuItem(item.id)} style={{ border: "none", background: "none", color: COLORS.rust, cursor: "pointer", fontSize: 14, fontWeight: 700, transition: "all 0.2s ease", padding: "6px" }} className="smooth-transition">✕</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 26 }}>
                    <span style={{ fontSize: 12, color: COLORS.textLight, fontWeight: 600 }}>Image URL:</span>
                    <input type="text" placeholder="Paste image link here" value={item.image || ""} onChange={(e) => updateMenuItem(item.id, { image: e.target.value })} style={{ flex: 1, maxWidth: 300, padding: "6px 8px", border: `1px solid ${COLORS.line}`, borderRadius: 8, fontSize: 12 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      
      <div style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20, marginTop: 12 }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, marginBottom: 14, fontWeight: 600 }}>Add new item</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: 'center' }}>
          <input placeholder="Name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} style={{...inputStyle, flex: 1, minWidth: 120}} />
          <input placeholder="Price" type="number" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} style={{ ...inputStyle, width: 80, flex: 'none' }} />
          <input placeholder="Portion (50g, Half)" value={newItem.portion} onChange={(e) => setNewItem({ ...newItem, portion: e.target.value })} style={{ ...inputStyle, width: 130, flex: 'none' }} />
          <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} style={{...inputStyle, flex: 'none', width: 130}}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select value={newItem.veg ? "veg" : "nonveg"} onChange={(e) => setNewItem({ ...newItem, veg: e.target.value === "veg" })} style={{ ...inputStyle, flex: "none", width: 100 }}><option value="veg">Veg</option><option value="nonveg">Non-veg</option></select>
          <label style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: COLORS.copper}}><input type="checkbox" checked={newItem.isBestseller} onChange={(e) => setNewItem({...newItem, isBestseller: e.target.checked})}/> Bestseller</label>
          <input placeholder="Image URL (Optional)" type="text" value={newItem.image} onChange={(e) => setNewItem({ ...newItem, image: e.target.value })} style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
          <button onClick={add} style={{ ...primaryBtn, padding: "9px 20px", fontWeight: 700, width: "100%" }} className="smooth-transition hover-lift">Add Item</button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   4. INVISIBLE PRINT RECEIPT
========================================================= */
function PrintReceipt({ order, type }) {
  if (!order) return null;

  if (type === "booking") {
    return (
      <div style={{ width: "300px", margin: "0 auto", padding: "10px", fontWeight: 500 }}>
        <div style={{ textAlign: "center", marginBottom: 12, borderBottom: "1px dashed #000", paddingBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{RESTAURANT.name}</h2>
          <div style={{ fontSize: 12, marginTop: 4 }}>{RESTAURANT.address}</div>
          <div style={{ fontSize: 12 }}>Mob: {RESTAURANT.phones.join(", ")}</div>
          <h3 style={{ margin: "14px 0 0 0", fontSize: 18 }}>BOOKING SLIP</h3>
        </div>
        <div style={{ marginBottom: 12, fontSize: 14 }}>
          <div style={{ marginBottom: 6 }}><strong>ID:</strong> #{order.id.slice(1,6).toUpperCase()}</div>
          <div style={{ marginBottom: 6 }}><strong>Name:</strong> {order.name}</div>
          <div style={{ marginBottom: 6 }}><strong>Phone:</strong> {order.phone}</div>
          <div style={{ marginBottom: 6 }}><strong>Type:</strong> {order.type === "party" ? "Party Booking" : "Table Booking"}</div>
          <div style={{ marginBottom: 6 }}><strong>Date & Time:</strong> {order.date} at {order.time}</div>
          <div style={{ marginBottom: 6 }}><strong>Guests:</strong> {order.guests}</div>
          <div style={{ marginBottom: 6 }}><strong>Status:</strong> Pending Confirmation</div>
        </div>
        <div style={{ borderTop: "1px dashed #000", marginTop: 20, paddingTop: 10, textAlign: "center", fontSize: 12 }}>
          Thank you for choosing us!<br/>Please show this slip at the counter.
        </div>
      </div>
    );
  }

  const totalAmount = order.items.reduce((s, it) => s + it.price * it.qty, 0);
  const upiUrl = `upi://pay?pa=${RESTAURANT.upiId}&pn=${encodeURIComponent(RESTAURANT.name)}&am=${totalAmount}&cu=INR`;
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiUrl)}`;

  return (
    <div style={{ width: "300px", margin: "0 auto", padding: "10px", fontWeight: 500 }}>
      <div style={{ textAlign: "center", marginBottom: 12, borderBottom: "1px dashed #000", paddingBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{RESTAURANT.name}</h2>
        <div style={{ fontSize: 12, marginTop: 4 }}>{RESTAURANT.address}</div>
        <div style={{ fontSize: 12 }}>Mob: {RESTAURANT.phones.join(", ")}</div>
        <h3 style={{ margin: "14px 0 0 0", fontSize: 18 }}>{type === "kot" ? "KOT (KITCHEN ORDER)" : "CASH RECEIPT"}</h3>
      </div>
      <div style={{ marginBottom: 12, fontSize: 13, borderBottom: "1px dashed #000", paddingBottom: 8 }}>
        <div>Date: {new Date(order.createdAt).toLocaleString('en-IN')}</div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>
          {order.orderType === "parcel" ? "Type: TAKEAWAY / PARCEL" : `Table No: ${order.table}`} | Order ID: #{order.id.slice(1,5).toUpperCase()}
        </div>
        {order.customer && (
          <div style={{marginTop: 6}}>
            <div>Customer: {order.customer.name} ({order.customer.phone})</div>
            {order.orderType === 'parcel' && order.customer.address && <div>Add: {order.customer.address}</div>}
          </div>
        )}
      </div>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", textAlign: "left" }}>
        <thead><tr style={{ borderBottom: "1px dashed #000" }}><th style={{ paddingBottom: 4 }}>Item</th><th style={{ textAlign: "center", paddingBottom: 4 }}>Qty</th>{type === "bill" && <th style={{ textAlign: "right", paddingBottom: 4 }}>Price</th>}</tr></thead>
        <tbody>
          {order.items.map(it => (<tr key={it.itemId}><td style={{ padding: "6px 0" }}>{it.name} {it.portion ? `(${it.portion})` : ""}</td><td style={{ textAlign: "center", padding: "6px 0" }}>{it.qty}</td>{type === "bill" && <td style={{ textAlign: "right", padding: "6px 0" }}>{it.price * it.qty}</td>}</tr>))}
        </tbody>
      </table>
      <div style={{ borderTop: "1px dashed #000", marginTop: 8, paddingTop: 10 }}>
        {type === "bill" && <div style={{ fontSize: 18, fontWeight: 700, textAlign: "right" }}>Total: {inr(totalAmount)}</div>}
        {type === "kot" && order.notes && <div style={{ marginTop: 10, fontSize: 14 }}><strong>Notes:</strong> {order.notes}</div>}
      </div>
      {type === "bill" && (
        <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Scan to Pay {inr(totalAmount)}</div>
          <img src={qrImageSrc} alt="UPI QR Code" style={{ width: 120, height: 120 }} />
          <div style={{ fontSize: 11, marginTop: 6, color: "#333" }}>UPI ID: {RESTAURANT.upiId}</div>
          <div style={{ marginTop: 20, fontSize: 12 }}>Thank you for visiting!<br/>Have a great day.</div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   APP SHELL
========================================================= */
export default function App() {
  const [role, setRole] = useState("customer");
  const [table, setTable] = useState(() => { const params = new URLSearchParams(window.location.search); return params.has("table") ? Number(params.get("table")) : 1; });
  const [menu, setMenuState] = useState([]);
  const [orders, setOrdersState] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [gallery, setGallery] = useState([]); 
  const [promo, setPromo] = useState({ text: "Welcome to Eat & Park!", show: false });
  const [settings, setSettings] = useState({ heroImage: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80" });
  const [ready, setReady] = useState(false);
  const [printData, setPrintData] = useState(null); 
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); setDeferredPrompt(e); });

    const unsubMenu = onSnapshot(collection(db, "menu"), (snapshot) => {
      if (snapshot.empty) { const batch = writeBatch(db); DEFAULT_MENU.forEach(item => batch.set(doc(db, "menu", item.id), item)); batch.commit();
      } else { const menuData = snapshot.docs.map(doc => doc.data()); const sortedMenu = [...menuData].sort((a, b) => { const indexA = DEFAULT_MENU.findIndex(i => i.id === a.id); const indexB = DEFAULT_MENU.findIndex(i => i.id === b.id); return indexA - indexB; }); setMenuState(sortedMenu); }
    });
    const unsubOrders = onSnapshot(collection(db, "orders"), (s) => setOrdersState(s.docs.map(d => d.data())));
    const unsubBookings = onSnapshot(collection(db, "bookings"), (s) => setBookings(s.docs.map(d => d.data()))); 
    const unsubGallery = onSnapshot(collection(db, "gallery"), (s) => setGallery(s.docs.map(d => d.data()))); 
    const unsubPromo = onSnapshot(doc(db, "config", "promo"), (d) => { if (d.exists()) setPromo(d.data()); });
    const unsubSettings = onSnapshot(doc(db, "config", "settings"), (d) => { 
      if (d.exists()) setSettings(d.data()); 
      setReady(true);
    });
    
    return () => { unsubMenu(); unsubOrders(); unsubBookings(); unsubGallery(); unsubPromo(); unsubSettings(); };
  }, []);

  const addMenuItem = async (item) => { await setDoc(doc(db, "menu", item.id), item); };
  const updateMenuItem = async (id, patch) => { await updateDoc(doc(db, "menu", id), patch); };
  const removeMenuItem = async (id) => { await deleteDoc(doc(db, "menu", id)); };
  const placeOrder = async (order) => { await setDoc(doc(db, "orders", order.id), order); };
  const advanceStatus = async (orderId, currentStatus) => { const idx = STATUS_FLOW.indexOf(currentStatus); const nextStatus = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)]; await updateDoc(doc(db, "orders", orderId), { status: nextStatus }); };
  const markPaid = async (orderId, paid) => { await updateDoc(doc(db, "orders", orderId), { paid }); };
  const deleteOrder = async (orderId) => { await deleteDoc(doc(db, "orders", orderId)); };
  const setPromoFirebase = async (newPromo) => { setPromo(newPromo); await setDoc(doc(db, "config", "promo"), newPromo); };
  const setSettingsFirebase = async (newSettings) => { setSettings(newSettings); await setDoc(doc(db, "config", "settings"), newSettings); };
  const bookEvent = async (booking) => { await setDoc(doc(db, "bookings", booking.id), booking); };
  const addGalleryImage = async (url) => { const id = uid("g"); await setDoc(doc(db, "gallery", id), { id, url, addedAt: Date.now() }); };
  const deleteGalleryImage = async (id) => { await deleteDoc(doc(db, "gallery", id)); };

  const handlePrint = (order, type) => { setPrintData({ order, type }); setTimeout(() => { window.print(); setPrintData(null); }, 500); };

  const handleInstallApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => { setDeferredPrompt(null); });
    } else {
      alert("App shortcut is ready! To install manually: Tap your browser's menu (⋮) and select 'Add to Home screen' or 'Install App'.");
    }
  };

  if (!ready) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.paper }}>Loading menu...</div>;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.paper, color: COLORS.ink, fontFamily: "Inter, sans-serif" }}>
      <style>{FONTS}</style>
      
      <div className="app-content">
        {role === "customer" && <CustomerView menu={menu} orders={orders} placeOrder={placeOrder} bookEvent={bookEvent} gallery={gallery} table={table} setTable={setTable} setRole={setRole} promo={promo} settings={settings} installApp={handleInstallApp} handlePrint={handlePrint} />}
        {role === "staff" && <StaffView orders={orders} advanceStatus={advanceStatus} setRole={setRole} handlePrint={handlePrint} />}
        {role === "admin" && <AdminView menu={menu} bookings={bookings} gallery={gallery} addGalleryImage={addGalleryImage} deleteGalleryImage={deleteGalleryImage} addMenuItem={addMenuItem} updateMenuItem={updateMenuItem} removeMenuItem={removeMenuItem} orders={orders} markPaid={markPaid} deleteOrder={deleteOrder} setRole={setRole} promo={promo} settings={settings} setPromoFirebase={setPromoFirebase} setSettingsFirebase={setSettingsFirebase} handlePrint={handlePrint} />}
      </div>
      
      {printData && <div className="print-area"><PrintReceipt order={printData.order} type={printData.type} /></div>}
    </div>
  );
}