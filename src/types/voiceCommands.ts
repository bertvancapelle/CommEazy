/**
 * Voice Commands Type System
 *
 * Centraal type systeem voor alle voice interactions in CommEazy.
 * Deze types worden gebruikt door:
 * - VoiceSettingsContext (settings opslag)
 * - useVoiceCommands (speech recognition + parsing)
 * - VoiceFocusContext (lijst navigatie)
 * - VoiceFormContext (formulier interacties)
 *
 * @see .claude/CLAUDE.md § 11. Voice Interaction Architecture
 */

// ============================================================
// LANGUAGE & LOCALIZATION
// ============================================================

/** Supported languages for voice commands */
export type Language = 'nl' | 'en' | 'de' | 'fr' | 'es';

/** Language display names */
export const LANGUAGE_NAMES: Record<Language, string> = {
  nl: 'Nederlands',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

/** Speech recognition locale codes */
export const SPEECH_LOCALES: Record<Language, string> = {
  nl: 'nl-NL',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
};

// ============================================================
// COMMAND CATEGORIES
// ============================================================

/**
 * Voice command categories
 *
 * Each category groups related commands and determines:
 * - When commands are active (e.g., 'list' only in lists)
 * - What feedback to provide (haptic, audio, announcement)
 * - Where in settings they appear
 */
export type VoiceCommandCategory =
  | 'navigation'    // Navigate between screens: "contacten", "berichten"
  | 'list'          // Navigate within lists: "volgende", "vorige", "open"
  | 'form'          // Form interactions: "pas aan", "wis", "dicteer", "bevestig"
  | 'action'        // Direct actions: "bel", "stuur bericht", "verwijder"
  | 'media'         // Media actions: "stuur", "foto", "speel", "pauze"
  | 'session'       // Session control: "stop", "help"
  | 'confirmation'; // Confirmation dialogs: "ja", "nee", "annuleer"

/** Category display names (i18n keys) */
export const CATEGORY_I18N_KEYS: Record<VoiceCommandCategory, string> = {
  navigation: 'voiceSettings.categories.navigation',
  list: 'voiceSettings.categories.list',
  form: 'voiceSettings.categories.form',
  action: 'voiceSettings.categories.action',
  media: 'voiceSettings.categories.media',
  session: 'voiceSettings.categories.session',
  confirmation: 'voiceSettings.categories.confirmation',
};

// ============================================================
// COMMAND DEFINITIONS
// ============================================================

/**
 * Voice command definition
 *
 * Defines a single voice command with its patterns in all languages.
 */
export interface VoiceCommand {
  /** Unique identifier: 'next', 'previous', 'open', etc. */
  id: string;

  /** Category this command belongs to */
  category: VoiceCommandCategory;

  /** Technical action name for handlers */
  action: string;

  /** i18n key for command name in settings UI */
  nameKey: string;

  /** i18n key for command description */
  descriptionKey: string;

  /** Default patterns per language (cannot be removed, only disabled) */
  defaultPatterns: Record<Language, string[]>;

  /** Whether this command is enabled (default: true) */
  isEnabled: boolean;

  /** Whether this command can be disabled by user (some are required) */
  canDisable: boolean;
}

/**
 * User customization for a voice command
 */
export interface VoiceCommandCustomization {
  /** Command ID */
  commandId: string;

  /** Custom patterns added by user (any language) */
  customPatterns: string[];

  /** Patterns disabled by user */
  disabledPatterns: string[];

  /** Whether command is enabled */
  isEnabled: boolean;
}

// ============================================================
// VOICE SETTINGS
// ============================================================

/**
 * Voice settings stored in AsyncStorage
 */
export interface VoiceSettings {
  /** Voice control enabled globally */
  isEnabled: boolean;

  /** Current language for speech recognition */
  language: Language;

  /** Command customizations (only stores changes from defaults) */
  customizations: Record<string, VoiceCommandCustomization>;

  /** Voice session timeout in ms (default: 30000) */
  sessionTimeoutMs: number;

  /** Minimum confidence threshold for command recognition (0.0-1.0) */
  confidenceThreshold: number;

  /** Enable fuzzy matching for name recognition */
  fuzzyMatchingEnabled: boolean;

  /** Fuzzy matching threshold (0.0-1.0, default: 0.7) */
  fuzzyMatchingThreshold: number;
}

/** Default voice settings */
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  isEnabled: true,
  language: 'nl',
  customizations: {},
  sessionTimeoutMs: 30000,
  confidenceThreshold: 0.6,
  fuzzyMatchingEnabled: true,
  fuzzyMatchingThreshold: 0.7,
};

