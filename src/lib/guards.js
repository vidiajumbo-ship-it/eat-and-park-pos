export function assertEditable(live, seen) {
  if (!live) throw new Error("Order ab maujood nahi hai");
  if (live.paid) throw new Error("Order paid ho chuka hai - edit nahi ho sakta");
  if (live.status === "cancelled") throw new Error("Order cancelled hai");
  if (JSON.stringify(live.items || []) !== JSON.stringify(seen.items || []))
    throw new Error("Order kisi aur ne badal diya - screen band karke dobara kholo");
}

export const resolveVendorId = (name, map) =>
  map[String(name || "").trim().toLowerCase()] || null;
