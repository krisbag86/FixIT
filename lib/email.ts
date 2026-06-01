import "server-only";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailResult = {
  ok: boolean;
  provider: "resend" | "log";
  error?: string;
};

const resendEndpoint = "https://api.resend.com/emails";

export function emailFrom(): string {
  return process.env.EMAIL_FROM || "FixIT Helpdesk <no-reply@bagietka.pl>";
}

export function isRealEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

async function sendWithResend(message: EmailMessage): Promise<EmailResult> {
  try {
    const response = await fetch(resendEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, provider: "resend", error: `Resend ${response.status}: ${detail.slice(0, 300)}` };
    }

    return { ok: true, provider: "resend" };
  } catch (error) {
    return { ok: false, provider: "resend", error: error instanceof Error ? error.message : "Resend request failed" };
  }
}

function sendWithLog(message: EmailMessage): EmailResult {
  // Dev fallback: no provider configured, log the email so the flow stays usable locally.
  console.info(
    `[email:log] -> ${message.to}\n  from: ${emailFrom()}\n  subject: ${message.subject}\n  text:\n${message.text}`
  );
  return { ok: true, provider: "log" };
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (isRealEmailEnabled()) {
    return sendWithResend(message);
  }

  return sendWithLog(message);
}
