// api/parse-order.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // CORS / Preflight handle karein
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { text, menu } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY missing in Vercel environment variables" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Aap ek restaurant order parser hain. Customer ke text aur available menu items ko match karke structured JSON return karein.
Text: "${text}"

Available Menu:
${JSON.stringify(menu || [])}

Rules:
1. Table number extract karein (agar text mein ho). Agar parcel bola hai toh orderType "parcel" karein, warna "dine_in".
2. Har item ki quantity aur menu ID accurately map karein.
3. Agar koi item samajh na aaye toh use "unmatched" array mein daalein.

Output MUST be strict JSON in this exact structure without backticks:
{
  "orderType": "dine_in",
  "table": 5,
  "items": [
    { "id": "matched_menu_id", "qty": 2 }
  ],
  "notes": "",
  "unmatched": []
}
`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Parse API error:", err);
    return res.status(500).json({ error: err.message || "Failed to process order" });
  }
}
