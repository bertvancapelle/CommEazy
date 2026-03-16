/**
 * ContactReachabilityIcons — Four fixed-position status icons under a contact name
 *
 * Shows communication channel availability for a contact:
 * - Position 1 (left): CommEazy app (chatbubble icon)
 * - Position 2: Email (mail icon)
 * - Position 3: Landline (phone-landline icon)
 * - Position 4 (right): Mobile (cellphone icon)
 *
 * Available channels show a colored icon; missing channels show a red cross (✗).
 * Fixed positions ensure visual consistency — seniors always know where to look.
 *
 * Senior-inclusive design:
 * - Fixed icon positions (never shift)
 * - 16pt icons for readability
 * - Color + icon shape (not color-only) for accessibility
 * - VoiceOver labels per icon
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { Icon } from './Icon';

// ============================================================
// Types
// ============================================================

export interface ContactReachabilityIconsProps {
  /** Contact has CommEazy app installed (trustLevel >= 2) */
  hasApp: boolean;
  /** Contact has an email address */
  hasEmail: boolean;
  /** Contact has a landline phone number */
  hasLandline: boolean;
  /** Contact has a mobile phone number */
  hasMobile: boolean;
  /** Icon size (default: 16) */
  size?: number;
}

// ============================================================
// Component
// ============================================================

export function ContactReachabilityIcons({
  hasApp,
  hasEmail,
  hasLandline,
  hasMobile,
  size = 16,
}: ContactReachabilityIconsProps) {
  const { t } = useTranslation();
  const themeColors = useColors();

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={t('contacts.reachability.a11ySummary', {
        app: hasApp ? t('contacts.reachability.available') : t('contacts.reachability.unavailable'),
        email: hasEmail ? t('contacts.reachability.available') : t('contacts.reachability.unavailable'),
        landline: hasLandline ? t('contacts.reachability.available') : t('contacts.reachability.unavailable'),
        mobile: hasMobile ? t('contacts.reachability.available') : t('contacts.reachability.unavailable'),
      })}
    >
      {/* Position 1: CommEazy app */}
      <Icon
        name={hasApp ? 'chatbubble' : 'x'}
        size={size}
        color={hasApp ? themeColors.success : themeColors.error}
      />

      {/* Position 2: Email */}
      <Icon
        name={hasEmail ? 'mail' : 'x'}
        size={size}
        color={hasEmail ? themeColors.success : themeColors.error}
      />

      {/* Position 3: Landline */}
      <Icon
        name={hasLandline ? 'phone-landline' : 'x'}
        size={size}
        color={hasLandline ? themeColors.success : themeColors.error}
      />

      {/* Position 4: Mobile */}
      <Icon
        name={hasMobile ? 'cellphone' : 'x'}
        size={size}
        color={hasMobile ? themeColors.success : themeColors.error}
      />
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
