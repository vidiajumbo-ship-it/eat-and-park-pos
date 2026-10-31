const fs = require("fs");
const filePath = "src/StaffApp.jsx";
let src = fs.readFileSync(filePath, "utf8");

console.log("⏳ Fixing AI Cleanly...");

// Hum purane AI component ko dhoondh kar hata denge
const aiStart = src.indexOf("function InteractiveSuggest(");
const estStart = src.indexOf("function EstimatePanel(");

if (aiStart !== -1 && estStart !== -1) {
    src = src.slice(0, aiStart) + src.slice(estStart);
}

// Naya AI Component (Jo crash nahi karega)
const newAI = `
function InteractiveSuggest({ C, menu, persons, onSuggest, onCancel }) {
  const [step, setStep] = React.useState(0);
  const [selections, setSelections] = React.useState({});

  const steps = [
    { title: "1. Starter (Snacks)", filter: (m) => /starter|snack|tandoor|momos|roll/i.test(m.category || ""), calcQty: (p) => Math.ceil(p / 3) },
    { title: "2. Main Course", filter: (m) => /main|curry|sabzi|gravy|paneer|chicken|mutton/i.test(m.category || ""), calcQty: (p) => Math.ceil(p / 4) },
    { title: "3. Bread (Roti/Naan)", filter: (m) => /bread|roti|naan/i.test(m.category || ""), calcQty: (p) => p * 2 },
    { title: "4. Rice / Biryani", filter: (m) => /rice|biryani|pulao/i.test(m.category || ""), calcQty: (p) => Math.ceil(p / 3) },
    { title: "5. Drinks / Shakes", filter: (m) => /drink|shake|juice|cold|mojito/i.test(m.category || ""), calcQty: (p) => p }
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

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
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
        {stepItems.map(m => {
          const isSelected = !!selections[m.id];
          return (
            <div key={m.id} onClick={() => !isSelected && handleSelectItem(m)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderBottom: "1px solid " + C.line, background: isSelected ? C.goldLight : 'transparent', borderRadius: 8, cursor: 'pointer', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.veg ? 'green' : 'red' }}></span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{m.name}</span>
              </div>
              {isSelected ? <span style={{ fontSize: 12, color: C.goldText, fontWeight: 800 }}>Selected ✓</span> : <span style={{ fontSize: 13, fontWeight: 800, color: C.goldText }}>{inr(m.price)} +</span>}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {step > 0 && <button onClick={() => setStep(step - 1)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid " + C.line, background: C.card, fontWeight: 700, cursor: 'pointer', color: C.ink }}>← Pichla</button>}
        {step < steps.length - 1 ? (
          <button onClick={handleNext} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: C.gold, color: "#fff", fontWeight: 800, cursor: 'pointer' }}>Aage →</button>
        ) : (
          <button onClick={handleNext} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: C.green, color: "#fff", fontWeight: 800, cursor: 'pointer' }}>✅ Items Add Karo</button>
        )}
      </div>
      <button onClick={onCancel} style={{ width: '100%', marginTop: 10, padding: 8, border: 'none', background: 'transparent', color: C.gray, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
    </div>
  );
}
`;

// Naya AI component insert karo EstimatePanel se pehle
src = src.replace("function EstimatePanel(", newAI + "\nfunction EstimatePanel(");

// Auto Mode UI ko theek se replace karo (bina bracket tode)
const oldAutoRegex = /\{mode === "auto" && \([\s\S]*?\)\}/;
const newAutoUI = `{mode === "auto" && (
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

if (src.match(oldAutoRegex)) {
    src = src.replace(oldAutoRegex, newAutoUI);
}

fs.writeFileSync(filePath, src, "utf8");
console.log("✅ AI Fix applied safely! Ab build chalega.");
