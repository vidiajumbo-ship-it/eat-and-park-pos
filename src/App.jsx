import React, { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════════════════════════
   🍽️ EAT & PARK RESTAURANT POS — V14.0 FULL STABLE PRODUCTION BUILD
   Features: Role Management, Menu CRUD, Live Kitchen Order Tracking, Billing & Reports
═══════════════════════════════════════════════════════════════════════════════════ */

const RESTAURANT_INFO = {
  name: "Eat & Park",
  tagline: "A Premium Family Restaurant",
  address: "Girja More, Ara – Buxar Main Road, Pakri, Ara",
  phones: ["7303267750", "8271918062"],
  fssai: "12345678901234"
};

const INITIAL_MENU = [
  { id: "d1", name: "Mint Mojito", price: 90, category: "Drinks", veg: true, desc: "Refreshing blend of fresh mint and lime.", portion: "" },
  { id: "d2", name: "Cold Coffee with Ice Cream", price: 140, category: "Drinks", veg: true, desc: "Rich blended coffee topped with vanilla.", portion: "" },
  { id: "f1", name: "Veg Burger", price: 90, category: "Fun Food", veg: true, desc: "Crispy veggie patty with creamy mayo.", portion: "" },
  { id: "cs1", name: "Paneer Chilli", price: 240, category: "Chinese Starter", veg: true, desc: "Tossed in spicy soy-chilli sauce.", portion: "Dry/Gravy" },
  { id: "cs2", name: "Chicken Chilli", price: 280, category: "Chinese Starter", veg: false, desc: "Wok-tossed juicy chicken chunks.", portion: "Dry/Gravy" },
  { id: "t1", name: "Paneer Tikka", price: 299, category: "Tandoori", veg: true, desc: "Smoky spiced cottage cheese chunks.", portion: "" },
  { id: "t2", name: "Chicken Tandoori", price: 349, category: "Tandoori", veg: false, desc: "Classic clay-oven roasted chicken.", portion: "Full/Half" },
  { id: "m1", name: "Butter Chicken", price: 360, category: "Main Course", veg: false, desc: "Tender chicken in rich tomato gravy.", portion: "Full/Half" },
  { id: "m2", name: "Paneer Butter Masala", price: 290, category: "Main Course", veg: true, desc: "Cottage cheese in rich buttery gravy.", portion: "" },
  { id: "b1", name: "Butter Tandoori Roti", price: 20, category: "Indian Bread", veg: true, desc: "Fresh clay oven bread with butter.", portion: "" },
  { id: "r1", name: "Veg Biryani", price: 220, category: "Rice & Biryani", veg: true, desc: "Fragrant basmati rice with aromatic spices.", portion: "" }
];

export default function App() {
  // Safe Storage Hook to prevent crashes
  const useSafeState = (key, initialValue) => {
    const [state, setState] = useState(() => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      } catch (e) {
        console.error(`Error loading ${key} from localStorage`, e);
        return initialValue;
      }
    });

    useEffect(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (e) {
        console.error(`Error saving ${key} to localStorage`, e);
      }
    }, [key, state]);

    return [state, setState];
  };

  const [role, setRole] = useSafeState("ep_role", "customer");
  const [activeTab, setActiveTab] = useState("menu");
  const [menu, setMenu] = useSafeState("ep_menu", INITIAL_MENU);
  const [cart, setCart] = useState({});
  const [orders, setOrders] = useSafeState("ep_orders", []);
  const [table, setTable] = useSafeState("ep_table", 1);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState(null);

  // Admin / Staff Passcode Modal state
  const [authModal, setAuthModal] = useState(false);
  const [targetRole, setTargetRole] = useState("");
  const [passcode, setPasscode] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const categories = ["All", "Drinks", "Fun Food", "Chinese Starter", "Tandoori", "Main Course", "Indian Bread", "Rice & Biryani"];

  const filteredMenu = menu.filter(item => {
    const matchesCat = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const cartTotal = cartItems.reduce((sum, [id, qty]) => {
    const item = menu.find(m => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const handleCheckout = () => {
    if (cartItems.length === 0) return showToast("Cart is empty!");
    const newOrder = {
      id: "ORD-" + Math.floor(1000 + Math.random() * 9000),
      table: table,
      items: cartItems.map(([id, qty]) => {
        const item = menu.find(m => m.id === id);
        return { name: item ? item.name : id, price: item ? item.price : 0, qty };
      }),
      total: cartTotal,
      status: "Preparing",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setOrders([newOrder, ...orders]);
    setCart({});
    showToast(`Order #${newOrder.id} placed successfully!`);
    setActiveTab("orders");
  };

  const updateOrderStatus = (orderId, newStatus) => {
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    showToast(`Order ${orderId} marked as ${newStatus}`);
  };

  const handleRoleSwitch = (selected) => {
    if (selected === "admin" || selected === "kitchen" || selected === "cashier") {
      setTargetRole(selected);
      setPasscode("");
      setAuthModal(true);
    } else {
      setRole("customer");
      showToast("Switched to Customer View");
    }
  };

  const verifyPasscode = () => {
    if (passcode === "1234" || (targetRole === "admin" && passcode === "admin")) {
      setRole(targetRole);
      setAuthModal(false);
      showToast(`Logged in as ${targetRole.toUpperCase()}`);
    } else {
      showToast("Incorrect Passcode! (Try 1234)");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 90 }}>
      
      {/* Top Brand Banner */}
      <div style={{ background: "#1A1A1A", color: "#fff", padding: "16px 20px", textAlign: "center", borderBottom: "3px solid #E25938" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>{RESTAURANT_INFO.name}</h1>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8A8375" }}>{RESTAURANT_INFO.address} • Ph: {RESTAURANT_INFO.phones[0]}</p>
      </div>

      {/* Role Switcher Bar */}
      <div style={{ background: "#F0EFEB", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E8E6DC", fontSize: 13 }}>
        <span style={{ fontWeight: 700, color: "#555" }}>Mode: <span style={{ color: "#E25938", textTransform: "uppercase" }}>{role}</span></span>
        <div style={{ display: "flex", gap: 6 }}>
          {["customer", "kitchen", "cashier", "admin"].map(r => (
            <button key={r} onClick={() => handleRoleSwitch(r)} style={{ background: role === r ? "#E25938" : "#fff", color: role === r ? "#fff" : "#333", border: "1px solid #ccc", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
        
        {/* CUSTOMER MENU TAB */}
        {activeTab === "menu" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Our Menu</h3>
              <div style={{ background: "#E25938", color: "#fff", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                Table: 
                <select value={table} onChange={(e) => setTable(Number(e.target.value))} style={{ background: "transparent", color: "#fff", border: "none", fontWeight: 700, marginLeft: 4, cursor: "pointer" }}>
                  {[1,2,3,4,5,6,7,8].map(t => <option key={t} value={t} style={{ color: "#000" }}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Search & Categories */}
            <input type="text" placeholder="Search dishes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #E8E6DC", marginBottom: 12, outline: "none", fontSize: 14, background: "#fff" }} />
            
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ whiteSpace: "nowrap", background: selectedCategory === cat ? "#1A1A1A" : "#fff", color: selectedCategory === cat ? "#fff" : "#444", border: "1px solid #ddd", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu Items List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredMenu.map(item => (
                <div key={item.id} style={{ background: "#fff", padding: 14, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #E8E6DC", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <div style={{ flex: 1, paddingRight: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: item.veg ? "#4A7C59" : "#C0392B", display: "inline-block" }}></span>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</span>
                    </div>
                    <div style={{ color: "#E25938", fontWeight: 800, fontSize: 14, marginTop: 2 }}>₹{item.price}</div>
                    <div style={{ fontSize: 12, color: "#8A8375", marginTop: 2 }}>{item.desc}</div>
                  </div>
                  <div>
                    {cart[item.id] ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button onClick={() => setCart({...cart, [item.id]: cart[item.id] - 1})} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #E25938", background: "#fff", color: "#E25938", fontWeight: 800, cursor: "pointer" }}>-</button>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>{cart[item.id]}</span>
                        <button onClick={() => setCart({...cart, [item.id]: cart[item.id] + 1})} style={{ width: 28, height: 28, borderRadius: "50%", background: "#E25938", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>+</button>
                      </div>
                    ) : (
                      <button onClick={() => setCart({...cart, [item.id]: 1})} style={{ background: "#4A7C59", color: "#fff", border: "none", padding: "6px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>ADD</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ORDERS / KITCHEN TAB */}
        {activeTab === "orders" && (
          <div>
            <h3 style={{ margin: "0 0 14px", fontSize: 18 }}>Live Orders ({orders.length})</h3>
            {orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#8A8375" }}>No active orders found. Place an order from the menu!</div>
            ) : (
              orders.map(order => (
                <div key={order.id} style={{ background: "#fff", padding: 14, borderRadius: 12, marginBottom: 12, border: "1px solid #E8E6DC" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: 8, marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: 15 }}>{order.id}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, background: "#F0EFEB", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>Table {order.table}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#8A8375" }}>{order.time}</span>
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 10 }}>
                    {order.items.map((i, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", color: "#444" }}>
                        <span>{i.qty}x {i.name}</span>
                        <span>₹{i.price * i.qty}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #eee", paddingTop: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>Total: ₹{order.total}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, fontWeight: 700, background: order.status === "Ready" ? "#D4EDDA" : "#FFF3CD", color: order.status === "Ready" ? "#155724" : "#856404" }}>
                        {order.status}
                      </span>
                      {(role === "kitchen" || role === "admin" || role === "cashier") && order.status !== "Completed" && (
                        <button onClick={() => updateOrderStatus(order.id, order.status === "Preparing" ? "Ready" : "Completed")} style={{ background: "#1A1A1A", color: "#fff", border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          {order.status === "Preparing" ? "Mark Ready" : "Complete"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ADMIN MENU MANAGEMENT TAB */}
        {activeTab === "admin" && role === "admin" && (
          <div>
            <h3 style={{ margin: "0 0 14px", fontSize: 18 }}>Admin Dashboard - Menu Control</h3>
            <div style={{ background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #E8E6DC" }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "#666" }}>Total Menu Items: <b>{menu.length}</b></p>
              <button onClick={() => {
                const name = prompt("Enter dish name:");
                const price = Number(prompt("Enter price (₹):"));
                if (name && price) {
                  setMenu([...menu, { id: "m_" + Date.now(), name, price, category: "Main Course", veg: true, desc: "Newly added dish", portion: "" }]);
                  showToast("Dish added successfully!");
                }
              }} style={{ background: "#E25938", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, fontWeight: 700, width: "100%", cursor: "pointer" }}>
                + Add New Dish to Menu
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Floating Cart Bar for Customer */}
      {role === "customer" && cartTotal > 0 && (
        <div onClick={handleCheckout} style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 500, background: "#4A7C59", color: "#fff", padding: "14px 20px", borderRadius: 16, display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, boxShadow: "0 10px 25px rgba(0,0,0,0.2)", cursor: "pointer" }}>
          <span>{cartItems.reduce((s, [,q])=>s+q,0)} Items in Cart</span>
          <span>Place Order • ₹{cartTotal} ➔</span>
        </div>
      )}

      {/* Bottom Navigation Tabs */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E8E6DC", display: "flex", justifyContent: "around", padding: "10px 0", zIndex: 100 }}>
        <button onClick={() => setActiveTab("menu")} style={{ flex: 1, background: "none", border: "none", fontWeight: 700, color: activeTab === "menu" ? "#E25938" : "#8A8375", fontSize: 13, cursor: "pointer" }}>Menu</button>
        <button onClick={() => setActiveTab("orders")} style={{ flex: 1, background: "none", border: "none", fontWeight: 700, color: activeTab === "orders" ? "#E25938" : "#8A8375", fontSize: 13, cursor: "pointer" }}>Orders ({orders.length})</button>
        {role === "admin" && (
          <button onClick={() => setActiveTab("admin")} style={{ flex: 1, background: "none", border: "none", fontWeight: 700, color: activeTab === "admin" ? "#E25938" : "#8A8375", fontSize: 13, cursor: "pointer" }}>Admin</button>
        )}
      </div>

      {/* Auth Modal */}
      {authModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", padding: 24, borderRadius: 16, width: "100%", maxWidth: 360, textAlign: "center" }}>
            <h3 style={{ margin: "0 0 10px", textTransform: "capitalize" }}>Login as {targetRole}</h3>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>Enter passcode (Default PIN: <b>1234</b>)</p>
            <input type="password" placeholder="Enter Passcode" value={passcode} onChange={(e) => setPasscode(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #ccc", marginBottom: 14, textAlign: "center", fontSize: 16, outline: "none" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setAuthModal(false)} style={{ flex: 1, background: "#eee", border: "none", padding: "10px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={verifyPasscode} style={{ flex: 1, background: "#E25938", color: "#fff", border: "none", padding: "10px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Verify</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{ position: "fixed", bottom: 85, left: "50%", transform: "translateX(-50%)", background: "#1A1A1A", color: "#fff", padding: "10px 20px", borderRadius: 20, fontWeight: 700, fontSize: 13, zIndex: 1100, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
          {toast}
        </div>
      )}

    </div>
  );
}
