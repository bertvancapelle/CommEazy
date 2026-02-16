/**
 * FloatingMicIndicator — Voice Session Mode Indicator
 *
 * Compact floating microphone indicator shown during Voice Session Mode.
 * Features:
 * - Positioned in one of four corners (default: top-left)
 * - Pulsing animation when listening
 * - Tap to stop voice session
 * - Senior-friendly 60pt touch target
 * - Respects reduced motion preference
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, spacing, touchTargets, borderRadius, shadows } from '@/theme';
import { useAccentColor } from '@/hooks/useAccentColor';
import type { MicIndicatorPosition } from '@/hooks/useVoiceCommands';

interface FloatingMicIndicatorProps {
  /** Whether the indicator is visible */
  visible: boolean;
  /** Whether currently listening for voice input */
  isListening: boolean;
  /** Whether currently processing voice input */
  isProcessing?: boolean;
  /** Position of the indicator on screen */
  position: MicIndicatorPosition;
  /** Callback when indicator is tapped (to stop session) */
  onPress: () => void;
  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;
}

export function FloatingMicIndicator({
  visible,
  isListening,
  isProcessing = false,
  position,
  onPress,
  reducedMotion = false,
}: FloatingMicIndicatorProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const insets = useSafeAreaInsets();

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Fade in/out animation
  useEffect(() => {
    if (visible) {
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: reducedMotion ? 0 : 200,
        useNativeDriver: true,
      }).start();

      // Announce to screen readers
      AccessibilityInfo.announceForAccessibility(
        t('voiceCommands.sessionActive', 'Spraakbesturing actief')
      );
    } else {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: reducedMotion ? 0 : 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, opacityAnim, reducedMotion, t]);

  // Pulse animation when listening, faster pulse when processing
  useEffect(() => {
    if (visible && !reducedMotion) {
      if (isListening) {
        // Slow pulse when listening (ready for input)
        const pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
        pulse.start();
        return () => pulse.stop();
      } else if (isProcessing) {
        // Fast pulse when processing (thinking)
        const processingPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.08,
              duration: 200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
        processingPulse.start();
        return () => processingPulse.stop();
      }
    }
    // Idle state - no animation
    pulseAnim.setValue(1);
  }, [visible, isListening, isProcessing, reducedMotion, pulseAnim]);

  if (!visible) return null;

  // Calculate position based on corner
  // For top positions, align vertically with the navigation header title
  // Navigation header is typically 44-56pt high, so we add an offset to center with the title
  const getPositionStyle = () => {
    const margin = spacing.md;
    // Offset to align with navigation title (approximately center of header bar)
    // Header is ~44pt, indicator is 60pt, so offset = (44 - 60) / 2 + some padding = ~6pt
    // This places the mic indicator horizontally aligned with the screen title
    const headerOffset = 6;
    const baseStyle: any = {
      position: 'absolute' as const,
    };

    switch (position) {
      case 'top-left':
        return {
          ...baseStyle,
          top: insets.top + headerOffset,
          left: margin,
        };
      case 'top-right':
        return {
          ...baseStyle,
          top: insets.top + headerOffset,
          right: margin,
        };
      case 'bottom-left':
        return {
          ...baseStyle,
          bottom: insets.bottom + margin + 80, // Above tab bar
          left: margin,
        };
      case 'bottom-right':
        return {
          ...baseStyle,
          bottom: insets.bottom + margin + 80, // Above tab bar
          right: margin,
        };
      default:
        return {
          ...baseStyle,
          top: insets.top + headerOffset,
          right: margin,
        };
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        getPositionStyle(),
        { opacity: opacityAnim },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('voiceCommands.tapToStop', 'Tik om spraakbesturing te stoppen')}
        accessibilityHint={t('voiceCommands.tapToStopHint', 'Stopt de spraakbesturing sessie')}
        accessibilityState={{ expanded: isListening }}
      >
        <Animated.View
          style={[
            styles.indicator,
            {
              // Three states:
              // - Listening: full accent color (active input)
              // - Processing: full accent color (thinking)
              // - Idle: faded accent color (waiting)
              backgroundColor: (isListening || isProcessing) ? accentColor.primary : `${accentColor.primary}40`,
              borderWidth: (isListening || isProcessing) ? 0 : 3,
              borderColor: accentColor.primary,
              transform: [{ scale: pulseAnim }],
            },
            Platform.OS === 'ios' ? shadows.medium : { elevation: 4 },
          ]}
        >
          <Text style={styles.micIcon}>{isProcessing ? '⏳' : '🎤'}</Text>
          {isListening && (
            <View style={[styles.listeningDot, { borderColor: accentColor.primary }]} />
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
  },
  indicator: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micIcon: {
    fontSize: 28,
  },
  listeningDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: colors.surface, // White dot (B+D: always contrasts)
    // borderColor set dynamically to accentColor.primary
  },
});