// ============================================================
// COMMAND RESULT TYPES
// ============================================================

/**
 * Result of parsing a voice command
 */
export interface VoiceCommandResult {
  /** Type of command recognized */
  type: VoiceCommandCategory | 'unknown' | 'text';

  /** Raw transcript from speech recognition */
  rawText: string;

  /** Confidence score (0.0-1.0) */
  confidence: number;

  /** Matched command ID (if recognized) */
  commandId?: string;

  /** Action to execute */
  action?: string;

  /** For navigation: target screen */
  target?: string;

  /** For list: matched item name (fuzzy match) */
  matchedName?: string;

  /** For form: field ID */
  fieldId?: string;

  /** For session control: session action */
  sessionAction?: 'stop' | 'help' | 'next' | 'previous' | 'select' | 'back';

  /** For confirmation: user response */
  confirmationResponse?: 'yes' | 'no' | 'cancel';
}

// ============================================================
// FORM FIELD REGISTRATION
// ============================================================

/**
 * Registered form field for voice targeting
 */
export interface VoiceFormField {
  /** Unique field ID */
  id: string;

  /** Human-readable label for voice matching */
  label: string;

  /** Callback when "pas aan [label]" is spoken */
  onEdit: () => void;

  /** Callback when "wis" is spoken (while field is active) */
  onClear: () => void;

  /** Callback when dictation completes */
  onDictate: (text: string) => void;

  /** Whether field is currently active/focused */
  isActive?: boolean;
}

// ============================================================
// ACTION REGISTRATION
// ============================================================

/**
 * Registered action for voice triggering
 */
export interface VoiceAction {
  /** Unique action ID */
  id: string;

  /** Voice trigger pattern (e.g., "bel" for "Bel Oma") */
  trigger: string;

  /** Human-readable label for voice matching */
  label: string;

  /** Callback to execute action */
  onTrigger: () => void;

  /** Whether action requires confirmation */
  requiresConfirmation?: boolean;
}

// ============================================================
// DEFAULT COMMANDS
// ============================================================

/**
 * All default voice commands
 *
 * These are the built-in commands that ship with the app.
 * Users can add synonyms or disable commands, but cannot remove defaults.
 */
