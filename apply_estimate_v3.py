#!/usr/bin/env python3
"""
Estimate Panel v3 (rule-based qty) - v2 ke upar lagao.

Usage (project root me):
    python3 apply_estimate_v3.py                 # file khud dhoondh lega
    python3 apply_estimate_v3.py src/StaffApp.jsx

Sirf Estimate panel wala block badalta hai. Backup: <file>.v2.bak
"""
import sys, glob, shutil

SEP = "// ==========================================================================="

NEW_PANEL = r'''// ===========================================================================
// 📋 ESTIMATE PANEL v3 — rule-based qty (pc / roti / rice / dal), persistent items
// ===========================================================================
//LOGIC-START
// 👉 Apne hisaab se yahan numbers badal sakte ho
const EST_LEVELS = [
  { id: "kam", label: "Kam", pc: 2, roti: 2, rice: 0.33, dal: 0.25, drink: 1 },
  { id: "normal", label: "Normal", pc: 3, roti: 2, rice: 0.4, dal: 0.33, drink: 1 },
  { id: "zyada", label: "Zyada", pc: 4, roti: 3, rice: 0.5, dal: 0.4, drink: 1 },
];
const EST_PC_DEFAULT = 8;        // ek plate me kitne piece (naam me "(4pc)" ho to wahi use hoga)
const EST_PC_EXTRA_PER_DISH = 1; // 2+ sabzi hon to per log total piece itna badhta hai (dish ginti - 1) x ye

function estKind(m) {
  const n = String(m.name || "").toLowerCase();
  const t = n + " " + String(m.category || "").toLowerCase();
  if (/roti|naan|paratha|kulcha|phulka|chapati/.test(n)) return "roti";
  if (/biryani|rice|pulao|pulav/.test(n)) return "rice";
  if (/\bdal\b|daal|dhal/.test(n)) return "dal";
  if (/water|cold drink|coke|pepsi|sprite|soda|lassi|juice|mojito|shake|coffee|\btea\b|chai/.test(n)) return "drink";
  if (/momo|roll|burger|pizza|sandwich|fries|maggi|pasta|noodle|chowmein|chaumin|soup|ice cream|dessert|sweet|gulab|rasgulla|rasmalai|salad|papad|raita/.test(t)) return "other";
  if (/paneer|mushroom|chicken|mutton|fish|egg|manchurian|chilly|chilli|kadai|kadhai|masala|curry|tikka|kabab|kebab|soya|chaap|veg|gobi|aloo|sabzi|handi|korma|butter|tandoor|starter|main|gravy|dry|chinese/.test(t)) return "pc";
  return "other";
}
function estPcPerPlate(name) {
  const mm = String(name || "").match(/(\d+)\s*(pc|pcs|piece|pieces)\b/i);
  return mm && Number(mm[1]) > 0 ? Number(mm[1]) : EST_PC_DEFAULT;
}
const estFmt = (n) => String(Math.round(n * 100) / 100);
const estCeil = (x) => Math.max(1, Math.ceil(x - 0.05));

// items: [{id,name,price,qty}], menuById: {id: menuItem}, pax: number, lv: EST_LEVELS entry
// return: { [id]: { qty, note } }  (sirf wahi items jinka rule hai)
function estCompute(items, menuById, pax, lv) {
  const groups = { pc: [], roti: [], rice: [], dal: [], drink: [] };
  items.forEach((i) => {
    const k = estKind(menuById[i.id] || i);
    if (groups[k]) groups[k].push(i);
  });
  const out = {};
  const nPc = groups.pc.length;
  if (nPc) {
    const pool = lv.pc + EST_PC_EXTRA_PER_DISH * (nPc - 1); // per log total piece (sab sabzi mila ke)
    const share = pool / nPc;                                // per log, is dish ke piece
    groups.pc.forEach((i) => {
      const per = estPcPerPlate(i.name);
      const pieces = share * pax;
      const qty = estCeil(pieces / per);
      out[i.id] = { qty, note: pax + " log x " + estFmt(share) + " pc = " + Math.round(pieces) + " pc / " + per + " pc plate = " + qty + " plate" };
    });
  }
  [["roti", "roti", "roti"], ["rice", "rice", "plate"], ["dal", "dal", "plate"], ["drink", "drink", "pc"]].forEach(([g, key, unit]) => {
    const arr = groups[g];
    if (!arr.length) return;
    const total = (pax * lv[key]) / arr.length;
    arr.forEach((i) => {
      const qty = estCeil(total);
      out[i.id] = { qty, note: pax + " log x " + estFmt(lv[key]) + " " + unit + (arr.length > 1 ? " / " + arr.length + " item" : "") + " = " + qty };
    });
  });
  return out;
}
//LOGIC-END

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
  const toast = useToast();
  const [search, setSearch] = React.useState("");
  const dSearch = useDebounce(search, 150);
  const [catFilter, setCatFilter] = React.useState("All");
  const [showSel, setShowSel] = React.useState(false);
  const [level, setLevel] = React.useState(() => { try { return localStorage.getItem("staff_estimate_level") || "normal"; } catch (e) { return "normal"; } });

  const lv = EST_LEVELS.find((l) => l.id === level) || EST_LEVELS[1];
  const pax = Math.max(1, Number(persons) || 1);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const qtyOf = (id) => { const it = items.find((p) => p.id === id); return it ? it.qty : 0; };

  const menuById = React.useMemo(() => { const o = {}; menu.forEach((m) => { o[m.id] = m; }); return o; }, [menu]);
  const sug = React.useMemo(() => estCompute(items, menuById, pax, lv), [items, menuById, pax, lv]);

  const pickLevel = (id) => { haptic(6); setLevel(id); try { localStorage.setItem("staff_estimate_level", id); } catch (e) {} };

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
  const applyAuto = () => {
    if (!items.length) { toast("Pehle items add karo, phir Auto qty dabao", "warning"); return; }
    const n = Object.keys(sug).length;
    if (!n) { toast("In items ke liye auto rule nahi hai, qty khud badlo", "warning"); return; }
    haptic(12);
    setItems((prev) => prev.map((p) => (sug[p.id] ? { ...p, qty: sug[p.id].qty } : p)));
    setShowSel(true);
    toast("✅ " + n + " items ki qty " + pax + " log ke hisaab se set ho gayi", "success");
  };
  const setPax = (v) => {
    if (v === "") { setPersons(""); return; }
    const n = Math.max(1, Math.min(999, parseInt(v, 10) || 1));
    setPersons(n);
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
  const sb = { width: 36, height: 36, border: "none", fontSize: 18, fontWeight: 900, cursor: "pointer", padding: 0, fontFamily: "inherit" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ textAlign: "left", background: C.card, color: C.ink, borderRadius: isMobile ? "20px 20px 0 0" : 16, width: "100%", maxWidth: isMobile ? "100%" : 620, height: isMobile ? "94vh" : "88vh", display: "flex", flexDirection: "column", overflow: "hidden", animation: isMobile ? "slideUp .25s ease-out" : "scaleIn .18s ease-out", boxShadow: "0 -8px 40px rgba(0,0,0,.25)" }}>

        {/* HEADER */}
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid " + C.line, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 19, fontWeight: 900 }}>📋 Estimate</div>
            <button onClick={onClose} style={{ background: C.cardAlt, border: "none", borderRadius: "50%", width: 34, height: 34, fontSize: 15, cursor: "pointer", color: C.ink }}>✕</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cardAlt, borderRadius: 12, padding: "8px 12px", marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>👥 Kitne log?</span>
            <div style={{ display: "flex", alignItems: "center", border: "1.5px solid " + C.gold, borderRadius: 10, overflow: "hidden", background: C.card }}>
              <button onClick={() => setPax(pax - 1)} style={{ ...sb, background: C.cardAlt, color: C.ink }}>−</button>
              <input type="number" inputMode="numeric" min="1" value={persons} onChange={(e) => setPax(e.target.value)} onFocus={(e) => e.target.select()} style={{ width: 62, height: 36, border: "none", textAlign: "center", fontSize: 16, fontWeight: 900, fontFamily: "monospace", background: C.card, color: C.ink, outline: "none", boxSizing: "border-box" }} />
              <button onClick={() => setPax(pax + 1)} style={{ ...sb, background: C.gold, color: "#fff" }}>+</button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {EST_LEVELS.map((l) => (
              <button key={l.id} onClick={() => pickLevel(l.id)} style={{ padding: "7px 12px", borderRadius: 20, border: "1.5px solid " + (level === l.id ? C.gold : C.line), background: level === l.id ? C.goldLight : C.card, color: level === l.id ? C.goldText : C.gray, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{l.label}</button>
            ))}
            <button onClick={applyAuto} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, " + C.gold + " 0%, " + C.goldDark + " 100%)", color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>⚡ Auto qty</button>
          </div>
          <div style={{ fontSize: 10, color: C.gray, fontWeight: 700, marginTop: 6, lineHeight: 1.4 }}>
            Per log: sabzi/dry {lv.pc} pc ({EST_PC_DEFAULT} pc plate) · roti {lv.roti} · rice {estFmt(lv.rice)} plate · dal {estFmt(lv.dal)} plate
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
            <div style={{ maxHeight: isMobile ? 150 : 190, overflowY: "auto", marginBottom: 8, border: "1px solid " + C.line, borderRadius: 10 }}>
              {items.map((i) => {
                const s = sug[i.id];
                return (
                  <div key={i.id} style={{ padding: "7px 10px", borderBottom: "1px dashed " + C.line }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</span>
                      <EstStepper C={C} q={i.qty} onChange={(v) => setQty(i, v)} size={26} />
                      <span style={{ width: 60, textAlign: "right", fontSize: 12, fontWeight: 900, fontFamily: "monospace" }}>{inr(i.price * i.qty)}</span>
                      <button onClick={() => removeId(i.id)} style={{ border: "none", background: "transparent", color: C.red, fontSize: 15, cursor: "pointer", padding: 2 }}>✕</button>
                    </div>
                    {s && (
                      <div style={{ fontSize: 10, color: C.gray, fontWeight: 700, marginTop: 3 }}>
                        {s.note}
                        {s.qty !== i.qty && <button onClick={() => setQty(i, s.qty)} style={{ marginLeft: 6, border: "1px solid " + C.gold, background: "transparent", color: C.goldText, borderRadius: 8, fontSize: 10, fontWeight: 800, padding: "1px 7px", cursor: "pointer", fontFamily: "inherit" }}>→ {s.qty} karo</button>}
                      </div>
                    )}
                  </div>
                );
              })}
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


def die(msg):
    print("❌ " + msg)
    print("File me koi badlav NAHI hua.")
    sys.exit(1)


def find_file():
    if len(sys.argv) > 1:
        return sys.argv[1]
    cands = [p for p in glob.glob("**/*.jsx", recursive=True) + glob.glob("**/*.js", recursive=True)
             if "node_modules" not in p and "ESTIMATE PANEL v2" in open(p, encoding="utf-8", errors="ignore").read()]
    if len(cands) == 1:
        return cands[0]
    die("Staff file nahi mili ya ek se zyada hain: %s\nPath do: python3 apply_estimate_v3.py src/StaffApp.jsx" % cands)


def main():
    path = find_file()
    src = open(path, encoding="utf-8").read()
    print("📄 File:", path)

    if "ESTIMATE PANEL v3" in src:
        die("v3 pehle se lagi hui hai.")
    i_est = src.find("// 📋 ESTIMATE PANEL v2")
    if i_est < 0:
        die("v2 nahi mili. Pehle apply_estimate_v2.py chalao.")
    i_main = src.find("// MAIN APP")
    if i_main < 0 or i_main < i_est:
        die("MAIN APP banner nahi mila.")
    start = src.rfind(SEP, 0, i_est)
    end = src.rfind(SEP, 0, i_main)
    if start < 0 or end <= start:
        die("Banner lines nahi mili.")

    out = src[:start] + NEW_PANEL + src[end:]
    shutil.copyfile(path, path + ".v2.bak")
    open(path, "w", encoding="utf-8").write(out)
    print("✅ Estimate v3 lag gayi")
    print("💾 Backup:", path + ".v2.bak")


if __name__ == "__main__":
    main()
