const fs = require("fs");
let src = fs.readFileSync("src/StaffApp.jsx", "utf8");
let c = 0;

if (src.includes('type="number" inputMode="decimal" min={0} step="any" defaultValue={it.qty}')) {
  src = src.replace('type="number" inputMode="decimal" min={0} step="any" defaultValue={it.qty}', 'type="text" inputMode="decimal" defaultValue={it.qty}');
  c++;
}

const oldChange = `const changeQty = (rowId, d) => setItems((prev) => prev.flatMap((it) => (it._rowId !== rowId ? [it] : (it.qty + d <= 0 ? [] : [{ ...it, qty: Math.round((it.qty + d) * 100) / 100 }]))));`;
const newChange = `const changeQty = (rowId, d) => setItems((prev) => prev.flatMap((it) => (it._rowId !== rowId ? [it] : (Number(it.qty) + Number(d) <= 0 ? [] : [{ ...it, qty: Math.max(0.01, Math.round((Number(it.qty) + Number(d)) * 100) / 100) }]))));`;
if (src.includes(oldChange)) {
  src = src.replace(oldChange, newChange);
  c++;
}

const oldCommit = `setItems((prev) => prev.map((it) => (it._rowId === rowId ? { ...it, qty: Math.round(v * 100) / 100 } : it)));`;
const newCommit = `setItems((prev) => prev.map((it) => (it._rowId === rowId ? { ...it, qty: Math.max(0.01, Math.round(v * 100) / 100) } : it)));`;
if (src.includes(oldCommit)) {
  src = src.replace(oldCommit, newCommit);
  c++;
}

fs.writeFileSync("src/StaffApp.jsx", src);
console.log("✅ " + c + " fixes applied! Ab build chalao.");
