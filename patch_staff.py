#!/usr/bin/env python3
# Usage:
#   python3 patch_staff.py src/StaffApp.jsx              -> bug fixes + features
#   python3 patch_staff.py src/StaffApp.jsx --owner-lock -> + sirf role owner/admin/manager ko owner powers
#
# Har patch ek exact line dhoondhta hai. Mila to lagata hai, nahi mila to SKIP bolta hai
# (kuch todta nahi). Backup file ke saath ban jata hai: StaffApp.jsx.bak-<time>

import sys, shutil, datetime

if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)

path = sys.argv[1]
owner_lock = "--owner-lock" in sys.argv

with open(path, encoding="utf-8") as f:
    src = f.read()

P = []  # (name, old, new)

# ---------------- BUG FIXES ----------------
P.append(("Dashboard date UTC bug (raat 5:30 se pehle kal ki date aati thi)",
r'''const todayStr = new Date().toISOString().slice(0, 10);''',
r'''const todayStr = invDateKey();'''))

P.append(("Merge modal: item na mile to button atak jata tha",
r'''if (!other) return;''',
r'''if (!other) { setBusy(false); return; }'''))

P.append(("Merge ka audit log",
r'''toast("Merged successfully", "success");''',
r'''logAudit("tables_merged", { orderId: primaryOrder.id, table: primaryOrder.table, merged: other.table, total: primaryOrder.finalTotal || 0 }); toast("Merged successfully", "success");'''))

P.append(("Kitchen me purane (18 ghante+) atke orders nahi dikhenge",
r'''const kotOrders = orders.filter(o => o.status === "new" || o.status === "preparing");''',
r'''const kotOrders = orders.filter(o => (o.status === "new" || o.status === "preparing") && Date.now() - (o.createdAt || 0) < 18 * 3600 * 1000);'''))

P.append(("Billing se Paid karne par paidBy + payment mode save",
r'''const paidPatch = { paid: true, paymentStatus: "paid", paidAt: Date.now() };''',
r'''const paidPatch = { paid: true, paymentStatus: "paid", paidAt: Date.now(), paidBy: waiterName || "Staff", payment: payMode };'''))

P.append(("Billing paid ka audit log",
r'''toast("Payment received! Bill printing", "success");''',
r'''logAudit("paid", { orderId: existingOrder.id, total: applied.finalTotal, mode: payMode }); toast("Payment received! Bill printing", "success");'''))

P.append(("Orders tab paid ka audit log",
r'''toast("Payment received!", "success");''',
r'''logAudit("paid", { orderId: order.id, total: order.finalTotal || 0, mode }); toast("Payment received!", "success");'''))

P.append(("Dashboard: cancelled orders Orders count se bahar",
r'''const todayTotal = filtered.length;''',
r'''const todayTotal = filtered.filter(o => o.status !== "cancelled").length;'''))

P.append(("Dashboard: cancelled+paid Paid count se bahar",
r'''const paidCount = filtered.filter(o => o.paid).length;''',
r'''const paidCount = filtered.filter(o => o.paid && o.status !== "cancelled").length;'''))

# ---------------- SPEED ----------------
P.append(("Hourly chart: ek baar me gino (pehle 576 baar filter hota tha)",
r'''const recentOrders = [...filtered].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);''',
r'''const recentOrders = [...filtered].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
  const hourCounts = Array.from({ length: 24 }, () => 0);
  filtered.forEach(o => { hourCounts[new Date(o.createdAt).getHours()]++; });'''))

P.append(("Hourly chart maxCount",
r'''const maxCount = Math.max(1, ...Array.from({ length: 24 }, (_, hh) => filtered.filter(o => new Date(o.createdAt).getHours() === hh).length));''',
r'''const maxCount = Math.max(1, ...hourCounts);'''))

P.append(("Hourly chart count",
r'''const count = filtered.filter(o => new Date(o.createdAt).getHours() === h).length;''',
r'''const count = hourCounts[h];'''))

# ---------------- NAYE FEATURES ----------------
P.append(("Audit: bill se item hatane ka record (fraud rokne ke liye)",
r'''const removedItems = existing.filter(it => !cart[it.itemId] || cart[it.itemId] <= 0);''',
r'''const removedItems = existing.filter(it => !cart[it.itemId] || cart[it.itemId] <= 0);
    if (removedItems.length) logAudit("items_removed", { orderId: existingOrder.id, table: existingOrder.table || "", items: removedItems.map(i => i.qty + "x " + i.name).join(", ") });'''))

P.append(("Audit log: naye action ke naam",
r'''due_created: "Due Created", cancel_order: "Cancel" }''',
r'''due_created: "Due Created", cancel_order: "Cancel", paid: "Paid", tables_merged: "Tables Merged", items_removed: "Items Removed", order_deleted: "Deleted", menu_item_added: "Menu Item Added" }'''))

P.append(("Audit log: items / payment mode dikhana",
r'''{l.wasPaid ? " - was PAID" : ""}''',
r'''{l.wasPaid ? " - was PAID" : ""}
                    {l.mode ? " - " + String(l.mode).toUpperCase() : ""}
                    {l.items ? " - " + l.items : ""}'''))

P.append(("Sound mute: state",
r'''const [confetti, setConfetti] = useState(false);''',
r'''const [confetti, setConfetti] = useState(false);
  const [muted, setMuted] = useState(() => localStorage.getItem("staff_mute") === "1");'''))

P.append(("Sound mute: playSound check",
r'''const playSound = () => { try {''',
r'''const playSound = () => { if (localStorage.getItem("staff_mute") === "1") return; try {'''))

P.append(("Sound mute: top bar button",
r'''<button onClick={cycleViewMode}''',
r'''<button onClick={() => { const n = !muted; setMuted(n); localStorage.setItem("staff_mute", n ? "1" : "0"); }} title="Sound" style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: 38, height: 38, borderRadius: 8, fontSize: 16, cursor: "pointer" }}>{muted ? "🔇" : "🔔"}</button>
          <button onClick={cycleViewMode}'''))

# ---------------- OPTIONAL ----------------
if owner_lock:
    P.append(("OWNER LOCK: sirf role owner/admin/manager ko delete/undo/discount powers",
    r'''const isOwner = true;''',
    r'''const isOwner = ["owner", "admin", "manager"].includes(String(staffData?.role || "").toLowerCase());'''))

applied, skipped = 0, 0
for name, old, new in P:
    n = src.count(old)
    if n == 1:
        src = src.replace(old, new)
        applied += 1
        print("OK    ", name)
    elif n == 0 and new in src:
        print("PEHLE SE", name)
    else:
        skipped += 1
        print("SKIP  ", name, "(mila nahi)" if n == 0 else "(%d jagah mila)" % n)

if applied:
    bak = path + ".bak-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copyfile(path, bak)
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)
    print("\nBackup:", bak)

print("\nLaga: %d  |  Skip: %d" % (applied, skipped))
print("Ab chalao: npm run build   (error aaye to: cp <backup> %s)" % path)
