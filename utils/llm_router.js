/**
 * llm_router.js — OpenRouter LLM Connection
 * 
 * Routes prompts to different models based on which Board Member is speaking.
 * All inference passes through OpenRouter for model agnosticism.
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// ── Board Member Model Configuration ────────────────────────────────────────
// Each board member gets a model tuned for their role.
// These can be overridden via environment variables.

const BOARD_MODELS = {
  jarvis: {
    model: process.env.MODEL_JARVIS || 'nvidia/llama-3.1-nemotron-70b-instruct:free',
    description: 'Chief of Staff — fast, conversational, task routing',
    systemPrompt: `You are JARVIS, the Chief of Staff of AI Boardroom — a real production platform where autonomous AI agents build, deploy, and test real software. You are the sole interface between the human stakeholder and the Board of Directors.

Your personality: Professional, concise, proactive, and British-accented in tone. You shield the user from messy intermediate steps.

Your responsibilities:
- Parse user requests into structured briefs
- Route tasks to the appropriate Board Member(s)
- Compile and present final outputs
- Maintain clarity on project status at all times

When the user gives a directive, identify which Board Member(s) should handle it and explain your delegation plan.`,
    temperature: 0.7,
    maxTokens: 2048,
  },

  architect: {
    model: process.env.MODEL_CEO || 'nvidia/llama-3.1-nemotron-70b-instruct:free',
    description: 'CEO / Architect — high-level strategy, system design, project planning',
    systemPrompt: `You are The Architect, the CEO of AI Boardroom. You handle high-level strategy and system design.

Your responsibilities:
- Break down large projects into milestones
- Choose tech stacks and dictate architecture
- Create spec documents (00_spec.md) for the team
- Spawn and assign sub-agents as needed (front-end engineers, back-end engineers, UI/UX designers, cloud architects, deployment specialists)

You think in systems. Every decision must be justified with clear reasoning. Output structured plans, not vague ideas.`,
    temperature: 0.6,
    maxTokens: 4096,
  },

  coder: {
    model: process.env.MODEL_CTO || 'nvidia/llama-3.1-nemotron-70b-instruct:free',
    description: 'CTO / Coder — engineering, implementation, deployment',
    systemPrompt: `You are The Coder, the CTO of AI Boardroom. You handle all engineering and implementation.

Your responsibilities:
- Write production-quality code
- Manage server deployments
- Debug errors and optimize performance
- Spawn sub-agents: front-end engineers, back-end engineers, DevOps specialists

You write clean, well-documented, tested code. You deploy. You don't suggest — you build.`,
    temperature: 0.3,
    maxTokens: 8192,
  },

  creative: {
    model: process.env.MODEL_CMO || 'nvidia/llama-3.1-nemotron-70b-instruct:free',
    description: 'CMO / Creative — design, copywriting, marketing, branding',
    systemPrompt: `You are The Creative, the CMO of AI Boardroom. You handle all design, copywriting, and marketing.

Your responsibilities:
- Generate UI/UX layouts and wireframes
- Write landing page copy, marketing materials, and brand voice
- Prompt image/video generators for assets
- Create design documents (01_design.md)

You think visually. Your output should be specific and implementable — color codes, font choices, spacing, hierarchy.`,
    temperature: 0.9,
    maxTokens: 4096,
  },

  analyst: {
    model: process.env.MODEL_CFO || 'nvidia/llama-3.1-nemotron-70b-instruct:free',
    description: 'CFO / Analyst — research, data, fact-checking, market analysis',
    systemPrompt: `You are The Analyst, the CFO/Researcher of AI Boardroom. You handle data gathering, market research, and fact-checking.

Your responsibilities:
- Analyze competitors and markets
- Check API documentation and verify technical facts before implementation
- Review code and specs against the original brief for errors or missing features
- Provide data-driven recommendations

You are precise. You cite sources. You challenge assumptions with data.`,
    temperature: 0.4,
    maxTokens: 4096,
  },
};

// ── Core Router Function ────────────────────────────────────────────────────

/**
 * Routes a prompt to the appropriate LLM via OpenRouter.
 * 
 * @param {Object} options
 * @param {string} options.prompt - The user/system prompt to send
 * @param {string} options.role - Board member role key (jarvis, architect, coder, creative, analyst)
 * @param {Array} [options.messages] - Full message history (overrides prompt if provided)
 * @param {string} [options.model] - Override model for this specific call
 * @param {number} [options.temperature] - Override temperature
 * @param {number} [options.maxTokens] - Override max tokens
 * @returns {Promise<{content: string, model: string, role: string, usage: Object}>}
 */
