const fs = require("fs");
const filePath = process.argv[2] || "src/StaffApp.jsx";
let src = fs.readFileSync(filePath, "utf8");
let changes = 0;

console.log("⏳ Force Fix start...\n");

// 1. SMART AI COMPONENT KO UPDATE KARO (Purane wale ko replace karega)
const newSmartSuggest = `
const SMART_AI_STEPS = [
  { key: "type", q: "Khaane ka type kya rakhein?", options: ["Veg", "Non-Veg", "Mix (Veg + Non-Veg)"] },
  { key: "starter", q: "Starter (Snacks) me kya loge?", options: ["Veg Starter", "Non-Veg Starter", "Starter Skip karo"] },
  { key: "main", q: "Main Course me kya loge?", options: ["Paneer (Veg)", "Chicken / Mutton (Non-Veg)", "Dal (Simple Veg)", "Main Course Skip karo"] },
  { key: "bread", q: "Bread / Roti me kya loge?", options: ["Tandoori Roti", "Naan / Butter Naan", "Bread Skip karo"] },
  { key: "drink", q: "Drinks & Dessert?", options: ["Shakes / Cold Drinks", "Dessert (Sweet)", "Dono", "Skip karo"] },
];

function InteractiveSuggest({ C, menu, persons, onSuggest, onCancel }) {
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState({});

  const handleSelect = (opt) => {
    const newAns = { ...answers, [SMART_AI_STEPS[step].key]: opt };
    setAnswers(newAns);

    if (step < SMART_AI_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      const items = [];
      const addItem = (categoryRegex, pickLimit, perPersonRatio) => {
        const pool = menu.filter((m) => m.available !== false && categoryRegex.test(m.category || ""));
        if (!pool.length) return;
        const picked = pool.sort(() => 0.5 - Math.random()).slice(0, pickLimit);
        picked.forEach((m) => {
          const totalQty = Math.max(1, Math.ceil(persons * perPersonRatio));
          items.push({ id: m.id, name: m.name, price: m.price, qty: totalQty });
        });
      };

      if (newAns.starter === "Veg Starter") addItem(/starter|snack|tandoor|momos/i, 1, 0.5);
      else if (newAns.starter === "Non-Veg Starter") addItem(/chicken|mutton|fish/i, 1, 0.5);

      if (newAns.main === "Paneer (Veg)") addItem(/paneer/i, 2, 0.7);
      else if (newAns.main === "Chicken / Mutton (Non-Veg)") addItem(/chicken|mutton/i, 2, 0.7);
      else if (newAns.main === "Dal (Simple Veg)") addItem(/dal/i, 1, 1);

      if (newAns.bread === "Tandoori Roti") addItem(/roti/i, 1, 1);
      else if (newAns.bread === "Naan / Butter Naan") addItem(/naan/i, 1, 1);

      if (newAns.drink === "Shakes / Cold Drinks" || newAns.drink === "Dono") addItem(/shake|drink|coffee|mojito/i, 1, 1);
      if (newAns.drink === "Dessert (Sweet)" || newAns.drink === "Dono") addItem(/sweet|dessert|ice/i, 1, 0.5);

      onSuggest(items);
    }
  };

  const currentStep = SMART_AI_STEPS[step];

  return (
    <div style={{ marginTop: 12, padding: 16, background: C.cardAlt, borderRadius: 12, border: "1px solid " + C.line }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, marginBottom: 8, textTransform: "uppercase" }}>
        Step {step + 1} of {SMART_AI_STEPS.length}
      </div>
      <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, marginBottom: 14 }}>{currentStep.q}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {currentStep.options.map((opt) => (
          <button key={opt} onClick={() => handleSelect(opt)} style={{ padding: "12px 16px", borderRadius: 10, border: "1.5px solid " + C.line, background: C.card, color: C.ink, fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "inherit" }}>
            {opt} <span style={{ color: C.gray }}>➔</span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <button onClick={() => step > 0 ? setStep(step - 1) : onCancel()} style={{ padding: "8px 0", background: "transparent", border: "none", color: C.gray, fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
          ← {step > 0 ? "Pichla step" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
`;

// Purane InteractiveSuggest ko naye se replace karo
const oldAIFuncStart = src.indexOf("function InteractiveSuggest(");
const oldAIFuncEnd = src.indexOf("function EstimatePanel(");
if (oldAIFuncStart !== -1 && oldAIFuncEnd !== -1) {
    src = src.slice(0, oldAIFuncStart) + newSmartSuggest + "\n" + src.slice(oldAIFuncEnd);
    console.log("✅ 1. AI Component ko naye logic se replace kiya.");
    changes++;
}

// 2. ESTIMATE PANEL ME PURANA AUTO MODE HATAO AUR NAYA LAGAO
const oldAutoStart = src.indexOf(`{mode === "auto" && (`);
const oldAutoEnd = src.indexOf(`)}`, oldAutoStart);

if (oldAutoStart !== -1 && oldAutoEnd !== -1) {
    const newAutoCode = `{mode === "auto" && (
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
                toast("✅ AI ne items add kar diye!", "success");
              }}
            />
          </div>
        `;
    src = src.slice(0, oldAutoStart) + newAutoCode + src.slice(oldAutoEnd + 2);
    console.log("✅ 2. Purana 'Dobara Suggest' hata kar naya AI lagaya.");
    changes++;
}

// 3. MANUAL TAB ME JAANE PE DATA SAFE RAKHNE KA WARNING
const oldManualClick = `<button style={btn(mode === "manual")} onClick={() => setMode("manual")}>✍️ Manual</button>`;
const newManualClick = `<button style={btn(mode === "manual")} onClick={() => { if (mode === "auto" && items.length > 0) { if(window.confirm("AI band ho jayega, par aapke items safe rahenge. Aage badhein?")) setMode("manual"); } else setMode("manual"); }}>✍️ Manual</button>`;
if (src.includes(oldManualClick)) {
    src = src.replace(oldManualClick, newManualClick);
    console.log("✅ 3. Manual tab pe safe warning lagayi.");
    changes++;
}

fs.writeFileSync(filePath, src, "utf8");
console.log(`\n🎉 Force Fix applied! Total ${changes} changes.`);