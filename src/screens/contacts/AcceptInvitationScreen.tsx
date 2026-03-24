/**
 * AcceptInvitationScreen — Enter an invitation code to add a contact
 *
 * Flow:
 * 1. User enters a CE-XXXX-XXXX code (received via SMS/email/etc.)
 * 2. Downloads encrypted invitation blob from Invitation Relay
 * 3. Decrypts with code-derived key → reveals sender's contact info
 * 4. Shows sender name for confirmation
 * 5. Encrypts own contact data and uploads as response
 * 6. Saves sender as contact (trust level 2 — Connected)
 *
 * Senior-inclusive design:
 * - Large code input (28pt monospace)
 * - Auto-formatting as user types (CE-XXXX-XXXX)
 * - Clear status messages, no jargon
 * - Haptic feedback on success
 * - One primary action per state
 *
 * @see TRUST_AND_ATTESTATION_PLAN.md section 2.2
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useFeedback } from '@/hooks/useFeedback';
import { HapticTouchable, Icon, LoadingView, ScrollViewWithIndicator } from '@/components';
import type { ContactStackParams } from '@/navigation';
import {
  isValidInvitationCode,
  normalizeInvitationCode,
  downloadInvitation,
  decryptInvitation,
  isDecryptRateLimited,
  encryptInvitation,
  uploadResponse,
  isPayloadV2,
  getPayloadDisplayName,
} from '@/services/invitation';
import type { InvitationPayload, InvitationPayloadV2 } from '@/services/invitation';
import { ServiceContainer } from '@/services/container';

type NavigationProp = NativeStackNavigationProp<ContactStackParams, 'AcceptInvitation'>;

type ScreenState = 'input' | 'loading' | 'confirm' | 'saving' | 'success' | 'error';

export function AcceptInvitationScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();

  const [state, setState] = useState<ScreenState>('input');
  const [codeInput, setCodeInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderData, setSenderData] = useState<InvitationPayload | null>(null);

  // Format code as user types: auto-add CE- prefix and dashes
  const handleCodeChange = useCallback((text: string) => {
    // Normalize input: uppercase, remove extra spaces
    const normalized = normalizeInvitationCode(text);
    setCodeInput(normalized);
    setErrorMessage('');
  }, []);

  // Look up invitation by code
  const handleLookup = useCallback(async () => {
    const code = normalizeInvitationCode(codeInput);

    if (!isValidInvitationCode(code)) {
      setErrorMessage(t('contacts.accept.invalidCode', 'Deze code is niet geldig. Controleer de code en probeer opnieuw.'));
      return;
    }

    setState('loading');
    setErrorMessage('');

    try {
      // Download the invitation blob
      const invitation = await downloadInvitation(code);

      if (!invitation) {
        setState('error');
        setErrorMessage(t('contacts.accept.notFound', 'Deze uitnodiging is niet gevonden of is verlopen.'));
        return;
      }

      // Check rate limit before attempting decryption
      if (isDecryptRateLimited()) {
        setState('error');
        setErrorMessage(t('contacts.accept.rateLimited', 'Te veel pogingen. Wacht een minuut en probeer opnieuw.'));
        return;
      }

      // Decrypt the invitation
      const payload = await decryptInvitation(invitation.encrypted, invitation.nonce, code);

      if (!payload) {
        setState('error');
        setErrorMessage(t('contacts.accept.decryptFailed', 'De code klopt niet of de uitnodiging is beschadigd.'));
        return;
      }

      // Show sender info for confirmation
      setSenderName(getPayloadDisplayName(payload));
      setSenderData(payload);
      setState('confirm');
    } catch {
      setState('error');
      setErrorMessage(t('contacts.accept.errorLookup', 'Er ging iets mis. Controleer je internetverbinding en probeer opnieuw.'));
    }
  }, [codeInput, t]);

  // Accept the invitation — encrypt own data and upload response
  const handleAccept = useCallback(async () => {
    if (!senderData) return;

    setState('saving');

    try {
      // Get own identity data from AsyncStorage
      const [userUuid, publicKey, displayName, jid] = await Promise.all([
        AsyncStorage.getItem('@commeazy/user_uuid'),
        AsyncStorage.getItem('@commeazy/public_key'),
        AsyncStorage.getItem('@commeazy/display_name'),
        AsyncStorage.getItem('@commeazy/jid'),
      ]);

      if (!userUuid || !publicKey || !displayName || !jid) {
        throw new Error('Missing user profile data');
      }

      // Split display name into firstName + lastName for V2 payload
      const nameParts = displayName.trim().split(/\s+/);
      const firstName = nameParts[0] ?? displayName;
      const lastName = nameParts.slice(1).join(' ');

      // Build V2 response payload
      const responsePayload: InvitationPayloadV2 = {
        version: 2,
        uuid: userUuid,
        publicKey,
        jid,
        firstName,
        lastName,
      };

      // Enrich with optional profile fields from database
      try {
        const profile = await ServiceContainer.database.getUserProfile();
        if (profile) {
          if (profile.email) responsePayload.email = profile.email;
          if (profile.mobileNumber || profile.landlineNumber) {
            responsePayload.landlineNumber = profile.mobileNumber || profile.landlineNumber;
          }
          if (profile.addressStreet || profile.addressCity) {
            responsePayload.address = {
              street: profile.addressStreet,
              city: profile.addressCity,
              postalCode: profile.addressPostalCode,
              country: profile.addressCountry,
            };
          }
          if (profile.birthDate) responsePayload.birthDate = profile.birthDate;
        }
      } catch {
        // Profile enrichment is optional — continue without it
      }

      const code = normalizeInvitationCode(codeInput);

      // Encrypt own contact data with the same code
      const { encrypted, nonce } = await encryptInvitation(responsePayload, code);

      // Upload response to relay
      await uploadResponse(code, encrypted, nonce);

      // Save sender as contact in database
      const db = ServiceContainer.database;
      if (isPayloadV2(senderData)) {
        await db.saveContact({
          userUuid: senderData.uuid,
          jid: senderData.jid,
          firstName: senderData.firstName,
          lastName: senderData.lastName,
          publicKey: senderData.publicKey,
          verified: false,
          lastSeen: Date.now(),
          trustLevel: 2, // Connected via relay
          landlineNumber: senderData.landlineNumber,
          email: senderData.email,
          address: senderData.address,
          birthDate: senderData.birthDate,
        });
      } else {
        // V1 fallback: displayName → firstName, empty lastName
        await db.saveContact({
          userUuid: senderData.uuid,
          jid: senderData.jid,
          firstName: senderData.displayName,
          lastName: '',
          publicKey: senderData.publicKey,
          verified: false,
          lastSeen: Date.now(),
          trustLevel: 2,
        });
      }

      setState('success');
      void triggerFeedback('success');
    } catch {
      setState('error');
      setErrorMessage(t('contacts.accept.errorAccept', 'Kon de uitnodiging niet bevestigen. Probeer opnieuw.'));
    }
  }, [senderData, codeInput, t, triggerFeedback]);

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
        {/* Input state — enter code */}
        {state === 'input' && (
          <View style={styles.inputContent}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {t('contacts.accept.title', 'Code invoeren')}
            </Text>

            <Text style={[styles.instruction, { color: themeColors.textSecondary }]}>
              {t('contacts.accept.instruction', 'Voer de uitnodigingscode in die je hebt ontvangen')}
            </Text>

            {/* Code input */}
            <View style={styles.codeInputContainer}>
              <Text style={[styles.inputLabel, { color: themeColors.textPrimary }]}>
                {t('contacts.accept.codeLabel', 'Uitnodigingscode')}
              </Text>
              <TextInput
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: themeColors.surface,
                    color: themeColors.textPrimary,
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
                accessibilityLabel={t('contacts.accept.codeLabel', 'Uitnodigingscode')}
                accessibilityHint={t('contacts.accept.codeHint', 'Voer de code in die begint met CE')}
              />

              {/* Error message below input */}
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
              accessibilityLabel={t('contacts.accept.lookupButton', 'Code controleren')}
              accessibilityState={{ disabled: !isCodeComplete }}
            >
              <Icon name="search" size={24} color={themeColors.textOnPrimary} />
              <Text style={[styles.buttonText, { color: themeColors.textOnPrimary }]}>
                {t('contacts.accept.lookupButton', 'Code controleren')}
              </Text>
            </HapticTouchable>
          </View>
        )}

        {/* Loading state */}
        {state === 'loading' && (
          <View style={styles.centerContent}>
            <LoadingView message={t('contacts.accept.looking', 'Uitnodiging ophalen...')} />
          </View>
        )}

        {/* Confirm state — show sender name */}
        {state === 'confirm' && (
          <View style={styles.confirmContent}>
            <View style={[styles.avatarContainer, { backgroundColor: `${themeColors.primary}20` }]}>
              <Icon name="person" size={48} color={themeColors.primary} />
            </View>

            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {t('contacts.accept.confirmTitle', 'Uitnodiging gevonden')}
            </Text>

            <Text style={[styles.senderName, { color: themeColors.textPrimary }]}>
              {senderName}
            </Text>

            <Text style={[styles.instruction, { color: themeColors.textSecondary }]}>
              {t('contacts.accept.confirmMessage', {
                name: senderName,
                defaultValue: '{{name}} wil je toevoegen als contact. Wil je dat?',
              })}
            </Text>

            {/* Accept button */}
            <HapticTouchable
              style={[styles.primaryButton, { backgroundColor: themeColors.primary }]}
              onPress={() => void handleAccept()}
              accessibilityRole="button"
              accessibilityLabel={t('contacts.accept.acceptButton', 'Ja, toevoegen')}
            >
              <Icon name="checkmark" size={24} color={themeColors.textOnPrimary} />
              <Text style={[styles.buttonText, { color: themeColors.textOnPrimary }]}>
                {t('contacts.accept.acceptButton', 'Ja, toevoegen')}
              </Text>
            </HapticTouchable>

            {/* Cancel button */}
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

        {/* Saving state */}
        {state === 'saving' && (
          <View style={styles.centerContent}>
            <LoadingView message={t('contacts.accept.saving', 'Contact toevoegen...')} />
          </View>
        )}

        {/* Success state */}
        {state === 'success' && (
          <View style={styles.centerContent}>
            <View style={[styles.successIcon, { backgroundColor: `${themeColors.success}20` }]}>
              <Icon name="checkmark" size={48} color={themeColors.success || '#1B5E20'} />
            </View>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {t('contacts.accept.success', {
                name: senderName,
                defaultValue: '{{name}} is toegevoegd!',
              })}
            </Text>

            <Text style={[styles.instruction, { color: themeColors.textSecondary }]}>
              {t('contacts.accept.successHint', 'Je kunt nu berichten sturen en bellen.')}
            </Text>

            <HapticTouchable
              style={[styles.primaryButton, { backgroundColor: themeColors.primary }]}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t('common.done', 'Klaar')}
            >
              <Text style={[styles.buttonText, { color: themeColors.textOnPrimary }]}>
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
