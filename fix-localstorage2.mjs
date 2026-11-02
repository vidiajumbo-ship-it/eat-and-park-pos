import fs from "fs";
const FILE = "src/StaffApp.jsx";
let src = fs.readFileSync(FILE, "utf8");
let changes = 0;

// Line 711 pattern: Number(localStorage.getItem("staff_estimate_persons")) || 2
const estPersons = /Number\(\s*localStorage\.getItem\(\s*["']staff_estimate_persons["']\s*\)\s*\)\s*\|\|\s*2/g;
if (estPersons.test(src)) {
  src = src.replace(estPersons, 'Number(safeStorageGet("staff_estimate_persons", "0")) || 2');
  changes++;
}

// Line 760 pattern: localStorage.getItem("staff_view_mode") || "auto"
const viewMode = /localStorage\.getItem\(\s*["']staff_view_mode["']\s*\)\s*\|\|\s*["']auto["']/g;
if (viewMode.test(src)) {
  src = src.replace(viewMode, 'safeStorageGet("staff_view_mode", "auto")');
  changes++;
}

// Line 2088 pattern: localStorage.getItem(`staff_draft_${table}`)
const draft = /localStorage\.getItem\(\s*`staff_draft_\$\{table\}`\s*\)/g;
if (draft.test(src)) {
  src = src.replace(draft, 'safeStorageGet(`staff_draft_${table}`)');
  changes++;
}

fs.writeFileSync(FILE, src);
console.log(`\nReplaced ${changes} additional localStorage calls.`);

const remaining = src.split("\n")
  .map((l, i) => ({ line: l, num: i + 1 }))
  .filter(x => x.line.includes("localStorage.getItem") && !x.line.includes("window.localStorage"));

console.log("\nRemaining unprotected localStorage.getItem (outside helper):");
if (remaining.length === 0) {
  console.log("  (none) — all fixed!");
} else {
  remaining.forEach(x => console.log(`  Line ${x.num}: ${x.line.trim()}`));
}
