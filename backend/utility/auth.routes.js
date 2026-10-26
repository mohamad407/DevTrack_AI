import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import OtpCode from '../models/OtpCode.model.js';
import { verifyFirebaseToken } from '../config/firebase.js';
import { signAccessToken, signRefreshToken } from '../utility/token.js';
import {
  generateCode,
  hashCode,
  codesMatch,
  sendOtpEmail,
  emailConfigured,
  OTP_TTL_MS,
  RESEND_MS,
  MAX_ATTEMPTS,
} from './otp.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

const IS_PROD = process.env.NODE_ENV === 'production';
const REFRESH_COOKIE = 'refreshToken';
// Frontend (Vercel) and backend (Render) are different sites, so production needs SameSite=None + Secure.
const refreshCookieOptions = {
  httpOnly: true, // JavaScript on the page can never read it
  secure: IS_PROD,
  sameSite: IS_PROD ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const sendError = (res, next, err) =>
  err.statusCode ? res.status(err.statusCode).json({ message: err.message }) : next(err);

// Confirms the Firebase ID token and returns the matching DevTrack user.
const userFromIdToken = async (idToken) => {
  if (!idToken) throw httpError(400, 'Missing sign-in token. Please log in again.');
  let decoded;
  try {
    decoded = await verifyFirebaseToken(idToken);
  } catch {
    throw httpError(401, 'Your sign-in expired. Please log in again.');
  }
  const user = await User.findOne({ firebaseUid: decoded.uid });
  if (!user) throw httpError(404, 'Account not found. Please sign up again.');
  return user;
};

/**
 * POST /api/auth/firebase-session
 * Body: { idToken, name? }
 * The browser signs in with Firebase (email/password or Google) and sends the Firebase ID token here
 * to get a DevTrack session. Creates the User on first login. Accounts whose email isn't verified get
 * `requiresVerification` and no session until the 6-digit code is confirmed (see /otp/verify).
 * Google accounts arrive already verified by Google.
 */
router.post('/firebase-session', async (req, res, next) => {
  try {
    const { idToken, name } = req.body;
    if (!idToken) return res.status(400).json({ message: 'idToken is required' });

    const decoded = await verifyFirebaseToken(idToken);

    let user = await User.findOne({ firebaseUid: decoded.uid });
    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        name: name || decoded.name || decoded.email.split('@')[0],
        email: decoded.email,
        isEmailVerified: !!decoded.email_verified,
        avatarUrl: decoded.picture || '',
      });
    } else if (decoded.email_verified && !user.isEmailVerified) {
      user.isEmailVerified = true;
    }

    user.lastLoginAt = new Date();

    // --- Admin allowlist (env-controlled, no manual DB edits ever needed) ---
    // Set ADMIN_EMAILS in your backend environment as a comma-separated list, e.g.
    // ADMIN_EMAILS=you@example.com,cofounder@example.com
    // Matching, verified emails are promoted to systemRole 'admin' on login. It only ever promotes.
    const adminAllowlist = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (decoded.email_verified && adminAllowlist.includes(user.email.toLowerCase()) && user.systemRole !== 'admin') {
      user.systemRole = 'admin';
    }

    await user.save();

    if (!user.isEmailVerified) {
      return res.status(200).json({
        requiresVerification: true,
        message: 'Please enter the 6-digit code we emailed you to verify your account.',
      });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // The refresh token goes into an httpOnly cookie only. It is never in the response body.
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);

    res.json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        systemRole: user.systemRole,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/otp/send
 * Body: { idToken }
 * Emails a new 6-digit verification code. One code per user, valid for 10 minutes,
 * with at least 60 seconds between codes.
 */
router.post('/otp/send', async (req, res, next) => {
  try {
    const user = await userFromIdToken(req.body.idToken);
    if (user.isEmailVerified) return res.json({ message: 'Email is already verified', alreadyVerified: true });
    if (!emailConfigured()) {
      throw httpError(503, 'Email sending is not set up yet. Please try again later.');
    }

    const existing = await OtpCode.findOne({ user: user._id });
    if (existing) {
      const wait = Math.ceil((existing.lastSentAt.getTime() + RESEND_MS - Date.now()) / 1000);
      if (wait > 0) {
        return res.status(429).json({ message: 'Please wait before requesting another code', retryAfter: wait });
      }
    }

    const code = generateCode();
    await OtpCode.findOneAndUpdate(
      { user: user._id },
      {
        codeHash: hashCode(code, user._id),
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        lastSentAt: new Date(),
      },
      { upsert: true }
    );

    try {
      await sendOtpEmail({ to: user.email, name: user.name, code });
    } catch (mailErr) {
      // Remove the code so the user can retry straight away instead of waiting out the cooldown
      await OtpCode.deleteOne({ user: user._id });
      console.error('OTP email failed:', mailErr.message);
      throw httpError(502, 'We could not send the email. Please try again in a moment.');
    }

    res.json({ message: 'Code sent', resendInSeconds: Math.round(RESEND_MS / 1000) });
  } catch (err) {
    sendError(res, next, err);
  }
});

/**
 * POST /api/auth/otp/verify
 * Body: { idToken, code }
 * Checks the 6-digit code. Five wrong guesses cancel the code, so a new one is needed.
 */
router.post('/otp/verify', async (req, res, next) => {
  try {
    const user = await userFromIdToken(req.body.idToken);
    const code = String(req.body.code || '');
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: 'Enter the 6-digit code' });
    if (user.isEmailVerified) return res.json({ message: 'Email verified' });

    const otp = await OtpCode.findOne({ user: user._id });
    if (!otp || otp.expiresAt < new Date()) {
      return res.status(400).json({ message: 'This code has expired. Request a new one.' });
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      await OtpCode.deleteOne({ _id: otp._id });
      return res.status(429).json({ message: 'Too many wrong attempts. Request a new code.' });
    }

    if (!codesMatch(hashCode(code, user._id), otp.codeHash)) {
      otp.attempts += 1;
      await otp.save();
      const left = MAX_ATTEMPTS - otp.attempts;
      if (left <= 0) {
        await OtpCode.deleteOne({ _id: otp._id });
        return res.status(429).json({ message: 'Too many wrong attempts. Request a new code.' });
      }
      return res.status(400).json({
        message: `That code isn't right. ${left} attempt${left === 1 ? '' : 's'} left.`,
      });
    }

    await OtpCode.deleteOne({ _id: otp._id });
    user.isEmailVerified = true;
    await user.save();
    res.json({ message: 'Email verified' });
  } catch (err) {
    sendError(res, next, err);
  }
});

/** POST /api/auth/refresh - reads the httpOnly refresh cookie and issues a new access token */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('_id status');
    if (!user || user.status === 'suspended') {
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    res.json({ accessToken: signAccessToken(user) });
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

/** POST /api/auth/logout - clears the refresh cookie. No login needed, so it works even with an expired session. */
router.post('/logout', (req, res) => {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  res.json({ message: 'Logged out' });
});

/**
 * Forgot password is handled client-side via Firebase's sendPasswordResetEmail().
 * This endpoint only confirms whether an account exists, for UX messaging.
 */
router.post('/forgot-password/check', async (req, res) => {
  const { email } = req.body;
  const exists = await User.exists({ email: email?.toLowerCase() });
  res.json({ exists: !!exists });
});

/**
 * GET /api/auth/me - current session profile
 * Returns an explicit whitelist of fields only, never the raw Mongoose document.
 */
router.get('/me', protect, async (req, res) => {
  const { _id, name, email, avatarUrl, systemRole, isEmailVerified, status, lastLoginAt } = req.user;
  res.json({ user: { id: _id, name, email, avatarUrl, systemRole, isEmailVerified, status, lastLoginAt } });
});

export default router;
