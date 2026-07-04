import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { timingSafeEqual } from 'crypto';
import path from 'path';
import fs from 'fs/promises';

const router = Router();
const execAsync = promisify(exec);

// Security sandbox: Base directory for tool execution is the project root by default.
// Adjust this path if you want to restrict Jarvis to a specific folder.
const BASE_WORKSPACE = path.resolve(process.cwd());
const BLOCKED_WRITE_NAMES = new Set(['.env', '.env.local', '.env.development', '.env.production']);

const TOOLS_API_KEY = process.env.TOOLS_API_KEY || '';
const LOCAL_TOOLS_ENABLED = process.env.ENABLE_LOCAL_TOOLS === 'true';

function ensureInsideWorkspace(targetPath) {
  const normalizedBase = BASE_WORKSPACE.endsWith(path.sep) ? BASE_WORKSPACE : BASE_WORKSPACE + path.sep;
  if (targetPath !== BASE_WORKSPACE && !targetPath.startsWith(normalizedBase)) {
    throw new Error('Path escapes BASE_WORKSPACE');
  }
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ── Session bootstrap ───────────────────────────────────────────────────────
// The frontend is served from this same origin, so it's a legitimate holder of
// the tools key. CORS is locked down (see server.js) so no foreign origin can
// reach this route from a browser; direct network/curl access still needs the
// key on every /execute call. This is a "trust the local browser tab" model —
// suitable for a single-user local assistant, not a substitute for real
// per-user auth if this is ever exposed to more than one person.
router.get('/session-key', (req, res) => {
  if (!TOOLS_API_KEY) {
    return res.status(503).json({ enabled: false });
  }
  res.json({ enabled: true, key: TOOLS_API_KEY, localToolsEnabled: LOCAL_TOOLS_ENABLED });
});

// ── Auth gate ────────────────────────────────────────────────────────────────
// This bridge lets an LLM read/write files and (optionally) run shell commands
// on this machine. It is disabled by default. To use it, set TOOLS_API_KEY in
// .env and send it back as the `X-Tools-Key` header on every request.
router.use((req, res, next) => {
  if (!TOOLS_API_KEY) {
    return res.status(503).json({
      error: 'Tool bridge disabled',
      message: 'Set TOOLS_API_KEY in .env to enable /api/tools/execute.',
    });
  }
  const provided = req.get('X-Tools-Key') || '';
  if (!provided || !safeEqual(provided, TOOLS_API_KEY)) {
    return res.status(401).json({ error: 'Missing or invalid X-Tools-Key header' });
  }
  next();
});

router.post('/execute', async (req, res) => {
  const { name, args, callId } = req.body;

  if (!name || !args) {
    return res.status(400).json({ error: 'Missing name or args for tool execution' });
  }

  console.log(`[Tool Bridge] Executing tool: ${name}`, args);

  try {
    let result = null;

    if (name === 'execute_cli_command') {
      if (!LOCAL_TOOLS_ENABLED) {
        return res.status(403).json({
          name,
          id: callId,
          error: 'Shell command execution is disabled. Set ENABLE_LOCAL_TOOLS=true in .env to allow it, ' +
            'and only do so on a machine/container you are comfortable handing full shell access to.',
        });
      }
      const { command } = args;
      if (!command || typeof command !== 'string') {
        throw new Error('command must be a non-empty string');
      }
      // Note: this still runs on the host process, not in a container. Even with
      // auth required above, only enable ENABLE_LOCAL_TOOLS on a trusted/sandboxed
      // machine — a valid API key still grants an arbitrary shell.
      const { stdout, stderr } = await execAsync(command, {
        cwd: BASE_WORKSPACE,
        maxBuffer: 5 * 1024 * 1024, // 5MB
      });
      result = { stdout, stderr };

    } else if (name === 'read_file') {
      const { filePath } = args;
      if (!filePath || typeof filePath !== 'string') throw new Error('filePath must be a string');
      const targetPath = path.resolve(BASE_WORKSPACE, filePath);
      ensureInsideWorkspace(targetPath);
      const content = await fs.readFile(targetPath, 'utf-8');
      result = { content };

    } else if (name === 'write_file') {
      const { filePath, content } = args;
      if (!filePath || typeof filePath !== 'string') throw new Error('filePath must be a string');
      if (typeof content !== 'string') throw new Error('content must be a string');
      const targetPath = path.resolve(BASE_WORKSPACE, filePath);
      ensureInsideWorkspace(targetPath);
      if (BLOCKED_WRITE_NAMES.has(path.basename(targetPath))) {
        throw new Error(`Refusing to write to blocked file: ${path.basename(targetPath)}`);
      }
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, 'utf-8');
      result = { success: true, message: `File written successfully at ${filePath}` };
    } else {
      throw new Error(`Unknown tool specified: ${name}`);
    }

    res.json({ name, id: callId, result });
  } catch (error) {
    console.error(`[Tool Bridge] Execution failed:`, error.message);
    res.status(500).json({ name, id: callId, error: error.message || 'Unknown execution error' });
  }
});

export default router;
