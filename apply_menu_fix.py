#!/usr/bin/env python3
# apply_menu_fix.py — Ek button jo sab theek karta hai (Auto-finds App.js)
import os, sys, re, shutil
from datetime import datetime

# ── 1. App.js dhundho (recursively) ──────────────────────────────
found_files = []
for root, dirs, files in os.walk("."):
    # Ignore useless folders
    dirs[:] = [d for d in dirs if d not in ["node_modules", ".git", "dist", "build", ".next", "out"]]
    for file in files:
        if file in ["App.js", "App.jsx"]:
            found_files.append(os.path.join(root, file))

if not found_files:
    print("❌ App.js ya App.jsx project me kahin nahi mila.")
    sys.exit(1)

if len(found_files) == 1:
    path = found_files[0]
    print(f"✅ Target mil gaya: {path}")
else:
    print("⚠️ Ek se zyada App.js mile:")
    for i, p in enumerate(found_files):
        print(f"  [{i+1}] {p}")
    choice = input("Kaunsa edit karna hai? (number daalo, e.g. 1): ")
    try:
        path = found_files[int(choice)-1]
    except:
        print("❌ Galat choice.")
        sys.exit(1)

content = open(path, encoding="utf-8").read()

if "ONE-SHOT MENU FIX" in content:
    print("⚠️  Fix pehle se laga hai. Kuch nahi kiya.")
    sys.exit(0)

