import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { readVault, listVault, writeVault, logSystemEvent } from '../utils/vault.js';

const router = Router();
const BASE_PATH = path.resolve(process.cwd());

async function buildForceGraphData(dirPath, rootId = 'AI Boardroom', depth = 0) {
  let nodes = [];
  let links = [];

  // Max depth to prevent massive graphs that lag browser
  if (depth > 3) return { nodes, links };

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (item.name === 'node_modules' || item.name === '.git' || item.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, item.name);
      const relativePath = path.relative(BASE_PATH, fullPath);
      const isDir = item.isDirectory();

      // Determine group colors based on file location type
      let group = 1; // Default files
      if (relativePath.includes('obsidian_vault')) group = 2; // Memory
      if (relativePath.includes('routes') || relativePath.includes('utils')) group = 3; // Backend Logic
      if (relativePath.includes('public')) group = 4; // Frontend

      const nodeId = relativePath;
      nodes.push({ id: nodeId, name: item.name, group, isDir });
      links.push({ source: rootId, target: nodeId });

      if (isDir) {
        const childGraph = await buildForceGraphData(fullPath, nodeId, depth + 1);
        nodes = nodes.concat(childGraph.nodes);
        links = links.concat(childGraph.links);
      }
    }
  } catch (error) {
    console.error('[Mind Map] Error building graph data:', error.message);
  }

  return { nodes, links };
}

router.get('/mindmap', async (req, res) => {
  const rootId = 'AI Boardroom';
  let nodes = [{ id: rootId, name: 'AI Boardroom Hub', group: 0, isDir: true }];
  let links = [];

  // Parse Obsidian Vault specifically as primary, plus core folders
  const vaultGraph = await buildForceGraphData(path.join(BASE_PATH, 'obsidian_vault'), rootId, 0);
  const srcGraph = await buildForceGraphData(path.join(BASE_PATH, 'routes'), rootId, 0);
  const coreFiles = ['server.js', 'project_overview.md', 'package.json'];

  nodes = nodes.concat(vaultGraph.nodes).concat(srcGraph.nodes);
  links = links.concat(vaultGraph.links).concat(srcGraph.links);

  coreFiles.forEach(file => {
    nodes.push({ id: file, name: file, group: 1, isDir: false });
    links.push({ source: rootId, target: file });
  });

  res.json({ nodes, links });
});

router.get('/analytics', async (req, res) => {
  try {
    const logPath = path.join(BASE_PATH, 'obsidian_vault', '00_system_logs.md');
    const logContent = await fs.readFile(logPath, 'utf-8');
    
    // Parse logs to extract analytics
    const lines = logContent.split('\n').filter(l => l.includes('['));
    
    let totalEvents = 0;
    let chatQueries = 0;
    let serverStarts = 0;
    let agentActivity = {};

    lines.forEach(line => {
      totalEvents++;
      // Parse tags like [SYSTEM] or [JARVIS]
      const match = line.match(/\[(.*?)\]/g);
      if (match && match.length >= 2) {
        const actor = match[1].replace('[', '').replace(']', '');
        const eventType = match[2].replace('[', '').replace(']', '');

        if (eventType === 'CHAT') chatQueries++;
        if (eventType === 'SERVER_START') serverStarts++;
        
        if (!agentActivity[actor]) agentActivity[actor] = 0;
        agentActivity[actor]++;
      }
    });

    res.json({
      metrics: {
        totalEvents,
        chatQueries,
        serverStarts
      },
      agentActivity
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read analytics from vault' });
  }
});

// ── GET /api/vault ──────────────────────────────────────────────────────────
// List vault contents
router.get('/', async (req, res) => {
  try {
    const files = await listVault();
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/vault/{*filepath} ──────────────────────────────────────────────
// Read a specific vault file (relative path within the vault)
router.get('/{*filepath}', async (req, res) => {
  try {
    const relPathRaw = req.params.filepath;
    const relPath = Array.isArray(relPathRaw) ? relPathRaw.join('/') : relPathRaw;
    if (!relPath) return res.status(400).json({ error: 'Missing vault filepath' });
    const content = await readVault(relPath);
    res.json({ path: relPath, content });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ── POST /api/vault/write ───────────────────────────────────────────────────
// Write content to a vault file (used by local tools / automations)
router.post('/write', async (req, res) => {
  try {
    const { filePath, content, actor = 'system' } = req.body || {};
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'filePath is required' });
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content must be a string' });
    }

    await writeVault(filePath, content);
    await logSystemEvent(actor, 'VAULT_WRITE', `Wrote ${filePath}`);

    res.json({ success: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