export const DEFAULT_VOICE_COMMANDS: VoiceCommand[] = [
  // ============ NAVIGATION ============
  {
    id: 'nav_contacts',
    category: 'navigation',
    action: 'navigate',
    nameKey: 'voiceCommands.nav.contacts',
    descriptionKey: 'voiceCommands.nav.contacts_desc',
    defaultPatterns: {
      nl: ['contacten', 'contactpersonen', 'personen'],
      en: ['contacts', 'people'],
      de: ['kontakte', 'personen'],
      fr: ['contacts', 'personnes'],
      es: ['contactos', 'personas'],
    },
    isEnabled: true,
    canDisable: false,
  },
  {
    id: 'nav_messages',
    category: 'navigation',
    action: 'navigate',
    nameKey: 'voiceCommands.nav.messages',
    descriptionKey: 'voiceCommands.nav.messages_desc',
    defaultPatterns: {
      nl: ['berichten', 'chats', 'gesprekken'],
      en: ['messages', 'chats', 'conversations'],
      de: ['nachrichten', 'chats', 'gespräche'],
      fr: ['messages', 'discussions', 'conversations'],
      es: ['mensajes', 'chats', 'conversaciones'],
    },
    isEnabled: true,
    canDisable: false,
  },
  {
    id: 'nav_settings',
    category: 'navigation',
    action: 'navigate',
    nameKey: 'voiceCommands.nav.settings',
    descriptionKey: 'voiceCommands.nav.settings_desc',
    defaultPatterns: {
      nl: ['instellingen', 'opties'],
      en: ['settings', 'options'],
      de: ['einstellungen', 'optionen'],
      fr: ['paramètres', 'options', 'réglages'],
      es: ['ajustes', 'configuración', 'opciones'],
    },
    isEnabled: true,
    canDisable: false,
  },

  // ============ LIST NAVIGATION ============
  {
    id: 'list_next',
    category: 'list',
    action: 'focusNext',
    nameKey: 'voiceCommands.list.next',
    descriptionKey: 'voiceCommands.list.next_desc',
    defaultPatterns: {
      nl: ['volgende', 'verder', 'door'],
      en: ['next', 'forward'],
      de: ['nächste', 'weiter'],
      fr: ['suivant', 'prochain'],
      es: ['siguiente', 'adelante'],
    },
    isEnabled: true,
    canDisable: false,
  },
  {
    id: 'list_previous',
    category: 'list',
    action: 'focusPrevious',
    nameKey: 'voiceCommands.list.previous',
    descriptionKey: 'voiceCommands.list.previous_desc',
    defaultPatterns: {
      nl: ['vorige', 'terug'],
      en: ['previous', 'back'],
      de: ['vorherige', 'zurück'],
      fr: ['précédent', 'retour'],
      es: ['anterior', 'atrás'],
    },
    isEnabled: true,
    canDisable: false,
  },
  {
    id: 'list_open',
    category: 'list',
    action: 'selectFocused',
    nameKey: 'voiceCommands.list.open',
    descriptionKey: 'voiceCommands.list.open_desc',
    defaultPatterns: {
      nl: ['open', 'kies', 'selecteer'],
      en: ['open', 'select', 'choose'],
      de: ['öffnen', 'wählen', 'auswählen'],
      fr: ['ouvrir', 'choisir', 'sélectionner'],
      es: ['abrir', 'elegir', 'seleccionar'],
    },
    isEnabled: true,
    canDisable: false,
  },

  // ============ FORM INTERACTIONS ============
  {
    id: 'form_edit',
    category: 'form',
    action: 'editField',
    nameKey: 'voiceCommands.form.edit',
    descriptionKey: 'voiceCommands.form.edit_desc',
    defaultPatterns: {
      nl: ['pas aan', 'wijzig', 'verander', 'bewerk'],
      en: ['edit', 'change', 'modify'],
      de: ['bearbeiten', 'ändern', 'anpassen'],
      fr: ['modifier', 'changer', 'éditer'],
      es: ['editar', 'cambiar', 'modificar'],
    },
    isEnabled: true,
    canDisable: true,
  },
  {
    id: 'form_clear',
    category: 'form',
    action: 'clearField',
    nameKey: 'voiceCommands.form.clear',
    descriptionKey: 'voiceCommands.form.clear_desc',
    defaultPatterns: {
      nl: ['wis', 'leeg', 'gooi weg', 'verwijder'],
      en: ['clear', 'delete', 'remove', 'empty'],
      de: ['löschen', 'leeren', 'entfernen'],
      fr: ['effacer', 'vider', 'supprimer'],
      es: ['borrar', 'limpiar', 'vaciar'],
    },
    isEnabled: true,
    canDisable: true,
  },
  {
    id: 'form_dictate',
    category: 'form',
    action: 'startDictation',
    nameKey: 'voiceCommands.form.dictate',
    descriptionKey: 'voiceCommands.form.dictate_desc',
    defaultPatterns: {
      nl: ['dicteer', 'spreek in', 'typ'],
      en: ['dictate', 'speak', 'type'],
      de: ['diktieren', 'sprechen', 'tippen'],
      fr: ['dicter', 'parler', 'taper'],
      es: ['dictar', 'hablar', 'escribir'],
    },
    isEnabled: true,
    canDisable: true,
  },
  {
    id: 'form_confirm',
    category: 'form',
    action: 'submitForm',
    nameKey: 'voiceCommands.form.confirm',
    descriptionKey: 'voiceCommands.form.confirm_desc',
    defaultPatterns: {
      nl: ['bevestig', 'opslaan', 'klaar', 'verstuur'],
      en: ['confirm', 'save', 'done', 'send'],
      de: ['bestätigen', 'speichern', 'fertig', 'senden'],
      fr: ['confirmer', 'enregistrer', 'terminé', 'envoyer'],
      es: ['confirmar', 'guardar', 'listo', 'enviar'],
    },
    isEnabled: true,
    canDisable: true,
  },

  // ============ ACTIONS ============
  {
    id: 'action_call',
    category: 'action',
    action: 'call',
    nameKey: 'voiceCommands.action.call',
    descriptionKey: 'voiceCommands.action.call_desc',
    defaultPatterns: {
      nl: ['bel', 'telefoneer'],
      en: ['call', 'phone'],
      de: ['anrufen', 'telefonieren'],
      fr: ['appeler', 'téléphoner'],
      es: ['llamar', 'telefonear'],
    },
    isEnabled: true,
    canDisable: true,
  },
  {
    id: 'action_message',
    category: 'action',
    action: 'sendMessage',
    nameKey: 'voiceCommands.action.message',
    descriptionKey: 'voiceCommands.action.message_desc',
    defaultPatterns: {
      nl: ['stuur bericht', 'chat', 'bericht'],
      en: ['send message', 'message', 'chat'],
      de: ['nachricht senden', 'nachricht', 'chat'],
      fr: ['envoyer message', 'message', 'chat'],
      es: ['enviar mensaje', 'mensaje', 'chat'],
    },
    isEnabled: true,
    canDisable: true,
  },
  {
    id: 'action_delete',
    category: 'action',
    action: 'delete',
    nameKey: 'voiceCommands.action.delete',
    descriptionKey: 'voiceCommands.action.delete_desc',
    defaultPatterns: {
      nl: ['verwijder', 'wis'],
      en: ['delete', 'remove'],
      de: ['löschen', 'entfernen'],
      fr: ['supprimer', 'effacer'],
      es: ['eliminar', 'borrar'],
    },
    isEnabled: true,
    canDisable: true,
  },

  // ============ MEDIA ============
  {
    id: 'media_send',
    category: 'media',
    action: 'send',
    nameKey: 'voiceCommands.media.send',
    descriptionKey: 'voiceCommands.media.send_desc',
    defaultPatterns: {
      nl: ['stuur', 'verstuur', 'verzend'],
      en: ['send'],
      de: ['senden', 'abschicken'],
      fr: ['envoyer'],
      es: ['enviar'],
    },
    isEnabled: true,
    canDisable: true,
  },
  {
    id: 'media_photo',
    category: 'media',
    action: 'takePhoto',
    nameKey: 'voiceCommands.media.photo',
    descriptionKey: 'voiceCommands.media.photo_desc',
    defaultPatterns: {
      nl: ['foto', 'maak foto', 'camera'],
      en: ['photo', 'take photo', 'camera'],
      de: ['foto', 'foto machen', 'kamera'],
      fr: ['photo', 'prendre photo', 'caméra'],
      es: ['foto', 'tomar foto', 'cámara'],
    },
    isEnabled: true,
    canDisable: true,
  },
  {
    id: 'media_play',
    category: 'media',
    action: 'play',
    nameKey: 'voiceCommands.media.play',
    descriptionKey: 'voiceCommands.media.play_desc',
    defaultPatterns: {
      nl: ['speel', 'afspelen', 'start'],
      en: ['play', 'start'],
      de: ['abspielen', 'wiedergabe', 'start'],
      fr: ['jouer', 'lire', 'démarrer'],
      es: ['reproducir', 'iniciar'],
    },
    isEnabled: true,
    canDisable: true,
  },
  {
    id: 'media_pause',
    category: 'media',
    action: 'pause',
    nameKey: 'voiceCommands.media.pause',
    descriptionKey: 'voiceCommands.media.pause_desc',
    defaultPatterns: {
      nl: ['pauze', 'pauzeer', 'stop'],
      en: ['pause', 'stop'],
      de: ['pause', 'anhalten', 'stopp'],
      fr: ['pause', 'arrêter'],
      es: ['pausa', 'pausar', 'detener'],
    },
    isEnabled: true,
    canDisable: true,
  },

  // ============ SESSION CONTROL ============
  {
    id: 'session_stop',
    category: 'session',
    action: 'stopSession',
    nameKey: 'voiceCommands.session.stop',
    descriptionKey: 'voiceCommands.session.stop_desc',
    defaultPatterns: {
      nl: ['stop', 'klaar', 'uit'],
      en: ['stop', 'done', 'off'],
      de: ['stopp', 'fertig', 'aus'],
      fr: ['stop', 'arrêt', 'fini'],
      es: ['parar', 'detener', 'fin'],
    },
    isEnabled: true,
    canDisable: false,
  },
  {
    id: 'session_help',
    category: 'session',
    action: 'showHelp',
    nameKey: 'voiceCommands.session.help',
    descriptionKey: 'voiceCommands.session.help_desc',
    defaultPatterns: {
      nl: ['help', 'hulp', 'wat kan ik zeggen'],
      en: ['help', 'what can i say'],
      de: ['hilfe', 'was kann ich sagen'],
      fr: ['aide', 'que puis-je dire'],
      es: ['ayuda', 'qué puedo decir'],
    },
    isEnabled: true,
    canDisable: false,
  },

  // ============ CONFIRMATION ============
  {
    id: 'confirm_yes',
    category: 'confirmation',
    action: 'confirm',
    nameKey: 'voiceCommands.confirm.yes',
    descriptionKey: 'voiceCommands.confirm.yes_desc',
    defaultPatterns: {
      nl: ['ja', 'oké', 'akkoord', 'doe maar', 'bevestig'],
      en: ['yes', 'ok', 'okay', 'confirm', 'sure'],
      de: ['ja', 'ok', 'okay', 'bestätigen', 'sicher'],
      fr: ['oui', 'ok', 'd\'accord', 'confirmer'],
      es: ['sí', 'ok', 'vale', 'confirmar', 'seguro'],
    },
    isEnabled: true,
    canDisable: false,
  },
  {
    id: 'confirm_no',
    category: 'confirmation',
    action: 'cancel',
    nameKey: 'voiceCommands.confirm.no',
    descriptionKey: 'voiceCommands.confirm.no_desc',
    defaultPatterns: {
      nl: ['nee', 'annuleer', 'stop', 'niet doen'],
      en: ['no', 'cancel', 'stop', 'don\'t'],
      de: ['nein', 'abbrechen', 'stopp', 'nicht'],
      fr: ['non', 'annuler', 'arrêter', 'pas'],
      es: ['no', 'cancelar', 'parar', 'no hacer'],
    },
    isEnabled: true,
    canDisable: false,
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get all patterns for a command in a specific language
 * Includes default patterns + custom patterns - disabled patterns
 */
export function getCommandPatterns(
  command: VoiceCommand,
  language: Language,
  customization?: VoiceCommandCustomization
): string[] {
  const defaultPatterns = command.defaultPatterns[language] || [];

  if (!customization) {
    return defaultPatterns;
  }

  // Start with defaults, remove disabled, add custom
  const patterns = defaultPatterns.filter(
    (p) => !customization.disabledPatterns.includes(p)
  );
  patterns.push(...customization.customPatterns);

  return patterns;
}

/**
 * Check if a command is enabled
 */
export function isCommandEnabled(
  command: VoiceCommand,
  customization?: VoiceCommandCustomization
): boolean {
  if (!command.canDisable) {
    return true; // Cannot be disabled
  }
  return customization?.isEnabled ?? command.isEnabled;
}

/**
 * Get commands by category
 */
export function getCommandsByCategory(
  category: VoiceCommandCategory
): VoiceCommand[] {
  return DEFAULT_VOICE_COMMANDS.filter((cmd) => cmd.category === category);
}

/**
 * Find command by pattern match
 */
export function findCommandByPattern(
  text: string,
  language: Language,
  settings: VoiceSettings
): VoiceCommand | undefined {
  const normalizedText = text.toLowerCase().trim();

  for (const command of DEFAULT_VOICE_COMMANDS) {
    if (!isCommandEnabled(command, settings.customizations[command.id])) {
      continue;
    }

    const patterns = getCommandPatterns(
      command,
      language,
      settings.customizations[command.id]
    );

    for (const pattern of patterns) {
      if (normalizedText === pattern || normalizedText.startsWith(pattern + ' ')) {
        return command;
      }
    }
  }

  return undefined;
}
