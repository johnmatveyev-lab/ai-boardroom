# Execution Flow & Agent Skills

## 1. Standard Operating Procedure: "Build an MVP"
When the user says: "Generate an MVP for this app concept," the system follows this strict workflow:

1.  **Intake Phase:** Jarvis asks the user 1-2 clarifying questions about the target audience and core feature.
2.  **Strategy Phase:** Jarvis passes the brief to the Architect (CEO). The Architect creates a `00_spec.md` file in the Obsidian memory vault outlining the database schema and UI flow.
3.  **Design Phase:** The Creative (CMO) reads `00_spec.md` and generates wireframe descriptions and front-end copy, saving it as `01_design.md`.
4.  **Development Phase:** The Coder (CTO) reads both files, spins up an environment in Companies.sh, and begins writing code. The Coder uses `Skills.sh` to install dependencies and run tests.
5.  **Review Phase:** The Analyst reviews the code against the original brief for errors or missing features.
6.  **Delivery Phase:** Jarvis reads the final output and presents the user with a live URL and a summary of what was built.

## 2. Required Skills (Skills.sh integration)
To execute the above, the development agent must equip the Board with the following capabilities:
* `read_obsidian_vault(file_path)`
* `write_obsidian_vault(file_path, content)`
* `execute_terminal_command(command)`
* `deploy_to_companies_sh(repo_url)`
* `search_web(query)`
* `read_url(url)`