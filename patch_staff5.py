#!/usr/bin/env python3
"""
patch_staff5.py - Eat & Park Staff POS: audit fixes in ONE patch.

Run from the repo root (the folder that has package.json):
  python3 patch_staff5.py --dry-run     # checks every anchor, writes NOTHING
  python3 patch_staff5.py               # applies (all-or-nothing, makes a .bak)

What it does NOT do: deploy, push, install packages, or touch your live
firestore.rules. The proposed rules go to firestore.rules.proposed only.
"""
import sys, os, re, json, time, shutil

DRY = "--dry-run" in sys.argv
APP = "src/StaffApp.jsx"

# ---------------------------------------------------------------------------
# PATCHES: (name, kind, old, new, marker)
#   kind "str" = exact text must occur exactly once
#   kind "re"  = regex (DOTALL) must match exactly once
#   marker     = text that only exists after patching (so re-runs are safe)
# ---------------------------------------------------------------------------
PATCHES = []
def P(name, kind, old, new, marker):
    PATCHES.append((name, kind, old, new, marker))

# 0. helper import
P("import guards", "str",
  r'''import { db, auth } from "./firebase";''',
  r'''import { db, auth } from "./firebase";
import { assertEditable, resolveVendorId } from "./lib/guards";''',
  'from "./lib/guards"')

# H1 + H2: bill edit is transactional and refuses paid/cancelled/changed orders
P("H1/H2 applyCartChanges transaction", "str",
  r'''await updateDoc(doc(db, "orders", existingOrder.id), { items: finalItems, subtotal: sub, billDiscountPct: discount, billDiscount: d, gstRate, gstAmount: g, finalTotal, payment: payMode, billEditedAt: Date.now(), ...extra });''',
  r'''await runTransaction(db, async (tx) => {
      const oref = doc(db, "orders", existingOrder.id);
      const osnap = await tx.get(oref);
      assertEditable(osnap.exists() ? osnap.data() : null, existingOrder);
      tx.update(oref, { items: finalItems, subtotal: sub, billDiscountPct: discount, billDiscount: d, gstRate, gstAmount: g, finalTotal, payment: payMode, billEditedAt: Date.now(), ...extra });
    });''',
  "assertEditable(osnap")

P("H2 handleSaveBill paid guard", "str",
  r'''const handleSaveBill = async () => {''',
  r'''const handleSaveBill = async () => {
    if (existingOrder && existingOrder.paid) { toast("Order paid ho chuka hai - edit nahi ho sakta", "warning"); return; }''',
  "edit nahi ho sakta\", \"warning\"); return; }")

P("H2 disable Save button when paid", "str",
  r'''<button onClick={handleSaveBill} disabled={placing}''',
  r'''<button onClick={handleSaveBill} disabled={placing || !!existingOrder.paid}''',
  "disabled={placing || !!existingOrder.paid}")

P("H2 disable mobile Save Bill when paid", "str",
  r'''<button onClick={existingOrder ? handleSaveBill : handlePlaceOrder} disabled={placing}''',
  r'''<button onClick={existingOrder ? handleSaveBill : handlePlaceOrder} disabled={placing || !!(existingOrder && existingOrder.paid)}''',
  "disabled={placing || !!(existingOrder && existingOrder.paid)}")

# H1: add-more uses live totals inside a transaction
P("H1 add-more (handlePlaceOrder)", "str",
  r'''await updateDoc(doc(db, "orders", base.id), { kots: [...baseKots, runKot], items: [...(base.items || []), ...newItems], status: "new", finalTotal: (Number(base.finalTotal) || 0) + addedTotal, subtotal: (Number(base.subtotal) || 0) + addedTotal, paid: false, paymentStatus: "pending", lastKotAt: Date.now() });''',
  r'''await runTransaction(db, async (tx) => {
          const oref = doc(db, "orders", base.id);
          const osnap = await tx.get(oref);
          if (!osnap.exists()) throw new Error("Order ab maujood nahi hai");
          const live = osnap.data();
          if (live.paid) throw new Error("Order paid ho chuka hai - items add nahi ho sakte");
          if (live.status === "cancelled") throw new Error("Order cancelled hai");
          const liveKots = live.kots && live.kots.length ? live.kots : baseKots;
          tx.update(oref, { kots: [...liveKots, runKot], items: [...(live.items || []), ...newItems], status: "new", finalTotal: (Number(live.finalTotal) || 0) + addedTotal, subtotal: (Number(live.subtotal) || 0) + addedTotal, paid: false, paymentStatus: "pending", lastKotAt: Date.now() });
        });''',
  "items add nahi ho sakte")

