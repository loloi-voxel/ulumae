export interface EmailAttachment {
  name: string;
  content: string;
  contentType?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments = [],
}: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': process.env.BREVO_API_KEY!,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: 'ULUMAE',
        email: 'jejfhdhf19@gmail.com',
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(attachments.length > 0 ? {
        attachment: attachments.map((attachment) => ({
          name: attachment.name,
          content: attachment.content,
          type: attachment.contentType,
        })),
      } : {}),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Brevo error: ${JSON.stringify(error)}`);
  }

  return response.json();
}