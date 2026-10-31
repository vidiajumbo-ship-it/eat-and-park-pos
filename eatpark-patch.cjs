// node eatpark-patch.cjs   (optional: node eatpark-patch.cjs path/to/src)
const fs = require("fs"), path = require("path");
const MARK = "EP-PATCH-v1", SRC = process.argv[2] || "src";
const ok = [], warn = [];

function walk(d, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d)) {
    if (f === "node_modules") continue;
    const p = path.join(d, f), st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out); else if (/\.(jsx?|tsx?)$/.test(f)) out.push(p);
  }
  return out;
}
function rep(s, from, to, label, all) {
  if (!s.includes(from)) { warn.push(label); return s; }
  ok.push(label);
  return all ? s.split(from).join(to) : s.replace(from, () => to);
}
const CSP = '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; object-src \'none\'">';
function csp(s, label) {
  const src = /(<!doctype html>\s*<html><head>)(?!<meta http-equiv="Content-Security-Policy")/;
  if (!src.test(s)) { warn.push(label + " CSP"); return s; }
  ok.push(label + " CSP");
  return s.replace(new RegExp(src.source, "g"), (m, a) => a + CSP);
}

// ---------- code blocks ----------
const AUTH_MSG = `function authMsg(e) {
  const c = (e && e.code) || "";
  const m = {
    "auth/operation-not-allowed": "Login system band hai (Firebase > Authentication > Anonymous ON karo)",
    "auth/admin-restricted-operation": "Login system band hai (Firebase > Authentication > Anonymous ON karo)",
    "auth/network-request-failed": "Internet/network dikkat. Dobara try karo",
    "auth/web-storage-unsupported": "Is browser me storage band hai. Chrome/Safari me link kholo",
    "auth/unauthorized-domain": "Ye website Firebase Authorized domains me nahi hai",
    "auth/too-many-requests": "Bahut try ho gaye, thodi der baad try karo",
    "permission-denied": "Order allow nahi hua (Firestore rules) - staff ko batao"
  };
  return "Order fail: " + (m[c] || c || (e && e.message) || "unknown");
}
let _anonInFlight = null;`;

const OTP_SEND = `const otpConfRef = useRef(null);
  const otpRecRef = useRef(null);
  useEffect(() => {
    if (DEMO_OTP) return;
    const u = auth.currentUser;
    const p = String(custPhone || "").replace(/\\D/g, "").slice(-10);
    setIsLoggedIn(!!(u && u.phoneNumber && u.phoneNumber === "+91" + p));
  }, [custPhone]);
  const handleSendOtp = async () => {
    const p = String(custPhone || "").replace(/\\D/g, "").slice(-10);
    if (p.length !== 10) { showToast("⚠️ 10 digit phone daalo", 'error'); return; }
    if (DEMO_OTP) { handleSendOtpDemo(); return; }
    try {
      const u = await ensureUser();
      if (u.phoneNumber) { setIsLoggedIn(true); showToast("✅ Phone pehle se verified hai", 'success'); return; }
      if (!u.isAnonymous) { showToast("ℹ️ Staff login chal raha hai - pehle logout karo", 'info'); return; }
      try { otpRecRef.current && otpRecRef.current.clear(); } catch (x) {}
      otpRecRef.current = new RecaptchaVerifier(auth, "otp-recaptcha", { size: "invisible" });
      otpConfRef.current = await linkWithPhoneNumber(u, "+91" + p, otpRecRef.current);
      setCustPhone(p); setOtpCode(""); setOtpStep("verify");
      showToast("📩 OTP SMS bheja gaya", 'success');
    } catch (e) {
      console.error("OTP send:", e);
      try { otpRecRef.current && otpRecRef.current.clear(); } catch (x) {}
      const m = {
        "auth/operation-not-allowed": "Firebase me Phone sign-in ON karo",
        "auth/invalid-phone-number": "Phone number galat hai",
        "auth/too-many-requests": "Bahut try ho gaye, thodi der baad",
        "auth/quota-exceeded": "SMS limit khatam (Firebase quota/billing)",
        "auth/captcha-check-failed": "Captcha fail - domain Authorized domains me add karo",
        "auth/billing-not-enabled": "Real SMS ke liye Firebase billing (Blaze) chahiye"
      };
      showToast("❌ " + (m[e.code] || e.code || e.message), 'error');
    }
  };
  const handleSendOtpDemo = () => {`;

