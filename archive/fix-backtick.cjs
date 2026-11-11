const fs = require("fs");
const FILE = "src/App.jsx";
let t = fs.readFileSync(FILE, "utf8");

// Count before
const beforeBT = (t.match(/\\\`/g) || []).length;
const beforeDollar = (t.match(/\\\$\{/g) || []).length;
console.log("🔍 Fix karne se pehle: " + beforeBT + " backslash-backtick, " + beforeDollar + " backslash-dollar-brace mile.");

// 1. Replace \` (backslash+backtick) with ` (backtick only)
t = t.replace(/\\\`/g, "`");

// 2. Replace \${ (backslash+dollar+brace) with ${ (dollar+brace only)
t = t.replace(/\\\$\{/g, "${");

// Count after
const afterBT = (t.match(/\\\`/g) || []).length;
const afterDollar = (t.match(/\\\$\{/g) || []).length;

console.log("✅ Fix karne ke baad: " + afterBT + " backslash-backtick, " + afterDollar + " backslash-dollar-brace bache.");

if (beforeBT === 0 && beforeDollar === 0) {
  console.log("⚠️ Koi backslash escape nahi mila, file pehle se theek lag rahi hai.");
} else {
  fs.copyFileSync(FILE, FILE + ".bak-backtick");
  fs.writeFileSync(FILE, t, "utf8");
  console.log("✅ App.jsx me se saare extra backslash hata diye gaye!");
}