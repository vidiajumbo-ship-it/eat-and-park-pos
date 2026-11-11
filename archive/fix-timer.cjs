const fs = require("fs");
const FILE = "src/App.jsx";
let t = fs.readFileSync(FILE, "utf8");

let changed = false;

// 1. Add servedAt and status to props
const p1 = 'const OrderTimer = memo(({ createdAt, estimatedTime }) => {';
const r1 = 'const OrderTimer = memo(({ createdAt, servedAt, status, estimatedTime }) => {';
if (t.includes(p1)) { t = t.replace(p1, r1); changed = true; }

// 2. Replace the useEffect to stop timer if served
const p2 = 'useEffect(() => { const t = setInterval(() => setElapsed(Math.floor((Date.now() - createdAt) / 1000)), 1000); return () => clearInterval(t); }, [createdAt]);';
const r2 = `useEffect(() => {
    if (status === 'served' || status === 'delivered' || status === 'completed') {
      if (servedAt) setElapsed(Math.floor((servedAt - createdAt) / 1000));
      return;
    }
    if (status === 'cancelled') return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - createdAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [createdAt, servedAt, status]);`;
if (t.includes(p2)) { t = t.replace(p2, r2); changed = true; }

// 3. Fix the isOvertime logic (so it doesn't turn red after delivery)
const p3 = 'const isOvertime = elapsed > (estimatedTime * 60);';
const r3 = "const isOvertime = elapsed > (estimatedTime * 60) && status !== 'served' && status !== 'delivered' && status !== 'completed';";
if (t.includes(p3)) { t = t.replace(p3, r3); changed = true; }

if (changed) {
  fs.copyFileSync(FILE, FILE + ".bak-timer");
  fs.writeFileSync(FILE, t, "utf8");
  console.log("✅ Timer fix ho gaya! Ab deliver hote hi timer ruk jayega.");
} else {
  console.log("⚠️ Timer code match nahi hua. Shayad pehle se fix hai.");
}