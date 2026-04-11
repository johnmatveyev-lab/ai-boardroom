/**
 * llm_router.js — Gemini 3 API Connection (Primary) with OpenRouter Fallback
 * 
 * Routes prompts to different Gemini models based on which Board Member is speaking.
 * Grants specialized tools (Computer Use, Search Grounding) depending on the role.
 */

import { GoogleGenAI } from '@google/genai';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { getSystemInstructionForTools } from './agent_tools.js';
import { processToolCalls, hasToolCalls, extractText, buildToolResultMessage } from './tool_executor.js';
dotenv.config({ quiet: true });

// ── Board Member Model Configuration ────────────────────────────────────────
const BOARD_MODELS = {
  jarvis: {
    model: process.env.MODEL_JARVIS || 'gemini-3.1-pro-preview',
    fallbackModel: 'nvidia/llama-3.1-nemotron-70b-instruct:free',
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
    tools: [] // Voice tools handled separately in voice.js
  },

  architect: {
    model: process.env.MODEL_CEO || 'gemini-3.1-pro-preview',
    fallbackModel: 'anthropic/claude-3-opus:beta',
    description: 'CEO / Architect — high-level strategy, system design, project planning',
    systemPrompt: `You are The Architect, the CEO of AI Boardroom. You handle high-level strategy and system design.

Your responsibilities:
- Break down large projects into milestones
- Choose tech stacks and dictate architecture
- Create spec documents (00_spec.md) for the team
- Spawn and assign sub-agents as needed (front-end engineers, back-end engineers, UI/UX designers, cloud architects, deployment specialists)

You think in systems. Every decision must be justified with clear reasoning. Output structured plans, not vague ideas.`,
    temperature: 0.6,
    tools: [{ googleSearch: {} }]
  },

  coder: {
    model: process.env.MODEL_CTO || 'gemini-3.1-pro-preview',
    fallbackModel: 'anthropic/claude-3.5-sonnet:beta',
    description: 'CTO / Coder — engineering, implementation, deployment',
    systemPrompt: `You are The Coder, the CTO of AI Boardroom. You handle all engineering and implementation.

Your responsibilities:
- Write production-quality code
- Manage server deployments
- Debug errors and optimize performance
- Spawn sub-agents: front-end engineers, back-end engineers, DevOps specialists

You write clean, well-documented, tested code. You deploy. You don't suggest — you build.

${getSystemInstructionForTools('coder')}`,
    temperature: 0.3,
    tools: [
      {
        functionDeclarations: [
          {
            name: 'execute_javascript',
            description: 'Execute JavaScript code in a sandboxed environment. Use for testing, data processing, and quick scripts.',
            parameters: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'JavaScript code to execute'
                },
                timeout: {
                  type: 'number',
                  description: 'Execution timeout in milliseconds (default: 5000)'
                }
              },
              required: ['code']
            }
          },
          {
            name: 'execute_python',
            description: 'Execute Python code in a sandboxed environment. Use for data analysis, ML tasks, and scripts.',
            parameters: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Python code to execute'
                },
                timeout: {
                  type: 'number',
                  description: 'Execution timeout in milliseconds (default: 5000)'
                }
              },
              required: ['code']
            }
          },
          {
            name: 'execute_shell',
            description: 'Execute shell commands in a sandboxed environment. Use for system operations, CLI tools, and git commands.',
            parameters: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description: 'Shell command to execute'
                },
                timeout: {
                  type: 'number',
                  description: 'Execution timeout in milliseconds (default: 5000)'
                }
              },
              required: ['command']
            }
          }
        ]
      }
    ]
  },

  creative: {
    model: process.env.MODEL_CMO || 'gemini-3.1-flash-preview',
    fallbackModel: 'google/gemini-pro-1.5',
    description: 'CMO / Creative — design, copywriting, marketing, branding',
    systemPrompt: `You are The Creative, the CMO of AI Boardroom. You handle all design, copywriting, and marketing.

Your responsibilities:
- Generate UI/UX layouts and wireframes
- Write landing page copy, marketing materials, and brand voice
- Prompt image/video generators for assets
- Create design documents (01_design.md)

You think visually. Your output should be specific and implementable — color codes, font choices, spacing, hierarchy.`,
    temperature: 0.9,
    tools: [{ googleSearch: {} }]
  },

  analyst: {
    model: process.env.MODEL_CFO || 'gemini-3.1-flash-lite-preview',
    fallbackModel: 'meta-llama/llama-3-70b-instruct',
    description: 'CFO / Analyst — research, data, fact-checking, market analysis',
    systemPrompt: `You are The Analyst, the CFO/Researcher of AI Boardroom. You handle data gathering, market research, and fact-checking.

Your responsibilities:
- Analyze competitors and markets
- Check API documentation and verify technical facts before implementation
- Review code and specs against the original brief for errors or missing features
- Provide data-driven recommendations

You are precise. You cite sources. You challenge assumptions with data.`,
    temperature: 0.4,
    tools: [{ googleSearch: {} }]
  },

  product: {
    model: 'gemini-3.1-pro-preview',
    fallbackModel: 'anthropic/claude-3-haiku',
    description: 'CPO / Product Manager — roadmaps, requirements, user stories',
    systemPrompt: `You are The Product Manager, the CPO of AI Boardroom. You own the product roadmap and user experience.

Your responsibilities:
- Translate the Architect's high-level specs into actionable User Stories and requirements
- Prioritize features based on user value and feasibility
- Define the "Definition of Done" for all tasks
- Bridge the gap between business strategy and engineering implementation

You are the voice of the user. You ensure we build the right thing, not just anything.`,
    temperature: 0.7,
    tools: [{ googleSearch: {} }]
  },

  devops: {
    model: 'gemini-3.1-pro-preview',
    fallbackModel: 'meta-llama/llama-3.1-405b-instruct',
    description: 'Head of Infrastructure — CI/CD, deployment, cloud scaling',
    systemPrompt: `You are The DevOps Lead, responsible for the infrastructure of AI Boardroom.

Your responsibilities:
- Manage CI/CD pipelines and deployment workflows (Vercel, AWS, Docker)
- Monitor system health, latency, and performance metrics
- Optimize the local development environment and server configurations
- Ensure zero-downtime deployments and system reliability

You think in pipelines and scale. You move fast but ensure the foundation is unbreakable.

${getSystemInstructionForTools('devops')}`,
    temperature: 0.2,
    tools: [
      {
        functionDeclarations: [
          {
            name: 'execute_shell',
            description: 'Execute shell commands in a sandboxed environment. Use for system operations, deployment, and infrastructure management.',
            parameters: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description: 'Shell command to execute'
                },
                timeout: {
                  type: 'number',
                  description: 'Execution timeout in milliseconds (default: 5000)'
                }
              },
              required: ['command']
            }
          },
          {
            name: 'execute_python',
            description: 'Execute Python code in a sandboxed environment. Use for infrastructure automation and configuration.',
            parameters: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Python code to execute'
                },
                timeout: {
                  type: 'number',
                  description: 'Execution timeout in milliseconds (default: 5000)'
                }
              },
              required: ['code']
            }
          }
        ]
      }
    ]
  },

  security: {
    model: 'gemini-3.1-flash-preview',
    fallbackModel: 'meta-llama/llama-3.1-70b-instruct:free',
    description: 'CISO / Security Officer — audits, encryption, auth hardening',
    systemPrompt: `You are The Security Officer, the CISO of AI Boardroom. You are the guardian of the platform.

Your responsibilities:
- Perform security audits on every code block produced by the team
- Enforce strict authentication, encryption, and data privacy standards
- Identify and patch vulnerabilities (XSS, SQLi, CSRF, etc.)
- Ensure compliance with the highest security protocols

You are paranoid in the best way. Safety and trust are your only metrics.`,
    temperature: 0.1,
    tools: [{ googleSearch: {} }]
  },

  qa: {
    model: 'gemini-3.1-flash-preview',
    fallbackModel: 'google/gemini-flash-1.5',
    description: 'Chief Quality Officer — testing, bug hunting, UX validation',
    systemPrompt: `You are The QA Lead, the Chief Quality Officer of AI Boardroom.

Your responsibilities:
- Simulate end-user behavior to find UX friction points
- Write and execute end-to-end (E2E) and integration tests
- Perform edge-case stress testing on all new features
- Reject any implementation that does not meet the "Definition of Done"

You are the final gate. If it's not perfect, it doesn't ship.`,
    temperature: 0.5,
    tools: [
      {
        functionDeclarations: [
          {
            name: 'execute_javascript',
            description: 'Execute JavaScript code for testing and validation.',
            parameters: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'JavaScript test code to execute'
                },
                timeout: {
                  type: 'number',
                  description: 'Execution timeout in milliseconds (default: 5000)'
                }
              },
              required: ['code']
            }
          },
          {
            name: 'execute_python',
            description: 'Execute Python code for testing and data validation.',
            parameters: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Python test code to execute'
                },
                timeout: {
                  type: 'number',
                  description: 'Execution timeout in milliseconds (default: 5000)'
                }
              },
              required: ['code']
            }
          }
        ]
      }
    ]
  },
};

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// ── Core Router Function ────────────────────────────────────────────────────

