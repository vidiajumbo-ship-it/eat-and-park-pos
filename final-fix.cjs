const fs = require("fs");
let file = "src/StaffApp.jsx";
let code = fs.readFileSync(file, "utf8");

// Ye exact line aapki file (line 4747 ke aas-paas) mein hai
// Isme type="number" ko type="text" karna hai

if (code.includes('type="number"')) {
    // Input field jo qty handle karta hai (width: 32 wala)
    code = code.replace(
        /(<input[^>]*?defaultValue=\{it\.qty\}[\s\S]*?)type="number"/g, 
        '$1type="text" inputMode="decimal"'
    );
    
    // width badhao
    code = code.replace(/width: 32,\s*height: 30/g, 'width: 44, height: 30');
    
    fs.writeFileSync(file, code, "utf8");
    console.log("✅ QTY INPUT FIXED! Ab '1.5' type ho payega.");
} else {
    console.log("✅ Pehle se fix hai.");
}
