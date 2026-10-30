#!/usr/bin/env python3
"""
Eat & Park — Unified Sync Fix
Dono apps (staff.jsx + customer.jsx) pe ek saath apply hota hai.
Usage:
    python3 sync_fix.py staff.jsx customer.jsx
Agar file names alag hain toh args mein do.
"""
import sys, os, re, shutil, datetime

def backup(path):
    if os.path.exists(path):
        bak = path + ".bak." + datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        shutil.copy2(path, bak)
        print(f"  💾 Backup: {bak}")

def replace_once(text, old, new, label):
    if old not in text:
        print(f"  ⚠️  SKIP (not found): {label}")
        return text
    print(f"  ✅ Applied: {label}")
    return text.replace(old, new, 1)

def replace_all(text, old, new, label):
    if old not in text:
        print(f"  ⚠️  SKIP (not found): {label}")
        return text
    count = text.count(old)
    print(f"  ✅ Applied: {label}  (x{count})")
    return text.replace(old, new)

# ─────────────────────────────────────────────────────────────
# STAFF APP FIXES
# ─────────────────────────────────────────────────────────────
def fix_staff(src):
    print("\n🔧 STAFF APP PATCHES")

    # 1.1 — auditLog → auditLogs
    src = replace_all(src, 'collection(db, "auditLog")',
                      'collection(db, "auditLogs")',
                      "auditLog → auditLogs (collection name)")

    # 1.2 — isOpenDineIn / isOpenParcel paid_unverified
    old_parcel = '''const isOpenParcel = (o) =>
  o.orderType === "parcel" && o.status !== "cancelled" && !o.paid && o.paymentStatus !== "due" &&
  Date.now() - (o.createdAt || 0) < 18 * 3600 * 1000;'''
    new_parcel = '''const PAID_STATUSES = ["paid", "paid_unverified"];
const isOpenParcel = (o) =>
  o.orderType === "parcel" && o.status !== "cancelled" && !o.paid &&
  o.paymentStatus !== "due" && !PAID_STATUSES.includes(o.paymentStatus) &&
  Date.now() - (o.createdAt || 0) < 18 * 3600 * 1000;'''
    src = replace_once(src, old_parcel, new_parcel, "isOpenParcel paid_unverified fix")

    old_dine = '''const isOpenDineIn = (o) =>
  o.orderType === "dine_in" && o.status !== "cancelled" && !o.paid && o.paymentStatus !== "due" &&
  Date.now() - (o.createdAt || 0) < 18 * 3600 * 1000;'''
    new_dine = '''const isOpenDineIn = (o) =>
  o.orderType === "dine_in" && o.status !== "cancelled" && !o.paid &&
  o.paymentStatus !== "due" && !PAID_STATUSES.includes(o.paymentStatus) &&
  Date.now() - (o.createdAt || 0) < 18 * 3600 * 1000;'''
    src = replace_once(src, old_dine, new_dine, "isOpenDineIn paid_unverified fix")

    # 1.6 — uid stronger
    old_uid = 'const uid = (p) => p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);'
    new_uid = 'const uid = (p) => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);'
    src = replace_once(src, old_uid, new_uid, "uid stronger (staff)")

    # 1.5 — menu auto-seed warning
    old_menu = '''const unsubMenu = onSnapshot(doc(db, "settings", "menu"), (snap) => {
  if (snap.exists() && Array.isArray(snap.data().items)) setMenu(snap.data().items);
}, (err) => { console.error("menu listener:", err); });'''
    new_menu = '''const unsubMenu = onSnapshot(doc(db, "settings", "menu"), (snap) => {
  if (snap.exists() && Array.isArray(snap.data().items) && snap.data().items.length > 0) {
    setMenu(snap.data().items);
  } else {
    console.warn("⚠️ Menu khali hai. Customer app se pehli baar khulne pe seed hoga.");
    setMenu([]);
  }
}, (err) => { console.error("menu listener:", err); });'''
    src = replace_once(src, old_menu, new_menu, "menu auto-seed handling")

    # 1.3 — calls listener: insert after lowCount state
    anchor_calls = 'const [lowCount, setLowCount] = useState(0);'
    calls_block = anchor_calls + '''
  // 🔔 Waiter calls listener (unified patch)
  const [calls, setCalls] = useState([]);
  const [bookings, setBookings] = useState([]);
  const prevCallsRef = useRef(0);
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, "calls"), where("status", "==", "active")),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCalls(list);
        if (list.length > prevCallsRef.current) {
          try { new Audio("https://assets.mixkit.co/active-storage/sfx/951/951-preview.mp3").play().catch(() => {}); } catch (e) {}
        }
        prevCallsRef.current = list.length;
      },
      () => {}
    );
    return () => unsub();
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "bookings"),
      (snap) => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => unsub();
  }, [user]);
  const resolveCall = async (id) => {
    try { await updateDoc(doc(db, "calls", id), { status: "resolved", resolvedAt: Date.now() }); }
    catch (e) { setCalls(prev => prev.filter(c => c.id !== id)); }
  };'''
    src = replace_once(src, anchor_calls, calls_block, "calls + bookings listeners + resolveCall")

    # 1.4 — bookings tab in tabs array
    tab_anchor = '{ id: "expenses", label: "💸 Kharcha" },'
    if tab_anchor in src:
        src = replace_once(src, tab_anchor,
            tab_anchor + '\n            { id: "bookings", label: "📅 Bookings" },',
            "Bookings tab added to tabs array")
    else:
        print("  ⚠️  SKIP: expenses tab anchor not found (manual add needed)")

    return src

