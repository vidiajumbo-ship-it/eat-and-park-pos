const fs = require("fs");
const FILE = "src/DeliveryApp.jsx";

const code = `import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
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

export default function DeliveryApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  
  const [activeOrders, setActiveOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [tab, setTab] = useState("active"); // active | history
  const [selectedOrder, setSelectedOrder] = useState(null);

  // 1. Auth Check
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

  // 2. Active Orders Fetch
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "orders"), where("orderType", "==", "parcel"));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Active: Jo cancel nahi hua aur serve nahi hua
      const active = all.filter(o => o.status !== "cancelled" && o.status !== "served")
        .sort((a, b) => b.createdAt - a.createdAt);
      setActiveOrders(active);
    });
    return () => unsub();
  }, [user]);

  // 3. History Orders Fetch
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "orders"), where("orderType", "==", "parcel"), where("status", "==", "served"));
    const unsub = onSnapshot(q, (snap) => {
      const hist = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        // Filter delivered by this user (agar deliveredBy field hai)
        .filter(o => !o.deliveredBy || o.deliveredBy === user.email || o.deliveredBy === user.uid)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 30); // Sirf last 30 orders
      setHistoryOrders(hist);
    });
    return () => unsub();
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (err) { setLoginError("Email ya password galat hai."); }
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

  const ordersToShow = tab === "active" ? activeOrders : historyOrders;

  return (
    <div style={{ minHeight: "100vh", background: "#0B111A", color: "#fff", paddingBottom: 70 }}>
      {/* HEADER */}
      <div style={{ background: "#F59E0B", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>🛵 Delivery Panel</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => signOut(auth)} style={{ background: "rgba(0,0,0,0.15)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: 15, maxWidth: 600, margin: "0 auto" }}>
        {ordersToShow.length === 0 && (
          <div style={{ textAlign: "center", padding: 50, color: "#8B9BB4" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>😴</div>
            <div>{tab === "active" ? "Abhi koi naya order nahi hai." : "Koi purana order nahi hai."}</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ordersToShow.map(o => (
            <div key={o.id} onClick={() => setSelectedOrder(o)} style={{ background: "#161F2F", border: "1px solid #273449", padding: 12, borderRadius: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 900, color: "#F59E0B", fontSize: 15 }}>#{o.id.slice(1,5).toUpperCase()}</span>
                  <span style={{ fontSize: 10, color: "#8B9BB4" }}>{timeAgo(o.createdAt)}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 2 }}>{o.customer?.name || "Customer"}</div>
                <div style={{ fontSize: 11, color: "#8B9BB4", maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  📍 {o.customer?.exactAddress || o.customer?.address || "No Address"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: o.paid ? "#10B981" : "#F59E0B" }}>₹{o.finalTotal}</div>
                <div style={{ fontSize: 9, color: "#8B9BB4", marginTop: 2 }}>{o.paid ? "PAID" : "COLLECT"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM MENU */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#161F2F", borderTop: "1px solid #273449", display: "flex", zIndex: 50 }}>
        <button onClick={() => setTab("active")} style={{ flex: 1, padding: "15px 0", background: "transparent", border: "none", color: tab === "active" ? "#F59E0B" : "#8B9BB4", fontWeight: 800, fontSize: 13, borderTop: tab === "active" ? "3px solid #F59E0B" : "3px solid transparent", cursor: "pointer" }}>
          📦 Active ({activeOrders.length})
        </button>
        <button onClick={() => setTab("history")} style={{ flex: 1, padding: "15px 0", background: "transparent", border: "none", color: tab === "history" ? "#F59E0B" : "#8B9BB4", fontWeight: 800, fontSize: 13, borderTop: tab === "history" ? "3px solid #F59E0B" : "3px solid transparent", cursor: "pointer" }}>
          🕘 History
        </button>
      </div>

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#161F2F", width: "100%", maxWidth: 600, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: 20, maxHeight: "92vh", overflowY: "auto", animation: "slideUp 0.3s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Order #{selectedOrder.id.slice(1,5).toUpperCase()}</h2>
              <button onClick={() => setSelectedOrder(null)} style={{ background: "#273449", border: "none", color: "#fff", width: 30, height: 30, borderRadius: 15, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ background: "#0B111A", padding: 15, borderRadius: 12, marginBottom: 15 }}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 5 }}>{selectedOrder.customer?.name || "Customer"}</div>
              <div style={{ color: "#8B9BB4", marginBottom: 10, fontWeight: 700 }}>📞 {selectedOrder.customer?.phone}</div>
              <div style={{ color: "#fff", marginBottom: 15, lineHeight: 1.4, fontSize: 14 }}>
                📍 {selectedOrder.customer?.exactAddress} {selectedOrder.customer?.pincode ? "(PIN: " + selectedOrder.customer.pincode + ")" : ""}
              </div>
              
              <div style={{ display: "flex", gap: 10 }}>
                {selectedOrder.customer?.address?.includes("Lat:") && (
                  <button onClick={() => {
                    const match = selectedOrder.customer.address.match(/Lat: ([\\d.-]+), Lng: ([\\d.-]+)/);
                    if (match) window.open("https://www.google.com/maps/search/?api=1&query=" + match[1] + "," + match[2], "_blank");
                  }} style={{ flex: 1, padding: 12, background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                    🗺️ Open Maps
                  </button>
                )}
                <a href={"tel:" + selectedOrder.customer?.phone} style={{ flex: 1, padding: 12, background: "#10B981", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 14, textAlign: "center", textDecoration: "none" }}>
                  📞 Call
                </a>
              </div>
            </div>

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

            {!selectedOrder.paid && selectedOrder.status !== "served" ? (
              <button onClick={() => markDelivered(selectedOrder.id)} style={{ width: "100%", padding: 16, background: "#10B981", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
                ✅ Delivered & Collected ₹{selectedOrder.finalTotal}
              </button>
            ) : (
              <div style={{ textAlign: "center", padding: 15, background: "#0A2A20", color: "#10B981", borderRadius: 12, fontWeight: 800 }}>
                ✅ Ye order deliver ho chuka hai
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.copyFileSync(FILE, FILE + ".bak-upgrade");
fs.writeFileSync(FILE, code, "utf8");
console.log("✅ DeliveryApp.jsx ka poora UI upgrade ho gaya hai!");