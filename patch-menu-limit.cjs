const fs = require("fs");
const path = require("path");

const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
  console.error("❌ File nahi mili:", filePath);
  process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");
let edits = 0;

// ---------------------------------------------------------
// FIX 1: Menu Listener Limit (Crash fix)
// ---------------------------------------------------------
const menuListenerOld = `const unsubMenu = onSnapshot(doc(db, "settings", "menu"), (snap) => {
  if (snap.exists() && Array.isArray(snap.data().items) && snap.data().items.length > 0) {
    setMenu(snap.data().items);
  } else {
    console.warn("⚠️ Menu khali hai. Customer app se pehli baar khulne pe seed hoga.");
    setMenu([]);
  }
}, (err) => { console.error("menu listener:", err); });`;

const menuListenerNew = `const unsubMenu = onSnapshot(doc(db, "settings", "menu"), (snap) => {
  if (snap.exists() && Array.isArray(snap.data().items) && snap.data().items.length > 0) {
    // 🚀 FIX: 3900 items se crash hone se bachane ke liye sirf 150 items load karo
    setMenu(snap.data().items.slice(0, 150));
  } else {
    console.warn("⚠️ Menu khali hai. Customer app se pehli baar khulne pe seed hoga.");
    setMenu([]);
  }
}, (err) => { console.error("menu listener:", err); });`;

if (code.includes(menuListenerOld)) {
  code = code.replace(menuListenerOld, menuListenerNew);
  edits++;
  console.log("✅ Fix 1 apply hua: Menu Listener par 150 items ki limit lag gayi.");
} else {
  console.log("⚠️ Fix 1 SKIP: Listener code bilkul match nahi hua. File manual check karein.");
}

// ---------------------------------------------------------
// FIX 2: Filtered Items Limit (Render freeze fix)
// ---------------------------------------------------------
const filterOld = `const filtered = useMemo(() => menu.filter(m => m.available !== false && (category === "All" || m.category === category) && (!debouncedSearch.trim() || (m.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || String(m.category || "").toLowerCase().includes(debouncedSearch.toLowerCase())))), [menu, category, debouncedSearch]);`;

const filterNew = `const filtered = useMemo(() => menu.filter(m => m.available !== false && (category === "All" || m.category === category) && (!debouncedSearch.trim() || (m.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || String(m.category || "").toLowerCase().includes(debouncedSearch.toLowerCase())))).slice(0, 150), [menu, category, debouncedSearch]);`;

if (code.includes(filterOld)) {
  code = code.replace(filterOld, filterNew);
  edits++;
  console.log("✅ Fix 2 apply hua: Screen render par bhi 150 items ki limit lag gayi.");
} else {
  console.log("⚠️ Fix 2 SKIP: Filter code match nahi hua. File manual check karein.");
}

// ---------------------------------------------------------
// FIX 3: Estimate List Limit (Agar wahan bhi crash ho raha ho)
// ---------------------------------------------------------
const estFilterOld = `    return menu.filter((m) =>
      m.available !== false &&
      (catFilter === "All" || m.category === catFilter) &&
      (!s || String(m.name || "").toLowerCase().includes(s))
    ).slice(0, 250);`;

const estFilterNew = `    return menu.filter((m) =>
      m.available !== false &&
      (catFilter === "All" || m.category === catFilter) &&
      (!s || String(m.name || "").toLowerCase().includes(s))
    ).slice(0, 150);`;

if (code.includes(estFilterOld)) {
  code = code.replace(estFilterOld, estFilterNew);
  edits++;
  console.log("✅ Fix 3 apply hua: Estimate panel par bhi limit lag gayi.");
}

// Save file
if (edits > 0) {
  fs.writeFileSync(filePath, code, "utf8");
  console.log(`\n🎉 Total ${edits} fixes apply ho gaye! Ab app run karo, menu load ho jayega.`);
} else {
  console.log("\n❌ Koi bhi fix apply nahi hua. Code me kuch aur changes hain shayad.");
}