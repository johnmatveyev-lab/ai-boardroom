/**
 * server.js — AI Boardroom Express Server
 *
 * Serves the JARVIS interface and routes API calls to the Board of Directors.
 * Works both as a long-running Node server (local / preview) and as a
 * Vercel serverless handler (export default app; no listen on VERCEL).
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
import executionRoutes from './routes/execution.js';
import { requireAuth } from './utils/auth.js';
import { rateLimiter } from './utils/rate_limiter.js';
import { logSystemEvent } from './utils/vault.js';
import { env } from './utils/env.js';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const IS_VERCEL = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;

// ── CORS ────────────────────────────────────────────────────────────────────
// Empty ALLOWED_ORIGINS = allow all (needed for same-origin + preview).
// Set ALLOWED_ORIGINS=https://your-domain.com,https://other.com to lock down.
function buildCorsOrigin() {
  const raw = (env('ALLOWED_ORIGINS', '') || '').trim();
  if (!raw || raw === '*') return true;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return (origin, callback) => {
    if (!origin || list.includes(origin)) return callback(null, true);
    return callback(null, false);
  };
}

app.use(cors({ origin: buildCorsOrigin(), credentials: true }));
app.use(rateLimiter);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static frontend ─────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'public'), {
  index: 'index.html',
  maxAge: IS_VERCEL ? '1h' : 0,
}));

// ── API Routes ──────────────────────────────────────────────────────────────
// Public UI APIs (chat, board, status, voice, vault panels, canvas, upload)
app.use('/api', chatRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/canvas', canvasRoutes);
app.use('/api/upload', uploadRoutes);

// Tool bridge and code execution sandbox are both high-risk surfaces; protect with BOARDROOM_API_KEY when set.
app.use('/api/tools', requireAuth, toolsRoutes);
app.use('/api/execution', requireAuth, executionRoutes);

app.use('/uploads', express.static(join(__dirname, 'uploads')));

// ── Health (also at root-level for platform probes) ─────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ai-boardroom' });
});

// API 404
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// SPA fallback for non-file routes
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Error handler (incl. CORS failures)
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err?.message || err);
  const status = err?.message === 'Not allowed by CORS' ? 403 : 500;
  res.status(status).json({ error: err?.message || 'Internal server error' });
});

// ── Local / preview boot (skip on Vercel serverless) ────────────────────────
async function start() {
  try {
    await mkdir(join(__dirname, 'uploads'), { recursive: true });
    await mkdir(join(__dirname, 'obsidian_vault'), { recursive: true });
  } catch {
    // non-fatal
  }

  if (IS_VERCEL) return;

  app.listen(PORT, '0.0.0.0', async () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════╗');
    console.log('  ║              AI BOARDROOM — JARVIS               ║');
    console.log(`  ║  Server:  http://0.0.0.0:${PORT}                     ║`);
    console.log(`  ║  OpenRouter: ${env('OPENROUTER_API_KEY') ? 'configured' : 'demo mode'}                       ║`);
    console.log(`  ║  Gemini:     ${env('GEMINI_API_KEY') ? 'configured' : 'not set'}                       ║`);
    console.log('  ╚══════════════════════════════════════════════════╝');
    console.log('');
    try {
      await logSystemEvent('system', 'SERVER_START', `AI Boardroom server started on port ${PORT}`);
    } catch {
      // vault log is non-critical
    }
  });
}

start();

export default app;
