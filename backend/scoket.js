import jwt from 'jsonwebtoken';

/**
 * Realtime channels:
 *  - "project:<id>"  -> joined by everyone viewing that project's board
 *  - events: task:created, task:updated, task:moved, task:deleted,
 *            comment:added, sprint:updated, notification:new, presence:update
 */
export const registerSocketHandlers = (io) => {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
      }
      next();
    } catch (err) {
      next(); // allow anonymous connect; protected emits still checked per-event if needed
    }
  });

  io.on('connection', (socket) => {
    socket.on('project:join', (projectId) => {
      socket.join(`project:${projectId}`);
      socket.to(`project:${projectId}`).emit('presence:update', {
        userId: socket.user?.id,
        status: 'online',
      });
    });

    socket.on('project:leave', (projectId) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on('task:move', (payload) => {
      // payload: { projectId, taskId, fromStatus, toStatus, order }
      io.to(`project:${payload.projectId}`).emit('task:moved', payload);
    });

    socket.on('comment:new', (payload) => {
      io.to(`project:${payload.projectId}`).emit('comment:added', payload);
    });

    socket.on('disconnect', () => {
      // presence cleanup could be tracked via a Map of socket.id -> userId/project if needed
    });
  });
};
