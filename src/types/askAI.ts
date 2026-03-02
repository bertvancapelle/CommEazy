/**
 * Ask AI Module — Type Definitions
 *
 * Types for the AI assistant module powered by Google Gemini.
 * Conversations are stored on-device only (zero server storage).
 *
 * @see .claude/plans/VRAAG_HET_AI_MODULE.md
 */

/**
 * A single message in a conversation
 */
export interface AskAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * A complete conversation with all messages
 */
export interface AskAIConversation {
  id: string;
  messages: AskAIMessage[];
  createdAt: number;
  updatedAt: number;
  /** Auto-generated from first user question */
  title: string;
}

/**
 * Summary of a conversation for the history list
 */
export interface AskAIConversationSummary {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: number;
  messageCount: number;
}

/**
 * Gemini API error with status code
 */
export class GeminiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'GeminiError';
    this.statusCode = statusCode;
  }
}

/**
 * Library counts from Gemini API response
 */
export interface GeminiCandidate {
  content: {
    parts: Array<{ text: string }>;
    role: string;
  };
  finishReason: string;
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}
