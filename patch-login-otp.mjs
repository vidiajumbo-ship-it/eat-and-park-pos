import fs from "fs";

const [custPath, staffPath] = process.argv.slice(2);
if (!custPath || !staffPath) {
  console.log("Use: node patch-login-otp.mjs <customer-file> <staff-file>");
  process.exit(1);
}

const load = (p) => {
  const raw = fs.readFileSync(p, "utf8");
  return { p, raw, crlf: raw.includes("\r\n"), src: raw.replace(/\r\n/g, "\n"), ok: true };
};
const log = (ok, m) => console.log((ok ? "OK   " : "FAIL ") + m);
const find = (s, t, from = 0) => {
  const i = s.indexOf(t, from);
  if (i < 0) throw new Error("nahi mila: " + t.slice(0, 60));
  return i;
};
function step(name, file, fn) {
  try {
    const out = fn(file.src);
    if (out === file.src) return log(true, name + " (pehle se laga hai, skip)");
    file.src = out;
    log(true, name);
  } catch (e) {
    file.ok = false;
    log(false, name + " -> " + e.message);
  }
}

// ======================= STAFF FILE =======================
const LOGIN_SCREEN = String.raw`function LoginScreen({ C, isMobile, email, setEmail, password, setPassword, error, onSubmit }) {
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!email) { try { const m = localStorage.getItem("staff_last_email"); if (m) setEmail(m); } catch (e) {} }
  }, []);
  const submit = async (e) => { setBusy(true); try { await onSubmit(e); } finally { setBusy(false); } };
  const field = { width: "100%", boxSizing: "border-box", padding: "14px 16px", border: "1px solid " + C.line, borderRadius: 12, fontSize: 15, background: C.bg, color: C.ink, outline: "none" };
  const lbl = { fontSize: 11, fontWeight: 800, color: C.gray, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 0%, " + C.goldLight + " 0%, " + C.bg + " 55%)", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <div style={{ background: C.card, borderRadius: 24, padding: isMobile ? 24 : 36, width: "100%", maxWidth: 400, boxShadow: "0 24px 70px rgba(0,0,0,0.55)", border: "1px solid " + C.line, animation: "scaleIn .25s ease-out" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 72, height: 72, margin: "0 auto 14px", background: "linear-gradient(135deg, " + C.gold + ", " + C.goldDark + ")", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, boxShadow: "0 12px 30px " + C.gold + "55" }}>🍽️</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.ink, letterSpacing: "-0.02em" }}>Eat & Park</div>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 4, textTransform: "uppercase", letterSpacing: 2 }}>Staff Login</div>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Email</label>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@enp.com" style={field} required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>PIN / Password</label>
            <div style={{ position: "relative" }}>
              <input type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" style={{ ...field, paddingRight: 64, fontSize: 20, letterSpacing: show ? 2 : 6 }} required />
              <button type="button" onClick={() => setShow((v) => !v)} style={{ position: "absolute", right: 8, top: 8, height: 34, padding: "0 10px", border: "none", borderRadius: 8, background: C.cardAlt, color: C.gray, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{show ? "Hide" : "Show"}</button>
            </div>
          </div>
          {error && (
            <div role="alert" style={{ background: C.redLight, border: "1px solid " + C.red + "55", color: C.red, padding: "12px 14px", borderRadius: 12, fontSize: 13, fontWeight: 700, marginBottom: 18, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span>⚠️</span><span style={{ flex: 1 }}>{error}</span>
            </div>
          )}
          <button type="submit" disabled={busy} style={{ width: "100%", padding: 16, border: "none", borderRadius: 14, background: "linear-gradient(135deg, " + C.gold + ", " + C.goldDark + ")", color: "#fff", fontWeight: 900, fontSize: 16, cursor: busy ? "wait" : "pointer", boxShadow: "0 10px 24px " + C.gold + "44", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {busy ? <><Spinner /> Login ho raha hai...</> : "Start Shift →"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/" style={{ color: C.gray, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>← Customer App par jao</a>
        </div>
      </div>
    </div>
  );
}

`;

const AUTH_EFFECT = String.raw`// Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && !u.isAnonymous) {
        try {
          const s = await getDoc(doc(db, "staff", u.uid));
          if (s.exists() && s.data().active !== false) {
            setUser(u); setStaffData(s.data()); setWaiterName(s.data().name || "Staff");
          } else {
            await signOut(auth).catch(() => {});
            setLoginError(s.exists() ? "Ye account band hai" : "Staff record nahi mila. Owner se kaho aapka staff entry banaye");
          }
        } catch (e) {
          console.error("Auth check error:", e);
          await signOut(auth).catch(() => {});
          setLoginError("Staff record padh nahi paye (permissions). Owner se Firestore rules / staff entry check karwao");
        }
      } else { setUser(null); setStaffData(null); }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  `;

