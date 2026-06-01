import nodemailer from 'nodemailer';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export function getEmailTransporter() {
  if (!transporter) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('SMTP configuration incomplete. Email sending disabled.');
      return null;
    }

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE === 'true', // SSL/TLS
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

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    const transporter = getEmailTransporter();
    if (!transporter) {
      console.log('Email sending disabled or not configured');
      return false;
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
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${payload.to}:`, error);
    return false;
  }
}

// Send email in background without blocking
export async function sendEmailAsync(payload: EmailPayload): Promise<void> {
  // Fire and forget - don't await or block
  sendEmail(payload).catch((error) => {
    console.error(`Background email send failed:`, error);
  });
}
