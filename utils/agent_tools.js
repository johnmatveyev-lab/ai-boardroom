/**
 * agent_tools.js — Agent Tool Definitions
 *
 * Defines tools that board member agents can use
 * Extends the base LLM capabilities with system integration
 */

/**
 * Get available tools for an agent based on their role
 * @param {string} role - Agent role
 * @returns {Array} Tool definitions
 */
export function getToolsForRole(role) {
  const baseTools = [
    {
      name: 'execute_javascript',
      description: 'Execute JavaScript code in a sandboxed environment. Use for data processing, calculations, and testing.',
      input_schema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'JavaScript code to execute',
          },
          timeout: {
            type: 'number',
            description: 'Execution timeout in milliseconds (default: 5000)',
          },
        },
        required: ['code'],
      },
    },
    {
      name: 'execute_python',
      description: 'Execute Python code in a sandboxed environment. Use for data analysis and ML tasks.',
      input_schema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Python code to execute',
          },
          timeout: {
            type: 'number',
            description: 'Execution timeout in milliseconds (default: 5000)',
          },
        },
        required: ['code'],
      },
    },
    {
      name: 'execute_shell',
      description: 'Execute shell commands. Use for CLI operations, git commands, and system utilities.',
      input_schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Shell command to execute',
          },
          timeout: {
            type: 'number',
            description: 'Execution timeout in milliseconds (default: 5000)',
          },
        },
        required: ['command'],
      },
    },
  ];

  // Role-specific tools
  const roleTools = {
    coder: ['execute_javascript', 'execute_python', 'execute_shell'],
    architect: ['execute_shell'],
    devops: ['execute_shell', 'execute_python'],
    qa: ['execute_javascript', 'execute_python'],
    analyst: ['execute_python', 'execute_javascript'],
  };

  const allowedToolNames = roleTools[role] || [];
  return baseTools.filter(tool => allowedToolNames.includes(tool.name));
}

/**
 * System instruction for agents to understand available tools
 */
export function getSystemInstructionForTools(role) {
  const tools = getToolsForRole(role);

  if (tools.length === 0) {
    return '';
  }

  const toolList = tools.map(t => `- **${t.name}**: ${t.description}`).join('\n');

  return `
You have access to the following tools for this session:

${toolList}

When you need to execute code or commands, use the appropriate tool. Always explain what code you're running and why. Handle execution errors gracefully and adapt your approach if needed.

Execution Best Practices:
- Start with small test runs before full operations
- Always validate inputs before execution
- Report execution status and results to the user
- Use timeouts to prevent runaway processes
- Clean up temporary files after execution
`;
}

/**
 * Process tool call from agent
 * @param {string} toolName - Tool name
 * @param {Object} toolInput - Tool input parameters
 * @returns {Promise<Object>} Tool execution result
 */
export async function processTool(toolName, toolInput) {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

  try {
    let endpoint = '';
    let body = {};

    switch (toolName) {
      case 'execute_javascript':
        endpoint = '/api/execution/javascript';
        body = { code: toolInput.code, timeout: toolInput.timeout || 5000 };
        break;
      case 'execute_python':
        endpoint = '/api/execution/python';
        body = { code: toolInput.code, timeout: toolInput.timeout || 5000 };
        break;
      case 'execute_shell':
        endpoint = '/api/execution/shell';
        body = { command: toolInput.command, timeout: toolInput.timeout || 5000 };
        break;
      default:
        return { error: `Unknown tool: ${toolName}` };
    }

    // For server-side execution, call the handler directly
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.details || errorData.error };
    }

    return await response.json();
  } catch (err) {
    return { error: `Tool execution failed: ${err.message}` };
  }
}

export default {
  getToolsForRole,
  getSystemInstructionForTools,
  processTool,
};
