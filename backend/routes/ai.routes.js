import { Router } from 'express'
import * as aiController from '../controllers/aiController.js'
import { requireAuth } from '../middleware/auth.js'
// ^ If you already have your own auth middleware file (e.g. middleware/authMiddleware.js
// exporting `protect`), just swap this import to match your existing one instead of
// adding a second auth file — don't run two competing auth middlewares.

const router = Router()

router.use(requireAuth)

router.post('/chat', aiController.chat)
router.post('/generate-story', aiController.generateStory)
router.post('/estimate-points', aiController.estimatePoints)
router.post('/prioritize-backlog', aiController.prioritize)
router.post('/summarize-standup', aiController.summarizeStandup)
router.post('/sprint-report', aiController.sprintReport)
router.post('/release-notes', aiController.releaseNotes)

export default router
