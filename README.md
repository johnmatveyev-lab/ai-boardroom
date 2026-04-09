# AI Boardroom

> A fully configured multi-agent corporate simulation platform featuring the real-time Jarvis Voice Widget.

![Voice Widget Configured](Screenshot 2026-04-08 at 10.51.26 AM.png)

## Overview

AI Boardroom is a production-ready application where autonomous AI agents build, deploy, and test real software. The project utilizes a dual-LLM approach, routing text interactions through OpenRouter while powering real-time, bidirectional voice interactions via the native Google Gemini Live API.

The standout feature is the **Jarvis Voice Widget**, a floating UI that acts as a "Chief of Staff." It listens to your commands (with full microphone capture and PCM audio encoding) and responds via low-latency audio playback, securely injected with the project's recent memory and task context from a shared Obsidian Vault.

## Features
- **Multi-Agent Routing**: Route tasks dynamically to assigned roles (e.g., The Architect, The Coder, The Creative) based on the user's intent.
- **Jarvis Voice Widget**: Floating WebRTC voice orb with real-time UI reactions for speaking, listening, scaling, and controls.
- **Shared Obsidian Vault**: Memory structure utilizing local markdown files (`00_system_logs.md`) for persistent shared context across all agents.
- **Pure Native Stack**: Avoids heavy frontend frameworks. Uses pure HTML5, CSS3 with glassmorphism over WebSockets and the Web Audio API.

## Technical Documentation
For full installation instructions, technical architecture details, and how the APIs function (including setting up `.env` for `OPENROUTER_API_KEY` and `GEMINI_API_KEY`), please refer to the primary manual:

👉 [AI Boardroom Jarvis Widget Configured Manual](AI_Boardroom_Jarvis_Widget_Configured.md)

## Tech Stack
- Frontend: HTML5, CSS3, ES6 JavaScript, Web Audio API
- Backend: Node.js, Express.js
- Real-Time Communication: `ws` (WebSockets)
- Intelligence: Google Gemini Live (v1beta), OpenRouter

## Running Locally

1. Clone the repository
2. Run `npm install`
3. Setup your `.env` (Requires `GEMINI_API_KEY` and `OPENROUTER_API_KEY`)
4. Run `npm start`
5. Visit `http://localhost:3001`
