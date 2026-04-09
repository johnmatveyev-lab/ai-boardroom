/**
 * notepad.js — Vault Notepad (Obsidian Vault Editor)
 *
 * Minimal editor for markdown files in the local vault:
 * - List vault .md files
 * - Load a file by path
 * - Save content to /api/vault/write
 */

export function initNotepad() {
  const btn = document.getElementById('notepadBtn');
  const modal = document.getElementById('notepadModal');
  const closeBtn = document.getElementById('notepadClose');
  const refreshBtn = document.getElementById('notepadRefresh');
  const filesEl = document.getElementById('notepadFiles');
  const pathEl = document.getElementById('notepadPath');
  const textEl = document.getElementById('notepadText');
  const loadBtn = document.getElementById('notepadLoad');
  const saveBtn = document.getElementById('notepadSave');
  const statusEl = document.getElementById('notepadStatus');

  if (!btn || !modal) return;

  let currentPath = '';

  function setStatus(text, type = '') {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.dataset.type = type;
  }

  function openModal() {
    modal.hidden = false;
    setStatus('Loading vault…');
    loadFileList().finally(() => setStatus(''));
    setTimeout(() => pathEl?.focus(), 50);
  }

  function closeModal() {
    modal.hidden = true;
    setStatus('');
  }

  async function loadFileList() {
    if (!filesEl) return;
    filesEl.innerHTML = '<div class="notepad-empty">Loading…</div>';
    try {
      const res = await fetch('/api/vault');
      const data = await res.json();
      const files = (data.files || []).slice().sort();
      if (!files.length) {
        filesEl.innerHTML = '<div class="notepad-empty">No markdown files found.</div>';
        return;
      }
      filesEl.innerHTML = files
        .map((f) => `
          <button class="notepad-file${f === currentPath ? ' active' : ''}" data-path="${escapeAttr(f)}">
            ${escapeHtml(f)}
          </button>
        `)
        .join('');
      filesEl.querySelectorAll('.notepad-file').forEach((b) => {
        b.addEventListener('click', async () => {
          const p = b.dataset.path || '';
          if (!p) return;
          pathEl.value = p;
          await loadFile(p);
        });
      });
    } catch (e) {
      filesEl.innerHTML = '<div class="notepad-empty">Failed to load vault.</div>';
    }
  }

  async function loadFile(filePath) {
    const p = (filePath || '').trim();
    if (!p) return;
    setStatus('Loading…');
    try {
      const res = await fetch(`/api/vault/${encodeURIComponent(p).replace(/%2F/g, '/')}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      currentPath = p;
      if (textEl) textEl.value = data.content || '';
      setStatus(`Loaded ${p}`, 'ok');
      await loadFileList();
      setTimeout(() => setStatus(''), 1200);
    } catch (e) {
      setStatus(`Could not load ${p}`, 'error');
      setTimeout(() => setStatus(''), 2000);
    }
  }

  async function saveFile() {
    const p = (pathEl?.value || '').trim();
    if (!p) {
      setStatus('Enter a file path to save', 'error');
      setTimeout(() => setStatus(''), 2000);
      return;
    }

    setStatus('Saving…');
    try {
      const res = await fetch('/api/vault/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: p,
          content: textEl?.value || '',
          actor: 'jarvis',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }
      currentPath = p;
      setStatus(`Saved ${p}`, 'ok');
      await loadFileList();
      setTimeout(() => setStatus(''), 1200);
    } catch (e) {
      setStatus(e.message || 'Save failed', 'error');
      setTimeout(() => setStatus(''), 2500);
    }
  }

  btn.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  refreshBtn?.addEventListener('click', loadFileList);
  loadBtn?.addEventListener('click', () => loadFile(pathEl.value));
  saveBtn?.addEventListener('click', saveFile);

  // ESC closes
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') closeModal();
  });

  // Cmd/Ctrl+S to save
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    const isSave = (e.key === 's' || e.key === 'S') && (e.metaKey || e.ctrlKey);
    if (!isSave) return;
    e.preventDefault();
    saveFile();
  });
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, (c) => map[c]);
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