# ── 2. STATE + HELPERS ────────────────────────────
STATE_CODE = r'''
  // 🩹 ONE-SHOT MENU FIX — duplicates + naam + desc + photos (Wikipedia→Cloudinary)
  const [fixState, setFixState] = useState(null);
  const [fixReport, setFixReport] = useState(null);
  const [fixProgress, setFixProgress] = useState({ done: 0, total: 0, msg: "" });
  const CLOUD_NAME = "nnddxvcn";
  const UPLOAD_PRESET = "eatpark_uploads";
  const isOwnImage = (u) => /cloudinary\.com|pexels\.com/.test(u || "");
  const normalizeDishName = (s) => {
    let n = String(s || "").replace(/\s+/g, " ").trim();
    n = n.replace(/\bchilly\b/gi, "Chilli").replace(/\bchily\b/gi, "Chilli").replace(/\bchili\b/gi, "Chilli").replace(/\bmutter\b/gi, "Mutton");
    return n.split(" ").map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : "").join(" ");
  };
  const normalizeDesc = (s, name) => {
    let d = String(s || "").replace(/\s+/g, " ").trim();
    if (!d || d.length < 6) return `${name || "Fresh dish"} — freshly prepared with quality ingredients.`;
    if (!/[.!?]$/.test(d)) d += ".";
    return d[0].toUpperCase() + d.slice(1);
  };
  const wikiImage = async (dishName) => {
    const clean = String(dishName || "").replace(/\(.*?\)/g, "").replace(/\b\d+\s*(pc|pcs|piece|pieces|kg|gm|ml|ltr|plate|eggs?)\b/gi, "").replace(/\b(half|full|quarter|regular|special|small|large|medium|dry|gravy|steam|fry|tandoori)\b/gi, "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(clean + " food")}&gsrlimit=1&prop=pageimages&piprop=thumbnail|original&pithumbsize=600&format=json&origin=*`;
      const r = await fetch(url);
      if (!r.ok) return "";
      const d = await r.json();
      const first = Object.values(d?.query?.pages || {})[0];
      const img = first?.thumbnail?.source || first?.original?.source;
      if (img && /\.(jpe?g|png|webp)/i.test(img)) return img;
    } catch (e) {}
    return "";
  };
  const cloudinaryUpload = async (remoteUrl) => {
    try {
      const fd = new FormData();
      fd.append("file", remoteUrl);
      fd.append("upload_preset", UPLOAD_PRESET);
      fd.append("folder", "eatpark_auto");
      const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
      if (r.ok) { const d = await r.json(); if (d.secure_url) return d.secure_url; }
    } catch (e) {}
    try {
      const ir = await fetch(remoteUrl, { mode: "cors" });
      if (!ir.ok) return "";
      const blob = await ir.blob();
      const fd = new FormData();
      fd.append("file", blob, "auto.jpg");
      fd.append("upload_preset", UPLOAD_PRESET);
      fd.append("folder", "eatpark_auto");
      const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
      if (r.ok) { const d = await r.json(); return d.secure_url || ""; }
    } catch (e) {}
    return "";
  };
  const scanFix = () => {
    setFixState("scanning");
    try {
      const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
      const richness = (m) => (isOwnImage(m.image) ? 20 : 0) + (m.image ? 5 : 0) + (m.desc ? 3 : 0) + (m.isBestseller ? 2 : 0) + ((m.alsoIn || []).length);
      const seen = {}, dupDeleteIds = new Set(), dupPairs = [];
      [...menu].sort((a, b) => richness(b) - richness(a)).forEach((m) => {
        const key = [norm(m.name), norm(m.portion), norm(m.category), Math.round(Number(m.price) || 0)].join("|");
        if (seen[key]) { dupDeleteIds.add(m.id); dupPairs.push({ keep: seen[key].name, del: m.name, price: m.price }); }
        else seen[key] = m;
      });
      const surviving = menu.filter(m => !dupDeleteIds.has(m.id));
      const nameFixes = [], descFixes = [];
      surviving.forEach(m => {
        const newName = normalizeDishName(m.name);
        if (newName && newName !== m.name) nameFixes.push({ id: m.id, from: m.name, to: newName });
        const newDesc = normalizeDesc(m.desc, newName || m.name);
        if (newDesc !== (m.desc || "")) descFixes.push({ id: m.id, from: m.desc || "(empty)", to: newDesc });
      });
      const imgTargets = surviving.filter(m => !isOwnImage(m.image)).map(m => ({ id: m.id, name: m.name, category: m.category }));
      setFixReport({ dupPairs, dupDeleteIds: [...dupDeleteIds], nameFixes, descFixes, imgTargets });
      setFixState("report");
    } catch (e) { alert("❌ Scan fail: " + e.message); setFixState(null); }
  };
  const applyFix = async () => {
    if (!fixReport) return;
    const { dupDeleteIds, nameFixes, descFixes, imgTargets } = fixReport;
    const totalSteps = dupDeleteIds.length + nameFixes.length + descFixes.length + imgTargets.length;
    if (!window.confirm(`Final fix:\n• ${dupDeleteIds.length} duplicates delete\n• ${nameFixes.length} naam fix\n• ${descFixes.length} description fix\n• ${imgTargets.length} photo fetch\n\nBackup pehle save hoga. Continue?`)) return;
    setFixState("applying");
    setFixProgress({ done: 0, total: totalSteps, msg: "Backup save..." });
    try {
      try { localStorage.setItem("menu_backup_" + Date.now(), JSON.stringify({ at: Date.now(), menu })); } catch (e) {}
      try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ at: Date.now(), menu }, null, 2)], { type: "application/json" })); a.download = `menu-backup-${Date.now()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); } catch (e) {}
      const delSet = new Set(dupDeleteIds);
      const nameMap = Object.fromEntries(nameFixes.map(n => [n.id, n.to]));
      const descMap = Object.fromEntries(descFixes.map(n => [n.id, n.to]));
      let working = menu.filter(m => !delSet.has(m.id)).map(m => { let o = { ...m }; if (nameMap[m.id]) o.name = nameMap[m.id]; if (descMap[m.id]) o.desc = descMap[m.id]; return o; });
      let done = dupDeleteIds.length + nameFixes.length + descFixes.length;
      setFixProgress({ done, total: totalSteps, msg: "Photos fetch..." });
      for (let i = 0; i < imgTargets.length; i++) {
        const t = imgTargets[i];
        setFixProgress({ done: done + i, total: totalSteps, msg: `🖼️ ${i + 1}/${imgTargets.length}: ${t.name}` });
        try {
          const wikiUrl = await wikiImage(t.name);
          if (wikiUrl) { const cdnUrl = await cloudinaryUpload(wikiUrl); if (cdnUrl) working = working.map(m => m.id === t.id ? { ...m, image: cdnUrl } : m); }
        } catch (e) { console.warn("skip:", t.name); }
        await new Promise(r => setTimeout(r, 250));
      }
      setFixProgress({ done: totalSteps, total: totalSteps, msg: "Firestore save..." });
      await setDoc(doc(db, "settings", "menu"), { items: working });
      setMenuState(working);
      setFixState("done");
    } catch (e) { console.error(e); alert("❌ Apply fail: " + e.message); setFixState("report"); }
  };
  const closeFix = () => { setFixState(null); setFixReport(null); setFixProgress({ done: 0, total: 0, msg: "" }); };
'''

