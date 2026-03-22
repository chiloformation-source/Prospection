export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No GEMINI_API_KEY" });

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);

    const models = (data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => ({ name: m.name, displayName: m.displayName }));

    return res.status(200).json({ models });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
