import crypto from 'crypto';
import nodemailer from 'nodemailer';

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000; // a code is valid for 10 minutes
export const RESEND_MS = 60 * 1000; // wait 60 seconds between codes
export const MAX_ATTEMPTS = 5; // wrong guesses allowed per code

const secret = () => {
  if (!process.env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is not set');
  return process.env.JWT_REFRESH_SECRET;
};

/** Cryptographically random 6-digit code, keeping leading zeros (e.g. "042817"). */
export const generateCode = () =>
  String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

/** Keyed hash of the code, bound to the purpose and user, so a leaked database can't be used to guess codes. */
export const hashCode = (code, userId, purpose = 'verify') =>
  crypto.createHmac('sha256', secret()).update(`${purpose}:${userId}:${code}`).digest('hex');

/** Constant-time comparison, so response timing doesn't leak how much of a code matched. */
export const codesMatch = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Email can be sent by Brevo's HTTPS API (preferred on hosts that block SMTP ports),
// or by Gmail/any SMTP server as a fallback.
export const emailConfigured = () =>
  Boolean(process.env.BREVO_API_KEY) ||
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const buildEmail = ({ name, code, purpose }) => {
  const isReset = purpose === 'reset';
  const what = isReset ? 'password reset' : 'verification';
  const heading = isReset ? 'Reset your password' : 'Verify your email';
  const action = isReset
    ? 'enter this code to choose a new password:'
    : 'enter this code to finish setting up your account:';
  const safeName = escapeHtml(name || 'there');
  return {
    subject: `${code} is your DevTrack AI ${what} code`,
    text:
      `Hi ${name || 'there'},\n\n` +
      `Your DevTrack AI ${what} code is ${code}.\n` +
      `It expires in 10 minutes.\n\n` +
      `If you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:460px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 12px">${heading}</h2>
        <p>Hi ${safeName}, ${action}</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:20px 0">${code}</p>
        <p style="color:#555;font-size:13px">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>`,
  };
};

// Brevo HTTPS API: works on hosts that block outgoing SMTP ports (such as Render's free plan).
const sendViaBrevo = async ({ to, name, email }) => {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER;
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'DevTrack AI', email: senderEmail },
      to: [{ email: to, name: name || undefined }],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo API ${response.status}: ${body.slice(0, 300)}`);
  }
};

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // Fail fast instead of hanging. Nodemailer's defaults can wait for many minutes.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
};

const sendViaSmtp = async ({ to, email }) => {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || `DevTrack AI <${process.env.SMTP_USER}>`,
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
};

export const sendOtpEmail = async ({ to, name, code, purpose = 'verify' }) => {
  const email = buildEmail({ name, code, purpose });
  if (process.env.BREVO_API_KEY) {
    await sendViaBrevo({ to, name, email });
  } else {
    await sendViaSmtp({ to, email });
  }
};
