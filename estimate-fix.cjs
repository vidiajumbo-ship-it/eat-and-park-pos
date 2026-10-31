const fs = require("fs"), path = require("path");
const MARK = "EP-EST-v1";
function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    if (f === "node_modules") continue;
    const p = path.join(d, f), st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(f) && !/backup/i.test(f)) out.push(p);
  }
  return out;
}
const file = walk(process.argv[2] || "src").find(f => fs.readFileSync(f, "utf8").includes("function StaffAppInner("));
if (!file) { console.log("Staff file nahi mili"); process.exit(1); }
let s = fs.readFileSync(file, "utf8");
if (s.includes(MARK)) { console.log("Already patched:", file); process.exit(0); }
fs.writeFileSync(file + ".bak2", s);
const ok = [], warn = [];
function rep(from, to, label) {
  if (!s.includes(from)) { warn.push(label); return; }
  s = s.replace(from, () => to); ok.push(label);
}

rep('const [showEstimate, setShowEstimate] = useState(false);',
    'const [showEstimate, setShowEstimate] = useState(false);\n  const [estimatePending, setEstimatePending] = useState(false);', "state");

rep('onTableClick={(t) => { haptic(); setSelectedTable(t); setCart({}); setBillOrder(null); setAddMoreMode(false); }}',
    'onTableClick={(t) => { haptic(); setSelectedTable(t); setCart((p) => (estimatePending ? p : {})); setEstimatePending(false); setBillOrder(null); setAddMoreMode(false); }}', "table click keeps cart");

rep('onNew={() => { haptic(); setSelectedTable("parcel"); setCart({}); setBillOrder(null); setAddMoreMode(false); }}',
    'onNew={() => { haptic(); setSelectedTable("parcel"); setCart((p) => (estimatePending ? p : {})); setEstimatePending(false); setBillOrder(null); setAddMoreMode(false); }}', "parcel new keeps cart");

rep('onBack={() => { setSelectedTable(null); setCart({}); setBillOrder(null); setAddMoreMode(false); }}',
    'onBack={() => { setSelectedTable(null); setCart({}); setEstimatePending(false); setBillOrder(null); setAddMoreMode(false); }}', "back resets");

rep('if (!selectedTable) setActiveTab("tables");',
    'setEstimatePending(true);\n            if (!selectedTable) setActiveTab("tables");', "estimate sets pending");

rep('items cart me chale gaye', 'items cart me hain - ab table ya Parcel chuno', "toast text");

const BANNER = `{estimatePending && Object.keys(cart).length > 0 && !selectedTable && (activeTab === "tables" || activeTab === "parcel") && (
  <div style={{ background: C.greenLight, border: "2px solid " + C.green, borderRadius: 12, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
    <div style={{ flex: 1, minWidth: 180, fontWeight: 800, fontSize: 13, color: C.ink }}>📋 Estimate ke {Object.keys(cart).length} items cart me hain. Ab khali table ya Parcel par tap karo.</div>
    <button onClick={() => { setSelectedTable("parcel"); setBillOrder(null); setAddMoreMode(false); setEstimatePending(false); }} style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: C.red, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🛍️ Parcel</button>
    <button onClick={() => { setCart({}); setEstimatePending(false); }} style={{ padding: "8px 14px", border: "1.5px solid " + C.gray, borderRadius: 8, background: "transparent", color: C.gray, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Hatao</button>
  </div>
)}
{calls.length > 0 && (`;
rep('{calls.length > 0 && (', BANNER, "banner");

fs.writeFileSync(file, s + "\n// " + MARK + "\n");
console.log("File:", file);
ok.forEach(x => console.log("  +", x));
warn.forEach(x => console.log("  ! anchor nahi mila:", x));