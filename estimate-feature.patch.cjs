// estimate-feature.patch.js
// Usage: node estimate-feature.patch.js <path-to-your-staff-file>
// Example: node estimate-feature.patch.js src/StaffApp.jsx

const fs = require("fs");

const filePath = process.argv[2];
if (!filePath) {
  console.error("❌ File path do: node estimate-feature.patch.js src/StaffApp.jsx");
  process.exit(1);
}

let src = fs.readFileSync(filePath, "utf8");
const original = src;
let changes = [];

// ─────────────────────────────────────────────────────────────
// 1) EstimatePanel component + rules inject karo
//    Anchor: "// ===========================================================================\n// MAIN APP"
// ─────────────────────────────────────────────────────────────
const ESTIMATE_COMPONENT = `
// ===========================================================================
// 📋 ESTIMATE PANEL — persons + items (manual ya auto) + one-click cart
// ===========================================================================

const SUGGEST_RULES = [
  { re: /starter|snack|tandoor|appetizer|momos|roll/i, perPerson: 0.5, pick: 2 },
  { re: /main|curry|sabzi|gravy|paneer|chicken|mutton|fish|egg/i, perPerson: 0.7, pick: 3 },
  { re: /bread|roti|naan|paratha/i, perPerson: 2, pick: 2 },
  { re: /rice|biryani|pulao/i, perPerson: 0.5, pick: 1 },
  { re: /dessert|sweet|ice/i, perPerson: 0.5, pick: 1 },
  { re: /drink|beverage|juice|shake|cold|coffee/i, perPerson: 1, pick: 2 },
  { re: /thali/i, perPerson: 1, pick: 1 },
];

function buildSuggestion(menu, persons) {
  const used = new Set();
  const out = [];
  SUGGEST_RULES.forEach((rule) => {
    const pool = menu
      .filter((m) => rule.re.test(m.category || "") && !used.has(m.id) && m.available !== false)
      .sort((a, b) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0))
      .slice(0, rule.pick);
    if (!pool.length) return;
    const totalQty = Math.max(1, Math.ceil(persons * rule.perPerson));
    const each = Math.max(1, Math.ceil(totalQty / pool.length));
    pool.forEach((m) => {
      used.add(m.id);
      out.push({ id: m.id, name: m.name, price: Number(m.price) || 0, qty: each });
    });
  });
  return out;
}

function EstimatePanel({ C, menu, isMobile, onClose, onMoveToCart }) {
  const [persons, setPersons] = React.useState(2);
  const [mode, setMode] = React.useState("manual");
  const [items, setItems] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [catFilter, setCatFilter] = React.useState("All");
  const toast = useToast();

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const addItem = (m) =>
    setItems((prev) => {
      const ex = prev.find((p) => p.id === m.id);
      if (ex) return prev.map((p) => (p.id === m.id ? { ...p, qty: p.qty + 1 } : p));
      return [...prev, { id: m.id, name: m.name, price: Number(m.price) || 0, qty: 1 }];
    });

  const changeQty = (id, d) =>
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, qty: p.qty + d } : p)).filter((p) => p.qty > 0)
    );

  const runAuto = () => {
    const s = buildSuggestion(menu, Number(persons) || 1);
    if (!s.length) { toast("Auto suggest ke liye menu me category match nahi mili", "warning"); return; }
    setItems(s);
  };

  const categories = React.useMemo(
    () => ["All", ...Array.from(new Set(menu.map((m) => m.category).filter(Boolean)))],
    [menu]
  );

  const filtered = React.useMemo(
    () => menu.filter((m) =>
      m.available !== false &&
      (catFilter === "All" || m.category === catFilter) &&
      (!search.trim() || String(m.name || "").toLowerCase().includes(search.toLowerCase()))
    ).slice(0, 60),
    [menu, search, catFilter]
  );

  const btn = (active) => ({
    padding: isMobile ? "9px 14px" : "8px 16px",
    borderRadius: 10,
    border: "1.5px solid " + (active ? C.gold : C.line),
    background: active ? C.gold : C.card,
    color: active ? "#fff" : C.ink,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, color: C.ink, borderRadius: isMobile ? "20px 20px 0 0" : 16, padding: 18, width: "100%", maxWidth: isMobile ? "100%" : 600, maxHeight: isMobile ? "92vh" : "88vh", overflowY: "auto", animation: isMobile ? "slideUp .25s ease-out" : "scaleIn .18s ease-out", boxShadow: "0 -8px 40px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>📋 Estimate</div>
          <button onClick={onClose} style={{ background: "rgba(0,0,0,.05)", border: "none", borderRadius: "50%", width: 34, height: 34, fontSize: 16, cursor: "pointer", color: C.ink }}>✕</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.cardAlt, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>👥 Persons:</span>
          <input type="number" min="1" value={persons} onChange={(e) => setPersons(e.target.value)} style={{ width: 80, padding: "8px 10px", borderRadius: 8, border: "1.5px solid " + C.line, fontSize: 16, fontWeight: 900, textAlign: "center", background: C.card, color: C.ink, outline: "none" }} />
          <span style={{ fontSize: 12, color: C.gray, fontWeight: 700 }}>ke hisaab se</span>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button style={btn(mode === "manual")} onClick={() => setMode("manual")}>✍️ Manual</button>
          <button style={btn(mode === "auto")} onClick={() => { setMode("auto"); runAuto(); }}>🤖 Auto Suggest</button>
        </div>

        {mode === "manual" && (
          <div style={{ marginBottom: 12 }}>
            <input placeholder="🔍 Item search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid " + C.line, fontSize: 14, boxSizing: "border-box", background: C.card, color: C.ink, outline: "none", marginBottom: 8 }} />
            <div className="ep-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 6 }}>
              {categories.map((c) => (
                <button key={c} onClick={() => setCatFilter(c)} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid " + (catFilter === c ? C.gold : C.line), background: catFilter === c ? C.gold : C.card, color: catFilter === c ? "#fff" : C.gray, fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit" }}>{c}</button>
              ))}
            </div>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid " + C.line, borderRadius: 10 }}>
              {filtered.map((m) => (
                <button key={m.id} onClick={() => addItem(m)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "10px 12px", border: "none", borderBottom: "1px solid " + C.line, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: C.ink }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{m.name}{m.portion ? <span style={{ color: C.gray, fontWeight: 500 }}> ({m.portion})</span> : null}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.goldText, fontFamily: "monospace" }}>{inr(m.price)} ＋</span>
                </button>
              ))}
              {filtered.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.gray, fontSize: 13 }}>Koi item nahi mila</div>}
            </div>
          </div>
        )}

        {mode === "auto" && (
          <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
            <button onClick={runAuto} style={{ ...btn(false), padding: "10px 16px" }}>🔄 Dobara suggest karo ({persons} persons)</button>
          </div>
        )}

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Selected Items ({items.length})</div>
          {items.length === 0 && <div style={{ padding: 16, textAlign: "center", color: C.gray, fontSize: 13, background: C.cardAlt, borderRadius: 10 }}>Abhi koi item nahi — upar se add karo ya Auto Suggest dabao</div>}
          {items.map((i) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid " + C.line, background: C.cardAlt, borderRadius: 8, marginBottom: 4 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, minWidth: 0 }}>{i.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid " + C.line, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                <button onClick={() => changeQty(i.id, -1)} style={{ width: 30, height: 30, border: "none", background: C.card, color: C.ink, fontSize: 16, fontWeight: 900, cursor: "pointer" }}>−</button>
                <span style={{ fontWeight: 900, fontSize: 14, minWidth: 24, textAlign: "center" }}>{i.qty}</span>
                <button onClick={() => changeQty(i.id, 1)} style={{ width: 30, height: 30, border: "none", background: C.goldLight, color: C.goldText, fontSize: 16, fontWeight: 900, cursor: "pointer" }}>＋</button>
              </div>
              <span style={{ width: 70, textAlign: "right", fontWeight: 900, fontSize: 13, fontFamily: "monospace", flexShrink: 0 }}>{inr(i.price * i.qty)}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "linear-gradient(135deg, " + C.gold + " 0%, " + C.goldDark + " 100%)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, boxShadow: "0 4px 12px " + C.gold + "40" }}>
          <div>
            <div style={{ color: "#fff", fontSize: 10, fontWeight: 800, opacity: 0.85, letterSpacing: 0.5, textTransform: "uppercase" }}>Total ({items.length} items)</div>
            <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, fontFamily: "monospace" }}>{inr(total)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#fff", fontSize: 10, fontWeight: 800, opacity: 0.85, letterSpacing: 0.5, textTransform: "uppercase" }}>Per Person</div>
            <div style={{ color: "#fff", fontSize: 16, fontWeight: 800, fontFamily: "monospace" }}>{inr(Math.round(total / (Number(persons) || 1)))}</div>
          </div>
        </div>

        <button
          disabled={!items.length}
          onClick={() => onMoveToCart(items)}
          style={{ marginTop: 12, width: "100%", padding: "15px", background: items.length ? "linear-gradient(135deg, " + C.green + " 0%, #15803D 100%)" : C.line, color: items.length ? "#fff" : C.gray, border: "none", borderRadius: 12, fontSize: 16, fontWeight: 900, cursor: items.length ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          ✅ Cart me bhejo ({items.length} items)
        </button>
      </div>
    </div>
  );
}

`;

