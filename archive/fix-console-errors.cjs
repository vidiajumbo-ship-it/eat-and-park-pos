const fs = require("fs");

// ==========================================
// 1. FIX DELIVERYAPP.JSX (Import useRef & useMemo)
// ==========================================
const D_FILE = "src/DeliveryApp.jsx";
if (fs.existsSync(D_FILE)) {
  let t = fs.readFileSync(D_FILE, "utf8");
  
  // Exact string match for original import
  const oldImport = 'import React, { useState, useEffect } from "react";';
  const newImport = 'import React, { useState, useEffect, useRef, useMemo } from "react";';
  
  if (t.includes(oldImport)) {
    t = t.replace(oldImport, newImport);
    fs.writeFileSync(D_FILE, t, "utf8");
    console.log("✅ DeliveryApp.jsx me useRef aur useMemo import ho gaya!");
  } else {
    // Agar pehle se kisi aur tarah ka import hai, toh usko dhoondh kar fix karo
    if (t.includes("useRef")) {
       console.log("⚠️ DeliveryApp.jsx me pehle se useRef import hai, par check karo.");
    } else {
       // Fallback replacement
       t = t.replace('import React, {', 'import React, { useRef, useMemo,');
       fs.writeFileSync(D_FILE, t, "utf8");
       console.log("✅ DeliveryApp.jsx me fallback method se import fix kiya!");
    }
  }
}

// ==========================================
// 2. FIX INDEX.HTML (PWA Script Error)
// ==========================================
const HTML_FILE = "index.html";
if (fs.existsSync(HTML_FILE)) {
  let html = fs.readFileSync(HTML_FILE, "utf8");

  // Remove the broken script
  html = html.replace(/<!-- PWA Dynamic Manifest Setup -->[\s\S]*?<\/script>/, "");

  // Add the safe version of the script right before </head>
  const safeScript = `
    <!-- PWA Dynamic Manifest Setup -->
    <link id="app-manifest" rel="manifest" href="/manifest.json">
    <script>
      window.addEventListener('DOMContentLoaded', function() {
        var path = window.location.pathname;
        var manifestUrl = "/manifest.json";
        
        if (path.startsWith("/staff")) {
          manifestUrl = "/staff-manifest.json";
          document.title = "Eat & Park Staff";
        } else if (path.startsWith("/delivery")) {
          manifestUrl = "/delivery-manifest.json";
          document.title = "Eat & Park Delivery";
        } else {
          document.title = "Eat & Park";
        }
        
        var link = document.getElementById("app-manifest");
        if (link) {
          link.setAttribute("href", manifestUrl);
        }
      });
    </script>
  `;

  html = html.replace("</head>", safeScript + "\n</head>");
  fs.writeFileSync(HTML_FILE, html);
  console.log("✅ index.html me PWA script safely update ho gaya (null error fix)!");
}