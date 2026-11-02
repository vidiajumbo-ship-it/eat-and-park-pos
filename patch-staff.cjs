// Usage:  node patch-staff.js src/Staff.jsx
// (path na do to ./src/Staff.jsx ya ./Staff.jsx dhundhega). Backup: <file>.bak
const fs = require("fs");

const target = process.argv[2] || ["src/Staff.jsx", "Staff.jsx"].find((p) => fs.existsSync(p));
if (!target || !fs.existsSync(target)) {
  console.error("Staff.jsx nahi mila. Aise chalao: node patch-staff.js path/to/Staff.jsx");
  process.exit(1);
}

let src = fs.readFileSync(target, "utf8");
const crlf = src.includes("\r\n");
if (crlf) src = src.replace(/\r\n/g, "\n");

const edits = [
  {
    name: "1a. Dashboard: cancelled orders list se hatao",
    find: `const recentOrders = [...filtered].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);`,
    repl: `const recentOrders = [...filtered].filter(o => o.status !== "cancelled").sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);`,
  },
  {
    name: "1b. Dashboard: hourly chart me cancelled ginti nahi",
    find: `filtered.forEach(o => { hourCounts[new Date(o.createdAt).getHours()]++; });`,
    repl: `filtered.forEach(o => { if (o.status !== "cancelled") hourCounts[new Date(o.createdAt).getHours()]++; });`,
  },
  {
    name: "2. Orders: markPaidWith poora rollback",
    find: `setOrders(prev => prev.map(o => o.id === order.id ? { ...o, paid: false, paymentStatus: "pending" } : o));`,
    repl: `setOrders(prev => prev.map(o => o.id === order.id ? order : o));`,
  },
  {
    name: "3. printHtml default CSS (Day Close slip styling)",
    find: `const css = opts.css || "@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:290px;margin:0 auto;padding:10px;font-weight:700}";`,
    repl: `const css = opts.css || "@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:290px;margin:0 auto;padding:10px;font-weight:700}h2{text-align:center;font-size:22px;margin:4px 0}.c{text-align:center;font-size:11px}.line{border-top:2px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:3px 2px}";`,
  },
  {
    name: "4. Reports Day Close: fresh data se calculate",
    find: `const s = stats;\n    const cashExp = expenses.filter((e) => (e.mode || "cash") === "cash")`,
    repl: `let s = stats, freshExp = expenses;
    try {
      const [fo, fe] = await Promise.all([loadOrdersRange(todayKey, todayKey), loadExpensesRange(todayKey, todayKey)]);
      s = calcStats(fo, fe); freshExp = fe;
    } catch (e) { toast("Fresh data load nahi hua, Day Close roka gaya: " + e.message, "error"); return; }
    const cashExp = freshExp.filter((e) => (e.mode || "cash") === "cash")`,
  },
  {
    name: "5. Same table par duplicate order block",
    find: `if (busy && !window.confirm("Table " + table + " par order chalu hai. Phir bhi naya banayein?")) return;`,
    repl: `if (busy) { toast("Table " + table + " par order chalu hai - 'Add to Running' use karo", "warning"); return; }`,
  },
  {
    name: "6. Sidebar me Bookings",
    find: `{ id: "stock", label: "Stock", icon: "📦" },`,
    repl: `{ id: "stock", label: "Stock", icon: "📦" }, { id: "bookings", label: "Bookings", icon: "📅" },`,
  },
  {
    name: "7. Move Table: transaction + paid/occupied check",
    find: `await updateDoc(doc(db, "orders", order.id), { table: to, movedFrom: order.table, movedAt: Date.now() });`,
    repl: `if (allOrders.some((o) => o.id !== order.id && isOpenDineIn(o) && Number(o.table) === Number(to))) throw new Error("Table " + to + " ab khali nahi hai");
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "orders", order.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error("Order ab maujood nahi hai");
        const d = snap.data();
        if (d.paid || d.status === "cancelled") throw new Error("Paid/cancelled order move nahi ho sakta");
        tx.update(ref, { table: to, movedFrom: order.table, movedAt: Date.now() });
      });`,
  },
  {
    name: "8a. Billing menu: available undefined ko bhi dikhao",
    find: `menu.filter(m => m.available && (category === "All"`,
    repl: `menu.filter(m => m.available !== false && (category === "All"`,
  },
  {
    name: "8b. Billing favourites: available undefined ko bhi dikhao",
    find: `menu.filter((m) => m.available && (cnt[m.id] ||`,
    repl: `menu.filter((m) => m.available !== false && (cnt[m.id] ||`,
  },
];

let applied = 0;
const report = [];
for (const e of edits) {
  const count = src.split(e.find).length - 1;
  if (count === 1) {
    src = src.replace(e.find, () => e.repl);
    applied++;
    report.push("OK      " + e.name);
  } else if (count === 0) {
    report.push("SKIP    " + e.name + "  (nahi mila - shayad pehle hi apply ho chuka / code alag hai)");
  } else {
    report.push("SKIP    " + e.name + "  (" + count + " jagah mila - unsafe, chhod diya)");
  }
}

if (applied > 0) {
  fs.copyFileSync(target, target + ".bak");
  fs.writeFileSync(target, crlf ? src.replace(/\n/g, "\r\n") : src, "utf8");
}
console.log(report.join("\n"));
console.log("\n" + applied + "/" + edits.length + " edits apply hue" + (applied ? " | backup: " + target + ".bak" : ""));