const mainAppAnchor = "// ===========================================================================\n// MAIN APP";
if (!src.includes(mainAppAnchor)) {
  console.error("❌ Anchor 'MAIN APP' nahi mila. File check karo.");
  process.exit(1);
}
src = src.replace(mainAppAnchor, ESTIMATE_COMPONENT + mainAppAnchor);
changes.push("✅ EstimatePanel component + rules inject kiye");

// ─────────────────────────────────────────────────────────────
// 2) State add karo (confetti ke baad)
// ─────────────────────────────────────────────────────────────
const stateAnchor = "const [confetti, setConfetti] = useState(false);";
if (!src.includes(stateAnchor)) {
  console.error("❌ State anchor 'confetti' nahi mila.");
  process.exit(1);
}
src = src.replace(
  stateAnchor,
  stateAnchor + "\n  const [showEstimate, setShowEstimate] = useState(false);"
);
changes.push("✅ showEstimate state add ki");

// ─────────────────────────────────────────────────────────────
// 3) Estimate button TABS ke shuru me
//    Anchor: '{activeTab === "tables" && ('
//    Hum TABS array me ek naya tab nahi jodenge, balki alag button
//    TABS bar ke just baad / shuru me laga denge.
// ─────────────────────────────────────────────────────────────
const tabsAnchor = `      {/* TABS */}`;
if (!src.includes(tabsAnchor)) {
  console.error("❌ TABS anchor nahi mila.");
  process.exit(1);
}
const estimateBtn = `      {/* TABS */}
      <div style={{ display: "flex", alignItems: "center", background: C.card, borderBottom: \`1px solid \${C.line}\`, padding: isMobile ? "0 8px" : "0 16px" }}>
        <button
          onClick={() => { haptic(); setShowEstimate(true); }}
          style={{ padding: isMobile ? "12px 12px" : "15px 18px", border: "none", background: "transparent", color: C.green, fontWeight: 900, fontSize: isMobile ? 12 : 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, borderBottom: \`3px solid \${C.green}\`, fontFamily: "inherit" }}
          title="Persons ke hisaab se estimate banao"
        >
          📋 Estimate
        </button>
        <div style={{ display: "flex", gap: 4, overflowX: "auto", flex: 1 }}>`;
