/**
 * tool_executor.js — Agentic Tool Orchestration
 *
 * Manages tool calling loop: agent generates → parse tool calls → execute → return results
 */

import { processTool } from './agent_tools.js';
import { logSystemEvent } from './vault.js';

/**
 * Process tool calls from agent response
 * @param {Object} response - Gemini API response object
 * @returns {Array} Array of executed tool results
 */
export async function processToolCalls(response) {
  if (!response.candidates || response.candidates.length === 0) {
    return [];
  }

  const candidate = response.candidates[0];
  if (!candidate.content || !candidate.content.parts) {
    return [];
  }

  const toolResults = [];

  for (const part of candidate.content.parts) {
    // Gemini uses functionCall for tool invocations
    if (part.functionCall) {
      const { name, args } = part.functionCall;

      try {
        console.log(`[TOOL CALL] Executing: ${name}`, args);

        const result = await processTool(name, args || {});

        toolResults.push({
          name,
          args,
          result,
          success: !result.error,
        });

        await logSystemEvent('system', 'TOOL_EXECUTED', `Tool ${name} executed successfully`);
      } catch (err) {
        console.error(`[TOOL ERROR] Failed to execute ${name}:`, err.message);

        toolResults.push({
          name,
          args,
          result: { error: err.message },
          success: false,
        });

        await logSystemEvent('system', 'TOOL_FAILED', `Tool ${name} failed: ${err.message}`);
      }
    }
  }

  return toolResults;
}

/**
 * Check if response contains tool calls
 */
export function hasToolCalls(response) {
  // Check candidates format (Gemini API v2)
  if (response.candidates && response.candidates.length > 0) {
    const candidate = response.candidates[0];
    if (candidate.content && candidate.content.parts) {
      return candidate.content.parts.some(part => part.functionCall);
    }
  }

  // Check if response has toolUse property (alternative format)
  if (response.toolUse) {
    return true;
  }

  // Check for direct function calls in response
  if (response.functionCall) {
    return true;
  }

  return false;
}

/**
 * Extract text from Gemini response (ignoring tool calls)
 */
export function extractText(response) {
  // Handle direct text property (common response format)
  if (response.text) {
    return response.text;
  }

  // Handle candidates array format
  if (response.candidates && response.candidates.length > 0) {
    const candidate = response.candidates[0];
    if (candidate.content && candidate.content.parts) {
      return candidate.content.parts
        .filter(part => part.text && !part.functionCall)
        .map(part => part.text)
        .join('\n');
    }
  }

  return '';
}

/**
 * Build tool result message for multi-turn conversation
 */
export function buildToolResultMessage(toolResults) {
  if (toolResults.length === 0) {
    return null;
  }

  const parts = [];
  for (const { name, result } of toolResults) {
    if (result.error) {
      parts.push({
        functionResponse: {
          name,
          response: {
            error: result.error,
          },
        },
      });
    } else {
      parts.push({
        functionResponse: {
          name,
          response: result,
        },
      });
    }
  }

  return {
    role: 'user',
    parts,
  };
}

export default {
  processToolCalls,
  hasToolCalls,
  extractText,
  buildToolResultMessage,
};
