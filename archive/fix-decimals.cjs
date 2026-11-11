const fs = require("fs");
const filePath = "src/StaffApp.jsx";
if (!fs.existsSync(filePath)) { console.log("❌ File nahi mili"); process.exit(1); }
let src = fs.readFileSync(filePath, "utf8");
let changes = 0;

const oldSetQty = `  const setQty = (id, q) => {
    haptic(5);
    setCart(prev => { const next = { ...prev }; if (q <= 0) delete next[id]; else next[id] = q; return next; });
  };`;
const newSetQty = `  const setQty = (id, q) => {
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
if (src.includes(oldSetQty)) { src = src.replace(oldSetQty, newSetQty); changes++; console.log("✅ setQty fixed"); }

const oldQtyInput = `<input type="number" value={q} onChange={(e) => setQty(id, parseInt(e.target.value) || 0)} style={{ flex: 1, width: "100%", minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink, border: "none", background: "transparent", outline: "none", fontFamily: "monospace" }} />`;
const newQtyInput = `<input type="text" inputMode="decimal" value={q} onChange={(e) => setQty(id, e.target.value)} style={{ flex: 1, width: "100%", minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink, border: "none", background: "transparent", outline: "none", fontFamily: "monospace" }} />`;
if (src.includes(oldQtyInput)) { src = src.replace(oldQtyInput, newQtyInput); changes++; console.log("✅ Qty input fixed"); }

if (changes === 0) console.log("❌ Kuch change nahi hua, code alag hai");
else { fs.writeFileSync(filePath, src, "utf8"); console.log("🎉 " + changes + " fixes applied!"); }
