/**
 * AskAIContext — State management for the AI assistant module
 *
 * Manages:
 * - Google account linking (OAuth2 for Gemini API access)
 * - Current conversation state
 * - Conversation history (persisted to AsyncStorage)
 * - Message sending and receiving
 *
 * Zero server storage: All conversations stored on-device only.
 *
 * @see .claude/plans/VRAAG_HET_AI_MODULE.md
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

import { sendToGemini } from '@/services/gemini';
import type {
  AskAIMessage,
  AskAIConversation,
  AskAIConversationSummary,
} from '@/types/askAI';

// ============================================================
// Constants
// ============================================================

const STORAGE_KEYS = {
  CONVERSATIONS_INDEX: '@commeazy/askai_conversations',
  CONVERSATION_PREFIX: '@commeazy/askai_conv_',
  CURRENT_CONVERSATION: '@commeazy/askai_current',
  GOOGLE_LINKED: '@commeazy/google_linked',
  GOOGLE_ACCESS_TOKEN: '@commeazy/google_access_token',
} as const;

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 100;

// Google OAuth Web Client ID — configure in Google Cloud Console
// This must be an OAuth 2.0 Client ID with Gemini API scopes
// TODO: Replace with production client ID from Google Cloud Console
const GOOGLE_WEB_CLIENT_ID = '';

// ============================================================
// Context Type
// ============================================================

export interface AskAIContextValue {
  // Auth state
  isGoogleLinked: boolean;
  isLinking: boolean;
  linkGoogleAccount: () => Promise<void>;

  // Current conversation
  currentConversation: AskAIConversation | null;
  messages: AskAIMessage[];
  isLoading: boolean;
  error: string | null;
  dismissError: () => void;

  // Chat actions
  sendMessage: (text: string) => Promise<void>;
  startNewConversation: () => void;

  // History
  conversations: AskAIConversationSummary[];
  loadConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  clearAllConversations: () => Promise<void>;
}

const AskAIContext = createContext<AskAIContextValue | null>(null);

// ============================================================
// Helper Functions
// ============================================================

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function createConversationTitle(firstMessage: string): string {
  // Truncate to first 50 characters of user's first question
  const title = firstMessage.substring(0, 50);
  return title.length < firstMessage.length ? `${title}...` : title;
}

function createSummary(conversation: AskAIConversation): AskAIConversationSummary {
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  return {
    id: conversation.id,
    title: conversation.title,
    lastMessage: lastMsg?.content.substring(0, 80) || '',
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
  };
}

// ============================================================
// Provider
// ============================================================

interface AskAIProviderProps {
  children: ReactNode;
}

export function AskAIProvider({ children }: AskAIProviderProps) {
  const { t } = useTranslation();

  // Auth state
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Conversation state
  const [currentConversation, setCurrentConversation] = useState<AskAIConversation | null>(null);
  const [conversations, setConversations] = useState<AskAIConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref for stable access in callbacks
  const currentConvRef = useRef(currentConversation);
  currentConvRef.current = currentConversation;

  // ============================================================
  // Initialization
  // ============================================================

  useEffect(() => {
    configureGoogleSignIn();
    loadInitialState();
  }, []);

  const configureGoogleSignIn = useCallback(async () => {
    try {
      const module = await import('@react-native-google-signin/google-signin');
      module.GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
        offlineAccess: true,
        scopes: ['https://www.googleapis.com/auth/generative-language'],
      });
    } catch {
      // Package not installed — will use mock fallback in linkGoogleAccount
      console.debug('[AskAIContext] Google Sign-In not available, using mock');
    }
  }, []);

  const loadInitialState = useCallback(async () => {
    try {
      // Check if Google account is linked
      const linked = await AsyncStorage.getItem(STORAGE_KEYS.GOOGLE_LINKED);
      setIsGoogleLinked(linked === 'true');

      // Load saved access token
      const token = await AsyncStorage.getItem(STORAGE_KEYS.GOOGLE_ACCESS_TOKEN);
      if (token) setAccessToken(token);

      // Load conversation index
      const indexJson = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS_INDEX);
      if (indexJson) {
        const summaries: AskAIConversationSummary[] = JSON.parse(indexJson);
        setConversations(summaries);
      }

      // Load current conversation if any
      const currentId = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION);
      if (currentId) {
        const convJson = await AsyncStorage.getItem(
          STORAGE_KEYS.CONVERSATION_PREFIX + currentId,
        );
        if (convJson) {
          setCurrentConversation(JSON.parse(convJson));
        }
      }
    } catch (err) {
      console.warn('[AskAIContext] Failed to load initial state:', (err as Error).message);
    }
  }, []);

  // ============================================================
  // Auth: Google Account Linking
  // ============================================================

  const linkGoogleAccount = useCallback(async () => {
    try {
      setIsLinking(true);
      setError(null);

      // Dynamic import to avoid crash when package is not yet installed
      let GoogleSignin: any;
      try {
        const module = await import(
          '@react-native-google-signin/google-signin'
        );
        GoogleSignin = module.GoogleSignin;
      } catch {
        // Package not installed yet — use mock for development
        console.warn('[AskAIContext] Google Sign-In not installed, using mock');
        await AsyncStorage.setItem(STORAGE_KEYS.GOOGLE_LINKED, 'true');
        await AsyncStorage.setItem(STORAGE_KEYS.GOOGLE_ACCESS_TOKEN, 'mock-token');
        setIsGoogleLinked(true);
        setAccessToken('mock-token');
        return;
      }

      // Real Google Sign-In flow (v14.x API: signIn returns { type, data })
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      // v14.x: cancelled sign-in returns { type: 'cancelled' } instead of throwing
      if (response.type === 'cancelled') {
        return; // User cancelled — not an error
      }

      const userData = response.data;

      // Get tokens for API access
      const tokens = await GoogleSignin.getTokens();
      const token = tokens.accessToken;

      // Optionally link to Firebase
      try {
        const firebaseAuth = await import('@react-native-firebase/auth');
        const auth = firebaseAuth.default;
        const googleCredential = auth.GoogleAuthProvider.credential(userData.idToken);
        const currentUser = auth().currentUser;
        if (currentUser) {
          await currentUser.linkWithCredential(googleCredential);
        }
      } catch (linkErr: any) {
        // If already linked, that's fine
        if (linkErr.code !== 'auth/provider-already-linked') {
          console.warn('[AskAIContext] Firebase link skipped:', linkErr.code);
        }
      }

      // Persist linked status and token
      await AsyncStorage.setItem(STORAGE_KEYS.GOOGLE_LINKED, 'true');
      await AsyncStorage.setItem(STORAGE_KEYS.GOOGLE_ACCESS_TOKEN, token);
      setIsGoogleLinked(true);
      setAccessToken(token);
    } catch (err: any) {
      if (err.code === 'auth/credential-already-in-use') {
        setError(t('modules.askAI.errors.accountAlreadyLinked'));
      } else {
        setError(t('modules.askAI.errors.linkFailed'));
      }
    } finally {
      setIsLinking(false);
    }
  }, [t]);

  // ============================================================
  // Token Refresh
  // ============================================================

  const getValidToken = useCallback(async (): Promise<string> => {
    // Try dynamic import for real token refresh
    try {
      const module = await import('@react-native-google-signin/google-signin');
      const tokens = await module.GoogleSignin.getTokens();
      const token = tokens.accessToken;
      await AsyncStorage.setItem(STORAGE_KEYS.GOOGLE_ACCESS_TOKEN, token);
      setAccessToken(token);
      return token;
    } catch {
      // Fallback to stored token
      if (accessToken) return accessToken;
      throw new Error('No valid token available');
    }
  }, [accessToken]);

  // ============================================================
  // Conversation Persistence
  // ============================================================

  const saveConversation = useCallback(
    async (conversation: AskAIConversation) => {
      try {
        // Save full conversation
        await AsyncStorage.setItem(
          STORAGE_KEYS.CONVERSATION_PREFIX + conversation.id,
          JSON.stringify(conversation),
        );

        // Update or add to index
        setConversations((prev) => {
          const existing = prev.findIndex((s) => s.id === conversation.id);
          const summary = createSummary(conversation);
          let updated: AskAIConversationSummary[];

          if (existing >= 0) {
            updated = [...prev];
            updated[existing] = summary;
          } else {
            updated = [summary, ...prev];
          }

          // Enforce max conversations limit
          if (updated.length > MAX_CONVERSATIONS) {
            const removed = updated.splice(MAX_CONVERSATIONS);
            // Clean up old conversations in background
            removed.forEach((old) => {
              AsyncStorage.removeItem(
                STORAGE_KEYS.CONVERSATION_PREFIX + old.id,
              ).catch(() => {});
            });
          }

          // Persist index
          AsyncStorage.setItem(
            STORAGE_KEYS.CONVERSATIONS_INDEX,
            JSON.stringify(updated),
          ).catch(() => {});

          return updated;
        });

        // Save current conversation ID
        await AsyncStorage.setItem(
          STORAGE_KEYS.CURRENT_CONVERSATION,
          conversation.id,
        );
      } catch (err) {
        console.warn('[AskAIContext] Failed to save conversation:', (err as Error).message);
      }
    },
    [],
  );

  // ============================================================
  // Chat Actions
  // ============================================================

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      setError(null);
      setIsLoading(true);

      try {
        const token = await getValidToken();

        // Create or use existing conversation
        let conversation = currentConvRef.current;
        if (!conversation) {
          conversation = {
            id: generateId(),
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            title: createConversationTitle(text),
          };
        }

        // Add user message
        const userMessage: AskAIMessage = {
          id: generateId(),
          role: 'user',
          content: text.trim(),
          timestamp: Date.now(),
        };

        const updatedMessages = [...conversation.messages, userMessage];

        // Enforce max messages
        const trimmedMessages =
          updatedMessages.length > MAX_MESSAGES_PER_CONVERSATION
            ? updatedMessages.slice(-MAX_MESSAGES_PER_CONVERSATION)
            : updatedMessages;

        // Update state with user message immediately
        const convWithUserMsg: AskAIConversation = {
          ...conversation,
          messages: trimmedMessages,
          updatedAt: Date.now(),
        };
        setCurrentConversation(convWithUserMsg);
        currentConvRef.current = convWithUserMsg;

        // Send to Gemini API
        const responseText = await sendToGemini(trimmedMessages, token);

        // Add AI response
        const aiMessage: AskAIMessage = {
          id: generateId(),
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
        };

        const finalMessages = [...trimmedMessages, aiMessage];
        const finalConversation: AskAIConversation = {
          ...convWithUserMsg,
          messages: finalMessages,
          updatedAt: Date.now(),
        };

        setCurrentConversation(finalConversation);
        currentConvRef.current = finalConversation;
        await saveConversation(finalConversation);
      } catch (err: any) {
        if (err.statusCode === 429) {
          setError(t('modules.askAI.errors.rateLimited'));
        } else if (err.message?.includes('network') || err.message?.includes('Network')) {
          setError(t('modules.askAI.errors.networkError'));
        } else {
          setError(t('modules.askAI.errors.sendFailed'));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [getValidToken, saveConversation, t],
  );

  const startNewConversation = useCallback(() => {
    setCurrentConversation(null);
    currentConvRef.current = null;
    setError(null);
    AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION).catch(() => {});
  }, []);

  // ============================================================
  // History Actions
  // ============================================================

  const loadConversation = useCallback(async (id: string) => {
    try {
      const convJson = await AsyncStorage.getItem(
        STORAGE_KEYS.CONVERSATION_PREFIX + id,
      );
      if (convJson) {
        const conversation: AskAIConversation = JSON.parse(convJson);
        setCurrentConversation(conversation);
        currentConvRef.current = conversation;
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION, id);
      }
    } catch (err) {
      console.warn('[AskAIContext] Failed to load conversation:', (err as Error).message);
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CONVERSATION_PREFIX + id);

      setConversations((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        AsyncStorage.setItem(
          STORAGE_KEYS.CONVERSATIONS_INDEX,
          JSON.stringify(updated),
        ).catch(() => {});
        return updated;
      });

      // If deleting the current conversation, clear it
      if (currentConvRef.current?.id === id) {
        setCurrentConversation(null);
        currentConvRef.current = null;
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION);
      }
    } catch (err) {
      console.warn('[AskAIContext] Failed to delete conversation:', (err as Error).message);
    }
  }, []);

  const clearAllConversations = useCallback(async () => {
    try {
      // Get all conversation IDs to clean up
      const indexJson = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS_INDEX);
      if (indexJson) {
        const summaries: AskAIConversationSummary[] = JSON.parse(indexJson);
        // Remove all conversation data
        await Promise.all(
          summaries.map((s) =>
            AsyncStorage.removeItem(STORAGE_KEYS.CONVERSATION_PREFIX + s.id),
          ),
        );
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.CONVERSATIONS_INDEX);
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION);

      setConversations([]);
      setCurrentConversation(null);
      currentConvRef.current = null;
    } catch (err) {
      console.warn('[AskAIContext] Failed to clear conversations:', (err as Error).message);
    }
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  // ============================================================
  // Context Value
  // ============================================================

  const messages = currentConversation?.messages || [];

  const contextValue: AskAIContextValue = {
    isGoogleLinked,
    isLinking,
    linkGoogleAccount,
    currentConversation,
    messages,
    isLoading,
    error,
    dismissError,
    sendMessage,
    startNewConversation,
    conversations,
    loadConversation,
    deleteConversation,
    clearAllConversations,
  };

  return (
    <AskAIContext.Provider value={contextValue}>
      {children}
    </AskAIContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useAskAI(): AskAIContextValue {
  const context = useContext(AskAIContext);
  if (!context) {
    throw new Error('useAskAI must be used within an AskAIProvider');
  }
  return context;
}

/**
 * Safe hook that returns null when used outside provider
 * Useful for components that may exist outside the AskAI module
 */
export function useAskAISafe(): AskAIContextValue | null {
  return useContext(AskAIContext);
}
