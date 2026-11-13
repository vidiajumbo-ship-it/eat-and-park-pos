import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";

const STORAGE_KEY = "party_bookings_v1";

const T = {
  bg: "#0f172a", card: "#1e293b", border: "#334155", text: "#f8fafc",
  textMuted: "#94a3b8", orange: "#f97316", green: "#22c55e", red: "#ef4444"
};

// ===== Menu Loader: 3 sources try karta hai =====
// Firestore se menu load karo
function loadMenuFromStorage() {
  const keys = ["pos_menu", "menu", "menuItems", "menu_cache", "restaurant_menu", "items", "products"];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : (parsed.items || parsed.menu || parsed.products);
        if (Array.isArray(arr) && arr.length > 0) return arr;
      }
    } catch (e) {}
  }
  return [];
}

function normalize(arr) {
  return arr.map((m, i) => ({
    id: String(m.id || m._id || i),
    name: m.name || m.title || m.itemName || m.item || "Item " + i,
    price: Number(m.price || m.rate || m.amount || m.sellingPrice || 0),
    cat: m.category || m.cat || m.type || m.group || "Main",
    per: 0.25,
  }));
}

export default function PartyBooking({ onClose = () => {}, rawMenu }) {
  const [MENU, setMENU] = useState([]);
  const [menuLoaded, setMenuLoaded] = useState(false);

  // Firestore se menu load karo
  useEffect(() => {
    // Pehle localStorage se try karo (fast)
    const cached = loadMenuFromStorage();
    if (cached.length > 0) {
      setMENU(normalize(cached));
      setMenuLoaded(true);
    }
    
    // Phir Firestore se subscribe karo
    let unsub = null;
    try {
      unsub = onSnapshot(doc(db, "settings", "menu"), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const menuArr = data.list || data.items || data.menu || (Array.isArray(data) ? data : []);
          if (Array.isArray(menuArr) && menuArr.length > 0) {
            console.log("[PartyBooking] Menu loaded from FIRESTORE:", menuArr.length, "items");
            setMENU(normalize(menuArr));
            setMenuLoaded(true);
          }
        }
      }, (err) => console.warn("[PartyBooking] Firestore menu error:", err));
    } catch (e) {
      console.warn("[PartyBooking] Firestore setup error:", e);
    }
    
    return () => { if (unsub) unsub(); };
  }, []);
  const CATEGORIES = ["All", ...Array.from(new Set(MENU.map(m => m.cat)))];

  const [activeTab, setActiveTab] = useState("new");
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState({ name: "", date: "", time: "", persons: 2, phone: "" });
  const [cart, setCart] = useState({});
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [spiceLevel, setSpiceLevel] = useState("Normal");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setBookings(JSON.parse(raw));
    } catch (e) { console.warn(e); }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings)); }
    catch (e) { console.warn(e); }
  }, [bookings]);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      bookings.forEach((b) => {
        if (!b.date || b.status === "completed") return;
        const party = new Date(`${b.date}T${b.time || "18:00"}`);
        const diffHrs = (party - now) / 36e5;
        const key = `notified_${b.id}`;
        if (diffHrs <= 24 && diffHrs > 0 && !localStorage.getItem(key)) {
          localStorage.setItem(key, "1");
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Party Reminder 🎉", { body: `${b.name} ki party ${b.date} ${b.time}!` });
          } else {
            alert(`Reminder: ${b.name} ki party ${b.date} ${b.time}!`);
          }
        }
      });
    };
    check();
    const t = setInterval(check, 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [bookings]);

  const autoQty = () => {
    const p = Math.max(1, form.persons);
    const nc = {};
    MENU.forEach((m) => { if (m.per) { let q = Math.round(p * m.per); if (q > 0) nc[m.id] = q; } });
    setCart(nc);
  };

  const add = (id) => setCart((p) => ({ ...p, [id]: (p[id] || 0) + 1 }));
  const remove = (id) => setCart((p) => {
    const n = { ...p };
    if (n[id] > 1) n[id]--;
    else delete n[id];
    return n;
  });
  const clearCart = () => setCart({});

  const estimate = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = MENU.find((m) => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const perPerson = form.persons > 0 ? (estimate / form.persons).toFixed(2) : 0;

  const handleSubmit = () => {
    if (!form.name || !form.date || !form.phone) return alert("Name, Date, Phone zaroori hai");
    if (Object.keys(cart).length === 0) return alert("Kam se kam ek item select karo");
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    const nb = { id: Date.now().toString(), ...form, items: cart, estimate, spiceLevel, status: "active", createdAt: new Date().toISOString() };
    setBookings((prev) => [nb, ...prev]);
    alert("✅ Booking Saved!");
    setForm({ name: "", date: "", time: "", persons: 2, phone: "" });
    setCart({});
    setActiveTab("saved");
  };

  const markComplete = (id) => {
    if (window.confirm("Mark as COMPLETED?")) {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: "completed", completedAt: new Date().toISOString() } : b));
    }
  };

  const deleteBooking = (id) => {
    if (window.confirm("Delete permanently?")) setBookings(prev => prev.filter(b => b.id !== id));
  };

  const filteredMenu = MENU.filter(m => {
    if (activeCat !== "All" && m.cat !== activeCat) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeBookings = bookings.filter(b => b.status !== "completed");
  const historyBookings = bookings.filter(b => b.status === "completed");
  const totalRevenue = historyBookings.reduce((s, b) => s + (b.estimate || 0), 0);

  const inputStyle = { width: "100%", padding: "10px", borderRadius: "8px", border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: "13px", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", color: T.text, background: T.bg }}>
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, background: T.card }}>
        <button onClick={() => setActiveTab("new")} style={{ flex: 1, padding: "14px", background: "none", border: 0, borderBottom: activeTab === "new" ? `2px solid ${T.orange}` : "2px solid transparent", color: activeTab === "new" ? T.orange : T.textMuted, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>➕ New</button>
        <button onClick={() => setActiveTab("saved")} style={{ flex: 1, padding: "14px", background: "none", border: 0, borderBottom: activeTab === "saved" ? `2px solid ${T.orange}` : "2px solid transparent", color: activeTab === "saved" ? T.orange : T.textMuted, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>📋 Active ({activeBookings.length})</button>
        <button onClick={() => setActiveTab("history")} style={{ flex: 1, padding: "14px", background: "none", border: 0, borderBottom: activeTab === "history" ? `2px solid ${T.orange}` : "2px solid transparent", color: activeTab === "history" ? T.orange : T.textMuted, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>🏆 History ({historyBookings.length})</button>
        <button onClick={onClose} style={{ padding: "0 20px", background: "none", border: 0, color: T.textMuted, fontSize: 24, cursor: "pointer" }}>×</button>
      </div>

      {activeTab === "new" && (
        <>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <div style={{ background: T.card, padding: 12, borderRadius: 10, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <input placeholder="Customer Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <input placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.bg, padding: "0 10px", borderRadius: 8, border: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>👥 Persons</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button type="button" onClick={() => setForm(f => ({...f, persons: Math.max(1, f.persons - 1)}))} style={{ width: 24, height: 24, borderRadius: 4, background: T.card, border: 0, color: T.text, cursor: "pointer" }}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{form.persons}</span>
                    <button type="button" onClick={() => setForm(f => ({...f, persons: f.persons + 1}))} style={{ width: 24, height: 24, borderRadius: 4, background: T.orange, border: 0, color: "#fff", cursor: "pointer" }}>+</button>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {["Kam", "Normal", "Zyada"].map(level => (
                    <button key={level} type="button" onClick={() => setSpiceLevel(level)} style={{ padding: "4px 12px", borderRadius: 16, border: `1px solid ${spiceLevel === level ? T.orange : T.border}`, background: spiceLevel === level ? T.orange : "transparent", color: spiceLevel === level ? "#fff" : T.textMuted, fontSize: 12, cursor: "pointer" }}>{level}</button>
                  ))}
                </div>
                <button type="button" onClick={autoQty} style={{ padding: "6px 12px", borderRadius: 6, background: T.orange, color: "#fff", border: 0, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⚡ Auto qty</button>
              </div>
            </div>

            <input placeholder="🔍 Item search..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, padding: "12px 16px", marginBottom: 12, background: T.card }} />
            
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setActiveCat(c)} style={{ padding: "6px 14px", borderRadius: 20, whiteSpace: "nowrap", border: `1px solid ${activeCat === c ? T.orange : T.border}`, background: activeCat === c ? T.orange : T.bg, color: activeCat === c ? "#fff" : T.textMuted, fontSize: 12, cursor: "pointer" }}>{c}</button>
              ))}
            </div>

            {filteredMenu.length === 0 ? (
              <div style={{ textAlign: "center", color: T.textMuted, padding: 30 }}>Koi item nahi mila. Console (F12) check karo menu load hua ya nahi.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {filteredMenu.map(m => {
                  const qty = cart[m.id] || 0;
                  return (
                    <div key={m.id} onClick={() => add(m.id)} style={{ background: qty > 0 ? "rgba(249, 115, 22, 0.1)" : T.card, border: `1px solid ${qty > 0 ? T.orange : T.border}`, borderRadius: 8, padding: "12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>₹{m.price}</div>
                      </div>
                      {qty > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.bg, padding: "4px 6px", borderRadius: 6 }}>
                          <button onClick={(e) => { e.stopPropagation(); remove(m.id); }} style={{ background: "none", border: 0, color: T.text, fontSize: 14, cursor: "pointer" }}>−</button>
                          <span style={{ fontSize: 13, fontWeight: 600, color: T.orange }}>{qty}</span>
                          <button onClick={(e) => { e.stopPropagation(); add(m.id); }} style={{ background: "none", border: 0, color: T.text, fontSize: 14, cursor: "pointer" }}>+</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, background: T.card }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                <span style={{ color: T.orange, fontWeight: 600 }}>{totalItems} item</span> • Per person ₹{perPerson}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>₹{estimate}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={clearCart} style={{ padding: "10px 16px", borderRadius: 8, background: "transparent", border: `1px solid ${T.border}`, color: T.textMuted, fontSize: 13, cursor: "pointer" }}>Clear</button>
              <button type="button" onClick={handleSubmit} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, background: T.orange, border: 0, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>✅ Save Booking</button>
            </div>
          </div>
        </>
      )}

      {activeTab === "saved" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {activeBookings.length === 0 ? (
            <div style={{ textAlign: "center", color: T.textMuted, marginTop: 40 }}>Koi active booking nahi hai.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {activeBookings.map(b => (
                <div key={b.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: T.orange }}>{b.name}</span>
                    <span style={{ fontSize: 12, color: T.textMuted }}>{b.persons} Pax</span>
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>📅 {b.date} @ {b.time || "N/A"}</div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>📞 {b.phone}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                    <span style={{ fontWeight: 700, color: T.green, fontSize: 15 }}>₹{b.estimate}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => markComplete(b.id)} style={{ padding: "4px 10px", background: T.green, color: "#fff", border: 0, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✓ Done</button>
                      <button onClick={() => deleteBooking(b.id)} style={{ padding: "4px 10px", background: "transparent", color: T.red, border: `1px solid ${T.red}`, borderRadius: 4, fontSize: 11, cursor: "pointer" }}>Del</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div style={{ background: "rgba(34, 197, 94, 0.1)", border: `1px solid ${T.green}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginBottom: 4 }}>💰 REVENUE</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>₹{totalRevenue}</div>
            </div>
            <div style={{ background: "rgba(249, 115, 22, 0.1)", border: `1px solid ${T.orange}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: T.orange, fontWeight: 600, marginBottom: 4 }}>🎉 PARTIES</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{historyBookings.length}</div>
            </div>
            <div style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid #3b82f6", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600, marginBottom: 4 }}>📊 AVG</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>₹{historyBookings.length > 0 ? Math.round(totalRevenue / historyBookings.length) : 0}</div>
            </div>
          </div>
          {historyBookings.length === 0 ? (
            <div style={{ textAlign: "center", color: T.textMuted, marginTop: 40 }}>Koi party complete nahi hui.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {historyBookings.map(b => (
                <div key={b.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, opacity: 0.9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: T.orange }}>{b.name}</span>
                    <span style={{ fontSize: 11, color: T.green }}>✓ Done</span>
                  </div>
                  <div style={{ fontSize: 13 }}>📅 {b.date} @ {b.time || "N/A"}</div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>📞 {b.phone} • {b.persons} Pax</div>
                  <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8, marginTop: 8 }}>
                    <span style={{ fontWeight: 700, color: T.green, fontSize: 15 }}>₹{b.estimate}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
