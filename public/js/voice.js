/**
 * voice.js — Jarvis Voice Module (Gemini Live API)
 * 
 * Based on Google's official gemini-live-api-examples implementation.
 * Handles: mic capture (PCM 16kHz), WebSocket to Gemini, audio playback (24kHz).
 */

const VoiceModule = (() => {
  // ── State ─────────────────────────────────────────────────────────────────
  let ws = null;
  let isConnected = false;

  // Audio capture
  let captureContext = null;
  let mediaStream = null;
  let scriptProcessor = null;

  // Audio playback
  let playbackContext = null;
  let nextStartTime = 0;

  // ── DOM Elements ──────────────────────────────────────────────────────────
  let voiceBtn, voiceWidget, voiceIndicator, voiceTranscript;
  let voiceMinimizeBtn, voiceStopBtn;

  // ── Initialize ────────────────────────────────────────────────────────────
  function init() {
    voiceBtn = document.getElementById('voiceBtn');
    voiceWidget = document.getElementById('voiceWidget');
    voiceIndicator = document.getElementById('voiceIndicator');
    voiceTranscript = document.getElementById('voiceTranscript');
    voiceMinimizeBtn = document.getElementById('voiceMinimizeBtn');
    voiceStopBtn = document.getElementById('voiceStopBtn');

    if (!voiceBtn) {
      console.warn('[Voice] No voice button found');
      return;
    }

    voiceBtn.addEventListener('click', toggleVoice);
    
    if (voiceMinimizeBtn) {
      voiceMinimizeBtn.addEventListener('click', () => {
        if (voiceWidget) voiceWidget.classList.toggle('minimized');
      });
    }
    
    if (voiceStopBtn) {
      voiceStopBtn.addEventListener('click', disconnect);
    }

    // Check availability
    fetch('/api/voice/status')
      .then(r => r.json())
      .then(data => {
        if (!data.voiceEnabled) {
          voiceBtn.title = 'Voice disabled — add GEMINI_API_KEY to .env';
          voiceBtn.classList.add('disabled');
        } else {
          console.log('[Voice] Ready — Gemini Live API available');
        }
      })
      .catch(() => {});
  }

  // ── Toggle ────────────────────────────────────────────────────────────────
  function toggleVoice() {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  async function connect() {
    try {
      if (voiceWidget) voiceWidget.classList.remove('minimized');
      setStatus('connecting');
      showWidget(true);

      // Get WebSocket URL and setup config from server
      const res = await fetch('/api/voice/token', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to get voice token');
      }
      const { wsUrl, setupMessage } = await res.json();

      console.log('[Voice] Connecting to Gemini Live API...');

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[Voice] WebSocket connected');
        // Send the setup message as first message
        ws.send(JSON.stringify(setupMessage));
        console.log('[Voice] Setup message sent:', setupMessage.setup.model);
      };

      ws.onmessage = async (event) => {
        let data;
        // Handle Blob responses
        if (event.data instanceof Blob) {
          const text = await event.data.text();
          data = JSON.parse(text);
        } else {
          data = JSON.parse(event.data);
        }
        handleMessage(data);
      };

      ws.onerror = (err) => {
        console.error('[Voice] WebSocket error:', err);
        setStatus('error');
      };

      ws.onclose = (event) => {
        console.log('[Voice] WebSocket closed:', event.code, event.reason);
        // Log helpful debug info for common close codes
        if (event.code === 1002) console.error('[Voice] Protocol error — check setup message format');
        if (event.code === 1003) console.error('[Voice] Unsupported data — check MIME types');
        if (event.code === 1008) console.error('[Voice] Policy violation — check API key or model access');
        if (event.code === 1011) console.error('[Voice] Server error — the model may be unavailable');
        appendTranscript('SYSTEM', `Connection closed (code: ${event.code}). ${event.reason || ''}`);
        cleanup();
        setStatus('disconnected');
        // Keep widget visible for a moment so user sees the error
        setTimeout(() => showWidget(false), 3000);
      };

    } catch (err) {
      console.error('[Voice] Connect failed:', err);
      setStatus('error');
      setTimeout(() => showWidget(false), 2000);
    }
  }

  // ── Disconnect ────────────────────────────────────────────────────────────
  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
    }
    cleanup();
    setStatus('disconnected');
    showWidget(false);
  }

  function cleanup() {
    isConnected = false;
    stopMic();
    if (playbackContext && playbackContext.state !== 'closed') {
      playbackContext.close();
    }
    playbackContext = null;
    nextStartTime = 0;
  }

  // ── Handle Gemini Messages ────────────────────────────────────────────────
  function handleMessage(data) {
    // Setup complete — start mic
    if (data.setupComplete) {
      console.log('[Voice] ✅ Session configured, starting mic...');
      isConnected = true;
      setStatus('listening');
      startMic();
      return;
    }

    const sc = data.serverContent;
    if (!sc) return;

    // Process parts (Audio, Text, Function Calls)
    if (sc.modelTurn?.parts) {
      for (const part of sc.modelTurn.parts) {
        if (part.inlineData) {
          setStatus('speaking');
          playAudioChunk(part.inlineData.data);
        }
        if (part.text) {
          appendTranscript('JARVIS', part.text);
        }
        if (part.functionCall) {
          handleFunctionCall(part.functionCall);
        }
      }
    }

    // Transcriptions
    if (sc.inputTranscription?.text) {
      appendTranscript('You', sc.inputTranscription.text, sc.inputTranscription.finished);
    }
    if (sc.outputTranscription?.text) {
      appendTranscript('JARVIS', sc.outputTranscription.text, sc.outputTranscription.finished);
    }

    // Interrupted
    if (sc.interrupted) {
      console.log('[Voice] Interrupted');
      interruptPlayback();
    }

    // Turn complete
    if (sc.turnComplete) {
      setStatus('listening');
    }
  }

  // ── Handle Tool Execution ─────────────────────────────────────────────────
  async function handleFunctionCall(functionCall) {
    console.log('[Voice] 🛠️ Tool Action Requested:', functionCall.name);
    appendTranscript('SYSTEM', `Executing tool: ${functionCall.name}...`);
    
    try {
      // Route the tool call to the secure Node.js backend
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: functionCall.name,
          args: functionCall.args,
          callId: functionCall.id
        })
      });
      
      const functionResult = await res.json();
      console.log('[Voice] 🛠️ Tool Result:', functionResult);

      // Send the result back to Gemini so Jarvis can summarize what happened
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          tool_response: {
            function_responses: [{
              id: functionCall.id,
              name: functionCall.name,
              response: functionResult.result || { error: functionResult.error }
            }]
          }
        }));
      }
      appendTranscript('SYSTEM', 'Tool execution finished.');
    } catch (err) {
      console.error('[Voice] Tool bridge failed', err);
      // Let Jarvis know it failed
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          tool_response: {
            function_responses: [{
              id: functionCall.id,
              name: functionCall.name,
              response: { error: err.message }
            }]
          }
        }));
      }
    }
  }

  // ── Microphone Capture ────────────────────────────────────────────────────
  async function startMic() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      captureContext = new AudioContext({ sampleRate: 16000 });
      const source = captureContext.createMediaStreamSource(mediaStream);

      // ScriptProcessorNode for PCM capture (simple, works everywhere)
      scriptProcessor = captureContext.createScriptProcessor(4096, 1, 1);

      scriptProcessor.onaudioprocess = (e) => {
        if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) return;

        const float32 = e.inputBuffer.getChannelData(0);

        // Float32 → Int16 PCM
        const pcm16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          pcm16[i] = s * 0x7FFF;
        }

        // Int16 → Base64
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        // Send to Gemini — new format: realtime_input.audio (media_chunks deprecated)
        ws.send(JSON.stringify({
          realtime_input: {
            audio: {
              mime_type: 'audio/pcm',
              data: base64
            }
          }
        }));
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(captureContext.destination);

      console.log('[Voice] 🎤 Microphone active');
    } catch (err) {
      console.error('[Voice] Mic error:', err);
      setStatus('error');
    }
  }

  function stopMic() {
    if (scriptProcessor) {
      scriptProcessor.disconnect();
      scriptProcessor = null;
    }
    if (captureContext && captureContext.state !== 'closed') {
      captureContext.close();
    }
    captureContext = null;
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
  }

  // ── Audio Playback (24kHz) ────────────────────────────────────────────────
  function ensurePlaybackContext() {
    if (!playbackContext || playbackContext.state === 'closed') {
      playbackContext = new AudioContext({ sampleRate: 24000 });
      nextStartTime = 0;
    }
  }

  function playAudioChunk(base64Data) {
    try {
      ensurePlaybackContext();

      // Base64 → Int16 → Float32
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      // Create and schedule buffer
      const buffer = playbackContext.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = playbackContext.createBufferSource();
      source.buffer = buffer;
      source.connect(playbackContext.destination);

      // Schedule sequentially so chunks play back-to-back
      const now = playbackContext.currentTime;
      if (nextStartTime < now) nextStartTime = now;
      source.start(nextStartTime);
      nextStartTime += buffer.duration;

    } catch (err) {
      console.error('[Voice] Playback error:', err);
    }
  }

  function interruptPlayback() {
    if (playbackContext && playbackContext.state !== 'closed') {
      playbackContext.close();
    }
    playbackContext = null;
    nextStartTime = 0;
  }

  // ── Transcript ────────────────────────────────────────────────────────────
  function appendTranscript(speaker, text, finished = false) {
    if (!voiceTranscript || !text) return;

    // Check if we should append to existing line for same speaker
    const lastLine = voiceTranscript.querySelector('.transcript-current');
    if (lastLine && lastLine.dataset.speaker === speaker && !finished) {
      // Append to existing line
      const textNode = lastLine.querySelector('.transcript-text');
      if (textNode) textNode.textContent += text;
      voiceTranscript.scrollTop = voiceTranscript.scrollHeight;
      return;
    }

    // Mark previous as done
    if (lastLine) lastLine.classList.remove('transcript-current');

    // Create new line
    const div = document.createElement('div');
    div.className = 'transcript-line transcript-current';
    div.dataset.speaker = speaker;
    div.innerHTML = `<span class="transcript-speaker">${speaker}:</span> <span class="transcript-text">${text}</span>`;
    voiceTranscript.appendChild(div);
    voiceTranscript.scrollTop = voiceTranscript.scrollHeight;
  }

  // ── Overlay & Status ──────────────────────────────────────────────────────
  function showWidget(show) {
    if (!voiceWidget) return;
    if (show) {
      voiceWidget.removeAttribute('hidden');
    } else {
      voiceWidget.setAttribute('hidden', '');
      // Clear transcript
      if (voiceTranscript) voiceTranscript.innerHTML = '';
      voiceWidget.classList.remove('minimized');
    }
  }

  function setStatus(status) {
    if (!voiceBtn) return;

    voiceBtn.classList.remove('active', 'listening', 'speaking', 'error', 'connecting');
    if (voiceWidget) voiceWidget.classList.remove('listening', 'speaking', 'error');

    const statusMap = {
      connecting: { cls: 'connecting', text: 'Connecting to JARVIS...' },
      listening: { cls: 'active listening', widgetCls: 'listening', text: '🎤 Listening — speak now' },
      speaking: { cls: 'active speaking', widgetCls: 'speaking', text: '🔊 JARVIS is speaking...' },
      error: { cls: 'error', widgetCls: 'error', text: '❌ Voice error — try again' },
      disconnected: { cls: '', text: '' },
    };

    const s = statusMap[status] || statusMap.disconnected;
    s.cls.split(' ').filter(Boolean).forEach(c => voiceBtn.classList.add(c));
    if (s.widgetCls && voiceWidget) voiceWidget.classList.add(s.widgetCls);
    if (voiceIndicator) voiceIndicator.textContent = s.text;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return { init, toggleVoice, connect, disconnect };
})();

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => VoiceModule.init());
