/**
 * Gemini API Service — Google Gemini AI communication
 *
 * Handles sending messages to Google Gemini API and receiving responses.
 * Uses OAuth2 access tokens from Google Sign-In for authentication.
 *
 * @see .claude/plans/VRAAG_HET_AI_MODULE.md
 */

import type { AskAIMessage, GeminiResponse, GeminiError } from '@/types/askAI';
import { SENIOR_SYSTEM_PROMPT } from './seniorPrompt';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.0-flash';

/** Maximum messages to include for context (prevents token overflow) */
const MAX_CONTEXT_MESSAGES = 10;

/** Maximum output tokens per response (keeps answers concise for seniors) */
const MAX_OUTPUT_TOKENS = 1024;

/**
 * Send messages to Gemini API and get a response
 *
 * @param messages - Conversation messages (will be trimmed to last 10)
 * @param accessToken - OAuth2 access token from Google Sign-In
 * @returns AI response text
 * @throws GeminiError on API failure
 */
export async function sendToGemini(
  messages: AskAIMessage[],
  accessToken: string,
): Promise<string> {
  // Trim to last N messages for context window management
  const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);

  const response = await fetch(
    `${GEMINI_API_URL}/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SENIOR_SYSTEM_PROMPT }],
        },
        contents: recentMessages.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0.7,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
        ],
      }),
    },
  );

  const data: GeminiResponse = await response.json();

  if (!response.ok) {
    const errorMessage = data.error?.message || 'Unknown Gemini API error';
    const error = new Error(errorMessage) as any;
    error.name = 'GeminiError';
    error.statusCode = response.status;
    throw error;
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const error = new Error('Empty response from Gemini') as any;
    error.name = 'GeminiError';
    error.statusCode = 200;
    throw error;
  }

  return text;
}
