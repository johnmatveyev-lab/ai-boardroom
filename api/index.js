/**
 * Vercel Serverless Function Handler
 * Proxies all requests through the Express app
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';
import chatRoutes from '../routes/chat.js';
import voiceRoutes from '../routes/voice.js';
import toolsRoutes from '../routes/tools.js';
import vaultRoutes from '../routes/vault.js';
import canvasRoutes from '../routes/canvas.js';
import uploadRoutes from '../routes/upload.js';
import executionRoutes from '../routes/execution.js';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Debug middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api', chatRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/canvas', canvasRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/execution', executionRoutes);

// ── Static File Serving ──────────────────────────────────────────────────────
app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

// Ensure uploads directory exists (fire and forget)
mkdir(join(__dirname, '..', 'uploads'), { recursive: true }).catch(err => {
  console.error('Failed to create uploads directory:', err.message);
});

// ── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
