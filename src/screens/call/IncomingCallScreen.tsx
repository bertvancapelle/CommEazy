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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { ContactAvatar, Icon } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { useCall } from '@/contexts/CallContext';
import { useColors } from '@/contexts/ThemeContext';
import { useVisualPresence } from '@/contexts/PresenceContext';
import { ServiceContainer } from '@/services/container';
import type { CallStackParams } from './types';

/** Wrapper to show presence + trustLevel on call avatar */
function CallContactAvatar({ name, jid, size, trustLevel }: { name: string; jid: string; size: number; trustLevel: number }) {
  const presence = useVisualPresence(jid);
  return <ContactAvatar name={name} size={size} trustLevel={trustLevel} presence={presence} />;
}

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

  // Guard against multiple goBack() calls (race between handler + useEffect)
  const isLeavingRef = useRef(false);
  const safeGoBack = useCallback(() => {
    if (!isLeavingRef.current && navigation.canGoBack()) {
      isLeavingRef.current = true;
      navigation.goBack();
    }
  }, [navigation]);

  // Pulsing animation for "Belt u..." text
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Get caller info from active call
  const caller = activeCall?.participants[0];
  const callerName = caller?.name || t('call.unknownCaller');
  const callerJid = caller?.jid || '';
  const isVideoCall = activeCall?.type === 'video';

  // Look up contact trustLevel from database
  const [callerTrustLevel, setCallerTrustLevel] = useState(0);
  useEffect(() => {
    if (!callerJid) return;
    ServiceContainer.database.getContact(callerJid).then(contact => {
      if (contact) setCallerTrustLevel(contact.trustLevel ?? 0);
    }).catch(() => {});
  }, [callerJid]);

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
      safeGoBack();
    } catch (error) {
      console.error('[IncomingCall] Failed to decline:', error);
    }
  };

  // If no active call, go back
  useEffect(() => {
    if (!activeCall || activeCall.state === 'ended') {
      safeGoBack();
    }
  }, [activeCall, safeGoBack]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={themeColors.textPrimary} />

      {/* Content */}
      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <CallContactAvatar
            name={callerName}
            jid={callerJid}
            size={200}
            trustLevel={callerTrustLevel}
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
        <HapticTouchable hapticDisabled
          style={[styles.actionButton, styles.declineButton]}
          onPress={handleDecline}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('call.decline')}
          accessibilityHint={t('call.declineHint')}
        >
          <Icon name="call" size={36} color={themeColors.textOnPrimary} />
          <Text style={[styles.buttonLabel, { color: themeColors.textOnPrimary }]}>{t('call.decline')}</Text>
        </HapticTouchable>

        {/* Answer button (right, green) */}
        <HapticTouchable hapticDisabled
          style={[styles.actionButton, styles.answerButton]}
          onPress={handleAnswer}
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
        </HapticTouchable>
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
