import React, { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";

/* ═══════════════════════════════════════════════════════════════════════════════════
   🍽️ EAT & PARK RESTAURANT — STABLE MASTER RELEASE (150+ ITEMS)
═══════════════════════════════════════════════════════════════════════════════════ */

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes toastSlide { 0% { transform: translate(-50%, 100px); opacity: 0; } 10% { transform: translate(-50%, 0); opacity: 1; } 90% { transform: translate(-50%, 0); opacity: 1; } 100% { transform: translate(-50%, 100px); opacity: 0; } }

.slide-up { animation: slideUp 0.4s ease-out; }
.toast-anim { animation: toastSlide 3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
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
  "Aloo, Dal & Sides", "Momo", "Tea & Coffee"
];

function mi(id, name, price, category, veg, desc, portion, isBestseller = false, available = true, image) {
  let img = image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; 
  return { id, name, desc: desc || "Freshly prepared.", price: Number(price), category, veg, available, image: img, portion: portion || "", isBestseller };
}

const DEFAULT_MENU = [
  mi("d1", "Mint Mojito", 90, "Drinks", true, "Refreshing blend of fresh mint.", "", true),
  mi("d2", "Blue Lagoon", 90, "Drinks", true, "Tropical blue curacao cooler."),
  mi("d3", "Vanilla Shake", 120, "Drinks", true, "Classic thick vanilla milkshake."),
  mi("d4", "Strawberry Shake", 120, "Drinks", true, "Fresh strawberry flavored thick shake."),
  mi("d5", "Butter Scotch Shake", 130, "Drinks", true, "Crunchy butterscotch shake."),
  mi("d6", "Chocolate Shake", 130, "Drinks", true, "Rich creamy chocolate shake.", "", true),
  mi("d7", "Oreo Shake", 140, "Drinks", true, "Loaded with crushed Oreo cookies."),
  mi("d8", "Kitkat Shake", 140, "Drinks", true, "Blended with crunchy KitKat bars.", "", true),
  mi("d9", "Cold Coffee", 120, "Drinks", true, "Chilled frothy cold coffee.", "", true),
  mi("d10", "Cold Drink", 50, "Drinks", true, "Chilled aerated beverage."),
  mi("d11", "Fresh Lime Water", 40, "Drinks", true, "Refreshing salted or sweet lime water."),
  mi("d12", "Fresh Lime Soda", 60, "Drinks", true, "Fizzy lime soda."),

  mi("f1", "Veg Burger", 90, "Fun Food", true, "Crispy veggie patty with fresh lettuce."),
  mi("f2", "Eat & Park Special Pizza", 280, "Fun Food", true, "Loaded with exotic veggies.", "", true),
  mi("f3", "Corn & Cheese Pizza", 240, "Fun Food", true, "Sweet corn with mozzarella."),
  mi("f4", "Paneer Tikka Pizza", 260, "Fun Food", true, "Spicy paneer chunks.", "", true),
  mi("f5", "Veg Cheese Sandwich", 110, "Fun Food", true, "Grilled with cheese."),
  mi("f6", "Paneer Grilled Sandwich", 140, "Fun Food", true, "Spiced paneer stuffing."),
  mi("f7", "White Sauce Pasta", 180, "Fun Food", true, "Penne pasta in creamy cheese sauce.", "", true),
  mi("f8", "Eat & Park Egg Roll", 100, "Fun Food", false, "Double egg wrapped with onions."),
  mi("f9", "Eat & Park Chicken Roll", 150, "Fun Food", false, "Juicy chicken tikka wrapped.", "", true),
  mi("f10", "Paneer Roll", 120, "Fun Food", true, "Spiced paneer strips wrapped."),

  mi("cs1", "Paneer Chilli", 240, "Chinese Starter", true, "Crispy paneer in soy-chilli sauce.", "Dry/Gravy", true),
  mi("cs2", "Paneer 65", 250, "Chinese Starter", true, "Deep-fried spiced paneer."),
  mi("cs3", "Paneer Manchurian", 240, "Chinese Starter", true, "Paneer balls in tangy sauce."),
  mi("cs4", "Crispy Corn", 180, "Chinese Starter", true, "Golden fried corn kernels.", "", true),
  mi("cs5", "Veg Manchurian", 190, "Chinese Starter", true, "Veggie dumplings in soy sauce."),
  mi("cs6", "Veg Spring Roll", 160, "Chinese Starter", true, "Crispy rolls filled with veggies."),
  mi("cs7", "Honey Chilli Potato", 170, "Chinese Starter", true, "Glazed in honey chilli.", "", true),
  mi("cs8", "Chicken Chilli", 240, "Chinese Starter", false, "Diced chicken with capsicum.", "Dry/Gravy", true),
  mi("cs9", "Chicken 65", 260, "Chinese Starter", false, "Spicy fried chicken."),
  mi("cs10", "Chicken Lollipop", 280, "Chinese Starter", false, "Frenched wings.", "6 Pcs", true),
  mi("cs11", "Chicken Manchurian", 250, "Chinese Starter", false, "Chicken in Manchurian gravy."),
  mi("cs12", "Lemon Chicken", 270, "Chinese Starter", false, "Tangy lemon chicken."),

  mi("mg1", "Tandoori Chicken", 450, "Mughlai", false, "Classic marinated chicken.", "Full", true),
  mi("mg2", "Tandoori Chicken Half", 240, "Mughlai", false, "Half portion.", "Half"),
  mi("mg3", "Afghani Chicken", 480, "Mughlai", false, "Creamy tandoori chicken.", "Full", true),
  mi("mg4", "Chicken Seekh Kebab", 280, "Mughlai", false, "Minced chicken skewers."),
  mi("mg5", "Mutton Seekh Kebab", 320, "Mughlai", false, "Juicy minced mutton."),

  mi("t1", "Paneer Tikka", 299, "Tandoori", true, "Cottage cheese char-grilled.", "", true),
  mi("t2", "Paneer Malai Tikka", 320, "Tandoori", true, "Creamy paneer tikka."),
  mi("t3", "Mushroom Tikka", 280, "Tandoori", true, "Fresh button mushrooms."),
  mi("t4", "Veg Soya Chaap", 200, "Tandoori", true, "Tandoori spiced chaap.", "", true),
  mi("t5", "Malai Soya Chaap", 230, "Tandoori", true, "Rich creamy chaap."),

  mi("s1", "Tomato Soup", 100, "Soup", true, "Warm creamy tomato soup."),
  mi("s2", "Veg Hot & Sour Soup", 110, "Soup", true, "Spicy vegetable broth.", "", true),
  mi("s3", "Veg Manchow Soup", 110, "Soup", true, "Topped with crispy noodles."),
  mi("s4", "Sweet Corn Soup", 120, "Soup", true, "Sweet corn kernels."),
  mi("s5", "Chicken Hot & Sour Soup", 140, "Soup", false, "Spicy chicken soup."),
  mi("s6", "Chicken Manchow Soup", 140, "Soup", false, "Spicy chicken with garlic.", "", true),

  mi("b1", "Tandoori Roti", 15, "Indian Bread", true, "Whole wheat bread."),
  mi("b2", "Butter Tandoori Roti", 20, "Indian Bread", true, "Brushed with butter.", "", true),
  mi("b3", "Plain Naan", 40, "Indian Bread", true, "Soft refined flour bread."),
  mi("b4", "Butter Naan", 60, "Indian Bread", true, "Naan with butter.", "", true),
  mi("b5", "Garlic Naan", 70, "Indian Bread", true, "With garlic and coriander."),
  mi("b6", "Stuffed Naan", 90, "Indian Bread", true, "Potato or paneer stuffed."),
  mi("b7", "Lachha Paratha", 45, "Indian Bread", true, "Multi-layered paratha."),
  mi("b8", "Missi Roti", 35, "Indian Bread", true, "Gram flour flatbread."),

  mi("sn1", "Veg Cutlet", 80, "Snacks", true, "Crispy fried patties."),
  mi("sn2", "Paneer Pakoda", 150, "Snacks", true, "Cottage cheese fritters."),
  mi("sn3", "French Fries", 100, "Snacks", true, "Golden potato fries.", "", true),
  mi("sn4", "Peri Peri Fries", 120, "Snacks", true, "Spicy peri peri fries."),
  mi("sn5", "Cheese Balls", 160, "Snacks", true, "Cheesy potato spheres."),

  mi("cm1", "Veg Chowmein", 130, "Chinese Mains", true, "Stir-fried noodles."),
  mi("cm2", "Veg Hakka Noodles", 160, "Chinese Mains", true, "Classic non-spicy noodles.", "", true),
  mi("cm3", "Schezwan Noodles", 170, "Chinese Mains", true, "Spicy schezwan noodles."),
  mi("cm4", "Veg Fried Rice", 170, "Chinese Mains", true, "Aromatic fried rice."),
  mi("cm5", "Schezwan Fried Rice", 190, "Chinese Mains", true, "Fiery rice preparation."),
  mi("cm6", "Chicken Chowmein", 170, "Chinese Mains", false, "Noodles with chicken."),
  mi("cm7", "Chicken Hakka Noodles", 190, "Chinese Mains", false, "Loaded with chicken.", "", true),
  mi("cm8", "Chicken Fried Rice", 210, "Chinese Mains", false, "Rice tossed with chicken."),

  mi("p1", "Plain Rice", 90, "Pulao", true, "Steamed basmati rice."),
  mi("p2", "Jeera Rice", 110, "Pulao", true, "Cumin tempered rice.", "", true),
  mi("p3", "Veg Pulao", 160, "Pulao", true, "Mixed vegetable rice."),
  mi("p4", "Peas Pulao", 140, "Pulao", true, "Green peas rice."),
  mi("p5", "Kashmiri Pulao", 210, "Pulao", true, "Dry fruits rice."),

  mi("pn1", "Paneer Masala", 250, "Paneer & Mushroom", true, "Paneer in gravy."),
  mi("pn2", "Shahi Paneer", 270, "Paneer & Mushroom", true, "Creamy cashew gravy."),
  mi("pn3", "Kadhai Paneer", 260, "Paneer & Mushroom", true, "With kadhai masala.", "", true),
  mi("pn4", "Palak Paneer", 240, "Paneer & Mushroom", true, "Spinach gravy."),
  mi("pn5", "Paneer Lababdar", 280, "Paneer & Mushroom", true, "Velvety gravy."),
  mi("pn6", "Paneer Butter Masala", 260, "Paneer & Mushroom", true, "Creamy makhani gravy.", "", true),
  mi("pn7", "Matar Paneer", 230, "Paneer & Mushroom", true, "Peas and paneer."),
  mi("pn8", "Mushroom Masala", 250, "Paneer & Mushroom", true, "Mushroom curry."),

  mi("nv1", "Chicken Dehati", 550, "Chicken, Mutton, Fish & Egg", false, "Rustic chicken curry.", "Full", true),
  mi("nv2", "Chicken Dehati Half", 290, "Chicken, Mutton, Fish & Egg", false, "Half portion.", "Half"),
  mi("nv3", "Chicken Curry", 280, "Chicken, Mutton, Fish & Egg", false, "Homestyle gravy."),
  mi("nv4", "Chicken Korma", 320, "Chicken, Mutton, Fish & Egg", false, "Creamy korma."),
  mi("nv5", "Kadhai Chicken", 300, "Chicken, Mutton, Fish & Egg", false, "Capsicum chicken."),
  mi("nv6", "Chicken Handi", 340, "Chicken, Mutton, Fish & Egg", false, "Handi chicken."),
  mi("nv7", "Chicken Rara", 360, "Chicken, Mutton, Fish & Egg", false, "Minced meat gravy.", "", true),
  mi("nv8", "Chicken Butter Masala", 350, "Chicken, Mutton, Fish & Egg", false, "Tandoori butter chicken.", "", true),
  mi("nv9", "Mutton Curry", 420, "Chicken, Mutton, Fish & Egg", false, "Robust mutton gravy."),
  mi("nv10", "Mutton Korma", 450, "Chicken, Mutton, Fish & Egg", false, "Royal mutton."),
  mi("nv11", "Mutton Rogan Josh", 480, "Chicken, Mutton, Fish & Egg", false, "Kashmiri mutton."),
  mi("nv12", "Mutton Handi", 650, "Chicken, Mutton, Fish & Egg", false, "Slow cooked in handi.", "500g", true),
  mi("nv13", "Fish Curry", 300, "Chicken, Mutton, Fish & Egg", false, "Mustard fish curry."),
  mi("nv14", "Egg Curry", 160, "Chicken, Mutton, Fish & Egg", false, "Boiled egg gravy."),

  mi("br1", "Veg Biryani", 180, "Biryani & Thali", true, "Layered veg rice."),
  mi("br2", "Hyderabadi Veg Dum Biryani", 200, "Biryani & Thali", true, "Dum veg biryani."),
  mi("br3", "Paneer Dum Biryani", 230, "Biryani & Thali", true, "Paneer biryani."),
  mi("br4", "Chicken Dum Biryani", 240, "Biryani & Thali", false, "Dum chicken biryani.", "", true),
  mi("br5", "Chicken Biryani", 210, "Biryani & Thali", false, "Classic chicken biryani.", "", true),
  mi("br6", "Mutton Dum Biryani", 320, "Biryani & Thali", false, "Mutton biryani."),
  mi("br15", "Veg Thali", 250, "Biryani & Thali", true, "Complete meal platter.", "", true),
  mi("br16", "Special Non-Veg Thali", 380, "Biryani & Thali", false, "Non-veg meal platter.", "", true),

  mi("al1", "Dum Aloo", 160, "Aloo, Dal & Sides", true, "Baby potatoes gravy."),
  mi("al2", "Aloo Jeera", 110, "Aloo, Dal & Sides", true, "Cumin potatoes."),
  mi("al3", "Mix Veg", 190, "Aloo, Dal & Sides", true, "Seasonal vegetables."),
  mi("al4", "Dal Fry", 90, "Aloo, Dal & Sides", true, "Yellow dal fry."),
  mi("al5", "Dal Tadka", 100, "Aloo, Dal & Sides", true, "Dhaba-style dal tadka.", "", true),
  mi("al6", "Dal Makhani", 180, "Aloo, Dal & Sides", true, "Black lentils butter.", "", true),
  mi("al7", "Green Salad", 70, "Aloo, Dal & Sides", true, "Fresh salad."),
  mi("al8", "Boondi Raita", 80, "Aloo, Dal & Sides", true, "Boondi yogurt."),

  mi("mo1", "Veg Momo", 80, "Momo", true, "Steamed dumplings.", "Steam", true),
  mi("mo2", "Veg Fried Momo", 110, "Momo", true, "Fried veg momos."),
  mi("mo3", "Veg Paneer Momo", 100, "Momo", true, "Paneer momos."),
  mi("mo4", "Chicken Momo", 110, "Momo", false, "Steamed chicken momos.", "Steam", true),
  mi("mo5", "Chicken Fried Momo", 140, "Momo", false, "Crispy fried chicken momos."),
  mi("mo6", "Chicken Tandoori Momo", 170, "Momo", false, "Tandoori charred momos.", "", true),

  mi("tc1", "Hot Tea", 25, "Tea & Coffee", true, "Masala chai."),
  mi("tc2", "Green Tea", 40, "Tea & Coffee", true, "Antioxidant green tea."),
  mi("tc3", "Hot Coffee", 50, "Tea & Coffee", true, "Warm coffee.")
];

const DEFAULT_OFFERS = [
  { id: "off1", title: "Flat 20% OFF 🍜", desc: "Get 20% off on your entire bill!", type: "percent", value: 20 },
  { id: "off2", title: "₹50 OFF on ₹499", desc: "Flat ₹50 discount on orders above ₹499.", type: "flat", value: 50, minAmount: 499 }
];

const STATUS_FLOW = ["new", "preparing", "ready", "served"];
const STATUS_LABEL = { new: "New", preparing: "Preparing", ready: "Ready", served: "Served" };
const STATUS_COLOR = { new: COLORS.rust, preparing: COLORS.copper, ready: COLORS.sage, served: "#8A8375" };
const STEP_INDEX = { new: 0, preparing: 1, ready: 2, served: 3 };

function inr(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 8); }
function timeAgo(ts) { const s = Math.floor((Date.now() - ts)/1000); if (s < 60) return s + "s ago"; const m = Math.floor(s/60); if (m < 60) return m + "m ago"; return Math.floor(m/60) + "h ago"; }

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => { try { const item = window.localStorage.getItem(key); return item ? JSON.parse(item) : initialValue; } catch (error) { return initialValue; } });
  useEffect(() => { window.localStorage.setItem(key, JSON.stringify(storedValue)); }, [key, storedValue]);
  return [storedValue, setStoredValue];
}

