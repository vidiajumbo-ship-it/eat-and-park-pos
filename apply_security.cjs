// Usage:  node apply_security.cjs            (firestore.rules auto)
//         node apply_security.cjs path/to/firestore.rules
// Ye sirf firestore.rules ko badalta hai (3 chhoti edits). App ka code nahi chhedta.
// Kuch bhi match na hua to file ko haath nahi lagata.
const fs = require("fs");

const file = [process.argv[2], "firestore.rules"].filter(Boolean).find((f) => fs.existsSync(f));
if (!file) {
  console.error("firestore.rules nahi mila. Path do: node apply_security.cjs path/to/firestore.rules");
  process.exit(1);
}

let src = fs.readFileSync(file, "utf8");
const original = src;
let failed = false;

const edit = (name, find, replace, doneIf) => {
  if (src.includes(doneIf)) return console.log("SKIP (pehle se hai):", name);
  const isRe = find instanceof RegExp;
  const n = isRe ? (src.match(new RegExp(find.source, "g")) || []).length : src.split(find).length - 1;
  if (n !== 1) {
    console.error("FAIL:", name, "- match " + n + " mile (1 chahiye)");
    failed = true;
    return;
  }
  src = src.replace(find, () => replace);
  console.log("OK  :", name);
};

edit(
  "1. Band kiya hua (active:false) staff ab rules me bhi band",
  "return signedIn() && exists(/databases/$(db)/documents/staff/$(request.auth.uid));",
  "return signedIn() && exists(/databases/$(db)/documents/staff/$(request.auth.uid))\n" +
    "        && get(/databases/$(db)/documents/staff/$(request.auth.uid)).data.get('active', true) != false;",
  ".data.get('active', true) != false"
);

edit(
  "2. Waiter guard functions (staffEditOk / staffCreateOk)",
  "    function validCustomerOrder() {",
  "    // Waiter/staff (admin/owner/manager nahi) ke liye: console se bhi ye 3 cheezein nahi ho sakti\n" +
    "    //  - paid order ko unpaid karna (Undo Paid sirf owner)\n" +
    "    //  - cancelled order ko wapas chalu karna (Restore sirf owner)\n" +
    "    //  - discount % badhana (discount sirf owner)\n" +
    "    function staffEditOk() {\n" +
    "      let before = resource.data;\n" +
    "      let after = request.resource.data;\n" +
    "      return !(before.get('paid', false) == true && after.get('paid', false) != true)\n" +
    "        && !(before.get('status', '') == 'cancelled' && after.get('status', '') != 'cancelled')\n" +
    "        && after.get('billDiscountPct', 0) <= before.get('billDiscountPct', 0);\n" +
    "    }\n" +
    "    function staffCreateOk() {\n" +
    "      return request.resource.data.get('billDiscountPct', 0) == 0;\n" +
    "    }\n" +
    "    function validCustomerOrder() {",
  "function staffEditOk()"
);

edit(
  "3a. Order create: waiter discount ke saath order nahi bana sakta",
  "&& (isStaff() || validCustomerOrder());",
  "&& ((isStaff() && (isAdmin() || staffCreateOk())) || validCustomerOrder());",
  "(isStaff() && (isAdmin() || staffCreateOk()))"
);

edit(
  "3b. Order update: waiter par staffEditOk guard",
  /allow update: if isStaff\(\)\s*\|\| \(signedIn\(\) && resource\.data\.createdBy == request\.auth\.uid/,
  "allow update: if (isStaff() && (isAdmin() || staffEditOk()))\n        || (signedIn() && resource.data.createdBy == request.auth.uid",
  "(isStaff() && (isAdmin() || staffEditOk()))"
);

if (!failed) {
  const count = (s, ch) => s.split(ch).length - 1;
  [["{", "}"], ["(", ")"], ["[", "]"]].forEach(([a, b]) => {
    if (count(src, a) !== count(src, b)) {
      console.error("FAIL: bracket balance bigda: " + a + " = " + count(src, a) + ", " + b + " = " + count(src, b));
      failed = true;
    }
  });
}

if (failed) {
  console.error("\nKuch fail hua, isliye firestore.rules ko haath NAHI lagaya. Upar wali FAIL lines mujhe bhejo.");
  process.exit(1);
}
if (src === original) {
  console.log("\nKuch badalna nahi tha (sab pehle se laga hai).");
  process.exit(0);
}
fs.writeFileSync(file + ".bak_sec", original);
fs.writeFileSync(file, src);
console.log("\nDone: " + file + "  (backup: " + file + ".bak_sec)");
console.log("Ab deploy karo:  npx firebase-tools deploy --only firestore:rules");
