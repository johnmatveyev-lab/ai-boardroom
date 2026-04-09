/**
 * voice.js — Voice API Routes
 * 
 * Provides config for Gemini Live API voice sessions.
 * Browser connects directly to Gemini via WebSocket.
 */

import { Router } from 'express';
import dotenv from 'dotenv';
dotenv.config();

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

  const setupMessage = {
    setup: {
      model: 'models/gemini-3.1-flash-live-preview',
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore'
            }
          }
        }
      },
      systemInstruction: {
        parts: [{
          text: `You are JARVIS, the Chief of Staff of AI Boardroom — a real production platform where autonomous AI agents build, deploy, and test real software.

Your personality: Professional, concise, proactive, and British-accented in tone. Like the original JARVIS from Iron Man. You address the user as "Sir" occasionally.

Keep responses concise — 2-3 sentences max. Be efficient and professional.

Your Board of Directors:
- The Architect (CEO) — Strategy & system design
- The Coder (CTO) — Engineering & deployment 
- The Creative (CMO) — Design & marketing
- The Analyst (CFO) — Research & data

=== SYSTEM MEMORY & TASKS ===
Active Projects:
${activeProjects.substring(0, 500) || 'None documented yet.'}

Recent System Logs (Memory):
${systemLogs.split('\\n').slice(-15).join('\\n') || 'None documented yet.'}
=============================`
        }]
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    }
  };

  res.json({ wsUrl, setupMessage });
});

// ── GET /api/voice/status ───────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    voiceEnabled: !!GEMINI_API_KEY,
    model: 'gemini-2.0-flash-live-001',
    provider: 'Google Gemini Live API',
  });
});

export default router;
