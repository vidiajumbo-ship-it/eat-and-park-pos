import fs from 'fs';

const appPath = 'src/App.jsx';
let code = fs.readFileSync(appPath, 'utf8');

// 1. Naya Dark Login UI with Keypad
const newLoginUI = `
      {!isLoggedIn && !waiterUnlocked && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150, background: "#0B111A", overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 400, background: "#161F2F", borderRadius: 24, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", border: "1px solid #273449" }}>
            
            {/* Logo & Header */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ width: 64, height: 64, background: "#FF5A1F", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 12px", color: "#fff" }}>🍽️</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Eat & Park</div>
              <div style={{ fontSize: 13, color: "#8B9BB4", marginTop: 4 }}>Customer Login</div>
            </div>

            {/* Role Switch (Staff/Waiter/Admin) */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <button onClick={() => requestPinPrompt("staff")} style={{ flex: 1, padding: "10px 0", background: "transparent", border: "1px solid #273449", borderRadius: 12, color: "#8B9BB4", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Staff</button>
              <button onClick={() => setShowWaiterPinModal(true)} style={{ flex: 1, padding: "10px 0", background: "transparent", border: "1px solid #273449", borderRadius: 12, color: "#8B9BB4", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Waiter</button>
              <button onClick={() => requestPinPrompt("admin")} style={{ flex: 1, padding: "10px 0", background: "transparent", border: "1px solid #273449", borderRadius: 12, color: "#8B9BB4", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Admin</button>
            </div>

            <div id="otp-recaptcha"></div>

            {otpStep === "phone" ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#8B9BB4", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 }}>Your Name</label>
                  <input type="text" placeholder="Enter your name" value={custName} onChange={(e) => setCustName(e.target.value)} style={{ width: "100%", padding: "14px 16px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#8B9BB4", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 }}>Phone Number</label>
                  <input type="tel" placeholder="10-digit number" value={custPhone} onChange={(e) => setCustPhone(e.target.value.replace(/\\D/g, "").slice(0, 10))} style={{ width: "100%", padding: "14px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#fff", fontSize: 20, letterSpacing: 2, fontWeight: 700, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
                </div>

                {/* Numeric Keypad for Phone */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
                  {[1,2,3,4,5,6,7,8,9].map(num => (
                    <button key={num} onClick={() => setCustPhone(prev => prev.length < 10 ? prev + num : prev)} style={{ padding: "14px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#fff", fontSize: 20, fontWeight: 700, cursor: "pointer" }}>{num}</button>
                  ))}
                  <button onClick={() => setCustPhone("")} style={{ padding: "14px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#FF5A1F", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>C</button>
                  <button onClick={() => setCustPhone(prev => prev.length < 10 ? prev + "0" : prev)} style={{ padding: "14px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#fff", fontSize: 20, fontWeight: 700, cursor: "pointer" }}>0</button>
                  <button onClick={() => setCustPhone(prev => prev.slice(0, -1))} style={{ padding: "14px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#FF5A1F", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>⌫</button>
                </div>

                <button onClick={() => { if (!custName.trim()) { showToast("⚠️ Pehle naam daalo", "error"); return; } handleSendOtp(); }} style={{ width: "100%", padding: "16px", background: "#FF5A1F", border: "none", borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 20px rgba(255,90,31,0.3)" }}>Send OTP</button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#8B9BB4", textTransform: "uppercase", marginBottom: 8, textAlign: "center", letterSpacing: 0.5 }}>Enter OTP sent to {custPhone}</label>
                  <input type="text" placeholder="••••" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\\D/g, ""))} style={{ width: "100%", padding: "14px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#fff", fontSize: 28, letterSpacing: 10, fontWeight: 800, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
                </div>

                {/* Numeric Keypad for OTP */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
                  {[1,2,3,4,5,6,7,8,9].map(num => (
                    <button key={num} onClick={() => setOtpCode(prev => prev.length < 6 ? prev + num : prev)} style={{ padding: "14px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#fff", fontSize: 20, fontWeight: 700, cursor: "pointer" }}>{num}</button>
                  ))}
                  <button onClick={() => setOtpCode("")} style={{ padding: "14px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#FF5A1F", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>C</button>
                  <button onClick={() => setOtpCode(prev => prev.length < 6 ? prev + "0" : prev)} style={{ padding: "14px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#fff", fontSize: 20, fontWeight: 700, cursor: "pointer" }}>0</button>
                  <button onClick={() => setOtpCode(prev => prev.slice(0, -1))} style={{ padding: "14px", background: "#0B111A", border: "1px solid #273449", borderRadius: 12, color: "#FF5A1F", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>⌫</button>
                </div>

                <button onClick={handleVerifyOtp} style={{ width: "100%", padding: "16px", background: "#10B981", border: "none", borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", marginBottom: 12, boxShadow: "0 8px 20px rgba(16,185,129,0.3)" }}>Verify & Start</button>
                <button onClick={() => { setOtpStep("phone"); setOtpCode(""); }} style={{ width: "100%", padding: "12px", background: "transparent", border: "none", color: "#8B9BB4", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← Change Number</button>
              </div>
            )}
          </div>
        </div>
      )}
`;

// 2. Purane Login UI ko hata kar naya lagana
const startMarker = '{!isLoggedIn && !waiterUnlocked && (';
const endMarker = '{toast && <Toast message={toast} type={toastType} />}';

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    code = code.substring(0, startIndex) + newLoginUI + '\n\n      ' + code.substring(endIndex);
    console.log('✅ Login UI aur Keypad successfully update ho gaya!');
} else {
    console.error('❌ Error: Login block nahi mila. Kripya check karein.');
}

fs.writeFileSync(appPath, code);