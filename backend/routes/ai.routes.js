import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

// Each call costs Groq quota: limit per USER (not per IP), 20 requests / 5 min.
router.use(rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  message: { message: 'Too many AI requests. Please wait a few minutes.' },
}));

router.post('/chat', aiController.chat);
router.post('/salina', aiController.salina);
router.post('/generate-stories', aiController.generateStory);
router.post('/estimate-points', aiController.estimatePoints);
router.post('/prioritize-backlog', aiController.prioritize);
router.post('/summarize-standup', aiController.summarizeStandup);
router.post('/sprint-report', aiController.sprintReport);
router.post('/release-notes', aiController.releaseNotes);

export default router;
