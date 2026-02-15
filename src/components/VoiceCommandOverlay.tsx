/**
 * VoiceCommandOverlay — Voice Command Listening UI
 *
 * Full-screen overlay displayed when voice commands are active.
 * Shows:
 * - Microphone animation indicating listening state
 * - Live transcript of recognized speech
 * - Command result feedback
 * - Close button
 *
 * Activated by two-finger long press (same timing as navigation wheel).
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useAccentColor } from '@/hooks/useAccentColor';
import type { VoiceCommandState, VoiceCommandResult } from '@/hooks/useVoiceCommands';

interface VoiceCommandOverlayProps {
  visible: boolean;
  voiceState: VoiceCommandState;
  onClose: () => void;
  onResult: (result: VoiceCommandResult | null) => void;
  processTranscript: (transcript: string) => VoiceCommandResult | null;
}

export function VoiceCommandOverlay({
  visible,
  voiceState,
  onClose,
  onResult,
  processTranscript,
}: VoiceCommandOverlayProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Track if we're already navigating to prevent duplicate navigation
  const isNavigatingRef = useRef(false);
  const lastProcessedResultRef = useRef<string | null>(null);

  // Pulse animation for microphone when listening
  useEffect(() => {
    if (visible && voiceState.isListening) {
      // Start pulsing animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [visible, voiceState.isListening, pulseAnim]);

  // Fade in animation when overlay appears
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Announce to screen readers
      AccessibilityInfo.announceForAccessibility(
        t('voiceCommands.listening', 'Listening for voice command...')
      );
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim, t]);

  // Reset navigation tracking when overlay closes
  useEffect(() => {
    if (!visible) {
      isNavigatingRef.current = false;
      lastProcessedResultRef.current = null;
    }
  }, [visible]);

  // NOTE: Auto-execute navigation is now handled by the callback pattern in HoldToNavigateWrapper
  // The useVoiceCommands hook calls onResultReadyRef.current directly when a result is ready
  // This avoids React state batching issues that prevented the state-based approach from working
  // The callback is registered in HoldToNavigateWrapper and fires the 800ms delayed navigation

  // Get status text based on current state
  const getStatusText = (): string => {
    if (voiceState.error) {
      return voiceState.error;
    }
    if (voiceState.isProcessing) {
      return t('voiceCommands.processing', 'Processing...');
    }
    if (voiceState.isListening) {
      return t('voiceCommands.listening', 'Listening...');
    }
    if (voiceState.lastResult) {
      if (voiceState.lastResult.type === 'unknown') {
        return t('voiceCommands.notUnderstood', 'Command not recognized. Try again.');
      }
      return t('voiceCommands.recognized', 'Command recognized!');
    }
    return t('voiceCommands.speakNow', 'Speak your command now');
  };

  // Get microphone color based on state (uses accent color from user settings)
  const getMicColor = (): string => {
    if (voiceState.error) return colors.error;
    if (voiceState.isListening) return accentColor.primary;
    if (voiceState.lastResult?.type === 'navigation' || voiceState.lastResult?.type === 'action') {
      return colors.success;
    }
    return accentColor.primary;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.backdrop}
          onPress={onClose}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel={t('common.close', 'Close')}
        />

        <View style={styles.content}>
          {/* Microphone icon with pulse animation */}
          <Animated.View
            style={[
              styles.micContainer,
              {
                transform: [{ scale: pulseAnim }],
                backgroundColor: getMicColor(),
              },
            ]}
          >
            <Text style={styles.micIcon}>🎤</Text>
          </Animated.View>

          {/* Status text */}
          <Text
            style={styles.statusText}
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
          >
            {getStatusText()}
          </Text>

          {/* Live transcript - label ABOVE and OUTSIDE the bordered field */}
          {voiceState.transcript ? (
            <View style={styles.transcriptWrapper}>
              {/* Label outside the field, small text */}
              <Text style={styles.transcriptLabel}>
                {t('voiceCommands.youSaid', 'Je zei')}
              </Text>
              {/* Bordered field containing only the transcript */}
              <View style={[styles.transcriptContainer, { borderColor: accentColor.primary }]}>
                <Text style={[styles.transcriptText, { color: accentColor.primary }]}>
                  "{voiceState.transcript}"
                </Text>
                {/* Show recognized destination if available */}
                {voiceState.lastResult?.type === 'navigation' && voiceState.lastResult.destination && (
                  <View style={[styles.recognizedBadge, { backgroundColor: accentColor.primary }]}>
                    <Text style={styles.recognizedBadgeText}>
                      {t('voiceCommands.navigatingTo', 'Navigating to:')} {voiceState.lastResult.destination}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : null}

          {/* Command examples */}
          {voiceState.isListening && !voiceState.transcript && (
            <View style={styles.examplesContainer}>
              <Text style={styles.examplesTitle}>
                {t('voiceCommands.examples', 'Try saying:')}
              </Text>
              <Text style={styles.exampleText}>
                "{t('voiceCommands.example.messages', 'Messages')}"
              </Text>
              <Text style={styles.exampleText}>
                "{t('voiceCommands.example.contacts', 'Contacts')}"
              </Text>
              <Text style={styles.exampleText}>
                "{t('voiceCommands.example.settings', 'Settings')}"
              </Text>
            </View>
          )}

          {/* Close button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: accentColor.primary }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
            accessibilityHint={t('voiceCommands.closeHint', 'Closes voice command overlay')}
          >
            <Text style={styles.closeButtonText}>
              {t('common.close', 'Close')}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    alignItems: 'center',
    padding: spacing.xl,
    width: '90%',
    maxWidth: 400,
  },
  micContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  micIcon: {
    fontSize: 48,
  },
  statusText: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  transcriptWrapper: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  transcriptLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  transcriptContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    padding: spacing.lg,
    width: '100%',
    minHeight: 80,
    justifyContent: 'center',
  },
  transcriptText: {
    ...typography.h2,
    fontWeight: '600',
    textAlign: 'center',
  },
  recognizedBadge: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    alignSelf: 'center',
  },
  recognizedBadgeText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  examplesContainer: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  examplesTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  exampleText: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  closeButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    minWidth: touchTargets.comfortable,
    minHeight: touchTargets.comfortable,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
});
