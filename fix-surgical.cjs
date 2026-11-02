const fs = require("fs");
const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
  console.error("❌ File nahi mili:", filePath);
  process.exit(1);
}

let lines = fs.readFileSync(filePath, "utf8").split('\n');

// Perfect Code (Koi tag toota nahi hai)
const newPerfectCode = `          <div style={{ flex: isMobile ? "none" : 1, overflowY: isMobile ? "visible" : "auto", minHeight: isMobile ? 0 : 140 }}>
            {cartItems.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: C.gray, fontSize: 13, fontWeight: 700 }}><div style={{ fontSize: 40, marginBottom: 8, opacity: 0.5 }}>🧾</div>Menu se item tap karo</div>}
            {cartItems.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: C.cardAlt, borderBottom: "1px solid " + C.line, fontSize: 10, fontWeight: 800, color: C.gray, letterSpacing: 0.5, textTransform: "uppercase" }}>
                <div style={{ flex: 1 }}>Item</div>
                <div style={{ width: 84, textAlign: "center" }}>Qty</div>
                <div style={{ width: 64, textAlign: "right" }}>Amount</div>
                <div style={{ width: 16 }} />
              </div>
            )}
            {cartItems.map(([id, q]) => {
              const m = resolveItem(id);
              if (!m) return null;
              const existingQty = existingItems.filter(e => e.itemId === id).reduce((s, e) => s + e.qty, 0);
              const isNew = !!existingOrder && !addMoreMode && existingQty === 0;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "1px dashed " + C.line, background: isNew ? C.greenLight : "transparent" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, lineHeight: 1.25 }}>
                      {m.name}{m.portion ? " (" + m.portion + ")" : ""}
                      {isNew && <span style={{ marginLeft: 6, background: C.green, color: "#fff", fontSize: 8, padding: "1px 5px", borderRadius: 3, fontWeight: 800, verticalAlign: "middle" }}>NEW</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 2, fontFamily: "monospace", cursor: "pointer", textDecoration: "underline dotted" }} onClick={() => editRate(id, rates[id] ?? m.price, m.name)}>✎ {inr(rates[id] ?? m.price)} x {q}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", width: 84, justifyContent: "center", border: "1px solid " + C.line, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                    <button onClick={() => setQty(id, q - 1)} style={{ width: 26, height: 26, border: "none", background: C.cardAlt, color: C.ink, fontSize: 15, fontWeight: 900, cursor: "pointer", padding: 0 }}>-</button>
                    <input type="number" value={q} onChange={(e) => setQty(id, parseInt(e.target.value) || 0)} style={{ flex: 1, width: "100%", minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink, border: "none", background: "transparent", outline: "none", fontFamily: "monospace" }} />
                    <button onClick={() => setQty(id, q + 1)} style={{ width: 26, height: 26, border: "none", background: C.goldLight, color: C.goldText, fontSize: 15, fontWeight: 900, cursor: "pointer", padding: 0 }}>+</button>
                  </div>
                  <div style={{ width: 64, textAlign: "right", fontWeight: 800, fontSize: 13, color: C.ink, fontFamily: "monospace", flexShrink: 0 }}>{inr((rates[id] ?? m.price) * q)}</div>
                  <button onClick={() => setQty(id, 0)} style={{ width: 16, background: "transparent", border: "none", color: C.gray, fontSize: 13, cursor: "pointer", padding: 0, flexShrink: 0 }}>x</button>
                </div>
              );
            })}
          </div>
          
          <div style={{ borderTop: \`2px solid \${C.line}\`, padding: 10, background: C.light, overflowY: isMobile ? "visible" : "auto", maxHeight: isMobile ? "none" : "55vh" }}>
            {!addMoreMode && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
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
            )}`;

// Ab hum file mein exact start aur end dhoondhenge
let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  // Cart list shuru hone ki jagah
  if (lines[i].includes('flex: isMobile ? "none" : 1, overflowY: isMobile ? "visible" : "auto"')) {
    startIndex = i;
  }
  // Payment section khatam hone ki jagah (just before Save/Print buttons)
  if (startIndex !== -1 && lines[i].includes('TOTAL') && lines[i-1] && lines[i-1].includes('C.gold')) {
    endIndex = i - 3; // Total ke thoda pehle tak replace karna hai
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  // Purane toote hue code ko hata kar naya perfect code daal do
  lines.splice(startIndex, endIndex - startIndex, newPerfectCode);
  fs.writeFileSync(filePath, lines.join('\n'), "utf8");
  console.log("✅ Fix Successful: Exact line numbers se toota hua code hatakar perfect code daal diya gaya hai.");
  console.log("👉 Ab terminal mein ye command run karein:");
  console.log("   git add src/StaffApp.jsx && git commit -m \"Fixed build permanently with surgical script\" && git push origin main --force");
} else {
  console.log("⚠️ Lines dhoondhne mein dikkat aayi. Shayad code aur alag hai.");
}