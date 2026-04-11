/**
 * vault.js — Obsidian Memory Vault Interface
 * 
 * Read/write interface for the shared Obsidian vault.
 * All agents use this to maintain long-term context across sessions.
 */

import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || './obsidian_vault';

/**
 * Read a file from the Obsidian vault
 * @param {string} filePath - Relative path within the vault
 * @returns {Promise<string>} File contents
 */
export async function readVault(filePath) {
  // 🛡️ Security Fix: Prevent Path Traversal
  const resolvedVaultPath = path.resolve(VAULT_PATH);
  const fullPath = path.resolve(VAULT_PATH, filePath);

  if (!fullPath.startsWith(resolvedVaultPath)) {
    throw new Error(`Security Exception: Access denied to path outside vault area.`);
  }

  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Vault file not found: ${filePath}`);
    }
    throw err;
  }
}

/**
 * Write content to the Obsidian vault
 * @param {string} filePath - Relative path within the vault
 * @param {string} content - Content to write
 */
export async function writeVault(filePath, content) {
  try {
    // 🛡️ Security Fix: Prevent Path Traversal
    const resolvedVaultPath = path.resolve(VAULT_PATH);
    const fullPath = path.resolve(VAULT_PATH, filePath);

    if (!fullPath.startsWith(resolvedVaultPath)) {
      console.warn(`[Vault] Security Warning: Blocked write attempt to ${fullPath}`);
      return;
    }

    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  } catch (err) {
    console.warn(`[Vault] Warning: Could not write to ${filePath}:`, err.message);
  }
}

/**
 * Append content to a vault file (useful for logs)
 * @param {string} filePath - Relative path within the vault
 * @param {string} content - Content to append
 */
export async function appendVault(filePath, content) {
  try {
    // 🛡️ Security Fix: Prevent Path Traversal
    const resolvedVaultPath = path.resolve(VAULT_PATH);
    const fullPath = path.resolve(VAULT_PATH, filePath);

    if (!fullPath.startsWith(resolvedVaultPath)) {
      console.warn(`[Vault] Security Warning: Blocked append attempt to ${fullPath}`);
      return;
    }

    await fs.appendFile(fullPath, '\n' + content, 'utf-8');
  } catch (err) {
    console.warn(`[Vault] Warning: Could not append to ${filePath}:`, err.message);
  }
}

/**
 * List all files in the vault (or a subdirectory)
 * @param {string} [subDir=''] - Subdirectory to list
 * @returns {Promise<string[]>} Array of relative file paths
 */
export async function listVault(subDir = '') {
  const fullPath = path.join(VAULT_PATH, subDir);
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true, recursive: true });
    return entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => path.join(subDir, e.parentPath ? path.relative(fullPath, path.join(e.parentPath, e.name)) : e.name));
  } catch {
    return [];
  }
}

/**
 * Log a system event to 00_system_logs.md
 * @param {string} agent - Agent role (e.g., 'jarvis', 'architect')
 * @param {string} action - Action type (e.g., 'TASK_ASSIGNED', 'CODE_DEPLOYED')
 * @param {string} description - Human-readable description
 */
export async function logSystemEvent(agent, action, description) {
  const timestamp = new Date().toISOString();
  const entry = `\n[${timestamp}] [${agent.toUpperCase()}] [${action}] — ${description}`;
  await appendVault('00_system_logs.md', entry);
}

export default { readVault, writeVault, appendVault, listVault, logSystemEvent };
