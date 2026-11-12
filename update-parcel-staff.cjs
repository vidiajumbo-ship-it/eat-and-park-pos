const fs = require("fs");

// ==========================================
// 1. FIX APP.JSX (Customer App Duplicate)
// ==========================================
const APP = "src/App.jsx";
if (fs.existsSync(APP)) {
  let t = fs.readFileSync(APP, "utf8");
  const oldCode = `  const [custPinCode, setCustPinCode] = useState("");
  const [custExactAddress, setCustExactAddress] = useState("");
  const [custExactAddress, setCustExactAddress] = useState("");`;
  const newCode = `  const [custPinCode, setCustPinCode] = useState("");
  const [custExactAddress, setCustExactAddress] = useState("");`;
  
  if (t.includes(oldCode)) {
    t = t.replace(oldCode, newCode);
    fs.writeFileSync(APP, t, "utf8");
    console.log("✅ App.jsx duplicate declaration fixed!");
  }
}

// ==========================================
// 2. FIX STAFFAPP.JSX (Parcel Details UI)
// ==========================================
const STAFF = "src/StaffApp.jsx";
if (fs.existsSync(STAFF)) {
  let t = fs.readFileSync(STAFF, "utf8");

  // Naya Address & Pincode dikhane wala UI block
  const oldAddressBlock = `<div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
    <span style={{ fontSize: 16, marginTop: 2 }}>📍</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, color: C.ink, fontWeight: 700, lineHeight: 1.4 }}>
        {o.customer?.address && o.customer.address.includes("Lat:") ? (
          <span style={{ color: C.blue }}>📍 Live Location Attached</span>
        ) : (
          o.customer?.address || "No Address Provided"
        )}
      </div>`;

  const newAddressBlock = `<div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
    <span style={{ fontSize: 16, marginTop: 2 }}>📍</span>
    <div style={{ flex: 1 }}>
      {/* Naya logic: Exact Address, GPS aur Pincode dono dikhaye */}
      <div style={{ fontSize: 13, color: C.ink, fontWeight: 700, lineHeight: 1.4 }}>
        {o.customer?.exactAddress || "Address nahi diya"}
        {o.customer?.pincode && <span style={{ color: C.gray, marginLeft: 6 }}>({o.customer.pincode})</span>}
      </div>
      {o.customer?.address && o.customer.address.includes("Lat:") && (
        <div style={{ fontSize: 11, color: C.blue, marginTop: 2, fontWeight: 700 }}>
          {o.customer.address}
        </div>
      )}`;

  if (t.includes(oldAddressBlock)) {
    t = t.replace(oldAddressBlock, newAddressBlock);
    // Map button wala logic waise hi rahega, bas ab exact address bhi dikhega.
    fs.writeFileSync(STAFF, t, "utf8");
    console.log("✅ StaffApp.jsx updated: Exact Address + Pincode UI added!");
  } else {
    console.log("⚠️ StaffApp.jsx me purana address block nahi mila. Check line manually.");
  }
}