# ── 3. UI BLOCK ───────────────────────────────────
UI_BLOCK = '''
          {/* 🩹 SAB THIK KARO */}
          <div style={{ background: "#ECFDF5", border: "2px solid #10B981", borderRadius: 14, padding: 18, marginBottom: 20 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#065F46", marginBottom: 4 }}>🩹 SAB THIK KARO (One-Click)</div>
            <div style={{ fontSize: 12, color: "#047857", marginBottom: 14, lineHeight: 1.6 }}>Duplicates delete · Naam sahi · Description saaf · Photo Wikipedia se free (Cloudinary me save). Backup automatic.</div>
            {!fixState && <button onClick={scanFix} style={{ background: "#10B981", color: "#fff", border: "none", borderRadius: 12, padding: "14px 24px", fontWeight: 900, fontSize: 15, cursor: "pointer", width: "100%" }}>🔍 Pehle Scan Karo (dry-run)</button>}
            {fixState === "scanning" && <div style={{ padding: 12, textAlign: "center", color: "#065F46", fontWeight: 700 }}>⏳ Menu scan ho raha hai...</div>}
            {fixState === "report" && fixReport && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
                  {[{ l: "Duplicates", v: fixReport.dupDeleteIds.length, c: "#DC2626", bg: "#FEF2F2" }, { l: "Naam Fix", v: fixReport.nameFixes.length, c: "#2563EB", bg: "#EFF6FF" }, { l: "Description", v: fixReport.descFixes.length, c: "#7C3AED", bg: "#F5F3FF" }, { l: "Photos", v: fixReport.imgTargets.length, c: "#EA580C", bg: "#FFF7ED" }].map((s) => (
                    <div key={s.l} style={{ background: s.bg, border: `1px solid ${s.c}44`, borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: s.c, textTransform: "uppercase" }}>{s.l}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {fixReport.dupPairs.length > 0 && (
                  <details style={{ marginBottom: 10 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#DC2626", padding: "6px 0" }}>🔍 Duplicates ({fixReport.dupPairs.length})</summary>
                    <div style={{ maxHeight: 150, overflowY: "auto", fontSize: 11, background: "#FFF", padding: 10, borderRadius: 8, marginTop: 6 }}>
                      {fixReport.dupPairs.map((d, i) => (<div key={i} style={{ padding: 4, borderBottom: "1px solid #FEE2E2" }}><span style={{ color: "#16A34A" }}>✓ Rakhenge: {d.keep}</span><br /><span style={{ color: "#DC2626" }}>✗ Delete: {d.del} (₹{d.price})</span></div>))}
                    </div>
                  </details>
                )}
                {fixReport.nameFixes.length > 0 && (
                  <details style={{ marginBottom: 10 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#2563EB", padding: "6px 0" }}>✏️ Naam fixes ({fixReport.nameFixes.length})</summary>
                    <div style={{ maxHeight: 150, overflowY: "auto", fontSize: 11, background: "#FFF", padding: 10, borderRadius: 8, marginTop: 6 }}>
                      {fixReport.nameFixes.map((n, i) => (<div key={i} style={{ padding: 3, borderBottom: "1px solid #DBEAFE" }}><span style={{ color: "#DC2626" }}>{n.from}</span> → <span style={{ color: "#16A34A" }}>{n.to}</span></div>))}
                    </div>
                  </details>
                )}
                {fixReport.imgTargets.length > 0 && (
                  <details style={{ marginBottom: 10 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#EA580C", padding: "6px 0" }}>🖼️ Photos milengi ({fixReport.imgTargets.length})</summary>
                    <div style={{ maxHeight: 150, overflowY: "auto", fontSize: 11, background: "#FFF", padding: 10, borderRadius: 8, marginTop: 6 }}>
                      {fixReport.imgTargets.map((t, i) => (<div key={i} style={{ padding: 3, borderBottom: "1px solid #FFEDD5" }}>{t.name} <span style={{ color: "#9A3412" }}>({t.category})</span></div>))}
                    </div>
                  </details>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={applyFix} style={{ flex: 2, background: "#16A34A", color: "#fff", border: "none", borderRadius: 10, padding: 14, fontWeight: 900, fontSize: 14, cursor: "pointer" }}>✅ SAB APPLY KARO</button>
                  <button onClick={closeFix} style={{ flex: 1, background: "transparent", color: "#6B7280", border: "1px solid #D1D5DB", borderRadius: 10, padding: 14, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}
            {fixState === "applying" && (<div><div style={{ height: 10, background: "#D1FAE5", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}><div style={{ height: "100%", width: `${fixProgress.total ? (fixProgress.done / fixProgress.total) * 100 : 0}%`, background: "#10B981", transition: "width 0.3s" }} /></div><div style={{ fontSize: 12, fontWeight: 700, color: "#065F46" }}>{fixProgress.msg} ({fixProgress.done}/{fixProgress.total})</div></div>)}
            {fixState === "done" && (<div style={{ textAlign: "center", padding: 16 }}><div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div><div style={{ fontSize: 16, fontWeight: 900, color: "#065F46", marginBottom: 6 }}>Sab theek ho gaya!</div><div style={{ fontSize: 12, color: "#047857", marginBottom: 12 }}>Backup localStorage + JSON file me safe hai.</div><button onClick={closeFix} style={{ background: "#10B981", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 800, cursor: "pointer" }}>OK</button></div>)}
          </div>'''

# ── 4. Anchors check + apply ──────────────────────
anchor1 = "const hiddenCats = settings?.hiddenCategories || [];"
anchor2_pattern = r'(\{tab === "menu" && \(\s*<>)'

if anchor1 not in content:
    print(f"❌ Error: Anchor 1 (hiddenCats) nahi mila {path} me. Batao, script ruk gaya.")
    sys.exit(1)
if not re.search(anchor2_pattern, content):
    print(f"❌ Error: Anchor 2 (menu tab) nahi mila {path} me. Batao, script ruk gaya.")
    sys.exit(1)

backup = path + f".backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
shutil.copy(path, backup)
print(f"📦 Backup: {backup}")

content = content.replace(anchor1, anchor1 + STATE_CODE, 1)
print("✅ State + helpers inserted")

content = re.sub(anchor2_pattern, lambda m: m.group(1) + UI_BLOCK, content, count=1)
print("✅ UI button inserted")

open(path, "w", encoding="utf-8").write(content)

print("\n🎉 Done! Ab ye chalao:")
print("   git add -A && git commit -m 'menu: one-click cleanup + wiki images' && git push")
print("\nVercel deploy hone ke baad: Admin → Menu → '🩹 SAB THIK KARO' → Scan → Apply")