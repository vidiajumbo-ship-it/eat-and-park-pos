export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { text, menu } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: "Order text nahi mila" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable missing hai" });
    }

    const prompt = `
Aap ek restaurant order parser hain. Customer text aur available menu match karke structured JSON return karein.
Text: "${text}"

Available Menu:
${JSON.stringify(menu || [])}

Rules:
1. Table number extract karein (agar text mein ho). Agar parcel bola hai toh orderType "parcel", warna "dine_in".
2. Har item ki quantity aur menu ID strictly match karein.
3. Agar koi item samajh na aaye toh "unmatched" array mein daalein.

Output MUST be strict JSON in this exact structure without markdown or backticks:
{
  "orderType": "dine_in",
  "table": 5,
  "items": [
    { "id": "matched_menu_id", "qty": 1 }
  ],
  "notes": "",
  "unmatched": []
}
`;

    // Updated model URL
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      // Agar 2.5 na mile toh 1.5-flash fallback
      throw new Error(data.error?.message || "Gemini API error");
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("AI order error:", err);
    return res.status(500).json({ error: err.message || "Order parsing fail ho gaya" });
  }
}