const HANDLE_LOGIN = String.raw`const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      try { localStorage.setItem("staff_last_email", email.trim()); } catch (x) {}
      toast("Welcome back!", "success");
    } catch (err) {
      setLoginError(
        ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(err.code) ? "Email ya PIN galat hai"
        : err.code === "auth/too-many-requests" ? "Bahut try ho gaye, thodi der baad try karo"
        : err.code === "auth/network-request-failed" ? "Internet check karo"
        : err.message
      );
    }
  };

  `;

const LOGIN_GATE = String.raw`if (!user) {
    return <LoginScreen C={C} isMobile={isMobile} email={email} setEmail={setEmail} password={password} setPassword={setPassword} error={loginError} onSubmit={handleLogin} />;
  }

  `;

const staff = load(staffPath);

step("Staff S1: LoginScreen component", staff, (s) => {
  if (s.includes("function LoginScreen(")) return s;
  const i = find(s, "function StaffAppInner() {");
  return s.slice(0, i) + LOGIN_SCREEN + s.slice(i);
});

step("Staff S2: auth effect (owner auto-create hata diya)", staff, (s) => {
  if (s.includes("Staff record padh nahi paye")) return s;
  const a = find(s, "// Auth\n  useEffect(");
  const b = find(s, "// Data\n", a);
  return s.slice(0, a) + AUTH_EFFECT + s.slice(b);
});

step("Staff S3: handleLogin", staff, (s) => {
  const a = find(s, "const handleLogin = async (e) => {");
  const b = find(s, "const handleLogout = async () => {", a);
  if (s.slice(a, b).includes("staff_last_email")) return s;
  return s.slice(0, a) + HANDLE_LOGIN + s.slice(b);
});

step("Staff S4: login screen gate", staff, (s) => {
  if (s.includes("<LoginScreen C={C}")) return s;
  const a = find(s, "if (!user) {\n    return (");
  const b = find(s, "const activeOrders = orders.filter(isActiveOrder);", a);
  return s.slice(0, a) + LOGIN_GATE + s.slice(b);
});

// ======================= CUSTOMER FILE =======================
const OTP_STATE = String.raw`
  const [otpSending, setOtpSending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);`;

const SEND_OTP = String.raw`const handleSendOtp = async () => {
    if (otpSending || resendIn > 0) return;
    const p = String(custPhone || "").replace(/\D/g, "").slice(-10);
    if (p.length !== 10) { showToast("⚠️ 10 digit phone daalo", 'error'); return; }
    if (DEMO_OTP) { handleSendOtpDemo(); return; }
    setOtpSending(true);
    try {
      const u = auth.currentUser || await ensureUser();
      if (u.phoneNumber) { setIsLoggedIn(true); showToast("✅ Phone pehle se verified hai", 'success'); return; }
      if (!u.isAnonymous) { showToast("ℹ️ Staff login chal raha hai - pehle logout karo", 'info'); return; }
      if (!otpRecRef.current) {
        otpRecRef.current = new RecaptchaVerifier(auth, "otp-recaptcha", { size: "invisible" });
      }
      otpConfRef.current = await linkWithPhoneNumber(u, "+91" + p, otpRecRef.current);
      setCustPhone(p); setOtpCode(""); setOtpStep("verify"); setResendIn(30);
      showToast("📩 OTP SMS bheja gaya", 'success');
    } catch (e) {
      console.error("OTP send:", e.code, e.message);
      try { otpRecRef.current && otpRecRef.current.clear(); } catch (x) {}
      otpRecRef.current = null;
      const _b = document.getElementById("otp-recaptcha");
      if (_b) _b.innerHTML = "";
      const m = {
        "auth/operation-not-allowed": "Phone SMS blocked: Firebase me SMS region policy me India allow karo",
        "auth/invalid-phone-number": "Phone number galat hai",
        "auth/too-many-requests": "Bahut try ho gaye, thodi der baad try karo",
        "auth/quota-exceeded": "SMS limit khatam (Firebase quota/billing)",
        "auth/captcha-check-failed": "Captcha fail - domain Authorized domains me add karo",
        "auth/billing-not-enabled": "Real SMS ke liye Firebase billing (Blaze) chahiye"
      };
      showToast("❌ " + (m[e.code] || e.code || e.message), 'error');
    } finally {
      setOtpSending(false);
    }
  };
  `;

