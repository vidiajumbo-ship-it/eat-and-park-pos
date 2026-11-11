// final-fix-pos.cjs
const fs = require("fs");

function patchApp() {
  const F = "src/App.jsx";
  if (!fs.existsSync(F)) return false;
  let t = fs.readFileSync(F, "utf8");
  
  // 1. UPI ID
  t = t.replace('upiId: "heckeyhr@ybl"', 'upiId: "7303267750-5@ybl"');
  
  // 2. openUpiApp
  if (!t.includes("const openUpiApp =")) {
    const helper = `const openUpiApp = (amount, ref) => {
  const am = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
  const note = "Order " + String(ref || "").replace(/^O/i, "").slice(0, 6).toUpperCase();
  const url = "upi://pay?pa=" + encodeURIComponent(RESTAURANT.upiId) + "&pn=" + encodeURIComponent(RESTAURANT.name) + "&am=" + am + "&cu=INR&tn=" + encodeURIComponent(note);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  if (!isMobile) {
    const qr = "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=" + encodeURIComponent(url);
    const w = window.open("", "_blank");
    if (w) { w.document.write('<h3>Scan karke pay karo</h3><img src="' + qr + '"/>'); w.document.close(); }
    else alert("UPI ID: " + RESTAURANT.upiId + " Amount: Rs " + am);
    return;
  }
  window.location.href = url;
};

function CustomerView(`;
    t = t.replace("function CustomerView(", helper);
  }

  // 3. Razorpay button hatao
  t = t.replace(/<button onClick=\{\(\) => setPaymentMethod\('razorpay'\)\}[^<]*<\/button>\s*\n\s*/g, "");
  
  // 4. PhonePe/GPay ko UPI me badlo
  t = t.replace(
    /<button onClick=\{\(\) => setPaymentMethod\('phonepe'\)\}[^<]*<\/button>\s*\n\s*<button onClick=\{\(\) => setPaymentMethod\('gpay'\)\}[^<]*<\/button>/,
    "<button onClick={() => setPaymentMethod('upi')} style={{ padding: '10px', borderRadius: 10, border: '2px solid ' + (paymentMethod === 'upi' ? COLORS.copper : COLORS.line), background: paymentMethod === 'upi' ? COLORS.copperLight : 'transparent', fontWeight: 700, cursor: 'pointer' }}>📱 UPI (PhonePe / GPay)</button>"
  );

  // 5. Payment branch fix
  t = t.replace(
    /if \(paymentMethod === "razorpay"\) \{[\s\S]*?\} else if \(paymentMethod === "phonepe" \|\| paymentMethod === "gpay"\) \{[\s\S]*?\n      \}/,
    `if (paymentMethod === "upi") {
        showToast("📱 UPI app khul raha hai — payment ke baad order confirm karein", 'info');
      }`
  );

  // 6. UPI auto open
  t = t.replace("consumeFlashStock(initialItems);", "if (paymentMethod === \"upi\") setTimeout(() => openUpiApp(finalTotal, orderId), 700);\n      consumeFlashStock(initialItems);");

  // 7. Login count + createdAt
  const oldLogin = 'const _patch = { phone: p, address: custAddress || "", uid: auth.currentUser.uid, lastLogin: Date.now() };';
  if (t.includes(oldLogin)) {
    t = t.replace(oldLogin, `const _cref = doc(db, "customers", p);
      const _cs = await getDoc(_cref);
      const _old = _cs.exists() ? _cs.data() : null;
      const _patch = { phone: p, address: custAddress || "", uid: auth.currentUser.uid, lastLogin: Date.now(), loginCount: (Number(_old && _old.loginCount) || 0) + 1 };
      if (!_old) _patch.createdAt = Date.now();`);
  }

  fs.copyFileSync(F, F + ".bak-final");
  fs.writeFileSync(F, t, "utf8");
  console.log("✅ App.jsx patched");
  return true;
}

function patchStaff() {
  const F = "src/StaffApp.jsx";
  if (!fs.existsSync(F)) return false;
  let t = fs.readFileSync(F, "utf8");
  
  t = t.replace('upi: "heckeyhr@ybl",', 'upi: "7303267750-5@ybl",');

  if (!t.includes("const openUpiApp =")) {
    const upiUriLine = 'const upiUri = (total, billNo) => `upi://pay?pa=${RESTAURANT.upi}&pn=${encodeURIComponent(RESTAURANT.name)}&am=${total}&cu=INR&tn=${encodeURIComponent("Bill " + billNo)}`;';
    const helper = "\n\nconst openUpiApp = (total, billNo) => {\n  const url = upiUri(total, billNo);\n  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || \"\");\n  if (!isMobile) {\n    const qr = \"https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=\" + encodeURIComponent(url);\n    const w = window.open(\"\", \"_blank\");\n    if (w) { w.document.write('<h2>Scan & Pay Rs ' + total + '</h2><img src=\"' + qr + '\"/>'); w.document.close(); }\n    else alert(\"UPI ID: \" + RESTAURANT.upi);\n    return;\n  }\n  window.location.href = url;\n};";
    t = t.replace(upiUriLine, upiUriLine + helper);
  }

  const oldH = 'const header = ["Name", "Phone", "DOB", "Address", "Paid Orders", "Paid Spent", "Coins", "Last Login"];';
  t = t.replace(oldH, 'const header = ["Name", "Phone", "DOB", "Address", "Paid Orders", "Paid Spent", "Coins", "Last Login", "First Login", "Login Count"];');

  const oldRows = 'c.lastLogin ? new Date(Number(c.lastLogin)).toLocaleString("en-IN") : "",\n  ]);';
  t = t.replace(oldRows, 'c.lastLogin ? new Date(Number(c.lastLogin)).toLocaleString("en-IN") : "",\n    c.createdAt ? new Date(Number(c.createdAt)).toLocaleString("en-IN") : "",\n    Number(c.loginCount) || 0,\n  ]);');

  const oldCard = '{c.lastLogin && <span>· login {new Date(Number(c.lastLogin)).toLocaleDateString("en-IN")}</span>}';
  t = t.replace(oldCard, '{c.lastLogin && <span>· login {new Date(Number(c.lastLogin)).toLocaleDateString("en-IN")}</span>}\n                {c.createdAt && <span>· pehli baar {new Date(Number(c.createdAt)).toLocaleDateString("en-IN")}</span>}\n                {Number(c.loginCount) > 0 && <span>· {c.loginCount} baar login</span>}');

  fs.copyFileSync(F, F + ".bak-final");
  fs.writeFileSync(F, t, "utf8");
  console.log("✅ StaffApp.jsx patched");
  return true;
}

patchApp();
patchStaff();
console.log("🎉 Done!");