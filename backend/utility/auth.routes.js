import { Router } from 'express';
import User from '../models/User.model.js';
import { verifyFirebaseToken } from '../config/firebase.js';
import { signAccessToken, signRefreshToken } from '../utility/token.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

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
    await user.save();

    if (!user.isEmailVerified) {
      return res.status(200).json({
        requiresVerification: true,
        message: 'Please verify your email via the OTP link before accessing the dashboard.',
      });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.json({
      accessToken,
      refreshToken,
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

/** POST /api/auth/refresh - exchange a refresh token for a new access token */
router.post('/refresh', async (req, res, next) => {
  try {
    const jwt = (await import('jsonwebtoken')).default;
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' });
    res.json({ accessToken: signAccessToken(user) });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
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

/** GET /api/auth/me - current session profile */
router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