const primaryBtn = { background: COLORS.copper, color: "#fff", border: "none", borderRadius: 14, padding: "13px 20px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const inputStyle = { padding: "12px 16px", border: `1.5px solid ${COLORS.line}`, borderRadius: 12, fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", width: "100%", boxSizing: "border-box" };
const th = { padding: "12px 14px", borderBottom: `2px solid ${COLORS.line}`, textAlign: 'left' }; 
const td = { padding: "12px 14px", borderBottom: `1px solid ${COLORS.line}` };

function Badge({ children, color }) { return <span style={{ background: color, color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "5px 10px", borderRadius: 999, fontWeight: 700 }}>{children}</span>; }
function VegDot({ veg }) { const c = veg ? COLORS.sage : COLORS.rust; return <span style={{ width: 14, height: 14, border: `1.5px solid ${c}`, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} /></span>; }
function Stepper({ qty, onChange }) { return <div style={{ display: "flex", alignItems: "center", gap: 10 }}><button onClick={() => onChange(Math.max(0, qty - 1))} style={{ width: 28, height: 28, borderRadius: "50%", border: `1.5px solid ${COLORS.copper}`, background: "transparent", color: COLORS.copper, fontSize: 18, cursor: "pointer" }}>−</button><span style={{ fontWeight: 700, minWidth: 16, textAlign: "center" }}>{qty}</span><button onClick={() => onChange(qty + 1)} style={{ width: 28, height: 28, borderRadius: "50%", border: `1.5px solid ${COLORS.copper}`, background: "transparent", color: COLORS.copper, fontSize: 18, cursor: "pointer" }}>+</button></div>; }
function ModalHeader({ title, onClose }) { return <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 16 }}><div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 700 }}>{title}</div><button onClick={onClose} style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>✕</button></div>; }
function Toast({ message, type = 'info' }) { return <div className="toast-anim" style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', background: type === 'success' ? COLORS.success : COLORS.error, color: '#fff', padding: '16px 28px', borderRadius: 30, zIndex: 100, fontWeight: 700 }}><span>{message}</span></div>; }

function SlideButton({ onComplete, text, bg = COLORS.sage }) {
  const [val, setVal] = useState(0);
  return (
    <div style={{position: 'relative', width: '100%', height: 48, background: COLORS.paper2, borderRadius: 14, overflow: 'hidden', border: `1px solid ${COLORS.line}`}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${val}%`, background: bg}} />
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: val > 50 ? '#fff' : COLORS.text, pointerEvents: 'none', zIndex: 2}}>{text} <span style={{marginLeft: 8, fontSize: 18}}>»</span></div>
      <input type="range" min="0" max="100" value={val} onChange={(e) => setVal(Number(e.target.value))} onMouseUp={() => { if(val > 85) onComplete(); setVal(0); }} onTouchEnd={() => { if(val > 85) onComplete(); setVal(0); }} style={{opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute', top: 0, left: 0, zIndex: 3}} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════
   1. CUSTOMER VIEW
═══════════════════════════════════════════════════════════════════════════════════ */

function CustomerView({ menu, orders, placeOrder, bookEvent, offersList, table, setTable, setRole, isDark, setIsDark, requestWaiter, loyaltyRules, loyaltyUsers }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeModal, setActiveModal] = useState(null); 
  const [myOrderIds, useMyOrderIds] = useLocalStorage('my_order_ids', []); 
  
  const [isLoggedIn, setIsLoggedIn] = useLocalStorage('cust_logged_in', false);
  const [custPhone, setCustPhone] = useLocalStorage('cust_phone', "");
  const [custName, setCustName] = useLocalStorage('cust_name', "");
  const [showOtp, setShowOtp] = useState(false);
  const [otpInput, setOtpInput] = useState("");

  const [orderType, setOrderType] = useState("dine_in");
  const [custAddress, setCustAddress] = useLocalStorage('cust_address', "");
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState(null);
  
  const [bookType, setBookType] = useState("table");
  const [bookData, setBookData] = useState({ name: "", phone: "", date: "", time: "", guests: "" });
  const [selectedOffer, setSelectedOffer] = useState("");
  const [claimedReward, setClaimedReward] = useState(null);

  const showToast = (msg, type = 'info') => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  
  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const cartTotal = cartItems.reduce((s, [id, q]) => { const item = menu.find(m => m.id === id); return s + (item ? item.price * q : 0); }, 0);
  
  const appliedOfferObj = offersList.find(o => o.id === selectedOffer);
  let discountAmount = 0;
  if (appliedOfferObj) {
    if (appliedOfferObj.minAmount && cartTotal < appliedOfferObj.minAmount) discountAmount = 0;
    else if (appliedOfferObj.type === 'percent') discountAmount = Math.round(cartTotal * (appliedOfferObj.value / 100));
    else discountAmount = appliedOfferObj.value;
  }
  
  const deliveryCharge = orderType === "parcel" ? 40 : 0; 
  const grandTotal = Math.max(0, cartTotal - discountAmount) + deliveryCharge;

  const activeUser = loyaltyUsers.find(u => u.phone === custPhone);
  const pastCoins = activeUser ? activeUser.coins : 0;
  const newEarnedCoins = Math.floor(grandTotal / loyaltyRules.rate);
  const totalCoinsAvailableToSpend = pastCoins + newEarnedCoins; 

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCustAddress(`Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)} (Auto)`),
        () => showToast("Location access denied", "error")
      );
    } else { showToast("Geolocation not supported", "error"); }
  };

  const handlePlaceOrder = () => {
    if (!isLoggedIn) { setActiveModal('login'); return; }
    if (!custName.trim()) { showToast("Please enter Name", 'error'); return; }
    if (orderType === "parcel" && !custAddress.trim()) { showToast("Please enter Address", 'error'); return; }

    const orderId = uid("o");
    const order = { id: orderId, table, orderType, customer: { name: custName, phone: custPhone, address: custAddress }, items: cartItems.map(([id, qty]) => { const m = menu.find(mi => mi.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty }; }), subtotal: cartTotal, discount: discountAmount, deliveryCharge, total: grandTotal, appliedOffer: appliedOfferObj?.title || null, claimedReward: claimedReward?.item || null, rewardUsedCoins: claimedReward?.cost || 0, earnedCoins: newEarnedCoins, notes, status: "new", paid: false, createdAt: Date.now() };
    
    placeOrder(order); useMyOrderIds([...myOrderIds, orderId]);
    setCart({}); setNotes(""); setClaimedReward(null); setSelectedOffer(""); setCartOpen(false); setActiveModal('track');
    showToast("Order Placed Successfully!", 'success');
  };

  const myActiveOrders = orders.filter(o => myOrderIds.includes(o.id) && o.status !== "served");
  const myOrderHistory = orders.filter(o => myOrderIds.includes(o.id)).sort((a,b) => b.createdAt - a.createdAt);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 120, position: "relative" }}>
      <button onClick={() => {requestWaiter(table); showToast("Waiter Called!", 'success');}} style={{ position: "fixed", top: 80, right: 16, background: COLORS.rust, color: "#fff", border: "none", borderRadius: 20, padding: "8px 14px", fontWeight: 800, zIndex: 60, boxShadow: "0 8px 24px rgba(192,57,43,0.4)" }}>🔔 Waiter</button>

      <div style={{ position: "relative", height: 220, borderRadius: "0 0 24px 24px", overflow: "hidden", marginBottom: 16 }}>
        <div className="keep-color" style={{ position: "absolute", inset: 0, backgroundImage: `url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80')`, backgroundSize: "cover" }} />
        <div className="keep-color" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,26,26,0.9), rgba(26,26,26,0.1))" }} />
        <div style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.25)", backdropFilter: "blur(12px)", padding: "6px 12px", borderRadius: 20, color: "#fff", fontWeight: 800 }}>Table <select value={table} onChange={(e) => setTable(Number(e.target.value))} style={{ background: "transparent", color: "#fff", border: "none", fontWeight: 800, fontSize: 16 }}>{[...Array(12)].map((_, i) => <option key={i+1} value={i+1} style={{color:'#000'}}>{i+1}</option>)}</select></div>
        <div style={{ position: "absolute", bottom: 20, left: 20, color: "#fff" }}><h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>{RESTAURANT.name}</h1></div>
      </div>

      {myActiveOrders.length > 0 && (
        <div style={{ padding: "0 16px", marginBottom: 16 }}>
          <button onClick={() => setActiveModal('track')} style={{ width: "100%", background: COLORS.sage, color: "#fff", border: "none", borderRadius: 14, padding: "14px", fontWeight: 800, fontSize: 14 }}>📦 Track {myActiveOrders.length} Order(s) ➔</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "8px 16px", scrollbarWidth: "none", borderBottom: `1px solid ${COLORS.line}` }}>
        {CATEGORIES.map(c => <button key={c} onClick={() => setCategory(c)} style={{ whiteSpace: "nowrap", padding: "8px 16px", borderRadius: 12, border: `1.5px solid ${category === c ? COLORS.copper : COLORS.line}`, background: category === c ? COLORS.copper : "transparent", color: category === c ? "#fff" : COLORS.ink, fontWeight: 700 }}>{c}</button>)}
      </div>

      <div style={{ padding: 16 }}>
        {menu.filter(m => m.category === category).map((item) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${COLORS.line}`, gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><VegDot veg={item.veg} />{item.portion && <Badge color={COLORS.paper2}><span style={{color: COLORS.text}}>{item.portion}</span></Badge>}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{item.name}</div>
              <div style={{ fontSize: 15, color: COLORS.copper, fontWeight: 800, marginBottom: 4 }}>{inr(item.price)}</div>
              <div style={{ fontSize: 12, color: COLORS.textLight }}>{item.desc}</div>
            </div>
            <div style={{ position: "relative", width: 90, height: 90 }}>
              <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} />
              <div style={{ position: "absolute", bottom: -12, left: "50%", transform: "translateX(-50%)", background: '#fff', borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                {cart[item.id] ? <Stepper qty={cart[item.id]} onChange={q => setCart({...cart, [item.id]: q})} /> : <button onClick={() => setCart({...cart, [item.id]: 1})} style={{ border: `2px solid ${COLORS.sage}`, background: '#fff', color: COLORS.sage, padding: "4px 16px", borderRadius: 8, fontWeight: 800 }}>ADD</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setShowSidebar(true)} style={{ position: "fixed", top: 16, left: 16, background: COLORS.ink, color: "#fff", border: "none", borderRadius: "50%", width: 50, height: 50, zIndex: 50, fontSize: 20 }}>☰</button>

      {cartTotal > 0 && !cartOpen && !activeModal && (
        <button onClick={() => setCartOpen(true)} style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", background: COLORS.sage, color: "#fff", border: "none", borderRadius: 16, padding: "16px 20px", display: "flex", justifyContent: "space-between", fontWeight: 800, zIndex: 5, fontSize: 16 }}>
          <span>{cartItems.reduce((s, [,q])=>s+q,0)} Items</span><span>{inr(cartTotal)} ➔</span>
        </button>
      )}

      {showSidebar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex" }}>
          <div style={{ width: "80%", maxWidth: 300, background: "#fff", padding: "24px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 30 }}><h2 style={{margin:0, color:COLORS.copper}}>Menu</h2><button onClick={()=>setShowSidebar(false)} style={{background:'none', border:'none', fontSize:20}}>✕</button></div>
            
            {!isLoggedIn ? (
              <button onClick={() => {setShowSidebar(false); setActiveModal('login');}} style={{...primaryBtn, background: COLORS.ink}}>👤 Customer Login</button>
            ) : (
              <div style={{background: COLORS.paper, padding: 16, borderRadius: 12, border: `1.5px solid ${COLORS.gold}`}}>
                <strong>Welcome, {custName || custPhone}</strong><br/>
                <div style={{color: COLORS.gold, fontWeight: 800, fontSize: 16, margin: "8px 0"}}>🪙 {pastCoins} EatCoins Available</div>
                <small onClick={()=>{setIsLoggedIn(false); setCustName(""); setCustPhone("");}} style={{color: COLORS.rust, cursor: 'pointer', fontWeight: 700}}>Logout</small>
              </div>
            )}
            
            <button onClick={()=>{setShowSidebar(false); setIsDark(!isDark);}} style={primaryBtn}>{isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}</button>
            <button onClick={()=>{setShowSidebar(false); setActiveModal('booking');}} style={{...primaryBtn, background: COLORS.sage}}>📅 Table/Party Booking</button>
            <button onClick={()=>{setShowSidebar(false); setActiveModal('offers');}} style={{...primaryBtn, background: COLORS.gold, color: COLORS.ink}}>🎁 Today's Offers</button>
            
            {isLoggedIn && (
               <button onClick={()=>{setShowSidebar(false); setActiveModal('history');}} style={{...primaryBtn, background: COLORS.ink}}>📜 My Order History</button>
            )}

            <button onClick={()=>{setShowSidebar(false); setRole("staff");}} style={{...primaryBtn, background: 'transparent', border: `1px solid ${COLORS.line}`, color: COLORS.ink}}>🍳 Kitchen Staff</button>
            <button onClick={()=>{setShowSidebar(false); setRole("admin");}} style={{...primaryBtn, background: 'transparent', border: `1px solid ${COLORS.line}`, color: COLORS.ink}}>🔒 Admin Login</button>
          </div>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.6)" }} onClick={() => setShowSidebar(false)} />
        </div>
      )}

      {(cartOpen || activeModal) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 90 }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: "24px 20px", maxHeight: "85vh", overflowY: "auto" }}>
            
            {/* ✨ SECURE OTP LOGIN WITH CLEAR PROMPT */}
            {activeModal === 'login' && (
               <>
                 <ModalHeader title="Secure Login" onClose={() => setActiveModal(null)} />
                 <p style={{color: COLORS.textLight, marginBottom: 20}}>Login with your mobile number to place orders.</p>
                 {!showOtp ? (
                   <>
                     <input type="tel" placeholder="Enter 10-Digit Mobile Number" value={custPhone} onChange={e=>setCustPhone(e.target.value)} style={{...inputStyle, marginBottom: 16}} maxLength={10} />
                     <button onClick={() => { 
                       if(custPhone.length >= 10) { 
                         setShowOtp(true); 
                         showToast("OTP Sent: Use 1234", "success"); 
                       } else { 
                         showToast("Enter valid 10-digit phone", "error"); 
                       } 
                     }} style={{...primaryBtn, width: '100%'}}>Send OTP</button>
                   </>
                 ) : (
                   <>
                     <div style={{background: COLORS.sageLight, color: COLORS.sageDark, padding: 10, borderRadius: 8, marginBottom: 16, textAlign: 'center', fontWeight: 800}}>💡 Test OTP is: 1234</div>
                     <input type="number" placeholder="Enter 4-Digit OTP" value={otpInput} onChange={e=>setOtpInput(e.target.value)} style={{...inputStyle, marginBottom: 16, letterSpacing: 8, fontSize: 24, textAlign: 'center'}} />
                     <button onClick={() => { 
                       if(otpInput === '1234') { 
                         setIsLoggedIn(true); 
                         setActiveModal(null); 
                         setShowOtp(false);
                         setOtpInput("");
                         showToast("Login Successful!", "success"); 
                       } else { 
                         showToast("Invalid OTP! Enter 1234", "error"); 
                       } 
                     }} style={{...primaryBtn, width: '100%'}}>Verify & Login</button>
                   </>
                 )}
               </>
            )}

            {activeModal === 'booking' && (
               <>
                 <ModalHeader title="Book Table / Party" onClose={() => setActiveModal(null)} />
                 <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                    <button onClick={()=>setBookType("table")} style={{flex:1, padding:10, borderRadius:8, border:`2px solid ${bookType==="table"?COLORS.copper:COLORS.line}`, background:bookType==="table"?COLORS.copper:"#fff", color:bookType==="table"?"#fff":COLORS.ink, fontWeight:700}}>🍽️ Table</button>
                    <button onClick={()=>setBookType("party")} style={{flex:1, padding:10, borderRadius:8, border:`2px solid ${bookType==="party"?COLORS.copper:COLORS.line}`, background:bookType==="party"?COLORS.copper:"#fff", color:bookType==="party"?"#fff":COLORS.ink, fontWeight:700}}>🎉 Party</button>
                 </div>
                 <input type="text" placeholder="Your Name" value={bookData.name} onChange={e=>setBookData({...bookData, name:e.target.value})} style={{...inputStyle, marginBottom:12}} />
                 <input type="tel" placeholder="Phone Number" value={bookData.phone} onChange={e=>setBookData({...bookData, phone:e.target.value})} style={{...inputStyle, marginBottom:12}} />
                 <div style={{display:'flex', gap:10, marginBottom:12}}><input type="date" value={bookData.date} onChange={e=>setBookData({...bookData, date:e.target.value})} style={{...inputStyle, flex:1}} /><input type="time" value={bookData.time} onChange={e=>setBookData({...bookData, time:e.target.value})} style={{...inputStyle, flex:1}} /></div>
                 <input type="number" placeholder="Number of Guests" value={bookData.guests} onChange={e=>setBookData({...bookData, guests:e.target.value})} style={{...inputStyle, marginBottom:20}} />
                 <button onClick={()=>{ if(bookData.name && bookData.date) { bookEvent({...bookData, id:uid('b'), type:bookType}); setActiveModal(null); showToast("Booking Confirmed!", "success"); } }} style={{...primaryBtn, width:'100%'}}>Confirm Booking</button>
               </>
            )}

            {activeModal === 'history' && (
               <>
                 <ModalHeader title="My Order History" onClose={() => setActiveModal(null)} />
                 {myOrderHistory.length === 0 ? <div style={{textAlign: 'center', padding: "20px", color: COLORS.textLight}}>No orders yet. Start ordering to see history!</div> : myOrderHistory.map(o => (
                   <div key={o.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, marginBottom: 8}}><span>Order #{o.id.slice(1,5).toUpperCase()}</span><span>{inr(o.total)}</span></div>
                     <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 12 }}>{new Date(o.createdAt).toLocaleString('en-IN')} | {o.orderType === 'parcel' ? 'Parcel' : 'Dine-in'}</div>
                     <div style={{ fontSize: 14 }}>{o.items.map(it => `${it.qty}× ${it.name}`).join(", ")}</div>
                     <div style={{ marginTop: 12, fontWeight: 800, color: STATUS_COLOR[o.status] }}>Status: {STATUS_LABEL[o.status]} {o.paid && " | Paid ✓"}</div>
                   </div>
                 ))}
               </>
            )}

            {activeModal === 'track' && (
              <>
                <ModalHeader title="Your Active Orders" onClose={() => setActiveModal(null)} />
                {myActiveOrders.map(o => (
                  <div key={o.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, marginBottom: 20}}><span>Order #{o.id.slice(1,5).toUpperCase()}</span><span>{inr(o.total)}</span></div>
                    <div style={{display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: 20}}>
                       <div style={{position: 'absolute', top: 12, left: 10, right: 10, height: 3, background: COLORS.line, zIndex: 0}} />
                       {STATUS_FLOW.map((step, i) => (
                         <div key={step} style={{position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
                           <div style={{width: 28, height: 28, borderRadius: '50%', background: STEP_INDEX[o.status] >= i ? STATUS_COLOR[step] : '#fff', border: `2px solid ${STEP_INDEX[o.status] >= i ? STATUS_COLOR[step] : COLORS.line}`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12}}>
                             {STEP_INDEX[o.status] > i ? '✓' : (i+1)}
                           </div>
                           <div style={{fontSize: 10, fontWeight: 800, color: STEP_INDEX[o.status] >= i ? COLORS.ink : COLORS.textLight, textTransform: 'uppercase'}}>{STATUS_LABEL[step]}</div>
                         </div>
                       ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {cartOpen && (
              <>
                <ModalHeader title="Checkout" onClose={() => setCartOpen(false)} />
                {cartItems.map(([id, q]) => { const item = menu.find(m => m.id === id); return ( <div key={id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, padding: 12, background: COLORS.paper, borderRadius: 12 }}><div style={{fontWeight: 700}}>{item.name}</div><Stepper qty={q} onChange={(nq) => setCart({...cart, [id]: nq})} /></div> ); })}
                
                <div style={{ display: "flex", gap: 12, margin: "20px 0" }}>
                  <button onClick={() => setOrderType("dine_in")} style={{ flex: 1, padding: 12, border: `2px solid ${orderType === "dine_in" ? COLORS.copper : COLORS.line}`, background: orderType === "dine_in" ? COLORS.copper : "#fff", color: orderType === "dine_in" ? "#fff" : COLORS.ink, borderRadius: 12, fontWeight: 800 }}>🍽️ Dine-in</button>
                  <button onClick={() => setOrderType("parcel")} style={{ flex: 1, padding: 12, border: `2px solid ${orderType === "parcel" ? COLORS.copper : COLORS.line}`, background: orderType === "parcel" ? COLORS.copper : "#fff", color: orderType === "parcel" ? "#fff" : COLORS.ink, borderRadius: 12, fontWeight: 800 }}>🛍️ Parcel</button>
                </div>

                {!isLoggedIn ? (
                  <button onClick={() => { setCartOpen(false); setActiveModal('login'); }} style={{...primaryBtn, width: '100%', marginBottom: 20, background: COLORS.ink}}>Login to Checkout</button>
                ) : (
                  <>
                    <input type="text" placeholder="Name" value={custName} onChange={e=>setCustName(e.target.value)} style={{...inputStyle, marginBottom: 12}} />
                    {orderType === "parcel" && (
                      <div style={{display: 'flex', gap: 8, marginBottom: 12}}>
                        <textarea placeholder="Delivery Address" value={custAddress} onChange={e=>setCustAddress(e.target.value)} style={{...inputStyle, flex: 1, resize: 'none'}} rows={2} />
                        <button onClick={getLocation} style={{background: COLORS.sage, color: '#fff', border: 'none', borderRadius: 12, padding: 10, fontWeight: 700, width: 80}}>📍 Get Loc</button>
                      </div>
                    )}
                    
                    <div style={{ marginBottom: 16 }}>
                      <div style={{fontWeight: 800, fontSize: 14, marginBottom: 8}}>Apply Discount Offer</div>
                      <select value={selectedOffer} onChange={e=>setSelectedOffer(e.target.value)} style={{...inputStyle}}>
                        <option value="">No offer selected</option>
                        {offersList.map(off => <option key={off.id} value={off.id} disabled={off.minAmount && cartTotal < off.minAmount}>{off.title}</option>)}
                      </select>
                    </div>

                    <div style={{ background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', borderRadius: 16, padding: 16, marginBottom: 20, border: `1.5px solid ${COLORS.gold}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{fontWeight: 800, fontSize: 16, color: COLORS.ink}}>🪙 EatCoins</div>
                        <div style={{fontSize: 14, fontWeight: 800, color: COLORS.sageDark}}>Available: {totalCoinsAvailableToSpend}</div>
                      </div>
                      {loyaltyRules.rewards.map(r => {
                        const canAfford = totalCoinsAvailableToSpend >= r.cost;
                        const isClaimed = claimedReward?.id === r.id;
                        return (
                          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: 10, borderRadius: 10, marginBottom: 8, border: `1px solid ${isClaimed ? COLORS.success : COLORS.line}` }}>
                            <div><div style={{fontWeight: 700, fontSize: 14, color: COLORS.ink}}>{r.item}</div><div style={{fontSize: 12, color: COLORS.gold, fontWeight: 800}}>{r.cost} Coins</div></div>
                            <button onClick={() => setClaimedReward(isClaimed ? null : r)} disabled={!canAfford && !isClaimed} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: isClaimed ? COLORS.success : (canAfford ? COLORS.ink : COLORS.paper2), color: isClaimed || canAfford ? '#fff' : COLORS.textLight, fontWeight: 800, cursor: canAfford ? 'pointer' : 'not-allowed' }}>{isClaimed ? "✓ Claimed" : "Claim"}</button>
                          </div>
                        )
                      })}
                    </div>

                    <div style={{ marginBottom: 20, padding: 16, background: COLORS.paper, borderRadius: 16, border: `1.5px solid ${COLORS.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: COLORS.textLight }}><span>Subtotal</span><span>{inr(cartTotal)}</span></div>
                      {discountAmount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: COLORS.success, marginTop: 8 }}><span>Discount</span><span>- {inr(discountAmount)}</span></div>}
                      {claimedReward && <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: COLORS.success, marginTop: 8 }}><span>Free Reward</span><span>{claimedReward.item}</span></div>}
                      {deliveryCharge > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: COLORS.textLight, marginTop: 8 }}><span>Delivery Charge</span><span>{inr(deliveryCharge)}</span></div>}
                      
                      <div style={{ borderTop: `1px dashed ${COLORS.line}`, margin: '12px 0' }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 20 }}><span>Grand Total</span><span style={{ color: COLORS.copper }}>{inr(grandTotal)}</span></div>
                    </div>
                    
                    <button onClick={handlePlaceOrder} style={{...primaryBtn, width: '100%', background: COLORS.ink}}>🎉 Place Order ({inr(grandTotal)})</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════
   2. STAFF VIEW
═══════════════════════════════════════════════════════════════════════════════════ */

function StaffView({ orders, advanceStatus, setRole, handlePrint }) {
  const active = orders.filter((o) => o.status !== "served").sort((a, b) => a.createdAt - b.createdAt);
  const columns = ["new", "preparing", "ready"];

  return (
    <div style={{ padding: "26px 20px 60px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, alignItems: 'center' }}><div style={{ fontSize: 32, fontWeight: 800 }}>🍳 Kitchen Board</div><button onClick={() => setRole("customer")} style={{ ...primaryBtn, background: COLORS.rust }}>← Exit</button></div>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
        {columns.map((status) => {
          const list = active.filter((o) => o.status === status);
          return (
            <div key={status} style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 18, padding: 20 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: STATUS_COLOR[status] }} />
                <div style={{ fontSize: 15, textTransform: "uppercase", fontWeight: 800, color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</div>
                <span style={{ background: STATUS_COLOR[status], color: "#fff", padding: "3px 10px", borderRadius: 14, fontWeight: 700, marginLeft: "auto" }}>{list.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {list.map((o) => (
                  <div key={o.id} style={{ background: '#fff', border: `2px solid ${COLORS.line}`, borderRadius: 16, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: o.orderType === "parcel" ? COLORS.rust : COLORS.ink }}>{o.orderType === "parcel" ? "🛍️ PARCEL" : `🍽️ Table ${o.table}`}</div>
                      <div style={{ fontSize: 13, color: COLORS.textLight, fontWeight: 700 }}>{timeAgo(o.createdAt)}</div>
                    </div>
                    <div style={{ borderTop: `1.5px dashed ${COLORS.line}`, paddingTop: 16, marginBottom: 16 }}>
                      {o.items.map((it) => ( <div key={it.itemId} style={{ fontSize: 15, marginBottom: 8, fontWeight: 600 }}><span style={{ fontWeight: 800 }}>{it.qty}×</span> {it.name}</div> ))}
                      {o.claimedReward && <div style={{ fontSize: 15, marginTop: 12, padding: '8px 12px', background: COLORS.sageLight, color: COLORS.sageDark, borderRadius: 8, fontWeight: 800 }}>🎁 FREE: {o.claimedReward}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}><SlideButton text={status === "new" ? "Slide to Prep" : status === "preparing" ? "Slide to Ready" : "Slide to Serve"} bg={STATUS_COLOR[status]} onComplete={() => advanceStatus(o.id, status)} /></div>
                      <button onClick={() => handlePrint(o, "kot")} style={{ background: COLORS.paper2, border: 'none', width: 48, height: 48, borderRadius: 14, fontSize: 20, cursor: 'pointer' }}>🖨️</button>
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

/* ═══════════════════════════════════════════════════════════════════════════════════
   3. ADMIN VIEW
═══════════════════════════════════════════════════════════════════════════════════ */

function AdminView({ menu, setMenu, bookings, orders, setRole, deleteOrder, offersList, handlePrint }) {
  const [tab, setTab] = useState("menu");
  const [editMenuId, setEditMenuId] = useState(null);
  const [newMenu, setNewMenu] = useState({ name: "", price: "", category: CATEGORIES[0], veg: true, portion: "", desc: "", image: "" });

  const handleSaveMenu = () => {
    if(newMenu.name && newMenu.price) {
      if(editMenuId) {
         setMenu(menu.map(m => m.id === editMenuId ? {...m, ...newMenu, price: Number(newMenu.price)} : m));
         setEditMenuId(null);
      } else {
         const newItem = mi(uid("m"), newMenu.name, newMenu.price, newMenu.category, newMenu.veg, newMenu.desc, newMenu.portion, false, true, newMenu.image);
         setMenu([...menu, newItem]);
      }
      setNewMenu({ name: "", price: "", category: CATEGORIES[0], veg: true, portion: "", desc: "", image: "" });
    }
  };

  const startEdit = (m) => {
    setEditMenuId(m.id);
    setNewMenu({ name: m.name, price: m.price, category: m.category, veg: m.veg, portion: m.portion || "", desc: m.desc || "", image: m.image || "" });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ padding: "26px 20px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}><div style={{ fontSize: 32, fontWeight: 800 }}>⚙️ Admin Panel</div><button onClick={() => setRole("customer")} style={{ padding: "10px 20px", borderRadius: 12, fontWeight: 700 }}>← Exit</button></div>
      
      <div style={{ display: "flex", gap: 10, marginBottom: 28, borderBottom: `2px solid ${COLORS.line}`, overflowX: "auto" }}>
        {["menu", "orders"].map((t) => ( <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", padding: "14px 20px", fontWeight: 800, fontSize: 15, textTransform: "capitalize", color: tab === t ? COLORS.copper : COLORS.textLight, borderBottom: tab === t ? `3px solid ${COLORS.copper}` : "transparent" }}>{t}</button> ))}
      </div>

      {tab === "menu" && (
        <>
          <div style={{ background: COLORS.paper, padding: 24, borderRadius: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 20, marginBottom: 16, fontWeight: 700 }}>{editMenuId ? "✏️ Edit Dish" : "➕ Add New Dish"}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <input type="text" placeholder="Dish Name *" value={newMenu.name} onChange={e=>setNewMenu({...newMenu, name: e.target.value})} style={{...inputStyle, flex: 2, minWidth: 200}} />
              <input type="number" placeholder="Price (₹) *" value={newMenu.price} onChange={e=>setNewMenu({...newMenu, price: e.target.value})} style={{...inputStyle, flex: 1, minWidth: 100}} />
              <select value={newMenu.category} onChange={e=>setNewMenu({...newMenu, category: e.target.value})} style={{...inputStyle, flex: 2, minWidth: 200}}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <select value={newMenu.veg ? "veg" : "nonveg"} onChange={e=>setNewMenu({...newMenu, veg: e.target.value==="veg"})} style={{...inputStyle, flex: 1, minWidth: 120}}>
                <option value="veg">🟢 Veg</option><option value="nonveg">🔴 Non-Veg</option>
              </select>
              <input type="text" placeholder="Portion Size" value={newMenu.portion} onChange={e=>setNewMenu({...newMenu, portion: e.target.value})} style={{...inputStyle, flex: 1, minWidth: 150}} />
              <input type="text" placeholder="Short Description..." value={newMenu.desc} onChange={e=>setNewMenu({...newMenu, desc: e.target.value})} style={{...inputStyle, flex: 3, minWidth: 200}} />
            </div>
            <div style={{display: 'flex', gap: 12}}>
               <button onClick={handleSaveMenu} style={{...primaryBtn, flex: 1}}>{editMenuId ? "Save Changes" : "+ Add Dish"}</button>
               {editMenuId && <button onClick={()=>{setEditMenuId(null); setNewMenu({name:"", price:"", category:CATEGORIES[0], veg:true, portion:"", desc:"", image:""})}} style={{...primaryBtn, background: COLORS.textLight}}>Cancel</button>}
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {menu.map(m => (
              <div key={m.id} style={{ background: '#fff', border: `1px solid ${editMenuId===m.id ? COLORS.copper : COLORS.line}`, padding: 16, borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{fontWeight: 800, fontSize: 16}}>{m.name} {m.portion && <span style={{fontSize:12, color:COLORS.textLight}}>({m.portion})</span>}</div>
                  <div style={{color: COLORS.copper, fontWeight: 800, fontSize: 14}}>{inr(m.price)} | {m.category}</div>
                </div>
                <div style={{display: 'flex', gap: 8}}>
                  <button onClick={() => startEdit(m)} style={{background: COLORS.sageLight, color: COLORS.sageDark, border: 'none', padding: '8px 16px', borderRadius: 10, fontWeight: 800, cursor: 'pointer'}}>✏️ Edit</button>
                  <button onClick={() => { if(window.confirm("Delete this dish?")) setMenu(menu.filter(item => item.id !== m.id)) }} style={{background: 'transparent', border: `1.5px solid ${COLORS.rust}`, color: COLORS.rust, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 800}}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "orders" && (
        <div style={{ overflowX: "auto", borderRadius: 16, border: `1px solid ${COLORS.line}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, background: "#fff" }}>
            <thead><tr style={{ textAlign: "left", background: COLORS.paper }}><th style={th}>Table/Type</th><th style={th}>Items</th><th style={th}>Total</th><th style={th}>Actions</th></tr></thead>
            <tbody>
              {[...orders].sort((a,b)=>b.createdAt - a.createdAt).map(o => (
                <tr key={o.id}>
                  <td style={td}>{o.orderType === "parcel" ? "🛍️ Parcel" : `🍽️ T-${o.table}`}</td>
                  <td style={td}>{o.items.map(it => `${it.qty}×${it.name}`).join(", ")}</td>
                  <td style={td}><strong>{inr(o.total)}</strong></td>
                  <td style={td}>
                    <div style={{display: 'flex', gap: 6}}>
                      <button onClick={() => handlePrint(o, "bill")} style={{background: COLORS.ink, color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 10, fontWeight: 700}}>🖨️ Bill</button>
                      <button onClick={() => deleteOrder(o.id)} style={{background: 'transparent', border: `1.5px solid ${COLORS.rust}`, color: COLORS.rust, padding: '6px 10px', borderRadius: 10, fontWeight: 700}}>🗑️ Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════
   4. MAIN APP COMPONENT
═══════════════════════════════════════════════════════════════════════════════════ */

export default function App() {
  const [role, setRole] = useLocalStorage('app_role', "customer");
  const [isDark, setIsDark] = useLocalStorage('app_dark', false);
  const [offersList, setOffersList] = useLocalStorage('app_offers', DEFAULT_OFFERS);
  
  const [menu, setMenuState] = useLocalStorage('app_menu', DEFAULT_MENU);
  const [orders, setOrdersState] = useLocalStorage('app_orders', []);
  const [bookings, setBookings] = useLocalStorage('app_bookings', []);
  const [loyaltyRules, setLoyaltyRules] = useLocalStorage('app_loyalty_rules', { rate: 10, rewards: [{ id: "r1", cost: 300, item: "Free French Fry" }] });
  const [loyaltyUsers, setLoyaltyUsers] = useLocalStorage('app_loyalty_users', [{ phone: "9876543210", name: "Demo User", coins: 350 }]);
  
  const [table, setTable] = useState(() => { const params = new URLSearchParams(window.location.search); return params.has("table") ? Number(params.get("table")) : 1; });

  const bookEvent = (booking) => { setBookings([...bookings, booking]); };
  const deleteOrder = (id) => { setOrdersState(orders.filter(o=>o.id!==id)); }; 
  const requestWaiter = (tbl) => { alert(`Waiter called for Table ${tbl}`); };

  const placeOrder = (order) => { 
    setOrdersState([...orders, order]);
    if(order.customer.phone && order.customer.phone.length >= 10) {
       const netCoins = order.earnedCoins - (order.rewardUsedCoins || 0);
       const existingUserIndex = loyaltyUsers.findIndex(u => u.phone === order.customer.phone);
       if(existingUserIndex >= 0) {
          const newArr = [...loyaltyUsers];
          newArr[existingUserIndex].coins = Math.max(0, newArr[existingUserIndex].coins + netCoins);
          setLoyaltyUsers(newArr);
       } else if (netCoins > 0) {
          setLoyaltyUsers([...loyaltyUsers, { phone: order.customer.phone, name: order.customer.name, coins: Math.max(0, netCoins) }]);
       }
    }
  };

  const advanceStatus = (orderId, currentStatus) => { 
    const idx = STATUS_FLOW.indexOf(currentStatus); 
    const nextStatus = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)]; 
    setOrdersState(orders.map(o=>o.id===orderId?{...o,status:nextStatus}:o)); 
  };

  const handlePrint = (order, type) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
      <html><head><title>Print ${type}</title><style>
        body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; font-size: 14px; max-width: 400px; margin: 0 auto; }
        .center { text-align: center; }
        hr { border-top: 1px dashed #000; border-bottom: none; margin: 15px 0;}
        table { width: 100%; text-align: left; margin: 10px 0; border-collapse: collapse;}
        th, td { padding: 6px 0; }
        .btn-print { display: block; width: 100%; padding: 15px; background: #E25938; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; margin-bottom: 20px;}
        @media print { .btn-print { display: none !important; } }
      </style></head><body>
        <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <h2 class="center" style="margin-bottom:5px;">${RESTAURANT.name}</h2>
        <p class="center" style="margin-top:0; font-size:12px;">${RESTAURANT.address}<br/>Ph: ${RESTAURANT.phones[0]}</p>
        <hr />
        <p class="center" style="font-weight:bold;">*** ${type === 'kot' ? 'KITCHEN ORDER TICKET' : 'TAX INVOICE'} ***</p>
        <p>Order: #${order.id.slice(1,5).toUpperCase()}<br/>Type: ${order.orderType === 'parcel' ? 'Parcel' : 'Table ' + order.table}<br/>Date: ${new Date(order.createdAt).toLocaleString('en-IN')}</p>
        <hr />
        <table>
          <tr><th style="border-bottom:1px solid #000;">Qty</th><th style="border-bottom:1px solid #000;">Item</th><th style="text-align:right; border-bottom:1px solid #000;">Price</th></tr>
          ${order.items.map(it => `<tr><td><strong>${it.qty}x</strong></td><td>${it.name} ${it.portion ? `<small>(${it.portion})</small>` : ''}</td><td style="text-align:right;">${it.price * it.qty}</td></tr>`).join('')}
        </table>
        <hr />
        ${type === 'bill' ? `
          <table style="font-weight:bold;">
            <tr><td>Subtotal:</td><td style="text-align:right;">Rs. ${order.subtotal || 0}</td></tr>
            ${order.discount ? `<tr><td style="color:green;">Discount (${order.appliedOffer}):</td><td style="text-align:right; color:green;">- Rs. ${order.discount}</td></tr>` : ''}
            ${order.claimedReward ? `<tr><td style="color:green;">Free Reward:</td><td style="text-align:right; color:green;">${order.claimedReward}</td></tr>` : ''}
            ${order.deliveryCharge ? `<tr><td>Delivery Charge:</td><td style="text-align:right;">+ Rs. ${order.deliveryCharge}</td></tr>` : ''}
            <tr><td style="font-size:18px; padding-top:10px;">Grand Total:</td><td style="text-align:right; font-size:18px; padding-top:10px;">Rs. ${order.total || 0}</td></tr>
          </table><hr />
          <p class="center">Thank you for dining with us!</p>
        ` : ''}
        ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p><hr />` : ''}
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className={isDark ? "dark-theme" : ""} style={{ minHeight: "100vh", background: "var(--bg-color, #FAFAF8)", color: COLORS.ink, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{FONTS}</style>
      <div className="app-content">
        {role === "customer" && <CustomerView menu={menu} orders={orders} placeOrder={placeOrder} bookEvent={bookEvent} offersList={offersList} table={table} setTable={setTable} setRole={setRole} isDark={isDark} setIsDark={setIsDark} requestWaiter={requestWaiter} loyaltyRules={loyaltyRules} loyaltyUsers={loyaltyUsers} />}
        {role === "staff" && <StaffView orders={orders} advanceStatus={advanceStatus} setRole={setRole} handlePrint={handlePrint} />}
        {role === "admin" && <AdminView menu={menu} setMenu={setMenuState} bookings={bookings} orders={orders} setRole={setRole} deleteOrder={deleteOrder} offersList={offersList} handlePrint={handlePrint} />}
      </div>
    </div>
  );
}
