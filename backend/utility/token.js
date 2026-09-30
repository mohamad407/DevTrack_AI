import jwt from 'jsonwebtoken';

// The access token intentionally carries ONLY the user id. Role/email are never
// trusted from the token — every protected route re-fetches the user fresh from
// MongoDB (see middleware/auth.middleware.js -> protect), so embedding role or
// other claims here would be both redundant AND unnecessary exposure (JWT payloads
// are signed, not encrypted — anyone can base64-decode them client-side).
export const signAccessToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

export const signRefreshToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
