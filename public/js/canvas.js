/**
 * canvas.js — AI Boardroom Interactive Node Canvas
 *
 * A full-featured glassmorphic node editor:
 *  - Drag-and-drop nodes
 *  - Create / Delete nodes
 *  - Draw bezier edges between nodes
 *  - Double-click to open edit drawer
 *  - Pan (middle-click or Space+drag) & Zoom (wheel)
 *  - Load initial data from /api/canvas/diagram
 */

// ── State ────────────────────────────────────────────────────────────────────
let nodes = [];      // { id, type, title, desc, status, x, y, w, h, owners }
let edges = [];      // { id, from, to }

let mode = 'select'; // 'select' | 'connect'
let selectedNodeId = null;
let connectSource = null; // id of node being connected from

// Viewport transform
let pan = { x: 0, y: 0 };
let zoom = 1;

// Drag state
let dragging = null;  // { nodeId, startX, startY, origX, origY }
let panning = false;
let panStart = null;

// DOM refs
let world, nodeLayer, svgEl, viewport;
let editDrawer, editTitleInput, editDescInput, editTypeSelect, editStatusSelect;
let statusText, statusHint, zoomLabel;
let connectLine, connectPath;

// ── Node Type Config ──────────────────────────────────────────────────────────
const NODE_TYPES = {
  core:     { color: '#6366f1', border: 'rgba(99,102,241,0.5)',  bg: 'rgba(99,102,241,0.08)',  label: 'Core',     icon: '◈' },
  role:     { color: '#8b5cf6', border: 'rgba(139,92,246,0.5)', bg: 'rgba(139,92,246,0.08)', label: 'Role',     icon: '◆' },
  gate:     { color: '#f59e0b', border: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.07)', label: 'Gate',     icon: '◫' },
  task:     { color: '#10b981', border: 'rgba(16,185,129,0.5)', bg: 'rgba(16,185,129,0.07)', label: 'Task',     icon: '▣' },
  note:     { color: '#06b6d4', border: 'rgba(6,182,212,0.5)',  bg: 'rgba(6,182,212,0.07)',  label: 'Note',     icon: '◳' },
  hub:      { color: '#f43f5e', border: 'rgba(244,63,94,0.5)',  bg: 'rgba(244,63,94,0.07)',  label: 'Hub',      icon: '⬡' },
};

const STATUS_COLORS = {
  active:   '#10b981',
  complete: '#6366f1',
  pending:  '#f59e0b',
  blocked:  '#f43f5e',
};

let idCounter = 1000;
function genId() { return `n${++idCounter}`; }
function genEdgeId() { return `e${++idCounter}`; }

// ── Init ──────────────────────────────────────────────────────────────────────
export function initCanvas() {
  world       = document.getElementById('canvasWorld');
  nodeLayer   = document.getElementById('canvasNodes');
  svgEl       = document.getElementById('canvasEdgesSvg');
  viewport    = document.getElementById('canvasViewport');
  editDrawer  = document.getElementById('canvasEditDrawer');
  editTitleInput  = document.getElementById('canvasEditNodeTitle');
  editDescInput   = document.getElementById('canvasEditNodeDesc');
  editTypeSelect  = document.getElementById('canvasEditNodeType');
  editStatusSelect= document.getElementById('canvasEditNodeStatus');
  statusText  = document.getElementById('canvasStatusText');
  statusHint  = document.getElementById('canvasStatusHint');
  zoomLabel   = document.getElementById('canvasZoomLabel');
  connectLine = document.getElementById('canvasConnectingLine');
  connectPath = document.getElementById('canvasConnectPath');

  bindToolbar();
  bindViewport();
  bindKeyboard();
  bindEditDrawer();

  // Load data from server
  loadFromServer();
}

