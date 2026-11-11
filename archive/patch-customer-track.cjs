const fs = require("fs");
const FILE = "src/App.jsx";
let t = fs.readFileSync(FILE, "utf8");
const edits = [];

// 1. Update STATUS_FLOW
edits.push({
  find: 'const STATUS_FLOW = ["new", "preparing", "ready", "served"];',
  replace: 'const STATUS_FLOW = ["new", "preparing", "ready", "out_for_delivery", "served"];'
});

// 2. Update getOrderProgress
edits.push({
  find: 'const map = { new: 15, preparing: 50, ready: 85, served: 100 };',
  replace: 'const map = { new: 15, preparing: 40, ready: 70, out_for_delivery: 90, served: 100 };'
});

// 3. Update Toast Notification Labels
edits.push({
  find: 'const labels = { new: "🍽️ Received", preparing: "👨‍🍳 Cooking", ready: "✅ Ready!", served: "🎉 Served" };',
  replace: 'const labels = { new: "🍽️ Received", preparing: "👨‍🍳 Cooking", ready: "✅ Ready!", out_for_delivery: "🛵 Out for Delivery", served: "🎉 Delivered" };'
});

// 4. Update Track Modal to show all orders and the new status
const oldTrack = `{activeModal === 'track' && (<><ModalHeader title="Active Orders" onClose={() => setActiveModal(null)} />{myActiveOrders.length === 0 ? (<div style={{ textAlign: 'center', padding: 50, color: COLORS.textLight }}>No active orders</div>) : myActiveOrders.map(o => { const estimatedTime = getEstimatedTime(o.items, menu); const isCancellable = o.status === "new"; return (<div key={o.id} style={{ background: '#fff', border: \`1px solid \${COLORS.line}\`, borderRadius: 16, padding: 20, marginBottom: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><div style={{ fontSize: 20, fontWeight: 700 }}>Order #{o.id.slice(1, 5).toUpperCase()}</div>{o.kots?.length > 1 && <KotBadge kots={o.kots} />}</div><OrderTimer createdAt={o.createdAt} estimatedTime={estimatedTime} /><div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}><ProgressRing progress={getOrderProgress(o.status)} size={80} /></div><div style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 12 }}>{o.items.map(i => \`\${i.qty}x \${i.name}\`).join(", ")}</div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button onClick={() => setActiveModal(null)} style={{ flex: 1, background: "transparent", color: COLORS.copper, border: \`2px solid \${COLORS.copper}\`, borderRadius: 14, padding: "13px 20px", fontWeight: 800, cursor: 'pointer' }}>Back</button><button onClick={() => setRunningOrderId(o.id)} style={{ padding: "13px 20px", background: COLORS.info, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>➕ Running</button>{isCancellable && (<button onClick={() => cancelOrder(o.id)} style={{ padding: "13px 20px", background: 'transparent', color: COLORS.error, border: \`2px solid \${COLORS.error}\`, borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>❌ Cancel</button>)}</div></div>); })}</>)}`;

const newTrack = `{activeModal === 'track' && (<><ModalHeader title="My Orders" onClose={() => setActiveModal(null)} />{myOrders.length === 0 ? (<div style={{ textAlign: 'center', padding: 50, color: COLORS.textLight }}>No orders yet</div>) : [...myOrders].reverse().map(o => { const estimatedTime = getEstimatedTime(o.items, menu); const isCancellable = o.status === "new"; const statusText = o.status === 'new' ? 'Order Received' : o.status === 'preparing' ? 'Cooking' : o.status === 'ready' ? 'Ready' : o.status === 'out_for_delivery' ? 'Out for Delivery 🛵' : 'Delivered 🎉'; const statusColor = o.status === 'served' ? COLORS.success : o.status === 'out_for_delivery' ? COLORS.info : COLORS.copper; return (<div key={o.id} style={{ background: '#fff', border: \`1px solid \${COLORS.line}\`, borderRadius: 16, padding: 20, marginBottom: 16, opacity: o.status === 'served' ? 0.7 : 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><div style={{ fontSize: 20, fontWeight: 700 }}>Order #{o.id.slice(1, 5).toUpperCase()}</div>{o.kots?.length > 1 && <KotBadge kots={o.kots} />}</div><div style={{ fontSize: 13, fontWeight: 800, color: statusColor, textTransform: 'uppercase', marginBottom: 10 }}>{statusText}</div><OrderTimer createdAt={o.createdAt} estimatedTime={estimatedTime} /><div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}><ProgressRing progress={getOrderProgress(o.status)} size={80} /></div><div style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 12 }}>{o.items.map(i => \`\${i.qty}x \${i.name}\`).join(", ")}</div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button onClick={() => setActiveModal(null)} style={{ flex: 1, background: "transparent", color: COLORS.copper, border: \`2px solid \${COLORS.copper}\`, borderRadius: 14, padding: "13px 20px", fontWeight: 800, cursor: 'pointer' }}>Back</button>{o.status !== 'served' && <button onClick={() => setRunningOrderId(o.id)} style={{ padding: "13px 20px", background: COLORS.info, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>➕ Running</button>}{isCancellable && (<button onClick={() => cancelOrder(o.id)} style={{ padding: "13px 20px", background: 'transparent', color: COLORS.error, border: \`2px solid \${COLORS.error}\`, borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>❌ Cancel</button>)}</div></div>); })}</>)}`;

edits.push({ find: oldTrack, replace: newTrack });

// Atomic apply
let bad = false;
edits.forEach((e, i) => {
  const n = t.split(e.find).length - 1;
  if (n !== 1) {
    console.error("❌ Edit #" + (i+1) + ": " + n + " baar mila (1 chahiye)");
    console.error("   " + String(e.find).slice(0, 100));
    bad = true;
    return;
  }
  t = t.split(e.find).join(e.replace);
});

if (bad) { console.error("⛔ Abort — koi file write nahi hui."); process.exit(1); }

fs.copyFileSync(FILE, FILE + ".bak-track");
fs.writeFileSync(FILE, t, "utf8");
console.log("✅ Customer App me 'Out for Delivery' tracking add ho gaya!");