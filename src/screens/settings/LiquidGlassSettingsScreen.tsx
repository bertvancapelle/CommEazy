/**
 * LiquidGlassSettingsScreen — Settings for Apple Liquid Glass effects
 *
 * Allows users to:
 * - View platform support status
 * - Adjust tint intensity (0-100%)
 * - Force-disable Liquid Glass
 * - Preview the effect
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear status indicators
 * - Preview section to see changes
 *
 * @see src/types/liquidGlass.ts
 * @see src/contexts/LiquidGlassContext.tsx
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, LiquidGlassView } from '@/components';
import { useLiquidGlassContext } from '@/contexts/LiquidGlassContext';
import { useAccentColor } from '@/hooks/useAccentColor';

export function LiquidGlassSettingsScreen() {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const {
    platform,
    settings,
    accessibility,
    isEnabled,
    setTintIntensity,
    setForceDisabled,
  } = useLiquidGlassContext();

  // ============================================================
  // Render
  // ============================================================

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Platform Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.liquidGlass.currentPlatform')}</Text>
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Icon
              name={platform.isSupported ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={platform.isSupported ? colors.success : colors.textTertiary}
            />
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusLabel}>
                {platform.platform === 'ios'
                  ? t('settings.liquidGlass.iosVersion', { version: platform.iosVersion })
                  : t('settings.liquidGlass.android')}
              </Text>
              <Text style={styles.statusHint}>
                {platform.isSupported
                  ? t('settings.liquidGlass.enabled')
                  : t('settings.liquidGlass.iosRequired')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Accessibility Warning (if reduce transparency is enabled) */}
      {accessibility.reduceTransparencyEnabled && (
        <View style={styles.section}>
          <View style={[styles.warningCard, { borderColor: colors.warning }]}>
            <Icon name="warning" size={24} color={colors.warning} />
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>
                {t('settings.liquidGlass.reduceTransparency')}
              </Text>
              <Text style={styles.warningHint}>
                {t('settings.liquidGlass.reduceTransparencyHint')}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Settings Section (only show if platform supports it) */}
      {platform.isSupported && !accessibility.reduceTransparencyEnabled && (
        <>
          {/* Force Disable Toggle */}
          <View style={styles.section}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>
                  {t('settings.liquidGlass.forceDisable')}
                </Text>
                <Text style={styles.settingHint}>
                  {t('settings.liquidGlass.forceDisableHint')}
                </Text>
              </View>
              <Switch
                value={settings.forceDisabled}
                onValueChange={setForceDisabled}
                trackColor={{ false: colors.border, true: accentColor.primary }}
                thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
                accessibilityLabel={t('settings.liquidGlass.forceDisable')}
              />
            </View>
          </View>

          {/* Tint Intensity Slider (only if not force-disabled) */}
          {!settings.forceDisabled && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('settings.liquidGlass.tintIntensity')}
              </Text>
              <Text style={styles.sectionHint}>
                {t('settings.liquidGlass.tintIntensityHint')}
              </Text>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  value={settings.tintIntensity}
                  onValueChange={setTintIntensity}
                  minimumTrackTintColor={accentColor.primary}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={accentColor.primary}
                  accessibilityLabel={t('settings.liquidGlass.tintIntensity')}
                  accessibilityValue={{ text: `${settings.tintIntensity}%` }}
                />
                <Text style={[styles.sliderValue, { color: accentColor.primary }]}>
                  {settings.tintIntensity}%
                </Text>
              </View>
            </View>
          )}
        </>
      )}

      {/* Preview Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.liquidGlass.preview')}</Text>
        <Text style={styles.sectionHint}>{t('settings.liquidGlass.previewHint')}</Text>

        {/* Preview Cards for different modules */}
        <View style={styles.previewContainer}>
          <LiquidGlassView moduleId="radio" style={styles.previewCard}>
            <View style={styles.previewCardContent}>
              <Icon name="radio" size={32} color={colors.textOnPrimary} />
              <Text style={styles.previewCardLabel}>Radio</Text>
            </View>
          </LiquidGlassView>

          <LiquidGlassView moduleId="podcast" style={styles.previewCard}>
            <View style={styles.previewCardContent}>
              <Icon name="podcast" size={32} color={colors.textOnPrimary} />
              <Text style={styles.previewCardLabel}>Podcast</Text>
            </View>
          </LiquidGlassView>

          <LiquidGlassView moduleId="weather" style={styles.previewCard}>
            <View style={styles.previewCardContent}>
              <Icon name="weather" size={32} color={colors.textOnPrimary} />
              <Text style={styles.previewCardLabel}>Weer</Text>
            </View>
          </LiquidGlassView>

          <LiquidGlassView moduleId="chats" style={styles.previewCard}>
            <View style={styles.previewCardContent}>
              <Icon name="chat" size={32} color={colors.textOnPrimary} />
              <Text style={styles.previewCardLabel}>Berichten</Text>
            </View>
          </LiquidGlassView>
        </View>

        {/* Status indicator */}
        <View style={styles.statusIndicator}>
          <Icon
            name={isEnabled ? 'checkmark-circle' : 'close-circle'}
            size={20}
            color={isEnabled ? colors.success : colors.textTertiary}
          />
          <Text style={[styles.statusIndicatorText, { color: isEnabled ? colors.success : colors.textTertiary }]}>
            {isEnabled ? t('settings.liquidGlass.enabled') : t('settings.liquidGlass.disabled')}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  // Status Card
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  statusLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  statusHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Warning Card
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  warningTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  warningTitle: {
    ...typography.bodyBold,
    color: colors.warning,
  },
  warningHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  // Setting Row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: touchTargets.comfortable,
  },
  settingLabelContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  settingHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Slider
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: touchTargets.comfortable,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    ...typography.bodyBold,
    width: 50,
    textAlign: 'right',
  },
  // Preview
  previewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  previewCard: {
    width: '47%',
    aspectRatio: 1.2,
    borderRadius: borderRadius.lg,
  },
  previewCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCardLabel: {
    ...typography.body,
    color: colors.textOnPrimary,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  // Status Indicator
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  statusIndicatorText: {
    ...typography.body,
    marginLeft: spacing.sm,
  },
});
