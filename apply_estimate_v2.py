#!/usr/bin/env python3
"""
Estimate Panel v2 auto-patch for Eat & Park Staff app.

Usage (Codespace terminal, project root me):
    python3 apply_estimate_v2.py                 # file khud dhoondh lega
    python3 apply_estimate_v2.py src/StaffApp.jsx

Safe: pehle saare anchors check karta hai, kuch na mila to file ko haath nahi lagata.
Backup: <file>.bak
"""
import sys, glob, shutil, os

NEW_PANEL = r'''// ===========================================================================
// 📋 ESTIMATE PANEL v2 — persistent items, manual qty, popular picks
// ===========================================================================
function EstStepper({ C, q, onChange, size = 32 }) {
  const b = { width: size, height: size, border: "none", fontSize: 17, fontWeight: 900, cursor: "pointer", padding: 0, fontFamily: "inherit" };
  return (
    <div style={{ display: "flex", alignItems: "center", border: "1.5px solid " + C.gold, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: C.card }}>
      <button onClick={() => onChange(q - 1)} style={{ ...b, background: C.cardAlt, color: C.ink }}>−</button>
      <span style={{ minWidth: 30, textAlign: "center", fontWeight: 900, fontSize: 14, color: C.ink, fontFamily: "monospace" }}>{q}</span>
      <button onClick={() => onChange(q + 1)} style={{ ...b, background: C.gold, color: "#fff" }}>+</button>
    </div>
  );
}

function EstimatePanel({ C, menu, orders, isMobile, items, setItems, persons, setPersons, onClose, onMoveToCart }) {
  const haptic = useHaptic();
  const [search, setSearch] = React.useState("");
  const dSearch = useDebounce(search, 150);
  const [catFilter, setCatFilter] = React.useState("All");
  const [showSel, setShowSel] = React.useState(false);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const pax = Math.max(1, Number(persons) || 1);
  const qtyOf = (id) => { const it = items.find((p) => p.id === id); return it ? it.qty : 0; };

  const setQty = (m, q) => {
    haptic(6);
    setItems((prev) => {
      if (q <= 0) return prev.filter((p) => p.id !== m.id);
      if (prev.some((p) => p.id === m.id)) return prev.map((p) => (p.id === m.id ? { ...p, qty: q } : p));
      return [...prev, { id: m.id, name: m.name, price: Number(m.price) || 0, qty: q }];
    });
  };
  const removeId = (id) => setItems((prev) => prev.filter((p) => p.id !== id));
  const clearAll = () => {
    if (!items.length) return;
    if (window.confirm("Estimate ke saare items hata dein?")) { setItems([]); setShowSel(false); }
  };

  const categories = React.useMemo(
    () => ["All", ...Array.from(new Set(menu.map((m) => m.category).filter(Boolean)))],
    [menu]
  );

  const popular = React.useMemo(() => {
    const cnt = {};
    (orders || []).forEach((o) => {
      if (o.status === "cancelled") return;
      (o.items || []).forEach((it) => { cnt[it.itemId] = (cnt[it.itemId] || 0) + (Number(it.qty) || 0); });
    });
    const seen = new Set();
    return menu
      .filter((m) => m.available !== false && cnt[m.id])
      .sort((a, b) => cnt[b.id] - cnt[a.id])
      .filter((m) => { const k = String(m.name || "").trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 8);
  }, [orders, menu]);

  const filtered = React.useMemo(() => {
    const s = dSearch.trim().toLowerCase();
    return menu.filter((m) =>
      m.available !== false &&
      (catFilter === "All" || m.category === catFilter) &&
      (!s || String(m.name || "").toLowerCase().includes(s))
    ).slice(0, 250);
  }, [menu, dSearch, catFilter]);

  const chip = (active) => ({
    padding: "7px 14px", borderRadius: 20, border: "1px solid " + (active ? C.gold : C.line),
    background: active ? C.gold : C.card, color: active ? "#fff" : C.gray,
    fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, color: C.ink, borderRadius: isMobile ? "20px 20px 0 0" : 16, width: "100%", maxWidth: isMobile ? "100%" : 620, height: isMobile ? "94vh" : "88vh", display: "flex", flexDirection: "column", overflow: "hidden", animation: isMobile ? "slideUp .25s ease-out" : "scaleIn .18s ease-out", boxShadow: "0 -8px 40px rgba(0,0,0,.25)" }}>

        {/* HEADER */}
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid " + C.line, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 19, fontWeight: 900 }}>📋 Estimate</div>
            <button onClick={onClose} style={{ background: C.cardAlt, border: "none", borderRadius: "50%", width: 34, height: 34, fontSize: 15, cursor: "pointer", color: C.ink }}>✕</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cardAlt, borderRadius: 12, padding: "8px 12px" }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>👥 Kitne log?</span>
            <EstStepper C={C} q={pax} onChange={(v) => setPersons(Math.max(1, v))} size={34} />
          </div>
        </div>

        {/* SCROLL AREA */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px" }}>
          <input placeholder="🔍 Item search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid " + C.line, fontSize: 14, boxSizing: "border-box", background: C.card, color: C.ink, outline: "none", marginBottom: 10 }} />

          {!search.trim() && catFilter === "All" && popular.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>🔥 Zyada bikne wale (tap = +1)</div>
              <div className="ep-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                {popular.map((m) => {
                  const q = qtyOf(m.id);
                  return (
                    <button key={m.id} onClick={() => setQty(m, q + 1)} style={{ padding: "8px 12px", borderRadius: 20, border: "1.5px solid " + C.gold, background: q ? C.gold : C.goldLight, color: q ? "#fff" : C.goldText, fontWeight: 800, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit" }}>{m.name}{q ? " ×" + q : ""}</button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="ep-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
            {categories.map((c) => (
              <button key={c} onClick={() => setCatFilter(c)} style={chip(catFilter === c)}>{c}</button>
            ))}
          </div>

          <div style={{ border: "1px solid " + C.line, borderRadius: 12, overflow: "hidden" }}>
            {filtered.map((m) => {
              const q = qtyOf(m.id);
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid " + C.line, background: q > 0 ? C.goldLight : "transparent" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, lineHeight: 1.25 }}>{m.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.goldText, fontFamily: "monospace", marginTop: 2 }}>{inr(m.price)}</div>
                  </div>
                  {q > 0
                    ? <EstStepper C={C} q={q} onChange={(v) => setQty(m, v)} />
                    : <button onClick={() => setQty(m, 1)} style={{ padding: "8px 16px", borderRadius: 10, border: "1.5px solid " + C.gold, background: "transparent", color: C.goldText, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>+ Add</button>}
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", color: C.gray, fontSize: 13 }}>Koi item nahi mila</div>}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ borderTop: "2px solid " + C.line, background: C.card, padding: "10px 16px 14px", flexShrink: 0 }}>
          {showSel && items.length > 0 && (
            <div style={{ maxHeight: 170, overflowY: "auto", marginBottom: 8, border: "1px solid " + C.line, borderRadius: 10 }}>
              {items.map((i) => (
                <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: "1px dashed " + C.line }}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</span>
                  <EstStepper C={C} q={i.qty} onChange={(v) => setQty(i, v)} size={26} />
                  <span style={{ width: 60, textAlign: "right", fontSize: 12, fontWeight: 900, fontFamily: "monospace" }}>{inr(i.price * i.qty)}</span>
                  <button onClick={() => removeId(i.id)} style={{ border: "none", background: "transparent", color: C.red, fontSize: 15, cursor: "pointer", padding: 2 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
            <button onClick={() => setShowSel((v) => !v)} disabled={!items.length} style={{ border: "none", background: "transparent", color: C.goldText, fontWeight: 800, fontSize: 12, cursor: items.length ? "pointer" : "default", padding: 0, fontFamily: "inherit" }}>
              {items.length} item ({count} qty) {items.length ? (showSel ? "▼" : "▲") : ""}
            </button>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.goldText, fontFamily: "monospace", lineHeight: 1.1 }}>{inr(total)}</div>
              <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>Per person {inr(Math.round(total / pax))}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={clearAll} disabled={!items.length} style={{ padding: "13px 16px", border: "1.5px solid " + (items.length ? C.red : C.line), borderRadius: 12, background: "transparent", color: items.length ? C.red : C.gray, fontWeight: 800, fontSize: 13, cursor: items.length ? "pointer" : "not-allowed", fontFamily: "inherit" }}>Clear</button>
            <button disabled={!items.length} onClick={() => onMoveToCart(items)} style={{ flex: 1, padding: 13, border: "none", borderRadius: 12, background: items.length ? "linear-gradient(135deg, " + C.green + " 0%, #15803D 100%)" : C.line, color: items.length ? "#fff" : C.gray, fontSize: 15, fontWeight: 900, cursor: items.length ? "pointer" : "not-allowed", fontFamily: "inherit" }}>✅ Cart me bhejo</button>
          </div>
        </div>
      </div>
    </div>
  );
}

'''