const BHEJO_BTN = String.raw`<button disabled={otpSending || resendIn > 0} onClick={() => { if (!custName.trim()) { showToast("⚠️ Pehle naam daalo", "error"); return; } handleSendOtp(); }}
                  style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 14, padding: 16, fontWeight: 800, fontSize: 16, cursor: "pointer", opacity: (otpSending || resendIn > 0) ? 0.6 : 1 }}>
                  {otpSending ? "⏳ Bhej raha hai..." : resendIn > 0 ? "Dobara bhejo (" + resendIn + "s)" : "📩 OTP Bhejo"}
                </button>`;

const RESEND_BTN = String.raw`<button disabled={otpSending || resendIn > 0} onClick={handleSendOtp} style={{ background: "none", border: "none", color: COLORS.copper, fontWeight: 800, cursor: "pointer", opacity: resendIn > 0 ? 0.5 : 1 }}>
                  {resendIn > 0 ? "Resend OTP (" + resendIn + "s)" : "🔁 Resend OTP"}
                </button>
                `;

const SEND_BTN_NEW = String.raw`<button onClick={handleSendOtp} disabled={otpSending || resendIn > 0} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer", opacity: (otpSending || resendIn > 0) ? 0.6 : 1 }}>{otpSending ? "⏳" : resendIn > 0 ? resendIn + "s" : "Send"}</button>`;

const cust = load(custPath);

step("Cust C1: purana dark login overlay delete", cust, (s) => {
  const m = s.indexOf('zIndex: 150, background: "#0B111A"');
  if (m < 0) return s;
  const start = s.lastIndexOf("{!isLoggedIn && !waiterUnlocked && (", m);
  if (start < 0) throw new Error("overlay ki shuruaat nahi mili");
  const end = find(s, "{toast && <Toast message={toast} type={toastType} />}", m);
  return s.slice(0, start) + s.slice(end);
});

step("Cust C2: otpSending / resendIn state", cust, (s) => {
  if (s.includes("const [otpSending")) return s;
  const t = "const [runningOrderId, setRunningOrderId] = useState(null);";
  const i = find(s, t) + t.length;
  return s.slice(0, i) + OTP_STATE + s.slice(i);
});

step("Cust C3: handleSendOtp", cust, (s) => {
  const a = find(s, "const handleSendOtp = async () => {");
  const b = find(s, "const handleSendOtpDemo = () => {", a);
  if (s.slice(a, b).includes("otpSending")) return s;
  return s.slice(0, a) + SEND_OTP + s.slice(b);
});

step("Cust C4: OTP Bhejo button", cust, (s) => {
  if (s.includes('otpSending ? "⏳ Bhej raha hai..."')) return s;
  const re = /<button onClick=\{\(\) => \{ if \(!custName\.trim\(\)\)[\s\S]*?📩 OTP Bhejo\s*<\/button>/;
  if (!re.test(s)) throw new Error("OTP Bhejo button nahi mila");
  return s.replace(re, () => BHEJO_BTN);
});

step("Cust C5: Resend OTP button", cust, (s) => {
  if (s.includes("Resend OTP")) return s;
  const t = '<button onClick={() => { setOtpStep("phone"); setOtpCode(""); }} style={{ background: "none"';
  const i = find(s, t);
  return s.slice(0, i) + RESEND_BTN + s.slice(i);
});

step("Cust C6: checkout Quick OTP Send button", cust, (s) => {
  if (s.includes('otpSending ? "⏳" :')) return s;
  const old = '<button onClick={handleSendOtp} style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer" }}>Send</button>';
  find(s, old);
  return s.replace(old, () => SEND_BTN_NEW);
});

// ======================= WRITE =======================
for (const f of [staff, cust]) {
  if (!f.ok) { console.log("\n>> " + f.p + ": koi step fail hua, file ME KUCH NAHI LIKHA.\n"); continue; }
  if (f.src.replace(/\n/g, f.crlf ? "\r\n" : "\n") === f.raw) { console.log("\n>> " + f.p + ": koi badlav nahi (sab pehle se laga hai)\n"); continue; }
  fs.writeFileSync(f.p + ".bak", f.raw);
  fs.writeFileSync(f.p, f.crlf ? f.src.replace(/\n/g, "\r\n") : f.src);
  console.log("\n>> " + f.p + ": patch lag gaya (backup: " + f.p + ".bak)\n");
}