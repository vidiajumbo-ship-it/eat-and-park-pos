const fs = require("fs");
const filePath = "src/StaffApp.jsx";

let src = fs.readFileSync(filePath, "utf8");
let changes = 0;

// ==========================================
// FIX: BillPOSScreen qty input — jo screenshot mein hai
// ==========================================
// Purana input dhundo (jo abhi bhi type="number" hai)
const oldInput = `<input key={it._rowId + "_q_" + it.qty} type="number" inputMode="decimal" min={0} step="any" defaultValue={it.qty}
                onBlur={(e) => { if (!commitQty(it._rowId, e.target.value)) e.target.value = it.qty; }}
                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                style={{ width: 32, height: 30, textAlign: "center", border: "none", background: isDark ? "#161F2F" : "#fff", fontWeight: 900, fontSize: 14, color: "#DC2626", padding: 0, outline: "none" }} />`;

const newInput = `<input key={it._rowId + "_q_" + it.qty} type="text" inputMode="decimal" defaultValue={it.qty}
                onBlur={(e) => { if (!commitQty(it._rowId, e.target.value)) e.target.value = it.qty; }}
                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                style={{ width: 40, height: 30, textAlign: "center", border: "none", background: isDark ? "#161F2F" : "#fff", fontWeight: 900, fontSize: 14, color: "#DC2626", padding: 0, outline: "none" }} />`;

if (src.includes(oldInput)) {
  src = src.replace(oldInput, newInput);
  changes++;
  console.log("✅ Fixed BillPOS qty input (type=text, allows decimal)");
} else {
  // Alternative pattern dhundo
  const oldAlt = `<input key={it._rowId + "_q_" + it.qty} type="number" inputMode="decimal" min={0} step="any" defaultValue={it.qty}`;
  const newAlt = `<input key={it._rowId + "_q_" + it.qty} type="text" inputMode="decimal" defaultValue={it.qty}`;
  if (src.includes(oldAlt)) {
    src = src.replace(oldAlt, newAlt);
    changes++;
    console.log("✅ Fixed BillPOS qty input (alternative pattern)");
  }
}

// ==========================================
// FIX: commitQty — Math.round hatao, 1.5 allow karo
// ==========================================
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
  console.log("✅ Fixed commitQty (handles 1.5)");
}

// ==========================================
// FIX: changeQty — +/- buttons
// ==========================================
const oldChange = `const changeQty = (rowId, d) => setItems((prev) => prev.flatMap((it) => (it._rowId !== rowId ? [it] : (it.qty + d <= 0 ? [] : [{ ...it, qty: Math.round((it.qty + d) * 100) / 100 }]))));`;

const newChange = `const changeQty = (rowId, d) => setItems((prev) => prev.flatMap((it) => (it._rowId !== rowId ? [it] : (it.qty + d <= 0 ? [] : [{ ...it, qty: Math.max(0.01, Math.round((Number(it.qty) + Number(d)) * 100) / 100) }]))));`;

if (src.includes(oldChange)) {
  src = src.replace(oldChange, newChange);
  changes++;
  console.log("✅ Fixed changeQty (+/- buttons)");
}

if (changes === 0) {
  console.log("❌ Kuch nahi badla — code pattern alag hai. File check karo.");
} else {
  fs.writeFileSync(filePath, src, "utf8");
  console.log("\n🎉 Total " + changes + " fixes applied!");
}
