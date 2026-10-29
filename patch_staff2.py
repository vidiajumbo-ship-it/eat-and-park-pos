#!/usr/bin/env python3
# Usage: python3 patch_staff2.py src/StaffApp.jsx
# Due me naam + 10 digit phone zaroori, aur Due Ledger me purani "Unknown" entry badalne ka Edit button.

import sys, shutil, datetime

if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    src = f.read()

P = []

P.append(("Due banate waqt naam zaroori",
r'''if (dn === null) { setPlacing(false); return; }''',
r'''if (dn === null) { setPlacing(false); return; }
        if (!dn.trim()) { toast("Due ke liye naam likhna zaroori hai", "warning"); setPlacing(false); return; }'''))

P.append(("Due banate waqt 10 digit phone zaroori",
r'''const dp = window.prompt("Phone number?", "") || "";''',
r'''const dp = (window.prompt("Phone number? (10 digit)", "") || "").replace(/\D/g, "");
        if (dp.length < 10) { toast("Sahi 10 digit phone zaroori hai", "warning"); setPlacing(false); return; }'''))

P.append(("Due Ledger: editDue function",
r'''const settle = async (o, mode) => {''',
r'''const editDue = async (o) => {
    const n = window.prompt("Customer ka naam?", o.dueName && o.dueName !== "Unknown" ? o.dueName : "");
    if (n === null) return;
    if (!n.trim()) { toast("Naam zaroori hai", "warning"); return; }
    const p = (window.prompt("Phone (10 digit)?", o.duePhone || "") || "").replace(/\D/g, "");
    if (p.length < 10) { toast("Sahi 10 digit phone zaroori hai", "warning"); return; }
    try {
      await updateDoc(doc(db, "orders", o.id), { dueName: n.trim(), duePhone: p });
      logAudit("due_edited", { orderId: o.id, total: o.finalTotal || 0 });
      toast("Due update ho gaya", "success");
    } catch (e) { toast(e.message, "error"); }
  };
  const settle = async (o, mode) => {'''))

P.append(("Due Ledger: Edit button (WA se pehle)",
r'''<button onClick={() => whatsappBill(o)} style={{ padding: "8px 10px"''',
r'''<button onClick={() => editDue(o)} style={{ padding: "8px 10px", border: `1.5px solid ${C.gray}`, borderRadius: 6, background: "transparent", color: C.gray, fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
            <button onClick={() => whatsappBill(o)} style={{ padding: "8px 10px"'''))

P.append(("Audit log label: due_edited",
r'''paid: "Paid", tables_merged: "Tables Merged"''',
r'''paid: "Paid", due_edited: "Due Edited", tables_merged: "Tables Merged"'''))

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
    bak = path + ".bak2-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copyfile(path, bak)
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)
    print("\nBackup:", bak)

print("\nLaga: %d  |  Skip: %d" % (applied, skipped))
print("Ab chalao: npm run build")
