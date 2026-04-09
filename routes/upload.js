/**
 * routes/upload.js — File Upload & Ingestion Pipeline
 *
 * Handles multipart file uploads, processes them via Gemini, and triggers:
 * - Vault storage (markdown summaries)
 * - Project task addition (01_active_projects.md)
 * - Canvas node injection (02_canvas_state.json)
 * - System logging (00_system_logs.md)
 * - Jarvis narrative response in chat
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { processUploadedFile } from '../utils/file_processor.js';
import { readVault, writeVault, appendVault, logSystemEvent } from '../utils/vault.js';
import { routeToLLM } from '../utils/llm_router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Multer Configuration ────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, '_');
    cb(null, `${ts}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
    files: 5, // max 5 files
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

const router = Router();

// ── POST /api/upload ────────────────────────────────────────────────────────
router.post('/', upload.array('files', 5), async (req, res) => {
  try {
    // Validate files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const sessionId = req.body.sessionId || 'unknown';
    const userMessage = req.body.message || '';

    // Process each file
    const results = [];
    for (const file of req.files) {
      try {
        const result = await processUploadedFile(file);
        results.push(result);
      } catch (err) {
        console.error(`[Upload] Error processing ${file.originalname}:`, err.message);
        // Continue with next file on individual failure
      }
    }

    if (results.length === 0) {
      return res.status(500).json({ error: 'Failed to process any files' });
    }

    // ── Side Effects ──────────────────────────────────────────────────────

    // 1. Write vault summaries
    for (const result of results) {
      try {
        await writeVault(result.vaultPath, result.vaultContent);
      } catch (err) {
        console.error(`[Upload] Error writing vault for ${result.originalName}:`, err.message);
      }
    }

    // 2. Append tasks to 01_active_projects.md
    for (const result of results) {
      try {
        await appendTasksToProjects(result.originalName, result.analysis.suggested_tasks, result.analysis.suggested_agents);
      } catch (err) {
        console.error(`[Upload] Error appending tasks for ${result.originalName}:`, err.message);
      }
    }

    // 3. Add nodes to canvas
    for (const result of results) {
      try {
        await addFileNodeToCanvas(result.originalName, result.analysis);
      } catch (err) {
        console.error(`[Upload] Error adding canvas node for ${result.originalName}:`, err.message);
      }
    }

    // 4. Log system events
    for (const result of results) {
      try {
        await logSystemEvent('JARVIS', 'FILE_INGESTED', `Ingested ${result.originalName} (${result.mimetype})`);
      } catch (err) {
        console.error(`[Upload] Error logging event for ${result.originalName}:`, err.message);
      }
    }

    // 5. Build Jarvis narrative and get response
    const narrativePrompt = buildJarvisNarrativePrompt(results, userMessage);

    let jarvisResponse;
    try {
      const llmResult = await routeToLLM({
        prompt: narrativePrompt,
        role: 'jarvis',
        temperature: 0.5,
      });
      jarvisResponse = llmResult.content;

      // Return success response
      return res.json({
        success: true,
        uploads: results.map(r => ({
          originalName: r.originalName,
          storedAs: r.storedAs,
          vaultPath: r.vaultPath,
          analysis: r.analysis,
        })),
        response: jarvisResponse,
        role: 'jarvis',
        model: llmResult.model,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Upload] Error getting Jarvis response:', err.message);
      // Fallback response if LLM fails
      return res.json({
        success: true,
        uploads: results.map(r => ({
          originalName: r.originalName,
          storedAs: r.storedAs,
          vaultPath: r.vaultPath,
          analysis: r.analysis,
        })),
        response: `Files processed: ${results.map(r => r.originalName).join(', ')}. Summaries stored to vault.`,
        role: 'jarvis',
        model: 'fallback',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('[Upload] Unexpected error:', err.message);
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

// ── Error Handler for Multer ────────────────────────────────────────────────
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 20MB per file.' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Too many files. Maximum 5 files per upload.' });
  }
  if (err.message?.startsWith('Unsupported file type')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// ── Side Effect Helpers ─────────────────────────────────────────────────────

/**
 * Append extracted tasks to 01_active_projects.md
 */
async function appendTasksToProjects(filename, tasks, agents) {
  const timestamp = new Date().toISOString().split('T')[0];
  const agentList = agents.join(', ');
  const taskLines = tasks.map(t => `- [ ] ${t}`).join('\n');

  const section = `
### Ingested: ${filename}
- **Source:** Uploaded file
- **Assigned to:** ${agentList}
- **Ingested:** ${timestamp}

${taskLines}
`;

  await appendVault('01_active_projects.md', section);
}

/**
 * Add a new canvas node for the uploaded file.
 * Reads current canvas state, adds node, writes back.
 */
async function addFileNodeToCanvas(filename, analysis) {
  try {
    const raw = await readVault('02_canvas_state.json');
    const state = JSON.parse(raw);

    // Position new node below existing nodes
    const existingCount = state.nodes.length;
    const nodeX = 100 + (existingCount % 4) * 280;
    const nodeY = 100 + Math.floor(existingCount / 4) * 200;

    const newNode = {
      id: `upload_${Date.now()}`,
      type: 'note',
      title: filename,
      desc: analysis.summary.substring(0, 120),
      status: 'active',
      x: nodeX,
      y: nodeY,
      w: 220,
    };

    state.nodes.push(newNode);
    state.updatedAt = new Date().toISOString();

    await writeVault('02_canvas_state.json', JSON.stringify(state, null, 2));
  } catch (err) {
    // Canvas state might not exist yet — create it from scratch
    const newState = {
      version: 1,
      updatedAt: new Date().toISOString(),
      nodes: [
        {
          id: `upload_${Date.now()}`,
          type: 'note',
          title: filename,
          desc: analysis.summary.substring(0, 120),
          status: 'active',
          x: 100,
          y: 100,
          w: 220,
        },
      ],
      edges: [],
      pan: { x: 0, y: 0 },
      zoom: 1,
    };
    await writeVault('02_canvas_state.json', JSON.stringify(newState, null, 2));
  }
}

/**
 * Build the prompt for Jarvis to narrate the uploads.
 */
function buildJarvisNarrativePrompt(results, userMessage) {
  const fileList = results
    .map(r => {
      const taskStr = r.analysis.suggested_tasks.slice(0, 2).join('; ');
      return `File: "${r.originalName}" (${r.mimetype})
     Summary: ${r.analysis.summary}
     Topics: ${r.analysis.key_topics.join(', ')}
     Tasks: ${taskStr}
     Agents: ${r.analysis.suggested_agents.join(', ')}`;
    })
    .join('\n\n');

  return `The user just uploaded ${results.length} file(s) to the boardroom.
${userMessage ? `User message: "${userMessage}"` : ''}

Here is the analysis of each file:

${fileList}

All tasks have been added to 01_active_projects.md and nodes added to the canvas.

Please acknowledge these uploads in your role as Chief of Staff (JARVIS).
- Briefly describe what was received
- Confirm which agents have been assigned
- State the next action you recommend
Keep your response under 200 words. Be professional and decisive.`;
}

export default router;
