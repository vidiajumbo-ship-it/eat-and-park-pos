export default async function handler(req, res) {
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
