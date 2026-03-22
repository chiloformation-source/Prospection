export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt, links } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

  const MODEL = "gemini-2.5-flash";

  // Scrape prospect links to get real info
  let scrapedInfo = "";
  if (links && links.length > 0) {
    const results = await Promise.allSettled(
      links.slice(0, 5).map(async (url) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const r = await fetch(url, {
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0 (compatible; ProspectBot/1.0)" },
          });
          clearTimeout(timeout);
          if (!r.ok) return null;
          const html = await r.text();
          // Extract useful text: title, meta description, headings, first paragraphs
          const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
          const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)?.[1]?.trim() || "";
          const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i)?.[1]?.trim() || "";
          // Extract visible text from body (strip tags, limit)
          const bodyHtml = html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)?.[1] || "";
          const visibleText = bodyHtml
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 1500);
          return `[${url}]\nTitre: ${title}\nDescription: ${metaDesc || ogDesc}\nContenu: ${visibleText.slice(0, 800)}`;
        } catch (e) {
          return null;
        }
      })
    );
    const scraped = results
      .filter(r => r.status === "fulfilled" && r.value)
      .map(r => r.value);
    if (scraped.length > 0) {
      scrapedInfo = "\n\n=== INFORMATIONS SCRAPEES DES SITES/RESEAUX DU PROSPECT ===\n" + scraped.join("\n\n");
    }
  }

  const fullPrompt = prompt + scrapedInfo;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500,
            responseMimeType: "application/json",
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

    // Extract text from response
    let allText = "";
    for (const candidate of (data.candidates || [])) {
      for (const part of (candidate.content?.parts || [])) {
        if (part.thought === true) continue;
        if (part.text) allText += part.text;
      }
    }

    if (!allText) {
      return res.status(500).json({ error: "Réponse vide de l'IA" });
    }

    let clean = allText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    // Try JSON parse
    try {
      const parsed = JSON.parse(clean);
      if (parsed.subject && parsed.body) {
        return res.status(200).json({ subject: parsed.subject, body: parsed.body });
      }
    } catch (e) {}

    // Regex fallback
    const subjectMatch = clean.match(/"subject"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const bodyMatch = clean.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (subjectMatch && bodyMatch) {
      return res.status(200).json({
        subject: subjectMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
        body: bodyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
      });
    }

    console.error("Could not parse Gemini output:", clean.substring(0, 500));
    return res.status(500).json({ error: "Format IA invalide. Réessayez." });

  } catch (err) {
    console.error("generate-mail error:", err);
    return res.status(500).json({ error: "Erreur: " + (err.message || "Réessayez") });
  }
}
