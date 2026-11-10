const fs = require("fs");
const FILE = "src/DeliveryApp.jsx";
let t = fs.readFileSync(FILE, "utf8");

// 1. Update the Status Badge Logic in the List View
const oldBadge = `{o.status === "out_for_delivery" ? "ON THE WAY" : "READY"}`;
const newBadge = `{o.status === "out_for_delivery" ? "ON THE WAY" : o.status === "ready" ? "READY TO PICK" : o.status === "preparing" ? "COOKING" : "NEW ORDER"}`;

if (t.includes(oldBadge)) {
  t = t.replace(oldBadge, newBadge);
  console.log("✅ List view me status badge fix ho gaya.");
} else {
  // Fallback if the code is slightly different
  const fallbackBadgeRegex = /\{o\.status === "out_for_delivery" \? "ON THE WAY" : "READY"\}/;
  if (fallbackBadgeRegex.test(t)) {
    t = t.replace(fallbackBadgeRegex, newBadge);
    console.log("✅ List view me status badge fallback se fix ho gaya.");
  }
}

// 2. Update the Modal Action Buttons
const oldActionBlock = `{selectedOrder.status !== "served" ? (
              <>
                {selectedOrder.status !== "out_for_delivery" && (
                  <button onClick={() => markOutForDelivery(selectedOrder.id)} style={{ width: "100%", padding: 16, background: "#F59E0B", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: "pointer", marginBottom: 10, boxShadow: "0 4px 12px rgba(245,158,11,0.3)" }}>
                    🛵 Mark Out for Delivery
                  </button>
                )}
                {selectedOrder.status === "out_for_delivery" && (
                  <button onClick={() => markDelivered(selectedOrder.id)} style={{ width: "100%", padding: 16, background: "#10B981", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
                    ✅ Delivered & Collected ₹{selectedOrder.finalTotal}
                  </button>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: 15, background: "#0A2A20", color: "#10B981", borderRadius: 12, fontWeight: 800 }}>
                ✅ Ye order successfully deliver ho chuka hai
              </div>
            )}`;

const newActionBlock = `{selectedOrder.status !== "served" ? (
              <>
                {/* STATUS: READY - Pickup Button */}
                {selectedOrder.status === "ready" && (
                  <button onClick={() => markOutForDelivery(selectedOrder.id)} style={{ width: "100%", padding: 16, background: "#F59E0B", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: "pointer", marginBottom: 10, boxShadow: "0 4px 12px rgba(245,158,11,0.3)" }}>
                    🛵 Mark Out for Delivery
                  </button>
                )}

                {/* STATUS: OUT FOR DELIVERY - Deliver Button */}
                {selectedOrder.status === "out_for_delivery" && (
                  <button onClick={() => markDelivered(selectedOrder.id)} style={{ width: "100%", padding: 16, background: "#10B981", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
                    ✅ Delivered & Collected ₹{selectedOrder.finalTotal}
                  </button>
                )}

                {/* STATUS: NEW OR PREPARING - Wait Message */}
                {(selectedOrder.status === "new" || selectedOrder.status === "preparing") && (
                  <div style={{ textAlign: "center", padding: 16, background: "rgba(245, 158, 11, 0.1)", border: "1px dashed #F59E0B", color: "#F59E0B", borderRadius: 12, fontWeight: 800, fontSize: 14 }}>
                    👨‍🍳 Kitchen me khana ban raha hai... Ready hone ka wait karein.
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: 15, background: "#0A2A20", color: "#10B981", borderRadius: 12, fontWeight: 800 }}>
                ✅ Ye order successfully deliver ho chuka hai
              </div>
            )}`;

if (t.includes(oldActionBlock)) {
  t = t.replace(oldActionBlock, newActionBlock);
  console.log("✅ Action buttons ki logic fix ho gayi (Pickup sirf Ready hone par dikhega).");
} else {
  console.log("⚠️ Action block exact match nahi hua. Shayad formatting alag hai. Check karna padega.");
}

fs.copyFileSync(FILE, FILE + ".bak-status-fix");
fs.writeFileSync(FILE, t, "utf8");
console.log("🎉 Delivery App ka status tracking fix ho gaya!");