const fs = require("fs");
const filePath = "src/StaffApp.jsx";
let src = fs.readFileSync(filePath, "utf8");

// 1. Purana AI code nikaal do
const startIndex = src.indexOf("function InteractiveSuggest(");
const endIndex = src.indexOf("function EstimatePanel(");
if (startIndex !== -1 && endIndex !== -1) {
    src = src.slice(0, startIndex) + src.slice(endIndex);
}

// 2. Naya Real-World Logic wala AI
const newAICode = `
function InteractiveSuggest({ C, menu, persons, onSuggest, onCancel }) {
  const [step, setStep] = React.useState(0);
  const [selections, setSelections] = React.useState({});

  // Asli restaurant ka maths (30 logo ke liye 30 plates nahi bante)
  const steps = [
    {
      title: "1. Starter / Snacks",
      filter: (m) => /starter|snack|tandoor|momos|roll/i.test(m.category || ""),
      calcQty: (p) => Math.ceil(p / 3), // 3 logo ke liye 1 plate starter
    },
    {
      title: "2. Main Course",
      filter: (m) => /main|curry|sabzi|gravy|paneer|chicken|mutton/i.test(m.category || ""),
      calcQty: (p) => Math.ceil(p / 4), // 4 logo ke liye 1 plate main course
    },
    {
      title: "3. Bread (Roti/Naan)",
      filter: (m) => /bread|roti|naan/i.test(m.category || ""),
      calcQty: (p) => p * 2, // Har banda 2 roti khata hai
    },
    {
      title: "4. Rice / Biryani",
      filter: (m) => /rice|biryani|pulao/i.test(m.category || ""),
      calcQty: (p) => Math.ceil(p / 3), // 3 logo ke liye 1 plate rice
    },
    {
      title: "5. Drinks / Shakes",
      filter: (m) => /drink|shake|juice|cold|mojito/i.test(m.category || ""),
      calcQty: (p) => p, // Har bande ko 1 drink
    }
  ];

  const currentStepData = steps[step];
  const stepItems = menu.filter(m => m.available && currentStepData.filter(m));

  const handleSelectItem = (item) => {
    setSelections(prev => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = { item, qty: 1 };
      return next;
    });
  };

  const changeQty = (item, delta) => {
    setSelections(prev => {
      const next = { ...prev };
      if (next[item.id]) {
        const newQty = next[item.id].qty + delta;
        if (newQty <= 0) delete next[item.id];
        else next[item.id].qty = newQty;
      }
      return next;
    });
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      // Jab Sab select ho jaye, tab REAL-WORLD math laga kar qty set karo
      const finalItems = Object.values(selections).map(sel => {
        const autoQty = currentStepData.calcQty(persons);
        return { id: sel.item.id, name: sel.item.name, price: sel.item.price, qty: Math.max(1, autoQty) };
      });
      
      onSuggest(finalItems);
    }
  };

  return (
    <div style={{ marginTop: 12, padding: 16, background: C.cardAlt, borderRadius: 12, border: "1px solid " + C.line }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{currentStepData.title}</div>
        <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>{step + 1}/{steps.length} (For {persons} pax)</div>
      </div>

      <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
        {stepItems.length === 0 && <div style={{ fontSize: 13, color: C.gray, textAlign: 'center', padding: 10 }}>Is category me kuch nahi mila. Skip karo.</div>}
        {stepItems.map(m => {
          const isSelected = !!selections[m.id];
          const qty = selections[m.id]?.qty || 0;
          return (
            <div key={m.id} onClick={() => !isSelected && handleSelectItem(m)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderBottom: "1px solid " + C.line, background: isSelected ? C.goldLight : 'transparent', borderRadius: 8, cursor: 'pointer', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.veg ? 'green' : 'red' }}></span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{m.name}</span>
              </div>
              
              {isSelected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card, borderRadius: 6, padding: '2px 6px', border: "1px solid " + C.line }}>
                  <button onClick={(e) => { e.stopPropagation(); changeQty(m, -1); }} style={{ border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer', color: C.gray }}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{qty}</span>
                  <button onClick={(e) => { e.stopPropagation(); changeQty(m, 1); }} style={{ border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer', color: C.ink }}>+</button>
                </div>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 800, color: C.goldText }}>{inr(m.price)} +</span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {step > 0 && <button onClick={() => setStep(step - 1)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid " + C.line, background: C.card, fontWeight: 700, cursor: 'pointer', color: C.ink }}>← Pichla</button>}
        {step < steps.length - 1 ? (
          <button onClick={handleNext} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: C.gold, color: "#fff", fontWeight: 800, cursor: 'pointer' }}>Aage badho →</button>
        ) : (
          <button onClick={handleNext} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: C.green, color: "#fff", fontWeight: 800, cursor: 'pointer' }}>✅ Items Lagao</button>
        )}
      </div>
      <button onClick={onCancel} style={{ width: '100%', marginTop: 10, padding: 8, border: 'none', background: 'transparent', color: C.gray, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Cancel (Manual Mode me wapas jao)</button>
    </div>
  );
}
`;

src = src.replace("function EstimatePanel(", newAICode + "\nfunction EstimatePanel(");

// 3. Estimate Panel me mode toggle ka logic theek karo
const oldManualBtn = `<button style={btn(mode === "manual")} onClick={() => setMode("manual")}>✍️ Manual</button>`;
const newManualBtn = `<button style={btn(mode === "manual")} onClick={() => setMode("manual")}>✍️ Manual</button>`;

const oldAutoBtn = `<button style={btn(mode === "auto")} onClick={() => { setMode("auto"); }}>🤖 Smart AI Suggest</button>`;
const newAutoBtn = `<button style={btn(mode === "auto")} onClick={() => { setMode("auto"); }}>🤖 Smart AI Suggest</button>`;

// 4. Auto mode render update karo
const oldAutoModeRegex = /\{mode === "auto" && \([\s\S]*?\)\}/;
const newAutoMode = `{mode === "auto" && (
          <div style={{ marginBottom: 12 }}>
            <InteractiveSuggest
              C={C}
              menu={menu}
              persons={Number(persons) || 1}
              onCancel={() => setMode("manual")} 
              onSuggest={(newItems) => {
                setMode("manual");
                if (!newItems || newItems.length === 0) return;
                
                setItems((prev) => {
                  const merged = [...prev];
                  newItems.forEach((ni) => {
                    const ex = merged.find((p) => p.id === ni.id);
                    if (ex) ex.qty += ni.qty;
                    else merged.push(ni);
                  });
                  return merged;
                });
                toast("✅ Sahi quantity ke sath items add ho gaye!", "success");
              }}
            />
          </div>
        )}`;

if (src.match(oldAutoModeRegex)) {
    src = src.replace(oldAutoModeRegex, newAutoMode);
    console.log("✅ Naya Smart AI (Maths fix + Data loss fix) lag gaya!");
}

fs.writeFileSync(filePath, src, "utf8");
