/**
 * SettingsMainScreen — Main settings menu
 *
 * Simple design with subsection buttons:
 * - Profile header (photo + name + tap to edit)
 * - Language selector
 * - Subsection buttons with icons:
 *   - 👤 Profiel → ProfileSettings
 *   - ♿ Toegankelijkheid → AccessibilitySettings
 *   - 🔔 Meldingen → NotificationSettings
 *   - 💾 Back-up → BackupSettings
 *   - 📱 Nieuw toestel → DeviceLinkShowQR
 *
 * Senior-inclusive design:
 * - Large profile header with photo and name
 * - Large touch targets (60pt+)
 * - Icon + label + chevron for each subsection
 * - VoiceOver support
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActionSheetIOS,
  Platform,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { ContactAvatar, Icon, VoiceFocusable, ModuleHeader, type IconName } from '@/components';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';
import { useFeedback } from '@/hooks/useFeedback';
import { getAvatarPath } from '@/services/imageService';
import { useAccentColor } from '@/hooks/useAccentColor';
import type { SettingsStackParams } from '@/navigation';
import type { SupportedLanguage } from '@/services/interfaces';

type NavigationProp = NativeStackNavigationProp<SettingsStackParams, 'SettingsMain'>;

// Flag emojis for languages
const LANGUAGE_FLAGS: Record<string, string> = {
  nl: '🇳🇱',
  en: '🇬🇧',
  de: '🇩🇪',
  fr: '🇫🇷',
  es: '🇪🇸',
};

// Subsection button component with monochrome icon + label + chevron
interface SubsectionButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  iconColor: string;
  focused?: boolean;
  focusStyle?: { borderColor: string; borderWidth: number; backgroundColor: string };
}

function SubsectionButton({ icon, label, onPress, accessibilityHint, iconColor, focused, focusStyle }: SubsectionButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.subsectionButton,
        focused && focusStyle && {
          borderColor: focusStyle.borderColor,
          borderWidth: focusStyle.borderWidth,
          backgroundColor: focusStyle.backgroundColor,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
    >
      <View style={styles.subsectionIconContainer}>
        <Icon name={icon} size={24} color={iconColor} />
      </View>
      <Text style={styles.subsectionLabel}>{label}</Text>
      <Icon name="chevron-right" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

export function SettingsMainScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { triggerFeedback } = useFeedback();
  const isFocused = useIsFocused();
  const { accentColor } = useAccentColor();
  const [displayName, setDisplayName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Settings menu items for voice navigation
  const settingsItems = useMemo(() => [
    { id: 'profile', label: t('settings.profile'), onSelect: () => { void triggerFeedback('tap'); navigation.navigate('ProfileSettings'); } },
    { id: 'accessibility', label: t('settings.accessibility'), onSelect: () => { void triggerFeedback('tap'); navigation.navigate('AccessibilitySettings'); } },
    { id: 'voice', label: t('voiceSettings.title'), onSelect: () => { void triggerFeedback('tap'); navigation.navigate('VoiceSettings'); } },
    { id: 'modules', label: t('settings.modules.title'), onSelect: () => { void triggerFeedback('tap'); navigation.navigate('ModulesSettings'); } },
    { id: 'notifications', label: t('settings.notifications'), onSelect: () => {
      void triggerFeedback('tap');
      Alert.alert(t('common.comingSoon'), t('settings.notificationsComingSoon'), [{ text: t('common.ok') }]);
    }},
    { id: 'backup', label: t('settings.backup'), onSelect: () => { void triggerFeedback('tap'); navigation.navigate('BackupSettings'); } },
    { id: 'device-link', label: t('settings.deviceLink'), onSelect: () => { void triggerFeedback('tap'); navigation.navigate('DeviceLinkShowQR'); } },
  ], [t, navigation, triggerFeedback]);

  // Voice Focus: Register settings items for voice navigation
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return []; // Only register when screen is focused
    return settingsItems.map((item, index) => ({
      id: item.id,
      label: item.label,
      index,
      onSelect: item.onSelect,
    }));
  }, [settingsItems, isFocused]);

  const { scrollRef, isFocused: isItemFocused, getFocusStyle } = useVoiceFocusList(
    'settings-list',
    voiceFocusItems
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

  // Get current language display
  const currentLanguage = i18n.language as SupportedLanguage;
  const languageDisplay = `${LANGUAGE_FLAGS[currentLanguage] || ''} ${t(`profile.language.${currentLanguage}`)}`;

  // Available languages
  const languages: SupportedLanguage[] = ['nl', 'en', 'de', 'fr', 'es'];

  // Handle language selection
  const handleLanguagePress = useCallback(() => {
    void triggerFeedback('tap');
    const options = languages.map(
      (lang) => `${LANGUAGE_FLAGS[lang]} ${t(`profile.language.${lang}`)}`
    );
    options.push(t('common.cancel'));

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          title: t('settings.language'),
        },
        (buttonIndex) => {
          if (buttonIndex < languages.length) {
            void i18n.changeLanguage(languages[buttonIndex]);
          }
        }
      );
    } else {
      // Android: Use Alert with buttons
      Alert.alert(
        t('settings.language'),
        undefined,
        [
          ...languages.map((lang) => ({
            text: `${LANGUAGE_FLAGS[lang]} ${t(`profile.language.${lang}`)}`,
            onPress: () => void i18n.changeLanguage(lang),
          })),
          { text: t('common.cancel'), style: 'cancel' as const },
        ]
      );
    }
  }, [i18n, t, triggerFeedback]);

  return (
    <View style={styles.container}>
      {/* Module Header — standardized component */}
      <ModuleHeader
        moduleId="settings"
        icon="settings"
        title={t('tabs.settings')}
        showAdMob={true}
      />

      <ScrollView ref={scrollRef} style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
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
          <View style={[styles.cameraIconContainer, { backgroundColor: accentColor.primary }]}>
            <Icon name="camera" size={14} color={colors.textOnPrimary} />
          </View>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName || t('common.loading')}</Text>
          <Text style={styles.profileHint}>{t('profile.tapToChange')}</Text>
        </View>
        <Icon name="chevron-right" size={24} color={colors.textTertiary} />
      </TouchableOpacity>

      {/* Language selector - below profile */}
      <TouchableOpacity
        style={styles.languageSelector}
        onPress={handleLanguagePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('settings.language')}
        accessibilityHint={t('profile.languageHint')}
      >
        <Text style={styles.languageLabel}>{t('settings.language')}</Text>
        <View style={styles.languageValueContainer}>
          <Text style={[styles.languageValue, { color: accentColor.primary }]}>{languageDisplay}</Text>
          <Icon name="chevron-right" size={20} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>

      {/* Subsection buttons */}
      <View style={styles.subsectionsContainer}>
        {/* Profiel */}
        <VoiceFocusable
          id="profile"
          label={t('settings.profile')}
          index={0}
          onSelect={() => navigation.navigate('ProfileSettings')}
        >
          <SubsectionButton
            icon="person"
            label={t('settings.profile')}
            onPress={() => navigation.navigate('ProfileSettings')}
            accessibilityHint={t('settings.editProfileHint')}
            iconColor={accentColor.primary}
            focused={isItemFocused('profile')}
            focusStyle={getFocusStyle()}
          />
        </VoiceFocusable>

        {/* Toegankelijkheid */}
        <VoiceFocusable
          id="accessibility"
          label={t('settings.accessibility')}
          index={1}
          onSelect={() => navigation.navigate('AccessibilitySettings')}
        >
          <SubsectionButton
            icon="accessibility"
            label={t('settings.accessibility')}
            onPress={() => navigation.navigate('AccessibilitySettings')}
            accessibilityHint={t('accessibilitySettings.screenHint')}
            iconColor={accentColor.primary}
            focused={isItemFocused('accessibility')}
            focusStyle={getFocusStyle()}
          />
        </VoiceFocusable>

        {/* Spraakbesturing */}
        <VoiceFocusable
          id="voice"
          label={t('voiceSettings.title')}
          index={2}
          onSelect={() => navigation.navigate('VoiceSettings')}
        >
          <SubsectionButton
            icon="mic"
            label={t('voiceSettings.title')}
            onPress={() => navigation.navigate('VoiceSettings')}
            accessibilityHint={t('voiceSettings.enableVoiceControlHint')}
            iconColor={accentColor.primary}
            focused={isItemFocused('voice')}
            focusStyle={getFocusStyle()}
          />
        </VoiceFocusable>

        {/* Modules - Country-specific content */}
        <VoiceFocusable
          id="modules"
          label={t('settings.modules.title')}
          index={3}
          onSelect={() => navigation.navigate('ModulesSettings')}
        >
          <SubsectionButton
            icon="news"
            label={t('settings.modules.title')}
            onPress={() => navigation.navigate('ModulesSettings')}
            accessibilityHint={t('settings.modules.settingsHint')}
            iconColor={accentColor.primary}
            focused={isItemFocused('modules')}
            focusStyle={getFocusStyle()}
          />
        </VoiceFocusable>

        {/* Meldingen - TODO: Create NotificationsSettingsScreen */}
        <VoiceFocusable
          id="notifications"
          label={t('settings.notifications')}
          index={4}
          onSelect={() => {
            Alert.alert(t('common.comingSoon'), t('settings.notificationsComingSoon'), [{ text: t('common.ok') }]);
          }}
        >
          <SubsectionButton
            icon="notifications"
            label={t('settings.notifications')}
            onPress={() => {
              Alert.alert(
                t('common.comingSoon'),
                t('settings.notificationsComingSoon'),
                [{ text: t('common.ok') }]
              );
            }}
            accessibilityHint={t('settings.notificationsHint')}
            iconColor={accentColor.primary}
            focused={isItemFocused('notifications')}
            focusStyle={getFocusStyle()}
          />
        </VoiceFocusable>

        {/* Back-up */}
        <VoiceFocusable
          id="backup"
          label={t('settings.backup')}
          index={5}
          onSelect={() => navigation.navigate('BackupSettings')}
        >
          <SubsectionButton
            icon="backup"
            label={t('settings.backup')}
            onPress={() => navigation.navigate('BackupSettings')}
            accessibilityHint={t('settings.backupHint')}
            iconColor={accentColor.primary}
            focused={isItemFocused('backup')}
            focusStyle={getFocusStyle()}
          />
        </VoiceFocusable>

        {/* Nieuw toestel koppelen */}
        <VoiceFocusable
          id="device-link"
          label={t('settings.deviceLink')}
          index={6}
          onSelect={() => navigation.navigate('DeviceLinkShowQR')}
        >
          <SubsectionButton
            icon="device"
            label={t('settings.deviceLink')}
            onPress={() => navigation.navigate('DeviceLinkShowQR')}
            accessibilityHint={t('deviceLink.showQRSubtitle')}
            iconColor={accentColor.primary}
            focused={isItemFocused('device-link')}
            focusStyle={getFocusStyle()}
          />
        </VoiceFocusable>
        </View>

        {/* DEV: Development tools section */}
        {__DEV__ && (
          <View style={styles.devSection}>
            <Text style={styles.devSectionTitle}>🛠 Development</Text>
            <TouchableOpacity
              style={styles.devButton}
              onPress={() => navigation.navigate('PiperTtsTest')}
              accessibilityRole="button"
              accessibilityLabel="Piper TTS Test"
            >
              <Icon name="play" size={24} color="#4CAF50" />
              <View style={styles.devButtonTextContainer}>
                <Text style={styles.devButtonTitle}>🔊 Piper TTS Test</Text>
                <Text style={styles.devButtonSubtitle}>Test offline spraaksynthese</Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* App info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            {t('settings.version', { version: '1.0.0' })}
          </Text>
        </View>
      </ScrollView>
    </View>
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
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
    // backgroundColor set dynamically via accentColor.primary
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
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
  // Language selector
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    minHeight: touchTargets.comfortable,
  },
  languageLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  languageValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageValue: {
    ...typography.body,
    // color set dynamically via accentColor.primary
    marginRight: spacing.sm,
  },
  // Subsection buttons container
  subsectionsContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  subsectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subsectionIconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  subsectionLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  // Info section
  infoSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  infoText: {
    ...typography.small,
    color: colors.textTertiary,
  },
  // DEV section
  devSection: {
    backgroundColor: '#FFF3E0',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  devSectionTitle: {
    ...typography.bodyBold,
    color: '#E65100',
    marginBottom: spacing.sm,
  },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: touchTargets.comfortable,
  },
  devButtonTextContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  devButtonTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  devButtonSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
