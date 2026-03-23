import nodemailer from 'nodemailer';

const isValidEmail = (email) => {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

function textToHtml(text) {
  // First escape HTML entities
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Then convert newlines to <br />
  html = html.replace(/\n/g, '<br />');
  return '<p style="font-family:Arial, sans-serif; font-size:14px; line-height:1.6; color:#333;">' + html + '</p>';
}

function bodyToHtml(body) {
  // If the body already contains <br /> or <br> tags, use it as-is (from AI generation)
  if (body.includes('<br') || body.includes('<p>')) {
    // Already HTML-formatted, wrap in a styled container
    return '<div style="font-family:Arial, sans-serif; font-size:14px; line-height:1.6; color:#333;">' + body + '</div>';
  }
  // Otherwise convert plain text to HTML
  return textToHtml(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, body } = req.body || {};
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Champs manquants (to, subject, body)' });
  }

  if (!isValidEmail(to)) {
    return res.status(400).json({ error: 'Adresse destinataire invalide' });
  }

  const smtpHost = process.env.OVH_SMTP_HOST || 'ssl0.ovh.net';
  const smtpPort = Number(process.env.OVH_SMTP_PORT || 465);
  const smtpUser = process.env.OVH_SMTP_USER;
  const smtpPass = process.env.OVH_SMTP_PASS;
  const fromEmail = process.env.OVH_FROM_EMAIL || smtpUser || 'contact@creatly.fr';
  const fromName = process.env.OVH_FROM_NAME || 'Creatly';

  const resendApiKey = process.env.RESEND_API_KEY;

  // Build HTML from body
  const htmlBody = bodyToHtml(body);
  // Plain text version (strip HTML tags)
  const plainText = body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');

  if (!smtpUser || !smtpPass) {
    if (!resendApiKey) {
      return res.status(500).json({
        error: 'Aucune methode d\'envoi configuree : OVH SMTP (OVH_SMTP_USER/OVH_SMTP_PASS) ou RESEND_API_KEY requis.',
      });
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to,
          subject,
          html: htmlBody,
          text: plainText,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('Resend error:', data);
        return res.status(response.status).json({ error: data.error || data.message || 'Erreur Resend' });
      }

      return res.status(200).json({ success: true, id: data.id, provider: 'resend' });
    } catch (error) {
      console.error('Erreur Resend:', error);
      return res.status(500).json({ error: 'Erreur d\'envoi Resend : ' + (error.message || 'Verifiez votre cle RESEND_API_KEY') });
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.verify();

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text: plainText,
      html: htmlBody,
    };

    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      response: info.response,
      provider: 'ovh',
    });
  } catch (error) {
    console.error('Erreur d\'envoi SMTP:', error);

    let msg = 'Erreur d\'envoi : ' + (error.message || 'Verifiez votre configuration SMTP');
    if (error.response) {
      msg += ' - ' + error.response;
    }

    return res.status(500).json({ error: msg });
  }
}
