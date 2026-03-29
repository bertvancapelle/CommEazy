/**
 * GameLobbyScreen — Game lobby showing 5 game tiles
 *
 * Replaces GamePlaceholderScreen. Shows accessible tiles for each game
 * using the SpelTegel component within ModuleScreenLayout.
 *
 * @see Prompt_1_Games_Foundation.md §2
 * @see components/games/SpelTegel.tsx
 */

import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@/theme';
import { ModuleHeader, ModuleScreenLayout, ScrollViewWithIndicator } from '@/components';
import { SpelTegel } from '@/components/games';
import { useColors } from '@/contexts/ThemeContext';
import {
  STATIC_MODULE_DEFINITIONS,
  mapModuleIconToIconName,
} from '@/types/navigation';
import { ALL_GAME_TYPES, type GameType } from '@/types/games';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

interface GameLobbyScreenProps {
  /** The module ID that triggered this screen (any game module ID) */
  moduleId?: string;
}

// ============================================================
// Game descriptions i18n key mapping
// ============================================================

const GAME_DESCRIPTION_KEYS: Record<GameType, string> = {
  woordraad: 'games.woordraad.description',
  sudoku: 'games.sudoku.description',
  solitaire: 'games.solitaire.description',
  memory: 'games.memory.description',
  trivia: 'games.trivia.description',
};

// ============================================================
// Component
// ============================================================

export function GameLobbyScreen({ moduleId: _moduleId }: GameLobbyScreenProps) {
  const { t } = useTranslation();
  const themeColors = useColors();

  const handleGamePress = useCallback((_gameType: GameType) => {
    // TODO: Navigate to individual game screen (Prompt_2 through Prompt_6)
    // For now, tiles are tappable but navigation is not yet wired
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ModuleScreenLayout
        moduleId={'help' as ModuleColorId}
        moduleBlock={
          <ModuleHeader
            moduleId={'help' as ModuleColorId}
            icon="grid"
            title={t('games.lobby.title')}
            showBackButton
            skipSafeArea
          />
        }
        controlsBlock={<></>}
        contentBlock={
          <ScrollViewWithIndicator
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {ALL_GAME_TYPES.map((gameType) => {
              const moduleDef = STATIC_MODULE_DEFINITIONS[gameType];
              const iconName = mapModuleIconToIconName(moduleDef.icon);
              const title = t(moduleDef.labelKey);
              const description = t(GAME_DESCRIPTION_KEYS[gameType]);

              return (
                <SpelTegel
                  key={gameType}
                  moduleId={gameType as ModuleColorId}
                  icon={iconName}
                  title={title}
                  description={description}
                  onPress={() => handleGamePress(gameType)}
                />
              );
            })}
          </ScrollViewWithIndicator>
        }
      />
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
});
