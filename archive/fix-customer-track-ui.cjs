const fs = require("fs");
const FILE = "src/App.jsx";
let t = fs.readFileSync(FILE, "utf8");

// 1. Fix getOrderProgress
const oldProgress = `function getOrderProgress(status) {
  const map = { new: 15, preparing: 40, ready: 70, out_for_delivery: 90, served: 100 };
  return map[status] || 0;
}`;
const newProgress = `function getOrderProgress(status) {
  if (status === 'served' || status === 'delivered' || status === 'completed') return 100;
  if (status === 'out_for_delivery') return 90;
  if (status === 'ready') return 70;
  if (status === 'preparing') return 40;
  if (status === 'new') return 15;
  return 0;
}`;

if (t.includes(oldProgress)) {
  t = t.replace(oldProgress, newProgress);
} else {
  console.log("⚠️ getOrderProgress not found, maybe already patched.");
}

// 2. Fix OrderTimer
const oldTimer = String.raw`const OrderTimer = memo(({ createdAt, estimatedTime }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const t = setInterval(() => setElapsed(Math.floor((Date.now() - createdAt) / 1000)), 1000); return () => clearInterval(t); }, [createdAt]);
  const minutes = Math.floor(elapsed / 60); const seconds = elapsed % 60; const isOvertime = elapsed > (estimatedTime * 60);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: isOvertime ? 'rgba(239, 68, 68, 0.1)' : COLORS.sageLight, borderRadius: 10, borderLeft: \`3px solid \${isOvertime ? COLORS.error : COLORS.sage}\` }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: isOvertime ? COLORS.error : COLORS.sageDark }}>⏱️ {minutes}:{seconds.toString().padStart(2, '0')}</span>
      <span style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600 }}>/ {estimatedTime}m</span>
    </div>
  );
});`;

const newTimer = String.raw`const OrderTimer = memo(({ createdAt, servedAt, status, estimatedTime }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status === 'served' || status === 'delivered' || status === 'completed') {
      if (servedAt) setElapsed(Math.floor((servedAt - createdAt) / 1000));
      return;
    }
    if (status === 'cancelled') return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - createdAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [createdAt, servedAt, status]);
  const minutes = Math.floor(elapsed / 60); const seconds = elapsed % 60; const isOvertime = elapsed > (estimatedTime * 60) && status !== 'served' && status !== 'delivered' && status !== 'completed';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: isOvertime ? 'rgba(239, 68, 68, 0.1)' : COLORS.sageLight, borderRadius: 10, borderLeft: \`3px solid \${isOvertime ? COLORS.error : COLORS.sage}\` }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: isOvertime ? COLORS.error : COLORS.sageDark }}>⏱️ {minutes}:{seconds.toString().padStart(2, '0')}</span>
      <span style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600 }}>/ {estimatedTime}m</span>
    </div>
  );
});`;

if (t.includes(oldTimer)) {
  t = t.replace(oldTimer, newTimer);
} else {
  console.log("⚠️ OrderTimer not found.");
}

// 3. Fix the Track Modal block
const trackRegex = /\{activeModal === 'track'[\s\S]*?(?=\{activeModal === 'chat')/;
const newTrack = String.raw`{activeModal === 'track' && (
  <>
    <ModalHeader title="My Orders" onClose={() => setActiveModal(null)} />
    {myOrders.length === 0 ? (
      <div style={{ textAlign: 'center', padding: 50, color: COLORS.textLight }}>No orders yet</div>
    ) : (
      [...myOrders].reverse().map(o => {
        const estimatedTime = getEstimatedTime(o.items, menu);
        const isCancelled = o.status === 'cancelled';
        const isServed = o.status === 'served' || o.status === 'delivered' || o.status === 'completed';

        let statusText = "Order Received";
        let statusColor = COLORS.copper;
        if (o.status === 'preparing') { statusText = "Cooking 👨‍🍳"; }
        else if (o.status === 'ready') { statusText = "Ready for Pickup ✅"; }
        else if (o.status === 'out_for_delivery') { statusText = "Out for Delivery 🛵"; statusColor = COLORS.info; }
        else if (isServed) { statusText = "Delivered 🎉"; statusColor = COLORS.success; }
        else if (isCancelled) { statusText = "Cancelled ❌"; statusColor = COLORS.error; }

        return (
          <div key={o.id} style={{ background: '#fff', border: \`1px solid \${COLORS.line}\`, borderRadius: 16, padding: 20, marginBottom: 16, opacity: (isServed || isCancelled) ? 0.7 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Order #{o.id.slice(1, 5).toUpperCase()}</div>
              {o.kots?.length > 1 && <KotBadge kots={o.kots} />}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: statusColor, textTransform: 'uppercase', marginBottom: 10 }}>{statusText}</div>

            <OrderTimer createdAt={o.createdAt} servedAt={o.servedAt} status={o.status} estimatedTime={estimatedTime} />

            <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
              <ProgressRing progress={getOrderProgress(o.status)} size={80} />
            </div>

            <div style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 12 }}>
              {o.items.map(i => \`\${i.qty}x \${i.name}\`).join(", ")}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setActiveModal(null)} style={{ flex: 1, background: "transparent", color: COLORS.copper, border: \`2px solid \${COLORS.copper}\`, borderRadius: 14, padding: "13px 20px", fontWeight: 800, cursor: 'pointer' }}>Back</button>
              {!isServed && !isCancelled && (
                <button onClick={() => setRunningOrderId(o.id)} style={{ padding: "13px 20px", background: COLORS.info, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>➕ Running</button>
              )}
              {o.status === "new" && (
                <button onClick={() => cancelOrder(o.id)} style={{ padding: "13px 20px", background: 'transparent', color: COLORS.error, border: \`2px solid \${COLORS.error}\`, borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>❌ Cancel</button>
              )}
            </div>
          </div>
        );
      })
    )}
  </>
)}
`;

if (t.match(trackRegex)) {
  t = t.replace(trackRegex, newTrack);
} else {
  console.log("⚠️ Track Modal not found.");
}

fs.copyFileSync(FILE, FILE + ".bak-track-fix");
fs.writeFileSync(FILE, t, "utf8");
console.log("🎉 Tracking UI fix ho gaya! Timer stop hoga aur ring 100% dikhega.");