P("H1 add-more (addRunningItems)", "str",
  r'''await updateDoc(doc(db, "orders", orderId), { kots: [...baseKots, runKot], items: [...(baseOrder.items || []), ...newItems], status: "new", finalTotal: (Number(baseOrder.finalTotal) || 0) + addedTotal, subtotal: (Number(baseOrder.subtotal) || 0) + addedTotal, paid: false, paymentStatus: "pending", lastKotAt: Date.now() });''',
  r'''await runTransaction(db, async (tx) => { // live-total txn (running)
        const oref = doc(db, "orders", orderId);
        const osnap = await tx.get(oref);
        if (!osnap.exists()) throw new Error("Order ab maujood nahi hai");
        const live = osnap.data();
        if (live.paid) throw new Error("Order paid ho chuka hai - items add nahi ho sakte");
        if (live.status === "cancelled") throw new Error("Order cancelled hai");
        const liveKots = live.kots && live.kots.length ? live.kots : baseKots;
        tx.update(oref, { kots: [...liveKots, runKot], items: [...(live.items || []), ...newItems], status: "new", finalTotal: (Number(live.finalTotal) || 0) + addedTotal, subtotal: (Number(live.subtotal) || 0) + addedTotal, paid: false, paymentStatus: "pending", lastKotAt: Date.now() });
      });''',
  "// live-total txn (running)")

# H3: inventory entry is not wiped by remote item-list changes
P("H3 inventory dirty refs", "str",
  r'''const [dirty, setDirty] = useState(false);''',
  r'''const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const loadedDateRef = useRef(null);
  dirtyRef.current = dirty;''',
  "const loadedDateRef = useRef(null);")

P("H3 inventory effect guard", "str",
  r'''if (!ready) return;''',
  r'''if (!ready) return;
    if (dirtyRef.current && loadedDateRef.current === date) return; // unsaved typing: do not reload
    loadedDateRef.current = date;''',
  "unsaved typing: do not reload")

# H6: bulk import vendor handling
P("H6 editField recomputes vendor match", "str",
  r'''const upd = { ...p, [field]: value };''',
  r'''const upd = { ...p, [field]: value };
      if (field === "vendorName") { const mv = existingVendors.find((v) => v.name.trim().toLowerCase() === String(value).trim().toLowerCase()); upd._existingVendorId = mv ? mv.id : ""; }''',
  "upd._existingVendorId = mv ?")

P("H6 fresh vendor list at import time", "str",
  r'''existingVendors.forEach((v) => { nameToId[v.name.toLowerCase()] = v.id; });''',
  r'''const freshVendors = await getDocs(collection(db, "vendors"));
      freshVendors.docs.forEach((d) => { nameToId[String(d.data().name || "").trim().toLowerCase()] = d.id; });''',
  "const freshVendors = await getDocs")

P("H6 dedupe new vendors case-insensitively", "str",
  r'''parsed.filter((p) => !p._skip && p._valid && !p._existingVendorId).forEach((p) => newVendorNames.add(p.vendorName));''',
  r'''const seenNew = new Set();
      parsed.filter((p) => !p._skip && p._valid).forEach((p) => { const k = p.vendorName.trim().toLowerCase(); if (!nameToId[k] && !seenNew.has(k)) { seenNew.add(k); newVendorNames.add(p.vendorName.trim()); } });''',
  "const seenNew = new Set();")

P("H6 resolve vendor by (edited) name", "str",
  r'''const vId = p._existingVendorId || nameToId[p.vendorName.toLowerCase()] || null;''',
  r'''const vId = resolveVendorId(p.vendorName, nameToId);''',
  "resolveVendorId(p.vendorName, nameToId)")

# Medium: double-tap on Paid
P("M double-tap guard on Paid", "str",
  r'''const handlePaidPrint = async () => {''',
  r'''const handlePaidPrint = async () => {
    if (existingOrder && !addMoreMode && !placing) { if (lockRef.current) return; lockRef.current = true; }''',
  "if (existingOrder && !addMoreMode && !placing) { if (lockRef.current) return;")

