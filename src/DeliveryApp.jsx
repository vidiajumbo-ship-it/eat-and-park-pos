import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";

export default function DeliveryApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // 1. Auth Check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Check karo ki wo delivery boy hi hai
        try {
          const s = await getDoc(doc(db, "staff", u.uid));
          if (s.exists() && s.data().role === "delivery") {
            setUser(u);
          } else {
            await signOut(auth);
            setLoginError("Ye account delivery boy ka nahi hai.");
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. Orders Fetch (Sirf Delivery wale)
  useEffect(() => {
    if (!user) return;
    // Sirf wo orders jo Parcel hain aur ready hain ya out for delivery hain
    const q = query(
      collection(db, "orders")
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter: Sirf Parcel orders jo cancel nahi hue aur deliver nahi hue
      const activeOrders = allOrders.filter(o => 
        o.orderType === "parcel" && 
        o.status !== "cancelled" && 
        o.status !== "served"
      );

      // Sort by time (purane pehle)
      activeOrders.sort((a, b) => a.createdAt - b.createdAt);
      setOrders(activeOrders);
    });
    return () => unsub();
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setLoginError("Email ya password galat hai.");
    }
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
      alert("✅ Order Delivered & Payment Collected!");
      setSelectedOrder(null);
    } catch (e) {
      alert("Error updating order: " + e.message);
    }
  };

  if (loading) return <div style={{ padding: 50, textAlign: "center", color: "#fff", background: "#0B111A", minHeight: "100vh" }}>Loading...</div>;

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#0B111A", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#161F2F", padding: 30, borderRadius: 20, width: "100%", maxWidth: 400, border: "1px solid #273449" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 50 }}>🛵</div>
            <h2 style={{ color: "#fff", margin: "10px 0" }}>Delivery Boy Login</h2>
            <p style={{ color: "#8B9BB4", fontSize: 13 }}>Eat & Park Delivery Partner</p>
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

  // --- ORDERS LIST SCREEN ---
  return (
    <div style={{ minHeight: "100vh", background: "#0B111A", color: "#fff", paddingBottom: 50 }}>
      {/* HEADER */}
      <div style={{ background: "#F59E0B", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>🛵 Delivery Panel</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{user.email}</span>
          <button onClick={() => signOut(auth)} style={{ background: "rgba(0,0,0,0.2)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
        <h3 style={{ marginBottom: 15 }}>Aapke Orders ({orders.length})</h3>
        
        {orders.length === 0 && (
          <div style={{ textAlign: "center", padding: 50, color: "#8B9BB4" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>😴</div>
            <div>Abhi koi delivery order nahi hai.</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          {orders.map(o => (
            <div key={o.id} onClick={() => setSelectedOrder(o)} style={{ background: "#161F2F", border: "1px solid #273449", padding: 16, borderRadius: 12, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 800, color: "#F59E0B" }}>#{o.id.slice(1,5).toUpperCase()}</span>
                <span style={{ fontSize: 11, background: o.status === "ready" ? "#0A2A20" : "#3A2510", color: o.status === "ready" ? "#10B981" : "#F59E0B", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                  {o.status === "ready" ? "Ready to Pick" : "Cooking"}
                </span>
              </div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{o.customer?.name || "Customer"}</div>
              <div style={{ fontSize: 13, color: "#8B9BB4", marginBottom: 8 }}>{o.customer?.exactAddress || o.customer?.address}</div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>₹{o.finalTotal} (Collect {o.paid ? "Already Paid" : "Cash/UPI"})</div>
            </div>
          ))}
        </div>
      </div>

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#161F2F", width: "100%", maxWidth: 600, margin: "0 auto", borderRadius: "24px 24px 0 0", padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Order #{selectedOrder.id.slice(1,5).toUpperCase()}</h2>
              <button onClick={() => setSelectedOrder(null)} style={{ background: "transparent", border: "none", color: "#8B9BB4", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ background: "#0B111A", padding: 15, borderRadius: 12, marginBottom: 15 }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 5 }}>{selectedOrder.customer?.name}</div>
              <div style={{ color: "#8B9BB4", marginBottom: 10 }}>📞 {selectedOrder.customer?.phone}</div>
              <div style={{ color: "#fff", marginBottom: 10, lineHeight: 1.4 }}>📍 {selectedOrder.customer?.exactAddress} (PIN: {selectedOrder.customer?.pincode})</div>
              
              {selectedOrder.customer?.address?.includes("Lat:") && (
                <button 
                  onClick={() => {
                    const match = selectedOrder.customer.address.match(/Lat: ([\d.-]+), Lng: ([\d.-]+)/);
                    if (match) window.open(`https://www.google.com/maps/search/?api=1&query=${match[1]},${match[2]}`, "_blank");
                  }}
                  style={{ width: "100%", padding: 12, background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  🗺️ Open in Google Maps
                </button>
              )}
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
                <span style={{ color: "#10B981" }}>₹{selectedOrder.finalTotal}</span>
              </div>
            </div>

            <button 
              onClick={() => markDelivered(selectedOrder.id)}
              style={{ width: "100%", padding: 16, background: "#10B981", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}
            >
              ✅ Delivered & Money Collected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}