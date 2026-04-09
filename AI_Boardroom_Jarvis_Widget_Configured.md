# AI Boardroom: Jarvis Widget Fully Configured & Working
**Installation, Configuration, and Technical Architecture Manual**

This document serves as the comprehensive user manual and technical guide for installing, configuring, and understanding the AI Boardroom platform, specifically focusing on the fully configured Jarvis Voice Widget.

---

## 1. Quick Start Installation Guide

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**
- API Keys for **Google Gemini** (Live API) and **OpenRouter** (Text Agents)

### Step-by-Step Setup

1. **Clone or Extract the Repository:**
   Navigate into the project directory:
   ```bash
   cd ai-boardroom
   ```

2. **Install Dependencies:**
   Install backend dependencies (Express, Node-Fetch, WebSockets, etc.):
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root of the project by copying `.env.example` (or creating a new one) and filling in your keys:
   ```env
   # API Keys
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here

   # File System
   OBSIDIAN_VAULT_PATH=./obsidian_vault
   
   # Optional: Model Overrides
   MODEL_JARVIS=nvidia/llama-3.1-nemotron-70b-instruct:free
   MODEL_CEO=nvidia/llama-3.1-nemotron-70b-instruct:free
   ```

4. **Start the Server:**
   Launch the Node.js Express server:
   ```bash
   npm start
   ```
   *(Or `node server.js`)*

5. **Access the Boardroom:**
   Open your browser and navigate to:
   [http://localhost:3001](http://localhost:3001)

---

## 2. Technical Stack Details

### Backend (Server)
- **Environment**: Node.js
- **Web Framework**: Express.js
- **Routing & Networking**: `node-fetch` for API routing, standard REST patterns for token handshakes.
- **Role**: Serves the frontend assets, routes text prompts to OpenRouter, and acts as a secure intermediary to fetch standard configurations (specifically generating the `setupMessage` for the Gemini Live WebSocket) without exposing backend logic logic to the browser unnecessarily.

### Frontend (Browser)
- **Languages**: Vanilla HTML5, CSS3, JavaScript (ES6)
- **Audio Capture**: Web Audio API (`AudioContext`, `ScriptProcessorNode`) — captures microphone input natively at 16kHz for Gemini.
- **Audio Playback**: Web Audio API buffering — decodes and smoothly queues incoming 24kHz Base64 PCM data chunks.
- **Styling**: Custom CSS featuring dynamic keyframe animations, glassmorphism (`backdrop-filter`), and CSS variable design tokens.
- **Network**: Native `WebSocket` API to stream bidirectional audio directly with Google's servers to achieve minimal latency.

### Intelligence Layer (APIs)
1. **Google Gemini Live API (`gemini-3.1-flash-live-preview`)**
   - **Purpose**: Powers the real-time, low-latency JARVIS Voice Widget.
   - **Connection**: Directly via `wss://generativelanguage.googleapis.com/ws/...` using the `bidiGenerateContent` interface.
2. **OpenRouter API**
   - **Purpose**: Powers the text-based boardroom simulation.
   - **Mechanism**: Routes prompts dynamically to specialized LLMs based on the chosen agent (Architect, Coder, Creative, Analyst). Provides fallback redundancy to standard Gemini models if OpenRouter fails.

### Storage & Memory Layer
- **System**: Local File System (JSON/Markdown) via `fs/promises`.
- **Obsidian Vault (`./obsidian_vault`)**: Operates as the shared memory for all agents. 
  - `00_system_logs.md`: Tracks real-time actions and chronological chat history.
  - `01_active_projects.md`: Tracks high-level goals.

---

## 3. How the System Works

### 1. Multi-Agent Text Routing (`llm_router.js`)
When a user types a message in the chat, it is intercepted by the server. The server looks at which agent the user selected (e.g., *The Architect*, *The Coder*) and wraps the user's prompt in that agent's specific `systemPrompt`. The request is then sent to OpenRouter to fetch an intelligent response.

### 2. The Jarvis Voice Widget Architecture (`voice.js` & `routes/voice.js`)
The voice widget is a standalone floating UI built to emulate a highly responsive "Chief of Staff":

1. **Initialization & Context Loading**: When you click the microphone button, the browser requests a configuration token from the backend (`POST /api/voice/token`).
2. **Memory Injection**: The backend reads the latest logs from the `obsidian_vault` (like `00_system_logs.md`) and injects them dynamically into the Gemini `setupMessage`. This ensures JARVIS is fully aware of recent text conversations and project goals before he even starts speaking.
3. **Direct WebSocket Stream**: The browser takes the configuration and opens a direct WebRTC/WebSocket to the Google Gemini Live endpoint.
4. **Bidirectional PCM Processing**:
   - **Input**: The browser captures your mic at 16kHz, converts Floats to Int16 PCM, encodes to Base64, and pushes it up the socket.
   - **Output**: Gemini streams back transcribed text and Base64 audio answers. The browser decodes this and appends it to an audio buffer, playing it sequentially at 24kHz.
5. **Interactive UI State**: As you speak, the widget listens (outer rings pulse). When Jarvis responds, the widget visualizes it (inner core pulses). The widget can be safely minimized to a compact pill while the audio connection remains fully active.

---
### End of Manual. Status: Fully Configured and Working.

