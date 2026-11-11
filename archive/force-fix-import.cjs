const fs = require("fs");
const FILE = "src/DeliveryApp.jsx";
let t = fs.readFileSync(FILE, "utf8");

// 1. Correct the import line using Regex
// Ye dhoondhega: import React, { ... } from "react";
const importRegex = /import\s+React,\s*\{([^}]+)\}\s*from\s*["']react["'];?/;
const match = t.match(importRegex);

if (match) {
  let currentImports = match[1].split(",").map(s => s.trim());
  
  if (!currentImports.includes("useRef")) currentImports.push("useRef");
  if (!currentImports.includes("useMemo")) currentImports.push("useMemo");

  const newImportLine = `import React, { ${currentImports.join(", ")} } from "react";`;
  t = t.replace(importRegex, newImportLine);
  console.log("✅ React import fix ho gaya: " + newImportLine);
} else {
  console.log("❌ React import line nahi mili, manually check karo. File ke top pe 'import React...' hona chahiye.");
}

fs.copyFileSync(FILE, FILE + ".bak-import");
fs.writeFileSync(FILE, t, "utf8");