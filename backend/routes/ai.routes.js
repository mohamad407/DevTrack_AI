import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.post('/chat', aiController.chat);
router.post('/generate-story', aiController.generateStory);
router.post('/estimate-points', aiController.estimatePoints);
router.post('/prioritize-backlog', aiController.prioritize);
router.post('/summarize-standup', aiController.summarizeStandup);
router.post('/sprint-report', aiController.sprintReport);
router.post('/release-notes', aiController.releaseNotes);

export default router;
