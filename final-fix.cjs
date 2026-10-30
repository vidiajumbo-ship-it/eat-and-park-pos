const fs = require("fs");
const filePath = process.argv[2] || "src/StaffApp.jsx";
let src = fs.readFileSync(filePath, "utf8");

console.log("⏳ Final Fix start...\n");

// 1. Remove old InteractiveSuggest and SMART_AI_STEPS (if they exist)
const startIndex = src.indexOf("const SMART_AI_STEPS = [");
const endIndex = src.indexOf("function EstimatePanel(");
if (startIndex !== -1 && endIndex !== -1) {
    src = src.slice(0, startIndex) + src.slice(endIndex);
    console.log("✅ Purana AI code saaf kiya.");
}

// 2. Add NEW Clean InteractiveSuggest
const newAICode = `
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
src = src.replace("function EstimatePanel(", newAICode + "\nfunction EstimatePanel(");

// 3. Replace the broken Auto Mode inside EstimatePanel safely
const brokenAutoRegex = /\{mode === "auto" && \([\s\S]*?<\/div>\s*\)\}/;
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
                toast("✅ AI ne items add kar diye!", "success");
              }}
            />
          </div>
        )}`;

if (src.match(brokenAutoRegex)) {
    src = src.replace(brokenAutoRegex, newAutoMode);
    console.log("✅ Auto Mode UI fix kiya.");
}

fs.writeFileSync(filePath, src, "utf8");
console.log("✅ Build safe code ready! Ab npm run dev chala kar check karo.");