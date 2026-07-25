import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';

import connectDB from './config/db.js';
import { registerSocketHandlers } from './config/socket.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import backlogRoutes from './routes/backlog.routes.js';
import sprintRoutes from './routes/sprint.routes.js';
import taskRoutes from './routes/task.routes.js';
import aiRoutes from './routes/ai.routes.js';
import devopsRoutes from './routes/devops.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import adminRoutes from './routes/admin.routes.js';
import notificationRoutes from './routes/notification.routes.js';

import { errorHandler, notFound } from './middleware/error.middleware.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || '*', credentials: true },
});

// Make io accessible in route handlers via req.app.get('io')
app.set('io', io);

// ---- Core middleware ----
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api', apiLimiter);

// ---- Routes ----
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'DevTrack AI API', time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/backlog', backlogRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/devops', devopsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

registerSocketHandlers(io);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 DevTrack AI API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}).catch((err) => {
  console.error('Failed to connect to MongoDB:', err.message);
  process.exit(1);
});

export default app;
