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

/** Keyed hash of the code, bound to the user, so a leaked database can't be used to guess codes. */
export const hashCode = (code, userId) =>
  crypto.createHmac('sha256', secret()).update(`${userId}:${code}`).digest('hex');

/** Constant-time comparison, so response timing doesn't leak how much of a code matched. */
export const codesMatch = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export const emailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const sendOtpEmail = async ({ to, name, code }) => {
  const safeName = escapeHtml(name || 'there');
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || `DevTrack AI <${process.env.SMTP_USER}>`,
    to,
    subject: `${code} is your DevTrack AI verification code`,
    text:
      `Hi ${name || 'there'},\n\n` +
      `Your DevTrack AI verification code is ${code}.\n` +
      `It expires in 10 minutes.\n\n` +
      `If you didn't create an account, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:460px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 12px">Verify your email</h2>
        <p>Hi ${safeName}, enter this code in DevTrack AI to finish setting up your account:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:20px 0">${code}</p>
        <p style="color:#555;font-size:13px">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>`,
  });
};
