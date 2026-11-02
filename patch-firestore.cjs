// Usage (project root se):
//   node patch-firestore.cjs            -> sirf 2 zaroori fix (auditLogs + feedback)
//   node patch-firestore.cjs --harden   -> upar wale 2 + orders update ki security tight
// Backup: firestore.rules.pre-patch
const fs = require("fs");

const file = process.argv.find((a) => a.endsWith(".rules")) || "firestore.rules";
const harden = process.argv.includes("--harden");

if (!fs.existsSync(file)) {
  console.error("firestore.rules nahi mili. Aise chalao: node patch-firestore.cjs path/to/firestore.rules");
  process.exit(1);
}

let src = fs.readFileSync(file, "utf8");
const crlf = src.includes("\r\n");
if (crlf) src = src.replace(/\r\n/g, "\n");

const report = [];
let applied = 0;

function applyLiteral(name, find, repl) {
  const count = src.split(find).length - 1;
  if (count === 1) { src = src.replace(find, () => repl); applied++; report.push("OK      " + name); }
  else if (count === 0) report.push("SKIP    " + name + "  (nahi mila - shayad pehle hi apply ho chuka)");
  else report.push("SKIP    " + name + "  (" + count + " jagah mila - unsafe)");
}

function applyRegex(name, re, replFn) {
  const m = src.match(re);
  if (m) { src = src.replace(re, replFn); applied++; report.push("OK      " + name); }
  else report.push("SKIP    " + name + "  (pattern nahi mila)");
}

// 1) App "auditLogs" collection me likhta hai, rules me sirf "auditLog" tha -> sab write deny ho rahe the
if (/match \/auditLogs\/\{id\}/.test(src)) {
  report.push("SKIP    F1. auditLogs rule  (pehle se hai)");
} else {
  applyLiteral(
    "F1. auditLogs collection ka rule",
    `match /auditLog/{id} {`,
    `match /auditLogs/{id} {
      allow read: if isAdmin();
      allow create: if isStaff();
      allow update, delete: if false;
    }
    match /auditLog/{id} {`
  );
}

// 2) FeedbackModal "feedback" collection me likhta hai, rules me tha hi nahi
if (/match \/feedback\/\{id\}/.test(src)) {
  report.push("SKIP    F2. feedback rule  (pehle se hai)");
} else {
  applyLiteral(
    "F2. feedback collection ka rule",
    `match /day/{id} {`,
    `match /feedback/{id} {
      allow create: if signedIn();
      allow read: if isStaff();
      allow update, delete: if false;
    }
    match /day/{id} {`
  );
}

// 3) (optional) waiter ko owner-only kaam se rokna: cancel / undo paid / discount badalna / restore
if (harden) {
  applyRegex(
    "H1. orders update: waiter cancel/undo-paid/discount nahi kar sakta",
    /(allow read: if isStaff\(\) \|\| \(signedIn\(\) && resource\.data\.createdBy == request\.auth\.uid\);\s*)allow update: if isStaff\(\);/,
    (_, head) => head + `allow update: if isAdmin() || (isStaff()
        && resource.data.get('status', '') != 'cancelled'
        && (request.resource.data.get('status', '') != 'cancelled' || request.resource.data.get('cancelledBy', '') == 'merge')
        && !(resource.data.get('paid', false) == true && request.resource.data.get('paid', false) != true)
        && request.resource.data.get('billDiscountPct', 0) == resource.data.get('billDiscountPct', 0));`
  );
}

if (applied > 0) {
  fs.copyFileSync(file, file + ".pre-patch");
  fs.writeFileSync(file, crlf ? src.replace(/\n/g, "\r\n") : src, "utf8");
}
console.log(report.join("\n"));
console.log("\n" + applied + " edits apply hue" + (applied ? " | backup: " + file + ".pre-patch" : ""));
console.log(applied ? "\nAb deploy karo:  firebase deploy --only firestore:rules" : "");