// Replace the original TABS block opening line with our new wrapper
// Original line: <div style={{ background: C.card, borderBottom: `1px solid ${C.line}`, padding: isMobile ? "0 8px" : "0 16px", display: "flex", gap: 4, overflowX: "auto" }}>
const origTabsLine = `<div style={{ background: C.card, borderBottom: \`1px solid \${C.line}\`, padding: isMobile ? "0 8px" : "0 16px", display: "flex", gap: 4, overflowX: "auto" }}>`;
if (!src.includes(origTabsLine)) {
  console.error("❌ Original TABS div nahi mila (exact line mismatch).");
  console.error("File me ye line dhoondo aur manually replace karo:");
  console.error(origTabsLine);
  process.exit(1);
}
// Replace the opening div, but we need to also close the inner wrapper.
// We'll replace the opening line and find the closing </div> of TABS by locating the
// next "))}\n      </div>" pattern that closes the tabs map.
// Simpler approach: replace opening line with: <div wrapper> <button/> <div inner>
// and then after the tabs map closing </div>, add another </div>.
// The tabs map ends with:
//   ))}
//       </div>
// We need to change it to:
//   ))}
//         </div>
//       </div>
// But "))}\n      </div>" could appear elsewhere. We'll target the unique sequence
//   </button>\n        ))}\n      </div>
const tabsCloseAnchor = `        ))}
      </div>`;
