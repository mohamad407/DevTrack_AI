import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import Project from '../models/Project.model.js';

/** Verifies the backend-issued JWT (minted after Firebase Email OTP verification). */
export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.status(401).json({ message: 'User no longer exists' });
    if (!user.isEmailVerified) {
      return res.status(403).json({ message: 'Email verification required before accessing the dashboard' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'This account has been suspended' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, invalid or expired token' });
  }
};

/** Restrict to platform-level admins (Admin Panel). */
export const requireSystemAdmin = (req, res, next) => {
  if (req.user?.systemRole !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/**
 * Restrict to specific project roles (Admin, Scrum Master, Developer, Tester, Product Owner).
 * Usage: requireProjectRole(['Admin', 'Scrum Master']) as middleware after `protect`,
 * on routes containing :projectId.
 */
export const requireProjectRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.body.project || req.query.project;
      const project = await Project.findById(projectId);
      if (!project) return res.status(404).json({ message: 'Project not found' });

      const membership = project.members.find((m) => m.user.toString() === req.user._id.toString());
      const isOwner = project.owner.toString() === req.user._id.toString();

      if (!membership && !isOwner) {
        return res.status(403).json({ message: 'You are not a member of this project' });
      }
      const role = isOwner ? 'Admin' : membership.role;
      if (allowedRoles.length && !allowedRoles.includes(role)) {
        return res.status(403).json({ message: `Requires one of roles: ${allowedRoles.join(', ')}` });
      }

      req.project = project;
      req.projectRole = role;
      next();
    } catch (err) {
      next(err);
    }
  };
};
