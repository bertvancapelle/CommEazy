/**
 * VoiceSystemProvider — Compound provider for all voice interaction contexts
 *
 * Groups related providers to reduce nesting depth in App.tsx:
 * - VoiceSettingsProvider (voice command user settings)
 * - VoiceFocusProvider (voice focus management for lists)
 * - VoiceFormProvider (voice form interactions)
 *
 * Dependency order matters:
 * VoiceFocusProvider requires VoiceSettingsProvider
 * VoiceFormProvider requires VoiceFocusProvider
 */

import React, { type ReactNode } from 'react';

import { VoiceSettingsProvider } from './VoiceSettingsContext';
import { VoiceFocusProvider } from './VoiceFocusContext';
import { VoiceFormProvider } from './VoiceFormContext';

interface VoiceSystemProviderProps {
  children: ReactNode;
}

export function VoiceSystemProvider({ children }: VoiceSystemProviderProps) {
  return (
    <VoiceSettingsProvider>
      <VoiceFocusProvider>
        <VoiceFormProvider>
          {children}
        </VoiceFormProvider>
      </VoiceFocusProvider>
    </VoiceSettingsProvider>
  );
}
