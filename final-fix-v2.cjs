const fs = require("fs");
const filePath = "src/StaffApp.jsx";
let src = fs.readFileSync(filePath, "utf8");

console.log("⏳ Fixing AI with safe zone replacements...");

// 1. Start aur End point dhoondo
const startStr = `{mode === "auto" && (`;
const endStr = `{items.length === 0 &&`; // Ye items list ka start hai

const startIndex = src.indexOf(startStr);
const endIndex = src.indexOf(endStr, startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.log("❌ Error: Code ka structure match nahi hua.");
    process.exit(1);
}

// 2. Naya REAL-WORLD Math wala AI UI
const newCode = `{mode === "auto" && (
          <div style={{ marginBottom: 12, padding: 16, background: C.cardAlt, borderRadius: 12, border: "1px solid " + C.line }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 10 }}>
              🤖 Smart AI Suggest (Persons: {persons})
            </div>
            
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => {
                const starters = menu.filter(m => m.available && (m.category.includes("Starter") || m.category.includes("Snack") || m.category.includes("Momos")));
                const paneer = menu.filter(m => m.available && m.category.includes("Paneer"));
                const dal = menu.filter(m => m.available && m.category.includes("Dal"));
                const roti = menu.filter(m => m.available && m.category.includes("Roti"));
                const naan = menu.filter(m => m.available && m.category.includes("Naan"));
                
                let newItems = [];
                // 30 logo ke liye 30 plate nahi banti. Real world math:
                if (starters.length) newItems.push({ id: starters[0].id, name: starters[0].name, price: starters[0].price, qty: Math.ceil(persons / 3) });
                if (paneer.length) newItems.push({ id: paneer[0].id, name: paneer[0].name, price: paneer[0].price, qty: Math.ceil(persons / 4) });
                if (dal.length) newItems.push({ id: dal[0].id, name: dal[0].name, price: dal[0].price, qty: Math.ceil(persons / 4) });
                if (roti.length) newItems.push({ id: roti[0].id, name: roti[0].name, price: roti[0].price, qty: persons * 2 });
                if (naan.length) newItems.push({ id: naan[0].id, name: naan[0].name, price: naan[0].price, qty: persons });
                
                if (!newItems.length) { toast("Menu me items nahi mile", "warning"); return; }
                setItems(prev => {
                  const merged = [...prev];
                  newItems.forEach(ni => {
                    const ex = merged.find(p => p.id === ni.id);
                    if (ex) ex.qty += ni.qty;
                    else merged.push(ni);
                  });
                  return merged;
                });
                setMode("manual");
                toast("✅ AI ne smart quantity ke sath items add kar diye!", "success");
              }} style={{ padding: "10px 16px", borderRadius: 8, background: C.card, border: "1px solid " + C.line, color: C.ink, fontWeight: 700, cursor: "pointer" }}>
                🟢 Veg Combo
              </button>

              <button onClick={() => {
                const nonVegStarters = menu.filter(m => m.available && (m.category.includes("Chicken") || m.category.includes("Mutton") || m.category.includes("Fish")));
                const chicken = menu.filter(m => m.available && m.category.includes("Chicken"));
                const naan = menu.filter(m => m.available && m.category.includes("Naan"));
                
                let newItems = [];
                // Real world math
                if (nonVegStarters.length) newItems.push({ id: nonVegStarters[0].id, name: nonVegStarters[0].name, price: nonVegStarters[0].price, qty: Math.ceil(persons / 3) });
                if (chicken.length) newItems.push({ id: chicken[0].id, name: chicken[0].name, price: chicken[0].price, qty: Math.ceil(persons / 4) });
                if (naan.length) newItems.push({ id: naan[0].id, name: naan[0].name, price: naan[0].price, qty: persons });
                
                if (!newItems.length) { toast("Menu me Non-Veg items nahi mile", "warning"); return; }
                setItems(prev => {
                  const merged = [...prev];
                  newItems.forEach(ni => {
                    const ex = merged.find(p => p.id === ni.id);
                    if (ex) ex.qty += ni.qty;
                    else merged.push(ni);
                  });
                  return merged;
                });
                setMode("manual");
                toast("✅ AI ne smart quantity ke sath items add kar diye!", "success");
              }} style={{ padding: "10px 16px", borderRadius: 8, background: C.card, border: "1px solid " + C.line, color: C.ink, fontWeight: 700, cursor: "pointer" }}>
                🔴 Non-Veg Combo
              </button>
            </div>
          </div>
        )}
        
        `;

// Replace exactly (up to the items list)
src = src.slice(0, startIndex) + newCode + src.slice(endIndex);

fs.writeFileSync(filePath, src, "utf8");
console.log("✅ Sahi quantity wala AI lag gaya bina kisi error ke!");
