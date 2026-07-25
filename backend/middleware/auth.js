// Only add this file if your project doesn't already have an auth middleware.
// If you already have middleware/authMiddleware.js (or similar) that verifies your JWT
// and sets req.user, skip this file entirely and point routes/aiRoutes.js at that one instead.
import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload // { id, email, role, name }
    next()
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid — please log in again' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' })
    }
    next()
  }
}
