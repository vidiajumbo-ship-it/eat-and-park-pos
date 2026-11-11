const fs = require("fs");
const FILE = "src/App.jsx";
let t = fs.readFileSync(FILE, "utf8");

const edits = [
// 1) DOB error me asli wajah dikhao
{ find: String.raw`} catch (e) { setDobErr("Save nahi hua, dobara try karo"); }`,
  replace: String.raw`} catch (e) { console.error("DOB save:", e); setDobErr("Save nahi hua: " + (e.code || e.message)); }` },

// 2) parcel time helper
{ find: String.raw`function CustomerView(`,
  replace: String.raw`// 🛍️ Parcel timing: roz 11:00 AM - 10:00 PM (India time)
const PARCEL_OPEN = 11, PARCEL_CLOSE = 22;
const parcelOpenNow = () => {
  const ist = new Date(Date.now() + (new Date().getTimezoneOffset() + 330) * 60000);
  const h = ist.getHours() + ist.getMinutes() / 60;
  return h >= PARCEL_OPEN && h < PARCEL_CLOSE;
};
const PARCEL_MSG = "🛍️ Parcel order roz subah 11 baje se raat 10 baje tak hi liya jata hai. Abhi Dine-in order kar sakte ho.";

function CustomerView(` },

// 3) Parcel button: band samay select hi na ho
{ find: String.raw`<button onClick={() => setOrderType("parcel")}`,
  replace: String.raw`<button onClick={() => { if (!parcelOpenNow()) { showToast(PARCEL_MSG, 'warning'); return; } setOrderType("parcel"); }}` },

// 4) Order place hote waqt bhi check
{ find: String.raw`const _gone = cartItems.filter(([id]) => !menu.some((m) => m.id === id && m.available));`,
  replace: String.raw`if (orderType === "parcel" && !parcelOpenNow()) { showToast(PARCEL_MSG, 'error'); return; }
    const _gone = cartItems.filter(([id]) => !menu.some((m) => m.id === id && m.available));` },
];

if (t.includes("parcelOpenNow")) { console.log("⏭️  Patch pehle se laga hai."); process.exit(0); }
let bad = false;
for (const [i, e] of edits.entries()) {
  const n = t.split(e.find).length - 1;
  if (n !== 1) { console.error("❌ edit #" + (i + 1) + ": FIND " + n + " baar mila (1 chahiye). Kuch change nahi kiya.\n   " + e.find.slice(0, 80)); bad = true; }
}
if (bad) process.exit(1);
for (const e of edits) t = t.replace(e.find, () => e.replace);
fs.copyFileSync(FILE, FILE + ".bak-before-fix2");
fs.writeFileSync(FILE, t, "utf8");
console.log("✅ " + FILE + " patched (backup: " + FILE + ".bak-before-fix2)");
