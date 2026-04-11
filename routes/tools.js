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
  const resolvedBase = path.resolve(BASE_WORKSPACE);
  const resolvedTarget = path.resolve(targetPath);
  
  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new Error('Security Exception: Path escapes BASE_WORKSPACE');
  }

  // 🛡️ Security Fix: Block access to .env files
  const filename = path.basename(resolvedTarget);
  if (filename.startsWith('.env')) {
    throw new Error(`Security Exception: Access to sensitive file blocked: ${filename}`);
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
      // 🛡️ Security Fix: Comprehensive command blacklist
      const commandLower = command.toLowerCase();
      const forbidden = [
        'rm ', 'mv ', 'chmod ', 'chown ', 'dd ', 
        'kill ', 'pkill ', 'halt ', 'reboot ', 'shutdown ',
        'curl ', 'wget ', 'ssh ', 'scp ', 'ftp ', 'telnet ',
        '> /dev/', 'mkfs ', 'mount ', 'umount '
      ];

      if (forbidden.some(f => commandLower.includes(f))) {
        throw new Error(`Security Exception: Prohibited command pattern detected.`);
      }

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
      // .env check is already handled inside ensureInsideWorkspace
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
