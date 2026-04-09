/**
 * app.js — AI Boardroom Frontend Application
 * 
 * Manages the Jarvis chat interface, board member selection,
 * and communication with the Express backend.
 */

// ── State ───────────────────────────────────────────────────────────────────
const state = {
  activeRole: 'jarvis',
  sessionId: crypto.randomUUID(),
  isLoading: false,
  boardMembers: [],
  boardPanelOpen: false,
};

// ── Role Display Names ──────────────────────────────────────────────────────
const ROLE_NAMES = {
  jarvis: 'JARVIS',
  architect: 'The Architect',
  coder: 'The Coder',
  creative: 'The Creative',
  analyst: 'The Analyst',
};

const ROLE_AVATARS = {
  jarvis: 'J',
  architect: 'A',
  coder: 'C',
  creative: 'M',
  analyst: 'R',
};

// ── DOM Elements ────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const messagesEl = $('#messages');
const chatInput = $('#chatInput');
const sendBtn = $('#sendBtn');
const welcomeScreen = $('#welcomeScreen');
const greetingEl = $('#greeting');
const statusDot = $('.status-dot');
const statusText = $('.status-text');
const boardBtn = $('#boardBtn');
const boardPanel = $('#boardPanel');
const panelClose = $('#panelClose');
const boardMembersEl = $('#boardMembers');
const inputRole = $('#inputRole');
const roleSelector = $('#roleSelector');
const metaModel = $('#metaModel');

// ── Initialize ──────────────────────────────────────────────────────────────
function init() {
  setGreeting();
  setupEventListeners();
  checkSystemStatus();
  loadBoardMembers();
}

function setGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) greetingEl.textContent = 'morning';
  else if (hour < 17) greetingEl.textContent = 'afternoon';
  else greetingEl.textContent = 'evening';
}

// ── Event Listeners ─────────────────────────────────────────────────────────
function setupEventListeners() {
  // Send message
  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
    sendBtn.disabled = !chatInput.value.trim();
  });

  // Quick actions
  document.querySelectorAll('.quick-action').forEach((btn) => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.dataset.prompt;
      chatInput.dispatchEvent(new Event('input'));
      sendMessage();
    });
  });

  // Board panel toggle
  boardBtn.addEventListener('click', () => {
    state.boardPanelOpen = !state.boardPanelOpen;
    boardPanel.classList.toggle('open', state.boardPanelOpen);
  });
  panelClose.addEventListener('click', () => {
    state.boardPanelOpen = false;
    boardPanel.classList.remove('open');
  });

  // Role selector
  inputRole.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = inputRole.getBoundingClientRect();
    roleSelector.style.left = rect.left + 'px';
    roleSelector.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
    roleSelector.hidden = !roleSelector.hidden;
  });

  document.querySelectorAll('.role-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      setActiveRole(opt.dataset.role);
      roleSelector.hidden = true;
    });
  });

  document.addEventListener('click', () => {
    roleSelector.hidden = true;
  });
}

// ── Role Management ─────────────────────────────────────────────────────────
function setActiveRole(role) {
  state.activeRole = role;
  inputRole.querySelector('.role-dot').dataset.role = role;
  inputRole.querySelector('.role-name').textContent = ROLE_NAMES[role];
  
  const member = state.boardMembers.find(m => m.role === role);
  if (member) {
    metaModel.textContent = member.model;
  }
}

// ── API Communication ───────────────────────────────────────────────────────
async function checkSystemStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    statusDot.classList.add('online');
    statusText.textContent = data.apiKeyConfigured ? 'Online' : 'Demo Mode';
  } catch {
    statusText.textContent = 'Offline';
  }
}

async function loadBoardMembers() {
  try {
    const res = await fetch('/api/board');
    const data = await res.json();
    state.boardMembers = data.members;
    renderBoardMembers();
    
    const jarvis = data.members.find(m => m.role === 'jarvis');
    if (jarvis) metaModel.textContent = jarvis.model;
  } catch {
    // Board info will show when server is running
  }
}

function renderBoardMembers() {
  boardMembersEl.innerHTML = state.boardMembers.map((member) => `
    <div class="member-card" data-role="${member.role}">
      <h3>${ROLE_NAMES[member.role] || member.role}</h3>
      <p>${member.description}</p>
      <span class="model-tag">${member.model}</span>
    </div>
  `).join('');

  // Click to switch active role
  boardMembersEl.querySelectorAll('.member-card').forEach((card) => {
    card.addEventListener('click', () => {
      setActiveRole(card.dataset.role);
      state.boardPanelOpen = false;
      boardPanel.classList.remove('open');
    });
  });
}

// ── Send Message ────────────────────────────────────────────────────────────
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || state.isLoading) return;

  // Hide welcome screen
  if (welcomeScreen) {
    welcomeScreen.style.display = 'none';
  }

  // Add user message
  appendMessage('user', text);

  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;

  // Show typing indicator
  const typingEl = showTyping();
  state.isLoading = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        sessionId: state.sessionId,
        role: state.activeRole,
      }),
    });

    const data = await res.json();
    removeTyping(typingEl);

    appendMessage('assistant', data.response, {
      role: data.role,
      model: data.model,
      boardMember: data.boardMember,
    });
  } catch (err) {
    removeTyping(typingEl);
    appendMessage('assistant', `⚠️ Connection error: ${err.message}. Is the server running?`, {
      role: 'jarvis',
      model: 'error',
    });
  } finally {
    state.isLoading = false;
  }
}

// ── Message Rendering ───────────────────────────────────────────────────────
function appendMessage(type, content, meta = {}) {
  const msgEl = document.createElement('div');
  msgEl.className = `message message--${type}`;

  const role = meta.role || state.activeRole;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (type === 'user') {
    msgEl.innerHTML = `
      <div class="msg-avatar msg-avatar--user">YOU</div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-name">You</span>
          <span class="msg-time">${time}</span>
        </div>
        <div class="msg-content">${escapeHtml(content)}</div>
      </div>
    `;
  } else {
    msgEl.innerHTML = `
      <div class="msg-avatar msg-avatar--${role}">${ROLE_AVATARS[role] || 'J'}</div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-name">${ROLE_NAMES[role] || role}</span>
          <span class="msg-time">${time}</span>
          ${meta.model ? `<span class="msg-model">${meta.model}</span>` : ''}
        </div>
        <div class="msg-content">${renderMarkdown(content)}</div>
      </div>
    `;
  }

  messagesEl.appendChild(msgEl);
  scrollToBottom();
}

function showTyping() {
  const role = state.activeRole;
  const el = document.createElement('div');
  el.className = 'message message--assistant';
  el.id = 'typing-indicator';
  el.innerHTML = `
    <div class="msg-avatar msg-avatar--${role}">${ROLE_AVATARS[role] || 'J'}</div>
    <div class="msg-body">
      <div class="msg-header">
        <span class="msg-name">${ROLE_NAMES[role]} is thinking...</span>
      </div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function removeTyping(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

// ── Markdown Rendering (lightweight) ────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  
  let html = escapeHtml(text);

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Unordered lists
  html = html.replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[1-3]>)/g, '$1');
  html = html.replace(/(<\/h[1-3]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');

  return html;
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

// ── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
