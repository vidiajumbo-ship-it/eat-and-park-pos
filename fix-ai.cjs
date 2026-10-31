const fs = require("fs");
const filePath = "src/StaffApp.jsx";
let src = fs.readFileSync(filePath, "utf8");

// 1. Purane kharab AI code ko dhoondh kar hatao
const startIndex = src.indexOf("const SMART_AI_STEPS = [");
const endIndex = src.indexOf("function EstimatePanel(");

if (startIndex !== -1 && endIndex !== -1) {
    src = src.slice(0, startIndex) + src.slice(endIndex);
}

// 2. Naya "Waiter Style" AI Code add karo
const newAICode = `
function InteractiveSuggest({ C, menu, persons, onSuggest, onCancel }) {
  const [step, setStep] = React.useState(0);
  const [selections, setSelections] = React.useState({});

  const isVeg = (m) => m.veg;
  
  // Har step ke liye categories aur unke items filter karo
  const steps = [
    {
      title: "1. Starter (Snacks)",
      filter: (m) => /starter|snack|tandoor|momos|roll/i.test(m.category || ""),
    },
    {
      title: "2. Main Course",
      filter: (m) => /main|curry|sabzi|gravy|paneer|chicken|mutton/i.test(m.category || ""),
    },
    {
      title: "3. Bread (Roti/Naan)",
      filter: (m) => /bread|roti|naan/i.test(m.category || ""),
    },
    {
      title: "4. Rice / Biryani",
      filter: (m) => /rice|biryani|pulao/i.test(m.category || ""),
    },
    {
      title: "5. Drinks",
      filter: (m) => /drink|shake|juice|cold|mojito/i.test(m.category || ""),
    }
  ];

  const currentStepData = steps[step];
  
  // Current step ke items (veg/non-veg dono)
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
      // Calculation based on persons
      const finalItems = Object.values(selections).map(sel => {
        let qty = sel.qty;
        // Smart quantity logic based on category
        const cat = sel.item.category || "";
        if (/bread|roti|naan/i.test(cat)) qty = persons * 2;
        else if (/rice|biryani/i.test(cat)) qty = Math.ceil(persons / 2);
        else if (/starter|snack/i.test(cat)) qty = persons; 
        else if (/drink|shake/i.test(cat)) qty = persons;
        else qty = Math.ceil(persons * 0.7); // Main course
        
        return { id: sel.item.id, name: sel.item.name, price: sel.item.price, qty: Math.max(1, qty) };
      });
      
      onSuggest(finalItems);
    }
  };

  return (
    <div style={{ marginTop: 12, padding: 16, background: C.cardAlt, borderRadius: 12, border: "1px solid " + C.line }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{currentStepData.title}</div>
        <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>Step {step + 1}/{steps.length} (For {persons} persons)</div>
      </div>

      <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
        {stepItems.length === 0 && <div style={{ fontSize: 13, color: C.gray, textAlign: 'center', padding: 10 }}>Is category me kuch nahi mila</div>}
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
    </div>
  );
}
`;

// 3. Naya AI code file me daalo
src = src.replace("function EstimatePanel(", newAICode + "\nfunction EstimatePanel(");

// 4. EstimatePanel ke andar "auto" mode wale button ko update karo
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
                toast("✅ AI ne smart quantity ke sath items daal diye!", "success");
              }}
            />
          </div>
        )}`;

if (src.match(oldAutoModeRegex)) {
    src = src.replace(oldAutoModeRegex, newAutoMode);
    console.log("✅ Smart AI (Waiter Style) lag gaya!");
}

fs.writeFileSync(filePath, src, "utf8");
