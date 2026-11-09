import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

export async function sendBrevoEmail(toEmail: string, toName: string, subject: string, textContent: string) {
  const { BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME } = process.env;
  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
    throw new Error('Brevo API ključ i email pošiljaoca nisu podešeni.');
  }

  let response: Response;
  try {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME || 'Printing House' },
        to: [{ email: toEmail, name: toName }],
        subject,
        textContent
      }),
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw new Error('Brevo servis nije dostupan ili je zahtev istekao.');
  }

  if (!response.ok) {
    const errorText = await response.text();
    const safeError = errorText.split(BREVO_API_KEY).join('[REDACTED]').slice(0, 500);
    throw new Error(`Brevo nije prihvatio email (${response.status}): ${safeError}`);
  }
}
