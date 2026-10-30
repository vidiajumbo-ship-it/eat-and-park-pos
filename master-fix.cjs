const fs = require("fs");
const filePath = process.argv[2] || "src/StaffApp.jsx";

let src = fs.readFileSync(filePath, "utf8");
let changes = 0;

console.log("⏳ Master Fix start ho raha hai...\n");

// 1. SMART INTERACTIVE AI COMPONENT
if (!src.includes("function InteractiveSuggest(")) {
  const smartSuggestCode = `
const SMART_AI_STEPS = [
  { key: "type", q: "Khaane ka type kya rakhein?", options: ["Veg", "Non-Veg", "Mix (Veg + Non-Veg)"] },
  { key: "starter", q: "Starter (Snacks) me kya loge?", options: ["Veg Starter", "Non-Veg Starter", "Starter Skip karo"] },
  { key: "main", q: "Main Course me kya loge?", options: ["Paneer (Veg)", "Chicken / Mutton (Non-Veg)", "Dal (Simple Veg)", "Main Course Skip karo"] },
  { key: "bread", q: "Bread / Roti me kya loge?", options: ["Tandoori Roti", "Naan / Butter Naan", "Bread Skip karo"] },
  { key: "drink", q: "Drinks & Dessert?", options: ["Shakes / Cold Drinks", "Dessert (Sweet)", "Dono", "Skip karo"] },
];

function InteractiveSuggest({ C, menu, persons, onSuggest }) {
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
      {step > 0 && <button onClick={() => setStep(step - 1)} style={{ marginTop: 12, padding: "8px 16px", background: "transparent", border: "none", color: C.gray, fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>← Pichla step</button>}
    </div>
  );
}
`;
  src = src.replace("function EstimatePanel({", smartSuggestCode + "function EstimatePanel({");
  console.log("✅ 1. Smart Interactive AI add kiya");
  changes++;
}

// 2. ESTIMATE PANEL UPDATE
if (src.includes("function EstimatePanel(")) {
  const oldAuto = `{mode === "auto" && (
          <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
            <button onClick={runAuto} style={{ ...btn(false), padding: "10px 16px" }}>🔄 Dobara suggest karo ({persons} persons)</button>
          </div>
        )}`;
  
  const newAuto = `{mode === "auto" && (
          <div style={{ marginBottom: 12 }}>
            <InteractiveSuggest C={C} menu={menu} persons={Number(persons) || 1} onSuggest={(newItems) => {
                if (!newItems.length) { toast("Auto suggest ke liye menu me category match nahi mili", "warning"); return; }
                setItems(newItems);
                setMode("manual");
              }} />
          </div>
        )}`;
  
  if (src.includes(oldAuto)) { src = src.replace(oldAuto, newAuto); console.log("✅ 2a. Auto Mode update kiya"); changes++; }

  if (src.includes(`>🤖 Auto Suggest</button>`)) { src = src.replace(`>🤖 Auto Suggest</button>`, `>🤖 Smart AI Suggest</button>`); console.log("✅ 2b. Button text update kiya"); changes++; }

  const printBtn = `
        <button onClick={() => {
            const w = window.open("", "_blank", "width=300,height=600");
            if (!w) return;
            w.document.write(\`<html><head><title>Estimate</title><style>body{font-family:monospace;font-size:13px;padding:12px;width:280px}h2,h4{text-align:center;margin:4px 0}.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #000}</style></head><body><h2>Eat & Park</h2><h4>ESTIMATE (For \${persons} Persons)</h4><div style="margin-top:10px">\${items.map(it => \`<div class="row"><span>\${it.qty}x \${it.name}</span><span>₹\${it.price * it.qty}</span></div>\`).join('')}</div><div style="text-align:right;font-weight:bold;margin-top:12px;font-size:15px">Total: ₹\${total}</div><div style="text-align:right;font-weight:bold;margin-top:4px">Per Person: ₹\${Math.round(total / (Number(persons) || 1))}</div><p style="text-align:center;margin-top:12px;font-size:11px">— Estimate Only —</p><script>window.print();setTimeout(()=>window.close(),500)</script></body></html>\`);
            w.document.close();
          }} style={{ marginTop: 12, width: "100%", padding: "13px", background: C.card, color: C.ink, border: \`1.5px solid \${C.gold}\`, borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>🖨️ Print Estimate (Without Bill)</button>`;

  const submitBtnAnchor = `<button
          disabled={!items.length}
          onClick={() => onMoveToCart(items)}`;
  if (src.includes(submitBtnAnchor) && !src.includes("Print Estimate (Without Bill)")) {
    src = src.replace(submitBtnAnchor, printBtn + "\n        " + submitBtnAnchor);
    console.log("✅ 2c. Print button add kiya"); changes++;
  }
}

