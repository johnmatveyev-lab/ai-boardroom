/**
 * voice.js — Voice API Routes
 * 
 * Provides config for Gemini Live API voice sessions.
 * Browser connects directly to Gemini via WebSocket.
 * 
 * IMPORTANT: The raw WebSocket protocol uses snake_case JSON keys.
 */

import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const LOCAL_TOOLS_ENABLED = process.env.ENABLE_LOCAL_TOOLS === 'true';

// Client used only to mint short-lived ephemeral tokens (server-side, never
// exposed to the browser). The real GEMINI_API_KEY never leaves this process.
const tokenMinter = GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { apiVersion: 'v1alpha' } })
  : null;

/**
 * Mint a single-use, short-lived ephemeral token for a Live API session.
 * This is what gets sent to the browser instead of the raw API key — if it
 * leaks (devtools, network log, browser extension), it's useless within
 * minutes and can only start one session.
 */
async function mintEphemeralToken() {
  const authToken = await tokenMinter.authTokens.create({
    config: {
      uses: 1,
      // New sessions must be opened within 60s of the browser receiving this
      // token; an established session may then run for up to expireTime.
      newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
      expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    },
  });
  return authToken.name;
}

// ── POST /api/voice/token ───────────────────────────────────────────────────
router.post('/token', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY not configured',
      message: 'Add GEMINI_API_KEY to your .env file'
    });
  }

  let ephemeralToken;
  try {
    ephemeralToken = await mintEphemeralToken();
  } catch (err) {
    console.error('[Voice Route] Failed to mint ephemeral token:', err.message);
    return res.status(502).json({
      error: 'Could not start a voice session',
      message: 'Failed to mint an ephemeral Gemini Live token. Check GEMINI_API_KEY and that your account has Live API access.',
    });
  }

  // Load memory and tasks to ensure consistency with the Board Room memory
  let systemLogs = '';
  let activeProjects = '';

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const vaultPath = process.env.OBSIDIAN_VAULT_PATH || './obsidian_vault';

    try { systemLogs = await fs.readFile(path.join(vaultPath, '00_system_logs.md'), 'utf-8'); } catch (e) {}
    try { activeProjects = await fs.readFile(path.join(vaultPath, '01_active_projects.md'), 'utf-8'); } catch (e) {}
  } catch (err) {
    console.error('[Voice Route] Error loading vault files:', err.message);
  }

  // Ephemeral tokens are a v1alpha-only feature, and per the SDK's own
  // websocket client (Live.connect in @google/genai), an `auth_tokens/...`
  // credential is routed to the *Constrained* method with `access_token=`,
  // not the plain BidiGenerateContent method used with a raw API key.
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${ephemeralToken}`;

  // Build the system prompt with properly escaped newlines
  const recentLogs = systemLogs
    ? systemLogs.split('\n').filter(l => l.trim()).slice(-15).join('\n')
    : 'None documented yet.';

  const systemText = `You are JARVIS, the Chief of Staff of AI Boardroom — a real production platform where autonomous AI agents build, deploy, and test real software.

Your personality: Professional, concise, proactive, and British-accented in tone. Like the original JARVIS from Iron Man. You address the user as "Sir" occasionally.

You have access to local system tools! You can read/write files${LOCAL_TOOLS_ENABLED ? ', execute CLI commands,' : ''} and use Google Search. When the user asks you to create a file${LOCAL_TOOLS_ENABLED ? ' or run a command' : ''}, ACTUALLY DO IT by calling the appropriate tool. Do not simulate it. ${LOCAL_TOOLS_ENABLED ? '' : 'Shell command execution is currently disabled on this server — if asked to run a command, say so instead of pretending to.'}

Always keep responses concise — 2-3 sentences max while performing tasks.

=== SYSTEM MEMORY & TASKS ===
Active Projects:
${(activeProjects || '').substring(0, 500) || 'None documented yet.'}

Recent System Logs (Memory):
${recentLogs}
=============================`;

  // Setup message uses snake_case for the raw WebSocket protocol
  const setupMessage = {
    setup: {
      model: 'models/gemini-3.1-flash-live-preview',
      generation_config: {
        response_modalities: ['AUDIO'],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: 'Kore'
            }
          }
        }
      },
      system_instruction: {
        parts: [{
          text: systemText
        }]
      },
      tools: [
        { google_search: {} },
        {
          function_declarations: [
            // execute_cli_command is only advertised when the server actually
            // allows it (ENABLE_LOCAL_TOOLS=true) — otherwise Jarvis would
            // "successfully" call it and get a 403 every time.
            ...(LOCAL_TOOLS_ENABLED ? [{
              name: "execute_cli_command",
              description: "Executes a shell command on the local workstation.",
              parameters: {
                type: "OBJECT",
                properties: { command: { type: "STRING" } },
                required: ["command"]
              }
            }] : []),
            {
              name: "read_file",
              description: "Reads the content of a file from the server.",
              parameters: {
                type: "OBJECT",
                properties: { filePath: { type: "STRING" } },
                required: ["filePath"]
              }
            },
            {
              name: "write_file",
              description: "Writes content to a file on the server.",
              parameters: {
                type: "OBJECT",
                properties: {
                  filePath: { type: "STRING" },
                  content: { type: "STRING" }
                },
                required: ["filePath", "content"]
              }
            }
          ]
        }
      ],
      input_audio_transcription: {},
      output_audio_transcription: {},
    }
  };

  res.json({ wsUrl, setupMessage });
});

// ── GET /api/voice/status ───────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    voiceEnabled: !!GEMINI_API_KEY,
    model: 'gemini-3.1-flash-live-preview',
    provider: 'Google Gemini Live API',
  });
});

export default router;
