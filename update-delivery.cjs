const fs = require("fs");
const FILE = "src/DeliveryApp.jsx";
let t = fs.readFileSync(FILE, "utf8");

// Purana query block dhoondho
const oldQuery = `const q = query(
      collection(db, "orders"),
      where("orderType", "==", "parcel"),
      where("status", "in", ["ready", "preparing", "out_for_delivery"])
    );`;

// Naya query block (Saare active statuses)
const newQuery = `const q = query(
      collection(db, "orders"),
      where("orderType", "==", "parcel")
    );`;

if (t.includes(oldQuery)) {
  t = t.replace(oldQuery, newQuery);
} else {
  console.log("⚠️ Purana query nahi mila, shayad pehle se change hai.");
}

// List filter karne ka logic update karo (map ke andar)
const oldFilter = `const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by time (purane pehle)
      list.sort((a, b) => a.createdAt - b.createdAt);
      setOrders(list);`;

const newFilter = `const allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter: Sirf wo orders jo delivery ke liye active hain ya paisa baaki hai
      const activeOrders = allOrders.filter(o => 
        (o.status !== "cancelled") && 
        (
          ["new", "preparing", "ready", "out_for_delivery", "served"].includes(o.status) 
        )
      );

      // Sort by time (purane pehle)
      activeOrders.sort((a, b) => a.createdAt - b.createdAt);
      setOrders(activeOrders);`;

if (t.includes(oldFilter)) {
  t = t.replace(oldFilter, newFilter);
  fs.copyFileSync(FILE, FILE + ".bak-delivery-fix");
  fs.writeFileSync(FILE, t, "utf8");
  console.log("✅ DeliveryApp.jsx update ho gaya! Ab saare active orders dikhenge.");
} else {
  console.log("❌ Filter update nahi hua. Manually check karo.");
}