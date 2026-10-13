const MODEL = "gemini-2.5-flash-lite";

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    // sirf logged-in staff
    const h = req.headers.authorization || "";
    const idToken = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (!idToken) return res.status(401).json({ error: "Login chahiye" });
    const chk = await fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + process.env.FIREBASE_API_KEY,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
    );
    const who = await chk.json();
    const user = who.users && who.users[0];
    if (!chk.ok || !user || !user.email) return res.status(401).json({ error: "Staff login chahiye" });

    const { text, menu } = req.body || {};
    if (!text || typeof text !== "string" || text.length > 600) return res.status(400).json({ error: "Text galat ya bahut lamba" });
    if (!Array.isArray(menu) || menu.length === 0 || menu.length > 600) return res.status(400).json({ error: "Menu nahi mila" });

    const ids = new Set(menu.map((m) => m.id));
    const menuText = menu.map((m) => m.id + "|" + m.name + (m.portion ? " (" + m.portion + ")" : "")).join("\n");

    const system =
      "Tum ek restaurant POS ke order-taker ho. Waiter Hindi/Hinglish/English me order bolta hai.\n" +
      "Neeche menu hai (id|naam). SIRF isi menu se match karo, menu ke bahar ka id kabhi mat banao.\n" +
      "Rules:\n" +
      "- ek=1, do=2, teen=3, char=4, paanch=5, chhe=6, saat=7, aath=8, nau=9, das=10. Qty na bole to 1.\n" +
      "- half/full/quarter/aadha/poora ko menu ke portion se match karo.\n" +
      "- Agar dish ke multiple portion hain aur waiter ne portion nahi bola, us dish ko unmatched me daalo.\n" +
      "- 'table 5', 'T5', 'paanch number table' => table=5. 'parcel/pack/takeaway' => orderType=parcel, warna dine_in.\n" +
      "- Special instruction (kam teekha, bina pyaaz) => notes me chhota sa likho.\n" +
      "- Jo samajh na aaye wo unmatched me daalo.\n\nMENU:\n" + menuText;

    const schema = {
      type: "OBJECT",
      properties: {
        table: { type: "INTEGER" },
        orderType: { type: "STRING", enum: ["dine_in", "parcel"] },
        items: { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, qty: { type: "NUMBER" } }, required: ["id", "qty"] } },
        notes: { type: "STRING" },
        unmatched: { type: "ARRAY", items: { type: "STRING" } }
      },
      required: ["orderType", "items"]
    };

    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1, maxOutputTokens: 800 }
        })
      }
    );
    const data = await r.json();
    if (!r.ok) { console.error("Gemini error:", data); return res.status(502).json({ error: "AI service error" }); }
    const raw = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!raw) return res.status(502).json({ error: "AI order samajh nahi paya" });

    let o = {};
    try { o = JSON.parse(raw); } catch (e) { return res.status(502).json({ error: "AI ka jawab padh nahi paya" }); }

    const items = (o.items || [])
      .filter((i) => ids.has(i.id) && Number(i.qty) > 0)
      .map((i) => ({ id: i.id, qty: Math.min(50, Number(i.qty)) }));
    return res.status(200).json({
      table: Number(o.table) || null,
      orderType: o.orderType === "parcel" ? "parcel" : "dine_in",
      items,
      notes: o.notes || "",
      unmatched: o.unmatched || []
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
};
