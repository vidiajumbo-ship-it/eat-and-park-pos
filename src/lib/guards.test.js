import { describe, test, expect } from "vitest";
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
