/**
 * useVoiceCommands — Voice Command Recognition Hook
 *
 * Provides voice command functionality for hands-free navigation:
 * - Activated via two-finger long press (same timing as hold-to-navigate)
 * - Supports commands in 5 languages (NL, EN, DE, FR, ES)
 * - Matches spoken commands to navigation destinations
 *
 * Voice commands:
 * - Navigation: "berichten", "contacten", "groepen", "instellingen", etc.
 * - Actions: "bel [naam]", "stuur bericht naar [naam]"
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ServiceContainer } from '@/services/container';
import type { NavigationDestination } from '@/components/WheelNavigationMenu';

// Voice command result
export interface VoiceCommandResult {
  type: 'navigation' | 'action' | 'unknown';
  destination?: NavigationDestination;
  action?: 'call' | 'message';
  contactName?: string;
  rawText: string;
  confidence: number;
}

// Voice command state
export interface VoiceCommandState {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  error: string | null;
  lastResult: VoiceCommandResult | null;
}

// Voice command settings (persisted in user profile)
export interface VoiceCommandSettings {
  enabled: boolean;
  language: string; // Auto-detected from app language
}

// Default settings
export const DEFAULT_VOICE_SETTINGS: VoiceCommandSettings = {
  enabled: true,  // Default ON - users can disable if needed
  language: 'nl-NL',
};

// Command patterns for each language
// Format: { pattern: regex, destination: NavigationDestination }
const NAVIGATION_COMMANDS: Record<string, Array<{ patterns: string[]; destination: NavigationDestination }>> = {
  nl: [
    // Chats/Messages - various natural phrasings
    { patterns: ['berichten', 'chats', 'gesprekken', 'chat', 'bericht'], destination: 'chats' },
    // Contacts
    { patterns: ['contacten', 'contact', 'personen', 'adresboek'], destination: 'contacts' },
    // Groups
    { patterns: ['groepen', 'groep', 'groepsgesprek'], destination: 'groups' },
    // Settings - many variations including "open instellingen menu"
    { patterns: ['instellingen', 'instelling', 'settings', 'opties', 'configuratie', 'voorkeuren'], destination: 'settings' },
    // Calls
    { patterns: ['bellen', 'telefoon', 'telefoneren', 'oproep', 'oproepen'], destination: 'calls' },
    // Video calls
    { patterns: ['video', 'videobellen', 'videogesprek', 'videocall'], destination: 'videocall' },
    // E-book
    { patterns: ['boek', 'lezen', 'e-book', 'ebook', 'boeken'], destination: 'ebook' },
    // Audiobook
    { patterns: ['luisterboek', 'audioboek', 'luisteren', 'luisterboeken'], destination: 'audiobook' },
    // Podcast
    { patterns: ['podcast', 'podcasts'], destination: 'podcast' },
    // Help
    { patterns: ['help', 'hulp', 'assistentie', 'ondersteuning'], destination: 'help' },
  ],
  en: [
    { patterns: ['messages', 'chats', 'conversations', 'chat'], destination: 'chats' },
    { patterns: ['contacts', 'contact', 'people'], destination: 'contacts' },
    { patterns: ['groups', 'group'], destination: 'groups' },
    { patterns: ['settings', 'options', 'preferences'], destination: 'settings' },
    { patterns: ['call', 'phone', 'calling'], destination: 'calls' },
    { patterns: ['video', 'video call', 'facetime'], destination: 'videocall' },
    { patterns: ['book', 'read', 'e-book', 'ebook'], destination: 'ebook' },
    { patterns: ['audiobook', 'audio book', 'listen'], destination: 'audiobook' },
    { patterns: ['podcast', 'podcasts'], destination: 'podcast' },
    { patterns: ['help', 'assistance', 'support'], destination: 'help' },
  ],
  de: [
    { patterns: ['nachrichten', 'chats', 'gespräche', 'chat'], destination: 'chats' },
    { patterns: ['kontakte', 'kontakt', 'personen'], destination: 'contacts' },
    { patterns: ['gruppen', 'gruppe'], destination: 'groups' },
    { patterns: ['einstellungen', 'optionen'], destination: 'settings' },
    { patterns: ['anrufen', 'telefon', 'telefonieren'], destination: 'calls' },
    { patterns: ['video', 'videoanruf', 'videogespräch'], destination: 'videocall' },
    { patterns: ['buch', 'lesen', 'e-book', 'ebook'], destination: 'ebook' },
    { patterns: ['hörbuch', 'audiobook', 'hören'], destination: 'audiobook' },
    { patterns: ['podcast', 'podcasts'], destination: 'podcast' },
    { patterns: ['hilfe', 'unterstützung'], destination: 'help' },
  ],
  fr: [
    { patterns: ['messages', 'chats', 'conversations', 'chat'], destination: 'chats' },
    { patterns: ['contacts', 'contact', 'personnes'], destination: 'contacts' },
    { patterns: ['groupes', 'groupe'], destination: 'groups' },
    { patterns: ['paramètres', 'réglages', 'options'], destination: 'settings' },
    { patterns: ['appeler', 'téléphone', 'appel'], destination: 'calls' },
    { patterns: ['vidéo', 'appel vidéo', 'visio'], destination: 'videocall' },
    { patterns: ['livre', 'lire', 'e-book', 'ebook'], destination: 'ebook' },
    { patterns: ['livre audio', 'audiobook', 'écouter'], destination: 'audiobook' },
    { patterns: ['podcast', 'podcasts'], destination: 'podcast' },
    { patterns: ['aide', 'assistance', 'support'], destination: 'help' },
  ],
  es: [
    { patterns: ['mensajes', 'chats', 'conversaciones', 'chat'], destination: 'chats' },
    { patterns: ['contactos', 'contacto', 'personas'], destination: 'contacts' },
    { patterns: ['grupos', 'grupo'], destination: 'groups' },
    { patterns: ['ajustes', 'configuración', 'opciones'], destination: 'settings' },
    { patterns: ['llamar', 'teléfono', 'llamada'], destination: 'calls' },
    { patterns: ['video', 'videollamada'], destination: 'videocall' },
    { patterns: ['libro', 'leer', 'e-book', 'ebook'], destination: 'ebook' },
    { patterns: ['audiolibro', 'audiobook', 'escuchar'], destination: 'audiobook' },
    { patterns: ['podcast', 'podcasts'], destination: 'podcast' },
    { patterns: ['ayuda', 'asistencia', 'soporte'], destination: 'help' },
  ],
};

// Action patterns (call/message someone)
const ACTION_PATTERNS: Record<string, { call: string[]; message: string[] }> = {
  nl: {
    call: ['bel', 'bellen naar', 'bel met'],
    message: ['stuur bericht naar', 'bericht naar', 'stuur naar', 'message naar'],
  },
  en: {
    call: ['call', 'phone', 'dial'],
    message: ['message', 'text', 'send message to', 'send to'],
  },
  de: {
    call: ['ruf an', 'anrufen', 'telefonieren mit'],
    message: ['nachricht an', 'schreibe an', 'sende nachricht an'],
  },
  fr: {
    call: ['appelle', 'appeler', 'téléphone à'],
    message: ['message à', 'envoie message à', 'écris à'],
  },
  es: {
    call: ['llama a', 'llamar a', 'telefonea a'],
    message: ['mensaje a', 'envía mensaje a', 'escribe a'],
  },
};

/**
 * Parse spoken text and match to commands
 */
