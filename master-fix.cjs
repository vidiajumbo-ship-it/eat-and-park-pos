const fs = require("fs");

// ==========================================
// 1. Fix ErrorBoundary in BOTH files
// ==========================================
function fixErrorBoundary(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  let src = fs.readFileSync(filePath, "utf8");
  
  if (src.includes("tryRecover(arguments[0])")) {
    src = src.replace(/tryRecover\(arguments\[0\]\);/g, "tryRecover(error);");
    console.log(`✅ Fixed ErrorBoundary in ${filePath}`);
  } else {
    console.log(`ℹ️  ErrorBoundary already fixed or not found in ${filePath}`);
  }
  
  fs.writeFileSync(filePath, src, "utf8");
}

// ==========================================
// 2. Fix Dark Mode CSS (Remove filter hack)
// ==========================================
function fixDarkMode() {
  const cssPath = "src/index.css";
  if (fs.existsSync(cssPath)) {
    let css = fs.readFileSync(cssPath, "utf8");
    if (css.includes("filter: invert")) {
      css = css.replace(/\.dark-theme\s*\{[^}]*filter:\s*invert[^}]*\}/g, "");
      fs.writeFileSync(cssPath, css, "utf8");
      console.log("✅ Removed filter hack from index.css");
    }
  }

  // Also check inside StaffApp.jsx FONTS string
  const staffPath = "src/StaffApp.jsx";
  if (fs.existsSync(staffPath)) {
    let src = fs.readFileSync(staffPath, "utf8");
    if (src.includes(".dark-theme { filter: invert")) {
      src = src.replace(/\.dark-theme\s*\{[^}]*filter:\s*invert[^}]*\}/g, "");
      fs.writeFileSync(staffPath, src, "utf8");
      console.log("✅ Removed filter hack from StaffApp.jsx");
    }
  }
}

// ==========================================
// 3. Fix Cloudinary Hardcoded name
// ==========================================
function fixCloudinary() {
  const appPath = "src/App.jsx";
  if (!fs.existsSync(appPath)) return;
  let src = fs.readFileSync(appPath, "utf8");
  if (src.includes('cloudName: "nnddxvcn"')) {
    src = src.replace(/cloudName:\s*"nnddxvcn"/g, 'cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "nnddxvcn"');
    fs.writeFileSync(appPath, src, "utf8");
    console.log("✅ Fixed Cloudinary hardcoded name in App.jsx");
  }
}

// ==========================================
// 4. Fix StaffApp.jsx handlePlaceOrder (Data Consistency)
// ==========================================
function fixStaffOrderLogic() {
  const staffPath = "src/StaffApp.jsx";
  if (!fs.existsSync(staffPath)) return;
  let src = fs.readFileSync(staffPath, "utf8");
  
  // Find the old handlePlaceOrder setDoc call and replace with runTransaction
  const oldBlock = `await setDoc(doc(db, "orders", orderId), order);
      if (setOrders) setOrders(prev => prev.some(x => x.id === order.id) ? prev : [...prev, order]);`;
  
  const newBlock = `await runTransaction(db, async (tx) => {
        const ref = doc(db, "orders", orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) {
          tx.set(ref, order);
        } else {
          throw new Error("Ye order pehle se hai, dobara create nahi hoga.");
        }
      });
      if (setOrders) setOrders(prev => prev.some(x => x.id === order.id) ? prev : [...prev, order]);`;

  if (src.includes(oldBlock)) {
    src = src.replace(oldBlock, newBlock);
    console.log("✅ Fixed order creation transaction in StaffApp.jsx");
  } else {
    console.log("ℹ️  Order creation logic already safe or not found.");
  }

  fs.writeFileSync(staffPath, src, "utf8");
}

// ==========================================
// RUN ALL FIXES
// ==========================================
console.log("⏳ Running Master Fix...\n");

fixErrorBoundary("src/App.jsx");
fixErrorBoundary("src/StaffApp.jsx");
fixDarkMode();
fixCloudinary();
fixStaffOrderLogic();

console.log("\n🎉 Master Fix Complete! Ab build chalayein: npm run build");
