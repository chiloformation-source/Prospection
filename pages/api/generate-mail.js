export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

  // ✅ Nom de modèle correct (gemini-2.5-flash n'existe pas)
 const MODEL = "gemini-2.0-flash-lite";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", JSON.stringify(data));
      return res.status(response.status).json({
        error: data?.error?.message || "Erreur API Gemini",
      });
    }

    // ✅ Collecte tous les parts en ignorant les blocs "thinking" (thought: true)
    let allText = "";
    const candidates = data.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.thought === true) continue; // ignore le bloc de réflexion interne
        if (part.text) allText += part.text;
      }
    }

    if (!allText) {
      console.error("Gemini empty response:", JSON.stringify(data));
      return res.status(500).json({ error: "Réponse vide de l'IA" });
    }

    // ✅ Nettoyage des balises markdown éventuelles
    let clean = allText
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Méthode 1 : regex (la plus robuste face aux sorties LLM)
    const subjectMatch = clean.match(/"subject"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const bodyMatch = clean.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)"/);

    if (subjectMatch && bodyMatch) {
      return res.status(200).json({
        subject: subjectMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\t/g, "\t"),
        body: bodyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\t/g, "\t"),
      });
    }

    // Méthode 2 : JSON.parse direct
    try {
      const parsed = JSON.parse(clean);
      if (parsed.subject && parsed.body) {
        return res.status(200).json({ subject: parsed.subject, body: parsed.body });
      }
    } catch (e) {
      // continue
    }

    // Méthode 3 : chercher un bloc JSON dans le texte
    const jsonMatch = clean.match(/\{[\s\S]*?\}/g);
    if (jsonMatch) {
      for (const block of jsonMatch) {
        try {
          const parsed = JSON.parse(block);
          if (parsed.subject && parsed.body) {
            return res.status(200).json({ subject: parsed.subject, body: parsed.body });
          }
        } catch (e) { continue; }
      }
    }

    console.error("Could not parse Gemini output:", clean.substring(0, 300));
    return res.status(500).json({ error: "Format IA invalide. Réessayez." });

  } catch (err) {
    console.error("generate-mail error:", err);
    return res.status(500).json({ error: "Erreur: " + (err.message || "Réessayez") });
  }
}
// v2
