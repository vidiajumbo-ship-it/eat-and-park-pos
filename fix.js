const fs = require("fs");
const path = "src/App.js"; // <-- apni file ka path yahan likho

let s = fs.readFileSync(path, "utf8");
const before = s.length;

// 1) Merge hash wali saari lines delete
s = s.replace(/^.*c59ac2fe05533bcd14d01af2ee227a4555f0119c.*\r?\n/gm, "");

// 2) handleSetQty ka adhura duplicate block delete
s = s.replace(
  /(\}, \[menu\]\);)\r?\n    const prevCart = cartRef\.current;[\s\S]*?\}, \[menu\]\);\r?\n/,
  "$1\n"
);

// 3) handleEmailLogin function delete
s = s.replace(/  const handleEmailLogin = async[\s\S]*?\r?\n  \};\r?\n/, "");

// 4) firebase/auth import delete
s = s.replace(/import \{ getAuth, signInWithEmailAndPassword \} from "firebase\/auth";\r?\n/, "");

// 5) duplicate unsubOrders/unsubOpen delete
s = s.replace(
  /unsubOrders\(\); unsubOpen\(\); *\r?\n\s*\r?\n\s*unsubOrders\(\); unsubOpen\(\); */,
  "unsubOrders(); unsubOpen();"
);

fs.writeFileSync(path, s);
console.log("Done. Removed", before - s.length, "characters");
