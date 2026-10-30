import { readFileSync } from "node:fs";
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