// ── Server Load ───────────────────────────────────────────────────────────────
async function loadFromServer() {
  try {
    setStatus('Loading boardroom data...', '');
    const res = await fetch('/api/canvas/diagram');
    const data = await res.json();

    nodes = [];
    edges = [];

    // Convert server nodes to canvas nodes with smart grid layout
    const cols = 4;
    const spacingX = 280, spacingY = 200;
    const startX = 80, startY = 80;

    (data.nodes || []).forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      nodes.push({
        id:     n.id,
        type:   n.type || 'note',
        title:  n.name || 'Untitled',
        desc:   n.description || '',
        status: n.isComplete ? 'complete' : 'active',
        x:      startX + col * spacingX,
        y:      startY + row * spacingY,
        w:      220,
        h:      null, // auto
        owners: n.owners || [],
      });
    });

    // Convert server edges
    (data.links || []).forEach(l => {
      edges.push({ id: genEdgeId(), from: l.source, to: l.target });
    });

    renderAll();
    fitToScreen();
    setStatus(`Loaded ${nodes.length} nodes, ${edges.length} connections`, 'Double-click a node to edit');
  } catch (err) {
    console.error('[Canvas] Load failed:', err);
    loadDefaultBoard();
  }
}

function loadDefaultBoard() {
  nodes = [
    { id: 'core',         type: 'core',  title: 'AI Boardroom',       desc: 'Central architecture hub',    status: 'active',  x: 500, y: 60,  w: 220 },
    { id: 'role_jarvis',  type: 'role',  title: 'JARVIS',             desc: 'Chief of Staff',              status: 'active',  x: 80,  y: 240, w: 200 },
    { id: 'role_arch',    type: 'role',  title: 'The Architect',      desc: 'CEO / Strategy',              status: 'active',  x: 300, y: 240, w: 200 },
    { id: 'role_coder',   type: 'role',  title: 'The Coder',          desc: 'CTO / Engineering',           status: 'active',  x: 520, y: 240, w: 200 },
    { id: 'role_pm',      type: 'role',  title: 'Product Manager',    desc: 'CPO / Roadmap',               status: 'active',  x: 740, y: 240, w: 200 },
    { id: 'role_sec',     type: 'role',  title: 'Security Officer',   desc: 'CISO / Hardening',            status: 'active',  x: 960, y: 240, w: 200 },
    { id: 'gate_1',       type: 'gate',  title: 'Phase 1: Blueprint', desc: 'Architecture & Requirements', status: 'pending', x: 200, y: 460, w: 220 },
    { id: 'gate_2',       type: 'gate',  title: 'Phase 2: Feasibility',desc: 'Fact-check & Grounding',    status: 'pending', x: 440, y: 460, w: 220 },
    { id: 'gate_3',       type: 'gate',  title: 'Phase 3: Build',     desc: 'Code & Design',               status: 'pending', x: 680, y: 460, w: 220 },
    { id: 'gate_4',       type: 'gate',  title: 'Phase 4: Harden',    desc: 'Security & QA Testing',       status: 'pending', x: 920, y: 460, w: 220 },
    { id: 'gate_5',       type: 'gate',  title: 'Phase 5: Deploy',    desc: 'Ship & Monitor',              status: 'pending', x: 560, y: 660, w: 220 },
  ];
  edges = [
    { id: genEdgeId(), from: 'core', to: 'role_jarvis' },
    { id: genEdgeId(), from: 'core', to: 'role_arch' },
    { id: genEdgeId(), from: 'core', to: 'role_coder' },
    { id: genEdgeId(), from: 'core', to: 'role_pm' },
    { id: genEdgeId(), from: 'core', to: 'role_sec' },
    { id: genEdgeId(), from: 'role_arch', to: 'gate_1' },
    { id: genEdgeId(), from: 'role_pm',   to: 'gate_1' },
    { id: genEdgeId(), from: 'gate_1', to: 'gate_2' },
    { id: genEdgeId(), from: 'gate_2', to: 'gate_3' },
    { id: genEdgeId(), from: 'gate_3', to: 'gate_4' },
    { id: genEdgeId(), from: 'gate_4', to: 'gate_5' },
  ];
  renderAll();
  fitToScreen();
  setStatus(`Default board loaded — ${nodes.length} nodes`, 'Double-click a node to edit');
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderAll() {
  renderNodes();
  renderEdges();
}

function renderNodes() {
  nodeLayer.innerHTML = '';
  for (const n of nodes) {
    nodeLayer.appendChild(createNodeEl(n));
  }
}

function createNodeEl(n) {
  const cfg = NODE_TYPES[n.type] || NODE_TYPES.note;
  const isSelected = n.id === selectedNodeId;
  const statusColor = STATUS_COLORS[n.status] || STATUS_COLORS.active;

  const el = document.createElement('div');
  el.className = `canvas-node canvas-node--${n.type}${isSelected ? ' canvas-node--selected' : ''}`;
  el.id = `node-${n.id}`;
  el.dataset.id = n.id;
  el.style.cssText = `
    left: ${n.x}px;
    top:  ${n.y}px;
    width: ${n.w || 220}px;
    border-color: ${isSelected ? cfg.color : cfg.border};
    --node-color: ${cfg.color};
    --node-bg: ${cfg.bg};
  `;

  el.innerHTML = `
    <div class="canvas-node-header">
      <div class="canvas-node-icon" style="color:${cfg.color}">${cfg.icon}</div>
      <div class="canvas-node-meta">
        <span class="canvas-node-type-badge" style="color:${cfg.color};border-color:${cfg.border}">${cfg.label}</span>
        <div class="canvas-node-status-dot" style="background:${statusColor}" title="${n.status}"></div>
      </div>
    </div>
    <div class="canvas-node-body">
      <div class="canvas-node-title">${escHtml(n.title)}</div>
      ${n.desc ? `<div class="canvas-node-desc">${escHtml(n.desc)}</div>` : ''}
    </div>
    <div class="canvas-node-footer">
      <span class="canvas-node-status-label">${n.status}</span>
      <div class="canvas-node-actions">
        <button class="canvas-node-btn canvas-node-edit-btn" data-id="${n.id}" title="Edit">✎</button>
        <button class="canvas-node-btn canvas-node-del-btn" data-id="${n.id}" title="Delete">✕</button>
      </div>
    </div>
    <!-- Connection ports -->
    <div class="canvas-port canvas-port--top"    data-id="${n.id}" data-port="top"></div>
    <div class="canvas-port canvas-port--right"  data-id="${n.id}" data-port="right"></div>
    <div class="canvas-port canvas-port--bottom" data-id="${n.id}" data-port="bottom"></div>
    <div class="canvas-port canvas-port--left"   data-id="${n.id}" data-port="left"></div>
  `;

  // Drag
  el.addEventListener('mousedown', onNodeMouseDown);
  // Double-click to edit
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    openEditDrawer(n.id);
  });
  // Edit button
  el.querySelector('.canvas-node-edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditDrawer(n.id);
  });
  // Delete button
  el.querySelector('.canvas-node-del-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteNode(n.id);
  });
  // Port clicks for connecting
  el.querySelectorAll('.canvas-port').forEach(port => {
    port.addEventListener('mousedown', onPortMouseDown);
  });

  return el;
}

