#!/usr/bin/env node
/**
 * patch-half-qty.cjs
 * Staff.jsx me bill ki quantity me .5 / 1.5 / 2.25 type karne ka fix.
 *
 * Kya karta hai:
 *   1. QtyInput component add karta hai (local text + valid number par commit)
 *   2. BillingView ke cart row ka purana qty <input> QtyInput se badalta hai
 *   3. Total me paise ka floating error rokne ke liye Math.round lagata hai
 *      (skip karna ho to:  --no-round)
 *
 * Use:
 *   node patch-half-qty.cjs                 (default: src/Staff.jsx)
 *   node patch-half-qty.cjs src/staff.jsx   (file ka path khud do)
 *   node patch-half-qty.cjs --dry-run       (sirf check, file nahi badlegi)
 *
 * Safe hai: pehle <file>.bak backup banta hai, aur dobara chalane par kuch nahi badalta.
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const NO_ROUND = args.includes("--no-round");
const given = args.find((a) => !a.startsWith("--"));

function findFile() {
  if (given) return given;
  const cands = ["src/Staff.jsx", "src/staff.jsx", "src/pages/Staff.jsx", "src/components/Staff.jsx"];
  for (const c of cands) if (fs.existsSync(c)) return c;
  // naam se nahi mili: src ke andar wo file dhundo jisme "function BillingView(" hai
  const hits = [];
  const walk = (dir) => {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".git" && e.name !== "dist") walk(p); }
      else if (/\.(jsx|js|tsx|ts)$/i.test(e.name)) {
        try { if (fs.readFileSync(p, "utf8").includes("function BillingView(")) hits.push(p); } catch (x) {}
      }
    }
  };
  walk(fs.existsSync("src") ? "src" : ".");
  if (hits.length === 1) { console.log("File mil gayi (code se): " + hits[0]); return hits[0]; }
  if (hits.length > 1) {
    console.error("X Kai files me BillingView mila, ek chuno aur path do:\n  " + hits.join("\n  "));
    process.exit(1);
  }
  return null;
}

const file = findFile();
if (!file || !fs.existsSync(file)) {
  console.error("X Koi file nahi mili jisme \"function BillingView(\" ho.\n  Pehle ye chalao:  grep -rl \"function BillingView\" . --include=*.jsx --include=*.js --exclude-dir=node_modules\n  Phir:  node patch-half-qty.cjs <wo path>");
  process.exit(1);
}

let src = fs.readFileSync(file, "utf8");
const crlf = src.includes("\r\n");
if (crlf) src = src.replace(/\r\n/g, "\n");
const original = src;

const results = [];
const note = (name, status) => { results.push([name, status]); };

// ---------------------------------------------------------------- 1. QtyInput component
const QTY_COMPONENT = `// [PATCH half-qty] qty input: local text, valid number (>0) par hi cart me commit
function QtyInput({ value, onCommit, style }) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(String(value)); }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      style={style}
      onFocus={(e) => { focused.current = true; e.target.select(); }}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        if (!/^\\d*\\.?\\d{0,2}$/.test(t)) return;
        setText(t);
        const n = parseFloat(t);
        if (!isNaN(n) && n > 0) onCommit(n);
      }}
      onBlur={() => {
        focused.current = false;
        const n = parseFloat(text);
        if (isNaN(n) || n <= 0) setText(String(value));
        else { onCommit(n); setText(String(n)); }
      }}
    />
  );
}

`;

if (src.includes("function QtyInput(")) {
  note("1. QtyInput component", "pehle se hai (skip)");
} else if (src.includes("function BillingView(")) {
  src = src.replace("function BillingView(", QTY_COMPONENT + "function BillingView(");
  note("1. QtyInput component", "add ho gaya");
} else {
  note("1. QtyInput component", "FAIL - 'function BillingView(' nahi mila");
}

// ---------------------------------------------------------------- 2. cart row input
const OLD_INPUT =
  '<input type="text" inputMode="decimal" value={q} onChange={(e) => setQty(id, e.target.value)} style={{ flex: 1, width: "100%", minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink, border: "none", background: "transparent", outline: "none", fontFamily: "monospace" }} />';
const NEW_INPUT =
  '<QtyInput value={q} onCommit={(n) => setQty(id, n)} style={{ flex: 1, width: "100%", minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 13, color: C.ink, border: "none", background: "transparent", outline: "none", fontFamily: "monospace" }} />';

if (src.includes("<QtyInput value={q}")) {
  note("2. cart row input", "pehle se badla hua hai (skip)");
} else if (src.includes(OLD_INPUT)) {
  src = src.replace(OLD_INPUT, NEW_INPUT);
  note("2. cart row input", "badal gaya");
} else {
  note("2. cart row input", "FAIL - purana input line match nahi hui (file me kuch badla hua hai?)");
}

// ---------------------------------------------------------------- 3. rounding (optional)
if (NO_ROUND) {
  note("3. total rounding", "skip (--no-round)");
} else {
  // 3a. cartSubtotal
  if (src.includes("const cartSubtotalRaw")) {
    note("3a. cartSubtotal round", "pehle se hai (skip)");
  } else {
    const re = /const cartSubtotal = cartItems\.reduce\([\s\S]*?\}, 0\);/;
    const m = src.match(re);
    if (m) {
      const replaced = m[0].replace("const cartSubtotal = cartItems.reduce(", "const cartSubtotalRaw = cartItems.reduce(") +
        "\n  const cartSubtotal = Math.round(cartSubtotalRaw);";
      src = src.replace(re, replaced);
      note("3a. cartSubtotal round", "ho gaya");
    } else {
      note("3a. cartSubtotal round", "FAIL - cartSubtotal block nahi mila");
    }
  }

  // 3b. applyCartChanges sub
  const OLD_SUB = "const sub = finalItems.reduce((s, it) => s + it.price * it.qty, 0);";
  const NEW_SUB = "const sub = Math.round(finalItems.reduce((s, it) => s + it.price * it.qty, 0));";
  if (src.includes(NEW_SUB)) note("3b. applyCartChanges sub", "pehle se hai (skip)");
  else if (src.includes(OLD_SUB)) { src = src.replace(OLD_SUB, NEW_SUB); note("3b. applyCartChanges sub", "ho gaya"); }
  else note("3b. applyCartChanges sub", "FAIL - line nahi mili");

  // 3c. addedTotal (Add Items / Add to Running - 2 jagah)
  const OLD_ADD = "const addedTotal = newItems.reduce((s, it) => s + it.price * it.qty, 0);";
  const NEW_ADD = "const addedTotal = Math.round(newItems.reduce((s, it) => s + it.price * it.qty, 0));";
  const cnt = src.split(OLD_ADD).length - 1;
  if (cnt > 0) { src = src.split(OLD_ADD).join(NEW_ADD); note("3c. addedTotal (x" + cnt + ")", "ho gaya"); }
  else if (src.includes(NEW_ADD)) note("3c. addedTotal", "pehle se hai (skip)");
  else note("3c. addedTotal", "FAIL - line nahi mili");
}

// ---------------------------------------------------------------- report + write
console.log("\nFile: " + file + (DRY ? "  [dry-run]" : ""));
results.forEach(([n, s]) => console.log("  " + (s.startsWith("FAIL") ? "X " : "ok ") + n + " -> " + s));

const failed = results.some(([, s]) => s.startsWith("FAIL"));
if (src === original) {
  console.log("\nKuch badalne ko nahi tha.");
  process.exit(failed ? 1 : 0);
}
if (DRY) { console.log("\nDry-run: file nahi badli."); process.exit(failed ? 1 : 0); }

fs.writeFileSync(file + ".bak", crlf ? original.replace(/\n/g, "\r\n") : original);
fs.writeFileSync(file, crlf ? src.replace(/\n/g, "\r\n") : src);
console.log("\nOK  patch lag gaya. Backup: " + file + ".bak");
console.log("    Check karo:  git diff --stat   |   npm run dev   (billing me 0.5 / 1.5 type karke dekho)");
if (failed) { console.log("!   Kuch edits fail hue (upar X dekho) - baaki lag gaye."); process.exit(1); }
