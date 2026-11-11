const fs = require("fs");
const FILE = "src/StaffApp.jsx";
let t = fs.readFileSync(FILE, "utf8");

// Purane ParcelView ke customer name/phone/address lines ko dhoondh kar theek karna
// Purana code: timeAgo(o.createdAt)} ago{cname ? " - " + cname : ""}{cphone ? " - " + cphone : ""}{o.waiter ? " - " + o.waiter : ""}
// Naya code: timeAgo(o.createdAt)} ago {cname ? " · 👤 " + cname : ""}{cphone ? " · 📞 " + cphone : ""}{o.waiter ? " · 🧑‍🍳 " + o.waiter : ""}

const oldLine = '{timeAgo(o.createdAt)} ago{cname ? " - " + cname : ""}{cphone ? " - " + cphone : ""}{o.waiter ? " - " + o.waiter : ""}';
const newLine = '{timeAgo(o.createdAt)} ago {cname ? " · 👤 " + cname : ""}{cphone ? " · 📞 " + cphone : ""}{o.waiter ? " · 🧑‍🍳 " + o.waiter : ""}';

if (t.includes(oldLine)) {
    t = t.replace(oldLine, newLine);
} else {
    console.log("⚠️ Time/Name line nahi mili, kuch aur try kar rahe hain...");
}

// Address add karna (Parcel me address dikhna chahiye)
// Purana block: <div style={{ fontSize: 11, color: C.gray, marginBottom: 8, fontWeight: 700 }}>
const oldAddressBlock = `{o.orderType === "parcel" && (<div style={{ fontSize: 13, marginTop: 8, padding: "6px 10px", borderRadius: 8, fontWeight: 800, background: isSelected ? "rgba(255,255,255,0.2)" : "#FFF3E0", color: isSelected ? "#fff" : "#E65100" }}>📍 {o.customer?.address || "Address nahi"}<br />📞 {o.customer?.phone || "-"} · {o.customer?.name || "-"}</div>)}`;

// Naya address block (agar parcha view me nahi hai, toh hum ise add karenge)
if (!t.includes('📍 {o.customer?.address || "Address nahi"}')) {
    // Agar address block nahi hai, toh timeAgo wali line ke baad add karo
    const insertAfter = '{cphone ? " - " + cphone : ""}{o.waiter ? " - " + o.waiter : ""}';
    const insertBlock = `{cphone ? " · 📞 " + cphone : ""}{o.waiter ? " · 🧑‍🍳 " + o.waiter : ""} <br/> <span style={{color: "#E65100", fontWeight: "bold"}}>📍 {o.customer?.address || "Address nahi diya"}</span>`;
    if (t.includes(insertAfter)) {
       t = t.replace(insertAfter, insertBlock);
    }
}

// Ek aur jagah fix karna (agar upar wala kaam na kare)
t = t.replace(
  `{timeAgo(o.createdAt)} ago{cname ? " - " + cname : ""}{cphone ? " - " + cphone : ""}{o.waiter ? " - " + o.waiter : ""}`,
  `{timeAgo(o.createdAt)} ago <br/><span style={{color: "#FCD34D"}}>👤 {cname || "Guest"} · 📞 {cphone || "No Phone"}</span><br/><span style={{color: "#10B981"}}>📍 {o.customer?.address || "No Address"}</span>`
);

fs.copyFileSync(FILE, FILE + ".bak-parcel");
fs.writeFileSync(FILE, t, "utf8");
console.log("✅ StaffApp.jsx Parcel View fixed!");