const fs = require("fs");
const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
  console.error("❌ File nahi mili:", filePath);
  process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");

const newUiBlock = `          {!addMoreMode && (
            <div style={{ display: showAdj ? "flex" : "none", flexDirection: "column", gap: 8, marginBottom: 8, padding: "0 12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, background: C.cardAlt, borderRadius: 6 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input placeholder="Customer Name" value={custName} onChange={e => setCustName(e.target.value)} style={{ flex: 1, padding: "4px 6px", border: \`1px solid \${C.line}\`, borderRadius: 4, fontSize: 11, background: C.card, color: C.ink, outline: "none" }} />
                  <input placeholder="Phone No." value={custPhone} onChange={e => setCustPhone(e.target.value)} type="tel" style={{ flex: 1, padding: "4px 6px", border: \`1px solid \${C.line}\`, borderRadius: 4, fontSize: 11, background: C.card, color: C.ink, outline: "none" }} />
                </div>
                {table === "parcel" && (
                  <input placeholder="Delivery Address" value={custAddress} onChange={e => setCustAddress(e.target.value)} style={{ width: "100%", padding: "4px 6px", border: \`1px solid \${C.line}\`, borderRadius: 4, fontSize: 11, background: C.card, color: C.ink, outline: "none" }} />
                )}
              </div>

              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.gray, fontWeight: 800, minWidth: 38 }}>CASH DISC</span>
                <input type="number" min={0} value={cashDiscount || ""} onChange={e => setCashDiscount(Math.max(0, Number(e.target.value) || 0))} placeholder="₹" style={{ width: 60, padding: "4px 6px", border: \`1px solid \${C.line}\`, borderRadius: 4, fontSize: 11, background: C.card, color: C.ink, fontWeight: 700, outline: "none" }} />
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.gray, fontWeight: 800, minWidth: 38 }}>PAY</span>
                {[["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["due", "Due"], ["split", "Split"]].map(([id, label]) => (
                  <button key={id} onClick={() => setPayMode(id)} style={{ padding: "3px 9px", borderRadius: 4, border: \`1px solid \${payMode === id ? C.gold : C.line}\`, background: payMode === id ? C.gold : C.card, color: payMode === id ? "#fff" : C.ink, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
                ))}
              </div>

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
          )}\n`;

// Hum exact us jagah par insert karenge jahan cart items ki list shuru hoti hai
const insertMarker = `          <div style={{ flex: isMobile ? "none" : 1, overflowY: isMobile ? "visible" : "auto", minHeight: isMobile ? 0 : 140 }}>`;

if (code.includes(insertMarker)) {
  // Agar pehle se koi purana UI bacha hai, toh usko delete karo
  const oldUiRegex = /\{\!addMoreMode\s*&&\s*\([\s\S]*?Customer Name[\s\S]*?<\/div>\s*\)\}/g;
  code = code.replace(oldUiRegex, "");

  // Naya UI theek usi jagah lagao
  code = code.replace(insertMarker, newUiBlock + insertMarker);
  
  fs.writeFileSync(filePath, code, "utf8");
  console.log("✅ Fix successful: Customer details aur Payment modes items list ke theek upar set ho gaye hain.");
  console.log("🎉 Ab push karein!");
} else {
  console.log("⚠️ File mein items list ka exact marker nahi mila. Code thoda alag ho sakta hai.");
}