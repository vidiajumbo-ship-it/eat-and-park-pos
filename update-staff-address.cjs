const fs = require("fs");
const FILE = "src/StaffApp.jsx";
let t = fs.readFileSync(FILE, "utf8");

// Jo purana address block code me hai, usko target karo
const oldStr = `📍 {o.customer?.address || "Address nahi"}<br />📞 {o.customer?.phone || "-"} · {o.customer?.name || "-"}`;

// Naya block jo Exact Address aur Pincode dikhayega
const newStr = `👤 {o.customer?.name || "Guest"}<br />
📞 {o.customer?.phone || "-"}<br />
🏠 <b>{o.customer?.exactAddress || "No Exact Address"}</b><br />
📮 PIN: {o.customer?.pincode || "-"}<br />
📍 <span style={{ color: "#3B82F6" }}>{o.customer?.address || "No GPS"}</span>`;

if (t.includes(oldStr)) {
  t = t.replace(oldStr, newStr);
  fs.writeFileSync(FILE, t, "utf8");
  console.log("✅ StaffApp.jsx me Exact Address aur Pincode add ho gaya!");
} else {
  console.log("❌ Nahi mila! Shayad pehle se change hai. Terminal me `grep -n 'o.customer?.address' src/StaffApp.jsx` chala kar dekho.");
}