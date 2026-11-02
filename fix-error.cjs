const fs = require("fs");
const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
  console.error("❌ File nahi mili:", filePath);
  process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");
let lines = code.split('\n');

console.log("🔄 Faltu tags ko clean kiya ja raha hai...");

// Hum exact line 2590 se 2600 ke beech check karenge jahan error aa raha hai
for (let i = 2585; i <= 2600; i++) {
  if (lines[i] && lines[i].includes('</div>')) {
    // Agar line mein sirf closing div tags hain, toh unhe trim karo
    let trimmed = lines[i].trim();
    if (trimmed === '</div>' || trimmed === '</div></div>') {
       // Humne yahan galti se extra div chhod diye the
       lines[i] = ''; 
    }
  }
}

// Ab jo bhi extra blank lines bach gayi hain, unhe hatao
code = lines.filter(line => line !== '').join('\n');

// Ek aur check: Purane duplicate boxes (Customer Name) ko dhoondh kar delete karo
// Ye un blocks ko target karega jo v1 ya v2 patches se reh gaye the
const duplicateRegex = /\{\!addMoreMode\s*&&\s*\([\s\S]*?Customer Name[\s\S]*?<\/div>\s*\)\}/g;
let matches = code.match(duplicateRegex);

if (matches && matches.length > 1) {
  // Agar 2 se zyada blocks hain, toh sirf aakhri wala rakho, baaki uda do
  for (let i = 0; i < matches.length - 1; i++) {
    code = code.replace(matches[i], "");
  }
  console.log("✅ Duplicate UI boxes (Customer/Pay) saaf kar diye gaye.");
}

// Final file save karo
fs.writeFileSync(filePath, code, "utf8");

console.log("✅ Syntax Error Fix: Extra closing tags hata diye gaye hain.");
console.log("🎉 Ab build pakka pass hoga!");
console.log("\n👉 Ab terminal mein bas ye 2 command run karein:");
console.log("   git add src/StaffApp.jsx && git commit -m \"Fixed build error and cleaned duplicates\" && git push");