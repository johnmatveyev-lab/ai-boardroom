/**
 * upload.js — File Upload Frontend Module
 * Handles attach button, file chips, upload progress, and API integration.
 */

let pendingFiles = [];

/**
 * Initialize the upload UI and event handlers.
 * Called from index.html module script.
 */
export function initUpload() {
  // Ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUploadDom);
    return;
  }
  initUploadDom();
}

function initUploadDom() {
  // 1. Wire attach button → open file picker
  const attachBtn = document.getElementById('attachBtn');
  const fileInput = document.getElementById('fileInput');

  attachBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  // 2. File picker → add to pendingFiles, render chips
  fileInput?.addEventListener('change', (e) => {
    Array.from(e.target.files || []).forEach(addFile);
    e.target.value = ''; // reset so same file can be re-added
  });

  // 3. Remove chips on X click
  const fileChips = document.getElementById('fileChips');
  fileChips?.addEventListener('click', (e) => {
    const btn = e.target.closest('.file-chip-remove');
    if (btn) {
      removeFile(parseInt(btn.dataset.index, 10));
    }
  });

  // 4. Drag-and-drop onto the input wrapper
  const wrapper = document.querySelector('.input-wrapper');
  if (wrapper) {
    wrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      wrapper.classList.add('drag-over');
    });
    wrapper.addEventListener('dragleave', () => {
      wrapper.classList.remove('drag-over');
    });
    wrapper.addEventListener('drop', (e) => {
      e.preventDefault();
      wrapper.classList.remove('drag-over');
      Array.from(e.dataTransfer.files || []).forEach(addFile);
    });
  }

  // 5. Intercept sendBtn in capture phase when files are pending
  const sendBtn = document.getElementById('sendBtn');
  sendBtn?.addEventListener('click', handleSendWithFiles, true);
}

/**
 * Handle send when files are pending. Intercepts before app.js handler.
 */
function handleSendWithFiles(e) {
  if (pendingFiles.length === 0) return; // pass through to normal handler

  e.stopImmediatePropagation();

  const chatInput = document.getElementById('chatInput');
  const text = chatInput?.value.trim() || '';

  // Clear input before async (mirrors app.js sendMessage behavior)
  if (chatInput) {
    chatInput.value = '';
    chatInput.style.height = 'auto';
  }

  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.disabled = true;
  }

  // Show user message bubble including file references
  const fileNames = pendingFiles.map(f => f.name).join(', ');
  const displayText = text ? `${text}\n\n_Attached: ${fileNames}_` : `_Attached: ${fileNames}_`;

  const boardroom = window.__boardroom;
  if (!boardroom) {
    console.error('[Upload] window.__boardroom not available. App may not be initialized.');
    alert('Error: Application not ready. Please refresh the page.');
    return;
  }

  if (boardroom?.appendMessage) {
    boardroom.appendMessage('user', displayText);
  }

  sendWithFiles(text);
}

/**
 * Send files to /api/upload and handle response.
 */
async function sendWithFiles(textMessage) {
  const boardroom = window.__boardroom;
  if (!boardroom) {
    console.error('[Upload] window.__boardroom not available');
    return;
  }

  const { state, appendMessage, showTyping, removeTyping } = boardroom;

  const formData = new FormData();
  pendingFiles.forEach(f => formData.append('files', f));
  formData.append('sessionId', state.sessionId);
  if (textMessage) {
    formData.append('message', textMessage);
  }

  const typingEl = showTyping?.();
  if (state) {
    state.isLoading = true;
  }

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (typingEl && removeTyping) {
      removeTyping(typingEl);
    }

    if (!res.ok) {
      if (appendMessage) {
        appendMessage('assistant', `Upload error: ${data.error || 'Unknown error'}`, {
          role: 'jarvis',
          model: 'error',
        });
      }
      return;
    }

    if (appendMessage) {
      appendMessage('assistant', data.response, {
        role: data.role || 'jarvis',
        model: data.model,
        boardMember: data.boardMember,
      });
    }

    clearPendingFiles();
  } catch (err) {
    if (typingEl && removeTyping) {
      removeTyping(typingEl);
    }

    if (appendMessage) {
      appendMessage('assistant', `Upload failed: ${err.message}`, {
        role: 'jarvis',
        model: 'error',
      });
    }
  } finally {
    if (state) {
      state.isLoading = false;
    }
  }
}

/**
 * Validate and add a file to pendingFiles.
 */
function addFile(file) {
  const ALLOWED = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (!ALLOWED.includes(file.type) && !file.name.endsWith('.md')) {
    alert(`Unsupported file type: ${file.name}`);
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    alert(`File too large (max 20MB): ${file.name}`);
    return;
  }

  if (pendingFiles.length >= 5) {
    alert('Maximum 5 files per upload.');
    return;
  }

  pendingFiles.push(file);
  renderFileChips();
  updateAttachBtnState();
}

/**
 * Remove a file by index.
 */
function removeFile(index) {
  pendingFiles.splice(index, 1);
  renderFileChips();
  updateAttachBtnState();
}

/**
 * Clear all pending files.
 */
function clearPendingFiles() {
  pendingFiles = [];
  renderFileChips();
  updateAttachBtnState();
}

/**
 * Update attach button state based on pending files.
 */
function updateAttachBtnState() {
  const btn = document.getElementById('attachBtn');
  if (btn) {
    btn.classList.toggle('has-files', pendingFiles.length > 0);
  }
}

/**
 * Render file chips UI.
 */
function renderFileChips() {
  const container = document.getElementById('fileChips');
  if (!container) return;

  container.hidden = pendingFiles.length === 0;
  container.innerHTML = pendingFiles
    .map((f, i) => {
      const icon = getFileIcon(f);
      const name = truncateName(f.name, 22);
      const size = formatBytes(f.size);
      return `
        <div class="file-chip">
          <span class="file-chip-icon">${icon}</span>
          <span class="file-chip-name">${name}</span>
          <span class="file-chip-size">${size}</span>
          <button class="file-chip-remove" data-index="${i}" aria-label="Remove file">&times;</button>
        </div>
      `;
    })
    .join('');
}

/**
 * Get file icon label based on MIME type.
 */
function getFileIcon(file) {
  if (file.type.startsWith('image/')) return 'IMG';
  if (file.type === 'application/pdf') return 'PDF';
  if (file.type === 'text/csv') return 'CSV';
  if (file.name.endsWith('.md')) return 'MD';
  if (file.type.includes('wordprocessingml')) return 'DOC';
  return 'TXT';
}

/**
 * Truncate filename to max length with ellipsis.
 */
function truncateName(name, max) {
  if (name.length <= max) return name;
  const ext = name.lastIndexOf('.');
  if (ext > 0) {
    return name.substring(0, max - 4) + '...' + name.substring(ext);
  }
  return name.substring(0, max) + '...';
}

/**
 * Format bytes to human-readable size.
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
