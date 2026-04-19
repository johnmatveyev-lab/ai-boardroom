# Security Audit Report: AI Boardroom
**Date**: 2026-04-11  
**Status**: ⚠️ CRITICAL VULNERABILITIES FOUND  
**Severity Levels**: 3 CRITICAL, 4 HIGH, 3 MEDIUM

---

## Executive Summary

The AI Boardroom application has successfully implemented API authentication and rate limiting, but contains several critical vulnerabilities in code execution, input validation, and information disclosure. The primary risk is abuse of the code execution endpoints if authentication credentials are compromised.

---

## Critical Vulnerabilities

### 🔴 CRITICAL-1: Weak Shell Command Blacklist Bypass

**File**: `routes/execution.js` (Lines 105-109)

**Vulnerability**:
```javascript
const dangerous = ['rm -rf', ':(){ :|:& };:', '> /dev/sda', 'chmod -R 777 /'];
if (dangerous.some(d => command.includes(d))) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

**Issues**:
- Blacklist is bypassable using:
  - Spacing: `rm  -rf /` (double space)
  - Quotes: `"rm" "-rf" /`
  - Obfuscation: Using base64, hex encoding
  - Indirect execution: `$(echo rm -rf /)`
  - Alternative dangerous commands not listed: `dd`, `fork bomb`, `chmod`, `chown`

**Example Exploits**:
```bash
# Bypass 1: Extra spacing
curl -X POST http://localhost:3001/api/execution/shell \
  -H "X-API-Key: boardroom_secret_key_123" \
  -H "Content-Type: application/json" \
  -d '{"command": "rm  -rf  /tmp/important"}'

# Bypass 2: Command substitution
curl -X POST http://localhost:3001/api/execution/shell \
  -H "X-API-Key: boardroom_secret_key_123" \
  -d '{"command": "cat /etc/passwd | head"}'

# Bypass 3: Pipe chain
curl -X POST http://localhost:3001/api/execution/shell \
  -H "X-API-Key: boardroom_secret_key_123" \
  -d '{"command": "find / -name \"*.key\" 2>/dev/null"}'
```

**Risk Level**: 🔴 **CRITICAL**
- If API key is leaked/compromised, attacker has full shell access
- No validation prevents reading sensitive files (`/etc/passwd`, `/etc/shadow`, SSH keys)
- No validation prevents exfiltration (curl to attacker server)
- No validation prevents system damage or data destruction

**Fix**:
1. **Replace blacklist with whitelist** - Only allow specific safe commands
2. **Use allowlist pattern matching** with strict regex:
```javascript
const allowedPatterns = [
  /^git\s+status$/,
  /^npm\s+run\s+test$/,
  /^ls\s+-la\s+\.\/\w+$/,
  /^node\s+\-\-version$/
];

const isAllowed = allowedPatterns.some(pattern => pattern.test(command));
if (!isAllowed) {
  return res.status(403).json({ error: 'Command not allowed' });
}
```
3. **Use shell argument arrays instead of sh -c** (prevents shell injection)
4. **Never execute arbitrary commands from user input**

---

### 🔴 CRITICAL-2: No Input Validation on Code Execution

**File**: `routes/execution.js` (Lines 34-36, 64-66)

**Vulnerability**:
```javascript
if (!code || typeof code !== 'string') {
  return res.status(400).json({ error: 'Code is required' });
}
// No further validation - arbitrary code accepted
```

**Issues**:
- Any JavaScript/Python code is accepted and executed
- No checks for dangerous patterns (file I/O, network access, fork bombs)
- Potential for:
  - Reading sensitive files via `fs.readFileSync()`
  - Network exfiltration
  - Infinite loops / resource exhaustion
  - Accessing process environment (which contains API keys)

**Example Exploits**:
```bash
# Read environment variables (containing API keys!)
curl -X POST http://localhost:3001/api/execution/javascript \
  -H "X-API-Key: boardroom_secret_key_123" \
  -H "Content-Type: application/json" \
  -d '{"code": "console.log(JSON.stringify(process.env))"}'

# Response includes:
{
  "success": true,
  "output": "{\"OPENROUTER_API_KEY\":\"sk-or-v1-...\",\"GEMINI_API_KEY\":\"AIzaSya...\",\"BOARDROOM_API_KEY\":\"boardroom_secret_key_123\"}"
}

# Read private files
curl -X POST http://localhost:3001/api/execution/javascript \
  -d '{"code": "const fs=require(\"fs\"); console.log(fs.readFileSync(\"/etc/passwd\",\"utf8\"))"}'

# Read .env file
curl -X POST http://localhost:3001/api/execution/python \
  -d '{"code": "with open(\"/path/to/.env\") as f: print(f.read())"}'
