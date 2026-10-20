import jwt from 'jsonwebtoken';
import User from './models/User.model.js';
import Project from './models/Project.model.js';
import { isObjectId } from './utility/security.js';

/**
 * Realtime channels:
 *  - "project:<id>"  -> only members of that project can join
 *  - events are emitted by the REST routes (server side) after DB writes.
 *    Clients can NOT broadcast arbitrary events any more (previously any
 *    anonymous client could forge task:moved / comment:added for any project).
 */
export const registerSocketHandlers = (io) => {
  // Authenticate every connection (anonymous sockets are rejected).
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id status isEmailVerified');
      if (!user || user.status === 'suspended' || !user.isEmailVerified) return next(new Error('unauthorized'));
      socket.user = { id: String(user._id) };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('project:join', async (projectId) => {
      try {
        if (!isObjectId(projectId)) return;
        const project = await Project.findById(projectId).select('owner members.user');
        if (!project) return;
        const uid = socket.user.id;
        const allowed = String(project.owner) === uid || project.members.some((m) => String(m.user) === uid);
        if (!allowed) return; // silently ignore non-members
        socket.join(`project:${projectId}`);
        socket.to(`project:${projectId}`).emit('presence:update', { userId: uid, status: 'online' });
      } catch {
        /* ignore */
      }
    });

    socket.on('project:leave', (projectId) => {
      if (isObjectId(projectId)) socket.leave(`project:${projectId}`);
    });
  });
};
