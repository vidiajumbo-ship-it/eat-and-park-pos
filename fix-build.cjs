const fs = require("fs");
const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
  console.error("❌ File nahi mili:", filePath);
  process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");

// Line 471 wale exact broken span ko dhoondhna (chahe usme space kaisa bhi ho)
const brokenRegex = /<span[^>]*minWidth:\s*30[^>]*>\s*<input[^>]*value=\{q\}[^>]*\/>/g;

if (brokenRegex.test(code)) {
  code = code.replace(brokenRegex, (match) => {
    // Jo bhi span ki styling thi, usko preserve karke sirf input ko hata kar {q} wapas lagana
    return match.replace(/<input[^>]*value=\{q\}[^>]*\/>/, '{q}');
  });
  fs.writeFileSync(filePath, code, "utf8");
  console.log("✅ Build Error Fix: Estimate Panel ko repair kar diya gaya hai.");
  console.log("🎉 Ab Vercel par build pass ho jayega!");
  console.log("👉 Terminal mein ab ye run karein:");
  console.log("   git add src/StaffApp.jsx");
  console.log("   git commit -m \"Fixed broken tags in estimate panel\"");
  console.log("   git push");
} else {
  console.log("⚠️ Exact broken code nahi mila. Shayad already theek hai.");
}