export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { to, subject, body } = req.body;
  if (!to || !subject || !body) return res.status(400).json({ error: "Champs manquants (to, subject, body)" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "RESEND_API_KEY not configured" });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Creatly <contact@creatly.fr>",
        to: [to],
        subject: subject,
        text: body,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", JSON.stringify(data));
      return res.status(response.status).json({ error: data.message || "Erreur d'envoi" });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error("Send mail error:", err);
    return res.status(500).json({ error: "Erreur d'envoi: " + (err.message || "Réessayez") });
  }
}
