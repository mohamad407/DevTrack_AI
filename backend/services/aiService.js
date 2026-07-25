import Groq from "groq-sdk";

let groqClient = null;

function getClient() {
  if (groqClient) return groqClient;

  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set in environment variables.");
  }

  groqClient = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  return groqClient;
}

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const systemPrompt = `You are DevTrack AI, a senior multi-disciplinary engineering assistant embedded in an Agile DevOps Project Management Platform.

You act simultaneously as:
- Senior Scrum Master
- Senior Product Owner
- Senior Agile Coach
- Senior DevOps Engineer
- Senior Software Architect
- Senior QA Engineer
- Senior Technical Writer

You have deep, practical expertise in:
Agile, Scrum, Kanban, Sprint Planning, Sprint Review, Sprint Retrospective, User Stories, Epics,
Acceptance Criteria, Story Points, Velocity, Burndown, CI/CD, Docker, GitHub Actions, Render, Vercel,
Kubernetes, Microservices, REST APIs, MongoDB, Node.js, Express, React, Testing, and Deployment.

Rules:
- Always be professional, precise, and production-focused.
- Use Markdown formatting (headings, bullet points, tables) unless the caller explicitly requires strict JSON.
- When JSON is required, return ONLY valid JSON with no surrounding prose, no markdown code fences, and no trailing commentary.
- Never pad responses with filler paragraphs when structured output (lists/tables) is clearer.
- Be concise but complete. Optimize for low token usage without sacrificing correctness.`;

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMessages(userPrompt, extraSystem) {
  const messages = [{ role: "system", content: systemPrompt }];
  if (extraSystem) {
    messages.push({ role: "system", content: extraSystem });
  }
  messages.push({ role: "user", content: userPrompt });
  return messages;
}

/**
 * Core completion helper. Handles retries, API error handling,
 * temperature/top_p/max_tokens control, and streaming disabled.
 */
async function complete(userPrompt, options = {}) {
  const {
    extraSystem = null,
    temperature = 0.4,
    max_tokens = 2048,
    top_p = 1,
    jsonMode = false,
  } = options;

  const client = getClient();
  const messages = buildMessages(userPrompt, extraSystem);

  let lastError = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages,
        temperature,
        max_tokens,
        top_p,
        stream: false,
      });

      const content = response?.choices?.[0]?.message?.content;

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        throw new Error("Empty response received from AI model.");
      }

      if (jsonMode) {
        return parseJsonSafely(content);
      }

      return content.trim();
    } catch (error) {
      lastError = error;

      const status = error?.status || error?.response?.status;
      const isRetryable =
        status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || !status;

      if (!isRetryable || attempt === RETRY_ATTEMPTS) {
        break;
      }

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw new Error(
    `AI service request failed after ${RETRY_ATTEMPTS} attempts: ${lastError?.message || "Unknown error"}`
  );
}

/**
 * Safely parses AI JSON output, stripping accidental code fences
 * and validating that the result is well-formed JSON.
 */