function renderEdges() {
  // Remove old paths (keep defs)
  svgEl.querySelectorAll('path.edge').forEach(p => p.remove());

  for (const e of edges) {
    const fromNode = getNode(e.from);
    const toNode   = getNode(e.to);
    if (!fromNode || !toNode) continue;

    const from = nodeCenter(fromNode);
    const to   = nodeCenter(toNode);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('edge');
    path.dataset.edgeId = e.id;
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgba(99,102,241,0.45)');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    path.setAttribute('d', bezier(from, to));

    path.addEventListener('mouseenter', () => {
      path.setAttribute('stroke', 'rgba(99,102,241,0.9)');
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('marker-end', 'url(#arrowhead-hover)');
    });
    path.addEventListener('mouseleave', () => {
      path.setAttribute('stroke', 'rgba(99,102,241,0.45)');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('marker-end', 'url(#arrowhead)');
    });
    path.addEventListener('dblclick', () => deleteEdge(e.id));
    path.setAttribute('title', 'Double-click to remove this connection');

    svgEl.appendChild(path);
  }

  // Keep SVG size in sync with world
  const bbox = getWorldBBox();
  svgEl.style.width  = bbox.w + 'px';
  svgEl.style.height = bbox.h + 'px';
}

function bezier(from, to) {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const curvature = Math.min(Math.max(dx, dy) * 0.4, 160);
  const c1x = from.x + (to.x > from.x ? curvature : -curvature);
  const c2x = to.x   - (to.x > from.x ? curvature : -curvature);
  return `M${from.x},${from.y} C${c1x},${from.y} ${c2x},${to.y} ${to.x},${to.y}`;
}