# Medium: Day Close must not silently ignore a failed vendor-payments read
P("M closeDay no longer swallows error", "re",
  r'''\} catch \(e\) \{\}\s*const opening = Number\(op\) \|\| 0;''',
  '''} catch (e) { toast("Vendor payments load nahi hue, Day Close roka gaya: " + e.message, "error"); return; }
    const opening = Number(op) || 0;''',
  "Day Close roka gaya")

# Medium: vendor delete cannot erase an outstanding balance
P("M vendor delete -> soft delete, only if due is 0", "str",
  r'''await deleteDoc(doc(db, "vendors", v.id));''',
  r'''if (Math.abs(Number(v.due) || 0) > 0) { toast("Pehle due clear karo (baaki " + inr(v.due) + ")", "warning"); return; }
      await updateDoc(doc(db, "vendors", v.id), { active: false, deletedAt: Date.now() });''',
  "Pehle due clear karo")

P("M hide soft-deleted vendors", "str",
  r'''setVendors(dues);''',
  r'''setVendors(dues.filter((x) => x.active !== false));''',
  "dues.filter((x) => x.active !== false)")

# ---------------------------------------------------------------------------
# NEW FILES (never overwritten if they already exist)
# ---------------------------------------------------------------------------
GUARDS = r'''export function assertEditable(live, seen) {
  if (!live) throw new Error("Order ab maujood nahi hai");
  if (live.paid) throw new Error("Order paid ho chuka hai - edit nahi ho sakta");
  if (live.status === "cancelled") throw new Error("Order cancelled hai");
  if (JSON.stringify(live.items || []) !== JSON.stringify(seen.items || []))
    throw new Error("Order kisi aur ne badal diya - screen band karke dobara kholo");
}

export const resolveVendorId = (name, map) =>
  map[String(name || "").trim().toLowerCase()] || null;
'''

GUARDS_TEST = r'''import { describe, test, expect } from "vitest";
import { assertEditable, resolveVendorId } from "./guards";

describe("assertEditable", () => {
  test("rejects missing order", () => expect(() => assertEditable(null, { items: [] })).toThrow(/maujood/));
  test("rejects paid", () => expect(() => assertEditable({ paid: true, items: [] }, { items: [] })).toThrow(/paid/));
  test("rejects cancelled", () => expect(() => assertEditable({ status: "cancelled", items: [] }, { items: [] })).toThrow(/cancelled/));
  test("rejects items changed elsewhere", () =>
    expect(() => assertEditable({ items: [{ itemId: "a", qty: 2 }] }, { items: [{ itemId: "a", qty: 1 }] })).toThrow(/badal/));
  test("allows unchanged open order", () =>
    expect(() => assertEditable({ items: [{ itemId: "a", qty: 1 }] }, { items: [{ itemId: "a", qty: 1 }] })).not.toThrow());
});

describe("resolveVendorId", () => {
  test("case + whitespace insensitive", () => expect(resolveVendorId("  Ramesh ", { ramesh: "v1" })).toBe("v1"));
  test("unknown vendor -> null", () => expect(resolveVendorId("Suresh", { ramesh: "v1" })).toBeNull());
  test("empty name -> null", () => expect(resolveVendorId("", { ramesh: "v1" })).toBeNull());
});
'''