const OTP_VERIFY = `const handleVerifyOtp = async () => {
    if (DEMO_OTP && !otpConfRef.current) { handleVerifyOtpDemo(); return; }
    if (!otpConfRef.current) { showToast("⚠️ Pehle OTP bhejo", 'error'); return; }
    const p = String(custPhone || "").replace(/\\D/g, "").slice(-10);
    try {
      await otpConfRef.current.confirm(String(otpCode).trim());
    } catch (e) {
      if (e.code === "auth/credential-already-in-use" || e.code === "auth/account-exists-with-different-credential") {
        try {
          const cred = PhoneAuthProvider.credentialFromError(e);
          if (!cred) throw e;
          await signInWithCredential(auth, cred);
        } catch (e2) { showToast("❌ OTP verify fail: " + (e2.code || e2.message), 'error'); return; }
      } else {
        showToast(e.code === "auth/invalid-verification-code" ? "❌ OTP galat hai" : "❌ OTP fail: " + (e.code || e.message), 'error');
        return;
      }
    }
    try { await auth.currentUser.getIdToken(true); } catch (e) {}
    otpConfRef.current = null;
    setIsLoggedIn(true); setOtpStep("phone");
    showToast("✅ Phone verify ho gaya", 'success');
    try { await setDoc(doc(db, "customers", p), { phone: p, name: custName || "Guest", address: custAddress || "", uid: auth.currentUser.uid, lastLogin: Date.now() }, { merge: true }); } catch (e) {}
  };
  const handleVerifyOtpDemo = () => {`;

const COIN_CHECK = `if (used > curCoins) throw new Error("Customer ke paas itne coins nahi - reward claim galat hai");
          const newCoins = Math.max(0, curCoins + earned - used);`;

