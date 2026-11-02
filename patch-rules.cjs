// Usage (project root se):  node patch-rules.cjs
// Teen files patch hoti hain. Har file ka backup: <file>.pre-patch2
const fs = require("fs");

const files = {
  guards: "src/lib/guards.js",
  rules: "src/lib/orderRules.js",
  app: "src/StaffApp.jsx",
};

const edits = [
  // ---------- guards.js : purani order screen se overwrite roko ----------
  {
    file: "guards",
    name: "G1. orderSig helper add",
    find: `export function assertEditable(live, seen) {`,
    repl: `// Order ka chhota signature: items, qty, KOT ya total badle to alag aayega.
// (status change ya kitchen ka Start/Ready isse nahi badalta)
export const orderSig = (o) => [
  (o.items || []).length,
  (o.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0),
  (o.kots || []).length,
  Number(o.finalTotal) || 0,
].join("|");

export function assertEditable(live, seen) {`,
  },
  {
    file: "guards",
    name: "G2. assertEditable: stale check",
    find: `if (live.status === "cancelled") throw new Error("Order cancelled hai");`,
    repl: `if (live.status === "cancelled") throw new Error("Order cancelled hai");
  if (seen && orderSig(live) !== orderSig(seen)) throw new Error("Order kisi aur ne badal diya - wapas table kholo");`,
  },

  // ---------- orderRules.js : Active ka ek hi rule ----------
  {
    file: "rules",
    name: "R1. isActiveOrder me 18 ghante ki limit",
    find: `export const isActiveOrder = (o) => !isCancelled(o) && !o.paid && o.paymentStatus !== "due";`,
    repl: `export const isActiveOrder = (o) => !isCancelled(o) && !o.paid && o.paymentStatus !== "due" && Date.now() - (o.createdAt || 0) < OPEN_WINDOW_MS;`,
  },

  // ---------- StaffApp.jsx ----------
  {
    file: "app",
    name: "A1. Billing transaction me stale check pass karo",
    find: `assertEditable(osnap.exists() ? osnap.data() : null);`,
    repl: `assertEditable(osnap.exists() ? osnap.data() : null, existingOrder);`,
  },
  {
    file: "app",
    name: "A2. Tables ka Active bhi isActiveOrder se",
    find: `const activeOrders = orders.filter(o => (isOpenDineIn(o) || isOpenParcel(o)));`,
    repl: `const activeOrders = orders.filter(isActiveOrder);`,
  },
];

const cache = {};
const load = (key) => {
  if (cache[key]) return cache[key];
  const p = files[key];
  if (!fs.existsSync(p)) { cache[key] = { path: p, missing: true }; return cache[key]; }
  let src = fs.readFileSync(p, "utf8");
  const crlf = src.includes("\r\n");
  if (crlf) src = src.replace(/\r\n/g, "\n");
  cache[key] = { path: p, src, crlf, changed: false };
  return cache[key];
};

const report = [];
let applied = 0;
for (const e of edits) {
  const f = load(e.file);
  if (f.missing) { report.push("SKIP    " + e.name + "  (file nahi mili: " + f.path + ")"); continue; }
  const count = f.src.split(e.find).length - 1;
  if (count === 1) {
    f.src = f.src.replace(e.find, () => e.repl);
    f.changed = true;
    applied++;
    report.push("OK      " + e.name);
  } else if (count === 0) {
    report.push("SKIP    " + e.name + "  (nahi mila - shayad pehle hi apply ho chuka)");
  } else {
    report.push("SKIP    " + e.name + "  (" + count + " jagah mila - unsafe)");
  }
}

for (const key of Object.keys(cache)) {
  const f = cache[key];
  if (f.missing || !f.changed) continue;
  fs.copyFileSync(f.path, f.path + ".pre-patch2");
  fs.writeFileSync(f.path, f.crlf ? f.src.replace(/\n/g, "\r\n") : f.src, "utf8");
}

console.log(report.join("\n"));
console.log("\n" + applied + "/" + edits.length + " edits apply hue (backup: <file>.pre-patch2)");
