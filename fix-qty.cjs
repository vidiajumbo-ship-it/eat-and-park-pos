const fs = require("fs");
const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
  console.error("❌ File nahi mili:", filePath);
  process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");

// ---------------------------------------------------------
// FIX 1: ESTIMATE PANEL KO REPAIR KARNA (Build Error Fix)
// ---------------------------------------------------------
const brokenEstimate = `<span style={{ minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 14, color: C.ink, fontFamily: "monospace" }}><input type="number" value={q} onChange={(e) => setQty(id, parseInt(e.target.value) || 0)} style={{ width: 36, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink, border: "none", background: "transparent", outline: "none", fontFamily: "monospace" }} />`;
const fixedEstimate = `<span style={{ minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 14, color: C.ink, fontFamily: "monospace" }}>{q}</span>`;

if (code.includes(brokenEstimate)) {
  code = code.replace(brokenEstimate, fixedEstimate);
  console.log("✅ Fix 1: Estimate Panel repair ho gaya (Build Error khatam).");
} else {
  // Agar line break ki wajah se nahi mila, toh regex se dhoondhenge
  const regex = /<span style={{ minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 14, color: C.ink, fontFamily: "monospace" }}><input type="number" value={q}[\s\S]*?\/>/g;
  if (regex.test(code)) {
    code = code.replace(regex, `<span style={{ minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 14, color: C.ink, fontFamily: "monospace" }}>{q}</span>`);
    console.log("✅ Fix 1: Estimate Panel repair ho gaya (Regex se).");
  } else {
    console.log("⚠️ Fix 1: Estimate panel pehle se theek hai.");
  }
}

// ---------------------------------------------------------
// FIX 2: BILLING CART MEIN QTY INPUT ADD KARNA (Smart way)
// ---------------------------------------------------------
let edits = 0;
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  // Hum exact billing wali line dhoondh rahe hain jahan {q} akela ho
  if (lines[i].includes('{q}</span>') && lines[i].includes('fontSize: 13')) {
    lines[i] = lines[i].replace(/\{q\}<\/span>/, `<input type="number" value={q} onChange={(e) => setQty(id, parseInt(e.target.value) || 0)} style={{ flex: 1, width: "100%", minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink, border: "none", background: "transparent", outline: "none", fontFamily: "monospace" }} />`);
    edits++;
    break;
  }
}

if (edits > 0) {
  code = lines.join('\n');
  console.log("✅ Fix 2: Billing Cart mein Qty editable input ban gaya.");
} else {
  console.log("⚠️ Fix 2: Billing Qty ka code nahi mila (Shayad pehle se input hai).");
}

// Save file
fs.writeFileSync(filePath, code, "utf8");
console.log("\n🎉 Saare fixes apply ho gaye! Ab push karein:");