STATE_ADD = r'''
  const [estItems, setEstItems] = useState(() => { try { return JSON.parse(localStorage.getItem("staff_estimate_items") || "[]"); } catch (e) { return []; } });
  const [estPersons, setEstPersons] = useState(() => Number(localStorage.getItem("staff_estimate_persons")) || 2);
  useEffect(() => {
    try { localStorage.setItem("staff_estimate_items", JSON.stringify(estItems)); localStorage.setItem("staff_estimate_persons", String(estPersons)); } catch (e) {}
  }, [estItems, estPersons]);'''

USAGE = r'''{showEstimate && (
        <EstimatePanel
          C={C}
          menu={menu}
          orders={orders}
          isMobile={isMobile}
          items={estItems}
          setItems={setEstItems}
          persons={estPersons}
          setPersons={setEstPersons}
          onClose={() => setShowEstimate(false)}
          onMoveToCart={(est) => {
            setCart((prev) => {
              const next = { ...prev };
              est.forEach((e) => { next[e.id] = e.qty; });
              return next;
            });
            setShowEstimate(false);
            toast(`✅ ${est.length} items cart me hain - ab table ya Parcel chuno`, "success");
            setEstimatePending(true);
            if (!selectedTable) setActiveTab("tables");
          }}
        />
      )}
      '''

