const fs = require("fs");
const FILE = "src/App.jsx";
let t = fs.readFileSync(FILE, "utf8");

// Duplicate lines ko ek single line me replace karo
const oldCode = `  const [custPinCode, setCustPinCode] = useState("");
  const [custExactAddress, setCustExactAddress] = useState("");
  const [custExactAddress, setCustExactAddress] = useState("");`;

const newCode = `  const [custPinCode, setCustPinCode] = useState("");
  const [custExactAddress, setCustExactAddress] = useState("");`;

if (t.includes(oldCode)) {
  t = t.replace(oldCode, newCode);
  fs.writeFileSync(FILE, t, "utf8");
  console.log("✅ Duplicate fix ho gaya! Ab build pass hoga.");
} else {
  console.log("⚠️ Exact duplicate nahi mila. Manually check karo line 2442-2444.");
}
