/**
 * paperclip_monitor.js — Paperclip Agent Monitoring Panel
 * Displays real-time task execution and agent activity
 */

export function initPaperclipMonitor() {
  // Check if monitor button exists in header
  const monitorBtn = document.getElementById('monitorBtn');
  if (!monitorBtn) return;

  monitorBtn.addEventListener('click', openMonitorModal);
}

function openMonitorModal() {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'paperclip-monitor-modal';
  modal.id = 'paperclipMonitorModal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Paperclip Agent Monitoring</h2>
        <button class="modal-close" id="monitorModalClose">&times;</button>
      </div>

      <div class="monitor-tabs">
        <button class="tab-btn active" data-tab="agents">Agents</button>
        <button class="tab-btn" data-tab="tasks">Tasks</button>
        <button class="tab-btn" data-tab="logs">Logs</button>
      </div>

      <!-- Agents Tab -->
      <div class="tab-content active" id="agents-tab">
        <div class="agents-grid" id="agentsGrid">
          <p class="loading">Loading agents...</p>
        </div>
      </div>

      <!-- Tasks Tab -->
      <div class="tab-content" id="tasks-tab">
        <div class="tasks-list" id="tasksList">
          <p class="loading">Loading tasks...</p>
        </div>
      </div>

      <!-- Logs Tab -->
      <div class="tab-content" id="logs-tab">
        <div class="logs-viewer" id="logsViewer">
          <p class="loading">Loading logs...</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close button
  document.getElementById('monitorModalClose').addEventListener('click', () => {
    modal.remove();
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      switchTab(tabName);
    });
  });

  // Load initial data
  loadAgents();
  loadTasks();
  loadLogs();

  // Auto-refresh every 3 seconds
  setInterval(() => {
    loadAgents();
    loadTasks();
    loadLogs();
  }, 3000);
}

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Deactivate all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  document.getElementById(`${tabName}-tab`).classList.add('active');
  event.target.classList.add('active');
}

async function loadAgents() {
  try {
    const res = await fetch('/api/paperclip/agents');
    const data = await res.json();

    const grid = document.getElementById('agentsGrid');
    if (!grid) return;

    if (!data.agents || data.agents.length === 0) {
      grid.innerHTML = '<p>No agents configured.</p>';
      return;
    }

    grid.innerHTML = data.agents
      .map(agent => `
        <div class="agent-card">
          <div class="agent-icon">◆</div>
          <div class="agent-info">
            <h3>${agent.name}</h3>
            <p class="role">${agent.role}</p>
            <p class="description">${agent.description}</p>
            <span class="agent-id">${agent.id}</span>
          </div>
        </div>
      `)
      .join('');
  } catch (err) {
    console.error('[Monitor] Error loading agents:', err);
    const grid = document.getElementById('agentsGrid');
    if (grid) grid.innerHTML = '<p class="error">Failed to load agents</p>';
  }
}

async function loadTasks() {
  try {
    const res = await fetch('/api/paperclip/tasks');
    const data = await res.json();

    const list = document.getElementById('tasksList');
    if (!list) return;

    if (!data.tasks || data.tasks.length === 0) {
      list.innerHTML = '<p>No tasks yet.</p>';
      return;
    }

    list.innerHTML = data.tasks
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20) // Show last 20 tasks
      .map(task => `
        <div class="task-item status-${task.status}">
          <div class="task-header">
            <span class="task-id">${task.id.substring(0, 12)}...</span>
            <span class="task-status">${task.status}</span>
          </div>
          <p class="task-title">${task.title}</p>
          <p class="task-description">${task.description.substring(0, 100)}...</p>
          <div class="task-meta">
            <small>Created: ${new Date(task.createdAt).toLocaleTimeString()}</small>
            <small>Agent: ${task.agentId}</small>
          </div>
        </div>
      `)
      .join('');
  } catch (err) {
    console.error('[Monitor] Error loading tasks:', err);
    const list = document.getElementById('tasksList');
    if (list) list.innerHTML = '<p class="error">Failed to load tasks</p>';
  }
}

async function loadLogs() {
  try {
    const res = await fetch('/api/vault/analytics');
    const data = await res.json();

    const viewer = document.getElementById('logsViewer');
    if (!viewer) return;

    if (!data.agentActivity || Object.keys(data.agentActivity).length === 0) {
      viewer.innerHTML = '<p>No activity logs yet.</p>';
      return;
    }

    const summary = Object.entries(data.agentActivity)
      .sort((a, b) => b[1] - a[1])
      .map(([agent, count]) => `
        <div class="log-entry">
          <strong>${agent}</strong>: ${count} events
        </div>
      `)
      .join('');

    viewer.innerHTML = summary || '<p>No logs available</p>';
  } catch (err) {
    console.error('[Monitor] Error loading logs:', err);
    const viewer = document.getElementById('logsViewer');
    if (viewer) viewer.innerHTML = '<p class="error">Failed to load logs</p>';
  }
}