```

**Risk Level**: 🔴 **CRITICAL**
- **API keys exposed** via environment variables
- **System files accessible** 
- **Credentials stolen** from `.env` file
- **Source code accessible** from application directory

**Fix**:
1. **Sanitize environment before execution**:
```javascript
const safeEnv = {
  // Only include essential non-sensitive vars
  NODE_ENV: process.env.NODE_ENV,
  HOME: process.env.HOME,
  USER: process.env.USER,
};
const result = spawnSync('node', [codeFile], {
  env: safeEnv,  // Don't spread process.env
});
```
2. **Run in restricted filesystem** (use Docker/E2B)
3. **Disable require() for fs, child_process, etc.** (use VM2 or similar)
4. **Implement code scanning** to reject dangerous patterns
5. **Use proper sandboxing** (E2B, Docker, isolated containers)

---

### 🔴 CRITICAL-3: Exposed API Keys in Environment

**File**: `.env`

**Vulnerability**:
Both sensitive API keys are stored in plaintext and can be read by any code execution:
```
OPENROUTER_API_KEY=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
GEMINI_API_KEY=AIzaSyAugju4AisioybF8xhTaS4ZeMWoeyth90g
BOARDROOM_API_KEY=boardroom_secret_key_123
```

**Risk Level**: 🔴 **CRITICAL**
- Any code execution can steal all API keys
- These keys are worth $$ if sold or used by attackers
- Gemini and OpenRouter quotas exhausted → service disruption
- Attacker can impersonate as your application

**Fix**:
1. **Never commit .env to git** - Add to `.gitignore`
2. **Use environment variables only** - Pass via deployment system
3. **Rotate all exposed keys immediately**
4. **Implement key isolation** - Different keys for different services
5. **Use short-lived tokens** with expiration

---

## High-Severity Vulnerabilities

### 🟠 HIGH-1: No Rate Limiting on Code Execution

**File**: `routes/execution.js`

**Vulnerability**:
No rate limiting on execution endpoints. An attacker with API key can:
- DoS the server by executing infinite loops
- Exhaust CPU/memory with repeated expensive operations
- Cause Vercel serverless function timeout/overages

**Example Exploit**:
```bash
# Exhaust resources
for i in {1..100}; do
  curl -X POST http://localhost:3001/api/execution/python \
    -H "X-API-Key: boardroom_secret_key_123" \
    -d '{"code": "import time; time.sleep(10)"}'
done
```

**Risk Level**: 🟠 **HIGH**
- **Service unavailability** - Application becomes unresponsive
- **High costs** on Vercel (pay per execution time)
- **Cascading failures** - Timeout effects other users

**Fix**:
1. **Rate limit per API key**: Max 10 requests/minute per key
2. **Rate limit per source IP**: Max 100 requests/hour
3. **Resource quotas**: Max 5000ms execution time per day per key
4. **Queue system**: Put requests in queue instead of immediate execution

```javascript
import rateLimit from 'express-rate-limit';

const executionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
});

router.post('/javascript', executionLimiter, async (req, res) => {
  // execution code
});
```

---

### 🟠 HIGH-2: Information Disclosure in Error Messages

**File**: `routes/execution.js` (Lines 54-55, 85-86, 125-126)

**Vulnerability**:
Full error messages and stderr output returned to client:
```javascript
res.status(500).json({ 
  error: 'Execution failed', 
  details: err.message  // Full error exposed!
});
```

**Example Attack**:
```bash
curl -X POST http://localhost:3001/api/execution/javascript \
  -H "X-API-Key: boardroom_secret_key_123" \
  -d '{"code": "throw new Error(fs.readFileSync(\".env\"))"}'

# Returns full .env content in error message!
```

**Risk Level**: 🟠 **HIGH**
- **Path disclosure** - reveals file structure
- **Library versions** - attackers know what to target
- **Sensitive data** - errors might contain real data

**Fix**:
```javascript
res.status(500).json({ 
  error: 'Execution failed',
  // Don't expose err.message!
});

// Log errors securely server-side
console.error('[EXECUTION ERROR]', err);
```

---

### 🟠 HIGH-3: Session ID Forgery / Access Control

**File**: `routes/execution.js` (Line 32, 64, 96)

**Vulnerability**:
SessionId is user-controlled with no validation:
```javascript
const { code, sessionId = 'default', timeout = 5000 } = req.body;
```

**Attack**:
```bash
# Access another user's execution history
curl http://localhost:3001/api/execution/status?sessionId=admin
curl http://localhost:3001/api/execution/status?sessionId=victim-user
```

**Risk Level**: 🟠 **HIGH**
- **Execution history leakage** - Can see what others executed
- **Session hijacking** - Reuse legitimate session IDs
- **No multi-tenancy** - All sessions mixed in memory

**Fix**:
1. **Generate secure session IDs** (use UUID v4)
2. **Bind sessions to API keys**:
```javascript
const userKey = req.headers['x-api-key'];
const sessionId = req.body.sessionId;

