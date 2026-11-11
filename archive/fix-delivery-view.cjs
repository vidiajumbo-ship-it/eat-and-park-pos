const fs = require("fs");
const FILE = "src/DeliveryApp.jsx";
let t = fs.readFileSync(FILE, "utf8");

// 1. Purana query filter hata kar simple query lagana
const oldQuery = `const q = query(
      collection(db, "orders"),
      where("orderType", "==", "parcel")
    );`;

const newQuery = `const q = query(
      collection(db, "orders")
    );`;

if (t.includes(oldQuery)) {
  t = t.replace(oldQuery, newQuery);
} else {
  console.log("⚠️ Purana query nahi mila, shayad pehle se change hai.");
}

// 2. Filter logic ko update karna (Data JS me filter hoga)
const oldFilter = `// Filter: Sirf wo orders jo delivery ke liye active hain ya paisa baaki hai
      const activeOrders = allOrders.filter(o => 
        (o.status !== "cancelled") && 
        (
          ["new", "preparing", "ready", "out_for_delivery", "served"].includes(o.status) 
        )
      );`;

const newFilter = `// Filter: Sirf Parcel orders jo cancel nahi hue aur deliver nahi hue
      const activeOrders = allOrders.filter(o => 
        o.orderType === "parcel" && 
        o.status !== "cancelled" && 
        o.status !== "served"
      );`;

if (t.includes(oldFilter)) {
  t = t.replace(oldFilter, newFilter);
  fs.copyFileSync(FILE, FILE + ".bak-delivery-view");
  fs.writeFileSync(FILE, t, "utf8");
  console.log("✅ Delivery Panel query fix ho gayi! Ab orders dikhne chahiye.");
} else {
  console.log("⚠️ Filter ka exact match nahi mila. Code manually check karo.");
}