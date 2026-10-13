import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Preflight check
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only POST method allow karein
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Aap ek restaurant order parser hain. Customer text aur available menu match karke JSON return karein.
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

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("AI order error:", err);
    return res.status(500).json({ error: err.message || "Order parsing fail ho gaya" });
  }
}
