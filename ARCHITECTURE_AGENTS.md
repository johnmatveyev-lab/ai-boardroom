# AI Boardroom Agent Architecture

## System Overview

The AI Boardroom is a multi-agent orchestration platform where 9 autonomous AI agents work together as a board of directors. Each agent has specialized capabilities and can autonomously execute code.

## Agent Roles

### 1. Jarvis (Chief of Staff)
- **Model**: Gemini 3.1 Pro
- **Temperature**: 0.7
- **Capabilities**: Chat routing, task orchestration, user interface
- **Tools**: None (routes to other agents)

### 2. Architect (CEO)
- **Model**: Gemini 3.1 Pro
- **Temperature**: 0.6
- **Capabilities**: System design, strategy, planning
- **Tools**: Google Search

### 3. Coder (CTO)
- **Model**: Gemini 3.1 Pro
- **Temperature**: 0.3
- **Capabilities**: Code writing, debugging, deployment
- **Tools**: 
  - `execute_javascript` — JS code execution
  - `execute_python` — Python code execution
  - `execute_shell` — Shell commands

### 4. Creative (CMO)
- **Model**: Gemini 3.1 Flash
- **Temperature**: 0.9
- **Capabilities**: UI/UX design, copywriting, branding
- **Tools**: Google Search

### 5. Analyst (CFO)
- **Model**: Gemini 3.1 Flash Lite
- **Temperature**: 0.4
- **Capabilities**: Research, data analysis, fact-checking
- **Tools**: Google Search

### 6. Product Manager (CPO)
- **Model**: Gemini 3.1 Pro
- **Temperature**: 0.7
- **Capabilities**: Roadmap, requirements, user stories
- **Tools**: Google Search

### 7. DevOps (SRE)
- **Model**: Gemini 3.1 Pro
- **Temperature**: 0.2
- **Capabilities**: Infrastructure, CI/CD, deployment
- **Tools**:
  - `execute_shell` — Infrastructure automation
  - `execute_python` — Configuration management

### 8. Security (CISO)
- **Model**: Gemini 3.1 Flash
- **Temperature**: 0.1
- **Capabilities**: Security audits, vulnerability assessment
- **Tools**: Google Search

### 9. QA Lead (CQO)
- **Model**: Gemini 3.1 Flash
- **Temperature**: 0.5
- **Capabilities**: Testing, quality assurance, validation
- **Tools**:
  - `execute_javascript` — Frontend testing
  - `execute_python` — Test automation

## Tool Execution Pipeline

### Request Flow

```
User Message
    ↓
Paperclip Orchestration (task tracking)
    ↓
routeToLLM (Gemini 3 API)
    ↓
Agentic Loop (max 5 iterations)
    ├─ Generate content
    ├─ Check for tool calls
    ├─ [Tool detected?] 
    │  ├─ Yes → Process tool calls
    │  │   ├─ Execute in sandbox
    │  │   └─ Feed results back
    │  └─ No → Extract final text
    └─ Return response

Vault Logging (event tracking)
    ↓
Response to User
```

### Execution Sandbox Features

Each tool execution runs in an isolated subprocess with:

- **Resource Limits**:
  - Memory: Unlimited (system controlled)
  - Buffer: 10MB max output
  - Timeout: 5000ms default (configurable)

- **Environment Isolation**:
  - Separate process per execution
  - Temp directory cleanup
  - No persistent state between calls

- **Error Handling**:
  - Exit code capture
  - Stdout/stderr capture
  - Graceful error reporting

## API Endpoints

### Chat Interface
```
POST /api/chat
  - message: User message
  - role: Target agent (or auto-route)
  - sessionId: Conversation ID
```

### Code Execution
```
POST /api/execution/javascript
POST /api/execution/python
POST /api/execution/shell
  - code/command: Code to execute
  - timeout: Milliseconds (optional)
  - sessionId: Execution context (optional)

GET /api/execution/status
  - sessionId: Get execution history
```

### Agent Monitoring (Paperclip)
```
GET /api/paperclip/agents — List all agents
GET /api/paperclip/tasks — Task history
GET /api/paperclip/tasks/:taskId — Task details
```

## System Dependencies

### NPM Packages
- `@google/genai` — Gemini API SDK
- `express` — Web framework
- `cors` — Cross-origin support
- `dotenv` — Environment config
- `multer` — File uploads (future)
- `node-fetch` — HTTP client
- `uuid` — ID generation
- `ws` — WebSocket (voice)
- `mime-types` — File type detection

### Environment Variables
```
GEMINI_API_KEY=sk-***  # Google Gemini API key
OPENROUTER_API_KEY=sk-*** # OpenRouter fallback
OBSIDIAN_VAULT_PATH=./obsidian_vault # Vault storage
PORT=3001 # Server port
```

## Gemini Function Declarations

Agents can call functions defined in their tool configuration:

```javascript
{
  functionDeclarations: [
    {
      name: 'execute_javascript',
      description: '...',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          timeout: { type: 'number' }
        },
        required: ['code']
      }
    },
    // ... more functions
  ]
}
```

When Gemini generates a function call, the agentic loop:
1. Extracts the function name and parameters
2. Calls the appropriate API endpoint
3. Captures the result
4. Feeds it back to Gemini as a `functionResponse`
5. Gemini continues generation with the result

## Agentic Loop Algorithm

```
maxLoops = 5
loopCount = 0

while loopCount < maxLoops:
  response = callGemini(conversationMessages, config)
  
  if hasToolCalls(response):
    toolResults = processToolCalls(response)
    
    # Add assistant response with tool calls
    conversationMessages.append({
      role: 'model',
      parts: response.parts
    })
    
    # Add tool results
    conversationMessages.append(buildToolResults(toolResults))
    
    loopCount++
    continue
  else:
    finalText = extractText(response)
    return finalText

throw Error("Max loops exceeded")
```

## Paperclip Integration

The Paperclip agent orchestration layer sits between the user and the chat API:

- **Task Creation** — Each message becomes a task
- **Status Tracking** — Task status: assigned → in_progress → done/failed
- **Execution Logging** — All actions logged to vault
- **Real-time Monitoring** — Modal UI shows live agent status

## Vault System

Persistent storage for:
- System logs (`00_system_logs.md`)
- Active projects (`01_active_projects.md`)
- Canvas state (`02_canvas_state.json`)
- Uploaded files (`uploads/`)
- Agent memory (future)

## Deployment Targets

### Local Development
```bash
npm run dev  # node --watch server.js
```

### Docker
```bash
docker build -t ai-boardroom .
docker run -p 3001:3001 ai-boardroom
```

### Vercel Serverless
```
api/index.js → Vercel Function
Automatic deployment on git push
```

## Future Enhancements

### Phase 1: Infrastructure (Current)
- ✅ Agentic tool orchestration
- ✅ Multi-language code execution
- ✅ Gemini function declarations
- ⏳ E2B SDK integration (better isolation)

### Phase 2: Capabilities
- File system access for agents
- Persistent execution contexts
- Database queries (pgvector)
- Network requests (with allowlist)
- Docker/Kubernetes container spawning

### Phase 3: Intelligence
- Agent memory persistence
- Multi-agent collaboration patterns
- Goal-oriented planning
- Recursive task decomposition

### Phase 4: Observability
- Execution tracing and spans
- Performance profiling
- Cost tracking per agent
- Audit logs for compliance

---

Last Updated: 2026-04-11
Architect: Claude + Gemini Partnership
