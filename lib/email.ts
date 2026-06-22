import nodemailer from 'nodemailer';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
const BREVO_SEND_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';

function getSmtpPort(): number {
  const parsedPort = Number.parseInt(process.env.SMTP_PORT || '465', 10);
  return Number.isNaN(parsedPort) ? 465 : parsedPort;
}

function getSmtpSecure(port: number): boolean {
  if (process.env.SMTP_SECURE) {
    return process.env.SMTP_SECURE === 'true';
  }

  return port === 465;
}

function getSmtpTimeoutMs(): number {
  const parsedTimeout = Number.parseInt(process.env.SMTP_TIMEOUT_MS || '20000', 10);
  return Number.isNaN(parsedTimeout) || parsedTimeout < 1000 ? 20000 : parsedTimeout;
}

function formatEmailError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function parseSender(value: string): { email: string; name?: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);

  if (match) {
    return {
      name: match[1]?.trim() || undefined,
      email: match[2]?.trim()
    };
  }

  return { email: value.trim() };
}

async function sendBrevoEmail(payload: EmailPayload): Promise<EmailSendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderValue = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!apiKey || !senderValue) {
    return {
      ok: false,
      error: 'Brevo configuration incomplete. Required: BREVO_API_KEY and EMAIL_FROM.'
    };
  }

  const timeoutMs = getSmtpTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(BREVO_SEND_EMAIL_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: parseSender(senderValue),
        to: [{ email: payload.to }],
        subject: payload.subject,
        htmlContent: payload.html,
        textContent: payload.text
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const responseBody = await response.text();
      return {
        ok: false,
        error: `Brevo API error ${response.status}: ${responseBody || response.statusText}`
      };
    }

    console.log(`Email sent via Brevo API to ${payload.to}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        error: `Brevo API timeout after ${Math.round(timeoutMs / 1000)}s`
      };
    }

    return { ok: false, error: formatEmailError(error) };
  } finally {
    clearTimeout(timeout);
  }
}

export function getEmailTransporter() {
  if (!transporter) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('SMTP configuration incomplete. Email sending disabled.');
      return null;
    }

    const port = getSmtpPort();
    const timeoutMs = getSmtpTimeoutMs();

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: getSmtpSecure(port),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
    });
  }
  return transporter;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSendResult {
  ok: boolean;
  error?: string;
}

export async function sendEmailWithResult(payload: EmailPayload): Promise<EmailSendResult> {
  try {
    if (process.env.BREVO_API_KEY) {
      return await sendBrevoEmail(payload);
    }

    const transporter = getEmailTransporter();
    if (!transporter) {
      console.log('Email sending disabled or not configured');
      return {
        ok: false,
        error: 'SMTP configuration incomplete. Required: SMTP_HOST, SMTP_USER, SMTP_PASSWORD.'
      };
    }

    // Send email with timeout to prevent hanging
    const sendPromise = transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    const timeoutMs = getSmtpTimeoutMs();

    // Race against timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `SMTP timeout after ${Math.round(timeoutMs / 1000)}s (host=${process.env.SMTP_HOST}, port=${getSmtpPort()}, secure=${getSmtpSecure(getSmtpPort())})`
            )
          ),
        timeoutMs
      )
    );

    const result = await Promise.race([sendPromise, timeoutPromise]);
    console.log(`Email sent to ${payload.to}: ${result.messageId}`);
    return { ok: true };
  } catch (error) {
    console.error(`Failed to send email to ${payload.to}:`, error);
    return { ok: false, error: formatEmailError(error) };
  }
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const result = await sendEmailWithResult(payload);
  return result.ok;
}

// Send email in background without blocking
export async function sendEmailAsync(payload: EmailPayload): Promise<void> {
  // Fire and forget - don't await or block
  sendEmail(payload).catch((error) => {
    console.error(`Background email send failed:`, error);
  });
}
