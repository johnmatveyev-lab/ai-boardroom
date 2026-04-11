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
import { requireAuth } from '../utils/auth.js';
import { rateLimiter } from '../utils/rate_limiter.js';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// ── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(rateLimiter);
app.use(express.json());

// Debug middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api', chatRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/tools', requireAuth, toolsRoutes);
app.use('/api/vault', requireAuth, vaultRoutes);
app.use('/api/canvas', requireAuth, canvasRoutes);
app.use('/api/upload', requireAuth, uploadRoutes);
app.use('/api/execution', requireAuth, executionRoutes);

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
