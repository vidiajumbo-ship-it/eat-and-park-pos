/* eslint-disable */
import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, setDoc, onSnapshot, getDoc, query, where } from "firebase/firestore";

const C = {
  ink: "#111827", gray: "#6B7280", light: "#F9FAFB", line: "#E5E7EB",
  red: "#DC2626", redLight: "#FEF2F2",
  green: "#16A34A", amber: "#F59E0B", amberLight: "#FFFBEB",
  blue: "#2563EB", white: "#fff",
};

const uid = (p) => p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);
const inr = (n) => "₹" + (Number(n) || 0).toLocaleString("en-IN");
const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  return Math.floor(m / 60) + "h";
};

const STATUS = {
  new: { label: "New", color: C.red, bg: C.redLight },
  preparing: { label: "Cooking", color: C.amber, bg: C.amberLight },
  ready: { label: "Ready", color: C.green, bg: "#F0FDF4" },
  served: { label: "Served", color: C.gray, bg: C.light },
};

export default function StaffApp() {
  const [user, setUser] = useState(null);
  const [staffData, setStaffData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [activeTab, setActiveTab] = useState("tables");
  const [selectedTable, setSelectedTable] = useState(null);
  const [cart, setCart] = useState({});
  const [waiterName, setWaiterName] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && !u.isAnonymous) {
        try {
          const s = await getDoc(doc(db, "staff", u.uid));
          if (s.exists()) {
            setUser(u);
            setStaffData(s.data());
            setWaiterName(s.data().name || "Staff");
          } else { await signOut(auth); }
        } catch (e) { console.error(e); }
      } else {
        setUser(null);
        setStaffData(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const unsubMenu = onSnapshot(doc(db, "settings", "menu"), (snap) => {
      if (snap.exists() && Array.isArray(snap.data().items)) setMenu(snap.data().items);
    });
    const unsubOrders = onSnapshot(
      query(collection(db, "orders"), where("createdAt", ">=", startToday.getTime())),
      (snap) => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubMenu(); unsubOrders(); };
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const s = await getDoc(doc(db, "staff", cred.user.uid));
      if (!s.exists()) {
        await signOut(auth);
        setLoginError("Ye account staff ka nahi hai");
      }
    } catch (err) {
      setLoginError(err.code === "auth/invalid-credential" ? "Email ya password galat hai" : err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setStaffData(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.light, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontWeight: 800, color: C.red, fontSize: 18 }}>Eat & Park Staff</div>
          <div style={{ color: C.gray, fontSize: 13, marginTop: 4 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.light, fontFamily: "system-ui, sans-serif", padding: 16 }}>
        <form onSubmit={handleLogin} style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 380, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🍽️</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.ink }}>Eat & Park</div>
            <div style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>Staff POS Login</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.gray, display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@eatpark.com" style={{ width: "100%", padding: "12px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none" }} autoFocus required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.gray, display: "block", marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", padding: "12px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none" }} required />
          </div>
          {loginError && (
            <div style={{ background: C.redLight, color: C.red, padding: "10px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>⚠️ {loginError}</div>
          )}
          <button type="submit" style={{ width: "100%", padding: "14px", border: "none", borderRadius: 8, background: C.red, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>🔓 Login</button>
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: C.gray }}>
            <a href="/" style={{ color: C.blue, textDecoration: "none", fontWeight: 700 }}>← Customer App</a>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.light, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: C.red, color: "#fff", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>🍽️</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Eat & Park Staff</div>
            <div style={{ fontSize: 10, opacity: 0.85 }}>{staffData?.name || "Staff"} · {staffData?.role || "waiter"}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", padding: "8px 14px", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Logout</button>
      </div>
      <div style={{ background: "#fff", borderBottom: `1px solid ${C.line}`, padding: "0 16px", display: "flex", gap: 4 }}>
        {[{ id: "tables", label: "🍽️ Tables" }, { id: "orders", label: "📋 Orders" }, { id: "kot", label: "🍳 Kitchen" }].map((t) => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setSelectedTable(null); }} style={{ padding: "14px 18px", border: "none", background: "transparent", color: activeTab === t.id ? C.red : C.gray, fontWeight: 700, fontSize: 13, cursor: "pointer", borderBottom: activeTab === t.id ? `3px solid ${C.red}` : "3px solid transparent" }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {activeTab === "tables" && <TablesView orders={orders} onTableClick={(t) => setSelectedTable(t)} />}
        {activeTab === "orders" && <OrdersView orders={orders} />}
        {activeTab === "kot" && <KOTView orders={orders} />}
      </div>
      {selectedTable && (
        <BillingView table={selectedTable} menu={menu} cart={cart} setCart={setCart} waiterName={waiterName} onBack={() => { setSelectedTable(null); setCart({}); }} />
      )}
    </div>
  );
}

function TablesView({ orders, onTableClick }) {
  const tableData = useMemo(() => {
    const map = {};
    for (let i = 1; i <= 12; i++) map[i] = { table: i, order: null };
    orders.filter(o => o.orderType === "dine_in" && o.status !== "served" && o.status !== "cancelled").forEach(o => {
      const t = Number(o.table);
      if (map[t]) map[t].order = o;
    });
    return Object.values(map);
  }, [orders]);

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: C.ink }}>Tables</h2>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>{tableData.filter(t => t.order).length} occupied · {tableData.filter(t => !t.order).length} free</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
        {tableData.map((t) => (
          <button key={t.table} onClick={() => onTableClick(t.table)} style={{ background: t.order ? C.redLight : "#fff", border: `2px solid ${t.order ? C.red : C.line}`, borderRadius: 12, padding: 16, cursor: "pointer", textAlign: "left", minHeight: 100, display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: "inherit" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: t.order ? C.red : C.ink, lineHeight: 1 }}>{t.table}</div>
              <span style={{ fontSize: 20 }}>{t.order ? "🔴" : "🟢"}</span>
            </div>
            {t.order ? (
              <div>
                <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>#{t.order.id?.slice(1, 5).toUpperCase()}</div>
                <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{t.order.items?.length || 0} items · ₹{t.order.finalTotal || 0}</div>
              </div>
            ) : (<div style={{ fontSize: 11, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>Available</div>)}
          </button>
        ))}
      </div>
    </div>
  );
}

