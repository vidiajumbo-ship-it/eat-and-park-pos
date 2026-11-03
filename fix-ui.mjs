import fs from 'fs';

const staffPath = 'src/StaffApp.jsx';
let staffCode = fs.readFileSync(staffPath, 'utf8');

// 1. Fix Invisible Table Buttons (C.ink -> C.gold)
staffCode = staffCode.replace(
  /background: C\.ink, color: "#fff", fontWeight: 800, fontSize: isMobile \? 11 : 10/g,
  'background: C.gold, color: "#fff", fontWeight: 800, fontSize: isMobile ? 11 : 10'
);

// 2. Hide Old Top Header on Desktop (Orange bar)
// Find the top bar div and add display: none for desktop
staffCode = staffCode.replace(
  /<div style=\{\{ background: `linear-gradient\(135deg, \$\{C\.gold\} 0%, \$\{C\.goldDark\} 100%\)`, color: "#fff", padding: isMobile \? "10px 10px" : "14px 20px"/,
  '<div style={{ display: isMobile ? "flex" : "none", background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, color: "#fff", padding: isMobile ? "10px 10px" : "14px 20px"'
);

// 3. Hide Old Tabs on Desktop (since we have Sidebar now)
staffCode = staffCode.replace(
  /<div style=\{\{ background: C\.card, borderBottom: `1px solid \$\{C\.line\}`, padding: isMobile \? "0 8px" : "0 16px", display: "flex"/,
  '<div style={{ display: isMobile ? "flex" : "none", background: C.card, borderBottom: `1px solid ${C.line}`, padding: isMobile ? "0 8px" : "0 16px", display: "flex"'
);

fs.writeFileSync(staffPath, staffCode);
console.log('✅ UI Fixes applied! Buttons are now visible and old header is hidden on desktop.');