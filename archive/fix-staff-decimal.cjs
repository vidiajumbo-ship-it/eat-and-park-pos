const fs = require("fs");
const filePath = "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) { console.log("❌ File nahi mili"); process.exit(1); }
let src = fs.readFileSync(filePath, "utf8");
let changes = 0;

// 1. Billing screen ka Qty input (width: 32, height: 30 wala)
// Ise text type karo taaki dot type ho sake
const oldInput = `<input type="number" inputMode="decimal" min={0} step="any" defaultValue={it.qty}`;
const newInput = `<input type="text" inputMode="decimal" defaultValue={it.qty}`;

if (src.includes(oldInput)) {
  src = src.replace(oldInput, newInput);
  changes++;
  console.log("✅ Fixed Qty input type='number' -> 'text'");
} else {
  console.log("⚠️ Type=number wala input nahi mila, shayad pehle se fix hai.");
}

// 2. Width badhao taaki 1.5 fit ho sake
const oldWidth = `style={{ width: 32, height: 30, textAlign: "center", border: "none", background: isDark ? "#161F2F" : "#fff", fontWeight: 900, fontSize: 14, color: "#DC2626", padding: 0, outline: "none" }} />`;
const newWidth = `style={{ width: 44, height: 30, textAlign: "center", border: "none", background: isDark ? "#161F2F" : "#fff", fontWeight: 900, fontSize: 14, color: "#DC2626", padding: 0, outline: "none" }} />`;

if (src.includes(oldWidth)) {
  src = src.replace(oldWidth, newWidth);
  changes++;
  console.log("✅ Fixed Width 32 -> 44");
}

// 3. commitQty function (jo onBlur pe chalta hai)
const oldCommit = `  const commitQty = (rowId, raw) => {
    const v = parseFloat(String(raw).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return false;
    setItems((prev) => prev.map((it) => (it._rowId === rowId ? { ...it, qty: Math.round(v * 100) / 100 } : it)));
    return true;
  };`;
const newCommit = `  const commitQty = (rowId, raw) => {
    const cleaned = String(raw).replace(",", ".").trim();
    if (cleaned === "" || cleaned === ".") return false;
    const v = parseFloat(cleaned);
    if (!Number.isFinite(v) || v <= 0) return false;
    setItems((prev) => prev.map((it) => (it._rowId === rowId ? { ...it, qty: Math.max(0.01, Math.round(v * 100) / 100) } : it)));
    return true;
  };`;

if (src.includes(oldCommit)) {
  src = src.replace(oldCommit, newCommit);
  changes++;
  console.log("✅ Fixed commitQty (allows 1.5)");
}

// 4. changeQty function (+/- buttons)
const oldChange = `const changeQty = (rowId, d) => setItems((prev) => prev.flatMap((it) => (it._rowId !== rowId ? [it] : (it.qty + d <= 0 ? [] : [{ ...it, qty: Math.round((it.qty + d) * 100) / 100 }]))));`;
const newChange = `const changeQty = (rowId, d) => setItems((prev) => prev.flatMap((it) => (it._rowId !== rowId ? [it] : (Number(it.qty) + Number(d) <= 0 ? [] : [{ ...it, qty: Math.max(0.01, Math.round((Number(it.qty) + Number(d)) * 100) / 100) }]))));`;

if (src.includes(oldChange)) {
  src = src.replace(oldChange, newChange);
  changes++;
  console.log("✅ Fixed changeQty (+/- buttons allow decimals)");
}

if (changes === 0) {
  console.log("❌ Kuch nahi badla — code pattern match nahi hua.");
} else {
  fs.writeFileSync(filePath, src, "utf8");
  console.log("\n🎉 Total " + changes + " fixes applied to StaffApp.jsx!");
  console.log("👉 Ab build chalayein: npm run build");
}
