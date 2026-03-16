/**
 * InviteContactScreen — Generate and share invitation codes
 *
 * Flow:
 * 1. Screen generates a CE-XXXX-XXXX code
 * 2. Encrypts user's contact data with code-derived key
 * 3. Uploads encrypted blob to Invitation Relay
 * 4. Shows code + Share button (iOS Share Sheet)
 * 5. Polls for response (acceptor's contact data)
 * 6. On response: decrypts, saves contact, shows success
 *
 * Senior-inclusive design:
 * - Large, clear invitation code display (24pt+)
 * - One-tap sharing via native Share Sheet
 * - Clear status messages during polling
 * - No technical jargon
 * - Haptic feedback on success
 *
 * @see TRUST_AND_ATTESTATION_PLAN.md section 2.2
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Share,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useFeedback } from '@/hooks/useFeedback';
import { HapticTouchable, Icon, LoadingView, ScrollViewWithIndicator } from '@/components';
import type { ContactStackParams } from '@/navigation';
import {
  generateInvitationCode,
  encryptInvitation,
  decryptInvitation,
  uploadInvitation,
  pollForResponse,
  isPayloadV2,
  getPayloadDisplayName,
} from '@/services/invitation';
import type { InvitationPayloadV2 } from '@/services/invitation';
import { ServiceContainer } from '@/services/container';

type NavigationProp = NativeStackNavigationProp<ContactStackParams, 'InviteContact'>;

type ScreenState = 'generating' | 'ready' | 'waiting' | 'success' | 'error';

export function InviteContactScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();

  const [state, setState] = useState<ScreenState>('generating');
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [acceptorName, setAcceptorName] = useState('');
  const pollingRef = useRef(false);

  // Generate code and upload on mount
  useEffect(() => {
    generateAndUpload();
  }, []);

  const generateAndUpload = useCallback(async () => {
    setState('generating');
    setErrorMessage('');

    try {
      // Get identity data from AsyncStorage
      const [userUuid, publicKey, displayName, jid] = await Promise.all([
        AsyncStorage.getItem('@commeazy/user_uuid'),
        AsyncStorage.getItem('@commeazy/public_key'),
        AsyncStorage.getItem('@commeazy/display_name'),
        AsyncStorage.getItem('@commeazy/jid'),
      ]);

      if (!userUuid || !publicKey || !displayName || !jid) {
        throw new Error('Missing user profile data');
      }

      // Split display name into firstName + lastName
      const nameParts = displayName.trim().split(/\s+/);
      const firstName = nameParts[0] ?? displayName;
      const lastName = nameParts.slice(1).join(' ');

      // Build V2 payload with optional profile fields from database
      const payload: InvitationPayloadV2 = {
        version: 2,
        uuid: userUuid,
        publicKey,
        jid,
        firstName,
        lastName,
      };

      // Enrich with optional profile fields (if user profile exists in DB)
      try {
        const profile = await ServiceContainer.database.getUserProfile();
        if (profile) {
          if (profile.email) payload.email = profile.email;
          if (profile.mobileNumber || profile.phoneNumber) {
            payload.phoneNumber = profile.mobileNumber || profile.phoneNumber;
          }
          if (profile.addressStreet || profile.addressCity) {
            payload.address = {
              street: profile.addressStreet,
              city: profile.addressCity,
              postalCode: profile.addressPostalCode,
              country: profile.addressCountry,
            };
          }
          if (profile.birthDate) payload.birthDate = profile.birthDate;
        }
      } catch {
        // Profile enrichment is optional — continue without it
      }

      // Generate invitation code
      const newCode = generateInvitationCode();
      setCode(newCode);

      // Encrypt contact data
      const { encrypted, nonce } = await encryptInvitation(payload, newCode);

      // Upload to relay
      await uploadInvitation(newCode, encrypted, nonce);

      setState('ready');
    } catch {
      setState('error');
      setErrorMessage(t('contacts.invite.errorGenerating', 'Er ging iets mis. Probeer opnieuw.'));
    }
  }, [t]);

  const handleShare = useCallback(async () => {
    void triggerFeedback('tap');

    try {
      const message = t('contacts.invite.shareMessage', {
        code,
        defaultValue: 'Ik wil je toevoegen in CommEazy! Download de app en voer deze code in: {{code}}',
      });

      await Share.share({ message });

      // Start polling for response
      setState('waiting');
      pollingRef.current = true;
      startPolling();
    } catch {
      // User cancelled share — that's ok
    }
  }, [code, t, triggerFeedback]);

  const startPolling = useCallback(async () => {
    if (!pollingRef.current || !code) return;

    const response = await pollForResponse(code, 5000, 120);

    if (!pollingRef.current) return;

    if (response) {
      // Decrypt the response
      const payload = await decryptInvitation(response.encrypted, response.nonce, code);
      if (payload) {
        // Save acceptor as contact
        const acceptorUuid = payload.uuid;
        const db = ServiceContainer.database;
        if (isPayloadV2(payload)) {
          await db.saveContact({
            userUuid: acceptorUuid,
            jid: payload.jid,
            firstName: payload.firstName,
            lastName: payload.lastName,
            publicKey: payload.publicKey,
            verified: false,
            lastSeen: Date.now(),
            trustLevel: 2, // Connected via relay
            phoneNumber: payload.phoneNumber,
            email: payload.email,
            address: payload.address,
            birthDate: payload.birthDate,
          });
        } else {
          // V1 fallback: displayName → firstName, empty lastName
          await db.saveContact({
            userUuid: acceptorUuid,
            jid: payload.jid,
            firstName: payload.displayName,
            lastName: '',
            publicKey: payload.publicKey,
            verified: false,
            lastSeen: Date.now(),
            trustLevel: 2,
          });
        }
        setAcceptorName(getPayloadDisplayName(payload));
        setState('success');
        void triggerFeedback('success');
      } else {
        setState('error');
        setErrorMessage(t('contacts.invite.decryptFailed', 'Kon de gegevens niet ontcijferen.'));
      }
    }
    // If null: timeout — user can retry
  }, [code, t, triggerFeedback]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRef.current = false;
    };
  }, []);

  return (
    <ScrollViewWithIndicator
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Generating state */}
      {state === 'generating' && (
        <View style={styles.centerContent}>
          <LoadingView message={t('contacts.invite.generating', 'Code aanmaken...')} />
        </View>
      )}

      {/* Ready state — show code + share button */}
      {state === 'ready' && (
        <View style={styles.readyContent}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {t('contacts.invite.title', 'Iemand uitnodigen')}
          </Text>

          <Text style={[styles.instruction, { color: themeColors.textSecondary }]}>
            {t('contacts.invite.codeLabel', 'Jouw uitnodigingscode')}
          </Text>

          {/* Invitation code display */}
          <View style={[styles.codeContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <Text style={[styles.codeText, { color: themeColors.textPrimary }]}>
              {code}
            </Text>
          </View>

          {/* Share button */}
          <HapticTouchable
            style={[styles.shareButton, { backgroundColor: themeColors.primary }]}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel={t('contacts.invite.shareButton', 'Stuur code')}
          >
            <Icon name="share" size={24} color={themeColors.textOnPrimary} />
            <Text style={[styles.shareButtonText, { color: themeColors.textOnPrimary }]}>
              {t('contacts.invite.shareButton', 'Stuur code')}
            </Text>
          </HapticTouchable>

          {/* Expiry notice */}
          <Text style={[styles.expiryText, { color: themeColors.textSecondary }]}>
            {t('contacts.invite.expiry', 'Deze code is 7 dagen geldig')}
          </Text>
        </View>
      )}

      {/* Waiting state — polling for response */}
      {state === 'waiting' && (
        <View style={styles.centerContent}>
          <LoadingView message={t('contacts.invite.waitingTitle', 'Wachten op reactie')} />
          <Text style={[styles.instruction, { color: themeColors.textSecondary }]}>
            {t('contacts.invite.waitingSubtitle', {
              defaultValue: 'Zodra de ander de code invult, worden jullie verbonden',
            })}
          </Text>

          {/* Show the code again for reference */}
          <View style={[styles.codeContainerSmall, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <Text style={[styles.codeTextSmall, { color: themeColors.textPrimary }]}>
              {code}
            </Text>
          </View>
        </View>
      )}

      {/* Success state */}
      {state === 'success' && (
        <View style={styles.centerContent}>
          <View style={[styles.successIcon, { backgroundColor: `${themeColors.success}20` }]}>
            <Icon name="checkmark" size={48} color={themeColors.success || '#1B5E20'} />
          </View>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {t('contacts.invite.success', {
              name: acceptorName,
              defaultValue: '{{name}} is toegevoegd!',
            })}
          </Text>

          <HapticTouchable
            style={[styles.doneButton, { backgroundColor: themeColors.primary }]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('common.done', 'Klaar')}
          >
            <Text style={[styles.doneButtonText, { color: themeColors.textOnPrimary }]}>
              {t('common.done', 'Klaar')}
            </Text>
          </HapticTouchable>
        </View>
      )}

      {/* Error state */}
      {state === 'error' && (
        <View style={styles.centerContent}>
          <View style={[styles.errorIcon, { backgroundColor: `${themeColors.error}20` }]}>
            <Icon name="warning" size={48} color={themeColors.error} />
          </View>
          <Text style={[styles.errorText, { color: themeColors.textPrimary }]}>
            {errorMessage}
          </Text>

          <HapticTouchable
            style={[styles.retryButton, { backgroundColor: themeColors.primary }]}
            onPress={generateAndUpload}
            accessibilityRole="button"
            accessibilityLabel={t('common.tryAgain', 'Probeer opnieuw')}
          >
            <Text style={[styles.retryButtonText, { color: themeColors.textOnPrimary }]}>
              {t('common.tryAgain', 'Probeer opnieuw')}
            </Text>
          </HapticTouchable>
        </View>
      )}
    </ScrollViewWithIndicator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  readyContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    textAlign: 'center',
  },
  instruction: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  codeContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    marginVertical: spacing.lg,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  codeContainerSmall: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  codeTextSmall: {
    ...typography.body,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    minWidth: 200,
  },
  shareButtonText: {
    ...typography.body,
    fontWeight: '700',
  },
  expiryText: {
    ...typography.label,
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    textAlign: 'center',
  },
  doneButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    minWidth: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  doneButtonText: {
    ...typography.body,
    fontWeight: '700',
  },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    minWidth: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  retryButtonText: {
    ...typography.body,
    fontWeight: '700',
  },
});
