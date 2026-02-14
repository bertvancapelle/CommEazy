/**
 * SettingsMainScreen — Main settings menu
 *
 * Senior-inclusive design:
 * - Large profile header with photo and name
 * - Tappable profile to edit
 * - Large touch targets (60pt+)
 * - Clear section labels
 * - Simple one-tap navigation
 * - VoiceOver support
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { ContactAvatar } from '@/components';
import { getAvatarPath } from '@/services/imageService';
import { useHoldToNavigate, HOLD_TO_NAVIGATE_CONSTANTS } from '@/hooks/useHoldToNavigate';
import type { SettingsStackParams } from '@/navigation';

type NavigationProp = NativeStackNavigationProp<SettingsStackParams, 'SettingsMain'>;

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

function SettingsRow({ label, value, onPress, accessibilityLabel, accessibilityHint }: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
    >
      <Text style={styles.settingsLabel}>{label}</Text>
      <View style={styles.settingsValueContainer}>
        {value && <Text style={styles.settingsValue}>{value}</Text>}
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export function SettingsMainScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const [displayName, setDisplayName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Hold-to-Navigate settings
  const {
    settings: holdSettings,
    updateLongPressDelay,
    updateEdgeExclusionSize,
    updateWheelBlurIntensity,
    updateWheelDismissMargin,
  } = useHoldToNavigate();

  // Handle delay slider change (debounced save)
  const handleDelayChange = useCallback(
    (value: number) => {
      // Round to nearest 100ms
      const roundedValue = Math.round(value / 100) * 100;
      void updateLongPressDelay(roundedValue);
    },
    [updateLongPressDelay],
  );

  // Handle edge exclusion slider change (debounced save)
  const handleEdgeExclusionChange = useCallback(
    (value: number) => {
      // Round to nearest 5px
      const roundedValue = Math.round(value / 5) * 5;
      void updateEdgeExclusionSize(roundedValue);
    },
    [updateEdgeExclusionSize],
  );

  // Handle wheel blur intensity change
  const handleBlurIntensityChange = useCallback(
    (value: number) => {
      // Round to nearest 5
      const roundedValue = Math.round(value / 5) * 5;
      void updateWheelBlurIntensity(roundedValue);
    },
    [updateWheelBlurIntensity],
  );

  // Handle wheel dismiss margin change
  const handleDismissMarginChange = useCallback(
    (value: number) => {
      // Round to nearest 10px
      const roundedValue = Math.round(value / 10) * 10;
      void updateWheelDismissMargin(roundedValue);
    },
    [updateWheelDismissMargin],
  );

  // Load profile data and refresh when screen focuses
  useFocusEffect(
    React.useCallback(() => {
      const loadProfile = async () => {
        try {
          // Load profile from database (works in both dev and production)
          const { ServiceContainer } = await import('@/services/container');
          const profile = await ServiceContainer.database.getUserProfile();

          if (profile) {
            setDisplayName(profile.name);
            if (profile.photoPath) {
              setPhotoUrl(`file://${profile.photoPath}?t=${Date.now()}`);
            } else {
              // Try legacy avatar path
              const savedPath = await getAvatarPath('my_profile');
              if (savedPath) {
                setPhotoUrl(`file://${savedPath}?t=${Date.now()}`);
              } else {
                setPhotoUrl(null);
              }
            }
          } else {
            // Fallback if no profile exists yet
            setDisplayName('...');
            setPhotoUrl(null);
          }
        } catch (error) {
          console.error('Failed to load profile:', error);
          setDisplayName('...');
        }
      };

      void loadProfile();
    }, [])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile header - tappable to edit */}
      <TouchableOpacity
        style={styles.profileHeader}
        onPress={() => navigation.navigate('ProfileSettings')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('profile.changePhoto')}
        accessibilityHint={t('profile.tapToChange')}
      >
        <View style={styles.avatarContainer}>
          <ContactAvatar
            name={displayName}
            photoUrl={photoUrl ?? undefined}
            size={80}
          />
          {/* Small camera icon */}
          <View style={styles.cameraIconContainer}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName || t('common.loading')}</Text>
          <Text style={styles.profileHint}>{t('profile.tapToChange')}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* Preferences section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.title')}</Text>

        <SettingsRow
          label={t('settings.notifications')}
          onPress={() => {
            // TODO: Implement notifications settings
          }}
        />
      </View>

      {/* Account section */}
      <View style={styles.section}>
        <SettingsRow
          label={t('settings.backup')}
          onPress={() => navigation.navigate('BackupSettings')}
        />

        <SettingsRow
          label={t('deviceLink.showQRTitle')}
          onPress={() => navigation.navigate('DeviceLinkShowQR')}
        />
      </View>

      {/* Accessibility section — Hold-to-Navigate settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.accessibility')}</Text>
        <Text style={styles.sectionHint}>{t('settings.accessibilityHint')}</Text>

        {/* Long press delay stepper */}
        <View style={styles.stepperContainer}>
          <View style={styles.stepperInfo}>
            <Text style={styles.stepperLabel}>{t('settings.holdDelay')}</Text>
            <Text style={styles.stepperValue}>
              {t('settings.holdDelaySeconds', { seconds: (holdSettings.longPressDelay / 1000).toFixed(1) })}
            </Text>
          </View>
          <View style={styles.stepperButtons}>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                holdSettings.longPressDelay <= HOLD_TO_NAVIGATE_CONSTANTS.MIN_LONG_PRESS_DELAY && styles.stepperButtonDisabled,
              ]}
              onPress={() => handleDelayChange(holdSettings.longPressDelay - 250)}
              disabled={holdSettings.longPressDelay <= HOLD_TO_NAVIGATE_CONSTANTS.MIN_LONG_PRESS_DELAY}
              accessibilityLabel={t('common.decrease')}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                holdSettings.longPressDelay >= HOLD_TO_NAVIGATE_CONSTANTS.MAX_LONG_PRESS_DELAY && styles.stepperButtonDisabled,
              ]}
              onPress={() => handleDelayChange(holdSettings.longPressDelay + 250)}
              disabled={holdSettings.longPressDelay >= HOLD_TO_NAVIGATE_CONSTANTS.MAX_LONG_PRESS_DELAY}
              accessibilityLabel={t('common.increase')}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Edge exclusion stepper */}
        <View style={styles.stepperContainer}>
          <View style={styles.stepperInfo}>
            <Text style={styles.stepperLabel}>{t('settings.edgeExclusion')}</Text>
            <Text style={styles.stepperValue}>
              {holdSettings.edgeExclusionSize === 0
                ? t('settings.edgeExclusionOff')
                : t('settings.edgeExclusionPixels', { pixels: holdSettings.edgeExclusionSize })}
            </Text>
          </View>
          <View style={styles.stepperButtons}>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                holdSettings.edgeExclusionSize <= HOLD_TO_NAVIGATE_CONSTANTS.MIN_EDGE_EXCLUSION_SIZE && styles.stepperButtonDisabled,
              ]}
              onPress={() => handleEdgeExclusionChange(holdSettings.edgeExclusionSize - 10)}
              disabled={holdSettings.edgeExclusionSize <= HOLD_TO_NAVIGATE_CONSTANTS.MIN_EDGE_EXCLUSION_SIZE}
              accessibilityLabel={t('common.decrease')}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                holdSettings.edgeExclusionSize >= HOLD_TO_NAVIGATE_CONSTANTS.MAX_EDGE_EXCLUSION_SIZE && styles.stepperButtonDisabled,
              ]}
              onPress={() => handleEdgeExclusionChange(holdSettings.edgeExclusionSize + 10)}
              disabled={holdSettings.edgeExclusionSize >= HOLD_TO_NAVIGATE_CONSTANTS.MAX_EDGE_EXCLUSION_SIZE}
              accessibilityLabel={t('common.increase')}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Wheel blur intensity stepper */}
        <View style={styles.stepperContainer}>
          <View style={styles.stepperInfo}>
            <Text style={styles.stepperLabel}>{t('settings.wheelBlur')}</Text>
            <Text style={styles.stepperValue}>
              {holdSettings.wheelBlurIntensity === 0
                ? t('settings.wheelBlurOff')
                : t('settings.wheelBlurLevel', { level: holdSettings.wheelBlurIntensity })}
            </Text>
          </View>
          <View style={styles.stepperButtons}>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                holdSettings.wheelBlurIntensity <= HOLD_TO_NAVIGATE_CONSTANTS.MIN_WHEEL_BLUR_INTENSITY && styles.stepperButtonDisabled,
              ]}
              onPress={() => handleBlurIntensityChange(holdSettings.wheelBlurIntensity - 5)}
              disabled={holdSettings.wheelBlurIntensity <= HOLD_TO_NAVIGATE_CONSTANTS.MIN_WHEEL_BLUR_INTENSITY}
              accessibilityLabel={t('common.decrease')}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                holdSettings.wheelBlurIntensity >= HOLD_TO_NAVIGATE_CONSTANTS.MAX_WHEEL_BLUR_INTENSITY && styles.stepperButtonDisabled,
              ]}
              onPress={() => handleBlurIntensityChange(holdSettings.wheelBlurIntensity + 5)}
              disabled={holdSettings.wheelBlurIntensity >= HOLD_TO_NAVIGATE_CONSTANTS.MAX_WHEEL_BLUR_INTENSITY}
              accessibilityLabel={t('common.increase')}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Wheel dismiss margin stepper */}
        <View style={styles.stepperContainer}>
          <View style={styles.stepperInfo}>
            <Text style={styles.stepperLabel}>{t('settings.wheelDismissMargin')}</Text>
            <Text style={styles.stepperValue}>
              {t('settings.wheelDismissMarginPixels', { pixels: holdSettings.wheelDismissMargin })}
            </Text>
          </View>
          <View style={styles.stepperButtons}>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                holdSettings.wheelDismissMargin <= HOLD_TO_NAVIGATE_CONSTANTS.MIN_WHEEL_DISMISS_MARGIN && styles.stepperButtonDisabled,
              ]}
              onPress={() => handleDismissMarginChange(holdSettings.wheelDismissMargin - 10)}
              disabled={holdSettings.wheelDismissMargin <= HOLD_TO_NAVIGATE_CONSTANTS.MIN_WHEEL_DISMISS_MARGIN}
              accessibilityLabel={t('common.decrease')}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                holdSettings.wheelDismissMargin >= HOLD_TO_NAVIGATE_CONSTANTS.MAX_WHEEL_DISMISS_MARGIN && styles.stepperButtonDisabled,
              ]}
              onPress={() => handleDismissMarginChange(holdSettings.wheelDismissMargin + 10)}
              disabled={holdSettings.wheelDismissMargin >= HOLD_TO_NAVIGATE_CONSTANTS.MAX_WHEEL_DISMISS_MARGIN}
              accessibilityLabel={t('common.increase')}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* App info */}
      <View style={styles.infoSection}>
        <Text style={styles.infoText}>
          {t('settings.version', { version: '1.0.0' })}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  cameraIcon: {
    fontSize: 16,
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  profileHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  settingsLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  settingsValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsValue: {
    ...typography.body,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  chevron: {
    ...typography.h2,
    color: colors.textTertiary,
  },
  infoSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  infoText: {
    ...typography.small,
    color: colors.textTertiary,
  },
  sectionHint: {
    ...typography.small,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: touchTargets.comfortable,
  },
  stepperInfo: {
    flex: 1,
  },
  stepperLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  stepperValue: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  stepperButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepperButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonDisabled: {
    backgroundColor: colors.border,
  },
  stepperButtonText: {
    ...typography.h2,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
});