# ─────────────────────────────────────────────────────────────
# CUSTOMER APP FIXES
# ─────────────────────────────────────────────────────────────
def fix_customer(src):
    print("\n🔧 CUSTOMER APP PATCHES")

    # 2.4 — uid stronger
    old_uid = 'function uid(prefix) { return prefix + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8); }'
    new_uid = 'function uid(prefix) { return prefix + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6); }'
    src = replace_once(src, old_uid, new_uid, "uid stronger (customer)")

    # 2.1 — Razorpay paid:true
    old_paid = 'status: "new", paid: false,'
    new_paid = 'status: "new", paid: (paymentInfo.status === "paid" || paymentInfo.status === "paid_unverified"),'
    src = replace_once(src, old_paid, new_paid, "Razorpay success = paid:true")

    # 2.2 — remove inventory tab from AdminView tabs
    old_tabs = '["overview", "menu", "tables", "presets", "gallery", "settings", "offers", "loyalty", "inventory", "orders", "bookings", "promotions"]'
    new_tabs = '["overview", "menu", "tables", "presets", "gallery", "settings", "offers", "loyalty", "orders", "bookings", "promotions"]'
    src = replace_once(src, old_tabs, new_tabs, "inventory tab removed from tabs array")

    # inventory block: remove {tab === "inventory" && (...)} — regex approach
    # Match from '{tab === "inventory" &&' up to matching close of that JSX block.
    # Safer: look for the marker lines and cut until the closing ')}' at same depth.
    pattern = re.compile(r'\{\s*tab\s*===\s*"inventory"\s*&&\s*\(', re.M)
    m = pattern.search(src)
    if m:
        start = m.start()
        # find matching parens
        depth = 0
        i = m.end() - 1  # points at '('
        # walk back to the '(' of the arrow
        # Actually walk from m.start() to find '(' of && then balance
        j = m.end() - 1
        depth = 1
        k = j + 1
        while k < len(src) and depth > 0:
            c = src[k]
            if c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
            k += 1
        # k now past the ')' — expect '}'
        while k < len(src) and src[k] in ' \n\t':
            k += 1
        if k < len(src) and src[k] == '}':
            k += 1
        removed = src[start:k]
        src = src[:start] + src[k:]
        print(f"  ✅ Removed inventory tab block ({len(removed)} chars)")
    else:
        print("  ⚠️  SKIP: inventory tab block not found (already removed?)")

    return src

# ─────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 3:
        print("Usage: python3 sync_fix.py <staff_file> <customer_file>")
        sys.exit(1)

    staff_path, customer_path = sys.argv[1], sys.argv[2]

    print("📦 BACKUPS")
    backup(staff_path)
    backup(customer_path)

    print("\n📖 READING FILES")
    with open(staff_path, 'r', encoding='utf-8') as f:
        staff_src = f.read()
    with open(customer_path, 'r', encoding='utf-8') as f:
        cust_src = f.read()

    staff_new = fix_staff(staff_src)
    cust_new = fix_customer(cust_src)

    print("\n💾 WRITING FILES")
    with open(staff_path, 'w', encoding='utf-8') as f:
        f.write(staff_new)
    with open(customer_path, 'w', encoding='utf-8') as f:
        f.write(cust_new)
    print(f"  ✅ {staff_path} updated")
    print(f"  ✅ {customer_path} updated")

    print("\n" + "="*60)
    print("⚠️  MANUAL STEPS (script can't do these):")
    print("="*60)
    print("""
1. Bookings tab JSX block ko render area mein add karo
   ({activeTab === "bookings" && ...} — patch doc mein poora block hai)

2. Calls banner JSX render section mein add karo
   (calls.length > 0 && <div>...</div> — patch doc mein hai)

3. Firestore Rules paste karo (Firebase Console)
   → Firestore → Rules → paste → Publish

4. Build & deploy:
   npm run build
   firebase deploy --only hosting:staff
   firebase deploy --only hosting
""")

if __name__ == "__main__":
    main()