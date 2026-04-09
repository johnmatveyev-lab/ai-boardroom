/**
 * chat.js — Chat API Routes
 * 
 * Handles all communication between the Jarvis frontend and the Board of Directors.
 */

import { Router } from 'express';
import { routeToLLM, getBoardMembers, identifyBoardMember } from '../utils/llm_router.js';
import { logSystemEvent } from '../utils/vault.js';

const router = Router();

// In-memory conversation history (per-session; production would use a DB)
const conversations = new Map();

// ── POST /api/chat ──────────────────────────────────────────────────────────
// Main chat endpoint. Jarvis receives input, delegates to Board Members.

router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default', role = 'jarvis' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create conversation history
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const history = conversations.get(sessionId);

    // Add user message to history
    history.push({ role: 'user', content: message });

    // Route to the appropriate board member
    const result = await routeToLLM({
      messages: history,
      role: role,
    });

    // Add assistant response to history
    history.push({ role: 'assistant', content: result.content });

    // Keep history manageable (last 50 messages)
    if (history.length > 50) {
      const systemMsg = history.find(m => m.role === 'system');
      const recent = history.slice(-48);
      conversations.set(sessionId, systemMsg ? [systemMsg, ...recent] : recent);
    }

    // Log the interaction
    await logSystemEvent(role, 'CHAT', `User query processed by ${result.boardMember}`);

    res.json({
      response: result.content,
      model: result.model,
      role: result.role,
      boardMember: result.boardMember,
      usage: result.usage,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[CHAT ERROR]', err.message);

    // If OpenRouter key is missing, return a helpful demo response
    if (err.message.includes('OPENROUTER_API_KEY')) {
      return res.json({
        response: `I'm JARVIS, your Chief of Staff. I'm currently running in **demo mode** because the OpenRouter API key hasn't been configured yet.\n\nTo activate the full Board of Directors, add your key to the \`.env\` file:\n\`\`\`\nOPENROUTER_API_KEY=your-key-here\n\`\`\`\n\nGet a key at [openrouter.ai/keys](https://openrouter.ai/keys)\n\nOnce connected, I'll be able to route your directives to:\n- **The Architect (CEO)** — Strategy & system design\n- **The Coder (CTO)** — Engineering & deployment\n- **The Creative (CMO)** — Design & marketing\n- **The Analyst (CFO)** — Research & data`,
        model: 'demo-mode',
        role: 'jarvis',
        boardMember: 'Jarvis — Demo Mode',
        usage: {},
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ── POST /api/delegate ──────────────────────────────────────────────────────
// Jarvis delegates a task to a specific board member

router.post('/delegate', async (req, res) => {
  try {
    const { task, targetRole } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'Task description is required' });
    }

    // If no target specified, let Jarvis figure out who should handle it
    let role = targetRole;
    let reason = 'Explicitly assigned';
    if (!role) {
      const assignment = await identifyBoardMember(task);
      role = assignment.role;
      reason = assignment.reason;
    }

    const result = await routeToLLM({ prompt: task, role });

    await logSystemEvent('jarvis', 'DELEGATE', `Task delegated to ${role}: ${task.substring(0, 80)}...`);

    res.json({
      response: result.content,
      delegatedTo: role,
      reason,
      model: result.model,
      usage: result.usage,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[DELEGATE ERROR]', err.message);
    res.status(500).json({ error: 'Delegation failed', details: err.message });
  }
});

// ── GET /api/board ──────────────────────────────────────────────────────────
// Returns info about all available board members

router.get('/board', (req, res) => {
  res.json({
    members: getBoardMembers(),
    timestamp: new Date().toISOString(),
  });
});

// ── GET /api/status ─────────────────────────────────────────────────────────
// System health check

router.get('/status', (req, res) => {
  const openRouterConfigured = !!process.env.OPENROUTER_API_KEY;
  res.json({
    status: 'operational',
    platform: 'AI Boardroom',
    version: '1.0.0',
    openRouterConfigured,
    // Back-compat for earlier frontend builds
    apiKeyConfigured: openRouterConfigured,
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    voiceEnabled: !!process.env.GEMINI_API_KEY,
    vaultPath: process.env.OBSIDIAN_VAULT_PATH || './obsidian_vault',
    boardMembers: getBoardMembers().length,
    activeSessions: conversations.size,
    timestamp: new Date().toISOString(),
  });
});

export default router;
