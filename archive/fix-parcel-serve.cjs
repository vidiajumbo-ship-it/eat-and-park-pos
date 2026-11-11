const fs = require("fs");

// ==========================================
// 1. FIX APP.JSX (Admin/Staff Panel)
// ==========================================
const APP = "src/App.jsx";
if (fs.existsSync(APP)) {
  let t = fs.readFileSync(APP, "utf8");

  // 1. advanceStatus Guard
  const oldAdvance = `  const advanceStatus = async (orderId, currentStatus) => {
    const idx = STATUS_FLOW.indexOf(currentStatus);
    const nextStatus = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    if (nextStatus === currentStatus) return;
    const order = orders.find(o => o.id === orderId);`;
    
  const newAdvance = `  const advanceStatus = async (orderId, currentStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (order && order.orderType === "parcel" && currentStatus === "ready") {
      alert("Parcel order delivery boy handle karega. Aap ise 'Delivered' mark nahi kar sakte.");
      return;
    }
    const idx = STATUS_FLOW.indexOf(currentStatus);
    const nextStatus = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    if (nextStatus === currentStatus) return;`;
  
  if (t.includes(oldAdvance)) t = t.replace(oldAdvance, newAdvance);

  // 2. StaffView Button Change
  const oldBtn = `<button onClick={(e) => { e.stopPropagation(); advanceStatus(o.id, status); }} style={{ flex: 1, padding: "10px 8px", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: "pointer", background: status === "ready" ? COLORS.sage : (status === "preparing" ? COLORS.copper : COLORS.ink), color: "#fff" }}>
                          {status === "new" ? "👨‍🍳 Start Cooking" : status === "preparing" ? "✅ Mark Ready" : "🍽️ Mark Served"}
                        </button>`;
  
  const newBtn = `{!(o.orderType === "parcel" && o.status === "ready") ? (
                          <button onClick={(e) => { e.stopPropagation(); advanceStatus(o.id, status); }} style={{ flex: 1, padding: "10px 8px", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: "pointer", background: status === "ready" ? COLORS.sage : (status === "preparing" ? COLORS.copper : COLORS.ink), color: "#fff" }}>
                            {status === "new" ? "👨‍🍳 Start Cooking" : status === "preparing" ? "✅ Mark Ready" : "🍽️ Mark Served"}
                          </button>
                        ) : (
                          <div style={{ flex: 1, padding: "10px 8px", borderRadius: 12, fontWeight: 800, fontSize: 13, border: "1px dashed " + COLORS.line, color: COLORS.textLight, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>Rider Pending</div>
                        )}`;

  if (t.includes(oldBtn)) t = t.replace(oldBtn, newBtn);

  fs.copyFileSync(APP, APP + ".bak-serve-fix");
  fs.writeFileSync(APP, t, "utf8");
  console.log("✅ App.jsx me parcel serve limit laga di!");
}

// ==========================================
// 2. FIX STAFFAPP.JSX (Staff Panel)
// ==========================================
const STAFF = "src/StaffApp.jsx";
if (fs.existsSync(STAFF)) {
  let t = fs.readFileSync(STAFF, "utf8");

  // 1. advanceStatus Guard in StaffAppInner
  const oldStaffAdvance = `  const advanceStatus = async (orderId, currentStatus) => {
    const idx = STATUS_FLOW.indexOf(currentStatus);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];`;
    
  const newStaffAdvance = `  const advanceStatus = async (orderId, currentStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (order && order.orderType === "parcel" && currentStatus === "ready") {
      toast("Parcel order delivery boy handle karega", "warning");
      return;
    }
    const idx = STATUS_FLOW.indexOf(currentStatus);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];`;
    
  if (t.includes(oldStaffAdvance)) t = t.replace(oldStaffAdvance, newStaffAdvance);

  // 2. KOTView advanceOrder guard
  const oldKotAdv = `  const advanceOrder = async (order) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];`;
    
  const newKotAdv = `  const advanceOrder = async (order) => {
    if (order.orderType === "parcel" && order.status === "ready") {
      toast("Parcel order delivery boy handle karega", "warning");
      return;
    }
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];`;
    
  if (t.includes(oldKotAdv)) t = t.replace(oldKotAdv, newKotAdv);

  // 3. OrdersView advanceOrder guard
  const oldOrdAdv = `  const advanceOrder = async (order) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];`;
    
  const newOrdAdv = `  const advanceOrder = async (order) => {
    if (order.orderType === "parcel" && order.status === "ready") {
      toast("Parcel order delivery boy handle karega", "warning");
      return;
    }
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];`;
    
  if (t.includes(oldOrdAdv)) t = t.replace(oldOrdAdv, newOrdAdv);

  // 4. OrdersView UI button
  const oldStaffBtn = `{!isCancelled && o.status !== "served" && <button onClick={() => advanceOrder(o)} style={{ padding: "9px", border: "none", borderRadius: 8, background: stColor, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{o.status === "new" ? "Start" : o.status === "preparing" ? "Ready" : "Serve"}</button>}`;
  
  const newStaffBtn = `{!isCancelled && o.status !== "served" && (
                  o.orderType === "parcel" && o.status === "ready" ? (
                    <div style={{ flex: 1, padding: "9px", border: "1px dashed " + C.gray, borderRadius: 8, textAlign: "center", fontWeight: 800, fontSize: 12, color: C.gray }}>Rider Pending</div>
                  ) : (
                    <button onClick={() => advanceOrder(o)} style={{ padding: "9px", border: "none", borderRadius: 8, background: stColor, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{o.status === "new" ? "Start" : o.status === "preparing" ? "Ready" : "Serve"}</button>
                  )
                )}`;
                
  if (t.includes(oldStaffBtn)) t = t.replace(oldStaffBtn, newStaffBtn);

  fs.copyFileSync(STAFF, STAFF + ".bak-serve-fix");
  fs.writeFileSync(STAFF, t, "utf8");
  console.log("✅ StaffApp.jsx me parcel serve limit laga di!");
}