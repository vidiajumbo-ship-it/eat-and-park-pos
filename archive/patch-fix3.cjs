const fs = require("fs");
const APP = "src/App.jsx", STAFF = "src/StaffApp.jsx";
const files = {};
for (const f of [APP, STAFF]) {
  if (!fs.existsSync(f)) { console.error("❌ " + f + " nahi mili. Project root se chalao."); process.exit(1); }
  files[f] = fs.readFileSync(f, "utf8");
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

const HELPER = String.raw`// 📱 UPI app (PhonePe / GPay / Paytm) amount ke saath kholo
const openUpiApp = (amount, ref) => {
  const am = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
  const url = "upi://pay?pa=" + RESTAURANT.upiId + "&pn=" + encodeURIComponent(RESTAURANT.name) + "&am=" + am + "&cu=INR&tn=" + encodeURIComponent("Order " + String(ref || "").slice(1, 5).toUpperCase());
  window.location.href = url;
};

function CustomerView(`;

const LOGIN_SAVE = String.raw`try {
      const cref = doc(db, "customers", p);
      const cs = await getDoc(cref);
      const old = cs.exists() ? cs.data() : null;
      const patch = { phone: p, uid: auth.currentUser.uid, lastLogin: Date.now(), loginCount: (Number(old && old.loginCount) || 0) + 1 };
      if (!old || !old.createdAt) patch.createdAt = (old && Number(old.lastLogin)) || Date.now();
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
  R(APP, /^[ \t]*<button onClick=\{\(\) => setPaymentMethod\('(?:razorpay|phonepe|gpay)'\)\}[^\n]*<\/button>[ \t\r]*\n/gm, "", 3),
  R(APP, /^([ \t]*)(<button onClick=\{\(\) => setPaymentMethod\('cash'\)\}[^\n]*<\/button>)/m, (m, ind, btn) => ind + btn + "\n" + ind + UPI_BTN, 1),
  S(APP, String.raw`<button onClick={handlePlaceOrder} disabled={isProcessingPayment}`, UPI_PANEL + String.raw`<button onClick={handlePlaceOrder} disabled={isProcessingPayment}`),
  S(APP, String.raw`<button onClick={() => setRunningOrderId(o.id)}`, TRACK_PAY + String.raw`<button onClick={() => setRunningOrderId(o.id)}`),
  S(APP, String.raw`consumeFlashStock(initialItems);`, String.raw`if (paymentMethod === "upi") setTimeout(() => openUpiApp(finalTotal, orderId), 700);
      consumeFlashStock(initialItems);`),
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

if (files[APP].includes("openUpiApp")) { console.log("⏭️  Patch pehle se laga hai."); process.exit(0); }

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
  files[e.file] = e.re ? t.replace(e.re, typeof e.replace === "function" ? e.replace : () => e.replace) : t.split(e.find).join(e.replace);
});
if (bad) process.exit(1);

for (const f of [APP, STAFF]) {
  fs.copyFileSync(f, f + ".bak-before-fix3");
  fs.writeFileSync(f, files[f], "utf8");
  console.log("✅ " + f + " patched (backup: " + f + ".bak-before-fix3)");
}
