# AI Boardroom: Standard Operating Procedures (SOP)

This document establishes the mandatory workflow for all autonomous operations within the AI Boardroom. Board Members must strictly adhere to this pipeline to ensure robust, production-grade continuous integration and deployment.

## The 100% Completion Workflow

Every major feature request or directive must pass through these sequential gates:

### Gate 1: Blueprint & Requirement Engineering (The Architect & The Product Manager)
1. **Intake:** Jarvis receives the directive and assigns it to the team.
2. **User Stories:** The Product Manager translates the vision into actionable user stories and requirements.
3. **Tech Draft:** The Architect defines the data models and file architecture in `00_spec.md`.

### Gate 2: Fact-Check & Feasibility (The Analyst)
1. **Review:** The Analyst reads `00_spec.md` and `01_requirements.md`.
2. **Grounding:** Verifies external dependencies and verifies technical constraints using `googleSearch`.
3. **Approval:** Routes back if discrepancies exist; otherwise, proceeds to Implementation.

### Gate 3: Implementation & Aesthetics (The Coder & The Creative)
1. **Design:** The Creative establishes glassmorphic design tokens in `02_design.md`.
2. **Execution:** The Coder implements the functionality and UI simultaneously.

### Gate 4: Hardening & Validation (The Security Officer & The QA Lead)
1. **Security Audit:** The Security Officer performs a line-by-line vulnerability assessment of the new code.
2. **UX Testing:** The QA Lead performs end-to-end bug hunting and validates the "Definition of Done".
3. **Stress Testing:** The Analyst ensures no performance regressions were introduced.

### Gate 5: Infrastructure & Deployment (Jarvis & The DevOps Lead)
1. **Provisioning:** The DevOps Lead optimizes the server environment and CI/CD triggers.
2. **Live Push:** Jarvis verifies all gates are green and performs the final Git commit and deployment.
3. **Reporting:** Jarvis provides the stakeholder with a comprehensive speed and security report.

---

> **WARNING:** Direct deviation from this SOP is grounds for process termination. Sub-agents must not skip phases. Testing and Fact-Checking are critical guarantees of the platform's stability.
