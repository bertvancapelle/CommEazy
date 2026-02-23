/**
 * IncomingCallScreen — Full-screen incoming call UI
 *
 * Displays when receiving a call:
 * - Large avatar (200x200)
 * - Caller name (32pt)
 * - "Belt u..." pulsing text (24pt)
 * - Answer button (green, 84pt) — right side
 * - Decline button (red, 84pt) — left side
 *
 * Senior-inclusive design:
 * - 84pt touch targets (exceeds 60pt minimum)
 * - High contrast colors
 * - Clear iconography with labels
 * - Haptic feedback on button press
 *
 * @see CLAUDE.md UI Specifications
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { ContactAvatar, Icon } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { useCall } from '@/contexts/CallContext';
import { useColors } from '@/contexts/ThemeContext';
import type { CallStackParams } from './types';

// ============================================================
// Types
// ============================================================

type Props = NativeStackScreenProps<CallStackParams, 'IncomingCall'>;

// ============================================================
// Component
// ============================================================

export function IncomingCallScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();
  const themeColors = useColors();
  const { activeCall, answerCall, declineCall, getContactName } = useCall();

  // Pulsing animation for "Belt u..." text
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Get caller info from active call
  const caller = activeCall?.participants[0];
  const callerName = caller?.name || t('call.unknownCaller');
  const callerJid = caller?.jid || '';
  const isVideoCall = activeCall?.type === 'video';

  // Start pulsing animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  // Handle answer
  const handleAnswer = async () => {
    void triggerFeedback('tap');
    try {
      await answerCall();
      // Navigate to active call screen
      navigation.replace('ActiveCall', { callId: activeCall?.id || '' });
    } catch (error) {
      console.error('[IncomingCall] Failed to answer:', error);
    }
  };

  // Handle decline
  const handleDecline = async () => {
    void triggerFeedback('tap');
    try {
      await declineCall();
      navigation.goBack();
    } catch (error) {
      console.error('[IncomingCall] Failed to decline:', error);
    }
  };

  // If no active call, go back
  useEffect(() => {
    if (!activeCall || activeCall.state === 'ended') {
      navigation.goBack();
    }
  }, [activeCall, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={themeColors.textPrimary} />

      {/* Content */}
      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <ContactAvatar
            name={callerName}
            size={200}
          />
        </View>

        {/* Caller name */}
        <Text style={[styles.callerName, { color: themeColors.textOnPrimary }]} numberOfLines={2}>
          {callerName}
        </Text>

        {/* Call type indicator */}
        <Animated.View style={[styles.callingContainer, { opacity: pulseAnim }]}>
          <Icon
            name={isVideoCall ? 'videocam' : 'call'}
            size={24}
            color={themeColors.textOnPrimary}
          />
          <Text style={[styles.callingText, { color: themeColors.textOnPrimary }]}>
            {isVideoCall ? t('call.videoCallIncoming') : t('call.voiceCallIncoming')}
          </Text>
        </Animated.View>
      </View>

      {/* Action buttons */}
      <View style={styles.buttonContainer}>
        {/* Decline button (left, red) */}
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={handleDecline}
          onLongPress={() => {}} // Prevent hold gesture double-action
          delayLongPress={300}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('call.decline')}
          accessibilityHint={t('call.declineHint')}
        >
          <Icon name="call" size={36} color={themeColors.textOnPrimary} />
          <Text style={[styles.buttonLabel, { color: themeColors.textOnPrimary }]}>{t('call.decline')}</Text>
        </TouchableOpacity>

        {/* Answer button (right, green) */}
        <TouchableOpacity
          style={[styles.actionButton, styles.answerButton]}
          onPress={handleAnswer}
          onLongPress={() => {}} // Prevent hold gesture double-action
          delayLongPress={300}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('call.answer')}
          accessibilityHint={t('call.answerHint')}
        >
          <Icon
            name={isVideoCall ? 'videocam' : 'call'}
            size={36}
            color={themeColors.textOnPrimary}
          />
          <Text style={[styles.buttonLabel, { color: themeColors.textOnPrimary }]}>{t('call.answer')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A', // Dark background for contrast
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  avatarContainer: {
    marginBottom: spacing.xl,
    // Add subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  callerName: {
    ...typography.h1,
    // color applied dynamically via themeColors
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  callingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  callingText: {
    ...typography.h3,
    // color applied dynamically via themeColors
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  actionButton: {
    width: touchTargets.large,
    height: touchTargets.large + 24, // Extra height for label
    borderRadius: touchTargets.large / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
  },
  declineButton: {
    backgroundColor: colors.error,
  },
  answerButton: {
    backgroundColor: colors.success,
  },
  buttonLabel: {
    ...typography.label,
    // color applied dynamically via themeColors
    marginTop: spacing.xs,
  },
});
