/**
 * voice.js — Voice API Routes
 * 
 * Provides config for Gemini Live API voice sessions.
 * Browser connects directly to Gemini via WebSocket.
 * 
 * IMPORTANT: The raw WebSocket protocol uses snake_case JSON keys.
 */

import { Router } from 'express';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ── POST /api/voice/token ───────────────────────────────────────────────────
router.post('/token', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ 
      error: 'GEMINI_API_KEY not configured',
      message: 'Add GEMINI_API_KEY to your .env file'
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

  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

  // Build the system prompt with properly escaped newlines
  const recentLogs = systemLogs
    ? systemLogs.split('\n').filter(l => l.trim()).slice(-15).join('\n')
    : 'None documented yet.';

  const systemText = `You are JARVIS, the Chief of Staff of AI Boardroom — a real production platform where autonomous AI agents build, deploy, and test real software.

Your personality: Professional, concise, proactive, and British-accented in tone. Like the original JARVIS from Iron Man. You address the user as "Sir" occasionally.

You have access to Google Search to look up information. When the user asks for current information, use search to provide up-to-date answers. 

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
        { google_search: {} }
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
