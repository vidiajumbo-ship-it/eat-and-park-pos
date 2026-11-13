import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, doc } from "firebase/firestore";

const C = {
  bg: "#0f172a", card: "#1e293b", cardAlt: "#334155", line: "#475569",
  ink: "#f8fafc", gray: "#94a3b8", gold: "#f97316", green: "#22c55e"
};

export default function CustomerMenu() {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [customerName, setCustomerName] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [ordered, setOrdered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "menu"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMenu(data.list || data.items || []);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const addToCart = (item) => {
    setCart(prev => ({ ...prev, [item.id]: { ...item, qty: (prev[item.id]?.qty || 0) + 1 } }));
  };
  const removeFromCart = (item) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[item.id]?.qty > 1) newCart[item.id].qty -= 1;
      else delete newCart[item.id];
      return newCart;
    });
  };

  const total = Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0);
  const totalItems = Object.values(cart).reduce((s, i) => s + i.qty, 0);

  const placeOrder = async () => {
    if (!customerName) return alert("Kripya apna naam daalein");
    if (Object.keys(cart).length === 0) return alert("Aapne kuch order nahi kiya");

    try {
      const orderItems = Object.values(cart).map(i => ({
        itemId: i.id, name: i.name, price: Number(i.price), qty: i.qty,
      }));

      await addDoc(collection(db, "orders"), {
        customerName,
        table: 0,
        orderType: "parcel",
        status: "new", paid: false, items: orderItems,
        subtotal: total, finalTotal: total, createdAt: new Date().toISOString(),
        createdBy: "customer_qr", paymentStatus: "pending"
      });
      setOrdered(true);
    } catch (e) { alert("Order failed: " + e.message); }
  };

  if (loading) return <div style={{ padding: 50, textAlign: "center", color: C.ink, background: C.bg, minHeight: "100vh" }}>Loading...</div>;

  if (ordered) return (
    <div style={{ padding: 50, textAlign: "center", color: C.green, background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 60 }}>🛍️</div>
      <h1>Takeaway Order Place Ho Gaya!</h1>
      <p style={{ color: C.ink }}>Aapka khana taiyaar ho raha hai. Counter par le lein.</p>
    </div>
  );

  const categories = ["All", ...Array.from(new Set(menu.map(m => m.category || m.cat || "Main")))];
  const filteredMenu = menu.filter(m => activeCat === "All" || (m.category || m.cat || "Main") === activeCat);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ink, paddingBottom: "120px", fontFamily: "system-ui" }}>
      <div style={{ background: C.card, padding: "20px 16px", position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid " + C.line }}>
        <h2 style={{ margin: "0 0 15px 0", color: C.gold, fontSize: 22, textAlign: "center" }}>Eat & Park (Takeaway)</h2>
        <input placeholder="Aapka Naam (Zaroori hai)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: 8, border: "1px solid " + C.line, background: C.cardAlt, color: C.ink, outline: "none", fontSize: 14, boxSizing: "border-box" }} />
      </div>

      <div style={{ display: "flex", gap: 10, padding: "15px 16px", overflowX: "auto" }}>
        {categories.map(c => (
          <button key={c} onClick={() => setActiveCat(c)} style={{ padding: "8px 16px", borderRadius: 20, border: "1px solid " + (activeCat === c ? C.gold : C.line), background: activeCat === c ? C.gold : C.card, color: activeCat === c ? "#fff" : C.gray, fontWeight: "bold", fontSize: 13, whiteSpace: "nowrap" }}>{c}</button>
        ))}
      </div>

      <div style={{ padding: "0 16px", display: "grid", gap: 12 }}>
        {filteredMenu.map((item) => (
          <div key={item.id} style={{ background: C.card, padding: "16px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid " + C.line }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: C.ink }}>{item.name}</h3>
              <p style={{ margin: "4px 0 0", color: C.gold, fontWeight: "bold", fontSize: 15 }}>₹{item.price}</p>
            </div>
            <div>
              {cart[item.id] ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.bg, padding: "5px", borderRadius: 8, border: "1px solid " + C.line }}>
                  <button onClick={() => removeFromCart(item)} style={{ background: C.cardAlt, color: C.ink, border: "none", width: 30, height: 30, borderRadius: 6, fontSize: 18, fontWeight: "bold" }}>−</button>
                  <span style={{ fontWeight: "bold", minWidth: 20, textAlign: "center" }}>{cart[item.id].qty}</span>
                  <button onClick={() => addToCart(item)} style={{ background: C.gold, color: "#fff", border: "none", width: 30, height: 30, borderRadius: 6, fontSize: 18, fontWeight: "bold" }}>+</button>
                </div>
              ) : (
                <button onClick={() => addToCart(item)} style={{ background: "transparent", color: C.gold, border: "1px solid " + C.gold, padding: "8px 20px", borderRadius: 8, fontWeight: "bold" }}>+ Add</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalItems > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.card, padding: "16px 20px", borderTop: "1px solid " + C.line, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: C.gray, fontWeight: "bold" }}>{totalItems} items</p>
            <h2 style={{ margin: 0, fontSize: 22, color: C.ink }}>Total: ₹{total}</h2>
          </div>
          <button onClick={placeOrder} style={{ background: C.gold, color: "#fff", border: "none", padding: "14px 24px", borderRadius: 10, fontWeight: "bold", fontSize: 16 }}>Takeaway Order 🛍️</button>
        </div>
      )}
    </div>
  );
}
