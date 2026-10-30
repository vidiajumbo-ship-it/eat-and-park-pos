const fs = require("fs");
const filePath = process.argv[2] || "src/StaffApp.jsx";
let src = fs.readFileSync(filePath, "utf8");

console.log("⏳ Smart Patch start...\n");

// 1. Purane Auto Mode ko naye "Veg/Non-Veg Combo" wale UI se replace karo
const autoModeRegex = /\{mode === "auto" && \([\s\S]*?\)\}/;
const newAutoMode = `{mode === "auto" && (
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
                if (starters.length) newItems.push({ id: starters[0].id, name: starters[0].name, price: starters[0].price, qty: Math.ceil(persons * 0.5) });
                if (paneer.length) newItems.push({ id: paneer[0].id, name: paneer[0].name, price: paneer[0].price, qty: Math.ceil(persons * 0.7) });
                if (dal.length) newItems.push({ id: dal[0].id, name: dal[0].name, price: dal[0].price, qty: 1 });
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
                toast("✅ AI ne items add kar diye!", "success");
              }} style={{ padding: "10px 16px", borderRadius: 8, background: C.card, border: "1px solid " + C.line, color: C.ink, fontWeight: 700, cursor: "pointer" }}>
                🟢 Veg Combo (Start + Main + Bread)
              </button>

              <button onClick={() => {
                const nonVegStarters = menu.filter(m => m.available && (m.category.includes("Chicken") || m.category.includes("Mutton") || m.category.includes("Fish")));
                const chicken = menu.filter(m => m.available && m.category.includes("Chicken"));
                const naan = menu.filter(m => m.available && m.category.includes("Naan"));
                
                let newItems = [];
                if (nonVegStarters.length) newItems.push({ id: nonVegStarters[0].id, name: nonVegStarters[0].name, price: nonVegStarters[0].price, qty: Math.ceil(persons * 0.5) });
                if (chicken.length) newItems.push({ id: chicken[0].id, name: chicken[0].name, price: chicken[0].price, qty: Math.ceil(persons * 0.7) });
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
                toast("✅ AI ne items add kar diye!", "success");
              }} style={{ padding: "10px 16px", borderRadius: 8, background: C.card, border: "1px solid " + C.line, color: C.ink, fontWeight: 700, cursor: "pointer" }}>
                🔴 Non-Veg Combo
              </button>
            </div>
          </div>
        )}`;

if (src.match(autoModeRegex)) {
    src = src.replace(autoModeRegex, newAutoMode);
    console.log("✅ Auto Mode UI successfully update ho gaya!");
} else {
    console.log("⚠️ Purana Auto Mode nahi mila, par code safe hai.");
}

// 2. Duplicate SMART_AI_STEPS hatane ke liye check (agar pehle se hai toh)
// (Agar koi purana bacha hua code hai jo crash kar raha tha)
const smartAiStart = src.indexOf("const SMART_AI_STEPS = [");
const smartAiEnd = src.indexOf("function EstimatePanel(");
if (smartAiStart !== -1 && smartAiEnd !== -1 && smartAiStart < smartAiEnd) {
    // Purane duplicate AI block ko nikal do (kyunki humne abhi direct UI lagaya hai)
    // Par wait, aapne pichla patch checkout kar diya tha, toh purana code waise hi hai.
}

fs.writeFileSync(filePath, src, "utf8");
console.log("\n🎉 Patch applied! Ab browser refresh karo.");