RULES_PROPOSED = r'''rules_version = '2';
// PROPOSED - not deployed. Diff against the rules in your Firebase console first.
service cloud.firestore {
  match /databases/{db}/documents {

    function signedIn() {
      return request.auth != null;
    }
    function hasStaffDoc() {
      return signedIn() && exists(/databases/$(db)/documents/staff/$(request.auth.uid));
    }
    function role() {
      return get(/databases/$(db)/documents/staff/$(request.auth.uid)).data.role;
    }
    function isStaff() {
      return hasStaffDoc() && role() in ['admin', 'owner', 'manager', 'staff', 'waiter'];
    }
    // mirrors the app's isOwner (owner / admin / manager)
    function isAdmin() {
      return hasStaffDoc() && role() in ['admin', 'owner', 'manager'];
    }

    match /staff/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow write: if false;
    }

    // C1: wildcard no longer overlaps privatePins (rules are additive)
    match /settings/{docId} {
      allow read: if docId != 'privatePins';
      allow write: if isStaff() && docId != 'privatePins';
    }
    match /settings/privatePins {
      allow read, write: if isAdmin();
    }

    // C2 (partial): paid orders are locked for non-admins except status changes
    match /orders/{id} {
      allow create: if signedIn() && request.resource.data.createdBy == request.auth.uid;
      allow read: if isStaff() || (signedIn() && resource.data.createdBy == request.auth.uid);
      allow update: if isStaff() && (
        resource.data.paid != true
        || isAdmin()
        || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'lastKotAt'])
      );
      allow delete: if isAdmin();
    }

    // --- unchanged (customer app) ---
    match /customers/{phone} {
      allow read, write: if signedIn();
    }
    match /loyaltyUsers/{phone} {
      allow get: if signedIn();
      allow list, write: if isStaff();
    }
    match /coinHistory/{id} {
      allow read: if signedIn();
      allow create: if isStaff();
      allow update, delete: if false;
    }
    match /calls/{id} {
      allow create: if signedIn();
      allow read, update: if isStaff();
      allow delete: if isAdmin();
    }
    match /bookings/{id} {
      allow create: if signedIn();
      allow read, update, delete: if isStaff();
    }
    match /chats/{orderId}/messages/{msgId} {
      allow read, write: if signedIn();
    }
    match /auditLogs/{id} {
      allow read: if isAdmin();
      allow create: if isStaff();
      allow update, delete: if false;
    }

    // H9: staff can read stock (low-stock badge), only admins write
    match /inventory/{id} {
      allow read: if isStaff();
      allow write: if isAdmin();
    }

    // H8: collections the staff app uses that had no rule
    match /auditLog/{id} {
      allow read: if isAdmin();
      allow create: if isStaff();
      allow update, delete: if false;
    }
    match /expenses/{id} {
      allow read, create: if isStaff();
      allow update, delete: if isAdmin();
    }
    match /vendors/{id} {
      allow read: if isStaff();
      allow write: if isAdmin();
    }
    match /vendorPayments/{id} {
      allow read, write: if isAdmin();
    }
    match /dayClose/{id} {
      allow read, write: if isAdmin();
    }
    match /feedback/{id} {
      allow create: if isStaff();
      allow read: if isAdmin();
      allow update, delete: if false;
    }
  }
}
'''

RULES_TEST = r'''import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, test } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, collection, getDocs } from "firebase/firestore";

let env;
const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-eatpark",
    firestore: { rules: readFileSync("firestore.rules.proposed", "utf8") },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "staff/w1"), { role: "waiter" });
    await setDoc(doc(db, "staff/a1"), { role: "admin" });
    await setDoc(doc(db, "staff/o1"), { role: "owner" });
    await setDoc(doc(db, "settings/privatePins"), { pin: "x" });
    await setDoc(doc(db, "settings/menu"), { items: [] });
    await setDoc(doc(db, "orders/paid1"), { paid: true, status: "served", finalTotal: 100, createdBy: "c1" });
    await setDoc(doc(db, "orders/open1"), { paid: false, status: "new", finalTotal: 100, createdBy: "c1" });
    await setDoc(doc(db, "expenses/e1"), { amount: 10, date: "2026-10-30" });
    await setDoc(doc(db, "inventory/items"), { list: [] });
  });
});
afterAll(async () => { await env.cleanup(); });

describe("settings", () => {
  test("anon cannot read privatePins", () => assertFails(getDoc(doc(anon(), "settings/privatePins"))));
  test("waiter cannot write privatePins", () => assertFails(setDoc(doc(as("w1"), "settings/privatePins"), { pin: "y" })));
  test("admin can read privatePins", () => assertSucceeds(getDoc(doc(as("a1"), "settings/privatePins"))));
  test("anon can still read menu", () => assertSucceeds(getDoc(doc(anon(), "settings/menu"))));
});

describe("orders", () => {
  test("waiter cannot change total on paid order", () => assertFails(updateDoc(doc(as("w1"), "orders/paid1"), { finalTotal: 1 })));
  test("waiter can change status on paid order", () => assertSucceeds(updateDoc(doc(as("w1"), "orders/paid1"), { status: "served" })));
  test("owner can undo paid", () => assertSucceeds(updateDoc(doc(as("o1"), "orders/paid1"), { paid: false })));
  test("waiter can mark open order paid", () => assertSucceeds(updateDoc(doc(as("w1"), "orders/open1"), { paid: true })));
  test("waiter cannot delete order", () => assertFails(deleteDoc(doc(as("w1"), "orders/open1"))));
  test("owner role passes isStaff (reads orders)", () => assertSucceeds(getDoc(doc(as("o1"), "orders/open1"))));
});

describe("other collections", () => {
  test("waiter can write auditLog", () => assertSucceeds(addDoc(collection(as("w1"), "auditLog"), { action: "x" })));
  test("waiter cannot read auditLog", () => assertFails(getDocs(collection(as("w1"), "auditLog"))));
  test("waiter can add expense", () => assertSucceeds(addDoc(collection(as("w1"), "expenses"), { amount: 5 })));
  test("waiter cannot delete expense", () => assertFails(deleteDoc(doc(as("w1"), "expenses/e1"))));
  test("waiter can read inventory", () => assertSucceeds(getDoc(doc(as("w1"), "inventory/items"))));
  test("waiter cannot write inventory", () => assertFails(setDoc(doc(as("w1"), "inventory/items"), { list: [] })));
  test("waiter cannot read dayClose", () => assertFails(getDoc(doc(as("w1"), "dayClose/2026-10-30"))));
  test("owner can write dayClose", () => assertSucceeds(setDoc(doc(as("o1"), "dayClose/2026-10-30"), { revenue: 1 })));
});
'''

