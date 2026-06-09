import nodemailer from 'nodemailer';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

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

function formatEmailError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function getEmailTransporter() {
  if (!transporter) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('SMTP configuration incomplete. Email sending disabled.');
      return null;
    }

    const port = getSmtpPort();

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: getSmtpSecure(port),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      connectionTimeout: 5000, // 5 seconds
      socketTimeout: 5000, // 5 seconds
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

    // Race against timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('SMTP timeout after 5s')), 5000)
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
