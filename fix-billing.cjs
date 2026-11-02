const fs = require("fs");

const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
  console.error("❌ File nahi mili:", filePath);
  process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");
let edits = 0;

// ---------------------------------------------------------
// FIX 1: Quantity Edit (Input box) - Smart Match
// ---------------------------------------------------------
const qtyRegex = /\{\s*q\s*\}<\/span>/;
if (qtyRegex.test(code)) {
  // Pichla qty span dhoondh kar usko input se replace karna
  const startIndex = code.indexOf(qtyRegex.exec(code)[0]);
  if (startIndex !== -1) {
    const subStr = code.substring(startIndex - 150, startIndex + 20);
    const replaceStr = `<input type="number" value={q} onChange={(e) => setQty(id, parseInt(e.target.value) || 0)} style={{ width: 36, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink, border: "none", background: "transparent", outline: "none", fontFamily: "monospace" }} />`;
    // bas {q}</span> wale part ko replace karo
    code = code.replace(/\{\s*q\s*\}<\/span>/, replaceStr);
    edits++;
    console.log("✅ Fix 1: Quantity ab editable input box hai.");
  }
} else {
  console.log("⚠️ Fix 1 SKIP: Qty code match nahi hua.");
}

// ---------------------------------------------------------
// FIX 2: UI mein Payment Modes aur Cash Discount block - Smart Match
// ---------------------------------------------------------
// Hum "PAY" wale block ko dhoondhenge
const uiRegex = /\{\!addMoreMode\s*&&\s*\(\s*<div[^>]*>\s*<span[^>]*>PAY<\/span>/;
const matchUI = code.match(uiRegex);

if (matchUI) {
  const startIdx = matchUI.index;
  const endIdx = code.indexOf('</div>', code.indexOf('map', startIdx)) + 6;
  
  // Check if we found the end correctly
  if (endIdx > startIdx) {
    const uiNew = `{!addMoreMode && (
              <div style={{ display: showAdj ? "flex" : "none", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                {/* 👤 CUSTOMER DETAILS */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, background: C.cardAlt, borderRadius: 6 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input placeholder="Customer Name" value={custName} onChange={e => setCustName(e.target.value)} style={{ flex: 1, padding: "4px 6px", border: \`1px solid \${C.line}\`, borderRadius: 4, fontSize: 11, background: C.card, color: C.ink, outline: "none" }} />
                    <input placeholder="Phone No." value={custPhone} onChange={e => setCustPhone(e.target.value)} type="tel" style={{ flex: 1, padding: "4px 6px", border: \`1px solid \${C.line}\`, borderRadius: 4, fontSize: 11, background: C.card, color: C.ink, outline: "none" }} />
                  </div>
                  {table === "parcel" && (
                    <input placeholder="Delivery Address" value={custAddress} onChange={e => setCustAddress(e.target.value)} style={{ width: "100%", padding: "4px 6px", border: \`1px solid \${C.line}\`, borderRadius: 4, fontSize: 11, background: C.card, color: C.ink, outline: "none" }} />
                  )}
                </div>

                {/* 💸 CASH DISCOUNT */}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: C.gray, fontWeight: 800, minWidth: 38 }}>CASH DISC</span>
                  <input type="number" min={0} value={cashDiscount || ""} onChange={e => setCashDiscount(Math.max(0, Number(e.target.value) || 0))} placeholder="₹" style={{ width: 60, padding: "4px 6px", border: \`1px solid \${C.line}\`, borderRadius: 4, fontSize: 11, background: C.card, color: C.ink, fontWeight: 700, outline: "none" }} />
                </div>

                {/* 💰 PAYMENT MODES */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: C.gray, fontWeight: 800, minWidth: 38 }}>PAY</span>
                  {[["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["due", "Due"], ["split", "Split"]].map(([id, label]) => (
                    <button key={id} onClick={() => setPayMode(id)} style={{ padding: "3px 9px", borderRadius: 4, border: \`1px solid \${payMode === id ? C.gold : C.line}\`, background: payMode === id ? C.gold : C.card, color: payMode === id ? "#fff" : C.ink, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
                  ))}
                </div>

                {/* 🤝 SPLIT PAYMENT */}
                {payMode === "split" && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", background: C.cardAlt, padding: 8, borderRadius: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: C.gray, fontWeight: 700 }}>Cash</div>
                      <input type="number" value={splitCash} onChange={e => { setSplitCash(e.target.value); setSplitUpi(String(totalAmount - Number(e.target.value))); }} placeholder="₹" style={{ width: "100%", padding: "4px", border: \`1px solid \${C.line}\`, borderRadius: 4, fontSize: 12, fontWeight: 700 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: C.gray, fontWeight: 700 }}>UPI / Online</div>
                      <input type="number" value={splitUpi} onChange={e => { setSplitUpi(e.target.value); setSplitCash(String(totalAmount - Number(e.target.value))); }} placeholder="₹" style={{ width: "100%", padding: "4px", border: \`1px solid \${C.line}\`, borderRadius: 4, fontSize: 12, fontWeight: 700 }} />
                    </div>
                  </div>
                )}
              </div>
            )}`;
            
    // Regex wale block ko naye block se replace karo
    const blockRegex = /(\{\!addMoreMode\s*&&\s*\(\s*<div[\s\S]*?<\/div>\s*\)\})/;
    code = code.replace(blockRegex, uiNew);
    edits++;
    console.log("✅ Fix 2: UI mein Customer details, Cash Discount aur Split add ho gaya.");
  }
} else {
  console.log("⚠️ Fix 2 SKIP: UI code match nahi hua.");
}

// Save
if (edits > 0) {
  fs.writeFileSync(filePath, code, "utf8");
  console.log(`\n🎉 Total ${edits} fixes apply ho gaye!`);
} else {
  console.log("\n❌ Koi fix apply nahi hua.");
}