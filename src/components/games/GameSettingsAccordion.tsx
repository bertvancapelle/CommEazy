/**
 * GameSettingsAccordion — Collapsible settings section for game menu screens
 *
 * Wraps all game-specific configuration (difficulty, sounds, toggles, etc.)
 * in a collapsible accordion. Always starts collapsed to keep the game
 * lobby screen clean and uncluttered.
 *
 * Tapping the header toggles open/closed with a smooth animation.
 * Chevron rotates to indicate state.
 */

import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, touchTargets, typography } from '@/theme';
import { HapticTouchable, Icon } from '@/components';
import { useColors } from '@/contexts/ThemeContext';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================
// Types
// ============================================================

interface GameSettingsAccordionProps {
  /** Module accent color for the header */
  moduleColor: string;
  /** Settings content to show when expanded */
  children: React.ReactNode;
}

// ============================================================
// Component
// ============================================================

export function GameSettingsAccordion({ moduleColor, children }: GameSettingsAccordionProps) {
  const { t } = useTranslation();
  const themeColors = useColors();

  const [expanded, setExpanded] = useState(false);
  const chevronRotation = useRef(new Animated.Value(0)).current;

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => {
      const next = !prev;
      Animated.timing(chevronRotation, {
        toValue: next ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
      return next;
    });
  }, [chevronRotation]);

  const chevronRotateStyle = {
    transform: [
      {
        rotate: chevronRotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      {/* Accordion header */}
      <HapticTouchable
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t('games.settings.title')}
        accessibilityHint={expanded ? t('games.settings.tapToClose') : t('games.settings.tapToOpen')}
        style={[
          styles.header,
          {
            backgroundColor: moduleColor + '1A',
            borderColor: moduleColor + '40',
          },
        ]}
      >
        <Icon name="settings" size={20} color={moduleColor} />
        <Text style={[styles.headerText, { color: themeColors.textPrimary }]}>
          {t('games.settings.title')}
        </Text>
        <Animated.View style={chevronRotateStyle}>
          <Icon name="chevron-down" size={24} color={themeColors.textSecondary} />
        </Animated.View>
      </HapticTouchable>

      {/* Collapsible content */}
      {expanded && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  headerText: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  content: {
    paddingTop: spacing.md,
  },
});
