const fs = require("fs");
const FILE = "src/App.jsx";
let t = fs.readFileSync(FILE, "utf8");

// 1. State me naya field add karna (exactAddress)
const stateLine = 'const [custAddress, setCustAddress] = useState("");';
if (!t.includes('const [custExactAddress, setCustExactAddress] = useState("");')) {
  t = t.replace(stateLine, stateLine + '\n  const [custExactAddress, setCustExactAddress] = useState("");');
}

// 2. handleGetLocation update karna
const oldGetLoc = `const handleGetLocation = () => {
    if (!navigator.geolocation) { showToast("Geolocation not supported", 'error'); return; }
    showToast("📍 Fetching location...", 'info');
    navigator.geolocation.getCurrentPosition(
      (position) => { const { latitude, longitude } = position.coords; setCustAddress(\`Lat: \${latitude.toFixed(4)}, Lng: \${longitude.toFixed(4)}\`); showToast("✅ Location fetched!", 'success'); },
      () => { showToast("⚠️ Unable to get location", 'error'); }
    );
  };`;

const newGetLoc = `const handleGetLocation = () => {
    if (!navigator.geolocation) { showToast("Geolocation not supported", 'error'); return; }
    showToast("📍 Fetching location...", 'info');
    navigator.geolocation.getCurrentPosition(
      (position) => { 
        const { latitude, longitude } = position.coords; 
        setCustAddress(\`Lat: \${latitude.toFixed(5)}, Lng: \${longitude.toFixed(5)}\`); 
        showToast("✅ GPS Location aagayi! Ab exact address likhein.", 'success'); 
      },
      () => { showToast("⚠️ Location permission block hai ya GPS off hai.", 'error'); }
    );
  };`;
t = t.replace(oldGetLoc, newGetLoc);

// 3. UI me Parcel order ke time Address + Pincode box dikhana
const oldAddressUI = `{orderType === "parcel" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <textarea placeholder="Address *" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} style={{ ...inputStyle, resize: "none", flex: 1 }} rows={2} />
                      <button onClick={handleGetLocation} style={{ background: COLORS.sage, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer" }}>📍</button>
                    </div>
                  )}`;

const newAddressUI = `{orderType === "parcel" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {/* Auto GPS Box */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <input 
                          type="text" 
                          placeholder="📍 Click button to fetch GPS Location" 
                          value={custAddress} 
                          readOnly
                          style={{ ...inputStyle, flex: 1, background: COLORS.paper2 }} 
                        />
                        <button 
                          onClick={handleGetLocation} 
                          style={{ background: COLORS.sage, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          📍 Get Location
                        </button>
                      </div>
                      
                      {/* Exact Address Box */}
                      <textarea 
                        placeholder="Exact Address (House No, Building, Landmark, Area) *" 
                        value={custExactAddress} 
                        onChange={(e) => setCustExactAddress(e.target.value)} 
                        style={{ ...inputStyle, resize: "none" }} 
                        rows={2} 
                      />
                      
                      {/* Pincode Box */}
                      <input 
                        type="text" 
                        placeholder="Pincode (6 digits) *" 
                        maxLength={6}
                        value={custPinCode || ""} 
                        onChange={(e) => setCustPinCode && setCustPinCode(e.target.value.replace(/\\D/g, ""))} 
                        style={{ ...inputStyle }} 
                      />
                    </div>
                  )}`;

// Check if pinCode state exists, else add it
if (!t.includes('const [custPinCode, setCustPinCode] = useState("");')) {
  t = t.replace(stateLine, stateLine + '\n  const [custPinCode, setCustPinCode] = useState("");\n  const [custExactAddress, setCustExactAddress] = useState("");');
}

t = t.replace(oldAddressUI, newAddressUI);

// 4. Validation me Pincode aur Exact Address check karna
const oldValidation = `if (orderType === "parcel" && !custAddress.trim()) { showToast("⚠️ Enter Address", 'error'); return; }`;
const newValidation = `if (orderType === "parcel" && (!custAddress.trim() || !custExactAddress.trim() || !custPinCode || custPinCode.length !== 6)) { showToast("⚠️ Location, Exact Address aur 6-digit Pincode zaroori hai!", 'error'); return; }`;
t = t.replace(oldValidation, newValidation);

// 5. Order place karte waqt data save karna (Address + Pincode)
const oldOrderCustomer = `customer: { name: custName, phone: custPhone, address: orderType === "parcel" ? custAddress : "" },`;
const newOrderCustomer = `customer: { name: custName, phone: custPhone, address: orderType === "parcel" ? custAddress : "", exactAddress: custExactAddress, pincode: custPinCode },`;
t = t.replace(oldOrderCustomer, newOrderCustomer);

fs.copyFileSync(FILE, FILE + ".bak-address");
fs.writeFileSync(FILE, t, "utf8");
console.log("✅ Customer App me Address + Pincode + GPS logic add ho gaya!");