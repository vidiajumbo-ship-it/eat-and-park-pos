const fs = require("fs");
const filePath = "src/StaffApp.jsx";
let src = fs.readFileSync(filePath, "utf8");

// SMART_AI_STEPS ka pehla aur dusra position dhoondo
const firstIndex = src.indexOf("const SMART_AI_STEPS = [");
const secondIndex = src.indexOf("const SMART_AI_STEPS = [", firstIndex + 1);

if (secondIndex !== -1) {
    console.log("⚠️ Duplicate SMART_AI_STEPS mila! Delete kar rahe hain...");
    // Dusre (duplicate) block ka end dhoondo (jo agle function se pehle khatam hota hai)
    const endOfSecondBlock = src.indexOf("function EstimatePanel(", secondIndex);
    if (endOfSecondBlock !== -1) {
        src = src.slice(0, secondIndex) + src.slice(endOfSecondBlock);
        console.log("✅ Duplicate code delete ho gaya!");
    }
} else {
    console.log("✅ Koi duplicate nahi mila (par error kahi aur ho sakta hai).");
}

fs.writeFileSync(filePath, src, "utf8");
console.log("Ab file check karo.");