SEP = "// ==========================================================================="


def die(msg):
    print("❌ " + msg)
    print("File me koi badlav NAHI hua.")
    sys.exit(1)


def find_file():
    if len(sys.argv) > 1:
        return sys.argv[1]
    cands = [p for p in glob.glob("**/*.jsx", recursive=True) + glob.glob("**/*.js", recursive=True)
             if "node_modules" not in p and "EP-EST-v1" in open(p, encoding="utf-8", errors="ignore").read()]
    if len(cands) == 1:
        return cands[0]
    die("Staff file nahi mili ya ek se zyada hain: %s\nPath do: python3 apply_estimate_v2.py src/StaffApp.jsx" % cands)


def main():
    path = find_file()
    src = open(path, encoding="utf-8").read()
    print("📄 File:", path)

    if "ESTIMATE PANEL v2" in src:
        die("Estimate v2 pehle se lagi hui hai.")

    # ---- Edit 1: purana estimate block -> naya
    i_est = src.find("// 📋 ESTIMATE PANEL")
    i_main = src.find("// MAIN APP")
    if i_est < 0 or i_main < 0 or i_main < i_est:
        die("Edit 1: ESTIMATE PANEL / MAIN APP banner nahi mile.")
    start = src.rfind(SEP, 0, i_est)
    end = src.rfind(SEP, 0, i_main)
    if start < 0 or end < 0 or end <= start:
        die("Edit 1: banner lines nahi mili.")

    # ---- Edit 2
    a2 = "const [showEstimate, setShowEstimate] = useState(false);"
    if src.count(a2) != 1:
        die("Edit 2: showEstimate state line nahi mili.")

    # ---- Edit 3
    a3 = ">📋 Estimate</button>"
    if src.count(a3) != 1:
        die("Edit 3: Estimate tab button nahi mila.")

    # ---- Edit 4
    u_start = src.find("{showEstimate && (")
    u_end = src.find("{feedbackOrder && <FeedbackModal")
    if u_start < 0 or u_end < 0 or u_end < u_start:
        die("Edit 4: <EstimatePanel> usage block nahi mila.")

    # ---- Edit 5
    a5 = "setCart({}); setSelectedTable(null); setBillOrder(null); setAddMoreMode(false);\n    await signOut(auth);"
    has5 = src.count(a5) == 1

    # ---- Apply (peeche se aage, taaki index na bigde)
    out = src
    out = out[:u_start] + USAGE + out[u_end:]                       # 4
    out = out.replace(a3, ">📋 Estimate{estItems.length ? ` (${estItems.length})` : \"\"}</button>")  # 3
    out = out.replace(a2, a2 + STATE_ADD)                            # 2
    out = out[:start] + NEW_PANEL + out[end:]                        # 1 (usage/state ke baad, par index start<end pehle ke hain)
    if has5:                                                         # 5
        out = out.replace(a5, "setCart({}); setSelectedTable(null); setBillOrder(null); setAddMoreMode(false);\n    setEstItems([]); try { localStorage.removeItem(\"staff_estimate_items\"); } catch (e) {}\n    await signOut(auth);")

    shutil.copyfile(path, path + ".bak")
    open(path, "w", encoding="utf-8").write(out)
    print("✅ Edit 1-4 lag gaye" + (" + Edit 5" if has5 else " (Edit 5 skip: logout line match nahi hui, optional hai)"))
    print("💾 Backup:", path + ".bak")


if __name__ == "__main__":
    main()