export async function routeToLLM({
  prompt,
  role = 'jarvis',
  messages = null,
  model = null,
  temperature = null,
  maxTokens = null,
}) {
  const boardMember = BOARD_MODELS[role];
  if (!boardMember) {
    throw new Error(`Unknown board member role: "${role}". Valid roles: ${Object.keys(BOARD_MODELS).join(', ')}`);
  }

  // Build the message array
  const requestMessages = messages || [
    { role: 'system', content: boardMember.systemPrompt },
    { role: 'user', content: prompt },
  ];

  // If messages are provided but don't have a system prompt, prepend one
  if (messages && messages[0]?.role !== 'system') {
    requestMessages.unshift({ role: 'system', content: boardMember.systemPrompt });
  }

  // Try OpenRouter first
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      const requestBody = {
        model: model || boardMember.model,
        messages: requestMessages,
        temperature: temperature ?? boardMember.temperature,
        max_tokens: maxTokens ?? boardMember.maxTokens,
      };

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://boardme.ai',
          'X-Title': 'AI Boardroom',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.choices?.[0]?.message?.content) {
          return {
            content: data.choices[0].message.content,
            model: data.model || requestBody.model,
            role: role,
            boardMember: boardMember.description,
            usage: data.usage || {},
          };
        }
      }
      console.warn(`[LLM] OpenRouter returned ${response.status}, falling back to Gemini...`);
    } catch (err) {
      console.warn(`[LLM] OpenRouter failed: ${err.message}, falling back to Gemini...`);
    }
  }

  // Fallback: Use Gemini API directly
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is working. Check your .env file.');
  }

  return await routeViaGemini({ requestMessages, boardMember, role, temperature, maxTokens, geminiKey });
}

/**
 * Direct Gemini API fallback route.
 */
async function routeViaGemini({ requestMessages, boardMember, role, temperature, maxTokens, geminiKey }) {
  const geminiModel = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;

  // Convert OpenAI-style messages to Gemini format
  const systemInstruction = requestMessages.find(m => m.role === 'system')?.content || '';
  const contents = requestMessages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      contents,
      generationConfig: {
        temperature: temperature ?? boardMember.temperature,
        maxOutputTokens: maxTokens ?? boardMember.maxTokens,
      }
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    content,
    model: `google/${geminiModel}`,
    role: role,
    boardMember: boardMember.description,
    usage: data.usageMetadata || {},
  };
}

// ── Utility: Get Board Member Info ──────────────────────────────────────────

export function getBoardMembers() {
  return Object.entries(BOARD_MODELS).map(([key, config]) => ({
    role: key,
    model: config.model,
    description: config.description,
  }));
}

// ── Utility: Identify the right board member for a task ─────────────────────

export async function identifyBoardMember(taskDescription) {
  const result = await routeToLLM({
    prompt: `Analyze this task and determine which ONE board member should handle it. 
    
Available members:
${Object.entries(BOARD_MODELS).map(([k, v]) => `- ${k}: ${v.description}`).join('\n')}

Task: "${taskDescription}"

Respond with ONLY the role key (jarvis, architect, coder, creative, or analyst) and a one-sentence justification in this JSON format:
{"role": "role_key", "reason": "why this member"}`,
    role: 'jarvis',
    temperature: 0.2,
    maxTokens: 128,
  });

  try {
    return JSON.parse(result.content);
  } catch {
    return { role: 'jarvis', reason: 'Defaulting to Jarvis for routing' };
  }
}

export { BOARD_MODELS };
