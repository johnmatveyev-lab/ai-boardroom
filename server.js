/**
 * server.js — AI Boardroom Express Server
 * 
 * The central nervous system. Serves the Jarvis interface 
 * and routes API calls to the Board of Directors.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';
import chatRoutes from './routes/chat.js';
import voiceRoutes from './routes/voice.js';
import toolsRoutes from './routes/tools.js';
import vaultRoutes from './routes/vault.js';
import canvasRoutes from './routes/canvas.js';
import uploadRoutes from './routes/upload.js';
import { logSystemEvent } from './utils/vault.js';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api', chatRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/canvas', canvasRoutes);
app.use('/api/upload', uploadRoutes);

// ── Static File Serving ──────────────────────────────────────────────────────
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// ── SPA Fallback ────────────────────────────────────────────────────────────
app.get('/{*splat}', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║                                                  ║');
  console.log('  ║          ▄▀▄ █   █▀▄ █▀█ ▄▀▄ █▀▄ █▀▄           ║');
  console.log('  ║          █▀█ █   █▀▄ █ █ █▀█ █▀▄ █ █           ║');
  console.log('  ║          ▀ ▀ ▀   ▀▀  ▀▀▀ ▀ ▀ ▀ ▀ ▀▀            ║');
  console.log('  ║                   R O O M                        ║');
  console.log('  ║                                                  ║');
  console.log(`  ║  Server:    http://localhost:${PORT}                ║`);
  console.log(`  ║  API:       http://localhost:${PORT}/api/status     ║`);
  console.log(`  ║  API Key:   ${process.env.OPENROUTER_API_KEY ? '✅ Configured' : '⚠️  Not set (demo mode)'}              ║`);
  console.log(`  ║  Voice:     ${process.env.GEMINI_API_KEY ? '🎙️ Gemini Live Ready' : '⚠️  No GEMINI_API_KEY'}          ║`);
  console.log('  ║                                                  ║');
  console.log('  ║  Board Members (9):                              ║');
  console.log('  ║    ◆ Jarvis    — Chief of Staff                  ║');
  console.log('  ║    ◆ Architect — CEO / Strategy                  ║');
  console.log('  ║    ◆ Coder    — CTO / Engineering                ║');
  console.log('  ║    ◆ Creative — CMO / Design                     ║');
  console.log('  ║    ◆ Analyst  — CFO / Research                   ║');
  console.log('  ║    ◆ Product  — CPO / Roadmap                    ║');
  console.log('  ║    ◆ DevOps   — SRE / Infrastructure             ║');
  console.log('  ║    ◆ Security — CISO / Hardening                 ║');
  console.log('  ║    ◆ QA Lead  — CQO / Testing                    ║');
  console.log('  ║                                                  ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Ensure uploads directory exists
    await mkdir(join(__dirname, 'uploads'), { recursive: true });

    await logSystemEvent('system', 'SERVER_START', `AI Boardroom server started on port ${PORT}`);
  } catch (e) {
    // Vault log is non-critical
  }
});

export default app;
