const fs = require('fs');
const path = require('path');

// 1. Backup original files
if (fs.existsSync('staff.jsx')) fs.copyFileSync('staff.jsx', 'staff.jsx.bak');
if (fs.existsSync('app.jsx')) fs.copyFileSync('app.jsx', 'app.jsx.bak');
console.log('✅ Backup create ho gaya (staff.jsx.bak, app.jsx.bak)');

let staffCode = fs.readFileSync('staff.jsx', 'utf8');
let appCode = fs.readFileSync('app.jsx', 'utf8');

// 2. Patch Colors (Velox POS Theme) in staff.jsx
const newStaffColors = `
const LIGHT = {
  bg: "#0B111A", card: "#161F2F", cardAlt: "#1E293B", ink: "#FFFFFF",
  gray: "#8B9BB4", light: "#0B111A", line: "#273449",
  red: "#EF4444", redLight: "#451A1A", green: "#10B981", greenLight: "#0A2A20",
  amber: "#F59E0B", amberLight: "#3A2510", blue: "#3B82F6", blueLight: "#152A4A",
  gold: "#FF5A1F", goldDark: "#E04814", goldLight: "#2A1A15", goldText: "#FF8C5A",
};
const DARK = LIGHT;
`;
staffCode = staffCode.replace(/const LIGHT = \{[\s\S]*?\};\s*const DARK = \{[\s\S]*?\};/m, newStaffColors.trim());

// 3. Patch Colors in app.jsx
const newAppColors = `
const COLORS = {
  ink: "#FFFFFF", paper: "#0B111A", paper2: "#161F2F",
  copper: "#FF5A1F", copperDark: "#E04814", copperLight: "#2A1A15",
  rust: "#EF4444", sage: "#10B981", sageDark: "#059669", sageLight: "#0A2A20",
  gold: "#F59E0B", line: "#273449", text: "#8B9BB4", textLight: "#64748B",
  success: "#10B981", error: "#EF4444", warning: "#F59E0B", info: "#3B82F6",
  google: "#4285F4", razorpay: "#0B4F6C", phonepe: "#5F259F"
};
`;
appCode = appCode.replace(/const COLORS = \{[\s\S]*?\};/m, newAppColors.trim());

// 4. Inject Global CSS
const globalCSS = `
/* VELOX POS THEME */
body { background: #0B111A; color: #FFFFFF; margin: 0; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #273449; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #FF5A1F; }
`;
staffCode = staffCode.replace(/const GLOBAL_CSS = \`([\s\S]*?)\`;/, `const GLOBAL_CSS = \`${globalCSS}\\n$1\`;`);

// 5. Change Staff Login Screen Layout (Velox Numeric Pad Look)
const newLoginScreen = `
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "system-ui, sans-serif", padding: 16 }}>
        <div style={{ background: C.card, borderRadius: 20, padding: isMobile ? 24 : 36, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: \`1px solid \${C.line}\` }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 70, height: 70, margin: "0 auto 12px", background: C.gold, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "#fff" }}>🍽️</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.ink }}>Velox POS</div>
            <div style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>Restaurant Command</div>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: C.gray, display: "block", marginBottom: 8, textTransform: "uppercase" }}>Staff Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@veloxpos.in" style={{ width: "100%", padding: "14px 16px", border: \`1px solid \${C.line}\`, borderRadius: 12, fontSize: 15, background: C.bg, color: C.ink, boxSizing: "border-box", outline: "none" }} required />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: C.gray, display: "block", marginBottom: 8, textTransform: "uppercase" }}>PIN</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••" style={{ width: "100%", padding: "14px 16px", border: \`1px solid \${C.line}\`, borderRadius: 12, fontSize: 24, background: C.bg, color: C.ink, boxSizing: "border-box", outline: "none", textAlign: "center", letterSpacing: 8 }} required />
            </div>
            {loginError && <div style={{ background: C.redLight, color: C.red, padding: "12px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 18, textAlign: "center" }}>{loginError}</div>}
            <button type="submit" style={{ width: "100%", padding: "16px", border: "none", borderRadius: 12, background: C.gold, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
              Start Shift
            </button>
          </form>
        </div>
      </div>
    );
  }
`;

staffCode = staffCode.replace(/if \(!user\) \{[\s\S]*?return \([\s\S]*?<\/form>[\s\S]*?<\/div>\s*\);?\s*\}/, newLoginScreen.trim());

// 6. Inject Sidebar into Main Layout
const sidebarLayoutInjection = `
      {/* SIDEBAR (Left Panel) */}
      {!isMobile && (
        <div style={{ width: 260, background: C.card, borderRight: \`1px solid \${C.line}\`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, background: C.gold, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff" }}>🍽️</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Velox POS</div>
              <div style={{ fontSize: 11, color: C.gray }}>Restaurant Command</div>
            </div>
          </div>
          <div style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
            {[
              { id: "tables", label: "Tables", icon: "🛋️" },
              { id: "orders", label: "Orders", icon: "🏷️" },
              { id: "kot", label: "Kitchen Display", icon: "🔥" },
              { id: "dashboard", label: "Reports", icon: "📊" },
              { id: "history", label: "Bills", icon: "🧾" },
              { id: "inventory", label: "Stock", icon: "📦" }
            ].map(tab => (
              <button key={tab.id} onClick={() => { haptic(); setActiveTab(tab.id); }} 
                style={{ 
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", 
                  border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  background: activeTab === tab.id ? C.gold : "transparent", 
                  color: activeTab === tab.id ? "#fff" : C.gray, 
                  fontWeight: 700, fontSize: 14, transition: "all 0.2s"
                }}>
                <span style={{ fontSize: 18 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ padding: 20, borderTop: \`1px solid \${C.line}\` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.ink }}>{staffData?.name || "Staff"}</div>
                <div style={{ fontSize: 10, color: C.gray, textTransform: "uppercase" }}>{staffData?.role || "waiter"}</div>
              </div>
            </div>
            <button onClick={handleLogout} style={{ width: "100%", padding: 8, background: "transparent", border: \`1px solid \${C.line}\`, color: C.red, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Logout</button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
`;

// Replace the top main wrapper with flex row to accommodate sidebar
staffCode = staffCode.replace(
  /<div style=\{\{ minHeight: "100vh", background: C\.bg, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", color: C\.ink \}\}>/,
  `<div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "row", color: C.ink }}>
      ${sidebarLayoutInjection}`
);

// Close the new main content div (this requires finding the end of the layout and adding </div>)
staffCode = staffCode.replace(
  /(<ConnectionBadge C=\{C\} \/>[\s\S]*?)(<\/div>\s*\)\s*;\s*\})/,
  `$1 </div> $2`
);

fs.writeFileSync('staff.jsx', staffCode);
fs.writeFileSync('app.jsx', appCode);

console.log('🎉 UI Patch Successfully Applied!');
console.log('➡️  Ab aap npm run dev karein aur Velox POS theme ka maza lein.');