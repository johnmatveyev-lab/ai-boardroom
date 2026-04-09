/**
 * file_processor.js — File Analysis Pipeline
 * Uses Gemini Vision/inline_data to extract structured intelligence from uploaded files.
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// ── System & Analysis Prompts ────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are a document intelligence agent for AI Boardroom.
Your job is to analyze uploaded files and extract structured operational intelligence.
Always respond with valid JSON only. No markdown, no explanation outside the JSON object.`;

const ANALYSIS_PROMPT = `Analyze this file and respond with ONLY a JSON object in this exact schema:

{
  "summary": "2-4 sentence description of what this file contains and its purpose",
  "key_topics": ["topic1", "topic2", "topic3"],
  "suggested_tasks": [
    "Specific actionable task derived from this file",
    "Another task"
  ],
  "suggested_agents": ["architect"],
  "category": "strategy"
}

Rules:
- summary: Concise, informative, 2-4 sentences. Describe content AND relevance to a software product team.
- key_topics: 3-7 specific topics, technologies, concepts, or entities found in the file.
- suggested_tasks: 2-5 concrete, actionable tasks formatted as imperative sentences. These become checklist items in the project tracker.
- suggested_agents: Array of 1-3 agent names from this list ONLY: jarvis, architect, coder, creative, analyst, product, devops, security, qa. Choose based on content type.
- category: ONE of: strategy, design, engineering, research, document, image, data

Respond with the JSON object only. No surrounding text.`;

// ── Main Pipeline Function ───────────────────────────────────────────────────

/**
 * Process a single uploaded file through Gemini and extract structured data.
 * @param {Object} file - Multer file object { path, originalname, mimetype, size }
 * @returns {Promise<Object>} ProcessResult with analysis and vault content
 */
export async function processUploadedFile(file) {
  const storedAs = path.basename(file.path);

  let analysis;
  try {
    analysis = await analyzeFileWithGemini(file);
  } catch (err) {
    console.error('[File Processor] Gemini analysis failed:', err.message);
    analysis = getFallbackAnalysis(file);
  }

  const vaultPath = `uploads/${storedAs}.md`;
  const vaultContent = buildVaultMarkdown(file, analysis, storedAs);

  return {
    originalName: file.originalname,
    storedAs,
    mimetype: file.mimetype,
    size: file.size,
    analysis,
    vaultContent,
    vaultPath,
  };
}

// ── Gemini Analysis ──────────────────────────────────────────────────────────

/**
 * Analyze file via Gemini using inline_data for binary/PDF, or text for text files.
 */
async function analyzeFileWithGemini(file) {
  if (!ai) {
    console.warn('[File Processor] Gemini not configured, using fallback analysis');
    return getFallbackAnalysis(file);
  }

  let contents;

  // For images and PDFs, use inline_data approach
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf' || file.mimetype.includes('wordprocessingml')) {
    contents = await buildInlineDataContents(file);
  } else {
    // For text files, read as UTF-8
    contents = await buildTextContents(file);
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
      },
    });

    const responseText = response.text?.trim() || '';

    // Safeguard: if response looks like HTML/error, use fallback
    if (responseText.includes('<!DOCTYPE') || responseText.includes('<html') || !responseText.includes('{')) {
      console.warn('[File Processor] Gemini returned HTML error page, using fallback');
      return getFallbackAnalysis(file);
    }

    // Try to parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[File Processor] No JSON found in response, using fallback');
      return getFallbackAnalysis(file);
    }

    let analysis;
    try {
      analysis = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.warn('[File Processor] JSON parse failed:', parseErr.message, 'using fallback');
      return getFallbackAnalysis(file);
    }

    // Validate schema
    if (!analysis.summary || !Array.isArray(analysis.key_topics) || !Array.isArray(analysis.suggested_tasks) || !Array.isArray(analysis.suggested_agents) || !analysis.category) {
      console.warn('[File Processor] Invalid analysis schema, using fallback');
      return getFallbackAnalysis(file);
    }

    return analysis;
  } catch (err) {
    console.error('[File Processor] Gemini error:', err.message);
    return getFallbackAnalysis(file);
  }
}

/**
 * Build Gemini contents for inline_data (images, PDFs, DOCX).
 */
async function buildInlineDataContents(file) {
  const fileBuffer = await fs.readFile(file.path);
  const base64Data = fileBuffer.toString('base64');

  return [
    {
      role: 'user',
      parts: [
        {
          inline_data: {
            mime_type: file.mimetype,
            data: base64Data,
          },
        },
        { text: ANALYSIS_PROMPT },
      ],
    },
  ];
}

/**
 * Build Gemini contents for text files (.txt, .md, .csv).
 */
async function buildTextContents(file) {
  let textContent = await fs.readFile(file.path, 'utf-8');

  // Truncate large text files to avoid token limits
  const MAX_CHARS = 50000;
  if (textContent.length > MAX_CHARS) {
    textContent = textContent.substring(0, MAX_CHARS) + '\n\n[... truncated ...]';
  }

  return [
    {
      role: 'user',
      parts: [
        { text: `File: ${file.originalname} (${file.mimetype})\n\n${textContent}\n\n${ANALYSIS_PROMPT}` },
      ],
    },
  ];
}

/**
 * Fallback analysis if Gemini fails or is unavailable.
 */
function getFallbackAnalysis(file) {
  const category = determineCategoryFromMime(file.mimetype);
  const topic = file.originalname.split('.')[0].replace(/[-_]/g, ' ').toLowerCase();

  return {
    summary: `Uploaded file: ${file.originalname}. Type: ${file.mimetype}.`,
    key_topics: [topic, 'uploaded-document'],
    suggested_tasks: [`Review uploaded file: ${file.originalname}`],
    suggested_agents: ['jarvis'],
    category: category,
  };
}

/**
 * Infer category from MIME type.
 */
function determineCategoryFromMime(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype === 'application/pdf') return 'document';
  if (mimetype.includes('spreadsheet') || mimetype.includes('csv')) return 'data';
  if (mimetype.includes('wordprocessingml') || mimetype === 'text/plain') return 'document';
  if (mimetype === 'text/markdown') return 'document';
  return 'document';
}

// ── Vault Markdown Builder ───────────────────────────────────────────────────

/**
 * Generate markdown content for vault storage.
 */
function buildVaultMarkdown(file, analysis, storedFilename) {
  const timestamp = new Date().toISOString();
  const sizeKB = (file.size / 1024).toFixed(1);

  const topicsSection = analysis.key_topics.length > 0
    ? analysis.key_topics.map(t => `- ${t}`).join('\n')
    : '- (none)';

  const tasksSection = analysis.suggested_tasks.length > 0
    ? analysis.suggested_tasks.map(t => `- [ ] ${t}`).join('\n')
    : '- [ ] Review this uploaded file';

  const agentsSection = analysis.suggested_agents.length > 0
    ? analysis.suggested_agents.map(a => `- [[${a}]]`).join('\n')
    : '- [[jarvis]]';

  return `# Uploaded: ${file.originalname}

**Uploaded:** ${timestamp}
**Type:** ${file.mimetype}
**Size:** ${sizeKB} KB
**Stored as:** ${storedFilename}
**Category:** ${analysis.category}

## Summary

${analysis.summary}

## Key Topics

${topicsSection}

## Suggested Tasks

${tasksSection}

## Suggested Agents

${agentsSection}

---
*Auto-generated by AI Boardroom file ingestion pipeline*
`;
}
