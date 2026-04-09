# IDE Agent Instructions: AI Boardroom Initialization

## Context
You are the lead developer setting up "AI Boardroom," a multi-agent corporate simulation. Read the files `01_project_overview.md`, `02_system_architecture.md`, `03_board_of_directors.md`, and `04_skills_and_workflows.md` to understand the system architecture and agent roles.

## Your Immediate Tasks
Please execute the following steps in order. Do not proceed to the next step until the current one is complete and functional.

### Step 1: Environment Setup & Cloning
1. Initialize a new Node.js/Python project (depending on the primary stack we choose for the backend) in this root directory.
2. Use the terminal to `git clone` the necessary repositories for our infrastructure into a `/lib` or `/vendor` folder. 
   *(Note to Agent: The user will provide the specific GitHub URLs for Paperclip, Companies.sh, Skills.sh, etc., if they are public, or we will build the integrations manually).*
3. Create a `.env` file template with placeholders for:
   - `OPENROUTER_API_KEY=`
   - `OBSIDIAN_VAULT_PATH=`

### Step 2: Establish the Memory Vault
1. Create a directory called `/obsidian_vault` in the root of this project.
2. Inside it, create standard starting files: `00_system_logs.md`, `01_active_projects.md`, and a folder `/board_members`.

### Step 3: Scaffold the Jarvis Interface
1. Set up a basic web server (e.g., Express or FastAPI).
2. Create a simple front-end UI (HTML/CSS/JS) for "Jarvis" with a chat input box and a display window for the agent's responses.
3. Write the initial API route where user input from the front-end is received by the backend.

### Step 4: The OpenRouter Connection
1. Write a utility function `llm_router.js` (or `.py`) that accepts a prompt, a designated "Board Member" role, and makes an API call to OpenRouter.
2. Configure it so the "CEO" defaults to a high-reasoning model and the "Coder" defaults to a coding-specific model.

**When you have read this file and the other markdown files, reply with: "Blueprint acknowledged. Ready to execute Step 1."**