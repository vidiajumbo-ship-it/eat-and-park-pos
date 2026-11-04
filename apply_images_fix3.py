import os

os.makedirs("api", exist_ok=True)

code = r'''const UA = { "User-Agent": "EatParkMenu/1.0 (restaurant menu app)" };

export default async function handler(req, res) {
  const q = String(req.query.q || "").trim().slice(0, 80);
  if (!q) return res.status(400).json({ url: null });
  try {
    const api =
      "https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=6" +
      "&prop=pageimages&piprop=thumbnail&pithumbsize=600&gsrsearch=" +
      encodeURIComponent(q + " food");
    const r = await fetch(api, { headers: UA });
    const d = await r.json();
    const pages = Object.values((d.query && d.query.pages) || {}).sort((a, b) => a.index - b.index);
    const hit = pages.find((p) => p.thumbnail && !/\.svg|flag|logo|map/i.test(p.thumbnail.source));
    if (!hit) return res.status(200).json({ url: null });

    const imgRes = await fetch(hit.thumbnail.source, { headers: UA });
    if (!imgRes.ok) return res.status(200).json({ url: null });
    const type = imgRes.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await imgRes.arrayBuffer());

    const fd = new FormData();
    fd.append("file", "data:" + type + ";base64," + buf.toString("base64"));
    fd.append("upload_preset", "eatpark_uploads");
    const up = await fetch("https://api.cloudinary.com/v1_1/nnddxvcn/image/upload", { method: "POST", body: fd });
    const u = await up.json();

    res.setHeader("Cache-Control", "s-maxage=86400");
    res.status(200).json({ url: u.secure_url || null });
  } catch (e) {
    res.status(500).json({ url: null });
  }
}
'''

open("api/image.js", "w", encoding="utf-8").write(code)
print("OK api/image.js Wikipedia + Cloudinary version se badal diya (koi key nahi chahiye)")
print("Ab: git add -A && git commit -m 'image api: wikipedia + cloudinary' && git push")
