const fs = require("fs");
const FILE = "src/App.jsx";
let t = fs.readFileSync(FILE, "utf8");

const oldCancel = `const cancelOrder = useCallback(async (orderId) => {
    if (!window.confirm("Cancel this order?")) return;
    try {
      await updateDoc(doc(db, "orders", orderId), { status: "cancelled", cancelledAt: Date.now() });
      setOrdersState(prev => prev.map(o => o.id === orderId ? { ...o, status: "cancelled" } : o));
      showToast("❌ Order cancelled", 'warning');
    } catch (e) { showToast("⚠️ Failed to cancel", 'error'); }
  }, [setOrdersState, showToast]);`;

const newCancel = `const cancelOrder = useCallback(async (orderId) => {
    // 🆕 Check karo ki order abhi bhi "new" status me hai ya nahi
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    if (order.status !== 'new') {
      showToast("⚠️ Khana ban chuka hai (Cooking shuru), ab cancel nahi ho sakta. Restaurant se baat karein.", 'error');
      return;
    }

    if (!window.confirm("Kya aap sach me ye order cancel karna chahte hain?")) return;
    
    try {
      await updateDoc(doc(db, "orders", orderId), { status: "cancelled", cancelledAt: Date.now() });
      setOrdersState(prev => prev.map(o => o.id === orderId ? { ...o, status: "cancelled" } : o));
      showToast("❌ Order cancelled", 'warning');
    } catch (e) { 
      console.error(e);
      showToast("⚠️ Failed to cancel. Server rules ne block kiya.", 'error'); 
    }
  }, [orders, setOrdersState, showToast]);`;

if (t.includes(oldCancel)) {
  t = t.replace(oldCancel, newCancel);
  fs.copyFileSync(FILE, FILE + ".bak-cancel-limit");
  fs.writeFileSync(FILE, t, "utf8");
  console.log("✅ Cancel button par strict limit laga di gayi hai!");
} else {
  console.log("⚠️ Purana cancelOrder function nahi mila. Shayad pehle se update hai.");
}