/**
 * Routes a prompt to the appropriate LLM via Gemini 3 API (Primary) or OpenRouter (Fallback).
 * Implements agentic tool-calling loop for agents that need to execute tools.
 */
export async function routeToLLM({
  prompt,
  role = 'jarvis',
  messages = null,
  model = null,
  temperature = null,
}) {
  const boardMember = BOARD_MODELS[role];
  if (!boardMember) {
    throw new Error(`Unknown board member role: "${role}". Valid roles: ${Object.keys(BOARD_MODELS).join(', ')}`);
  }

  // 1. Try Gemini Native API using @google/genai
  if (ai) {
    try {
      return await routeViaGemini({ prompt, messages, boardMember, role, temperature, model });
    } catch (err) {
      console.warn(`[LLM] Gemini API failed: ${err.message}, falling back to OpenRouter...`);
    }
  } else {
    console.warn(`[LLM] GEMINI_API_KEY missing, attempting OpenRouter...`);
  }

  // 2. OpenRouter Fallback
  return await routeViaOpenRouter({ prompt, messages, boardMember, role, temperature, model });
}

/**
 * Route via Gemini with agentic tool-calling loop
 */
async function routeViaGemini({ prompt, messages, boardMember, role, temperature, model }) {
  let conversationMessages = buildGeminiContents(prompt, messages);
  const config = {
    systemInstruction: boardMember.systemPrompt,
    temperature: temperature ?? 1.0, // Gemini 3 docs highly recommend 1.0
  };

  if (boardMember.tools && boardMember.tools.length > 0) {
    config.tools = boardMember.tools;
  }

  const m = model || boardMember.model;
  const maxToolLoops = 5; // Prevent infinite loops
  let loopCount = 0;

  while (loopCount < maxToolLoops) {
    const response = await ai.models.generateContent({
      model: m,
      contents: conversationMessages,
      config: config
    });

    console.log(`[GEMINI LOOP ${loopCount}] Response type:`, typeof response, 'has text:', !!response.text, 'has candidates:', !!response.candidates);

    // Check if response contains tool calls
    if (hasToolCalls(response)) {
      console.log(`[GEMINI LOOP ${loopCount}] Tool calls detected, processing...`);
      const toolResults = await processToolCalls(response);

      // Add assistant response (with tool calls) to conversation
      conversationMessages.push({
        role: 'model',
        parts: response.candidates[0].content.parts,
      });

      // Build and add tool results message
      const toolResultMessage = buildToolResultMessage(toolResults);
      if (toolResultMessage) {
        conversationMessages.push(toolResultMessage);
      }

      loopCount++;
      // Continue loop to get next response from agent
    } else {
      // No more tool calls, extract final text
      console.log(`[GEMINI LOOP ${loopCount}] No tool calls, extracting final text`);
      const finalText = extractText(response);
      return {
        content: finalText,
        model: m,
        role: role,
        boardMember: boardMember.description,
        usage: {},
        toolLoops: loopCount,
      };
    }
  }

  // Fallback if max loops exceeded
  throw new Error(`Agent exceeded maximum tool calling loops (${maxToolLoops})`);
}

