import * as aiService from '../services/aiService.js'

// Small helper so every AI route reports the SAME clear error shape the frontend
// already knows how to render as a fallback chat bubble.
function handleAiError(res, err) {
  console.error('AI service error:', err.message)
  const misconfigured = err.message?.includes('GROQ_API_KEY')
  return res.status(misconfigured ? 500 : 502).json({
    error: misconfigured
      ? 'GROQ_API_KEY is not configured on the backend'
      : 'The AI service could not complete this request',
  })
}

export async function chat(req, res) {
  try {
    const { message, history } = req.body
    if (!message) return res.status(400).json({ error: 'message is required' })
    const reply = await aiService.chatReply(message, history)
    res.json({ reply })
  } catch (err) {
    handleAiError(res, err)
  }
}

export async function generateStory(req, res) {
  try {
    const { featureDescription, project } = req.body
    if (!featureDescription) return res.status(400).json({ error: 'featureDescription is required' })
    const story = await aiService.generateUserStory(featureDescription, project)
    res.json({ story })
  } catch (err) {
    handleAiError(res, err)
  }
}

export async function estimatePoints(req, res) {
  try {
    const { storyText } = req.body
    if (!storyText) return res.status(400).json({ error: 'storyText is required' })
    const estimate = await aiService.estimateStoryPoints(storyText)
    res.json(estimate)
  } catch (err) {
    handleAiError(res, err)
  }
}

export async function prioritize(req, res) {
  try {
    const { items } = req.body
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array is required' })
    const result = await aiService.prioritizeBacklog(items)
    res.json(result)
  } catch (err) {
    handleAiError(res, err)
  }
}

export async function summarizeStandup(req, res) {
  try {
    const { notes } = req.body
    if (!notes) return res.status(400).json({ error: 'notes is required' })
    const summary = await aiService.summarizeStandup(notes)
    res.json({ summary })
  } catch (err) {
    handleAiError(res, err)
  }
}

export async function sprintReport(req, res) {
  try {
    const report = await aiService.generateSprintReport(req.body)
    res.json({ report })
  } catch (err) {
    handleAiError(res, err)
  }
}

export async function releaseNotes(req, res) {
  try {
    const { items } = req.body
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array is required' })
    const notes = await aiService.generateReleaseNotes(items)
    res.json({ notes })
  } catch (err) {
    handleAiError(res, err)
  }
}
