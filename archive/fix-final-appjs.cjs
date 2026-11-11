const fs = require("fs");
const filePath = "src/App.jsx";
let src = fs.readFileSync(filePath, "utf8");
let changes = 0;

// 1. Qty input type="number" → "text" (Line 4607)
const oldInput = `<input key={it._rowId + "_q_" + it.qty} type="number" inputMode="decimal" min={0} step="any" defaultValue={it.qty}`;
const newInput = `<input key={it._rowId + "_q_" + it.qty} type="text" inputMode="decimal" defaultValue={it.qty}`;
if (src.includes(oldInput)) { src = src.replace(oldInput, newInput); changes++; console.log("✅ Qty input type=text"); }

// 2. Qty input width badhao
const oldW = `style={{ width: 32, height: 30, textAlign: "center", border: "none", background: isDark ? "#161F2F" : "#fff", fontWeight: 900, fontSize: 14, color: "#DC2626", padding: 0, outline: "none" }} />`;
const newW = `style={{ width: 44, height: 30, textAlign: "center", border: "none", background: isDark ? "#161F2F" : "#fff", fontWeight: 900, fontSize: 14, color: "#DC2626", padding: 0, outline: "none" }} />`;
if (src.includes(oldW)) { src = src.replace(oldW, newW); changes++; console.log("✅ Width 32→44"); }

// 3. changeQty (Line 4274) — Math.round hatao
const oldChange = `const changeQty = (rowId, d) => setItems((prev) => prev.flatMap((it) => (it._rowId !== rowId ? [it] : (it.qty + d <= 0 ? [] : [{ ...it, qty: Math.round((it.qty + d) * 100) / 100 }]))));`;
const newChange = `const changeQty = (rowId, d) => setItems((prev) => prev.flatMap((it) => (it._rowId !== rowId ? [it] : (Number(it.qty) + Number(d) <= 0 ? [] : [{ ...it, qty: Math.max(0.01, Math.round((Number(it.qty) + Number(d)) * 100) / 100) }]))));`;
if (src.includes(oldChange)) { src = src.replace(oldChange, newChange); changes++; console.log("✅ changeQty allows decimals"); }

// 4. commitQty — decimal allow
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
if (src.includes(oldCommit)) { src = src.replace(oldCommit, newCommit); changes++; console.log("✅ commitQty allows decimals"); }

if (changes === 0) console.log("❌ Pattern match nahi hua.");
else { fs.writeFileSync(filePath, src, "utf8"); console.log("\n🎉 " + changes + " fixes!"); }