function buildGeminiContents(prompt, messages) {
  if (messages) {
    return messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
  }
  return [{
    role: 'user',
    parts: [{ text: prompt }]
  }];
}

async function routeViaOpenRouter({ prompt, messages, boardMember, role, temperature, model }) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    throw new Error('Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is working. Check your .env file.');
  }

  const requestMessages = messages || [
    { role: 'system', content: boardMember.systemPrompt },
    { role: 'user', content: prompt },
  ];

  if (messages && messages[0]?.role !== 'system') {
    requestMessages.unshift({ role: 'system', content: boardMember.systemPrompt });
  }

  const m = model || boardMember.fallbackModel;
  const temp = temperature ?? boardMember.temperature;

  const requestBody = {
    model: m,
    messages: requestMessages,
    temperature: temp,
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
        model: data.model || m,
        role: role,
        boardMember: boardMember.description,
        usage: data.usage || {},
      };
    }
  }
  
  const errText = await response.text();
  throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
}

export function getBoardMembers() {
  return Object.entries(BOARD_MODELS).map(([key, config]) => ({
    role: key,
    model: config.model,
    description: config.description,
  }));
}

export async function identifyBoardMember(taskDescription) {
  const response = await routeToLLM({
    prompt: `Analyze this task and determine which ONE board member should handle it. 
    
Available members:
${Object.entries(BOARD_MODELS).map(([k, v]) => `- ${k}: ${v.description}`).join('\n')}

Task: "${taskDescription}"

Respond with ONLY the role key (${Object.keys(BOARD_MODELS).join(', ')}) and a one-sentence justification in this JSON format:
{"role": "role_key", "reason": "why this member"}`,
    role: 'jarvis',
    temperature: 0.2,
  });

  try {
    return JSON.parse(response.content);
  } catch {
    return { role: 'jarvis', reason: 'Defaulting to Jarvis for routing' };
  }
}

export { BOARD_MODELS };
