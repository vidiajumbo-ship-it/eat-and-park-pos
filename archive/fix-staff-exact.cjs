const fs = require("fs");
const filePath = "src/StaffApp.jsx";

let src = fs.readFileSync(filePath, "utf8");
let changes = 0;

// Aapke file ka exact input (Line 4747 ke aas paas)
// 1. type="number" hata kar type="text" karo
const oldInput = `<input
                    value={p.amount}
                    onChange={(e) => editField(p._idx, "amount", e.target.value)}
                    type="number"
                    placeholder="Amount"`;
                    
const newInput = `<input
                    value={p.amount}
                    onChange={(e) => editField(p._idx, "amount", e.target.value)}
                    type="text"
                    inputMode="decimal"
                    placeholder="Amount"`;

if (src.includes(oldInput)) {
  src = src.replace(oldInput, newInput);
  changes++;
  console.log("✅ Fixed Bulk Import Amount Input (type=number -> text)");
} else {
  // Agar line break alag hai toh ek aur try
  const oldAlt = `<input value={p.amount} onChange={(e) => editField(p._idx, "amount", e.target.value)} type="number"`;
  const newAlt = `<input value={p.amount} onChange={(e) => editField(p._idx, "amount", e.target.value)} type="text" inputMode="decimal"`;
  if (src.includes(oldAlt)) {
    src = src.replace(oldAlt, newAlt);
    changes++;
    console.log("✅ Fixed Bulk Import Amount Input (alt pattern)");
  }
}

// 2. Qty ka input jo 1 dikha raha hai (Agar screen par qty input hai)
const oldQty = `<input type="number" inputMode="decimal" min={0} step="any" defaultValue={it.qty}`;
const newQty = `<input type="text" inputMode="decimal" defaultValue={it.qty}`;

if (src.includes(oldQty)) {
  src = src.replace(oldQty, newQty);
  changes++;
  console.log("✅ Fixed BillPOS Qty Input (type=number -> text)");
}

// 3. commitQty mein decimal allow karo (Math.round hatao)
const oldCommit = `const commitQty = (rowId, raw) => {
    const v = parseFloat(String(raw).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return false;
    setItems((prev) => prev.map((it) => (it._rowId === rowId ? { ...it, qty: Math.round(v * 100) / 100 } : it)));
    return true;
  };`;
const newCommit = `const commitQty = (rowId, raw) => {
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

if (changes === 0) {
  console.log("❌ Kuch nahi badla. Shayad format alag hai.");
} else {
  fs.writeFileSync(filePath, src, "utf8");
  console.log("\n🎉 Total " + changes + " fixes applied!");
  console.log("👉 Ab build chalayein: npm run build");
}
