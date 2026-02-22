/**
 * AddContactScreen — Add a new contact manually
 *
 * Senior-inclusive design:
 * - Large input fields (60pt+)
 * - Clear labels
 * - Country code selector
 * - Validation feedback
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useFeedback } from '@/hooks/useFeedback';
import type { ContactStackParams } from '@/navigation';
import { ServiceContainer } from '@/services/container';

type NavigationProp = NativeStackNavigationProp<ContactStackParams, 'AddContact'>;

// Common country codes
const COUNTRY_CODES = [
  { code: '+31', country: 'NL' },
  { code: '+32', country: 'BE' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+34', country: 'ES' },
  { code: '+44', country: 'UK' },
  { code: '+1', country: 'US' },
];

export function AddContactScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { triggerFeedback } = useFeedback();

  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+31');
  const [showCountryCodes, setShowCountryCodes] = useState(false);
  const [saving, setSaving] = useState(false);

  const isValidPhone = useCallback((phone: string): boolean => {
    // Basic validation: at least 6 digits
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 6 && digitsOnly.length <= 15;
  }, []);

  const isValidName = useCallback((n: string): boolean => {
    return n.trim().length >= 1;
  }, []);

  const canSave = isValidName(name) && isValidPhone(phoneNumber);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;

    void triggerFeedback('tap');
    setSaving(true);

    try {
      const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;

      // Generate a JID from phone number (simplified - in production use server)
      const jid = `${fullPhoneNumber.replace(/\+/g, '')}@commeazy.app`;

      if (__DEV__) {
        // In dev mode, just log and navigate back (mock data is in memory)
        console.log('[DEV] Would save contact:', {
          jid,
          name: name.trim(),
          phoneNumber: fullPhoneNumber,
        });
      } else {
        // Production: use real database service
        const db = ServiceContainer.database;
        await db.saveContact({
          jid,
          name: name.trim(),
          phoneNumber: fullPhoneNumber,
          publicKey: '', // Will be set when contact shares their key
          verified: false,
          lastSeen: Date.now(),
        });
      }

      navigation.goBack();
    } catch (error) {
      console.error('Failed to save contact:', error);
      Alert.alert(t('errors.genericError'));
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, countryCode, phoneNumber, name, navigation, t, triggerFeedback]);

  const toggleCountryCodes = useCallback(() => {
    void triggerFeedback('tap');
    setShowCountryCodes((prev) => !prev);
  }, [triggerFeedback]);

  const selectCountryCode = useCallback((code: string) => {
    void triggerFeedback('tap');
    setCountryCode(code);
    setShowCountryCodes(false);
  }, [triggerFeedback]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('contacts.nameLabel')}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('contacts.namePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel={t('contacts.nameLabel')}
            accessibilityHint={t('accessibility.enterContactName')}
          />
        </View>

        {/* Phone number input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('contacts.phoneLabel')}</Text>
          <View style={styles.phoneInputContainer}>
            {/* Country code selector */}
            <TouchableOpacity
              style={styles.countryCodeButton}
              onPress={toggleCountryCodes}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.countryCode')}
              accessibilityHint={t('accessibility.selectCountryCode')}
            >
              <Text style={styles.countryCodeText}>{countryCode}</Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>

            {/* Phone number */}
            <TextInput
              style={styles.phoneInput}
              placeholder={t('contacts.phonePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              returnKeyType="done"
              accessibilityLabel={t('contacts.phoneLabel')}
              accessibilityHint={t('accessibility.enterPhoneNumber')}
            />
          </View>

          {/* Country code dropdown */}
          {showCountryCodes && (
            <View style={styles.countryCodeDropdown}>
              {COUNTRY_CODES.map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={styles.countryCodeOption}
                  onPress={() => selectCountryCode(item.code)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.country} ${item.code}`}
                >
                  <Text style={styles.countryCodeOptionText}>
                    {item.country} {item.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Hint text */}
        <Text style={styles.hintText}>{t('contacts.addHint')}</Text>

        {/* Save button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            !canSave && styles.saveButtonDisabled,
          ]}
          onPress={() => void handleSave()}
          disabled={!canSave || saving}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.save')}
          accessibilityState={{ disabled: !canSave }}
        >
          <Text
            style={[
              styles.saveButtonText,
              !canSave && styles.saveButtonTextDisabled,
            ]}
          >
            {saving ? t('common.saving') : t('contacts.save')}
          </Text>
        </TouchableOpacity>

        {/* QR alternative */}
        <View style={styles.alternativeContainer}>
          <Text style={styles.alternativeText}>{t('contacts.orScanQR')}</Text>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => navigation.navigate('QRScanner')}
            accessibilityRole="button"
            accessibilityLabel={t('contacts.scanQR')}
          >
            <Text style={styles.scanButtonText}>{t('contacts.scanQR')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  textInput: {
    ...typography.input,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: touchTargets.minimum,
    minWidth: 90,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
  },
  countryCodeText: {
    ...typography.input,
    color: colors.textPrimary,
  },
  dropdownIcon: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  phoneInput: {
    ...typography.input,
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countryCodeDropdown: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  countryCodeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    justifyContent: 'center',
  },
  countryCodeOptionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  hintText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  saveButtonTextDisabled: {
    color: colors.textTertiary,
  },
  alternativeContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  alternativeText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  scanButton: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonText: {
    ...typography.button,
    color: colors.primary,
  },
});
