/**
 * Mail Onboarding Step 2 — Authentication
 *
 * Three variants based on provider type:
 * - OAuth2: "Login with [provider]" button → opens browser
 * - Password (known): Email + Password fields
 * - Custom: Email + Password + expandable IMAP/SMTP server config
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 8
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { Button, TextInput, Icon, ProgressIndicator } from '@/components';
import type { MailProvider, SecurityMethod, ServerConfig } from '@/services/mail/mailConstants';

// ============================================================
// Types
// ============================================================

export interface MailOnboardingStep2Props {
  /** Selected provider from Step 1 */
  provider: MailProvider;
  /** Called when OAuth2 flow completes or password form is submitted */
  onSubmit: (data: AuthFormData) => void;
  /** Called when user wants to go back */
  onBack: () => void;
  /** Whether authentication is in progress */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Current step for ProgressIndicator */
  currentStep?: number;
  /** Total steps for ProgressIndicator */
  totalSteps?: number;
}

export interface AuthFormData {
  email: string;
  password?: string;
  /** For OAuth2 flow — the provider ID */
  providerId: string;
  /** Custom IMAP config (only for custom providers) */
  imapConfig?: ServerConfig;
  /** Custom SMTP config (only for custom providers) */
  smtpConfig?: ServerConfig;
  /** Whether SMTP uses same credentials as IMAP */
  smtpSameCredentials?: boolean;
}

// ============================================================
// Haptic Helper
// ============================================================

const triggerHaptic = () => {
  const options = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };
  const hapticType = Platform.select({
    ios: 'impactMedium',
    android: 'effectClick',
    default: 'impactMedium',
  }) as string;
  ReactNativeHapticFeedback.trigger(hapticType, options);
};

// ============================================================
// Security Options
// ============================================================

const SECURITY_OPTIONS: SecurityMethod[] = ['SSL', 'STARTTLS', 'NONE'];

// ============================================================
// Component
// ============================================================

