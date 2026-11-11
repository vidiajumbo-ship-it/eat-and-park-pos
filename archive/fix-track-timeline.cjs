const fs = require("fs");
const FILE = "src/App.jsx";
let t = fs.readFileSync(FILE, "utf8");

// Target the track modal block
const startStr = "{activeModal === 'track' && (";
const endStr = "{activeModal === 'chat' && (";

const startIndex = t.indexOf(startStr);
const endIndex = t.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log("❌ Track modal ka code nahi mila. Manually check karo.");
  process.exit(1);
}

const newTrackCode = `{activeModal === 'track' && (
  <>
    <ModalHeader title="Track Active Orders" onClose={() => setActiveModal(null)} />
    {myActiveOrders.length === 0 ? (
      <div style={{ textAlign: 'center', padding: "50px 20px", color: COLORS.textLight }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>😴</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.ink, marginBottom: 6 }}>Koi active order nahi hai</div>
        <div style={{ fontSize: 13 }}>Aapke purane orders "Order History" me dikhenge.</div>
      </div>
    ) : (
      myActiveOrders.map(o => {
        const steps = [
          { id: 'new', label: 'Order Received', icon: '📝', desc: 'Restaurant ne order accept kar liya hai' },
          { id: 'preparing', label: 'Cooking', icon: '👨‍🍳', desc: 'Aapka khana ban raha hai' },
          { id: 'ready', label: 'Ready', icon: '✅', desc: 'Khana taiyar hai, pickup ka wait hai' },
          { id: 'out_for_delivery', label: 'Out for Delivery', icon: '🛵', desc: 'Rider aapke order ke saath nikal chuka hai' },
          { id: 'served', label: 'Delivered', icon: '🎉', desc: 'Order deliver ho gaya!' }
        ];
        
        const currentIndex = steps.findIndex(s => s.id === o.status);
        const activeIndex = currentIndex === -1 ? 0 : currentIndex;

        return (
          <div key={o.id} style={{ background: '#fff', border: \`1px solid \${COLORS.line}\`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.ink }}>Order #{o.id.slice(1, 5).toUpperCase()}</div>
                <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>{new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style={{ background: COLORS.paper, padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700, color: COLORS.copper }}>
                {inr(getOrderTotal(o))}
              </div>
            </div>

            {/* TIMELINE */}
            <div style={{ margin: "20px 0", paddingLeft: 10 }}>
              {steps.map((step, idx) => {
                const isDone = idx < activeIndex;
                const isCurrent = idx === activeIndex;
                const isPending = idx > activeIndex;
                
                let dotColor = "#E8E6DC";
                let dotIcon = step.icon;
                let textColor = "#8A8375";

                if (isDone) {
                  dotColor = COLORS.sage;
                  textColor = COLORS.ink;
                } else if (isCurrent) {
                  dotColor = COLORS.copper;
                  textColor = COLORS.copper;
                }

                return (
                  <div key={step.id} style={{ display: "flex", gap: 15, position: "relative", paddingBottom: 25 }}>
                    {/* Connecting Line */}
                    {idx !== steps.length - 1 && (
                      <div style={{ position: "absolute", left: 14, top: 30, bottom: 0, width: 2, background: isDone ? COLORS.sage : "#E8E6DC", zIndex: 0 }} />
                    )}
                    
                    {/* Dot */}
                    <div style={{ 
                      width: 30, height: 30, borderRadius: 15, 
                      background: isDone ? COLORS.sageLight : isCurrent ? COLORS.copperLight : "#fff",
                      border: \`2px solid \${dotColor}\`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      zIndex: 1, fontSize: 14,
                      animation: isCurrent ? "pulse 2s infinite" : "none"
                    }}>
                      {isDone ? "✓" : step.icon}
                    </div>

                    {/* Text */}
                    <div style={{ paddingTop: 2 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: textColor, lineHeight: 1.2 }}>{step.label}</div>
                      {isCurrent && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4, lineHeight: 1.3 }}>{step.desc}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: \`1px dashed \${COLORS.line}\`, paddingTop: 15, display: 'flex', gap: 10 }}>
              <button onClick={() => setActiveModal(null)} style={{ flex: 1, background: "transparent", color: COLORS.copper, border: \`2px solid \${COLORS.copper}\`, borderRadius: 12, padding: "10px", fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>Close</button>
              {o.status === "new" && (
                <button onClick={() => cancelOrder(o.id)} style={{ flex: 1, background: 'transparent', color: COLORS.error, border: \`2px solid \${COLORS.error}\`, borderRadius: 12, padding: "10px", fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>Cancel Order</button>
              )}
            </div>
          </div>
        );
      })
    )}
  </>
)}

`;

t = t.substring(0, startIndex) + newTrackCode + t.substring(endIndex);

fs.copyFileSync(FILE, FILE + ".bak-track-timeline");
fs.writeFileSync(FILE, t, "utf8");
console.log("✅ Track tab me ab Zomato-style timeline aur sirf active orders dikhenge!");