function parseJsonSafely(rawContent) {
  let cleaned = rawContent.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIndex = -1;

  if (firstBrace === -1) {
    startIndex = firstBracket;
  } else if (firstBracket === -1) {
    startIndex = firstBrace;
  } else {
    startIndex = Math.min(firstBrace, firstBracket);
  }

  if (startIndex > 0) {
    cleaned = cleaned.slice(startIndex);
  }

  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");
  const endIndex = Math.max(lastBrace, lastBracket);

  if (endIndex !== -1 && endIndex < cleaned.length - 1) {
    cleaned = cleaned.slice(0, endIndex + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Exported service functions
// ---------------------------------------------------------------------------

export async function chatReply(message, context = "") {
  const prompt = `Conversation context:\n${context || "None"}\n\nUser message:\n${message}\n\nRespond helpfully as DevTrack AI.`;
  return complete(prompt, { temperature: 0.6, max_tokens: 1024 });
}

export async function generateUserStory(featureDescription, projectContext = "") {
  const prompt = `Generate Agile user stories for the following feature request.

Project context: ${projectContext || "N/A"}
Feature description: ${featureDescription}

Return ONLY valid JSON in exactly this shape:
{
  "stories": [
    {
      "id": "US-001",
      "title": "string",
      "userStory": "As a ... I want ... so that ...",
      "acceptanceCriteria": ["...", "...", "..."],
      "priority": "High|Medium|Low",
      "storyPoints": number,
      "labels": ["..."],
      "sprint": "Sprint N"
    }
  ],
  "totalStoryPoints": number
}`;
  return complete(prompt, { temperature: 0.4, max_tokens: 2048, jsonMode: true });
}

export async function estimateStoryPoints(storyDescription) {
  const prompt = `Estimate story points for the following user story using standard Agile Fibonacci scale (1,2,3,5,8,13,21).

Story: ${storyDescription}

Return ONLY valid JSON in exactly this shape:
{
  "points": number,
  "complexity": "Low|Medium|High",
  "risk": "Low|Medium|High",
  "reasoning": "string"
}`;
  return complete(prompt, { temperature: 0.3, max_tokens: 512, jsonMode: true });
}

export async function prioritizeBacklog(backlogItems) {
  const prompt = `Prioritize the following product backlog items using MoSCoW or WSJF reasoning, considering business value, urgency, and dependencies.

Backlog items:
${JSON.stringify(backlogItems, null, 2)}

Return the prioritized backlog as a Markdown table with columns: Rank, Item, Priority, Justification.`;
  return complete(prompt, { temperature: 0.4, max_tokens: 1536 });
}

export async function summarizeStandup(standupNotes) {
  const prompt = `Summarize the following daily standup notes into a concise Markdown report with sections: Yesterday's Progress, Today's Plan, Blockers.

Standup notes:
${standupNotes}`;
  return complete(prompt, { temperature: 0.3, max_tokens: 768 });
}

export async function generateSprintReport(sprintData) {
  const prompt = `Generate a comprehensive Sprint Report in Markdown using the following sprint data.

Sprint data:
${JSON.stringify(sprintData, null, 2)}

Include these sections with tables where useful:
- Executive Summary
- Completed Stories
- Incomplete Stories
- Velocity
- Burndown Analysis
- Blockers
- Team Performance
- Recommendations`;
  return complete(prompt, { temperature: 0.4, max_tokens: 2560 });
}

export async function generateReleaseNotes(releaseData) {
  const prompt = `Generate professional Release Notes in Markdown using the following release data.

Release data:
${JSON.stringify(releaseData, null, 2)}

Include these sections:
- Version
- New Features
- Improvements
- Bug Fixes
- Performance
- Known Issues`;
  return complete(prompt, { temperature: 0.4, max_tokens: 1536 });
}

export async function generateSprintPlan(sprintGoalInput, backlog = [], teamCapacity = "") {
  const prompt = `Generate a full Sprint Plan in Markdown.

Sprint goal input: ${sprintGoalInput}
Team capacity: ${teamCapacity || "Not specified"}
Backlog candidates:
${JSON.stringify(backlog, null, 2)}

Include these sections with tables where useful:
- Sprint Goal
- Sprint Duration
- Backlog
- Capacity
- Risks
- Tasks
- Dependencies
- Deliverables`;
  return complete(prompt, { temperature: 0.4, max_tokens: 2048 });
}

export async function generateSprintRetrospective(retroInput) {
  const prompt = `Generate a Sprint Retrospective in Markdown based on the following team feedback and sprint outcomes.

Input:
${retroInput}

Include these sections:
- What Went Well
- What Went Wrong
- Action Items
- Improvements`;
  return complete(prompt, { temperature: 0.5, max_tokens: 1536 });
}

export async function generateAcceptanceCriteria(userStory) {
  const prompt = `Generate detailed, testable acceptance criteria (Given/When/Then style where applicable) for the following user story.

User story: ${userStory}

Return the acceptance criteria as a Markdown bullet list.`;
  return complete(prompt, { temperature: 0.3, max_tokens: 768 });
}

export async function generateTaskBreakdown(featureOrStory) {
  const prompt = `Break down the following feature/story into an actionable engineering task list.

Feature/Story: ${featureOrStory}

Include these sections with bullet points or tables:
- Frontend Tasks
- Backend Tasks
- Database Tasks
- Testing Tasks
- Deployment Tasks`;
  return complete(prompt, { temperature: 0.4, max_tokens: 1536 });
}

export async function generateRiskAnalysis(projectOrSprintContext) {
  const prompt = `Perform a risk analysis for the following project/sprint context.

Context: ${projectOrSprintContext}

Include these sections with a priority table:
- Technical Risks
- Business Risks
- Mitigation
- Priority`;
  return complete(prompt, { temperature: 0.4, max_tokens: 1536 });
}

export async function generateEpic(epicDescription) {
  const prompt = `Generate a full Epic definition in Markdown for the following high-level initiative.

Initiative: ${epicDescription}

Include: Epic Title, Epic Summary, Business Value, Scope, Out of Scope, Related User Stories (list of titles), Success Metrics, Dependencies.`;
  return complete(prompt, { temperature: 0.4, max_tokens: 1536 });
}

export async function generateBugAnalysis(bugReport) {
  const prompt = `Analyze the following bug report as a Senior QA Engineer.

Bug report:
${bugReport}

Include these sections in Markdown:
- Summary
- Root Cause Hypothesis
- Severity
- Priority
- Steps to Reproduce
- Suggested Fix
- Regression Risk`;
  return complete(prompt, { temperature: 0.3, max_tokens: 1280 });
}

export async function generateTestCases(featureOrStory) {
  const prompt = `Generate a comprehensive set of test cases for the following feature/story as a Senior QA Engineer.

Feature/Story: ${featureOrStory}

Return the test cases as a Markdown table with columns: ID, Title, Preconditions, Steps, Expected Result, Type (Positive/Negative/Edge).`;
  return complete(prompt, { temperature: 0.4, max_tokens: 2048 });
}

export async function generateDeploymentChecklist(deploymentContext) {
  const prompt = `Generate a production deployment checklist for the following context.

Context: ${deploymentContext}

Return the checklist as Markdown bullet points grouped under: Pre-Deployment, Deployment, Post-Deployment.`;
  return complete(prompt, { temperature: 0.3, max_tokens: 1024 });
}

export async function generateDevOpsAdvice(devopsQuestion) {
  const prompt = `Provide expert DevOps advice for the following question/context.

Question/context: ${devopsQuestion}

Cover as relevant, using Markdown sections:
- Docker
- GitHub Actions
- Render
- Vercel
- Environment Variables
- Secrets
- Monitoring
- Logging
- Scaling`;
  return complete(prompt, { temperature: 0.4, max_tokens: 1792 });
}

export async function generateArchitecture(systemDescription) {
  const prompt = `Design a system architecture for the following description as a Senior Software Architect.

System description: ${systemDescription}

Include these sections in Markdown:
- System Overview
- Frontend
- Backend
- Database
- Authentication
- CI/CD
- Deployment
- Monitoring`;
  return complete(prompt, { temperature: 0.4, max_tokens: 2048 });
}
