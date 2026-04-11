/**
 * code_executor.js — Sandbox Code Execution
 * Executes code in isolated environments with resource limits
 *
 * Future: Integrate with E2B, Docker, or other sandboxing solutions
 */

import { execSync, spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Execution result
 * @typedef {Object} ExecutionResult
 * @property {boolean} success - Whether execution succeeded
 * @property {string} output - stdout output
 * @property {string} error - stderr output or error message
 * @property {number} exitCode - Process exit code
 * @property {number} duration - Execution time in ms
 */

/**
 * Execute JavaScript code in an isolated sandbox
 * @param {string} code - JavaScript code to execute
 * @param {Object} options - Execution options
 * @param {number} options.timeout - Timeout in ms (default 5000)
 * @param {Object} options.env - Environment variables
 * @returns {ExecutionResult} Execution result
 */
export async function executeJavaScript(code, options = {}) {
  const { timeout = 5000, env = {} } = options;
  const startTime = Date.now();

  try {
    // Create temp file for code
    const tempDir = mkdtempSync(join(tmpdir(), 'boardroom-'));
    const codeFile = join(tempDir, 'script.js');

    try {
      writeFileSync(codeFile, code, 'utf-8');

      // Execute with timeout and resource limits
      const result = spawnSync('node', [codeFile], {
        timeout,
        encoding: 'utf-8',
        env: { ...process.env, ...env },
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      const duration = Date.now() - startTime;

      if (result.error) {
        return {
          success: false,
          output: '',
          error: result.error.message,
          exitCode: result.status || -1,
          duration,
        };
      }

      return {
        success: result.status === 0,
        output: result.stdout || '',
        error: result.stderr || '',
        exitCode: result.status || 0,
        duration,
      };
    } finally {
      // Cleanup temp files
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.warn('[CodeExecutor] Failed to cleanup temp dir:', err.message);
      }
    }
  } catch (err) {
    return {
      success: false,
      output: '',
      error: err.message,
      exitCode: -1,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Execute Python code in an isolated sandbox
 * @param {string} code - Python code to execute
 * @param {Object} options - Execution options
 * @returns {ExecutionResult} Execution result
 */
export async function executePython(code, options = {}) {
  const { timeout = 5000, env = {} } = options;
  const startTime = Date.now();

  try {
    const tempDir = mkdtempSync(join(tmpdir(), 'boardroom-'));
    const codeFile = join(tempDir, 'script.py');

    try {
      writeFileSync(codeFile, code, 'utf-8');

      const result = spawnSync('python3', [codeFile], {
        timeout,
        encoding: 'utf-8',
        env: { ...process.env, ...env },
        maxBuffer: 10 * 1024 * 1024,
      });

      const duration = Date.now() - startTime;

      if (result.error) {
        return {
          success: false,
          output: '',
          error: result.error.message,
          exitCode: result.status || -1,
          duration,
        };
      }

      return {
        success: result.status === 0,
        output: result.stdout || '',
        error: result.stderr || '',
        exitCode: result.status || 0,
        duration,
      };
    } finally {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.warn('[CodeExecutor] Failed to cleanup temp dir:', err.message);
      }
    }
  } catch (err) {
    return {
      success: false,
      output: '',
      error: err.message,
      exitCode: -1,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Execute shell command
 * @param {string} command - Shell command to execute
 * @param {Object} options - Execution options
 * @returns {ExecutionResult} Execution result
 */
export async function executeShell(command, options = {}) {
  const { timeout = 5000, env = {} } = options;
  const startTime = Date.now();

  try {
    const result = spawnSync('sh', ['-c', command], {
      timeout,
      encoding: 'utf-8',
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024,
    });

    const duration = Date.now() - startTime;

    if (result.error) {
      return {
        success: false,
        output: '',
        error: result.error.message,
        exitCode: result.status || -1,
        duration,
      };
    }

    return {
      success: result.status === 0,
      output: result.stdout || '',
      error: result.stderr || '',
      exitCode: result.status || 0,
      duration,
    };
  } catch (err) {
    return {
      success: false,
      output: '',
      error: err.message,
      exitCode: -1,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Create an execution environment context
 * Tracks execution history and resources
 */
export class ExecutionContext {
  constructor(sessionId = 'default') {
    this.sessionId = sessionId;
    this.executions = [];
    this.totalDuration = 0;
    this.successCount = 0;
    this.failureCount = 0;
  }

  /**
   * Record an execution
   */
  recordExecution(language, code, result) {
    this.executions.push({
      timestamp: new Date().toISOString(),
      language,
      codeLength: code.length,
      success: result.success,
      duration: result.duration,
      outputLength: result.output.length,
    });

    this.totalDuration += result.duration;
    if (result.success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
  }

  /**
   * Get execution summary
   */
  getSummary() {
    return {
      sessionId: this.sessionId,
      totalExecutions: this.executions.length,
      successCount: this.successCount,
      failureCount: this.failureCount,
      totalDuration: this.totalDuration,
      averageDuration: this.executions.length > 0
        ? Math.round(this.totalDuration / this.executions.length)
        : 0,
    };
  }
}

export default {
  executeJavaScript,
  executePython,
  executeShell,
  ExecutionContext,
};
