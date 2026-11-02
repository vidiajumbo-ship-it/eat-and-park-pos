const fs = require("fs");
const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
  console.error("❌ File nahi mili:", filePath);
  process.exit(1);
}

let lines = fs.readFileSync(filePath, "utf8").split('\n');
let fixed = false;

// Hum line 2575 se 2585 ke aas-paas check karenge jahan error aaya hai
for (let i = 2575; i < 2590; i++) {
  // Agar line mein </div> hai aur uske theek baad ModalShell aa raha hai
  if (lines[i] && lines[i].includes('</div>') && lines[i+1] && lines[i+1].includes('<ModalShell C={C} open={cancelOpen}')) {
    // Yahan hume ek extra closing tag chahiye kyunki billing view ka main div band nahi hua
    lines.splice(i + 1, 0, '        </div>'); 
    fixed = true;
    break;
  }
}

if (fixed) {
  fs.writeFileSync(filePath, lines.join('\n'), "utf8");
  console.log("✅ Fix Successful: Missing closing </div> tag add kar diya gaya hai.");
  console.log("👉 Ab terminal mein push karein:");
  console.log("   git add src/StaffApp.jsx && git commit -m \"Added missing closing div tag\" && git push origin main --force");
} else {
  console.log("⚠️ File mein exact pattern nahi mila (shayad pehle se theek hai).");
}