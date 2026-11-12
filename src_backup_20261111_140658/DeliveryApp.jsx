import React, { useState, useEffect, useRef, useMemo } from "react";
import { db, auth } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";

const timeAgo = (ts) => {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
};

const alertAudio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
alertAudio.volume = 1.0;

export default function DeliveryApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  
  const [activeOrders, setActiveOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  
  const [page, setPage] = useState("orders"); // orders | dashboard | history
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const prevOrdersRef = useRef([]);
  const isFirstLoad = useRef(true);

  // Unlock audio on first user interaction
  useEffect(() => {
    const unlock = () => {
      alertAudio.play().then(() => {
        alertAudio.pause();
        alertAudio.currentTime = 0;
      }).catch(() => {});
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Auth Check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const s = await getDoc(doc(db, "staff", u.uid));
          if (s.exists() && s.data().role === "delivery") {
            setUser(u);
          } else {
            await signOut(auth);
            setLoginError("Ye account delivery boy ka nahi hai.");
          }
        } catch (e) { console.error(e); }
      } else { setUser(null); }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch Orders
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "orders"), where("orderType", "==", "parcel"));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Strict Filter: Sirf valid delivery orders (No Walk-ins, No missing address/phone)
      const validOrders = all.filter(o => 
        o.status !== "cancelled" &&
        o.customer?.name && o.customer.name !== "Walk-in" &&
        o.customer?.phone && o.customer?.phone.length >= 10 &&
        (o.customer?.exactAddress || o.customer?.address)
      );

      const active = validOrders
        .filter(o => o.status !== "served")
        .sort((a, b) => b.createdAt - a.createdAt);
      
      // 🔔 Notification Alert Logic
      if (!isFirstLoad.current) {
        const newOrders = active.filter(o => !prevOrdersRef.current.includes(o.id));
        if (newOrders.length > 0) {
          try {
            alertAudio.currentTime = 0;
            alertAudio.play().catch(e => console.log("Audio blocked", e));
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
          } catch (e) {}
        }
      }
      
      prevOrdersRef.current = active.map(o => o.id);
      isFirstLoad.current = false;
      
      setActiveOrders(active);

      const hist = validOrders
        .filter(o => o.status === "served" && (!o.deliveredBy || o.deliveredBy === user.email || o.deliveredBy === user.uid))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50);
      setHistoryOrders(hist);
    });
    return () => unsub();
  }, [user]);

  // Stats for Dashboard
  const stats = useMemo(() => {
    const today = new Date().setHours(0,0,0,0);
    const myHist = historyOrders.filter(o => o.deliveredAt >= today);
    const cash = myHist.reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);
    return { count: myHist.length, cash };
  }, [historyOrders]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try { 
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password); 
    }
    catch (err) { setLoginError("Email ya password galat hai."); }
  };

  const markOutForDelivery = async (orderId) => {
    if (!window.confirm("Kya aapne restaurant se order pick up kar liya hai?")) return;
    try {
      await updateDoc(doc(db, "orders", orderId), { status: "out_for_delivery" });
    } catch (e) { alert("Error: " + e.message); }
  };

  const markDelivered = async (orderId) => {
    if (!window.confirm("Kya aapne order deliver kar diya aur paisa collect kar liya?")) return;
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "served",
        paid: true,
        paymentStatus: "paid",
        deliveredAt: Date.now(),
        deliveredBy: user.email || user.uid
      });
      setSelectedOrder(null);
      alert("Order delivered successfully! 🎉");
    } catch (e) { alert("Error: " + e.message); }
  };

  if (loading) return <div style={{ padding: 50, textAlign: "center", color: "#fff", background: "#0B111A", minHeight: "100vh" }}>Loading...</div>;

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#0B111A", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#161F2F", padding: 30, borderRadius: 20, width: "100%", maxWidth: 400, border: "1px solid #273449" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 50 }}>🛵</div>
            <h2 style={{ color: "#fff", margin: "10px 0" }}>Delivery Partner</h2>
          </div>
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", padding: 14, marginBottom: 10, borderRadius: 10, border: "1px solid #273449", background: "#0B111A", color: "#fff", boxSizing: "border-box" }} required />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", padding: 14, marginBottom: 10, borderRadius: 10, border: "1px solid #273449", background: "#0B111A", color: "#fff", boxSizing: "border-box" }} required />
            {loginError && <div style={{ color: "#EF4444", fontSize: 13, marginBottom: 10 }}>{loginError}</div>}
            <button type="submit" style={{ width: "100%", padding: 14, borderRadius: 10, background: "#F59E0B", color: "#fff", border: "none", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  const ordersToShow = page === "history" ? historyOrders : activeOrders;

  return (
    <div style={{ minHeight: "100vh", background: "#0B111A", color: "#fff", paddingBottom: 20 }}>
      
      {/* HEADER & HAMBURGER MENU */}
      <div style={{ background: "#F59E0B", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <button onClick={() => setMenuOpen(true)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 24, cursor: "pointer", padding: 0 }}>
            ☰
          </button>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Delivery Panel</div>
        </div>
        <div style={{ fontSize: 12, background: "rgba(0,0,0,0.15)", padding: "6px 12px", borderRadius: 8, fontWeight: 700 }}>
          {user.email.split('@')[0]}
        </div>
      </div>

      {/* SIDEBAR / DRAWER */}
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex" }} onClick={() => setMenuOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 260, background: "#161F2F", height: "100%", display: "flex", flexDirection: "column", padding: 20, animation: "slideInLeft 0.2s ease-out" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30, paddingBottom: 20, borderBottom: "1px solid #273449" }}>
              <div style={{ width: 45, height: 45, background: "#F59E0B", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff" }}>🛵</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{user.email.split('@')[0]}</div>
                <div style={{ fontSize: 11, color: "#8B9BB4" }}>Delivery Partner</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => { setPage("orders"); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: page === "orders" ? "#273449" : "transparent", border: "none", borderRadius: 10, color: page === "orders" ? "#F59E0B" : "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 18 }}>📦</span> Active Orders ({activeOrders.length})
              </button>
              <button onClick={() => { setPage("history"); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: page === "history" ? "#273449" : "transparent", border: "none", borderRadius: 10, color: page === "history" ? "#F59E0B" : "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 18 }}>🕘</span> Order History
              </button>
              <button onClick={() => { setPage("dashboard"); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: page === "dashboard" ? "#273449" : "transparent", border: "none", borderRadius: 10, color: page === "dashboard" ? "#F59E0B" : "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 18 }}>📊</span> Dashboard
              </button>
              
              <div style={{ borderTop: "1px solid #273449", margin: "10px 0" }}></div>
              
              <button onClick={() => signOut(auth)} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: "transparent", border: "none", borderRadius: 10, color: "#EF4444", fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 18 }}>🚪</span> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div style={{ padding: 15, maxWidth: 600, margin: "0 auto" }}>
        
        {/* DASHBOARD PAGE */}
        {page === "dashboard" && (
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 20 }}>Today's Stats</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
              <div style={{ background: "#161F2F", padding: 20, borderRadius: 16, border: "1px solid #273449" }}>
                <div style={{ fontSize: 28, marginBottom: 5 }}>✅</div>
                <div style={{ fontSize: 12, color: "#8B9BB4", fontWeight: 700 }}>Deliveries Done</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#10B981" }}>{stats.count}</div>
              </div>
              <div style={{ background: "#161F2F", padding: 20, borderRadius: 16, border: "1px solid #273449" }}>
                <div style={{ fontSize: 28, marginBottom: 5 }}>💵</div>
                <div style={{ fontSize: 12, color: "#8B9BB4", fontWeight: 700 }}>Cash Collected</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#F59E0B", marginTop: 4 }}>₹{stats.cash}</div>
              </div>
            </div>
          </div>
        )}

        {/* ORDERS LIST PAGE (Active/History) */}
        {page !== "dashboard" && (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 15, color: "#fff" }}>
              {page === "orders" ? "Active Orders" : "Recent Deliveries"}
            </h2>
            
            {ordersToShow.length === 0 && (
              <div style={{ textAlign: "center", padding: 50, color: "#8B9BB4" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>😴</div>
                <div>{page === "orders" ? "Koi naya order nahi hai." : "Abhi tak kuch deliver nahi kiya."}</div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ordersToShow.map(o => (
                <div key={o.id} onClick={() => setSelectedOrder(o)} style={{ background: "#161F2F", border: "1px solid #273449", padding: 14, borderRadius: 14, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 900, color: "#F59E0B", fontSize: 15 }}>#{o.id.slice(1,5).toUpperCase()}</span>
                      <span style={{ fontSize: 10, color: "#8B9BB4", background: "#273449", padding: "2px 6px", borderRadius: 4 }}>
                        {o.status === "out_for_delivery" ? "ON THE WAY" : o.status === "ready" ? "READY TO PICK" : o.status === "preparing" ? "COOKING" : "NEW ORDER"}
                      </span>
                      <span style={{ fontSize: 10, color: "#8B9BB4" }}>{timeAgo(o.createdAt)}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 4 }}>{o.customer?.name}</div>
                    <div style={{ fontSize: 12, color: "#8B9BB4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                      📍 {o.customer?.exactAddress || o.customer?.address}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", marginLeft: 10 }}>
                    <div style={{ fontWeight: 900, fontSize: 18, color: o.paid ? "#10B981" : "#F59E0B" }}>₹{o.finalTotal}</div>
                    <div style={{ fontSize: 9, color: o.paid ? "#10B981" : "#F59E0B", marginTop: 2, fontWeight: 700, background: o.paid ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", padding: "2px 6px", borderRadius: 4 }}>
                      {o.paid ? "PAID" : "COLLECT"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#161F2F", width: "100%", maxWidth: 600, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: 20, maxHeight: "92vh", overflowY: "auto", animation: "slideUp 0.3s ease-out" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Order #{selectedOrder.id.slice(1,5).toUpperCase()}</div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: "#273449", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 16, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>

            {/* CUSTOMER DETAILS */}
            <div style={{ background: "#0B111A", padding: 15, borderRadius: 12, marginBottom: 15 }}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 5 }}>{selectedOrder.customer?.name}</div>
              <div style={{ color: "#8B9BB4", marginBottom: 10, fontWeight: 700 }}>📞 {selectedOrder.customer?.phone}</div>
              <div style={{ color: "#fff", marginBottom: 15, lineHeight: 1.4, fontSize: 14 }}>
                📍 {selectedOrder.customer?.exactAddress} {selectedOrder.customer?.pincode ? "(PIN: " + selectedOrder.customer.pincode + ")" : ""}
              </div>
              
              <div style={{ display: "flex", gap: 10 }}>
                {selectedOrder.customer?.address?.includes("Lat:") && (
                  <button onClick={() => {
                    const match = selectedOrder.customer.address.match(/Lat: ([\d.-]+), Lng: ([\d.-]+)/);
                    if (match) window.open("https://www.google.com/maps/search/?api=1&query=" + match[1] + "," + match[2], "_blank");
                  }} style={{ flex: 1, padding: 12, background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                    🗺️ Open Maps
                  </button>
                )}
                <a href={"tel:" + selectedOrder.customer?.phone} style={{ flex: 1, padding: 12, background: "#10B981", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 14, textAlign: "center", textDecoration: "none" }}>
                  📞 Call Customer
                </a>
              </div>
            </div>

            {/* ITEMS */}
            <div style={{ background: "#0B111A", padding: 15, borderRadius: 12, marginBottom: 20 }}>
              <div style={{ fontWeight: 800, marginBottom: 10, color: "#8B9BB4", fontSize: 12 }}>ORDER ITEMS</div>
              {selectedOrder.items?.map((it, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
                  <span>{it.qty}x {it.name}</span>
                  <span style={{ fontWeight: 700 }}>₹{it.price * it.qty}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px dashed #273449", margin: "10px 0", paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18 }}>
                <span>Total</span>
                <span style={{ color: selectedOrder.paid ? "#10B981" : "#F59E0B" }}>₹{selectedOrder.finalTotal}</span>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            {selectedOrder.status !== "served" ? (
              <>
                {/* STATUS: READY - Pickup Button */}
                {selectedOrder.status === "ready" && (
                  <button onClick={() => markOutForDelivery(selectedOrder.id)} style={{ width: "100%", padding: 16, background: "#F59E0B", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: "pointer", marginBottom: 10, boxShadow: "0 4px 12px rgba(245,158,11,0.3)" }}>
                    🛵 Mark Out for Delivery
                  </button>
                )}

                {/* STATUS: OUT FOR DELIVERY - Deliver Button */}
                {selectedOrder.status === "out_for_delivery" && (
                  <button onClick={() => markDelivered(selectedOrder.id)} style={{ width: "100%", padding: 16, background: "#10B981", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
                    ✅ Delivered & Collected ₹{selectedOrder.finalTotal}
                  </button>
                )}

                {/* STATUS: NEW OR PREPARING - Wait Message */}
                {(selectedOrder.status === "new" || selectedOrder.status === "preparing") && (
                  <div style={{ textAlign: "center", padding: 16, background: "rgba(245, 158, 11, 0.1)", border: "1px dashed #F59E0B", color: "#F59E0B", borderRadius: 12, fontWeight: 800, fontSize: 14 }}>
                    👨‍🍳 Kitchen me khana ban raha hai... Ready hone ka wait karein.
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: 15, background: "#0A2A20", color: "#10B981", borderRadius: 12, fontWeight: 800 }}>
                ✅ Ye order successfully deliver ho chuka hai
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
