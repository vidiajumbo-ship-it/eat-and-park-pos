const fs = require("fs");
let file = "src/StaffApp.jsx";
let code = fs.readFileSync(file, "utf8");
let changes = 0;

// 1. Input box ko text type karo (Screenshot mein jo "1" dikh raha hai)
const oldInput = `<input type="number" value={q} onChange={(e) => setQty(id, parseInt(e.target.value) || 0)} style={{ flex: 1, width: "100%", minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink, border: "none", background: "transparent", outline: "none", fontFamily: "monospace" }} />`;
const newInput = `<input type="text" inputMode="decimal" value={q} onChange={(e) => setQty(id, e.target.value)} style={{ flex: 1, width: "100%", minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink, border: "none", background: "transparent", outline: "none", fontFamily: "monospace" }} />`;

if (code.includes(oldInput)) {
  code = code.replace(oldInput, newInput);
  changes++;
  console.log("✅ Input box fix ho gaya (ab dot type ho payega)");
}

// 2. setQty function ko float (decimal) support ke liye update karo
const oldSetQty = `  const setQty = (id, q) => {
    haptic(5);
    setCart(prev => { const next = { ...prev }; if (q <= 0) delete next[id]; else next[id] = q; return next; });
  };`;
const newSetQty = `  const setQty = (id, q) => {
    haptic(5);
    const parsed = (q === "" || q === ".") ? 0 : parseFloat(q);
    const finalQty = isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
    setCart(prev => { const next = { ...prev }; if (finalQty <= 0) delete next[id]; else next[id] = finalQty; return next; });
  };`;

if (code.includes(oldSetQty)) {
  code = code.replace(oldSetQty, newSetQty);
  changes++;
  console.log("✅ setQty function fix ho gaya (1.5 calculate hoga)");
}

if (changes === 2) {
  fs.writeFileSync(file, code, "utf8");
  console.log("\n🎉 Kaam ho gaya! Ab ye chalao:");
  console.log("npm run build && git add . && git commit -m 'decimal fix' && git push origin main");
} else {
  console.log("❌ Kuch lines match nahi hui. Mujhe batao.");
}
