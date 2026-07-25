// AI service — powered by Groq (https://console.groq.com), OpenAI-compatible chat completions.
// Get a free API key at https://console.groq.com/keys and set GROQ_API_KEY in your .env
import Groq from 'groq-sdk'

let client = null

function getClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured on the backend')
  }
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return client
}

// Fast + capable Groq-hosted model. Swap for 'llama-3.1-8b-instant' for lower latency,
// or 'llama-3.3-70b-versatile' for higher quality reasoning.
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

async function complete({ system, prompt, json = false, temperature = 0.6 }) {
  const groq = getClient()
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature,
    response_format: json ? { type: 'json_object' } : undefined,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ],
  })
  return completion.choices[0]?.message?.content?.trim() || ''
}

export async function chatReply(message, history = []) {
  const groq = getClient()
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content:
          'You are the AI Agile Assistant inside DevTrack AI, a scrum/DevOps project management tool. ' +
          'Be concise, practical, and speak like an experienced Scrum Master. When helpful, format with short bullet points.',
      },
      ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text })),
      { role: 'user', content: message },
    ],
  })
  return completion.choices[0]?.message?.content?.trim() || ''
}

export async function generateUserStory(prompt) {
  const raw = await complete({
    json: true,
    system:
      'You write Agile user stories for a scrum backlog. Respond ONLY with strict JSON, no markdown fences, ' +
      'matching this shape: {"title": string (in "As a ... I want ... so that ..." format), ' +
      '"points": number (Fibonacci: 1,2,3,5,8,13), "priority": "High"|"Medium"|"Low", ' +
      '"labels": string[], "acceptanceCriteria": string[] (3-5 items)}',
    prompt: `Feature request: ${prompt}`,
  })
  return JSON.parse(raw)
}

export async function estimateStoryPoints(storyText) {
  const raw = await complete({
    json: true,
    system:
      'You estimate Agile story points using the Fibonacci scale (1,2,3,5,8,13,21) based on complexity, ' +
      'uncertainty, and effort. Respond ONLY with strict JSON: {"points": number, "reasoning": string}',
    prompt: storyText,
  })
  return JSON.parse(raw)
}

export async function prioritizeBacklog(items) {
  const raw = await complete({
    json: true,
    system:
      'You prioritize an Agile backlog for maximum business value and risk reduction. Respond ONLY with strict JSON: ' +
      '{"order": string[] (array of the given ids, most important first), "rationale": string}',
    prompt: `Backlog items (id: title): ${items.map((i) => `${i.id}: ${i.title}`).join('\n')}`,
  })
  return JSON.parse(raw)
}

export async function summarizeStandup(notes) {
  return complete({
    system:
      'You summarize raw daily standup notes into a clean async update with sections: Yesterday, Today, Blockers. ' +
      'Be concise and use bullet points.',
    prompt: notes,
  })
}

export async function generateSprintReport({ sprintName, goal, completed, carriedOver, velocity }) {
  return complete({
    system: 'You write a concise, professional sprint report for stakeholders. Use short sections with headers.',
    prompt:
      `Sprint: ${sprintName}\nGoal: ${goal}\nCompleted items: ${completed?.join(', ') || 'none'}\n` +
      `Carried over: ${carriedOver?.join(', ') || 'none'}\nVelocity: ${velocity} points\n` +
      'Write: 1) Summary 2) Highlights 3) Risks/blockers 4) Next sprint focus.',
  })
}

export async function generateReleaseNotes(items) {
  return complete({
    system:
      'You write customer-facing release notes from a list of completed engineering tickets. ' +
      'Group into "New Features", "Improvements", "Bug Fixes". Keep it non-technical and friendly.',
    prompt: items.join('\n'),
  })
}