// Find the FIRST occurrence after TABS
const tabsStartIdx = src.indexOf(tabsAnchor);
const closeIdx = src.indexOf(tabsCloseAnchor, tabsStartIdx);
if (closeIdx === -1) {
  console.error("❌ TABS close anchor nahi mila.");
  process.exit(1);
}
// Replace opening
src = src.slice(0, tabsStartIdx) + estimateBtn + src.slice(tabsStartIdx + origTabsLine.length);
// After opening replacement, indices shifted. Recompute.
const newTabsStartIdx = src.indexOf(tabsAnchor);
const newCloseIdx = src.indexOf(tabsCloseAnchor, newTabsStartIdx);
if (newCloseIdx === -1) {
  console.error("❌ TABS close anchor (after replace) nahi mila.");
  process.exit(1);
}
src = src.slice(0, newCloseIdx) +
  `        ))}\n        </div>\n      </div>` +
  src.slice(newCloseIdx + tabsCloseAnchor.length);
changes.push("✅ Estimate button TABS bar me add kiya");

// ─────────────────────────────────────────────────────────────
// 4) Modal render + move-to-cart logic
//    Anchor: {feedbackOrder && <FeedbackModal ... />}
// ─────────────────────────────────────────────────────────────
const modalAnchor = `      {feedbackOrder && <FeedbackModal`;
if (!src.includes(modalAnchor)) {
  console.error("❌ Modal anchor 'feedbackOrder' nahi mila.");
  process.exit(1);
}
const estimateModal = `      {showEstimate && (
        <EstimatePanel
          C={C}
          menu={menu}
          isMobile={isMobile}
          onClose={() => setShowEstimate(false)}
          onMoveToCart={(est) => {
            setCart((prev) => {
              const next = { ...prev };
              est.forEach((e) => {
                next[e.id] = (Number(next[e.id]) || 0) + e.qty;
              });
              return next;
            });
            setShowEstimate(false);
            toast(\`✅ \${est.length} items cart me chale gaye\`, "success");
            if (!selectedTable) setActiveTab("tables");
          }}
        />
      )}
`;
src = src.replace(modalAnchor, estimateModal + modalAnchor);
changes.push("✅ Estimate modal + move-to-cart logic add ki");

// ─────────────────────────────────────────────────────────────
// Write back
// ─────────────────────────────────────────────────────────────
if (src === original) {
  console.error("❌ Koi change nahi hua.");
  process.exit(1);
}
fs.writeFileSync(filePath, src, "utf8");

console.log("\n🎉 Patch successfully applied!\n");
changes.forEach((c) => console.log(c));
console.log("\n📁 File updated:", filePath);
console.log("\n▶️  Ab apna dev server restart karo (npm start / npm run dev)");
console.log("▶️  Staff POS me '📋 Estimate' tab dikhega, usse use karo.\n");
