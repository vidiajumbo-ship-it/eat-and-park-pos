// Order ka chhota signature: items, qty, KOT ya total badle to alag aayega.
// (status change ya kitchen ka Start/Ready isse nahi badalta)
export const orderSig = (o) => [
  (o.items || []).length,
  (o.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0),
  (o.kots || []).length,
  Number(o.finalTotal) || 0,
].join("|");

export function assertEditable(live, seen) {
  if (!live) throw new Error("Order ab maujood nahi hai");
  if (live.paid) throw new Error("Order paid ho chuka hai - edit nahi ho sakta");
  if (live.status === "cancelled") throw new Error("Order cancelled hai");
  if (seen && orderSig(live) !== orderSig(seen)) throw new Error("Order kisi aur ne badal diya - wapas table kholo");
}

export const resolveVendorId = (name, map) =>
  map[String(name || "").trim().toLowerCase()] || null;
