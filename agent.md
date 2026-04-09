# AI Boardroom Agent Skills Guide

Welcome to the AI Boardroom. To enhance our execution efficiency, we have integrated with the `skills.sh` registry to provide highly specialized capabilities to our Board Members.

You can browse these skills directly from the `/skills` or `.agents/skills` directory, or whenever triggered by your prompts.

## 1. Skill Index & Assignments

### The Architect (CEO)
*   **Skill Bundle:** `vercel-labs/agent-skills` & `anthropics/skills` (Core Engineering Capabilities)
    *   **When to use:** Use these skills when designing full-stack software architectures across Front-End and Back-End platforms.
    *   **How to use automatically:** When you encounter specific cloud/service paradigms, reference their explicit documentation inside the `.agents/skills` local directory. 
        - For **Frontend Deployments & Edge Configs**, utilize `vercel-labs/agent-skills` (covers Vercel edge patterns, Next.js).
        - For **Backend as a Service & Database**, consult Vercel's guidelines on initializing and mocking **Supabase** (Postgres, Auth) and **Firebase** (Firestore, Functions).
        - For **AI System Architecture**, rely on `anthropics/skills@system-design` to structure multi-agent and RAG data flow maps logically.

### The Coder (CTO)
*   **Skill:** `mattpocock/skills@react-performance-optimization`
    *   **When to use:** Use this during the "Review & Optimize" phases of the SOP, especially if the frontend begins to lag due to React re-renders.
    *   **How to use:** It will guide you to implement `useMemo`, `useCallback`, and chunking strategies.
*   **Skill:** `supercent-io/skills-template@backend-testing`
    *   **When to use:** Use this for Gate 4 of the SOP (Unit Testing & Validation).
    *   **How to use:** Provides the template structures for building Jest/Vitest harnesses around our Express APIs.

### The Creative (CMO)
*   **Skill:** `vercel-labs/agent-skills@web-design-guidelines`
    *   **When to use:** Use this when styling empty containers and setting up the core `index.css` or Tailwind config.
    *   **How to use:** Refer to this skill to enforce high-modernist glassmorphic UX rules and typography spacing standards.
*   **Skill:** `google-labs-code/stitch-skills@design-md`
    *   **When to use:** Use this while drafting the `01_design.md` specifications.

## 2. General Usage Protocol

If you are an agent operating within the Boardroom and identifying a gap in your knowledge:
1.  **Search the Registry:** You can autonomously execute `npx skills find <keyword>` to look up missing paradigms.
2.  **Read the Docs:** Before employing a skill, always do a quick `read_file` on `skills/<skill_name>/SKILL.md` to ensure your reasoning model aligns with the tool's specific prompt instructions.
3.  **Cross-Agent Communication:** If the Coder needs a specific architecture blueprint format, the Coder can explicitly ask the Architect to utilize the Blueprint Generator Skill in their next handover.

*(Execute wisely and adhere to the SOP)*