function parseVoiceCommand(text: string, language: string): VoiceCommandResult {
  const normalizedText = text.toLowerCase().trim();
  const langCode = language.split('-')[0] || 'nl';

  // Try navigation commands first
  const navCommands = NAVIGATION_COMMANDS[langCode] || NAVIGATION_COMMANDS.nl;
  for (const { patterns, destination } of navCommands) {
    for (const pattern of patterns) {
      if (normalizedText.includes(pattern)) {
        return {
          type: 'navigation',
          destination,
          rawText: text,
          confidence: 1.0,
        };
      }
    }
  }

  // Try action commands (call/message)
  const actionPatterns = ACTION_PATTERNS[langCode] || ACTION_PATTERNS.nl;

  // Check for call action
  for (const pattern of actionPatterns.call) {
    if (normalizedText.startsWith(pattern)) {
      const contactName = normalizedText.replace(pattern, '').trim();
      if (contactName) {
        return {
          type: 'action',
          action: 'call',
          contactName,
          rawText: text,
          confidence: 0.9,
        };
      }
    }
  }

  // Check for message action
  for (const pattern of actionPatterns.message) {
    if (normalizedText.startsWith(pattern)) {
      const contactName = normalizedText.replace(pattern, '').trim();
      if (contactName) {
        return {
          type: 'action',
          action: 'message',
          contactName,
          rawText: text,
          confidence: 0.9,
        };
      }
    }
  }

  // Unknown command
  return {
    type: 'unknown',
    rawText: text,
    confidence: 0,
  };
}

/**
 * Voice commands hook
 */
