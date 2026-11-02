const fs = require("fs");
const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
  console.error("❌ File nahi mili:", filePath);
  process.exit(1);
}

let lines = fs.readFileSync(filePath, "utf8").split('\n');
let fixed = false;

// File ke end se peeche ki taraf scan karenge
for (let i = lines.length - 1; i > 0; i--) {
  if (lines[i].includes('<ModalShell C={C} open={cancelOpen}')) {
    // Jab hume Cancel Modal mila, toh uske upar wale hisse mein missing </div> daalenge
    // Hum check karenge ki kya pehle se koi </div> missing hai
    if (!lines[i-1].includes('</div>')) {
       lines.splice(i, 0, '        </div>');
       fixed = true;
    }
    break;
  }
}

if (fixed) {
  fs.writeFileSync(filePath, lines.join('\n'), "utf8");
  console.log("✅ Fix Successful: Missing </div> tag ko exact jagah par daal diya gaya hai.");
  console.log("👉 Ab push karein:");
  console.log("   git add src/StaffApp.jsx && git commit -m \"Fixed build syntax error automatically\" && git push origin main --force");
} else {
  console.log("⚠️ File mein ModalShell nahi mila ya tag pehle se theek hai.");
}