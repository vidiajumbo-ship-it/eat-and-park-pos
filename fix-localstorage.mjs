import fs from "fs";
const FILE = "src/StaffApp.jsx";
let src = fs.readFileSync(FILE, "utf8");
let changes = 0;

const darkOld = /localStorage\.getItem\(\s*["']staff_dark["']\s*\)\s*===\s*["']1["']/g;
if (darkOld.test(src)) { src = src.replace(darkOld, 'safeStorageGet("staff_dark", "0") === "1"'); changes++; }

const langOld = /localStorage\.getItem\(\s*["']staff_lang["']\s*\)\s*\|\|\s*["']en["']/g;
if (langOld.test(src)) { src = src.replace(langOld, 'safeStorageGet("staff_lang", "en")'); changes++; }

const muteOld = /localStorage\.getItem\(\s*["']staff_mute["']\s*\)\s*===\s*["']1["']/g;
if (muteOld.test(src)) { src = src.replace(muteOld, 'safeStorageGet("staff_mute", "0") === "1"'); changes++; }

fs.writeFileSync(FILE, src);
console.log(`Replaced ${changes} localStorage initializers.`);

const remaining = src.split("\n")
  .map((l, i) => ({ line: l, num: i + 1 }))
  .filter(x => x.line.includes("localStorage.getItem"));
console.log("\nRemaining localStorage.getItem usages:");
if (remaining.length === 0) { console.log("  (none)"); }
else { remaining.forEach(x => console.log(`  Line ${x.num}: ${x.line.trim()}`)); }
