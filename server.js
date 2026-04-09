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
import chatRoutes from './routes/chat.js';
import voiceRoutes from './routes/voice.js';
import { logSystemEvent } from './utils/vault.js';

dotenv.config();

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
  console.log('  ║                                                  ║');
  console.log('  ║  Board Members:                                  ║');
  console.log('  ║    ◆ Jarvis    — Chief of Staff                  ║');
  console.log('  ║    ◆ Architect — CEO / Strategy                  ║');
  console.log('  ║    ◆ Coder    — CTO / Engineering                ║');
  console.log('  ║    ◆ Creative — CMO / Design                     ║');
  console.log('  ║    ◆ Analyst  — CFO / Research                   ║');
  console.log('  ║                                                  ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');

  try {
    await logSystemEvent('system', 'SERVER_START', `AI Boardroom server started on port ${PORT}`);
  } catch (e) {
    // Vault log is non-critical
  }
});

export default app;
