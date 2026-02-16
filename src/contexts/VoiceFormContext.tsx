/**
 * VoiceFormContext — Voice-enabled form field management
 *
 * Enables voice interactions with form fields:
 * - "pas aan [veld]" → Focus on field
 * - "wis" → Clear active field
 * - "dicteer" → Start voice-to-text for active field
 * - "bevestig" → Submit form
 *
 * Each form field registers itself with a unique ID and callbacks.
 *
 * @see .claude/CLAUDE.md § 11. Voice Interaction Architecture
 * @see src/types/voiceCommands.ts
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { AccessibilityInfo } from 'react-native';
import { useTranslation } from 'react-i18next';

import { type VoiceFormField } from '@/types/voiceCommands';

// ============================================================
// Types
// ============================================================

/** Fuzzy match result for field name matching */
interface FieldMatchResult {
  field: VoiceFormField;
  score: number;
}

/** Form registration with callbacks */
interface RegisteredForm {
  id: string;
  onSubmit?: () => void;
  onCancel?: () => void;
}

// ============================================================
// Context Types
// ============================================================

export interface VoiceFormContextValue {
  // Field management
  registerField: (field: VoiceFormField) => void;
  unregisterField: (fieldId: string) => void;
  setActiveField: (fieldId: string | null) => void;
  activeFieldId: string | null;

  // Form management
  registerForm: (form: RegisteredForm) => void;
  unregisterForm: (formId: string) => void;
  activeFormId: string | null;

  // Voice actions
  focusFieldByName: (name: string) => FieldMatchResult[];
  clearActiveField: () => void;
  startDictation: () => void;
  stopDictation: () => void;
  submitForm: () => void;

  // Dictation state
  isDictating: boolean;
  dictatedText: string;

  // Helper to check if field is active
  isFieldActive: (fieldId: string) => boolean;
}

// ============================================================
// Fuzzy Matching Utility
// ============================================================

/**
 * Calculate similarity score between two strings
 */
function similarityScore(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 1;
  if (aLower.length === 0 || bLower.length === 0) return 0;

  // Check if one starts with the other
  if (aLower.startsWith(bLower) || bLower.startsWith(aLower)) {
    return 0.9;
  }

  // Check if one contains the other
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    return 0.8;
  }

  // Simple Levenshtein-based score
  const maxLength = Math.max(aLower.length, bLower.length);
  let distance = 0;
  const minLength = Math.min(aLower.length, bLower.length);

  for (let i = 0; i < minLength; i++) {
    if (aLower[i] !== bLower[i]) distance++;
  }
  distance += Math.abs(aLower.length - bLower.length);

  return 1 - distance / maxLength;
}

/**
 * Find matching fields using fuzzy matching
 */
function fuzzyMatchFields(
  query: string,
  fields: Map<string, VoiceFormField>,
  threshold: number = 0.6
): FieldMatchResult[] {
  const results: FieldMatchResult[] = [];

  fields.forEach((field) => {
    const score = similarityScore(query, field.label);
    if (score >= threshold) {
      results.push({ field, score });
    }
  });

  return results.sort((a, b) => b.score - a.score);
}

// ============================================================
// Context
// ============================================================

const VoiceFormContext = createContext<VoiceFormContextValue | null>(null);

interface VoiceFormProviderProps {
  children: ReactNode;
}

/**
 * Provider component for voice form context
 */