// Validate API key matches session
if (sessionStore.get(sessionId)?.apiKey !== userKey) {
  return res.status(403).json({ error: 'Unauthorized' });
}
```
3. **Store in secure database** instead of in-memory Map
4. **Expire sessions** after timeout

---

### 🟠 HIGH-4: CORS Misconfiguration Allows Cross-Origin Code Execution

**File**: `server.js`

**Vulnerability**:
CORS is configured but too permissive. Combined with weak session handling:
```javascript
const allowedOrigins = ['http://localhost:3001', 'https://ai-boardroom.vercel.app'];
// But what if attacker's domain tricks user into visiting?
```

**Attack Scenario**:
1. Attacker creates fake domain `ai-boardroom.vercel-app.attacker.com`
2. User visits attacker site while logged into real app
3. Attacker's JavaScript makes authenticated requests to code execution API
4. Attacker's code executes on your server

**Risk Level**: 🟠 **HIGH** (requires social engineering)

**Fix**:
1. **Tighten CORS** - Only allow your exact domains
2. **Add CSRF tokens** for state-changing requests
3. **Use SameSite cookies** if applicable

---

## Medium-Severity Vulnerabilities

### 🟡 MEDIUM-1: API Key Exposed in Query Parameter

**File**: `utils/auth.js` (Line 17)

**Vulnerability**:
```javascript
const providedKey = req.headers['x-api-key'] || req.query.apiKey;
```

API key accepted in query parameters:
```
GET /api/status?apiKey=boardroom_secret_key_123
```

**Risk**:
- **Logged in proxy/CDN logs** - Query params logged more than headers
- **Referer headers** - Leaks to external sites
- **Browser history** - Visible if someone uses your computer

**Fix**:
```javascript
// Only accept from headers
const providedKey = req.headers['x-api-key'];
if (!providedKey && API_KEY) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

---

### 🟡 MEDIUM-2: No Timeout Protection for Expensive Operations

**File**: `utils/code_executor.js`

**Vulnerability**:
Timeout is configurable but has no minimum:
```javascript
const result = spawnSync('node', [codeFile], {
  timeout,  // Could be 0 or negative!
  // ...
});
```

**Attack**:
```bash
curl -X POST http://localhost:3001/api/execution/python \
  -H "X-API-Key: boardroom_secret_key_123" \
  -d '{"code": "while True: pass", "timeout": 0}'
```

**Risk**: Infinite loop with no timeout

**Fix**:
```javascript
const MIN_TIMEOUT = 1000;  // 1 second minimum
const MAX_TIMEOUT = 30000; // 30 seconds maximum
const timeout = Math.max(MIN_TIMEOUT, Math.min(MAX_TIMEOUT, options.timeout));
```

---

### 🟡 MEDIUM-3: Execution History Stored in Memory

**File**: `routes/execution.js` (Line 15)

**Vulnerability**:
```javascript
const contexts = new Map();  // Lost on server restart!
```

**Issues**:
- In-memory storage leaks memory over time
- All execution data lost on restart
- No audit trail for compliance

**Fix**:
```javascript
// Use persistent storage
import { db } from '../utils/database.js';

router.get('/status', async (req, res) => {
  const executions = await db.executions
    .where({ sessionId })
    .limit(10)
    .orderBy('timestamp', 'desc');
  res.json({ executions });
});
```

---

## Low-Severity Issues

### 🟢 LOW-1: Missing Security Headers

**Vulnerability**:
No security headers in responses:
- Missing `X-Frame-Options: DENY`
- Missing `Content-Security-Policy`
- Missing `X-Content-Type-Options: nosniff`

**Fix**:
```javascript
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

---

### 🟢 LOW-2: No HTTPS Enforcement in Development

**Vulnerability**:
API keys transmitted in plaintext over HTTP in development

**Fix**:
- Always use HTTPS in production
- Add HSTS header

---

## Summary Table

| Severity | Count | Issues |
|----------|-------|--------|
| 🔴 Critical | 3 | Weak blacklist, No input validation, Exposed API keys |
| 🟠 High | 4 | No rate limiting, Info disclosure, Session forgery, CORS |
| 🟡 Medium | 3 | API key in query params, No timeout min/max, Memory leaks |
| 🟢 Low | 2 | Missing headers, HTTPS not enforced |

---

## Immediate Actions Required

### Priority 1 (Do Today)
1. ✅ **Rotate ALL API keys immediately** - They are compromised
2. ✅ **Remove shell execution endpoint** - Or replace with strict allowlist
3. ✅ **Sanitize environment variables** - Remove sensitive keys from subprocess

### Priority 2 (This Week)
4. Add proper input validation and sanitization
5. Implement rate limiting on all endpoints
6. Add security headers
7. Move to proper sandboxing (E2B, Docker)

### Priority 3 (This Month)
8. Implement database-backed session storage
9. Add comprehensive audit logging
10. Security testing / penetration testing
11. Implement Code Access Control (CAC)

---

## Recommendations

### Short-term
- **Use E2B SDK** instead of subprocess execution
- **Implement allowlist** of safe commands/code patterns
- **Add request signing** (HMAC-SHA256)
- **Implement proper authentication** (not just API key)

### Long-term
- **Multi-tenant support** with proper isolation
- **Audit logging** to database
- **Rate limiting per execution type**
- **Resource quotas** (memory, CPU time, network bandwidth)
- **Code scanning** before execution
- **Signed commits** from verified agents

---

**Next Steps**: Implement Critical fixes before next deployment.

---
*Report Generated: 2026-04-11*  
*Auditor: Claude Security Analysis*
