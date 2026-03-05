/**
 * AudioModulesProvider — Compound provider for all audio module contexts
 *
 * Groups related providers to reduce nesting depth in App.tsx:
 * - AudioOrchestratorProvider (cross-module audio coordination)
 * - RadioProvider (radio module state)
 * - PodcastProvider (podcast module state)
 * - BooksProvider (books module state)
 * - AppleMusicProvider (Apple Music module state)
 *
 * AudioOrchestratorProvider must wrap all module providers
 * because each module registers itself with the orchestrator.
 */

import React, { type ReactNode } from 'react';

import { AudioOrchestratorProvider } from './AudioOrchestratorContext';
import { RadioProvider } from './RadioContext';
import { PodcastProvider } from './PodcastContext';
import { BooksProvider } from './BooksContext';
import { AppleMusicProvider } from './AppleMusicContext';

interface AudioModulesProviderProps {
  children: ReactNode;
}

export function AudioModulesProvider({ children }: AudioModulesProviderProps) {
  return (
    <AudioOrchestratorProvider>
      <RadioProvider>
        <PodcastProvider>
          <BooksProvider>
            <AppleMusicProvider>
              {children}
            </AppleMusicProvider>
          </BooksProvider>
        </PodcastProvider>
      </RadioProvider>
    </AudioOrchestratorProvider>
  );
}
