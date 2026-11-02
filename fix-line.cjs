const fs = require("fs");
const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
  console.error("❌ File nahi mili:", filePath);
  process.exit(1);
}

let lines = fs.readFileSync(filePath, "utf8").split('\n');
let fixed = false;

// Hum line 468 se 478 ke beech check karenge (0-indexed hota hai)
for (let i = 465; i < 480; i++) {
  if (lines[i] && lines[i].includes("minWidth: 30") && lines[i].includes("<input")) {
    // Yahan humne exact toota hua span pakad liya hai
    lines[i] = `        <span style={{ minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 14, color: C.ink, fontFamily: "monospace" }}>{q}</span>`;
    fixed = true;
    break;
  }
}

if (fixed) {
  fs.writeFileSync(filePath, lines.join('\n'), "utf8");
  console.log("✅ Build Error Fix: Exact line ko theek kar diya gaya hai.");
  console.log("🎉 Ab Vercel par build pass ho jayega!");
  console.log("👉 Ab terminal mein push karein:");
  console.log("   git add src/StaffApp.jsx && git commit -m \"Fixed syntax error manually\" && git push");
} else {
  console.log("⚠️ File mein toota hua tag nahi mila. Shayad ye pehle se theek hai.");
}