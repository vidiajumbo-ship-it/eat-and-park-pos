// Eat & Park - order ke saare business rules yahin hain.
// Rule badalna ho to sirf yahan badlo; Tables, Dashboard, Orders sab yahi use karte hain.
// NOTE: ye functions .filter(isOpenParcel) jaise seedhe pass hote hain,
// isliye inme sirf 1 argument (order) rakho. Doosra argument mat jodna.

export const OPEN_WINDOW_MS = 18 * 3600 * 1000;
export const PAID_STATUSES = ["paid"];

export const isCancelled = (o) => o.status === "cancelled";

// Due = udhaar, abhi paisa nahi aaya
export const isDue = (o) => o.paymentStatus === "due" && !o.paid && !isCancelled(o);

// Chalu order (table/parcel): unpaid, due nahi, cancelled nahi, aur 18 ghante ke andar
const isOpenBase = (o) =>
  !isCancelled(o) && !o.paid &&
  o.paymentStatus !== "due" && !PAID_STATUSES.includes(o.paymentStatus) &&
  Date.now() - (o.createdAt || 0) < OPEN_WINDOW_MS;

export const isOpenParcel = (o) => o.orderType === "parcel" && isOpenBase(o);
export const isOpenDineIn = (o) => o.orderType === "dine_in" && isOpenBase(o);

// "Active" = unpaid, due nahi, cancelled nahi (Tables, Dashboard, Orders tab teeno yahi)
export const isActiveOrder = (o) => !isCancelled(o) && !o.paid && o.paymentStatus !== "due" && Date.now() - (o.createdAt || 0) < OPEN_WINDOW_MS;

// Paid orders aur unka revenue (cancelled kabhi nahi ginte)
export const paidOrders = (orders) => orders.filter((o) => o.paid && !isCancelled(o));
export const paidRevenue = (orders) =>
  paidOrders(orders).reduce((s, o) => s + (Number(o.finalTotal) || 0), 0);

// "Paid" karte waqt Firestore me jo fields likhni hain (Orders tab + Billing dono yahi use karte hain).
// Parcel ya ready order paid hote hi "served" ho jata hai; preparing/new ka status nahi chhedte
// (warna kitchen se order beech me gayab ho jayega).
export const buildPaidPatch = (order, mode, by) => {
  const patch = {
    paid: true,
    paymentStatus: "paid",
    paidAt: Date.now(),
    paidBy: by || "Staff",
    payment: mode,
  };
  if (order.orderType === "parcel" || order.status === "ready") patch.status = "served";
  return patch;
};