EMULATOR_JSON = r'''{
  "emulators": { "firestore": { "port": 8080 }, "ui": { "enabled": false } }
}
'''

NEW_FILES = {
    "src/lib/guards.js": GUARDS,
    "src/lib/guards.test.js": GUARDS_TEST,
    "tests/rules.test.js": RULES_TEST,
    "firestore.rules.proposed": RULES_PROPOSED,
    "firebase.emulator.json": EMULATOR_JSON,
}

SCRIPTS = {
    "test": "vitest run src",
    "test:rules": "firebase emulators:exec --config firebase.emulator.json --project demo-eatpark --only firestore \"vitest run tests/rules\"",
}


def apply_patches(src):
    """Returns (new_src, report_lines, failed_count)."""
    report, failed = [], 0
    for name, kind, old, new, marker in PATCHES:
        if marker in src:
            report.append("  = already applied : " + name)
            continue
        if kind == "re":
            n = len(re.findall(old, src, flags=re.S))
        else:
            n = src.count(old)
        if n != 1:
            failed += 1
            report.append("  X anchor matches %d (need exactly 1): %s" % (n, name))
            continue
        if kind == "re":
            src = re.sub(old, lambda m: new, src, count=1, flags=re.S)
        else:
            src = src.replace(old, new, 1)
        report.append("  + will apply      : " + name)
    return src, report, failed


def main():
    if not os.path.exists(APP):
        sys.exit("Cannot find %s - run this from the repo root." % APP)
    with open(APP, encoding="utf-8", newline="") as f:
        original = f.read()

    new_src, report, failed = apply_patches(original)
    print("\n".join(report))
    if failed:
        print("\n%d anchor(s) did not match your file. NOTHING was written." % failed)
        print("Send me the lines above marked X (or your current StaffApp.jsx) and I will adjust.")
        sys.exit(1)
    if DRY:
        print("\nDry run OK - every anchor matched. Nothing written.")
        return

    stamp = time.strftime("%Y%m%d-%H%M%S")
    bak = APP + "." + stamp + ".bak"
    shutil.copy2(APP, bak)
    with open(APP, "w", encoding="utf-8", newline="") as f:
        f.write(new_src)
    print("\nPatched %s (backup: %s)" % (APP, bak))

    for path, text in NEW_FILES.items():
        if os.path.exists(path):
            print("  skip (exists): " + path)
            continue
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        print("  created      : " + path)

    if os.path.exists("package.json"):
        with open("package.json", encoding="utf-8") as f:
            pkg = json.load(f)
        pkg.setdefault("scripts", {})
        added = [k for k in SCRIPTS if k not in pkg["scripts"]]
        for k in added:
            pkg["scripts"][k] = SCRIPTS[k]
        if added:
            with open("package.json", "w", encoding="utf-8") as f:
                json.dump(pkg, f, indent=2, ensure_ascii=False)
                f.write("\n")
        print("  package.json scripts added: " + (", ".join(added) or "none"))

    print("""
NEXT (run these yourself, in order):
  npm i -D vitest @firebase/rules-unit-testing firebase-tools
  npm run build
  npx oxlint src
  npm test
  npm run test:rules        # needs Java for the Firestore emulator
Nothing has been deployed. firestore.rules.proposed is NOT live.
To undo: git checkout src/StaffApp.jsx   (or copy the .bak back)""")


if __name__ == "__main__":
    main()
