import fs from "fs";
const p = "src/App.jsx";
const raw = fs.readFileSync(p, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("ENP-DARK-LOGIN")) { console.log("Pehle se laga hai, skip"); process.exit(0); }

const m = s.indexOf("zIndex: 150, background: COLORS.paper");
if (m < 0) { console.log("FAIL: safed login overlay nahi mila"); process.exit(1); }
const start = s.lastIndexOf("{!isLoggedIn && !waiterUnlocked && (", m);
const end = s.indexOf("<button onClick={() => { requestWaiter(table);", m);
if (start < 0 || end < 0) { console.log("FAIL: block ki seema nahi mili"); process.exit(1); }

const F = 'width: "100%", boxSizing: "border-box", padding: "14px 16px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#fff", fontSize: 15, outline: "none"';
const L = 'display: "block", fontSize: 11, fontWeight: 800, color: "#8B9BB4", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5';
const R = 'flex: 1, padding: "10px 0", background: "transparent", border: "1px solid #273449", borderRadius: 12, color: "#8B9BB4", fontWeight: 700, fontSize: 12, cursor: "pointer"';

const NEW = String.raw`{/* ENP-DARK-LOGIN */}
      {!isLoggedIn && !waiterUnlocked && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150, background: "#0B111A", overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 400, background: "#161F2F", borderRadius: 24, padding: 32, border: "1px solid #273449", boxShadow: "0 24px 70px rgba(0,0,0,0.55)" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ width: 70, height: 70, background: "#FF5A1F", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, margin: "0 auto 14px", boxShadow: "0 12px 30px rgba(255,90,31,0.35)" }}>🍽️</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>Eat & Park Restaurant</div>
              <div style={{ fontSize: 13, color: "#8B9BB4", marginTop: 4 }}>Customer Login</div>
            </div>
            <div id="otp-recaptcha"></div>
            {otpStep === "phone" ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ ${L} }}>Your Name</label>
                  <input type="text" placeholder="Apna naam likho" value={custName} onChange={(e) => setCustName(e.target.value)} style={{ ${F} }} />
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={{ ${L} }}>Phone Number</label>
                  <input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit number" value={custPhone} onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} style={{ ${F}, fontSize: 20, letterSpacing: 2, fontWeight: 700, textAlign: "center" }} />
                </div>
                <button disabled={otpSending || resendIn > 0} onClick={() => { if (!custName.trim()) { showToast("⚠️ Pehle naam daalo", "error"); return; } handleSendOtp(); }}
                  style={{ width: "100%", padding: 16, background: "#FF5A1F", border: "none", borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 20px rgba(255,90,31,0.3)", opacity: (otpSending || resendIn > 0) ? 0.6 : 1 }}>
                  {otpSending ? "⏳ Bhej raha hai..." : resendIn > 0 ? "Dobara bhejo (" + resendIn + "s)" : "Send OTP"}
                </button>
              </div>
            ) : (
              <div>
                <label style={{ ${L}, textAlign: "center" }}>OTP {custPhone} par bheja gaya</label>
                <input type="text" inputMode="numeric" maxLength={6} placeholder="••••••" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))} style={{ ${F}, fontSize: 28, letterSpacing: 10, fontWeight: 800, textAlign: "center", marginBottom: 20 }} />
                <button onClick={handleVerifyOtp} style={{ width: "100%", padding: 16, background: "#10B981", border: "none", borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", marginBottom: 10, boxShadow: "0 8px 20px rgba(16,185,129,0.3)" }}>Verify & Start</button>
                <button disabled={otpSending || resendIn > 0} onClick={handleSendOtp} style={{ width: "100%", padding: 10, background: "none", border: "none", color: "#FF8C5A", fontWeight: 800, cursor: "pointer", opacity: resendIn > 0 ? 0.5 : 1 }}>{resendIn > 0 ? "Resend OTP (" + resendIn + "s)" : "🔁 Resend OTP"}</button>
                <button onClick={() => { setOtpStep("phone"); setOtpCode(""); }} style={{ width: "100%", padding: 10, background: "none", border: "none", color: "#8B9BB4", fontWeight: 700, cursor: "pointer" }}>← Change Number</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 26 }}>
              <button onClick={() => requestPinPrompt("staff")} style={{ ${R} }}>Staff</button>
              <button onClick={() => setShowWaiterPinModal(true)} style={{ ${R} }}>Waiter</button>
              <button onClick={() => requestPinPrompt("admin")} style={{ ${R} }}>Admin</button>
            </div>
          </div>
        </div>
      )}

      `;

s = s.slice(0, start) + NEW + s.slice(end);
fs.writeFileSync(p + ".bak2", raw);
fs.writeFileSync(p, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("OK: dark customer login lag gaya (backup: src/App.jsx.bak2)");