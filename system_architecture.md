# System Architecture & Tech Stack

## 1. The Core Stack
This platform relies on a specific, interconnected stack to give the agents hosting, orchestration, memory, and cognitive flexibility.

* **UI / Interface:** Custom chat/voice UI built for "Jarvis" (Standard web app interface + WebRTC for voice).
* **Agent Orchestration:** `Paperclip` - Manages the state, memory routing, and parallel execution of the agent network.
* **Virtual Hosting / Infrastructure:** `Companies.sh` - Provides the containerized environments where the agents "live" and run code.
* **Agent Abilities:** `Skills.sh` - The repository of executable tools the agents can call (e.g., web scraping, GitHub integration, deployment scripts).
* **Memory / Knowledge Graph:** `Obsidian` - A markdown-based central repository acting as the "Corporate Wiki." Agents read/write here to maintain long-term context across sessions.
* **Cognitive Engine (LLM Routing):** `OpenRouter` - The API layer used to switch agent "brains." Different board members will use different underlying models (e.g., Claude 3.5 Sonnet for coding, GPT-4o for strategy) based on the task.

## 2. System Constraints & Requirements
* **Model Agnosticism:** The system must never be hard-coded to a single LLM provider. All inference must pass through OpenRouter.
* **Centralized Memory:** Agents must not rely solely on their own context windows. They must push finalized decisions and code structures to the Obsidian vault.