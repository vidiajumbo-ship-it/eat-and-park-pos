// patch-fix3-fixed.cjs  —  run: node patch-fix3-fixed.cjs
const fs = require("fs");
const APP = "src/App.jsx", STAFF = "src/StaffApp.jsx";
const files = {};
for (const f of [APP, STAFF]) {
  if (!fs.existsSync(f)) { console.error("❌ " + f + " nahi mili. Project root se chalao."); process.exit(1); }
  files[f] = fs.readFileSync(f, "utf8");
}

// idempotency: agar already laga hai to skip
if (files[APP].includes("openUpiApp") && files[STAFF].includes("First Login")) {
  console.log("⏭️  Patch pehle se laga hai. Kuch nahi kiya."); process.exit(0);
}

const S = (file, find, replace, count = 1) => ({ file, find, replace, count });
const R = (file, re, replace, count = 1) => ({ file, re, replace, count });

const UPI_BTN = String.raw`<button onClick={() => setPaymentMethod('upi')} style={{ padding: '10px', borderRadius: 10, border: '2px solid ' + (paymentMethod === 'upi' ? COLORS.copper : COLORS.line), background: paymentMethod === 'upi' ? COLORS.copperLight : 'transparent', fontWeight: 700, cursor: 'pointer' }}>📱 UPI (PhonePe / GPay)</button>`;

const UPI_PANEL = String.raw`{paymentMethod === 'upi' && (
                  <div style={{ background: COLORS.copperLight, border: '1.5px solid ' + COLORS.copper, borderRadius: 12, padding: 12, marginBottom: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.copperDark }}>📱 Order place hote hi PhonePe / GPay {inr(finalTotal)} ke saath khul jayega</div>
                    <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>UPI ID: {RESTAURANT.upiId}</div>
                  </div>
                )}
                `;

const TRACK_PAY = String.raw`{o.payment === 'upi' && !o.paid && (<button onClick={() => openUpiApp(getOrderTotal(o), o.id)} style={{ padding: "13px 20px", background: "#5F259F", color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>{"📱 UPI se pay karo " + inr(getOrderTotal(o))}</button>)}
                  `;

// HELPER: desktop pe QR fallback, mobile pe UPI deep link
const HELPER = String.raw`// 📱 UPI app (PhonePe / GPay / Paytm) amount ke saath kholo
const openUpiApp = (amount, ref) => {
  const am = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
  const note = "Order " + String(ref || "").replace(/^O/i, "").slice(0, 6).toUpperCase();
  const url = "upi://pay?pa=" + encodeURIComponent(RESTAURANT.upiId) + "&pn=" + encodeURIComponent(RESTAURANT.name || "Restaurant") + "&am=" + am + "&cu=INR&tn=" + encodeURIComponent(note);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  if (!isMobile) {
    // Desktop: koi UPI app nahi hota — QR + copy dikhao
    const qr = "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=" + encodeURIComponent(url);
    const w = window.open("", "_blank");
    if (w) {
      w.document.write('<title>UPI Payment</title><body style="font-family:system-ui;text-align:center;padding:24px;background:#fff"><h3 style="color:#5F259F">Scan karke pay karo — ₹' + am + '</h3><img src="' + qr + '" style="width:260px;height:260px"/><p style="font-size:12px;color:#666">UPI ID: ' + RESTAURANT.upiId + '</p></body>');
      w.document.close();
    } else {
      alert("Mobile pe kholo ya QR scan karo:\nUPI ID: " + RESTAURANT.upiId + "\nAmount: ₹" + am);
    }
    return;
  }
  window.location.href = url;
};

function CustomerView(`;

const LOGIN_SAVE = String.raw`try {
      const cref = doc(db, "customers", p);
      const cs = await getDoc(cref);
      const old = cs.exists() ? cs.data() : null;
      const patch = { phone: p, lastLogin: Date.now(), loginCount: (Number(old && old.loginCount) || 0) + 1 };
      if (auth && auth.currentUser) patch.uid = auth.currentUser.uid;
      // createdAt SIRF naye customer pe — purane ka galat time na bharo
      if (!old) patch.createdAt = Date.now();
      const nm = String(custName || "").trim();
      if (!old || !old.name || old.name === "Guest") patch.name = nm || "Guest";
      const ad = String(custAddress || "").trim();
      if (ad && (!old || !old.address)) patch.address = ad;
      await setDoc(cref, patch, { merge: true });
    } catch (e) { console.error("customer login save:", e); }`;

const ORDER_STATS = String.raw`try { const _cp = String(custPhone || "").replace(/\D/g, "").slice(-10); if (_cp.length === 10) await setDoc(doc(db, "customers", _cp), { totalOrders: increment(1), totalSpent: increment(Math.round(finalTotal) || 0), lastOrderDate: Date.now() }, { merge: true }); } catch (e) { console.error("customer stats:", e); }`;

