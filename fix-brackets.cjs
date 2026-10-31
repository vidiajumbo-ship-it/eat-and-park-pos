const fs = require("fs");
const filePath = "src/StaffApp.jsx";
let src = fs.readFileSync(filePath, "utf8");

// Purana code jahan item ka naam aur portion alag alag render ho rahe hain
const oldCode1 = `<span style={{ fontSize: 13, fontWeight: 700 }}>{m.name}{m.portion ? <span style={{ color: C.gray, fontWeight: 500 }}> ({m.portion})</span> : null}</span>`;
const newCode1 = `<span style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</span>`;

const oldCode2 = `<div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}{m.portion ? <span style={{ color: C.gray, fontWeight: 500 }}> ({m.portion})</span> : null}</div>`;
const newCode2 = `<div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>`;

// Replace both
src = src.replace(oldCode1, newCode1);
src = src.replace(oldCode2, newCode2);

fs.writeFileSync(filePath, src, "utf8");
console.log("✅ Bracket duplicate fix ho gaya!");