export function useVoiceCommands() {
  const { i18n } = useTranslation();

  const [settings, setSettings] = useState<VoiceCommandSettings>(DEFAULT_VOICE_SETTINGS);
  const [state, setState] = useState<VoiceCommandState>({
    isListening: false,
    isProcessing: false,
    transcript: '',
    error: null,
    lastResult: null,
  });

  // Native speech recognition module reference
  const speechRecognitionRef = useRef<any>(null);
  const eventEmitterRef = useRef<NativeEventEmitter | null>(null);

  // Use ref for language to avoid stale closure in event listeners
  const languageRef = useRef(settings.language);
  useEffect(() => {
    languageRef.current = settings.language;
  }, [settings.language]);

  // Store last valid partial result - iOS often returns empty final results
  const lastPartialResultRef = useRef<string>('');

  // Callback ref for when a result is ready - allows immediate execution without waiting for re-render
  // IMPORTANT: This callback should trigger navigation AND close the overlay
  const onResultReadyRef = useRef<((result: VoiceCommandResult) => void) | null>(null);

  // Track if we've already called the callback for this session to prevent duplicates
  const callbackFiredRef = useRef(false);

  // Load settings from database on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        if (!ServiceContainer.isInitialized) {
          return;
        }

        const profile = await ServiceContainer.database.getUserProfile();
        if (profile) {
          setSettings({
            enabled: profile.voiceCommandsEnabled ?? DEFAULT_VOICE_SETTINGS.enabled,
            language: getLanguageCode(i18n.language),
          });
        }
      } catch (error) {
        console.error('[useVoiceCommands] Failed to load settings:', error);
      }
    }

    void loadSettings();
  }, [i18n.language]);

  // Update language when app language changes
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      language: getLanguageCode(i18n.language),
    }));
  }, [i18n.language]);

  // Initialize speech recognition and set up event listeners
  useEffect(() => {
    if (Platform.OS === 'ios') {
      // iOS uses SFSpeechRecognizer via native module
      const { SpeechRecognition } = NativeModules;
      if (SpeechRecognition) {
        speechRecognitionRef.current = SpeechRecognition;
        eventEmitterRef.current = new NativeEventEmitter(SpeechRecognition);

        // Set up event listeners
        const onSpeechStart = eventEmitterRef.current.addListener('onSpeechStart', () => {
          setState(prev => ({
            ...prev,
            isListening: true,
            isProcessing: false,
            error: null,
          }));
        });

        const onSpeechEnd = eventEmitterRef.current.addListener('onSpeechEnd', () => {
          setState(prev => ({
            ...prev,
            isListening: false,
          }));
        });

        const onSpeechPartialResults = eventEmitterRef.current.addListener('onSpeechPartialResults', (event) => {
          // Store valid partial results - iOS often returns empty final results
          if (event.transcript && event.transcript.trim()) {
            lastPartialResultRef.current = event.transcript;

            // HIGH-CONFIDENCE PARTIAL RESULT PROCESSING
            // If we have high confidence (≥0.8), process immediately for faster response
            const confidence = event.confidence || 0;
            if (confidence >= 0.8 && !callbackFiredRef.current) {
              const result = parseVoiceCommand(event.transcript, languageRef.current);

              // Only process navigation/action commands with high confidence
              if ((result.type === 'navigation' || result.type === 'action') && onResultReadyRef.current) {
                callbackFiredRef.current = true;
                setState({
                  isListening: false,
                  isProcessing: false,
                  transcript: event.transcript,
                  error: null,
                  lastResult: result,
                });
                onResultReadyRef.current(result);
                return;
              }
            }
          }
          setState(prev => ({
            ...prev,
            transcript: event.transcript,
          }));
        });

        const onSpeechResults = eventEmitterRef.current.addListener('onSpeechResults', (event) => {
          // Use final result if available, otherwise fall back to last partial result
          const transcriptToUse = (event.transcript && event.transcript.trim())
            ? event.transcript
            : lastPartialResultRef.current;

          const result = parseVoiceCommand(transcriptToUse, languageRef.current);
          lastPartialResultRef.current = '';

          setState({
            isListening: false,
            isProcessing: false,
            transcript: transcriptToUse,
            error: null,
            lastResult: result,
          });

          // Call the callback if registered and not already fired
          if (onResultReadyRef.current && !callbackFiredRef.current && (result.type === 'navigation' || result.type === 'action')) {
            callbackFiredRef.current = true;
            onResultReadyRef.current(result);
          }
        });

        const onSpeechError = eventEmitterRef.current.addListener('onSpeechError', (event) => {
          // Ignore cancellation errors - these are expected when user closes overlay
          const ignoredCodes = ['201', '216', '301', '1110'];
          if (ignoredCodes.includes(event.code)) {
            // If we have a partial result when cancelled, process it
            if (lastPartialResultRef.current) {
              const transcriptToUse = lastPartialResultRef.current;
              const result = parseVoiceCommand(transcriptToUse, languageRef.current);
              lastPartialResultRef.current = '';

              setState({
                isListening: false,
                isProcessing: false,
                transcript: transcriptToUse,
                error: null,
                lastResult: result,
              });

              if (onResultReadyRef.current && !callbackFiredRef.current && (result.type === 'navigation' || result.type === 'action')) {
                callbackFiredRef.current = true;
                onResultReadyRef.current(result);
              }
              return;
            }

            // No partial result, just clean up
            lastPartialResultRef.current = '';
            setState(prev => ({
              ...prev,
              isListening: false,
              isProcessing: false,
            }));
            return;
          }

          console.error('[useVoiceCommands] Speech error:', event);
          lastPartialResultRef.current = '';
          setState(prev => ({
            ...prev,
            isListening: false,
            isProcessing: false,
            error: event.error || 'Speech recognition error',
          }));
        });

        // Store listeners for cleanup
        return () => {
          onSpeechStart.remove();
          onSpeechEnd.remove();
          onSpeechPartialResults.remove();
          onSpeechResults.remove();
          onSpeechError.remove();
        };
      }
    }
    // Android would use similar setup with native module

    return () => {
      // Cleanup
    };
  }, []); // Remove settings.language dependency - we use languageRef instead

  /**
   * Start listening for voice commands
   */
  const startListening = useCallback(async () => {
    if (!settings.enabled || state.isListening) return;

    // Clear previous state
    lastPartialResultRef.current = '';
    callbackFiredRef.current = false;

    setState(prev => ({
      ...prev,
      isListening: true,
      isProcessing: false,
      transcript: '',
      error: null,
      lastResult: null,
    }));

    try {
      if (Platform.OS === 'ios' && speechRecognitionRef.current) {
        const permissions = await speechRecognitionRef.current.requestPermissions();

        if (!permissions.speechRecognition || !permissions.microphone) {
          setState(prev => ({
            ...prev,
            error: 'Spraakherkenning vereist microfoon- en spraakherkenningsrechten',
            isListening: false,
          }));
          return;
        }

        speechRecognitionRef.current.startListening(settings.language);
      } else {
        setState(prev => ({
          ...prev,
          error: 'Spraakherkenning is niet beschikbaar op dit apparaat',
          isListening: false,
        }));
      }
    } catch (error) {
      console.error('[useVoiceCommands] Failed to start listening:', error);
      setState(prev => ({
        ...prev,
        error: 'Kan spraakherkenning niet starten',
        isListening: false,
      }));
    }
  }, [settings.enabled, settings.language, state.isListening]);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    if (!state.isListening) {
      return;
    }

    setState(prev => ({
      ...prev,
      isListening: false,
      isProcessing: true,
    }));

    try {
      if (Platform.OS === 'ios' && speechRecognitionRef.current) {
        speechRecognitionRef.current.stopListening();
      }
    } catch (error) {
      console.error('[useVoiceCommands] Failed to stop listening:', error);
    }
  }, [state.isListening]);

  /**
   * Process recognized speech
   */
  const processTranscript = useCallback((transcript: string) => {
    if (!transcript.trim()) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: 'No speech detected',
      }));
      return null;
    }

    const result = parseVoiceCommand(transcript, settings.language);

    setState(prev => ({
      ...prev,
      isProcessing: false,
      transcript,
      lastResult: result,
    }));

    return result;
  }, [settings.language]);

  /**
   * Update voice commands enabled setting
   */
  const updateEnabled = useCallback(async (enabled: boolean) => {
    setSettings(prev => ({ ...prev, enabled }));

    try {
      if (!ServiceContainer.isInitialized) return;

      const profile = await ServiceContainer.database.getUserProfile();
      if (profile) {
        await ServiceContainer.database.saveUserProfile({
          ...profile,
          voiceCommandsEnabled: enabled,
        });
      }
    } catch (error) {
      console.error('[useVoiceCommands] Failed to save enabled setting:', error);
    }
  }, []);

  /**
   * Clear the current state
   */
  const clearState = useCallback(() => {
    setState({
      isListening: false,
      isProcessing: false,
      transcript: '',
      error: null,
      lastResult: null,
    });
  }, []);

  /**
   * Register a callback to be called when a navigation/action result is ready
   * This bypasses React's state batching and calls the callback directly
   */
  const setOnResultReady = useCallback((callback: ((result: VoiceCommandResult) => void) | null) => {
    onResultReadyRef.current = callback;
    if (callback) {
      callbackFiredRef.current = false;
    }
  }, []);

  return {
    settings,
    state,
    startListening,
    stopListening,
    processTranscript,
    updateEnabled,
    clearState,
    setOnResultReady,
  };
}

/**
 * Get proper language code for speech recognition
 */
function getLanguageCode(language: string): string {
  const langMap: Record<string, string> = {
    nl: 'nl-NL',
    en: 'en-US',
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
  };
  return langMap[language] || 'nl-NL';
}

// Export command patterns for testing
export const VOICE_COMMAND_PATTERNS = {
  NAVIGATION_COMMANDS,
  ACTION_PATTERNS,
};