const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function signedIn() { return request.auth != null; }
    function hasStaffDoc() {
      return signedIn() && exists(/databases/$(db)/documents/staff/$(request.auth.uid));
    }
    function staffRole() {
      return get(/databases/$(db)/documents/staff/$(request.auth.uid)).data.role;
    }
    function isStaff() { return hasStaffDoc() && staffRole() in ['admin', 'owner', 'manager', 'staff', 'waiter']; }
    function isAdmin() { return hasStaffDoc() && staffRole() in ['admin', 'owner', 'manager']; }
    function ownsOrder(orderId) {
      return signedIn()
        && exists(/databases/$(db)/documents/orders/$(orderId))
        && get(/databases/$(db)/documents/orders/$(orderId)).data.createdBy == request.auth.uid;
    }
    function validCustomerOrder() {
      let d = request.resource.data;
      return d.status == 'new'
        && d.paid == false
        && d.orderType in ['dine_in', 'parcel']
        && d.table is int && d.table >= 0 && d.table <= 20
        && d.items is list && d.items.size() > 0 && d.items.size() <= 40
        && d.finalTotal is number && d.finalTotal >= 0 && d.finalTotal <= 100000
        && (!('discount' in d) || (d.discount is number && d.discount >= 0 && d.discount <= 50))
        && (!('paymentStatus' in d) || d.paymentStatus in ['pending', 'paid_unverified'])
        && d.keys().size() <= 60;
    }

    match /staff/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow write: if false;
    }

    match /settings/{docId} {
      allow read: if (docId != 'privatePins' && docId != 'presets')
                  || (docId == 'presets' && isStaff())
                  || isAdmin();
      allow write: if isAdmin()
                  || (isStaff() && docId in ['menu', 'availability', 'favourites', 'expenseCats']);
    }

    match /orders/{id} {
      allow create: if signedIn()
        && id.matches('^o[a-z0-9]{6,40}$')
        && request.resource.data.createdBy == request.auth.uid
        && (isStaff() || validCustomerOrder());
      allow read: if isStaff() || (signedIn() && resource.data.createdBy == request.auth.uid);
      allow update: if isStaff()
        || (signedIn() && resource.data.createdBy == request.auth.uid
            && resource.data.status == 'new' && resource.data.paid == false
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'cancelledAt'])
            && request.resource.data.status == 'cancelled');
      allow delete: if isAdmin();
    }

    match /customers/{phone} {
      allow read: if isStaff();
      allow create: if signedIn() && request.resource.data.uid == request.auth.uid;
      allow update: if isStaff() || (signedIn() && resource.data.uid == request.auth.uid);
    }

    match /loyaltyUsers/{phone} {
      allow get: if isStaff() || (signedIn() && request.auth.token.phone_number == '+91' + phone);
      allow list, write: if isStaff();
    }

    match /coinHistory/{id} {
      allow read: if isStaff();
      allow create: if isStaff();
      allow update, delete: if false;
    }

    match /calls/{id} {
      allow create: if signedIn()
        && request.resource.data.status == 'active'
        && request.resource.data.table is int
        && request.resource.data.table >= 1 && request.resource.data.table <= 20
        && request.resource.data.keys().size() <= 6;
      allow read, update: if isStaff();
      allow delete: if isAdmin();
    }

    match /bookings/{id} {
      allow create: if signedIn()
        && request.resource.data.status == 'pending'
        && request.resource.data.keys().size() <= 12
        && request.resource.data.name is string && request.resource.data.name.size() <= 80;
      allow read, update, delete: if isStaff();
    }

    match /chats/{orderId}/messages/{msgId} {
      allow read: if isStaff() || ownsOrder(orderId);
      allow create: if (isStaff() || ownsOrder(orderId) || (signedIn() && orderId.matches('^general_.{1,15}$')))
        && request.resource.data.text is string && request.resource.data.text.size() <= 500;
      allow update, delete: if false;
    }

    match /inventory/{id} {
      allow read: if isStaff();
      allow write: if isAdmin() || (isStaff() && id != 'items');
    }

    match /expenses/{id} {
      allow read: if isStaff();
      allow create: if isStaff();
      allow update, delete: if isAdmin();
    }
    match /vendors/{id} {
      allow read: if isStaff();
      allow write: if isAdmin();
    }
    match /vendorPayments/{id} { allow read, write: if isAdmin(); }
    match /dayClose/{id}       { allow read, write: if isAdmin(); }
    match /feedback/{id} {
      allow create: if isStaff();
      allow read: if isAdmin();
    }

    match /auditLogs/{id} {
      allow read: if isAdmin();
      allow create: if isStaff();
      allow update, delete: if false;
    }
  }
}
`;

// ---------- locate files ----------
const files = walk(SRC);
const customerFile = files.find(f => fs.readFileSync(f, "utf8").includes("function CustomerView("));
const staffFile = files.find(f => fs.readFileSync(f, "utf8").includes("function StaffAppInner("));
console.log("Customer file:", customerFile || "NOT FOUND");
console.log("Staff file   :", staffFile || "NOT FOUND");

function patchFile(file, fn) {
  if (!file) return;
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(MARK)) { console.log("Already patched:", file); return; }
  fs.writeFileSync(file + ".bak", s);
  s = fn(s);
  fs.writeFileSync(file, s + "\n// " + MARK + "\n");
}

// ---------- customer (App.jsx) ----------
patchFile(customerFile, (s) => {
  const L = "App";
  s = rep(s, 'import { signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously } from "firebase/auth";',
    'import { signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously, RecaptchaVerifier, linkWithPhoneNumber, PhoneAuthProvider, signInWithCredential } from "firebase/auth";', L + " import");
  s = rep(s, "let _anonInFlight = null;", AUTH_MSG, L + " authMsg");
  s = rep(s, "setTimeout(r, 4000)", "setTimeout(r, 8000)", L + " auth wait 8s");
  s = rep(s, 'Order fail: " + (e.code || e.message || "unknown"), \'error\')', '" + authMsg(e), \'error\')', L + " order error text");
  s = rep(s, "const handleSendOtp = () => {", OTP_SEND, L + " OTP send");
  s = rep(s, "const handleVerifyOtp = () => {", OTP_VERIFY, L + " OTP verify");
  s = rep(s, "Quick OTP</div>", 'Quick OTP</div>\n                  <div id="otp-recaptcha"></div>', L + " recaptcha div");
  s = rep(s, "const newCoins = Math.max(0, curCoins + earned - used);", COIN_CHECK, L + " coin check");
  s = csp(s, L + " print");
  return s;
});

// ---------- staff (Staff.jsx) ----------
patchFile(staffFile, (s) => {
  const L = "Staff";
  s = rep(s, 'const PAID_STATUSES = ["paid", "paid_unverified"];', 'const PAID_STATUSES = ["paid"];', L + " paid_unverified != paid");
  s = rep(s, '"TABLE " + order.table}', '"TABLE " + esc(order.table)}', L + " KOT table esc", true);
  s = rep(s, '"T-" + order.table}', '"T-" + esc(order.table)}', L + " bill table esc", true);
  s = rep(s, '<div class="c">#${order.id.slice(1,9).toUpperCase()}</div>', '<div class="c">#${esc(order.id.slice(1,9).toUpperCase())}</div>', L + " KOT id esc");
  s = rep(s, "const billNo = order.id.slice(1,9).toUpperCase();", "const billNo = esc(order.id.slice(1,9).toUpperCase());", L + " billNo esc", true);
  s = csp(s, L + " print");
  return s;
});

// ---------- rules ----------
const rulesPath = fs.existsSync("firestore.rules") ? "firestore.rules" : "firestore.rules";
if (fs.existsSync(rulesPath)) fs.copyFileSync(rulesPath, rulesPath + ".bak");
fs.writeFileSync(rulesPath, RULES);
ok.push("firestore.rules rewritten");

// ---------- report ----------
console.log("\nOK  :", ok.length); ok.forEach(x => console.log("  +", x));
console.log("SKIP:", warn.length); warn.forEach(x => console.log("  ! anchor nahi mila:", x));

console.log("\n--- 'session' wali strings (login session fail yahin se aa raha hoga) ---");
for (const f of walk(SRC)) {
  fs.readFileSync(f, "utf8").split("\n").forEach((ln, i) => {
    if (/session/i.test(ln) && /fail|error|alert|toast/i.test(ln)) console.log(f + ":" + (i + 1) + ": " + ln.trim().slice(0, 140));
  });
}
console.log("\nAb chalao:\n  npx firebase-tools deploy --only firestore:rules\n  (backup: *.bak files, rollback ke liye copy back kar do)");