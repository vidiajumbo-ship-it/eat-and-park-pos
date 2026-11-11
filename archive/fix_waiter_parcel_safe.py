import os, shutil
from datetime import datetime

PATH = "src/App.jsx"

if not os.path.exists(PATH):
    print("❌ src/App.jsx nahi mila!")
    exit()

# 1. Safe Backup (Kuch bhi delete nahi hoga)
b = f"{PATH}.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(PATH, b)
print(f"📦 Backup saved: {b}")

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

# 2. Add new state without deleting old state
if 'const [waiterTab, setWaiterTab] = useState("tables");' not in content:
    content = content.replace(
        'const [showKitchenOnly, setShowKitchenOnly] = useState(false);',
        'const [showKitchenOnly, setShowKitchenOnly] = useState(false);\n  const [waiterTab, setWaiterTab] = useState("tables");'
    )
    print("✅ Naya 'waiterTab' state add ho gaya (purana state safe hai)")

# 3. Update Buttons (Purane Kitchen button ki jagah 3 new tabs)
old_header = '<button onClick={() => setShowKitchenOnly(prev => !prev)} style={{ background: showKitchenOnly ? "#273449" : "#38BDF8", color: showKitchenOnly ? "#fff" : "#0B111A", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 10px rgba(56,189,248,0.3)" }}>{showKitchenOnly ? "🪑 Tables" : "🍳 Kitchen View"}</button>'
new_header = '''<div style={{ display: "flex", background: "#273449", borderRadius: 8, padding: 4, gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => setWaiterTab("tables")} style={{ background: waiterTab === "tables" ? "#38BDF8" : "transparent", color: waiterTab === "tables" ? "#0B111A" : "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>🪑 Tables</button>
              <button onClick={() => setWaiterTab("parcel")} style={{ background: waiterTab === "parcel" ? "#38BDF8" : "transparent", color: waiterTab === "parcel" ? "#0B111A" : "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>🛍️ Parcel</button>
              <button onClick={() => setWaiterTab("kitchen")} style={{ background: waiterTab === "kitchen" ? "#38BDF8" : "transparent", color: waiterTab === "kitchen" ? "#0B111A" : "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>🍳 Kitchen</button>
            </div>'''
if old_header in content:
    content = content.replace(old_header, new_header)
    print("✅ Header me Tables, Parcel aur Kitchen ke tabs lag gaye")

# 4. Update Rendering (Parcel ko show karne ke liye)
old_render = '''{!showKitchenOnly ? (
          <TableStatusBoard orders={combinedOrders} tables={20} compact={false} isDark={true} showStats onTableClick={(o) => setTarget(o)} onEmptyTableClick={(t) => openNew(t)} />
        ) : (
          <div style={{ color: "#fff" }}>'''
          
new_render = '''{waiterTab === "tables" && (
          <TableStatusBoard orders={combinedOrders} tables={20} compact={false} isDark={true} showStats onTableClick={(o) => setTarget(o)} onEmptyTableClick={(t) => openNew(t)} />
        )}
        
        {waiterTab === "parcel" && (
          <div style={{ color: "#fff" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 28 }}>🛍️</span> Running Parcels
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: viewMode === "desktop" ? "repeat(auto-fill, minmax(300px, 1fr))" : "1fr", gap: 12 }}>
              {orders.filter(o => o.orderType === "parcel" && o.status !== "served" && o.status !== "cancelled" && !o.paid).map(o => (
                <div key={o.id} onClick={() => setTarget(o)} style={{ background: "#161F2F", border: "1px solid #273449", borderRadius: 12, padding: 14, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "#FCD34D", fontWeight: 800 }}>#{o.id.slice(1,5).toUpperCase()}</span>
                    <span style={{ color: "#9CA3AF", fontSize: 12 }}>{timeAgo(o.createdAt)}</span>
                  </div>
                  <div style={{ color: "#fff", fontSize: 14, marginBottom: 8 }}>
                    {o.customer?.name || "Walk-in"} {o.customer?.phone ? `(${o.customer.phone})` : ""}
                  </div>
                  <div style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 8 }}>
                    {o.items?.length || 0} items · ₹{getOrderTotal(o)}
                  </div>
                  <div style={{ background: "#3B82F6", color: "#fff", padding: "8px 0", textAlign: "center", borderRadius: 8, fontWeight: 800, fontSize: 13 }}>Open POS</div>
                </div>
              ))}
              {orders.filter(o => o.orderType === "parcel" && o.status !== "served" && o.status !== "cancelled" && !o.paid).length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "#8B9BB4", fontStyle: "italic" }}>No running parcel orders</div>
              )}
            </div>
          </div>
        )}

        {waiterTab === "kitchen" && (
          <div style={{ color: "#fff" }}>'''

if old_render in content:
    content = content.replace(old_render, new_render)
    print("✅ Parcel Tab ka UI logic add ho gaya (Purana kuch delete nahi hua)")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("🎉 Fix Done! 'npm run dev' chala kar check karo.")