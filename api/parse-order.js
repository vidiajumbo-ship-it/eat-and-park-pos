// api/parse-order.js
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

// ───── Firebase ID token verification (no admin SDK) ─────
const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const CERTS_CACHE_MS = 55 * 60 * 1000;
let _certCache = { certs: null, fetchedAt: 0 };

async function getGoogleCerts(force = false) {
  if (!force && _certCache.certs && Date.now() - _certCache.fetchedAt < CERTS_CACHE_MS) {
    return _certCache.certs;
  }
  const r = await fetch(GOOGLE_CERTS_URL, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error("certs_unavailable");
  const certs = await r.json();
  _certCache = { certs, fetchedAt: Date.now() };
  return certs;
}

async function verifyFirebaseIdToken(idToken, projectId) {
  if (typeof idToken !== "string" || idToken.split(".").length !== 3) throw new Error("bad_token");
  const [h, p, s] = idToken.split(".");

  let header, payload;
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  } catch {
    throw new Error("bad_token");
  }

  if (header.alg !== "RS256") throw new Error("bad_alg");
  if (payload.aud !== projectId) throw new Error("bad_aud");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("bad_iss");
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error("expired");
  if (!payload.sub) throw new Error("no_sub");
  if (!header.kid) throw new Error("no_kid");

  let certs = await getGoogleCerts();
  let cert = certs[header.kid];
  if (!cert) {
    certs = await getGoogleCerts(true);
    cert = certs[header.kid];
    if (!cert) throw new Error("unknown_kid");
  }

  const publicKey = createPublicKey(cert);
  const valid = cryptoVerify("RSA-SHA256", Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, "base64url"));
  if (!valid) throw new Error("bad_sig");
  return { uid: payload.sub };
}

// ───── Handler (original + auth check added) ─────
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

  // ───── AUTH CHECK (NEW) ─────
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error("[parse-order] FIREBASE_PROJECT_ID missing");
    return res.status(500).json({ error: "Server config error" });
  }
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) {
    return res.status(401).json({ error: "Login required" });
  }
  try {
    await verifyFirebaseIdToken(idToken, projectId);
  } catch (e) {
    console.warn("[parse-order] auth fail:", e.message);
    if (e.message === "certs_unavailable") {
      return res.status(503).json({ error: "Auth temporarily unavailable, retry" });
    }
    return res.status(401).json({ error: "Invalid session" });
  }
  // ───── END AUTH CHECK ─────

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