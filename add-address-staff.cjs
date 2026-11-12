const fs = require("fs");
const FILE = "src/StaffApp.jsx";
let t = fs.readFileSync(FILE, "utf8");

// 1. Block insert karne ke liye ek anchor (nishan) dhoondho
// Hum Parcel Card me "Total" ke theek upar address block dalenge.
const anchor = `<div style={{ borderTop: \`1px solid \${C.line}\`, paddingTop: 8, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>`;

const newAddressBlock = `
  {/* Naya Zomato Style Address Block */}
  {o.orderType === "parcel" && (
    <div style={{ background: C.cardAlt, border: "1px solid " + C.line, borderRadius: 8, padding: 10, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>👤</span>
        <span style={{ fontWeight: 800, fontSize: 13, color: C.ink }}>{o.customer?.name || "Guest"}</span>
        {o.customer?.phone && <span style={{ fontSize: 11, color: C.gray }}>· {o.customer.phone}</span>}
      </div>
      
      <div style={{ fontSize: 12, color: C.ink, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>
        <span style={{ color: C.red, marginRight: 4 }}>📍</span>
        {o.customer?.exactAddress || "Address nahi diya"} 
        {o.customer?.pincode && <span style={{ color: C.gray }}> (PIN: {o.customer.pincode})</span>}
      </div>

      {o.customer?.address && o.customer.address.includes("Lat:") && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const match = o.customer.address.match(/Lat: ([\d.-]+), Lng: ([\d.-]+)/);
            if (match) window.open(\`https://www.google.com/maps/search/?api=1&query=\${match[1]},\${match[2]}\`, "_blank");
          }}
          style={{ marginTop: 6, padding: "6px 12px", background: C.blue, color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, width: "100%", justifyContent: "center" }}
        >
          🗺️ Open Location in Google Maps
        </button>
      )}
    </div>
  )}
`;

if (t.includes("Open Location in Google Maps")) {
  console.log("⚠️ Ye block pehle se add hai.");
} else if (t.includes(anchor)) {
  // Anchor ke theek pehle block insert karo
  t = t.replace(anchor, newAddressBlock + "\n  " + anchor);
  fs.copyFileSync(FILE, FILE + ".bak-addr-add");
  fs.writeFileSync(FILE, t, "utf8");
  console.log("✅ StaffApp.jsx me naya Address + Map block add ho gaya!");
} else {
  console.log("❌ Anchor nahi mila. Terminal me `grep -n 'Baaki payment' src/StaffApp.jsx` chalao.");
}