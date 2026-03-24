/**
 * InvitationCodeScreen (Onboarding)
 *
 * iPad standalone onboarding path: user received an invitation code
 * from a family member and enters it during first-time setup.
 *
 * Flow:
 * 1. User enters CE-XXXX-XXXX code
 * 2. Downloads encrypted invitation blob from Invitation Relay
 * 3. Decrypts with code-derived key → reveals sender's contact info
 * 4. Shows sender name for confirmation
 * 5. Generates own UUID + keypair
 * 6. Encrypts own contact data and uploads as response
 * 7. Saves sender as first contact (trust level 2 — Connected)
 * 8. Continues to NameInput → PinSetup → Demographics → Completion
 *
 * Senior-inclusive design:
 * - Large code input (28pt monospace)
 * - Auto-formatting (CE-XXXX-XXXX)
 * - Clear status messages, no jargon
 * - Haptic feedback on success
 * - One primary action per state
 *
 * @see TRUST_AND_ATTESTATION_PLAN.md section 4.3
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useLabelStyle, useFieldTextStyle } from '@/contexts/FieldTextStyleContext';
import { useFeedback } from '@/hooks/useFeedback';
import { HapticTouchable, Icon, LoadingView, ProgressIndicator , ScrollViewWithIndicator } from '@/components';
import type { OnboardingStackParams } from '@/navigation';
import {
  isValidInvitationCode,
  normalizeInvitationCode,
  downloadInvitation,
  decryptInvitation,
  isDecryptRateLimited,
  encryptInvitation,
  uploadResponse,
  getPayloadDisplayName,
} from '@/services/invitation';
import type { InvitationPayload } from '@/services/invitation';

type Props = NativeStackScreenProps<OnboardingStackParams, 'InvitationCode'>;

type ScreenState = 'input' | 'loading' | 'confirm' | 'setting-up' | 'success' | 'error';

export function InvitationCodeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const labelStyle = useLabelStyle();
  const fieldTextStyle = useFieldTextStyle();
  const { triggerFeedback } = useFeedback();

  const [state, setState] = useState<ScreenState>('input');
  const [codeInput, setCodeInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderData, setSenderData] = useState<InvitationPayload | null>(null);

  // Format code as user types
  const handleCodeChange = useCallback((text: string) => {
    const normalized = normalizeInvitationCode(text);
    setCodeInput(normalized);
    setErrorMessage('');
  }, []);

  // Look up invitation by code
  const handleLookup = useCallback(async () => {
    const code = normalizeInvitationCode(codeInput);

    if (!isValidInvitationCode(code)) {
      setErrorMessage(t('onboarding.invitationCode.invalidCode', 'Deze code is niet geldig. Controleer de code en probeer opnieuw.'));
      return;
    }

    setState('loading');
    setErrorMessage('');

    try {
      const invitation = await downloadInvitation(code);

      if (!invitation) {
        setState('error');
        setErrorMessage(t('onboarding.invitationCode.notFound', 'Deze uitnodiging is niet gevonden of is verlopen.'));
        return;
      }

      // Check rate limit before attempting decryption
      if (isDecryptRateLimited()) {
        setState('error');
        setErrorMessage(t('contacts.accept.rateLimited', 'Te veel pogingen. Wacht een minuut en probeer opnieuw.'));
        return;
      }

      const payload = await decryptInvitation(invitation.encrypted, invitation.nonce, code);

      if (!payload) {
        setState('error');
        setErrorMessage(t('onboarding.invitationCode.decryptFailed', 'De code klopt niet of de uitnodiging is beschadigd.'));
        return;
      }

      setSenderName(getPayloadDisplayName(payload));
      setSenderData(payload);
      setState('confirm');
    } catch {
      setState('error');
      setErrorMessage(t('onboarding.invitationCode.errorLookup', 'Er ging iets mis. Controleer je internetverbinding en probeer opnieuw.'));
    }
  }, [codeInput, t]);

  // Accept invitation: generate UUID + keypair, encrypt own data, upload response
  const handleAccept = useCallback(async () => {
    if (!senderData) return;

    setState('setting-up');

    try {
      // Generate a new UUID for this device
      const { default: uuid } = await import('react-native-uuid');
      const userUuid = uuid.v4() as string;
      const jid = `${userUuid}@commeazy.local`;

      // Generate keypair
      // TODO: Use real libsodium keypair generation when available
      // For now, store placeholder — real keys generated in PinSetup
      const publicKey = 'pending-key-generation';

      // Store identity in AsyncStorage for later steps
      await AsyncStorage.multiSet([
        ['@commeazy/user_uuid', userUuid],
        ['@commeazy/jid', jid],
        ['@commeazy/public_key', publicKey],
        ['@commeazy/onboarding_via', 'invitation'],
        ['@commeazy/first_contact_uuid', senderData.uuid],
        ['@commeazy/first_contact_jid', senderData.jid],
        ['@commeazy/first_contact_name', getPayloadDisplayName(senderData)],
        ['@commeazy/first_contact_pubkey', senderData.publicKey],
      ]);

      const code = normalizeInvitationCode(codeInput);

      // Encrypt own contact data with the invitation code (V2 payload)
      // Note: during onboarding, user hasn't entered name yet, so we send "New User"
      const { encrypted, nonce } = await encryptInvitation(
        { version: 2, uuid: userUuid, publicKey, jid, firstName: 'New', lastName: 'User' },
        code,
      );

      // Upload response to relay so the inviter gets our contact info
      await uploadResponse(code, encrypted, nonce);

      setState('success');
      void triggerFeedback('success');
    } catch {
      setState('error');
      setErrorMessage(t('onboarding.invitationCode.errorSetup', 'Kon het account niet aanmaken. Probeer opnieuw.'));
    }
  }, [senderData, codeInput, t, triggerFeedback]);

  // Continue to PIN setup (next onboarding step)
  const handleContinue = useCallback(() => {
    navigation.navigate('PinSetup');
  }, [navigation]);

  // Reset to input state
  const handleRetry = useCallback(() => {
    setState('input');
    setErrorMessage('');
    setSenderData(null);
    setSenderName('');
  }, []);

  const isCodeComplete = isValidInvitationCode(normalizeInvitationCode(codeInput));

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollViewWithIndicator
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <ProgressIndicator currentStep={2} totalSteps={5} />

        {/* Input state — enter code */}
        {state === 'input' && (
          <View style={styles.inputContent}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {t('onboarding.invitationCode.title', 'Code invoeren')}
            </Text>

            <Text style={[styles.instruction, { color: themeColors.textSecondary }]}>
              {t('onboarding.invitationCode.instruction', 'Voer de code in die je van een familielid hebt ontvangen')}
            </Text>

            {/* Code input */}
            <View style={styles.codeInputContainer}>
              <Text style={[styles.inputLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
                {t('onboarding.invitationCode.codeLabel', 'Uitnodigingscode')}
              </Text>
              <TextInput
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: themeColors.surface,
                    color: fieldTextStyle.color,
                    fontWeight: fieldTextStyle.fontWeight,
                    fontStyle: fieldTextStyle.fontStyle,
                    borderColor: errorMessage ? themeColors.error : themeColors.border,
                  },
                ]}
                placeholder="CE-XXXX-XXXX-XXXX"
                placeholderTextColor={themeColors.textTertiary}
                value={codeInput}
                onChangeText={handleCodeChange}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={17}
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (isCodeComplete) {
                    void handleLookup();
                  }
                }}
                accessibilityLabel={t('onboarding.invitationCode.codeLabel', 'Uitnodigingscode')}
                accessibilityHint={t('onboarding.invitationCode.codeHint', 'Voer de code in die begint met CE')}
              />

              {errorMessage && state === 'input' ? (
                <Text style={[styles.errorInline, { color: themeColors.error }]}>
                  {errorMessage}
                </Text>
              ) : null}
            </View>

            {/* Lookup button */}
            <HapticTouchable
              style={[
                styles.primaryButton,
                {
                  backgroundColor: isCodeComplete
                    ? themeColors.primary
                    : themeColors.disabled,
                },
              ]}
              onPress={() => void handleLookup()}
              disabled={!isCodeComplete}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.invitationCode.lookupButton', 'Code controleren')}
              accessibilityState={{ disabled: !isCodeComplete }}
            >
              <Icon name="search" size={24} color={themeColors.textOnPrimary} />
              <Text style={[styles.buttonText, { color: themeColors.textOnPrimary }]}>
                {t('onboarding.invitationCode.lookupButton', 'Code controleren')}
              </Text>
            </HapticTouchable>
          </View>
        )}

        {/* Loading state */}
        {state === 'loading' && (
          <View style={styles.centerContent}>
            <LoadingView message={t('onboarding.invitationCode.looking', 'Uitnodiging ophalen...')} />
          </View>
        )}

        {/* Confirm state — show sender name */}
        {state === 'confirm' && (
          <View style={styles.confirmContent}>
            <View style={[styles.avatarContainer, { backgroundColor: `${themeColors.primary}20` }]}>
              <Icon name="person" size={48} color={themeColors.primary} />
            </View>

            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {t('onboarding.invitationCode.confirmTitle', 'Uitnodiging gevonden')}
            </Text>

            <Text style={[styles.senderName, { color: themeColors.textPrimary }]}>
              {senderName}
            </Text>

            <Text style={[styles.instruction, { color: themeColors.textSecondary }]}>
              {t('onboarding.invitationCode.confirmMessage', {
                name: senderName,
                defaultValue: '{{name}} heeft je uitgenodigd. Wil je doorgaan?',
              })}
            </Text>

            <HapticTouchable
              style={[styles.primaryButton, { backgroundColor: themeColors.primary }]}
              onPress={() => void handleAccept()}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.invitationCode.acceptButton', 'Ja, doorgaan')}
            >
              <Icon name="checkmark" size={24} color={themeColors.textOnPrimary} />
              <Text style={[styles.buttonText, { color: themeColors.textOnPrimary }]}>
                {t('onboarding.invitationCode.acceptButton', 'Ja, doorgaan')}
              </Text>
            </HapticTouchable>

            <HapticTouchable
              style={[styles.secondaryButton, { borderColor: themeColors.border }]}
              onPress={handleRetry}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel', 'Annuleren')}
            >
              <Text style={[styles.secondaryButtonText, { color: themeColors.textSecondary }]}>
                {t('common.cancel', 'Annuleren')}
              </Text>
            </HapticTouchable>
          </View>
        )}

        {/* Setting up state */}
        {state === 'setting-up' && (
          <View style={styles.centerContent}>
            <LoadingView message={t('onboarding.invitationCode.settingUp', 'Account aanmaken...')} />
          </View>
        )}

        {/* Success state */}
        {state === 'success' && (
          <View style={styles.centerContent}>
            <View style={[styles.successIcon, { backgroundColor: `${themeColors.success}20` }]}>
              <Icon name="checkmark" size={48} color={themeColors.success || '#1B5E20'} />
            </View>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {t('onboarding.invitationCode.success', {
                name: senderName,
                defaultValue: '{{name}} wordt je eerste contact!',
              })}
            </Text>

            <Text style={[styles.instruction, { color: themeColors.textSecondary }]}>
              {t('onboarding.invitationCode.successHint', 'Nog een paar stappen om je profiel in te stellen.')}
            </Text>

            <HapticTouchable
              style={[styles.primaryButton, { backgroundColor: themeColors.primary }]}
              onPress={handleContinue}
              accessibilityRole="button"
              accessibilityLabel={t('common.continue', 'Doorgaan')}
            >
              <Text style={[styles.buttonText, { color: themeColors.textOnPrimary }]}>
                {t('common.continue', 'Doorgaan')}
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
              style={[styles.primaryButton, { backgroundColor: themeColors.primary }]}
              onPress={handleRetry}
              accessibilityRole="button"
              accessibilityLabel={t('common.tryAgain', 'Probeer opnieuw')}
            >
              <Text style={[styles.buttonText, { color: themeColors.textOnPrimary }]}>
                {t('common.tryAgain', 'Probeer opnieuw')}
              </Text>
            </HapticTouchable>
          </View>
        )}
      </ScrollViewWithIndicator>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
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
  inputContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  confirmContent: {
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
    paddingHorizontal: spacing.md,
  },
  codeInputContainer: {
    width: '100%',
    marginVertical: spacing.lg,
  },
  inputLabel: {
    ...typography.label,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  codeInput: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    minHeight: touchTargets.large,
  },
  errorInline: {
    ...typography.label,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  senderName: {
    ...typography.h2,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    minWidth: 200,
    marginTop: spacing.lg,
  },
  buttonText: {
    ...typography.body,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    minWidth: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    ...typography.body,
    fontWeight: '600',
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
});
