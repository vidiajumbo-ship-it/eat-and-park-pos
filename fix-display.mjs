import fs from "fs";
const p = "src/StaffApp.jsx";
let s = fs.readFileSync(p, "utf8");
const a = 'padding: isMobile ? "10px 10px" : "14px 20px", display: "flex", justifyContent';
const b = 'padding: isMobile ? "0 8px" : "0 16px", display: "flex", gap: 4';
let n = 0;
if (s.includes(a)) { s = s.replace(a, 'padding: isMobile ? "10px 10px" : "14px 20px", justifyContent'); n++; }
if (s.includes(b)) { s = s.replace(b, 'padding: isMobile ? "0 8px" : "0 16px", gap: 4'); n++; }
fs.writeFileSync(p, s);
console.log(n + " jagah fix hui");