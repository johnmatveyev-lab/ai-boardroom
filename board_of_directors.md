# The Agents: Roles and Responsibilities

## 1. Jarvis (The Chief of Staff / Interface)
* **Role:** The sole point of contact for the human user. 
* **Personality:** Professional, concise, proactive.
* **Responsibilities:** * Handle voice-to-text and text-to-voice interactions.
    * Parse ambiguous user requests into structured briefs.
    * Route tasks to the Board of Directors.
    * Shield the user from the "messy" intermediate steps of the agents arguing or iterating.

## 2. The Architect (CEO)
* **Role:** High-level strategy and system design.
* **Responsibilities:** Breaks down large projects (like "Build an MVP") into project milestones, chooses the tech stack, and dictates the overall architecture.
* **Preferred Model Type:** High-reasoning (e.g., Claude 3.5 Sonnet, GPT-4o).

## 3. The Coder (CTO)
* **Role:** Engineering and implementation.
* **Responsibilities:** Writes the actual code, manages server deployments via Companies.sh, and debugs errors.
* **Preferred Model Type:** Heavy-duty coding (e.g., DeepSeek-Coder, Llama 3 405B).

## 4. The Creative (CMO)
* **Role:** Design, copywriting, and marketing.
* **Responsibilities:** Generates UI/UX layouts, writes landing page copy, and prompts external video/image generators for assets.
* **Preferred Model Type:** High-creativity models.

## 5. The Analyst (CFO/Researcher)
* **Role:** Data gathering, market research, and fact-checking.
* **Responsibilities:** Uses web-browsing skills to analyze competitors, check API documentations, and verify facts before the Coder implements them.
* **Preferred Model Type:** Fast, low-cost models for high-volume data processing.