export function VoiceFormProvider({ children }: VoiceFormProviderProps) {
  const { t } = useTranslation();

  // Field state
  const [fields, setFields] = useState<Map<string, VoiceFormField>>(new Map());
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  // Form state
  const [forms, setForms] = useState<Map<string, RegisteredForm>>(new Map());
  const [activeFormId, setActiveFormId] = useState<string | null>(null);

  // Dictation state
  const [isDictating, setIsDictating] = useState(false);
  const [dictatedText, setDictatedText] = useState('');
  const dictationCallbackRef = useRef<((text: string) => void) | null>(null);

  // ============================================================
  // Field Management
  // ============================================================

  const registerField = useCallback((field: VoiceFormField) => {
    setFields((prev) => {
      const newFields = new Map(prev);
      newFields.set(field.id, field);
      return newFields;
    });
  }, []);

  const unregisterField = useCallback((fieldId: string) => {
    setFields((prev) => {
      const newFields = new Map(prev);
      newFields.delete(fieldId);
      return newFields;
    });

    // Clear active field if it was unregistered
    setActiveFieldId((prev) => (prev === fieldId ? null : prev));
  }, []);

  const handleSetActiveField = useCallback((fieldId: string | null) => {
    setActiveFieldId(fieldId);

    if (fieldId) {
      const field = fields.get(fieldId);
      if (field) {
        AccessibilityInfo.announceForAccessibility(
          t('voiceCommands.editingField', { field: field.label })
        );
      }
    }
  }, [fields, t]);

  // ============================================================
  // Form Management
  // ============================================================

  const registerForm = useCallback((form: RegisteredForm) => {
    setForms((prev) => {
      const newForms = new Map(prev);
      newForms.set(form.id, form);
      return newForms;
    });
    setActiveFormId(form.id);
  }, []);

  const unregisterForm = useCallback((formId: string) => {
    setForms((prev) => {
      const newForms = new Map(prev);
      newForms.delete(formId);
      return newForms;
    });

    setActiveFormId((prev) => {
      if (prev !== formId) return prev;
      // Find most recently added form
      const remaining = Array.from(forms.keys()).filter((id) => id !== formId);
      return remaining.length > 0 ? remaining[remaining.length - 1] : null;
    });
  }, [forms]);

  // ============================================================
  // Voice Actions
  // ============================================================

  const focusFieldByName = useCallback(
    (name: string): FieldMatchResult[] => {
      const matches = fuzzyMatchFields(name, fields);

      if (matches.length === 0) {
        AccessibilityInfo.announceForAccessibility(
          t('voiceCommands.fieldNotFound')
        );
        return [];
      }

      if (matches.length === 1 || matches[0].score > 0.9) {
        // Single or high-confidence match
        const field = matches[0].field;
        setActiveFieldId(field.id);
        field.onEdit();

        AccessibilityInfo.announceForAccessibility(
          t('voiceCommands.editingField', { field: field.label })
        );
      }

      return matches;
    },
    [fields, t]
  );

  const clearActiveField = useCallback(() => {
    if (!activeFieldId) {
      AccessibilityInfo.announceForAccessibility(
        t('voiceCommands.noActiveField')
      );
      return;
    }

    const field = fields.get(activeFieldId);
    if (field) {
      field.onClear();
      AccessibilityInfo.announceForAccessibility(
        t('voiceCommands.fieldCleared', { field: field.label })
      );
    }
  }, [activeFieldId, fields, t]);

  const startDictation = useCallback(() => {
    if (!activeFieldId) {
      AccessibilityInfo.announceForAccessibility(
        t('voiceCommands.noActiveField')
      );
      return;
    }

    const field = fields.get(activeFieldId);
    if (!field) return;

    setIsDictating(true);
    setDictatedText('');
    dictationCallbackRef.current = field.onDictate;

    AccessibilityInfo.announceForAccessibility(
      t('voiceCommands.listeningForDictation')
    );
  }, [activeFieldId, fields, t]);

  const stopDictation = useCallback(() => {
    if (isDictating && dictatedText && dictationCallbackRef.current) {
      dictationCallbackRef.current(dictatedText);
      AccessibilityInfo.announceForAccessibility(
        t('voiceCommands.dictationComplete')
      );
    }

    setIsDictating(false);
    setDictatedText('');
    dictationCallbackRef.current = null;
  }, [isDictating, dictatedText, t]);

  const submitForm = useCallback(() => {
    if (!activeFormId) {
      AccessibilityInfo.announceForAccessibility(
        t('voiceCommands.noActiveForm')
      );
      return;
    }

    const form = forms.get(activeFormId);
    if (form?.onSubmit) {
      form.onSubmit();
      AccessibilityInfo.announceForAccessibility(
        t('voiceCommands.formSubmitted')
      );
    }
  }, [activeFormId, forms, t]);

  // ============================================================
  // Helpers
  // ============================================================

  const isFieldActive = useCallback(
    (fieldId: string): boolean => {
      return activeFieldId === fieldId;
    },
    [activeFieldId]
  );

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo(
    (): VoiceFormContextValue => ({
      registerField,
      unregisterField,
      setActiveField: handleSetActiveField,
      activeFieldId,

      registerForm,
      unregisterForm,
      activeFormId,

      focusFieldByName,
      clearActiveField,
      startDictation,
      stopDictation,
      submitForm,

      isDictating,
      dictatedText,

      isFieldActive,
    }),
    [
      registerField,
      unregisterField,
      handleSetActiveField,
      activeFieldId,
      registerForm,
      unregisterForm,
      activeFormId,
      focusFieldByName,
      clearActiveField,
      startDictation,
      stopDictation,
      submitForm,
      isDictating,
      dictatedText,
      isFieldActive,
    ]
  );

  return (
    <VoiceFormContext.Provider value={value}>
      {children}
    </VoiceFormContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook to access voice form context
 * Must be used within a VoiceFormProvider
 */
export function useVoiceFormContext(): VoiceFormContextValue {
  const context = useContext(VoiceFormContext);
  if (!context) {
    throw new Error(
      'useVoiceFormContext must be used within a VoiceFormProvider'
    );
  }
  return context;
}

/**
 * Hook to register a form field for voice interaction
 *
 * @param fieldId Unique identifier for the field
 * @param label Human-readable label for voice matching
 * @param onEdit Callback when "pas aan [label]" is spoken
 * @param onClear Callback when "wis" is spoken
 * @param onDictate Callback when dictation completes
 */
export function useVoiceField(
  fieldId: string,
  label: string,
  onEdit: () => void,
  onClear: () => void,
  onDictate: (text: string) => void
): {
  isActive: boolean;
  setActive: () => void;
} {
  const { registerField, unregisterField, setActiveField, isFieldActive } =
    useVoiceFormContext();

  // Register on mount, unregister on unmount
  React.useEffect(() => {
    registerField({
      id: fieldId,
      label,
      onEdit,
      onClear,
      onDictate,
    });

    return () => {
      unregisterField(fieldId);
    };
  }, [fieldId, label, onEdit, onClear, onDictate, registerField, unregisterField]);

  const isActive = isFieldActive(fieldId);
  const setActive = useCallback(() => {
    setActiveField(fieldId);
  }, [fieldId, setActiveField]);

  return { isActive, setActive };
}

/**
 * Hook to register a form for voice submission
 *
 * @param formId Unique identifier for the form
 * @param onSubmit Callback when "bevestig" is spoken
 * @param onCancel Callback when "annuleer" is spoken
 */
export function useVoiceForm(
  formId: string,
  onSubmit?: () => void,
  onCancel?: () => void
): void {
  const { registerForm, unregisterForm } = useVoiceFormContext();

  React.useEffect(() => {
    registerForm({ id: formId, onSubmit, onCancel });

    return () => {
      unregisterForm(formId);
    };
  }, [formId, onSubmit, onCancel, registerForm, unregisterForm]);
}
