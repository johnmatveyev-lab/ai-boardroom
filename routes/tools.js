import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const router = Router();
const execAsync = promisify(exec);

// Security sandbox: Base directory for tool execution is the project root by default.
// Adjust this path if you want to restrict Jarvis to a specific folder.
const BASE_WORKSPACE = path.resolve(process.cwd());
const BLOCKED_WRITE_NAMES = new Set(['.env', '.env.local', '.env.development', '.env.production']);

function ensureInsideWorkspace(targetPath) {
  const normalizedBase = BASE_WORKSPACE.endsWith(path.sep) ? BASE_WORKSPACE : BASE_WORKSPACE + path.sep;
  const normalizedTarget = targetPath.endsWith(path.sep) ? targetPath : targetPath;
  if (normalizedTarget === BASE_WORKSPACE) return;
  if (!normalizedTarget.startsWith(normalizedBase)) {
    throw new Error('Path escapes BASE_WORKSPACE');
  }
}

router.post('/execute', async (req, res) => {
  const { name, args, callId } = req.body;

  if (!name || !args) {
    return res.status(400).json({ error: 'Missing name or args for tool execution' });
  }

  console.log(`[Tool Bridge] Executing tool: ${name}`, args);

  try {
    let result = null;

    if (name === 'execute_cli_command') {
      const { command } = args;
      // Note: Executing raw bash from an LLM involves risk.
      // In a strict production environment, this should run inside a Docker container.
      const { stdout, stderr } = await execAsync(command, {
        cwd: BASE_WORKSPACE,
        maxBuffer: 5 * 1024 * 1024, // 5MB
      });
      result = { stdout, stderr };

    } else if (name === 'read_file') {
      const { filePath } = args;
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