export function MailOnboardingStep2({
  provider,
  onSubmit,
  onBack,
  isLoading = false,
  error = null,
  currentStep = 2,
  totalSteps = 3,
}: MailOnboardingStep2Props) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Custom server config
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [smtpSameCredentials, setSmtpSameCredentials] = useState(true);

  const [imapHost, setImapHost] = useState(provider.imap.host);
  const [imapPort, setImapPort] = useState(String(provider.imap.port));
  const [imapSecurity, setImapSecurity] = useState<SecurityMethod>(provider.imap.security);

  const [smtpHost, setSmtpHost] = useState(provider.smtp.host);
  const [smtpPort, setSmtpPort] = useState(String(provider.smtp.port));
  const [smtpSecurity, setSmtpSecurity] = useState<SecurityMethod>(provider.smtp.security);

  // ============================================================
  // Validation
  // ============================================================

  const isEmailValid = email.includes('@') && email.includes('.');

  const isPasswordFormValid = isEmailValid && password.length >= 1;

  const isCustomFormValid =
    isPasswordFormValid &&
    imapHost.length > 0 &&
    smtpHost.length > 0 &&
    !isNaN(Number(imapPort)) &&
    !isNaN(Number(smtpPort));

  const isFormValid =
    provider.id === 'custom' ? isCustomFormValid : isPasswordFormValid;

  // ============================================================
  // Handlers
  // ============================================================

  const handleOAuthPress = useCallback(() => {
    triggerHaptic();
    onSubmit({
      email: '',
      providerId: provider.id,
    });
  }, [onSubmit, provider.id]);

  const handlePasswordSubmit = useCallback(() => {
    triggerHaptic();

    const data: AuthFormData = {
      email: email.trim().toLowerCase(),
      password,
      providerId: provider.id,
      smtpSameCredentials,
    };

    if (provider.id === 'custom') {
      data.imapConfig = {
        host: imapHost.trim(),
        port: Number(imapPort),
        security: imapSecurity,
      };
      data.smtpConfig = {
        host: smtpHost.trim(),
        port: Number(smtpPort),
        security: smtpSecurity,
      };
    }

    onSubmit(data);
  }, [
    email, password, provider.id, smtpSameCredentials,
    imapHost, imapPort, imapSecurity,
    smtpHost, smtpPort, smtpSecurity,
    onSubmit,
  ]);

  // ============================================================
  // Render: OAuth2 Flow
  // ============================================================

  const renderOAuth2 = () => (
    <View style={styles.oauthContainer}>
      <View style={styles.oauthIconContainer}>
        <Icon name="mail" size={64} color={accentColor.primary} />
      </View>

      <Text style={[styles.oauthTitle, { color: themeColors.textPrimary }]}>
        {t('modules.mail.onboarding.oauthTitle', { provider: provider.name })}
      </Text>

      <Text style={[styles.oauthDescription, { color: themeColors.textSecondary }]}>
        {t('modules.mail.onboarding.oauthDescription', { provider: provider.name })}
      </Text>

      <Button
        title={t('modules.mail.onboarding.loginWith', { provider: provider.name })}
        onPress={handleOAuthPress}
        loading={isLoading}
        accessibilityLabel={t('modules.mail.onboarding.loginWith', { provider: provider.name })}
      />
    </View>
  );

  // ============================================================
  // Render: Password Form
  // ============================================================

  const renderPasswordForm = () => (
    <View style={styles.formContainer}>
      <TextInput
        label={t('modules.mail.onboarding.emailLabel')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('modules.mail.onboarding.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />

      <TextInput
        label={t('modules.mail.onboarding.passwordLabel')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('modules.mail.onboarding.passwordPlaceholder')}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
      />

      {provider.noteKey && (
        <View style={[styles.noteContainer, { backgroundColor: accentColor.light }]}>
          <Icon name="info" size={20} color={accentColor.primary} />
          <Text style={[styles.noteText, { color: themeColors.textPrimary }]}>
            {t(provider.noteKey)}
          </Text>
        </View>
      )}
    </View>
  );

  // ============================================================
  // Render: Custom Server Config
  // ============================================================

  const renderServerConfig = () => (
    <View style={styles.serverConfigContainer}>
      <TouchableOpacity
        style={[styles.serverConfigToggle, { borderColor: themeColors.border }]}
        onPress={() => {
          triggerHaptic();
          setShowServerConfig(!showServerConfig);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('modules.mail.onboarding.serverConfig')}
        accessibilityState={{ expanded: showServerConfig }}
      >
        <Icon name="settings" size={20} color={themeColors.textSecondary} />
        <Text style={[styles.serverConfigToggleText, { color: themeColors.textPrimary }]}>
          {t('modules.mail.onboarding.serverConfig')}
        </Text>
        <Icon
          name={showServerConfig ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={themeColors.textSecondary}
        />
      </TouchableOpacity>

      {showServerConfig && (
        <View style={styles.serverConfigFields}>
          {/* IMAP Section */}
          <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>
            {t('modules.mail.onboarding.imapServer')}
          </Text>

          <TextInput
            label={t('modules.mail.onboarding.hostLabel')}
            value={imapHost}
            onChangeText={setImapHost}
            placeholder="imap.example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <View style={styles.row}>
            <View style={styles.portField}>
              <TextInput
                label={t('modules.mail.onboarding.portLabel')}
                value={imapPort}
                onChangeText={setImapPort}
                placeholder="993"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.securityField}>
              <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
                {t('modules.mail.onboarding.securityLabel')}
              </Text>
              <SecuritySelector
                value={imapSecurity}
                onChange={setImapSecurity}
                themeColors={themeColors}
                accentColor={accentColor}
              />
            </View>
          </View>

          {/* SMTP Section */}
          <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>
            {t('modules.mail.onboarding.smtpServer')}
          </Text>

          <TextInput
            label={t('modules.mail.onboarding.hostLabel')}
            value={smtpHost}
            onChangeText={setSmtpHost}
            placeholder="smtp.example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <View style={styles.row}>
            <View style={styles.portField}>
              <TextInput
                label={t('modules.mail.onboarding.portLabel')}
                value={smtpPort}
                onChangeText={setSmtpPort}
                placeholder="587"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.securityField}>
              <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
                {t('modules.mail.onboarding.securityLabel')}
              </Text>
              <SecuritySelector
                value={smtpSecurity}
                onChange={setSmtpSecurity}
                themeColors={themeColors}
                accentColor={accentColor}
              />
            </View>
          </View>

          {/* Same credentials toggle */}
          <View style={styles.toggleRow}>
            <Text
              style={[styles.toggleLabel, { color: themeColors.textPrimary }]}
              numberOfLines={2}
            >
              {t('modules.mail.onboarding.smtpSameCredentials')}
            </Text>
            <Switch
              value={smtpSameCredentials}
              onValueChange={setSmtpSameCredentials}
              trackColor={{ false: themeColors.border, true: accentColor.primary }}
              thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
            />
          </View>
        </View>
      )}
    </View>
  );

  // ============================================================
  // Main Render
  // ============================================================

  const isOAuth2 = provider.authType === 'oauth2';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Icon name="chevron-left" size={24} color={accentColor.primary} />
            <Text style={[styles.backText, { color: accentColor.primary }]}>
              {t('common.back')}
            </Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text
              style={[styles.title, { color: themeColors.textPrimary }]}
              accessibilityRole="header"
            >
              {provider.name}
            </Text>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: themeColors.errorBackground }]}>
              <Icon name="warning" size={20} color={themeColors.error} />
              <Text style={[styles.errorText, { color: themeColors.error }]}>
                {error}
              </Text>
            </View>
          )}

          {/* Content based on provider type */}
          {isOAuth2 ? renderOAuth2() : (
            <>
              {renderPasswordForm()}
              {provider.id === 'custom' && renderServerConfig()}
            </>
          )}
        </ScrollView>

        {/* Submit button for password forms (OAuth2 has its own button) */}
        {!isOAuth2 && (
          <View style={styles.footer}>
            <Button
              title={t('modules.mail.onboarding.connect')}
              onPress={handlePasswordSubmit}
              disabled={!isFormValid || isLoading}
              loading={isLoading}
              accessibilityLabel={t('modules.mail.onboarding.connect')}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================
// SecuritySelector Sub-component
// ============================================================

interface SecuritySelectorProps {
  value: SecurityMethod;
  onChange: (method: SecurityMethod) => void;
  themeColors: ReturnType<typeof useColors>;
  accentColor: ReturnType<typeof useAccentColor>['accentColor'];
}

function SecuritySelector({ value, onChange, themeColors, accentColor }: SecuritySelectorProps) {
  return (
    <View style={secStyles.container}>
      {SECURITY_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option}
          style={[
            secStyles.option,
            {
              borderColor: value === option ? accentColor.primary : themeColors.border,
              backgroundColor: value === option ? accentColor.light : themeColors.surface,
            },
          ]}
          onPress={() => {
            triggerHaptic();
            onChange(option);
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === option }}
          accessibilityLabel={option}
        >
          <Text
            style={[
              secStyles.optionText,
              {
                color: value === option ? accentColor.primary : themeColors.textPrimary,
                fontWeight: value === option ? '700' : '400',
              },
            ]}
          >
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const secStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  option: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    ...typography.small,
  },
});

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    minHeight: touchTargets.minimum,
  },
  backText: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.body,
    flex: 1,
  },
  // OAuth2
  oauthContainer: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
  oauthIconContainer: {
    marginBottom: spacing.sm,
  },
  oauthTitle: {
    ...typography.h3,
    textAlign: 'center',
  },
  oauthDescription: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  // Password form
  formContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  noteText: {
    ...typography.small,
    flex: 1,
  },
  // Server config
  serverConfigContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  serverConfigToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  serverConfigToggleText: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  serverConfigFields: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.label,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  portField: {
    flex: 1,
  },
  securityField: {
    flex: 2,
  },
  fieldLabel: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTargets.minimum,
    marginTop: spacing.sm,
  },
  toggleLabel: {
    ...typography.body,
    flex: 1,
    marginRight: spacing.md,
  },
  // Footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
});
