/**
 * paperclip_orchestration.js
 * Bridges AI Boardroom chat to Paperclip agent orchestration
 */

import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// Mock Paperclip integration layer
// In production, this connects to Paperclip's REST API (server/)
// For now, we'll route through Claude directly but track tasks in Paperclip-compatible format

const PAPERCLIP_API = process.env.PAPERCLIP_API_URL || 'http://localhost:3100/api';

/**
 * Agent profiles matching Paperclip's agent model
 * Maps to your board members
 */
const BOARD_AGENTS = {
  jarvis: {
    id: 'agent-jarvis',
    name: 'JARVIS',
    role: 'chief-of-staff',
    description: 'Chief of Staff - Orchestrates the board',
  },
  architect: {
    id: 'agent-architect',
    name: 'Architect',
    role: 'ceo',
    description: 'CEO / Strategy',
  },
  coder: {
    id: 'agent-coder',
    name: 'Coder',
    role: 'cto',
    description: 'CTO / Engineering',
  },
  creative: {
    id: 'agent-creative',
    name: 'Creative',
    role: 'cmo',
    description: 'CMO / Design',
  },
  analyst: {
    id: 'agent-analyst',
    name: 'Analyst',
    role: 'cfo',
    description: 'CFO / Research',
  },
  product: {
    id: 'agent-product',
    name: 'Product',
    role: 'cpo',
    description: 'CPO / Roadmap',
  },
  devops: {
    id: 'agent-devops',
    name: 'DevOps',
    role: 'sre',
    description: 'SRE / Infrastructure',
  },
  security: {
    id: 'agent-security',
    name: 'Security',
    role: 'ciso',
    description: 'CISO / Hardening',
  },
  qa: {
    id: 'agent-qa',
    name: 'QA Lead',
    role: 'cqo',
    description: 'CQO / Testing',
  },
};

/**
 * Get agent config by role
 * @param {string} role - Agent role identifier
 * @returns {object} Agent configuration
 */
export function getAgent(role) {
  return BOARD_AGENTS[role] || BOARD_AGENTS.jarvis;
}

/**
 * Get all agents
 * @returns {array} List of board agents
 */
export function getAllAgents() {
  return Object.values(BOARD_AGENTS);
}

/**
 * Create a task record compatible with Paperclip's task model
 * @param {string} agentId - Agent ID
 * @param {string} title - Task title
 * @param {string} description - Task description
 * @returns {object} Task object
 */
export function createTask(agentId, title, description) {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agentId,
    title,
    description,
    status: 'assigned', // pending, assigned, in_progress, done, failed
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionLog: [],
  };
}

/**
 * Log task execution step
 * @param {object} task - Task object
 * @param {string} status - New status
 * @param {string} message - Status message
 */
export function updateTaskStatus(task, status, message) {
  task.status = status;
  task.updatedAt = new Date().toISOString();
  task.executionLog.push({
    timestamp: new Date().toISOString(),
    status,
    message,
  });
  return task;
}

/**
 * Orchestrate a message through Paperclip agents
 * Currently delegates to llm_router; in future calls Paperclip API
 * @param {object} params - Orchestration params
 * @param {string} params.message - User message
 * @param {string} params.sessionId - Session ID
 * @returns {Promise<object>} Orchestration result
 */
export async function orchestrateMessage(params) {
  const { message, sessionId = 'default', role = 'jarvis' } = params;

  const agent = getAgent(role);
  const task = createTask(agent.id, `Process message: "${message.substring(0, 50)}..."`, message);

  updateTaskStatus(task, 'in_progress', 'Agent received message');

  // This will be connected to Paperclip API or E2B execution
  // For now, returns task metadata for tracking
  return {
    task,
    agent,
    sessionId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get task execution status (for monitoring UI)
 * @param {string} taskId - Task ID
 * @returns {Promise<object>} Task status
 */
export async function getTaskStatus(taskId) {
  // In production, calls Paperclip API to fetch task from DB
  // For now, returns placeholder
  return {
    taskId,
    status: 'pending',
    message: 'Task tracking available in Paperclip UI',
  };
}

export default {
  getAgent,
  getAllAgents,
  createTask,
  updateTaskStatus,
  orchestrateMessage,
  getTaskStatus,
};
