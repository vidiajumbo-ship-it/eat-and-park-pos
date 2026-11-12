// Chalane ke liye:  node --test src/lib/orderRules.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  isActiveOrder, isOpenDineIn, isOpenParcel, isDue, paidOrders, paidRevenue, buildPaidPatch, OPEN_WINDOW_MS,
} from "./orderRules.js";

const now = () => Date.now();
const mk = (o) => ({ orderType: "dine_in", status: "new", paid: false, createdAt: now(), finalTotal: 100, ...o });

test("unpaid order active hai", () => {
  assert.equal(isActiveOrder(mk({})), true);
});
test("served par bhi unpaid hai to active hai", () => {
  assert.equal(isActiveOrder(mk({ status: "served" })), true);
});
test("paid order active nahi, chahe status ready ho", () => {
  assert.equal(isActiveOrder(mk({ paid: true, status: "ready" })), false);
});
test("due order active nahi", () => {
  assert.equal(isActiveOrder(mk({ paymentStatus: "due" })), false);
});
test("cancelled order active nahi", () => {
  assert.equal(isActiveOrder(mk({ status: "cancelled" })), false);
});

test("chalu dine-in table occupied hai", () => {
  assert.equal(isOpenDineIn(mk({})), true);
});
test("paid dine-in table occupied nahi", () => {
  assert.equal(isOpenDineIn(mk({ paid: true })), false);
});
test("18 ghante se purana order table occupied nahi", () => {
  assert.equal(isOpenDineIn(mk({ createdAt: now() - OPEN_WINDOW_MS - 1000 })), false);
});
test("parcel dine-in nahi ginta, aur dine-in parcel nahi", () => {
  assert.equal(isOpenDineIn(mk({ orderType: "parcel" })), false);
  assert.equal(isOpenParcel(mk({ orderType: "dine_in" })), false);
  assert.equal(isOpenParcel(mk({ orderType: "parcel" })), true);
});
test(".filter(isOpenDineIn) index ki wajah se galat nahi hota", () => {
  const list = [mk({}), mk({}), mk({ paid: true })];
  assert.equal(list.filter(isOpenDineIn).length, 2);
});

test("isDue sirf unpaid due ko pakadta hai", () => {
  assert.equal(isDue(mk({ paymentStatus: "due" })), true);
  assert.equal(isDue(mk({ paymentStatus: "due", paid: true })), false);
});

test("revenue me sirf paid aur non-cancelled", () => {
  const list = [
    mk({ paid: true, finalTotal: 500 }),
    mk({ paid: true, finalTotal: 300, status: "cancelled" }),
    mk({ paid: false, finalTotal: 900 }),
    mk({ paid: true, finalTotal: "200" }),
  ];
  assert.equal(paidOrders(list).length, 2);
  assert.equal(paidRevenue(list), 700);
});
test("finalTotal na ho to 0 maana jaye", () => {
  assert.equal(paidRevenue([mk({ paid: true, finalTotal: undefined })]), 0);
});

test("buildPaidPatch: sahi fields likhta hai", () => {
  const p = buildPaidPatch(mk({}), "upi", "Ramesh");
  assert.equal(p.paid, true);
  assert.equal(p.paymentStatus, "paid");
  assert.equal(p.payment, "upi");
  assert.equal(p.paidBy, "Ramesh");
  assert.equal(typeof p.paidAt, "number");
});
test("buildPaidPatch: naam na ho to Staff", () => {
  assert.equal(buildPaidPatch(mk({}), "cash").paidBy, "Staff");
});
test("buildPaidPatch: parcel paid hote hi served", () => {
  assert.equal(buildPaidPatch(mk({ orderType: "parcel", status: "new" }), "cash").status, "served");
});
test("buildPaidPatch: ready dine-in served ho jata hai", () => {
  assert.equal(buildPaidPatch(mk({ status: "ready" }), "cash").status, "served");
});
test("buildPaidPatch: preparing/new ka status nahi chhedta (kitchen se gayab na ho)", () => {
  assert.equal("status" in buildPaidPatch(mk({ status: "preparing" }), "cash"), false);
  assert.equal("status" in buildPaidPatch(mk({ status: "new" }), "cash"), false);
});
