#!/usr/bin/env python3
# PATCH 6: Bulk Import (Gemini JSON -> vendors + expenses)
#
# Usage: python3 patch_staff6.py src/StaffApp.jsx
# Patch 4 + 5 laga hona chahiye PEHLE.

import sys, shutil, datetime

if len(sys.argv) < 2:
    print(__doc__); sys.exit(1)

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    src = f.read()

applied = 0; skipped = 0

def sub(name, old, new, count=1):
    global src, applied, skipped
    if new in src:
        print("PEHLE SE", name); return
    n = src.count(old)
    if n == count:
        src = src.replace(old, new); applied += 1; print("OK    ", name)
    else:
        skipped += 1; print("SKIP  ", name, "(%d mila, %d chahiye)" % (n, count))


IMPORT_BLOCK = r'''
// ===========================================================================
// BULK IMPORT (patch 6)
// Gemini se nikala hua JSON import karke vendors + expenses auto-create
// ===========================================================================

function ImportView({ C, isMobile, isOwner, waiterName, onDone }) {
  const toast = useToast(); const haptic = useHaptic();
  const G = goldOf(C); const GT = goldTextOf(C);
  const [rawJson, setRawJson] = useState("");
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [existingVendors, setExistingVendors] = useState([]);
  const [modeOverride, setModeOverride] = useState("");

  useEffect(() => {
    getDocs(collection(db, "vendors"))
      .then((s) => setExistingVendors(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, []);

  const parseJson = (text, overrideArg) => {
    const override = overrideArg === undefined ? modeOverride : overrideArg;
    setError(""); setResult(null);
    if (!text.trim()) { setParsed(null); return; }
    try {
      const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const obj = JSON.parse(clean);
      const bills = Array.isArray(obj) ? obj : (obj.bills || []);
      if (!Array.isArray(bills)) throw new Error("JSON mein 'bills' array nahi mila");
      const normalized = bills.map((b, i) => ({
        _idx: i,
        vendorName: String(b.vendorName || "").trim(),
        vendorPhone: b.vendorPhone ? String(b.vendorPhone).trim() : "",
        date: b.date || invDateKey(),
        amount: Number(b.amount) || 0,
        category: b.category || "Anya",
        mode: override || b.mode || "credit",
        note: b.note || "",
        confidence: Number(b.confidence) || 1,
        _valid: !!b.vendorName && Number(b.amount) > 0,
        _skip: false,
        _existingVendorId: "",
      }));
      normalized.forEach((n) => {
        const match = existingVendors.find((v) => v.name.toLowerCase() === n.vendorName.toLowerCase());
        if (match) n._existingVendorId = match.id;
      });
      setParsed(normalized);
    } catch (e) {
      setParsed(null);
      setError("JSON galat hai: " + e.message);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) { toast("Sirf .json file daalo", "warning"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const txt = String(ev.target.result || "");
      setRawJson(txt);
      parseJson(txt);
    };
    reader.readAsText(file);
  };

  const toggleSkip = (idx) => {
    setParsed((prev) => prev.map((p) => p._idx === idx ? { ...p, _skip: !p._skip } : p));
  };
  const editField = (idx, field, value) => {
    setParsed((prev) => prev.map((p) => {
      if (p._idx !== idx) return p;
      const upd = { ...p, [field]: value };
      upd._valid = !!upd.vendorName && Number(upd.amount) > 0;
      return upd;
    }));
  };

  const stats = useMemo(() => {
    if (!parsed) return null;
    const active = parsed.filter((p) => !p._skip && p._valid);
    const newVendors = new Set();
    active.forEach((p) => { if (!p._existingVendorId) newVendors.add(p.vendorName.toLowerCase()); });
    return {
      total: parsed.length,
      importing: active.length,
      skipped: parsed.filter((p) => p._skip).length,
      invalid: parsed.filter((p) => !p._skip && !p._valid).length,
      newVendors: newVendors.size,
      totalAmount: active.reduce((s, p) => s + Number(p.amount || 0), 0),
    };
  }, [parsed]);

  const runImport = async () => {
    if (!parsed || !stats || stats.importing === 0) { toast("Kuch import karne layak nahi", "warning"); return; }
    if (!window.confirm(stats.importing + " bills import honge. " + stats.newVendors + " naye vendor banenge. Confirm?")) return;
    setImporting(true);
    const imported = { expenses: 0, vendors: 0, errors: [] };
    try {
      const nameToId = {};
      existingVendors.forEach((v) => { nameToId[v.name.toLowerCase()] = v.id; });

      const newVendorNames = new Set();
      parsed.filter((p) => !p._skip && p._valid && !p._existingVendorId).forEach((p) => newVendorNames.add(p.vendorName));
      for (const vName of newVendorNames) {
        try {
          const ref = await addDoc(collection(db, "vendors"), {
            name: vName, phone: "", openingDue: 0, active: true, createdAt: Date.now(),
          });
          nameToId[vName.toLowerCase()] = ref.id;
          imported.vendors++;
        } catch (e) {
          imported.errors.push("Vendor '" + vName + "': " + e.message);
        }
      }

      const active = parsed.filter((p) => !p._skip && p._valid);
      for (let i = 0; i < active.length; i += 20) {
        const chunk = active.slice(i, i + 20);
        const batch = writeBatch(db);
        chunk.forEach((p) => {
          const vId = p._existingVendorId || nameToId[p.vendorName.toLowerCase()] || null;
          const ref = doc(collection(db, "expenses"));
          batch.set(ref, {
            date: p.date,
            amount: Number(p.amount),
            category: p.category,
            mode: p.mode,
            vendorId: vId,
            note: (p.note || "") + (p.vendorPhone ? " | " + p.vendorPhone : ""),
            by: waiterName || "Staff",
            createdAt: Date.now(),
            importedFrom: "gemini",
          });
          imported.expenses++;
        });
        await batch.commit();
      }

      try {
        await addDoc(collection(db, "auditLog"), {
          action: "bulk_import",
          amount: stats.totalAmount,
          count: imported.expenses,
          by: waiterName || "Staff",
          at: Date.now(),
          detail: imported.vendors + " new vendors, " + imported.expenses + " expenses",
        });
      } catch (e) {}

      haptic(50);
      setResult({ ok: true, ...imported, totalAmount: stats.totalAmount });
      toast("Import ho gaya: " + imported.expenses + " expenses, " + imported.vendors + " naye vendor", "success");
      if (onDone) onDone();
    } catch (e) {
      setResult({ ok: false, error: e.message });
      toast("Import fail: " + e.message, "error");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setRawJson(""); setParsed(null); setError(""); setResult(null);
  };

  const box = { background: C.card, border: "1px solid " + C.line, borderRadius: 14, padding: isMobile ? 14 : 18, marginBottom: 16 };
  const field = { width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1.5px solid " + C.line, borderRadius: 10, fontSize: 14, background: C.card, color: C.ink, outline: "none", fontFamily: "inherit" };

  if (!isOwner) {
    return (
      <div style={{ textAlign: "center", padding: 50, color: C.gray }}>
        <div style={{ fontSize: 44 }}>🔒</div>
        <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>Bulk import sirf owner kar sakta hai</div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>📥 Bulk Import</h2>
      <div style={{ fontSize: 12, color: C.gray, fontWeight: 700, marginBottom: 14 }}>
        Gemini se nikala hua JSON file yahan daalo - vendors aur expenses auto-create ho jayenge
      </div>

      {!parsed && !result && (
        <>
          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 10 }}>📸 Step 1: Bills ki photo Gemini ko bhejo</div>
            <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.6, marginBottom: 12 }}>
              Gemini ko bill photo + niche wala prompt bhejo. Wo aapko JSON dega. Us JSON ko <b>.json</b> file mein save karo.
            </div>
            <details style={{ marginBottom: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: GT, padding: "8px 0" }}>📋 Gemini Prompt dekho / copy karo</summary>
              <pre style={{ background: C.cardAlt, padding: 12, borderRadius: 8, fontSize: 10, overflowX: "auto", color: C.ink, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{`Tum ek restaurant accounting assistant ho. Main tumhe purane bill/invoice ki photo bhej raha hoon. Tumhe isse structured JSON nikaalna hai.

RULES:
1. Sirf valid JSON return karo, koi explanation nahi.
2. Agar koi field samajh nahi aaye toh null daalo.
3. Amount number mein.
4. Date YYYY-MM-DD format mein.
5. Category choose karo: ["Saman / Kaccha maal", "Salary", "Kiraya", "Gas / Coyla", "Bijli / Pani", "Repair", "Packing", "Marketing", "Anya"]
6. "paid" likha ho toh mode="cash", warna mode="credit".
7. Multiple bills ho toh array.

OUTPUT:
{
  "bills": [
    {
      "vendorName": "Ramesh Vegetables",
      "vendorPhone": "9876543210",
      "date": "2026-10-15",
      "amount": 10000,
      "category": "Saman / Kaccha maal",
      "mode": "credit",
      "note": "Paneer 5kg",
      "confidence": 0.95
    }
  ]
}`}</pre>
            </details>
          </div>

          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 10 }}>📁 Step 2: JSON file upload karo</div>
            <input type="file" accept=".json,application/json" onChange={handleFile} style={{ ...field, padding: 10, cursor: "pointer" }} />
            <div style={{ fontSize: 11, color: C.gray, marginTop: 8, fontWeight: 700 }}>Ya niche seedha paste karo:</div>
            <textarea
              value={rawJson}
              onChange={(e) => { setRawJson(e.target.value); parseJson(e.target.value); }}
              placeholder='{"bills": [{"vendorName": "...", "amount": 1000, ...}]}'
              style={{ ...field, minHeight: 160, marginTop: 8, fontFamily: "monospace", fontSize: 12 }}
            />
            {error && <div style={{ color: C.red, fontSize: 12, fontWeight: 700, marginTop: 8 }}>❌ {error}</div>}
          </div>

          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 10 }}>⚙️ Mode override (optional)</div>
            <div style={{ fontSize: 11, color: C.gray, marginBottom: 8 }}>Agar Gemini galat mode de raha ho toh yahan sabke liye fix karo:</div>
            <select value={modeOverride} onChange={(e) => { const v = e.target.value; setModeOverride(v); if (parsed) parseJson(rawJson, v); }} style={field}>
              <option value="">-- Gemini ka mode use karo --</option>
              <option value="cash">Sab Cash</option>
              <option value="credit">Sab Udhaar</option>
              <option value="upi">Sab UPI</option>
              <option value="bank">Sab Bank</option>
            </select>
          </div>
        </>
      )}

      {parsed && !result && (
        <>
          <div style={{ ...box, background: C.goldLight || C.cardAlt, border: "1.5px solid " + G }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
              <div><div style={{ fontSize: 10, color: C.gray, fontWeight: 800 }}>TOTAL</div><div style={{ fontSize: 20, fontWeight: 900, color: C.ink, fontFamily: "monospace" }}>{stats.total}</div></div>
              <div><div style={{ fontSize: 10, color: C.gray, fontWeight: 800 }}>IMPORT</div><div style={{ fontSize: 20, fontWeight: 900, color: C.green, fontFamily: "monospace" }}>{stats.importing}</div></div>
              <div><div style={{ fontSize: 10, color: C.gray, fontWeight: 800 }}>NEW VENDORS</div><div style={{ fontSize: 20, fontWeight: 900, color: GT, fontFamily: "monospace" }}>{stats.newVendors}</div></div>
              <div><div style={{ fontSize: 10, color: C.gray, fontWeight: 800 }}>AMOUNT</div><div style={{ fontSize: 16, fontWeight: 900, color: C.red, fontFamily: "monospace" }}>{inr(stats.totalAmount)}</div></div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={runImport} disabled={importing || stats.importing === 0} style={{ flex: 1, minWidth: 140, padding: 14, border: "none", borderRadius: 10, background: importing ? C.line : "linear-gradient(135deg, " + G + " 0%, " + (C.goldDark || G) + " 100%)", color: importing ? C.gray : "#fff", fontWeight: 900, fontSize: 15, cursor: importing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{importing ? "Import ho raha hai..." : "✅ " + stats.importing + " Bills Import Karo"}</button>
            <button onClick={reset} disabled={importing} style={{ padding: "14px 20px", border: "1.5px solid " + C.line, borderRadius: 10, background: "transparent", color: C.gray, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>

          <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 8 }}>Preview ({parsed.length} bills)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {parsed.map((p) => (
              <div key={p._idx} style={{ background: p._skip ? C.cardAlt : C.card, border: "1px solid " + (p._valid ? C.line : C.red), borderRadius: 10, padding: 10, opacity: p._skip ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 0 }}>
                    <input type="checkbox" checked={!p._skip} onChange={() => toggleSkip(p._idx)} style={{ cursor: "pointer" }} />
                    <input
                      value={p.vendorName}
                      onChange={(e) => editField(p._idx, "vendorName", e.target.value)}
                      placeholder="Vendor name"
                      style={{ ...field, padding: "6px 8px", fontSize: 13, fontWeight: 800 }}
                    />
                  </div>
                  <input
                    value={p.amount}
                    onChange={(e) => editField(p._idx, "amount", e.target.value)}
                    type="number"
                    placeholder="Amount"
                    style={{ ...field, padding: "6px 8px", fontSize: 13, width: 100, fontFamily: "monospace", fontWeight: 900 }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 6, fontSize: 11 }}>
                  <input value={p.date} onChange={(e) => editField(p._idx, "date", e.target.value)} type="date" style={{ ...field, padding: "5px 7px", fontSize: 11 }} />
                  <select value={p.category} onChange={(e) => editField(p._idx, "category", e.target.value)} style={{ ...field, padding: "5px 7px", fontSize: 11 }}>
                    {EXP_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={p.mode} onChange={(e) => editField(p._idx, "mode", e.target.value)} style={{ ...field, padding: "5px 7px", fontSize: 11 }}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                    <option value="credit">Udhaar</option>
                  </select>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, color: p._existingVendorId ? C.green : GT, padding: "5px 7px", background: C.cardAlt, borderRadius: 6 }}>
                    {p._existingVendorId ? "✓ existing" : "★ naya"}
                    <span style={{ color: C.gray, marginLeft: "auto" }}>{Math.round(p.confidence * 100)}%</span>
                  </div>
                </div>
                {p.note && <div style={{ fontSize: 11, color: C.gray, marginTop: 6, fontStyle: "italic" }}>{p.note}</div>}
                {!p._valid && <div style={{ fontSize: 11, color: C.red, marginTop: 4, fontWeight: 700 }}>⚠️ Vendor name ya amount missing</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {result && (
        <div style={{ ...box, border: "2px solid " + (result.ok ? C.green : C.red), textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>{result.ok ? "✅" : "❌"}</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: result.ok ? C.green : C.red, marginTop: 8 }}>{result.ok ? "Import Successful" : "Import Failed"}</div>
          {result.ok ? (
            <div style={{ marginTop: 12, fontSize: 13, color: C.ink, fontWeight: 700 }}>
              <div>{result.expenses} expenses add huye</div>
              <div>{result.vendors} naye vendors bane</div>
              <div>Total: {inr(result.totalAmount)}</div>
              {result.errors && result.errors.length > 0 && <div style={{ color: C.amber, marginTop: 8, fontSize: 11 }}>{result.errors.length} errors - check console</div>}
            </div>
          ) : (
            <div style={{ marginTop: 12, fontSize: 12, color: C.red }}>{result.error}</div>
          )}
          <button onClick={reset} style={{ marginTop: 16, padding: "12px 24px", border: "none", borderRadius: 10, background: G, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Naya Import Karo</button>
        </div>
      )}
    </div>
  );
}
'''
sub("Import block add",
    "class ErrorBoundary extends React.Component {",
    IMPORT_BLOCK + "\nclass ErrorBoundary extends React.Component {")


sub("Sidebar: Import tab",
    '{ id: "reports", label: "Reports / P&L", icon: "📈" }',
    '{ id: "reports", label: "Reports / P&L", icon: "📈" }, { id: "import", label: "Bulk Import", icon: "📥" }')

sub("Sidebar render Import",
    '{activeTab === "reports" && <ReportsView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} />}',
    '{activeTab === "reports" && <ReportsView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} />}\n        {activeTab === "import" && <ImportView C={C} isMobile={isMobile} isOwner={isOwner} waiterName={waiterName} onDone={() => {}} />}')

sub("Top tabs: Import",
    '{ id: "reports", label: "📈 Reports" },',
    '{ id: "reports", label: "📈 Reports" },\n          { id: "import", label: "📥 Import" },')


if applied:
    bak = path + ".bak6-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copyfile(path, bak)
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)
    print("\nBackup:", bak)

print("\nLaga: %d  |  Skip: %d" % (applied, skipped))
print("Ab chalao: npm run build")