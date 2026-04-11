/**
 * execution.js — Code Execution API
 *
 * Handles code execution requests from agents
 * Integrates with sandbox environments and resource management
 */

import { Router } from 'express';
import { executeJavaScript, executePython, executeShell, ExecutionContext } from '../utils/code_executor.js';
import { logSystemEvent } from '../utils/vault.js';

const router = Router();

// In-memory execution contexts (per session)
const contexts = new Map();

/**
 * Get or create execution context
 */
function getContext(sessionId = 'default') {
  if (!contexts.has(sessionId)) {
    contexts.set(sessionId, new ExecutionContext(sessionId));
  }
  return contexts.get(sessionId);
}

// ── POST /api/execution/javascript ──────────────────────────────────────────
// Execute JavaScript code

router.post('/javascript', async (req, res) => {
  try {
    const { code, sessionId = 'default', timeout = 5000 } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code is required' });
    }

    const context = getContext(sessionId);
    const result = await executeJavaScript(code, { timeout });

    context.recordExecution('javascript', code, result);

    await logSystemEvent('coder', 'CODE_EXECUTED', `JavaScript execution: ${result.success ? 'success' : 'failed'} in ${result.duration}ms`);

    res.json({
      success: result.success,
      output: result.output,
      error: result.error,
      exitCode: result.exitCode,
      duration: result.duration,
      language: 'javascript',
    });
  } catch (err) {
    console.error('[EXECUTION ERROR]', err.message);
    res.status(500).json({ error: 'Execution failed', details: err.message });
  }
});

// ── POST /api/execution/python ──────────────────────────────────────────────
// Execute Python code

router.post('/python', async (req, res) => {
  try {
    const { code, sessionId = 'default', timeout = 5000 } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code is required' });
    }

    const context = getContext(sessionId);
    const result = await executePython(code, { timeout });

    context.recordExecution('python', code, result);

    await logSystemEvent('coder', 'CODE_EXECUTED', `Python execution: ${result.success ? 'success' : 'failed'} in ${result.duration}ms`);

    res.json({
      success: result.success,
      output: result.output,
      error: result.error,
      exitCode: result.exitCode,
      duration: result.duration,
      language: 'python',
    });
  } catch (err) {
    console.error('[EXECUTION ERROR]', err.message);
    res.status(500).json({ error: 'Execution failed', details: err.message });
  }
});

// ── POST /api/execution/shell ───────────────────────────────────────────────
// Execute shell command

router.post('/shell', async (req, res) => {
  try {
    const { command, sessionId = 'default', timeout = 5000 } = req.body;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Command is required' });
    }

    const context = getContext(sessionId);
    const result = await executeShell(command, { timeout });

    context.recordExecution('shell', command, result);

    await logSystemEvent('devops', 'COMMAND_EXECUTED', `Shell execution: ${result.success ? 'success' : 'failed'} in ${result.duration}ms`);

    res.json({
      success: result.success,
      output: result.output,
      error: result.error,
      exitCode: result.exitCode,
      duration: result.duration,
      language: 'shell',
    });
  } catch (err) {
    console.error('[EXECUTION ERROR]', err.message);
    res.status(500).json({ error: 'Execution failed', details: err.message });
  }
});

// ── GET /api/execution/status ───────────────────────────────────────────────
// Get execution summary for a session

router.get('/status', (req, res) => {
  const { sessionId = 'default' } = req.query;
  const context = getContext(sessionId);

  res.json({
    summary: context.getSummary(),
    recentExecutions: context.executions.slice(-10),
  });
});

export default router;
