const fs = require("fs");
const filePath = "src/StaffApp.jsx";
if (!fs.existsSync(filePath)) { console.log("❌ File nahi mili"); process.exit(1); }
let src = fs.readFileSync(filePath, "utf8");
let changes = 0;

// ==========================================
// FIX 1: BillPOSScreenInner ka changeQty (Math.round hatao)
// ==========================================
const oldChangeQty = `const changeQty = (rowId, d) => setItems((prev) => prev.flatMap((it) => (it._rowId !== rowId ? [it] : (it.qty + d <= 0 ? [] : [{ ...it, qty: Math.round((it.qty + d) * 100) / 100 }]))));`;
const newChangeQty = `const changeQty = (rowId, d) => setItems((prev) => prev.flatMap((it) => (it._rowId !== rowId ? [it] : (it.qty + d <= 0 ? [] : [{ ...it, qty: Math.max(0, Math.round((Number(it.qty) + Number(d)) * 100) / 100) }]))));`;
if (src.includes(oldChangeQty)) { src = src.replace(oldChangeQty, newChangeQty); changes++; console.log("✅ Fixed changeQty (BillPOS)"); }

// ==========================================
// FIX 2: commitQty (jo manual input se aata hai)
// ==========================================
const oldCommitQty = `  const commitQty = (rowId, raw) => {
    const v = parseFloat(String(raw).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return false;
    setItems((prev) => prev.map((it) => (it._rowId === rowId ? { ...it, qty: Math.round(v * 100) / 100 } : it)));
    return true;
  };`;
const newCommitQty = `  const commitQty = (rowId, raw) => {
    const v = parseFloat(String(raw).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return false;
    setItems((prev) => prev.map((it) => (it._rowId === rowId ? { ...it, qty: Math.max(0.01, Math.round(v * 100) / 100) } : it)));
    return true;
  };`;
if (src.includes(oldCommitQty)) { src = src.replace(oldCommitQty, newCommitQty); changes++; console.log("✅ Fixed commitQty (BillPOS)"); }

// ==========================================
// FIX 3: POSController ka setQty (estimate se aata hai)
// ==========================================
const oldPoscQty = `  const setQty = (id, q) => {
    haptic(5);
    setCart(prev => { const next = { ...prev }; if (q <= 0) delete next[id]; else next[id] = q; return next; });
  };`;
const newPoscQty = `  const setQty = (id, q) => {
    haptic(5);
    const parsed = q === "" || q === "." ? 0 : parseFloat(q);
    const finalQty = isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
    setCart(prev => { 
      const next = { ...prev }; 
      if (finalQty <= 0) delete next[id]; 
      else next[id] = finalQty; 
      return next; 
    });
  };`;
if (src.includes(oldPoscQty)) { src = src.replace(oldPoscQty, newPoscQty); changes++; console.log("✅ Fixed POSController setQty"); }

// ==========================================
// FIX 4: BillPOS ka Qty input (jo abhi bhi type number hai)
// ==========================================
const oldQtyInputBillPOS = `<input key={it._rowId + "_q_" + it.qty} type="number" inputMode="decimal" min={0} step="any" defaultValue={it.qty}
                onBlur={(e) => { if (!commitQty(it._rowId, e.target.value)) e.target.value = it.qty; }}
                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                style={{ width: 32, height: 30, textAlign: "center", border: "none", background: isDark ? "#161F2F" : "#fff", fontWeight: 900, fontSize: 14, color: "#DC2626", padding: 0, outline: "none" }} />`;
const newQtyInputBillPOS = `<input key={it._rowId + "_q_" + it.qty} type="text" inputMode="decimal" defaultValue={it.qty}
                onBlur={(e) => { if (!commitQty(it._rowId, e.target.value)) e.target.value = it.qty; }}
                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                style={{ width: 40, height: 30, textAlign: "center", border: "none", background: isDark ? "#161F2F" : "#fff", fontWeight: 900, fontSize: 14, color: "#DC2626", padding: 0, outline: "none" }} />`;
if (src.includes(oldQtyInputBillPOS)) { src = src.replace(oldQtyInputBillPOS, newQtyInputBillPOS); changes++; console.log("✅ Fixed BillPOS Qty input to text"); }

// ==========================================
// FIX 5: BillingView ka Qty input (agar pehle nahi hua)
// ==========================================
const oldQtyInput2 = `<input type="number" value={q} onChange={(e) => setQty(id, parseInt(e.target.value) || 0)} style={{ flex: 1, width: "100%", minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink, border: "none", background: "transparent", outline: "none", fontFamily: "monospace" }} />`;
const newQtyInput2 = `<input type="text" inputMode="decimal" value={q} onChange={(e) => setQty(id, e.target.value)} style={{ flex: 1, width: "100%", minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink, border: "none", background: "transparent", outline: "none", fontFamily: "monospace" }} />`;
if (src.includes(oldQtyInput2)) { src = src.replace(oldQtyInput2, newQtyInput2); changes++; console.log("✅ Fixed BillingView Qty input to text"); }

if (changes === 0) {
  console.log("❌ Kuch bhi change nahi hua — code alag hai. Mujhe exact line bhejein.");
} else {
  fs.writeFileSync(filePath, src, "utf8");
  console.log("\n🎉 Total " + changes + " fixes applied!");
  console.log("👉 Ab build chalayein: npm run build");
}
