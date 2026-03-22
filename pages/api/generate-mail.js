// Scrape a single URL and extract useful info
async function scrapeUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(timeout);
    if (!r.ok) return null;
    const html = await r.text();

    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || "";
    const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)?.[1]?.trim() || "";
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i)?.[1]?.trim() || "";
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i)?.[1]?.trim() || "";

    let extraInfo = "";

    // YouTube: extract video titles and channel info from ytInitialData
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      // Extract video titles from the page
      const videoTitles = [];
      const titleMatches = html.matchAll(/"title":\s*\{"runs":\s*\[\{"text":\s*"([^"]{5,120})"\}/g);
      for (const m of titleMatches) {
        if (!videoTitles.includes(m[1]) && videoTitles.length < 15) videoTitles.push(m[1]);
      }
      // Also try simpler pattern
      const simpleTitles = html.matchAll(/"title":\s*\{"simpleText":\s*"([^"]{5,120})"\}/g);
      for (const m of simpleTitles) {
        if (!videoTitles.includes(m[1]) && videoTitles.length < 15) videoTitles.push(m[1]);
      }
      // Channel description
      const channelDesc = html.match(/"description":\s*\{"simpleText":\s*"([^"]{10,500})"\}/)?.[1] || "";
      // Subscriber count
      const subs = html.match(/"subscriberCountText":\s*\{"simpleText":\s*"([^"]+)"\}/)?.[1] || "";
      // Channel name
      const channelName = html.match(/"channelName":\s*"([^"]+)"/)?.[1] || "";

      if (channelName) extraInfo += `\nNom de chaîne: ${channelName}`;
      if (subs) extraInfo += `\nAbonnés: ${subs}`;
      if (channelDesc) extraInfo += `\nDescription chaîne: ${channelDesc}`;
      if (videoTitles.length > 0) extraInfo += `\nDernières vidéos:\n${videoTitles.map((t, i) => `  ${i + 1}. ${t}`).join("\n")}`;
    }

    // Instagram: extract bio and stats from meta/JSON
    if (url.includes("instagram.com")) {
      // Bio from meta
      const bio = ogDesc || metaDesc || "";
      // Try to get follower count from page
      const followers = html.match(/"edge_followed_by":\s*\{"count":\s*(\d+)\}/)?.[1] || "";
      const following = html.match(/"edge_follow":\s*\{"count":\s*(\d+)\}/)?.[1] || "";
      const posts = html.match(/"edge_owner_to_timeline_media":\s*\{"count":\s*(\d+)\}/)?.[1] || "";

      if (followers) extraInfo += `\nFollowers: ${Number(followers).toLocaleString("fr-FR")}`;
      if (posts) extraInfo += `\nNombre de posts: ${posts}`;
      if (bio && bio.length > 20) extraInfo += `\nBio: ${bio}`;
    }

    // Regular website: extract more content
    if (!url.includes("youtube.com") && !url.includes("instagram.com") && !url.includes("youtu.be")) {
      // Get headings
      const headings = [];
      const hMatches = html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
      for (const m of hMatches) {
        const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (text.length > 3 && text.length < 200 && headings.length < 10) headings.push(text);
      }

      // Get visible text
      const bodyHtml = html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)?.[1] || "";
      const visibleText = bodyHtml
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2000);

      if (headings.length > 0) extraInfo += `\nTitres de la page: ${headings.join(" | ")}`;
      if (visibleText.length > 50) extraInfo += `\nContenu: ${visibleText}`;
    }

    const desc = ogDesc || metaDesc || "";
    let result = `[${url}]`;
    if (ogTitle || title) result += `\nTitre: ${ogTitle || title}`;
    if (desc) result += `\nDescription: ${desc}`;
    result += extraInfo;

    return result.length > 30 ? result : null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt, links } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

  const MODEL = "gemini-2.5-flash";

  // Scrape all prospect links in parallel
  let scrapedInfo = "";
  if (links && links.length > 0) {
    const uniqueLinks = [...new Set(links)].slice(0, 8);
    const results = await Promise.allSettled(uniqueLinks.map(scrapeUrl));
    const scraped = results
      .filter(r => r.status === "fulfilled" && r.value)
      .map(r => r.value);
    if (scraped.length > 0) {
      scrapedInfo = "\n\n=== INFORMATIONS RÉCUPÉRÉES DES SITES/RÉSEAUX DU PROSPECT ===\n" + scraped.join("\n\n---\n\n");
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

    try {
      const parsed = JSON.parse(clean);
      if (parsed.subject && parsed.body) {
        return res.status(200).json({ subject: parsed.subject, body: parsed.body, scraped: scrapedInfo || null });
      }
    } catch (e) {}

    const subjectMatch = clean.match(/"subject"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const bodyMatch = clean.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (subjectMatch && bodyMatch) {
      return res.status(200).json({
        subject: subjectMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
        body: bodyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
        scraped: scrapedInfo || null,
      });
    }

    console.error("Could not parse Gemini output:", clean.substring(0, 500));
    return res.status(500).json({ error: "Format IA invalide. Réessayez." });

  } catch (err) {
    console.error("generate-mail error:", err);
    return res.status(500).json({ error: "Erreur: " + (err.message || "Réessayez") });
  }
}
