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

// Mic indicator position type
export type MicIndicatorPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// Session control action type
export type SessionAction = 'stop' | 'next' | 'previous' | 'back' | 'select' | 'send';

// Voice command result
export interface VoiceCommandResult {
  type: 'navigation' | 'action' | 'session_control' | 'position_change' | 'unknown';
  destination?: NavigationDestination;
  action?: 'call' | 'message';
  sessionAction?: SessionAction;
  position?: MicIndicatorPosition;
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

// Session control commands (for Voice Session Mode)
// These control list navigation via VoiceFocusContext
const SESSION_COMMANDS: Record<string, Array<{ patterns: string[]; action: SessionAction }>> = {
  nl: [
    { patterns: ['stop', 'stoppen', 'klaar', 'sluit', 'stop opnemen', 'einde'], action: 'stop' },
    { patterns: ['volgende', 'verder', 'vooruit'], action: 'next' },
    { patterns: ['vorige', 'terug naar vorige'], action: 'previous' },
    { patterns: ['terug', 'ga terug', 'naar terug'], action: 'back' },
    { patterns: ['open', 'kies', 'selecteer'], action: 'select' },
    { patterns: ['stuur', 'verzend', 'verstuur', 'stuur bericht', 'verzenden'], action: 'send' },
  ],
  en: [
    { patterns: ['stop', 'done', 'finish', 'close', 'exit', 'stop recording', 'end'], action: 'stop' },
    { patterns: ['next', 'forward'], action: 'next' },
    { patterns: ['previous', 'back to previous'], action: 'previous' },
    { patterns: ['back', 'go back'], action: 'back' },
    { patterns: ['open', 'select', 'choose'], action: 'select' },
    { patterns: ['send', 'send message', 'submit'], action: 'send' },
  ],
  de: [
    { patterns: ['stopp', 'fertig', 'schließen', 'beenden', 'aufnahme stoppen', 'ende'], action: 'stop' },
    { patterns: ['nächste', 'weiter', 'vorwärts'], action: 'next' },
    { patterns: ['vorherige', 'zurück zur vorherigen'], action: 'previous' },
    { patterns: ['zurück', 'geh zurück'], action: 'back' },
    { patterns: ['öffnen', 'wählen', 'auswählen'], action: 'select' },
    { patterns: ['senden', 'absenden', 'nachricht senden'], action: 'send' },
  ],
  fr: [
    { patterns: ['arrête', 'fini', 'fermer', 'terminer', 'arrêter', 'fin'], action: 'stop' },
    { patterns: ['suivant', 'prochain', 'avancer'], action: 'next' },
    { patterns: ['précédent', 'retour au précédent'], action: 'previous' },
    { patterns: ['retour', 'revenir'], action: 'back' },
    { patterns: ['ouvrir', 'choisir', 'sélectionner'], action: 'select' },
    { patterns: ['envoyer', 'envoie', 'envoyer message'], action: 'send' },
  ],
  es: [
    { patterns: ['para', 'parar', 'terminar', 'cerrar', 'salir', 'detener', 'fin', 'listo'], action: 'stop' },
    { patterns: ['siguiente', 'adelante'], action: 'next' },
    { patterns: ['anterior', 'volver al anterior'], action: 'previous' },
    { patterns: ['atrás', 'volver', 'regresar'], action: 'back' },
    { patterns: ['abrir', 'elegir', 'seleccionar'], action: 'select' },
    { patterns: ['enviar', 'envía', 'enviar mensaje'], action: 'send' },
  ],
};

// Mic position commands (for Voice Session Mode)
const POSITION_COMMANDS: Record<string, Array<{ patterns: string[]; position: MicIndicatorPosition }>> = {
  nl: [
    { patterns: ['microfoon linksboven', 'mic linksboven', 'links boven'], position: 'top-left' },
    { patterns: ['microfoon rechtsboven', 'mic rechtsboven', 'rechts boven'], position: 'top-right' },
    { patterns: ['microfoon linksonder', 'mic linksonder', 'links onder'], position: 'bottom-left' },
    { patterns: ['microfoon rechtsonder', 'mic rechtsonder', 'rechts onder'], position: 'bottom-right' },
  ],
  en: [
    { patterns: ['mic top left', 'microphone top left', 'top left'], position: 'top-left' },
    { patterns: ['mic top right', 'microphone top right', 'top right'], position: 'top-right' },
    { patterns: ['mic bottom left', 'microphone bottom left', 'bottom left'], position: 'bottom-left' },
    { patterns: ['mic bottom right', 'microphone bottom right', 'bottom right'], position: 'bottom-right' },
  ],
  de: [
    { patterns: ['mikrofon oben links', 'mikro oben links', 'oben links'], position: 'top-left' },
    { patterns: ['mikrofon oben rechts', 'mikro oben rechts', 'oben rechts'], position: 'top-right' },
    { patterns: ['mikrofon unten links', 'mikro unten links', 'unten links'], position: 'bottom-left' },
    { patterns: ['mikrofon unten rechts', 'mikro unten rechts', 'unten rechts'], position: 'bottom-right' },
  ],
  fr: [
    { patterns: ['micro haut gauche', 'microphone haut gauche', 'en haut à gauche'], position: 'top-left' },
    { patterns: ['micro haut droite', 'microphone haut droite', 'en haut à droite'], position: 'top-right' },
    { patterns: ['micro bas gauche', 'microphone bas gauche', 'en bas à gauche'], position: 'bottom-left' },
    { patterns: ['micro bas droite', 'microphone bas droite', 'en bas à droite'], position: 'bottom-right' },
  ],
  es: [
    { patterns: ['micro arriba izquierda', 'micrófono arriba izquierda', 'arriba izquierda'], position: 'top-left' },
    { patterns: ['micro arriba derecha', 'micrófono arriba derecha', 'arriba derecha'], position: 'top-right' },
    { patterns: ['micro abajo izquierda', 'micrófono abajo izquierda', 'abajo izquierda'], position: 'bottom-left' },
    { patterns: ['micro abajo derecha', 'micrófono abajo derecha', 'abajo derecha'], position: 'bottom-right' },
  ],
};

/**
 * Parse spoken text and match to commands
 * Priority order: position > session > navigation > action
 * Position and session commands are checked first as they're more specific
 */
function parseVoiceCommand(text: string, language: string): VoiceCommandResult {
  const normalizedText = text.toLowerCase().trim();
  const langCode = language.split('-')[0] || 'nl';

  // Try position commands first (most specific - for Voice Session Mode)
  const positionCommands = POSITION_COMMANDS[langCode] || POSITION_COMMANDS.nl;
  for (const { patterns, position } of positionCommands) {
    for (const pattern of patterns) {
      if (normalizedText.includes(pattern)) {
        return {
          type: 'position_change',
          position,
          rawText: text,
          confidence: 1.0,
        };
      }
    }
  }

  // Try action commands (call/message) FIRST
  // These are more specific than session commands and should take priority
  // e.g., "stuur bericht naar oma" should be an action, not session control "stuur"
  const actionPatterns = ACTION_PATTERNS[langCode] || ACTION_PATTERNS.nl;

  // Check for call action
  for (const pattern of actionPatterns.call) {
    if (normalizedText.startsWith(pattern)) {
      const contactName = normalizedText.replace(pattern, '').trim();
      if (contactName) {
        console.log('[parseVoiceCommand] Call action match! pattern:', pattern, 'contact:', contactName);
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
        console.log('[parseVoiceCommand] Message action match! pattern:', pattern, 'contact:', contactName);
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

  // Try session control commands (for Voice Session Mode)
  const sessionCommands = SESSION_COMMANDS[langCode] || SESSION_COMMANDS.nl;
  console.log('[parseVoiceCommand] Checking session commands for:', normalizedText);
  for (const { patterns, action } of sessionCommands) {
    for (const pattern of patterns) {
      // Use exact match or word boundary for session commands to avoid false positives
      // e.g., "stop" should not match "stoppen met roken"
      const regex = new RegExp(`^${pattern}$|^${pattern}\\s|\\s${pattern}$|\\s${pattern}\\s`, 'i');
      const matches = regex.test(normalizedText) || normalizedText === pattern;
      if (matches) {
        console.log('[parseVoiceCommand] Session command match! pattern:', pattern, 'action:', action);
        return {
          type: 'session_control',
          sessionAction: action,
          rawText: text,
          confidence: 1.0,
        };
      }
    }
  }

  // Try navigation commands
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

  // Silence timeout ref - clear when speech is detected
  // Declared here so it can be accessed by event listeners
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callback ref for when a result is ready - allows immediate execution without waiting for re-render
  // IMPORTANT: This callback should trigger navigation AND close the overlay
  const onResultReadyRef = useRef<((result: VoiceCommandResult) => void) | null>(null);

  // Track if we've already called the callback for this session to prevent duplicates
  const callbackFiredRef = useRef(false);

  // Timestamp of when startListening was last called
  // Used to ignore onSpeechEnd events that arrive shortly after a restart
  const lastStartTimeRef = useRef(0);
  const STALE_EVENT_WINDOW_MS = 300; // Ignore events that arrive within 300ms of a restart

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
          console.log('[useVoiceCommands] onSpeechStart received');
          setState(prev => ({
            ...prev,
            isListening: true,
            isProcessing: false,
            error: null,
          }));
        });

        const onSpeechEnd = eventEmitterRef.current.addListener('onSpeechEnd', () => {
          const timeSinceStart = Date.now() - lastStartTimeRef.current;
          console.log('[useVoiceCommands] onSpeechEnd received, timeSinceStart:', timeSinceStart, 'ms');

          // Ignore onSpeechEnd events that arrive shortly after startListening was called
          // This prevents stale events from a previous session from resetting our state
          if (timeSinceStart < STALE_EVENT_WINDOW_MS) {
            console.log('[useVoiceCommands] Ignoring stale onSpeechEnd (arrived within', STALE_EVENT_WINDOW_MS, 'ms of restart)');
            return;
          }

          setState(prev => ({
            ...prev,
            isListening: false,
          }));
        });

        const onSpeechPartialResults = eventEmitterRef.current.addListener('onSpeechPartialResults', (event) => {
          console.log('[useVoiceCommands] onSpeechPartialResults:', event.transcript, 'confidence:', event.confidence);

          // Clear silence timeout - we received speech
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }

          // Store valid partial results - iOS often returns empty final results
          if (event.transcript && event.transcript.trim()) {
            lastPartialResultRef.current = event.transcript;

            // FAST COMMAND PROCESSING
            // Parse the command first to check if it's a simple, known command
            const result = parseVoiceCommand(event.transcript, languageRef.current);
            const confidence = event.confidence || 0;

            // Use lower threshold (0.5) for simple session commands like "volgende", "vorige", "open"
            // These are short, common words that don't need high confidence
            const isSimpleCommand = result.type === 'session_control' &&
              ['next', 'previous', 'select', 'back'].includes(result.sessionAction || '');
            const requiredConfidence = isSimpleCommand ? 0.5 : 0.8;

            if (confidence >= requiredConfidence && !callbackFiredRef.current) {
              console.log('[useVoiceCommands] Fast partial result parsed:', result.type, 'confidence:', confidence, 'required:', requiredConfidence);

              // Fire callback for ALL types including 'unknown' - name matching happens in HoldToNavigateWrapper
              // Previously we only fired for ['navigation', 'action', 'session_control', 'position_change']
              // but 'unknown' commands need to reach the callback for voice focus name matching (e.g., "Oma")
              if (onResultReadyRef.current) {
                console.log('[useVoiceCommands] Firing callback for fast result:', result.type);
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
          console.log('[useVoiceCommands] onSpeechResults:', event.transcript, 'callbackFired:', callbackFiredRef.current);

          // Clear silence timeout - we received a final result
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }

          // Use final result if available, otherwise fall back to last partial result
          const transcriptToUse = (event.transcript && event.transcript.trim())
            ? event.transcript
            : lastPartialResultRef.current;

          console.log('[useVoiceCommands] Final transcript to use:', transcriptToUse);
          const result = parseVoiceCommand(transcriptToUse, languageRef.current);
          console.log('[useVoiceCommands] Final result parsed:', result.type, result);
          lastPartialResultRef.current = '';

          setState({
            isListening: false,
            isProcessing: false,
            transcript: transcriptToUse,
            error: null,
            lastResult: result,
          });

          // Call the callback if registered and not already fired
          // Include ALL types - unknown commands need to reach HoldToNavigateWrapper for name matching
          if (onResultReadyRef.current && !callbackFiredRef.current) {
            console.log('[useVoiceCommands] Firing callback for final result:', result.type);
            callbackFiredRef.current = true;
            onResultReadyRef.current(result);
          } else {
            console.log('[useVoiceCommands] NOT firing callback - onResultReady:', !!onResultReadyRef.current, 'callbackFired:', callbackFiredRef.current, 'resultType:', result.type);
          }
        });

        const onSpeechError = eventEmitterRef.current.addListener('onSpeechError', (event) => {
          // Clear silence timeout on error
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }

          // Ignore cancellation errors - these are expected when user closes overlay or restarts
          // Error codes: 201=Cancelled, 216=Request canceled, 301=No speech, 1100=Interrupted, 1110=Audio interrupted
          const ignoredCodes = ['201', '216', '301', '1100', '1110'];
          const isCancellation = ignoredCodes.includes(event.code) ||
            (event.error && (event.error.toLowerCase().includes('cancel') || event.error.toLowerCase().includes('interrupt')));
          if (isCancellation) {
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

              // Include ALL types - unknown commands need to reach HoldToNavigateWrapper for name matching
              if (onResultReadyRef.current && !callbackFiredRef.current) {
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

  // Track if we're intentionally restarting (to bypass isListening check)
  const isRestartingRef = useRef(false);

  // Silence timeout constant - if no speech detected within this time, reset to idle state
  // This prevents the mic from staying in "listening" mode indefinitely
  const SILENCE_TIMEOUT_MS = 8000; // 8 seconds of silence before resetting

  // Clear silence timeout helper
  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

  /**
   * Start listening for voice commands
   * @param forceRestart - If true, bypass the isListening check (used when restarting in session mode)
   */
  const startListening = useCallback(async (forceRestart: boolean = false) => {
    // Allow restart even if currently listening (for Voice Session Mode)
    if (!settings.enabled) return;
    if (state.isListening && !forceRestart && !isRestartingRef.current) return;

    // Record timestamp to detect stale events
    lastStartTimeRef.current = Date.now();
    console.log('[useVoiceCommands] startListening called, forceRestart:', forceRestart, 'timestamp:', lastStartTimeRef.current);

    // Clear previous state and timers
    lastPartialResultRef.current = '';
    callbackFiredRef.current = false;
    isRestartingRef.current = false;
    clearSilenceTimeout();

    // Start in "waiting for speech" state - NOT listening yet
    // The mic indicator will be in idle state (no pulsing, faded color)
    // isListening will be set to true when onSpeechStart fires (user starts speaking)
    setState(prev => ({
      ...prev,
      isListening: false, // Don't pulse yet - wait for actual speech
      isProcessing: false,
      transcript: '',
      error: null,
      lastResult: null,
    }));

    // Start silence timeout - reset to idle if no speech detected
    silenceTimeoutRef.current = setTimeout(() => {
      console.log('[useVoiceCommands] Silence timeout - resetting to idle state');
      setState(prev => ({
        ...prev,
        isListening: false,
        isProcessing: false,
      }));
    }, SILENCE_TIMEOUT_MS);

    try {
      if (Platform.OS === 'ios' && speechRecognitionRef.current) {
        console.log('[useVoiceCommands] Requesting permissions...');
        const permissions = await speechRecognitionRef.current.requestPermissions();
        console.log('[useVoiceCommands] Permissions:', permissions);

        if (!permissions.speechRecognition || !permissions.microphone) {
          console.log('[useVoiceCommands] Missing permissions, aborting');
          setState(prev => ({
            ...prev,
            error: 'Spraakherkenning vereist microfoon- en spraakherkenningsrechten',
            isListening: false,
          }));
          return;
        }

        console.log('[useVoiceCommands] *** CALLING NATIVE startListening with language:', settings.language);
        speechRecognitionRef.current.startListening(settings.language);
        console.log('[useVoiceCommands] Native startListening called successfully');
      } else {
        console.log('[useVoiceCommands] No speech recognition module available, Platform:', Platform.OS);
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
   * IMPORTANT: Always calls native module to ensure microphone is released,
   * even if state.isListening is already false (e.g., after a processed command).
   * This prevents the orange mic indicator in Dynamic Island from staying on.
   */
  const stopListening = useCallback(() => {
    // Clear silence timeout
    clearSilenceTimeout();

    // Update state if needed
    if (state.isListening) {
      setState(prev => ({
        ...prev,
        isListening: false,
        isProcessing: true,
      }));
    }

    // ALWAYS call native module to ensure microphone is released
    // Even if state.isListening is false, the native module may still be running
    try {
      if (Platform.OS === 'ios' && speechRecognitionRef.current) {
        speechRecognitionRef.current.stopListening();
      }
    } catch (error) {
      console.error('[useVoiceCommands] Failed to stop listening:', error);
    }
  }, [state.isListening, clearSilenceTimeout]);

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
   * Set processing state explicitly (used during restart delay)
   */
  const setProcessingState = useCallback((processing: boolean) => {
    setState(prev => ({
      ...prev,
      isProcessing: processing,
      isListening: processing ? false : prev.isListening,
    }));
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
    setProcessingState,
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
  SESSION_COMMANDS,
  POSITION_COMMANDS,
};
