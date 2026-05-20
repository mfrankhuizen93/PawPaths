type AuthEmail = {
  to: string;
  subject: string;
  text: string;
};

export type EmailDeliveryResult = {
  configured: boolean;
};

export async function sendAuthEmail({
  to,
  subject,
  text,
}: AuthEmail): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;

  if (process.env.NODE_ENV !== "production") {
    console.info(`[auth-email] Attempting ${subject} to ${to}`);
    console.info(`[auth-email] ${subject}\nTo: ${to}\n\n${text}`);

    return { configured: false };
  }

  if (!apiKey || !from) {
    return { configured: false };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const message = await response.text();

    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[auth-email] Could not send ${subject} to ${to}: ${response.status} ${message}`,
      );
      console.info(`[auth-email] ${subject}\nTo: ${to}\n\n${text}`);

      return { configured: false };
    }

    throw new Error(`Could not send email: ${response.status}`);
  }

  return { configured: true };
}
