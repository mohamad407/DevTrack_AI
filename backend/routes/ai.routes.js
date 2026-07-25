import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { protect, requireProjectRole } from '../middleware/auth.middleware.js';
import Story from '../models/Story.model.js';
import Sprint from '../models/Sprint.model.js';

const router = Router();
router.use(protect);

const getModel = () => {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY is not configured on the server. Add it to backend/.env.');
    err.statusCode = 503;
    throw err;
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
};

/** Ask Gemini for strict JSON and parse it defensively. */
const askJSON = async (prompt) => {
  const model = getModel();
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, '').trim();
  return JSON.parse(text);
};

// 1. Generate user stories from a feature description
router.post('/generate-stories', requireProjectRole([]), async (req, res, next) => {
  try {
    const { featureDescription, count = 3 } = req.body;
    const prompt = `You are an expert Agile Product Owner. Given this feature description:
"${featureDescription}"

Generate ${count} well-formed user stories in strict JSON (an array only, no prose), each with:
title (string, "As a ... I want ... so that ..." format), description (1-2 sentences),
acceptanceCriteria (array of 3-5 strings), storyPoints (1,2,3,5,8, or 13),
priority ("Low"|"Medium"|"High"|"Critical"), labels (array of short strings).`;

    const stories = await askJSON(prompt);
    res.json({ stories });
  } catch (err) {
    next(err);
  }
});

// 2. Prioritize existing backlog
router.post('/prioritize-backlog', requireProjectRole([]), async (req, res, next) => {
  try {
    const stories = await Story.find({ project: req.project._id, status: { $ne: 'Done' } })
      .select('_id title description storyPoints priority');

    const prompt = `You are an Agile coach. Given these backlog items as JSON:
${JSON.stringify(stories)}

Return a strict JSON array of objects: { "id": "<story _id>", "suggestedPriority": "Low"|"Medium"|"High"|"Critical", "reason": "<one sentence>" }
ranked from most to least important to build next, considering typical Agile value/effort tradeoffs.`;

    const suggestions = await askJSON(prompt);
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
});

// 3. Estimate story points for a single story
router.post('/estimate-points', requireProjectRole([]), async (req, res, next) => {
  try {
    const { title, description, acceptanceCriteria = [] } = req.body;
    const prompt = `Estimate Agile story points (Fibonacci: 1,2,3,5,8,13) for this user story.
Title: ${title}
Description: ${description}
Acceptance Criteria: ${acceptanceCriteria.join('; ')}

Respond with strict JSON only: { "storyPoints": <number>, "reasoning": "<1-2 sentences>" }`;

    const estimate = await askJSON(prompt);
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

// 4. Summarize standup notes
router.post('/summarize-standup', requireProjectRole([]), async (req, res, next) => {
  try {
    const { notes } = req.body; // array of { author, yesterday, today, blockers }
    const prompt = `Summarize this daily standup into a concise team update, highlighting blockers first.
Standup notes (JSON): ${JSON.stringify(notes)}

Respond with strict JSON: { "summary": "<markdown text>", "blockers": ["..."] }`;

    const summary = await askJSON(prompt);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// 5. Generate a sprint report
router.post('/sprint-report/:sprintId', requireProjectRole([]), async (req, res, next) => {
  try {
    const sprint = await Sprint.findById(req.params.sprintId);
    const stories = await Story.find({ sprint: sprint._id });
    const completed = stories.filter((s) => s.status === 'Done');

    const prompt = `Write a concise Agile sprint report in markdown for stakeholders.
Sprint: ${sprint.name}, Goal: ${sprint.goal}
Total stories: ${stories.length}, Completed: ${completed.length}
Completed titles: ${completed.map((s) => s.title).join(', ')}
Include: summary, goal achievement assessment, and next-sprint suggestions. Return as JSON: { "reportMarkdown": "..." }`;

    const report = await askJSON(prompt);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// 6. Generate release notes from completed stories
router.post('/release-notes', requireProjectRole([]), async (req, res, next) => {
  try {
    const { storyIds } = req.body;
    const stories = await Story.find({ _id: { $in: storyIds } });

    const prompt = `Write user-facing release notes in markdown, grouped under "New Features", "Improvements", "Bug Fixes",
from these completed stories (JSON): ${JSON.stringify(stories.map((s) => ({ title: s.title, description: s.description, labels: s.labels })))}
Return JSON: { "releaseNotesMarkdown": "..." }`;

    const notes = await askJSON(prompt);
    res.json(notes);
  } catch (err) {
    next(err);
  }
});

// 7. General AI assistant chatbot (freeform, project-aware context optional)
router.post('/chat', async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;
    const model = getModel();
    // Gemini requires chat history to start with a 'user' message.
    // The frontend seeds the conversation with a hardcoded assistant
    // greeting (role 'model'), so drop any leading model messages.
    const trimmedHistory = [...history];
    while (trimmedHistory.length && trimmedHistory[0].role !== 'user') {
      trimmedHistory.shift();
    }
    const chat = model.startChat({
      history: trimmedHistory.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      systemInstruction:
        'You are the DevTrack AI assistant, an expert in Agile, Scrum, and DevOps practices. Be concise and practical.',
    });
    const result = await chat.sendMessage(message);
    res.json({ reply: result.response.text() });
  } catch (err) {
    next(err);
  }
});

export default router;