function nodeCenter(n) {
  return { x: n.x + (n.w || 220) / 2, y: n.y + 64 };
}

function getWorldBBox() {
  let maxX = 1200, maxY = 900;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + (n.w || 220) + 100);
    maxY = Math.max(maxY, n.y + 200);
  }
  return { w: maxX, h: maxY };
}

// ── Viewport / Transform ────────────────────────────────────────────────────
function applyTransform() {
  world.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  zoomLabel.textContent = Math.round(zoom * 100) + '%';
}

function fitToScreen() {
  if (!nodes.length) return;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + (n.w || 220));
    maxY = Math.max(maxY, n.y + 130);
  }
  const pw = maxX - minX + 120;
  const ph = maxY - minY + 120;
  const newZoom = Math.min(vw / pw, vh / ph, 1.2);
  zoom = Math.max(0.2, newZoom);
  pan.x = (vw - pw * zoom) / 2 - minX * zoom + 60 * zoom;
  pan.y = (vh - ph * zoom) / 2 - minY * zoom + 60 * zoom;
  applyTransform();
}

// ── Drag ──────────────────────────────────────────────────────────────────────
function onNodeMouseDown(e) {
  if (mode === 'connect') return; // ports handle this
  if (e.button !== 0) return;
  if (e.target.classList.contains('canvas-port')) return;
  if (e.target.classList.contains('canvas-node-btn')) return;

  const nodeEl = e.currentTarget;
  const id = nodeEl.dataset.id;

  selectNode(id);
  e.stopPropagation();

  const n = getNode(id);
  dragging = {
    nodeId: id,
    startX: e.clientX,
    startY: e.clientY,
    origX:  n.x,
    origY:  n.y,
  };
  nodeEl.style.cursor = 'grabbing';
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

function onDragMove(e) {
  if (!dragging) return;
  const n = getNode(dragging.nodeId);
  if (!n) return;
  const dx = (e.clientX - dragging.startX) / zoom;
  const dy = (e.clientY - dragging.startY) / zoom;
  n.x = Math.max(0, dragging.origX + dx);
  n.y = Math.max(0, dragging.origY + dy);

  const el = document.getElementById(`node-${n.id}`);
  if (el) {
    el.style.left = n.x + 'px';
    el.style.top  = n.y + 'px';
  }
  renderEdges();
}

function onDragEnd(e) {
  if (dragging) {
    const el = document.getElementById(`node-${dragging.nodeId}`);
    if (el) el.style.cursor = '';
    dragging = null;
  }
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
}

// ── Connect Mode ─────────────────────────────────────────────────────────────
function onPortMouseDown(e) {
  if (mode !== 'connect') return;
  e.stopPropagation();
  e.preventDefault();

  const nodeId = e.currentTarget.dataset.id;
  if (!connectSource) {
    connectSource = nodeId;
    const el = document.getElementById(`node-${nodeId}`);
    if (el) el.classList.add('canvas-node--connecting');
    connectLine.style.display = 'block';
    setStatus(`Connecting from "${getNode(nodeId)?.title}"...`, 'Click another node\'s port to connect');

    document.addEventListener('mousemove', onConnectMove);
    document.addEventListener('mouseup', onConnectEnd);
  } else {
    finishConnection(nodeId);
  }
}

function onConnectMove(e) {
  if (!connectSource) return;
  const srcNode = getNode(connectSource);
  if (!srcNode) return;
  const from = worldToScreen(nodeCenter(srcNode));
  connectPath.setAttribute('d', `M${from.x},${from.y} C${from.x+80},${from.y} ${e.clientX-80},${e.clientY} ${e.clientX},${e.clientY}`);
}

function onConnectEnd(e) {
  // If released on background, cancel
  if (e.target.classList.contains('canvas-viewport') || e.target.classList.contains('canvas-world')) {
    cancelConnection();
  }
  document.removeEventListener('mousemove', onConnectMove);
  document.removeEventListener('mouseup', onConnectEnd);
}

function finishConnection(targetId) {
  if (connectSource && targetId && connectSource !== targetId) {
    // Avoid duplicates
    const exists = edges.some(eg => eg.from === connectSource && eg.to === targetId);
    if (!exists) {
      edges.push({ id: genEdgeId(), from: connectSource, to: targetId });
      renderEdges();
      setStatus(`Connected "${getNode(connectSource)?.title}" → "${getNode(targetId)?.title}"`, 'Double-click an edge to remove it');
    }
  }
  cancelConnection();
}

function cancelConnection() {
  if (connectSource) {
    const el = document.getElementById(`node-${connectSource}`);
    if (el) el.classList.remove('canvas-node--connecting');
  }
  connectSource = null;
  connectLine.style.display = 'none';
  connectPath.setAttribute('d', '');
}

// ── Pan & Zoom ────────────────────────────────────────────────────────────────
function bindViewport() {
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const prevZoom = zoom;
    zoom = Math.max(0.15, Math.min(3, zoom * factor));
    pan.x = mx - (mx - pan.x) * (zoom / prevZoom);
    pan.y = my - (my - pan.y) * (zoom / prevZoom);
    applyTransform();
  }, { passive: false });

  // Middle-click or Space+drag to pan
  viewport.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && e.target === viewport)) {
      panning = true;
      panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      viewport.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  // Deselect on background click
  viewport.addEventListener('click', (e) => {
    if (e.target === viewport || e.target.id === 'canvasWorld') {
      selectNode(null);
      cancelConnection();
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (panning) {
      pan.x = e.clientX - panStart.x;
      pan.y = e.clientY - panStart.y;
      applyTransform();
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (panning) {
      panning = false;
      viewport.style.cursor = '';
    }
  });
}

function worldToScreen(wp) {
  const rect = viewport.getBoundingClientRect();
  return {
    x: wp.x * zoom + pan.x + rect.left,
    y: wp.y * zoom + pan.y + rect.top,
  };
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
function bindToolbar() {
  document.getElementById('toolSelect').addEventListener('click',  () => setMode('select'));
  document.getElementById('toolConnect').addEventListener('click', () => setMode('connect'));

  document.getElementById('toolAddRole').addEventListener('click',  () => addNode('role'));
  document.getElementById('toolAddGate').addEventListener('click',  () => addNode('gate'));
  document.getElementById('toolAddNote').addEventListener('click',  () => addNode('note'));
  document.getElementById('toolAddTask').addEventListener('click',  () => addNode('task'));

  document.getElementById('toolDeleteSelected').addEventListener('click', () => {
    if (selectedNodeId) deleteNode(selectedNodeId);
  });
  document.getElementById('toolClearAll').addEventListener('click', () => {
    if (confirm('Clear the entire canvas?')) {
      nodes = []; edges = [];
      renderAll();
      setStatus('Canvas cleared', 'Add nodes with the toolbar buttons');
    }
  });
  document.getElementById('toolLoadServer').addEventListener('click', loadFromServer);

  document.getElementById('toolZoomIn').addEventListener('click',  () => { zoom = Math.min(3, zoom * 1.2); applyTransform(); });
  document.getElementById('toolZoomOut').addEventListener('click', () => { zoom = Math.max(0.15, zoom * 0.83); applyTransform(); });
  document.getElementById('toolZoomFit').addEventListener('click', fitToScreen);
}

function setMode(m) {
  mode = m;
  cancelConnection();
  document.querySelectorAll('.canvas-tool-btn[id^="tool"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(m === 'select' ? 'toolSelect' : 'toolConnect');
  if (btn) btn.classList.add('active');
  viewport.style.cursor = m === 'connect' ? 'crosshair' : '';
  setStatus(
    m === 'connect' ? 'Connect mode — click a port on one node, then another to draw an edge' : 'Select mode — click a node to select it',
    m === 'connect' ? 'Tip: double-click an edge to delete it' : 'Double-click a node to edit it'
  );
}

// ── Node CRUD ─────────────────────────────────────────────────────────────────
function addNode(type, x, y) {
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const nx = x ?? ((-pan.x + vw / 2) / zoom - 110);
  const ny = y ?? ((-pan.y + vh / 2) / zoom - 60);
  const cfg = NODE_TYPES[type] || NODE_TYPES.note;

  const n = {
    id: genId(),
    type,
    title: `New ${cfg.label}`,
    desc:  '',
    status: 'pending',
    x: nx,
    y: ny,
    w: 220,
  };
  nodes.push(n);
  renderNodes();
  renderEdges();
  selectNode(n.id);
  openEditDrawer(n.id);
  setStatus(`Created new ${cfg.label} node`, 'Edit the title and description in the drawer');
}

function deleteNode(id) {
  nodes = nodes.filter(n => n.id !== id);
  edges = edges.filter(e => e.from !== id && e.to !== id);
  if (selectedNodeId === id) { selectedNodeId = null; closeEditDrawer(); }
  renderAll();
  setStatus('Node deleted', '');
}

function deleteEdge(id) {
  edges = edges.filter(e => e.id !== id);
  renderEdges();
  setStatus('Connection removed', '');
}

function selectNode(id) {
  selectedNodeId = id;
  document.querySelectorAll('.canvas-node').forEach(el => {
    el.classList.toggle('canvas-node--selected', el.dataset.id === id);
    const n = getNode(el.dataset.id);
    if (n) {
      const cfg = NODE_TYPES[n.type] || NODE_TYPES.note;
      el.style.borderColor = el.dataset.id === id ? cfg.color : cfg.border;
    }
  });
}

function getNode(id) { return nodes.find(n => n.id === id); }

// ── Edit Drawer ───────────────────────────────────────────────────────────────
function openEditDrawer(id) {
  const n = getNode(id);
  if (!n) return;
  selectNode(id);

  editTitleInput.value      = n.title;
  editDescInput.value       = n.desc || '';
  editTypeSelect.value      = n.type;
  editStatusSelect.value    = n.status;
  document.getElementById('canvasEditTitle').textContent = `Edit — ${n.title}`;

  editDrawer.dataset.editingId = id;
  editDrawer.removeAttribute('hidden');
}

function closeEditDrawer() {
  editDrawer.setAttribute('hidden', '');
  delete editDrawer.dataset.editingId;
}

function saveEditDrawer() {
  const id = editDrawer.dataset.editingId;
  const n = getNode(id);
  if (!n) return;
  n.title  = editTitleInput.value.trim() || 'Untitled';
  n.desc   = editDescInput.value.trim();
  n.type   = editTypeSelect.value;
  n.status = editStatusSelect.value;
  document.getElementById('canvasEditTitle').textContent = `Edit — ${n.title}`;
  renderNodes();
  renderEdges();
  setStatus(`Saved changes to "${n.title}"`, '');
}

function bindEditDrawer() {
  document.getElementById('canvasEditClose').addEventListener('click',  closeEditDrawer);
  document.getElementById('canvasEditSave').addEventListener('click',   saveEditDrawer);
  document.getElementById('canvasEditDelete').addEventListener('click', () => {
    const id = editDrawer.dataset.editingId;
    if (id) deleteNode(id);
    closeEditDrawer();
  });
  editTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveEditDrawer();
  });
}

// ── Keyboard Shortcuts ────────────────────────────────────────────────────────
function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('canvasModal') || document.getElementById('canvasModal').hidden) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'v' || e.key === 'V') setMode('select');
    if (e.key === 'c' || e.key === 'C') setMode('connect');
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) deleteNode(selectedNodeId);
    if (e.key === 'Escape') { selectNode(null); cancelConnection(); closeEditDrawer(); }
    if ((e.key === '=' || e.key === '+') && e.metaKey) { e.preventDefault(); zoom = Math.min(3, zoom * 1.2); applyTransform(); }
    if (e.key === '-' && e.metaKey) { e.preventDefault(); zoom = Math.max(0.15, zoom * 0.83); applyTransform(); }
    if (e.key === '0' && e.metaKey) { e.preventDefault(); fitToScreen(); }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setStatus(main, hint) {
  if (statusText) statusText.textContent = main;
  if (statusHint) statusHint.textContent = hint !== undefined ? hint : '';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
