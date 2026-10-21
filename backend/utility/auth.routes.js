import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import { verifyFirebaseToken } from '../config/firebase.js';
import { signAccessToken, signRefreshToken } from '../utility/token.js';
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

/**
 * POST /api/auth/firebase-session
 * Body: { idToken }
 * Flow: client completes Firebase Email OTP sign-in/sign-up in the browser,
 * gets a Firebase ID token, and exchanges it here for a DevTrack AI session (JWT).
 * Creates the User document on first login. Email verification status is
 * mirrored from Firebase (emailVerified is true once the OTP is confirmed).
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
    // Set ADMIN_EMAILS in your backend .env / Render environment as a comma-separated
    // list, e.g. ADMIN_EMAILS=you@example.com,cofounder@example.com
    // Anyone logging in with a matching, verified email is automatically promoted
    // to systemRole: 'admin'. This runs on every login, so adding a new email to the
    // env var + redeploying is all it takes — no console, no scripts, no Atlas UI.
    // It only ever promotes UP, never demotes — removing an email from the list does
    // not strip existing admins; use the Admin Panel's own role management for that.
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
        message: 'Please verify your email via the OTP link before accessing the dashboard.',
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
 * Forgot password is handled client-side via Firebase's
 * sendPasswordResetEmail() (see frontend/src/services/firebase.js).
 * This endpoint just confirms a user exists, for UX messaging purposes.
 */
router.post('/forgot-password/check', async (req, res) => {
  const { email } = req.body;
  const exists = await User.exists({ email: email?.toLowerCase() });
  res.json({ exists: !!exists });
});

/**
 * GET /api/auth/me - current session profile
 * Returns an explicit whitelist of fields only — never the raw Mongoose document.
 * This is deliberate defense-in-depth: even though passwordHash etc. already use
 * `select: false` on the schema, this guarantees that if someone adds a new
 * sensitive field to User.model.js later and forgets to exclude it, it still
 * can't leak over this response by accident.
 */
router.get('/me', protect, async (req, res) => {
  const { _id, name, email, avatarUrl, systemRole, isEmailVerified, status, lastLoginAt } = req.user;
  res.json({ user: { id: _id, name, email, avatarUrl, systemRole, isEmailVerified, status, lastLoginAt } });
});

export default router;