const edits = [
  // ---------- App.jsx ----------
  S(APP, String.raw`arrayUnion, arrayRemove,`, String.raw`arrayUnion, arrayRemove, increment,`),
  S(APP, String.raw`upiId: "heckeyhr@ybl"`, String.raw`upiId: "7303267750-5@ybl"`),
  S(APP, String.raw`function CustomerView(`, HELPER),

  // Razorpay buttons hatao — sirf ye 3 known labels (phonepe/gpay ko chhedo mat)
  R(APP, /^[ \t]*<button onClick=\{\(\) => setPaymentMethod\('razorpay'\)\}[^\n]*<\/button>[ \t\r]*\n/gm, "", 1),

  // Cash button ke baad UPI button
  R(APP, /^([ \t]*)(<button onClick=\{\(\) => setPaymentMethod\('cash'\)\}[^\n]*<\/button>)/m, (m, ind, btn) => ind + btn + "\n" + ind + UPI_BTN, 1),

  S(APP, String.raw`<button onClick={handlePlaceOrder} disabled={isProcessingPayment}`, UPI_PANEL + String.raw`<button onClick={handlePlaceOrder} disabled={isProcessingPayment}`),
  S(APP, String.raw`<button onClick={() => setRunningOrderId(o.id)}`, TRACK_PAY + String.raw`<button onClick={() => setRunningOrderId(o.id)}`),

  // order save ke BAAD UPI kholo (setTimeout nahi)
  S(APP, String.raw`consumeFlashStock(initialItems);`, String.raw`if (paymentMethod === "upi") { try { await new Promise(r => setTimeout(r, 300)); } catch (_) {} openUpiApp(finalTotal, orderId); }
      consumeFlashStock(initialItems);`),

  // login save (fixed createdAt)
  S(APP, String.raw`try { await setDoc(doc(db, "customers", p), { phone: p, name: custName || "Guest", address: custAddress || "", uid: auth.currentUser.uid, lastLogin: Date.now() }, { merge: true }); } catch (e) {}`, LOGIN_SAVE),

  S(APP, String.raw`try { await updateDoc(doc(db, "customers", custPhone), { totalOrders: customerData.totalOrders, totalSpent: customerData.totalSpent, lastOrderDate: Date.now() }); } catch (e) { }`, ORDER_STATS, 2),

  S(APP, String.raw`["razorpay", "Razor"], `, ""),

  // ---------- StaffApp.jsx ----------
  S(STAFF, String.raw`upi: "heckeyhr@ybl"`, String.raw`upi: "7303267750-5@ybl"`),
  S(STAFF, String.raw`const header = ["Name", "Phone", "DOB", "Address", "Orders", "Spent", "Last Login"];`, String.raw`const header = ["Name", "Phone", "DOB", "Address", "Orders", "Spent", "Last Login", "First Login", "Login Count"];`),
  S(STAFF, String.raw`c.lastLogin ? new Date(Number(c.lastLogin)).toLocaleString("en-IN") : "",`, String.raw`c.lastLogin ? new Date(Number(c.lastLogin)).toLocaleString("en-IN") : "",
    c.createdAt ? new Date(Number(c.createdAt)).toLocaleString("en-IN") : "", Number(c.loginCount) || 0,`),
  S(STAFF, String.raw`{c.lastLogin ? " · login " + new Date(Number(c.lastLogin)).toLocaleDateString("en-IN") : ""}`, String.raw`{c.lastLogin ? " · aakhri login " + new Date(Number(c.lastLogin)).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}{Number(c.loginCount) > 0 ? " · " + c.loginCount + " baar login" : ""}{c.createdAt ? " · pehli baar " + new Date(Number(c.createdAt)).toLocaleDateString("en-IN") : ""}`),
];

const countOf = (t, e) => e.re
  ? [...t.matchAll(new RegExp(e.re.source, e.re.flags.includes("g") ? e.re.flags : e.re.flags + "g"))].length
  : t.split(e.find).length - 1;

let bad = false;
edits.forEach((e, i) => {
  const t = files[e.file];
  const n = countOf(t, e);
  if (n !== e.count) {
    console.error("❌ " + e.file + " edit #" + (i + 1) + ": " + n + " baar mila (" + e.count + " chahiye). Kuch change nahi kiya.\n   " + String(e.re || e.find).slice(0, 90));
    bad = true; return;
  }
  files[e.file] = e.re ? t.replace(e.re, e.replace) : t.split(e.find).join(e.replace);
});
if (bad) { console.error("⛔ Patch abort — koi file write nahi hui."); process.exit(1); }

for (const f of [APP, STAFF]) {
  fs.copyFileSync(f, f + ".bak-before-fix3");
  fs.writeFileSync(f, files[f], "utf8");
  console.log("✅ " + f + " patched (backup: " + f + ".bak-before-fix3)");
}
console.log("🎉 Done.");