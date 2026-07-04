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

const VAULT_ROOT = path.resolve(process.env.OBSIDIAN_VAULT_PATH || './obsidian_vault');

/**
 * Resolve a caller-supplied relative path against the vault root and verify
 * it can't escape the vault via "../" segments, absolute paths, or symlink-free
 * traversal tricks. Throws on any escape attempt.
 * @param {string} relPath
 * @returns {string} Absolute path guaranteed to be inside VAULT_ROOT
 */
function resolveInVault(relPath) {
  if (typeof relPath !== 'string' || !relPath) {
    throw new Error('Vault path is required');
  }
  const fullPath = path.resolve(VAULT_ROOT, relPath);
  const rootWithSep = VAULT_ROOT.endsWith(path.sep) ? VAULT_ROOT : VAULT_ROOT + path.sep;
  if (fullPath !== VAULT_ROOT && !fullPath.startsWith(rootWithSep)) {
    throw new Error(`Vault path escapes the vault root: ${relPath}`);
  }
  return fullPath;
}

/**
 * Read a file from the Obsidian vault
 * @param {string} filePath - Relative path within the vault
 * @returns {Promise<string>} File contents
 */
export async function readVault(filePath) {
  const fullPath = resolveInVault(filePath);
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
  const fullPath = resolveInVault(filePath);
  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');
}

/**
 * Append content to a vault file (useful for logs)
 * @param {string} filePath - Relative path within the vault
 * @param {string} content - Content to append
 */
export async function appendVault(filePath, content) {
  const fullPath = resolveInVault(filePath);
  await fs.appendFile(fullPath, '\n' + content, 'utf-8');
}

/**
 * List all files in the vault (or a subdirectory)
 * @param {string} [subDir=''] - Subdirectory to list
 * @returns {Promise<string[]>} Array of relative file paths
 */
export async function listVault(subDir = '') {
  const fullPath = subDir ? resolveInVault(subDir) : VAULT_ROOT;
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
