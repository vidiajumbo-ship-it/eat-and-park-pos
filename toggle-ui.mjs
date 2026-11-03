import fs from 'fs';

const staffPath = 'src/StaffApp.jsx';
let staffCode = fs.readFileSync(staffPath, 'utf8');

// 1. Add Legacy Colors
const colorsDef = `
const VELOX_DARK = {
  bg: "#0B111A", card: "#161F2F", cardAlt: "#1E293B", ink: "#FFFFFF",
  gray: "#8B9BB4", light: "#0B111A", line: "#273449",
  red: "#EF4444", redLight: "#451A1A", green: "#10B981", greenLight: "#0A2A20",
  amber: "#F59E0B", amberLight: "#3A2510", blue: "#3B82F6", blueLight: "#152A4A",
  gold: "#FF5A1F", goldDark: "#E04814", goldLight: "#2A1A15", goldText: "#FF8C5A",
};
const ORIGINAL_LIGHT = {
  bg: "#FAF7EF", card: "#FFFFFF", cardAlt: "#F4EEDD", ink: "#1C1608",
  gray: "#7A7058", light: "#FAF7EF", line: "#E9E0C9",
  red: "#DC2626", redLight: "#FEF2F2", green: "#16A34A", greenLight: "#F0FDF4",
  amber: "#F59E0B", amberLight: "#FFFBEB", blue: "#2563EB", blueLight: "#EFF6FF",
  gold: "#B8860B", goldDark: "#7A5806", goldLight: "#FBF3D9", goldText: "#8A6200",
};
`;
staffCode = staffCode.replace(/const LIGHT = \{[\s\S]*?\};\s*const DARK = LIGHT;/, colorsDef.trim());

// 2. Inject legacyUI State
staffCode = staffCode.replace(
  /const \[darkMode, setDarkMode\] = useState\(\(\) => safeStorageGet\("staff_dark", "0"\) === "1"\);/,
  `const [darkMode, setDarkMode] = useState(() => safeStorageGet("staff_dark", "0") === "1");
   const [legacyUI, setLegacyUI] = useState(false);`
);

// 3. Use legacyUI for Colors
staffCode = staffCode.replace(
  /const C = darkMode \? DARK : LIGHT;/,
  `const C = legacyUI ? ORIGINAL_LIGHT : VELOX_DARK;`
);

// 4. Conditionally Render Sidebar
staffCode = staffCode.replace(
  /\{\!isMobile && \(\s*<div style=\{\{ width: 260, background: C\.card, borderRight:/,
  `{!isMobile && !legacyUI && (\n        <div style={{ width: 260, background: C.card, borderRight:`
);

// 5. Add Toggle Button in Sidebar
staffCode = staffCode.replace(
  /<button onClick=\{handleLogout\} style=\{\{ width: "100%", padding: 8, background: "transparent", border: \`1px solid \$\{C\.line\}\`, color: C\.red, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 \}\}>Logout<\/button>/,
  `<button onClick={() => setLegacyUI(true)} style={{ width: "100%", padding: 8, background: "transparent", border: \`1px solid \${C.line}\`, color: C.gold, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, marginBottom: 8 }}>Switch to Legacy UI</button>
            <button onClick={handleLogout} style={{ width: "100%", padding: 8, background: "transparent", border: \`1px solid \${C.line}\`, color: C.red, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Logout</button>`
);

// 6. Conditionally Render Old Header
staffCode = staffCode.replace(
  /display: isMobile \? "flex" : "none", background: `linear-gradient/,
  `display: (isMobile || legacyUI) ? "flex" : "none", background: \`linear-gradient`
);

// 7. Conditionally Render Old Tabs
staffCode = staffCode.replace(
  /display: isMobile \? "flex" : "none", background: C\.card, borderBottom:/,
  `display: (isMobile || legacyUI) ? "flex" : "none", background: C.card, borderBottom:`
);

// 8. Add Switch back to New UI button in Old Header
staffCode = staffCode.replace(
  /<button onClick=\{handleLogout\} style=\{\{ background: "rgba\(255,255,255,0\.18\)", border: "none", color: "#fff", padding: isMobile \? "9px 10px" : "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" \}\}>Logout<\/button>/,
  `<button onClick={() => setLegacyUI(false)} style={{ background: "rgba(255,255,255,0.25)", border: "none", color: "#fff", padding: isMobile ? "9px 10px" : "9px 16px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer", marginRight: 8 }}>✨ New UI</button>
          <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", padding: isMobile ? "9px 10px" : "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Logout</button>`
);

fs.writeFileSync(staffPath, staffCode);
console.log('✅ Toggle Button Added! Ab aap Sidebar aur Header se UI switch kar sakte hain.');