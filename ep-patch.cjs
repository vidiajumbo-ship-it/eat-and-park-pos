#!/usr/bin/env node
/*
  EP-PATCH — Build fix + Customer login gate
  Usage (project root se):
      node ep-patch.cjs                 -> src/App.jsx patch karega
      node ep-patch.cjs path/to/App.jsx -> custom path

  - Pehle backup banata hai (App.jsx.bak)
  - Sab patches ek saath check hote hain; koi ek fail to file bilkul nahi badalti
  - Dobara chalane se kuch double nahi hota (already applied skip ho jata hai)
*/
const fs = require("fs");
const path = require("path");

const target = path.resolve(process.argv[2] || "src/App.jsx");
if (!fs.existsSync(target)) {
  console.error("❌ File nahi mili: " + target);
  console.error("   Project root se chalao, ya path do: node ep-patch.cjs src/App.jsx");
  process.exit(1);
}

// ---- patches ko isi file ke neeche wale comment se padho ----
const self = fs.readFileSync(__filename, "utf8");
const m = self.match(/\/\*@@PATCHES([\s\S]*?)PATCHES@@\*\//);
if (!m) { console.error("❌ Patch data nahi mila"); process.exit(1); }

const patches = [];
m[1].split(/^@@PATCH /m).slice(1).forEach((block) => {
  const nl = block.indexOf("\n");
  const name = block.slice(0, nl).trim();
  const body = block.slice(nl + 1);
  const grab = (tag, next) => {
    const s = body.indexOf("@@" + tag + "\n");
    if (s < 0) return null;
    const from = s + tag.length + 3;
    const e = next ? body.indexOf("@@" + next + "\n", from) : body.length;
    return body.slice(from, e < 0 ? body.length : e).trim();
  };
  patches.push({
    name,
    skipif: grab("SKIPIF", "FIND"),
    find: grab("FIND", "REPLACE"),
    replace: grab("REPLACE", null),
  });
});

let src = fs.readFileSync(target, "utf8");
const count = (hay, needle) => (needle ? hay.split(needle).length - 1 : 0);

// ---- sab ko pehle check karo ----
const plan = [];
let bad = false;
for (const p of patches) {
  if (p.skipif && src.includes(p.skipif)) { plan.push({ p, action: "skip" }); continue; }
  const n = count(src, p.find);
  if (n === 1) plan.push({ p, action: "apply" });
  else if (n === 0 && src.includes(p.replace)) plan.push({ p, action: "skip" });
  else {
    bad = true;
    plan.push({ p, action: "fail", why: n === 0 ? "FIND text file me nahi mila (file alag ho gayi hai?)" : "FIND " + n + " baar mila (sirf 1 hona chahiye)" });
  }
}

plan.forEach(({ p, action, why }) => {
  const icon = action === "apply" ? "🛠️ " : action === "skip" ? "⏭️ " : "❌";
  console.log(icon + " " + p.name + (action === "skip" ? " (pehle se laga hua)" : "") + (why ? " — " + why : ""));
});

if (bad) {
  console.error("\n❌ Kuch patches fail hue. File mein koi badlav NAHI kiya gaya.");
  process.exit(1);
}

const todo = plan.filter((x) => x.action === "apply");
if (todo.length === 0) { console.log("\n✅ Sab patches pehle se laga hua hai. Kuch karna nahi."); process.exit(0); }

// ---- backup + apply ----
fs.writeFileSync(target + ".bak", src);
for (const { p } of todo) src = src.replace(p.find, () => p.replace);
fs.writeFileSync(target, src);

console.log("\n✅ " + todo.length + " patch(es) lag gaye → " + target);
console.log("💾 Backup: " + target + ".bak");
console.log("\nAb chalao:  npm run build   (check ke liye)");
console.log("Phir:       git add -A && git commit -m \"login gate + build fix\" && git push");
process.exit(0);

/*@@PATCHES
@@PATCH 1: Build error fix (extra ", hatao)
@@FIND
"auth/operation-not-allowed": "Phone SMS blocked (operation-not-allowed): SMS region policy me India allow karo / sahi Firebase project check karo",",
@@REPLACE
"auth/operation-not-allowed": "Phone SMS blocked (operation-not-allowed): SMS region policy me India allow karo / sahi Firebase project check karo",
@@PATCH 2: paymentInfo undefined crash fix (handleWaiterOrder)
@@FIND
status: "new", paid: (paymentInfo.status === "paid" || paymentInfo.status === "paid_unverified"), createdAt: Date.now(),
@@REPLACE
status: "new", paid: false, createdAt: Date.now(),
@@PATCH 3: Waiter login me asli error code dikhao
@@FIND
} catch (e) { showToast("❌ Login fail", "error"); setWaiterPinInput(""); }
@@REPLACE
} catch (e) { console.error(e); showToast("❌ Login fail: " + (e.code || e.message), "error"); setWaiterPinInput(""); }
@@PATCH 4: Pehle customer login (naam + phone OTP), phir menu
@@SKIPIF
Menu dekhne ke liye pehle login karo
@@FIND
{toast && <Toast message={toast} type={toastType} />}
@@REPLACE
{toast && <Toast message={toast} type={toastType} />}

      {!isLoggedIn && !waiterUnlocked && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150, background: COLORS.paper, overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🍽️</div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, margin: "0 0 4px" }}>{RESTAURANT.name}</h1>
            <p style={{ fontSize: 13, color: COLORS.textLight, margin: "0 0 24px" }}>Menu dekhne ke liye pehle login karo</p>

            <div id="otp-recaptcha"></div>

            {otpStep === "phone" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="text" placeholder="Aapka Naam *" value={custName} onChange={(e) => setCustName(e.target.value)} style={inputStyle} />
                <input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit Phone *" value={custPhone} onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
                <button onClick={() => { if (!custName.trim()) { showToast("⚠️ Pehle naam daalo", "error"); return; } handleSendOtp(); }}
                  style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 14, padding: 16, fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
                  📩 OTP Bhejo
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, color: COLORS.textLight }}>OTP {custPhone} par bheja gaya</div>
                <input type="text" inputMode="numeric" maxLength={6} placeholder="OTP daalo" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} style={{ ...inputStyle, textAlign: "center", letterSpacing: 8, fontWeight: 800 }} />
                <button onClick={handleVerifyOtp}
                  style={{ background: COLORS.success, color: "#fff", border: "none", borderRadius: 14, padding: 16, fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
                  ✓ Verify & Menu Dekho
                </button>
                <button onClick={() => { setOtpStep("phone"); setOtpCode(""); }} style={{ background: "none", border: "none", color: COLORS.textLight, fontWeight: 700, cursor: "pointer" }}>← Number badlo</button>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginTop: 32 }}>
              <button onClick={() => requestPinPrompt("staff")} style={{ background: "none", border: `1px solid ${COLORS.line}`, color: COLORS.textLight, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>🔒 Staff</button>
              <button onClick={() => setShowWaiterPinModal(true)} style={{ background: "none", border: `1px solid ${COLORS.line}`, color: COLORS.textLight, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>🧑‍🍳 Waiter</button>
              <button onClick={() => requestPinPrompt("admin")} style={{ background: "none", border: `1px solid ${COLORS.line}`, color: COLORS.textLight, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>⚙️ Admin</button>
            </div>
          </div>
        </div>
      )}
PATCHES@@*/