function OrdersView({ orders }) {
  const active = orders.filter(o => o.status !== "served" && o.status !== "cancelled");
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 800, color: C.ink }}>Active Orders ({active.length})</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {active.map((o) => {
          const st = STATUS[o.status] || STATUS.new;
          return (
            <div key={o.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>{o.orderType === "parcel" ? "🛍️ Parcel" : `🍽️ Table ${o.table}`}</div>
                <span style={{ background: st.bg, color: st.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 8 }}>#{o.id?.slice(1, 5).toUpperCase()} · {timeAgo(o.createdAt)} ago</div>
              <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{(o.items || []).map((it, i) => (<div key={i}>{it.qty}× {it.name}</div>))}</div>
              <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: C.gray }}>Total</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: C.red, fontFamily: "monospace" }}>{inr(o.finalTotal || 0)}</span>
              </div>
            </div>
          );
        })}
        {active.length === 0 && (<div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: C.gray }}><div style={{ fontSize: 48, marginBottom: 8 }}>😌</div><div style={{ fontSize: 14, fontWeight: 700 }}>Koi active order nahi</div></div>)}
      </div>
    </div>
  );
}

function KOTView({ orders }) {
  const kotOrders = orders.filter(o => o.status === "new" || o.status === "preparing");
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 800, color: C.ink }}>Kitchen ({kotOrders.length})</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {kotOrders.map((o) => (
          <div key={o.id} style={{ background: o.status === "new" ? C.redLight : C.amberLight, border: `2px solid ${o.status === "new" ? C.red : C.amber}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.ink, marginBottom: 8 }}>{o.orderType === "parcel" ? "🛍️" : `🍽️ Table ${o.table}`}</div>
            {(o.items || []).map((it, i) => (<div key={i} style={{ fontSize: 14, fontWeight: 700, padding: "4px 0", borderBottom: `1px dashed ${C.line}` }}>{it.qty}× {it.name} {it.portion ? `(${it.portion})` : ""}</div>))}
          </div>
        ))}
        {kotOrders.length === 0 && (<div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: C.gray }}><div style={{ fontSize: 48, marginBottom: 8 }}>😌</div><div style={{ fontSize: 14, fontWeight: 700 }}>Kitchen khaali hai</div></div>)}
      </div>
    </div>
  );
}

function BillingView({ table, menu, cart, setCart, waiterName, onBack }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [placing, setPlacing] = useState(false);

  const categories = useMemo(() => ["All", ...Array.from(new Set(menu.map(m => m.category)))], [menu]);
  const filtered = useMemo(() => menu.filter(m => m.available && (category === "All" || m.category === category) && (!search.trim() || m.name.toLowerCase().includes(search.toLowerCase()))), [menu, category, search]);

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const subtotal = cartItems.reduce((s, [id, q]) => { const m = menu.find(x => x.id === id); return s + (m?.price || 0) * q; }, 0);

  const setQty = (id, q) => { setCart(prev => { const next = { ...prev }; if (q <= 0) delete next[id]; else next[id] = q; return next; }); };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 || placing) return;
    setPlacing(true);
    try {
      const items = cartItems.map(([id, qty]) => { const m = menu.find(x => x.id === id); return { itemId: id, name: m.name, portion: m.portion || "", price: m.price, qty, kotNumber: 1 }; });
      const orderId = uid("o");
      const order = {
        id: orderId, table, orderType: "dine_in",
        customer: { name: "Walk-in", phone: "" },
        items, waiter: waiterName || "Staff",
        kots: [{ id: uid("kot"), kotNumber: 1, items, createdAt: Date.now(), status: "new", isRunning: false }],
        status: "new", paid: false, finalTotal: subtotal, subtotal,
        createdAt: Date.now(), createdBy: auth.currentUser?.uid,
      };
      await setDoc(doc(db, "orders", orderId), order);
      alert("✅ Order placed!");
      onBack();
    } catch (e) { alert("❌ " + e.message); } finally { setPlacing(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 100, display: "flex", flexDirection: "column" }}>
      <div style={{ background: C.red, color: "#fff", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", padding: "8px 14px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>← Back</button>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Table {table} · {cartItems.length} items · ₹{subtotal}</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 380px", gap: 12, overflow: "hidden", padding: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
          <input placeholder="🔍 Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: "10px 14px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, outline: "none" }} />
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${category === c ? C.red : C.line}`, background: category === c ? C.red : "#fff", color: category === c ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>{c}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, overflowY: "auto", flex: 1 }}>
            {filtered.map((m) => {
              const q = cart[m.id] || 0;
              return (
                <button key={m.id} onClick={() => setQty(m.id, q + 1)} style={{ textAlign: "left", padding: 10, borderRadius: 8, border: `1px solid ${q > 0 ? C.green : C.line}`, background: "#fff", cursor: "pointer", position: "relative", fontFamily: "inherit", minHeight: 60 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{m.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.red }}>₹{m.price}</div>
                  {q > 0 && <span style={{ position: "absolute", top: 6, right: 6, background: C.green, color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>{q}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, fontWeight: 800, fontSize: 15 }}>🛒 Cart</div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {cartItems.length === 0 && <div style={{ textAlign: "center", padding: 60, color: C.gray, fontSize: 13 }}>Menu se item tap karo</div>}
            {cartItems.map(([id, q]) => {
              const m = menu.find(x => x.id === id);
              if (!m) return null;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: C.gray }}>₹{m.price}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${C.red}`, borderRadius: 6, overflow: "hidden" }}>
                    <button onClick={() => setQty(id, q - 1)} style={{ width: 28, height: 30, border: "none", background: C.redLight, color: C.red, fontSize: 16, fontWeight: 900, cursor: "pointer" }}>−</button>
                    <span style={{ width: 32, textAlign: "center", fontWeight: 900, fontSize: 14, color: C.red }}>{q}</span>
                    <button onClick={() => setQty(id, q + 1)} style={{ width: 28, height: 30, border: "none", background: C.red, color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer" }}>+</button>
                  </div>
                  <div style={{ width: 60, textAlign: "right", fontWeight: 800, fontSize: 13, color: C.red, fontFamily: "monospace" }}>₹{m.price * q}</div>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: `2px solid ${C.line}`, padding: 14, background: C.light }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: C.gray, fontWeight: 600 }}>Subtotal</span>
              <span style={{ fontWeight: 700, fontFamily: "monospace" }}>₹{subtotal}</span>
            </div>
            <div style={{ background: C.red, borderRadius: 8, padding: "12px 16px", marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>TOTAL</span>
              <span style={{ color: "#fff", fontSize: 22, fontWeight: 900, fontFamily: "monospace" }}>₹{subtotal}</span>
            </div>
            <button onClick={handlePlaceOrder} disabled={cartItems.length === 0 || placing} style={{ width: "100%", padding: 14, marginTop: 10, border: "none", borderRadius: 8, background: cartItems.length === 0 ? C.line : C.red, color: cartItems.length === 0 ? C.gray : "#fff", fontWeight: 800, fontSize: 15, cursor: cartItems.length === 0 ? "not-allowed" : "pointer" }}>
              {placing ? "⏳ Placing..." : "🍳 Send KOT"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