// 3. TABS UI FIX
if (src.includes(`4, overflowX: "auto" }}>`)) {
  const badStart = src.indexOf(`{/* TABS */}`);
  const badEnd = src.indexOf(`{/* CONTENT */}`);
  if (badStart !== -1 && badEnd !== -1) {
    const correctTabs = `{/* TABS */}
      <div style={{ background: C.card, borderBottom: \`1px solid \${C.line}\`, padding: isMobile ? "0 8px" : "0 16px", display: "flex", gap: 4, overflowX: "auto", alignItems: "center" }}>
        <button onClick={() => { haptic(); setShowEstimate(true); }} style={{ padding: isMobile ? "12px 12px" : "15px 20px", border: "none", background: "transparent", color: C.green, fontWeight: 900, fontSize: isMobile ? 12 : 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, borderBottom: \`3px solid \${C.green}\` }}>📋 Estimate</button>
        {[
          { id: "tables", label: \`🍽️ Tables\` }, { id: "parcel", label: \`🛍️ Parcel\${parcelCount ? \` (\${parcelCount})\` : ""}\` },
          { id: "orders", label: \`📋 Orders\${newCount ? \` (\${newCount})\` : ""}\` }, { id: "kot", label: \`🍳 Kitchen\${newCount ? \` (\${newCount})\` : ""}\` },
          { id: "dashboard", label: "📊 Dashboard" }, { id: "history", label: "🕘 History" },
          { id: "inventory", label: "🧾 Saman" + (lowCount ? " (" + lowCount + ")" : "") }, { id: "audit", label: "📝 Audit" },
          { id: "expenses", label: "💸 Kharcha" }, { id: "bookings", label: "📅 Bookings" },
          { id: "reports", label: "📈 Reports" }, { id: "import", label: "📥 Import" },
        ].map(tab => (
          <button key={tab.id} onClick={() => { haptic(); setActiveTab(tab.id); setSelectedTable(null); setOrdersRange(null); }} style={{ padding: isMobile ? "12px 12px" : "15px 20px", border: "none", background: "transparent", color: activeTab === tab.id ? C.gold : C.gray, fontWeight: 700, fontSize: isMobile ? 12 : 13, cursor: "pointer", borderBottom: activeTab === tab.id ? \`3px solid \${C.gold}\` : "3px solid transparent", whiteSpace: "nowrap", flexShrink: 0 }}>{tab.label}</button>
        ))}
      </div>
      `;
    src = src.slice(0, badStart) + correctTabs + src.slice(badEnd);
    console.log("✅ 3. TABS UI fix kiya"); changes++;
  }
}

// 4. AI BACK WARNING
if (src.includes(`onClick={closeAi}`) && !src.includes(`window.confirm("AI ka data clear ho jayega`)) {
    src = src.replace(`onClick={closeAi}`, `onClick={() => { if (aiRes || aiText) { if(window.confirm("AI ka data clear ho jayega, aage badhein?")) closeAi(); } else closeAi(); }}`);
    console.log("✅ 4. AI warning add ki"); changes++;
}

fs.writeFileSync(filePath, src, "utf8");
console.log(`\n🎉 Master Fix successfully applied! Total ${changes} changes.`);