
import os, sys, shutil

path = next((p for p in ["src/App.jsx", "App.jsx"] if os.path.exists(p)), None)
if not path:
    sys.exit("App.jsx nahi mila. Repo ke root se chalao (jahan package.json hai).")

src = open(path, encoding="utf-8").read()

patches = []

# 1) category wali galat photo hatao
patches.append((
    "dishfix",
    '  return hit ? IMG(hit[1]) : categoryImage(category);',
    '  return hit ? IMG(hit[1]) : "";',
))

# 2) photo na ho to placeholder (customer menu card)
patches.append((
    "placeholder",
    '<img src={item.image} alt={item.name} loading="lazy" className="keep-color" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, filter: item.available ? "none" : "grayscale(1)" }} onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; }} />',
    '<div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "#1E293B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>🍽️</div>\n                    {item.image ? <img src={item.image} alt={item.name} loading="lazy" className="keep-color" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, filter: item.available ? "none" : "grayscale(1)" }} onError={(e) => { e.target.style.display = "none"; }} /> : null}',
))

# 3) auto image function (AdminView)
patches.append((
    "autoimg_fn",
    '  const handleDeleteMenuItem = async (id) =>',
    '''  const [autoImgMsg, setAutoImgMsg] = useState("");
  const autoImagesAll = async () => {
    if (autoImgMsg) return;
    const isOwn = (u) => /cloudinary\\.com|pexels\\.com/.test(u || "");
    const targets = menu.filter((m) => !isOwn(m.image));
    if (!targets.length) { alert("Sab items ki photo pehle se set hai"); return; }
    if (!window.confirm(targets.length + " items ki photo auto lagani hain? (Cloudinary / apni upload ki hui photo nahi badlegi)")) return;
    const cache = {};
    const found = {};
    let calls = 0;
    for (let i = 0; i < targets.length; i++) {
      const m = targets[i];
      const key = String(m.name || "").replace(/\\(.*?\\)/g, "").replace(/chilly/gi, "chilli").trim().toLowerCase();
      if (!(key in cache)) {
        if (calls >= 150) { alert("150 request ho gayi (Pexels limit 200/ghanta). Thodi der baad dobara dabao, baaki items ho jayenge."); break; }
        calls++;
        setAutoImgMsg("⏳ " + (i + 1) + "/" + targets.length + " — " + m.name);
        try { const r = await fetch("/api/image?q=" + encodeURIComponent(key)); const d = await r.json(); cache[key] = d.url || ""; } catch (e) { cache[key] = ""; }
        await new Promise((r) => setTimeout(r, 400));
      }
      if (cache[key]) found[m.id] = cache[key];
    }
    const n = Object.keys(found).length;
    if (n > 0) {
      const updated = menu.map((m) => (found[m.id] ? { ...m, image: found[m.id] } : m));
      setMenuState(updated);
      try { await setDoc(doc(db, "settings", "menu"), { items: updated }); alert("✅ " + n + " items ki photo lag gayi"); }
      catch (e) { alert("⚠️ Save nahi hua: " + e.message); }
    }
    setAutoImgMsg("");
  };
  const handleDeleteMenuItem = async (id) =>''',
))

# 4) admin button
patches.append((
    "autoimg_btn",
    '♻️ Purane items wapas jodo</button>',
    '''♻️ Purane items wapas jodo</button>
            <button onClick={autoImagesAll} disabled={!!autoImgMsg} style={{ width: '100%', background: COLORS.info, color: '#fff', border: 'none', borderRadius: 12, padding: '14px 16px', fontWeight: 800, cursor: autoImgMsg ? 'wait' : 'pointer', marginBottom: 16 }}>{autoImgMsg || "🖼️ Auto image lagao (sabhi items)"}</button>''',
))

markers = {
    "dishfix": 'return hit ? IMG(hit[1]) : "";',
    "placeholder": '{item.image ? <img src={item.image} alt={item.name}',
    "autoimg_fn": "const autoImagesAll",
    "autoimg_btn": "onClick={autoImagesAll}",
}

out = src
for name, old, new in patches:
    if markers[name] in out:
        print("SKIP " + name + ": pehle se laga hua hai")
        continue
    c = out.count(old)
    if c != 1:
        sys.exit("ERROR " + name + ": " + str(c) + " jagah mila (1 hona chahiye). Kuch nahi badla.")
    out = out.replace(old, new, 1)
    print("OK   " + name)

if out != src:
    shutil.copy(path, path + ".bak")
    open(path, "w", encoding="utf-8").write(out)
    print("SAVED " + path + " (backup: " + path + ".bak)")

os.makedirs("api", exist_ok=True)
if os.path.exists("api/image.js"):
    print("SKIP api/image.js pehle se hai")
else:
    open("api/image.js", "w", encoding="utf-8").write('''export default async function handler(req, res) {
  const q = String(req.query.q || "").trim().slice(0, 80);
  if (!q) return res.status(400).json({ url: null });
  try {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q + " indian food")}&per_page=1&orientation=landscape`,
      { headers: { Authorization: process.env.PEXELS_API_KEY } }
    );
    const d = await r.json();
    res.setHeader("Cache-Control", "s-maxage=86400");
    res.status(200).json({ url: d.photos?.[0]?.src?.medium || null });
  } catch (e) {
    res.status(500).json({ url: null });
  }
}
''')
    print("OK   api/image.js bana diya")

print("Ab: git add -A && git commit -m 'menu images fix' && git push")
