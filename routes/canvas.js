import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { BOARD_MODELS } from '../utils/llm_router.js';
import { readVault, writeVault, logSystemEvent } from '../utils/vault.js';

const router = Router();
const BASE_PATH = path.resolve(process.cwd());
const CANVAS_STATE_FILE = '02_canvas_state.json';

router.get('/diagram', async (req, res) => {
  const nodes = [];
  const links = [];

  // Group 0: Top Level
  nodes.push({ id: 'core', name: 'AI Boardroom Architecture', group: 0, type: 'core' });

  // Group 1: Roles
  const roles = Object.keys(BOARD_MODELS);
  roles.forEach(role => {
    nodes.push({ id: `role_${role}`, name: BOARD_MODELS[role].description.split('—')[0].trim(), group: 1, type: 'role' });
    links.push({ source: 'core', target: `role_${role}` });
  });

  // Group 2: SOP Gates
  const gates = [
    { id: 'gate_1', name: 'Phase 1: Architecture Blueprint (00_spec.md)', owner: ['architect', 'product'] },
    { id: 'gate_2', name: 'Phase 2: Feasibility & Grounding', owner: 'analyst' },
    { id: 'gate_3', name: 'Phase 3: Implementation & Design', owner: ['coder', 'creative'] },
    { id: 'gate_4', name: 'Phase 4: Testing & Hardening', owner: ['coder', 'security', 'qa'] },
    { id: 'gate_5', name: 'Phase 5: Deploy & Monitor', owner: ['jarvis', 'devops'] }
  ];

  gates.forEach((gate, index) => {
    nodes.push({ id: gate.id, name: gate.name, group: 2, type: 'gate' });
    
    // Link from previous gate (Sequential SOP)
    if (index > 0) {
      links.push({ source: gates[index-1].id, target: gate.id });
    }

    // Link owners (Roles) to the gates they manage
    const owners = Array.isArray(gate.owner) ? gate.owner : [gate.owner];
    owners.forEach(o => {
      links.push({ source: `role_${o}`, target: gate.id });
    });
  });

  // Group 3: Active Tasks
  try {
    const tasksPath = path.join(BASE_PATH, 'obsidian_vault', '01_active_projects.md');
    const tasksData = await fs.readFile(tasksPath, 'utf-8');
    
    const lines = tasksData.split('\n').filter(l => l.includes('- [ ]') || l.includes('- [x]'));
    
    nodes.push({ id: 'projects_hub', name: 'Active Projects', group: 3, type: 'hub' });
    links.push({ source: 'gate_5', target: 'projects_hub' }); // Deploys feed to projects
    
    lines.forEach((line, i) => {
      const isComplete = line.includes('[x]');
      const taskName = line.replace('- [ ]', '').replace('- [x]', '').trim();
      if (taskName) {
        const taskId = `task_${i}`;
        nodes.push({ id: taskId, name: taskName, group: isComplete ? 4 : 5, type: 'task', isComplete });
        links.push({ source: 'projects_hub', target: taskId });
      }
    });
  } catch (err) {
    console.warn('[Canvas] Could not read active projects:', err.message);
  }

  res.json({ nodes, links });
});

router.get('/state', async (req, res) => {
  try {
    const raw = await readVault(CANVAS_STATE_FILE);
    const state = JSON.parse(raw);
    res.json({ exists: true, state });
  } catch (err) {
    res.json({ exists: false });
  }
});

router.post('/state', async (req, res) => {
  try {
    const state = req.body;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'Missing canvas state body' });
    }
    if (!Array.isArray(state.nodes) || !Array.isArray(state.edges)) {
      return res.status(400).json({ error: 'State must include nodes[] and edges[]' });
    }

    const toWrite = JSON.stringify(
      { version: 1, updatedAt: new Date().toISOString(), ...state },
      null,
      2
    );
    await writeVault(CANVAS_STATE_FILE, toWrite);
    await logSystemEvent('system', 'CANVAS_STATE_SAVE', `Saved ${state.nodes.length} nodes, ${state.edges.length} edges`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
