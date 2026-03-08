/**
 * AddContactScreen — Choose how to add a contact
 *
 * Three options:
 * 1. "In de buurt" → QR-code verification (highest trust)
 * 2. "Uitnodigen" → Invitation Relay (send code via SMS/email)
 * 3. "Bekende toevoegen" → Manual contact entry (no E2E)
 *
 * Senior-inclusive design:
 * - 3 large, clear option cards
 * - No technical jargon
 * - Descriptive text under each option
 * - ≥60pt touch targets
 *
 * @see TRUST_AND_ATTESTATION_PLAN.md section 4.2
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { HapticTouchable, Icon } from '@/components';
import type { ContactStackParams } from '@/navigation';

type NavigationProp = NativeStackNavigationProp<ContactStackParams, 'AddContact'>;

interface AddContactOption {
  key: string;
  icon: string;
  titleKey: string;
  titleDefault: string;
  descriptionKey: string;
  descriptionDefault: string;
  onPress: () => void;
}

export function AddContactScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const themeColors = useColors();

  const options: AddContactOption[] = [
    {
      key: 'nearby',
      icon: 'qr-code',
      titleKey: 'contacts.add.nearbyTitle',
      titleDefault: 'In de buurt',
      descriptionKey: 'contacts.add.nearbyDescription',
      descriptionDefault: 'Scan elkaars QR-code terwijl jullie bij elkaar zijn',
      onPress: () => navigation.navigate('VerifyContact', { jid: '', name: '' }),
    },
    {
      key: 'invite',
      icon: 'mail',
      titleKey: 'contacts.add.inviteTitle',
      titleDefault: 'Uitnodigen',
      descriptionKey: 'contacts.add.inviteDescription',
      descriptionDefault: 'Stuur een uitnodigingscode via SMS, e-mail of WhatsApp',
      onPress: () => navigation.navigate('InviteContact'),
    },
    {
      key: 'manual',
      icon: 'person-add',
      titleKey: 'contacts.add.manualTitle',
      titleDefault: 'Bekende toevoegen',
      descriptionKey: 'contacts.add.manualDescription',
      descriptionDefault: 'Sla een naam en telefoonnummer op (zonder berichten)',
      onPress: () => navigation.navigate('ManualAddContact'),
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={[styles.title, { color: themeColors.textPrimary }]}>
        {t('contacts.add.title', 'Hoe wil je iemand toevoegen?')}
      </Text>

      <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
        {t('contacts.add.subtitle', 'Kies een manier om een contact toe te voegen')}
      </Text>

      {/* Option cards */}
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <HapticTouchable
            key={option.key}
            style={[
              styles.optionCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
              },
            ]}
            onPress={option.onPress}
            accessibilityRole="button"
            accessibilityLabel={t(option.titleKey, option.titleDefault)}
            accessibilityHint={t(option.descriptionKey, option.descriptionDefault)}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${themeColors.primary}15` }]}>
              <Icon name={option.icon} size={32} color={themeColors.primary} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                {t(option.titleKey, option.titleDefault)}
              </Text>
              <Text style={[styles.optionDescription, { color: themeColors.textSecondary }]}>
                {t(option.descriptionKey, option.descriptionDefault)}
              </Text>
            </View>
            <Icon name="chevron-forward" size={24} color={themeColors.textTertiary} />
          </HapticTouchable>
        ))}
      </View>

      {/* Accept invitation link */}
      <View style={styles.acceptContainer}>
        <Text style={[styles.acceptLabel, { color: themeColors.textSecondary }]}>
          {t('contacts.add.haveCode', 'Heb je een uitnodigingscode ontvangen?')}
        </Text>
        <HapticTouchable
          style={[styles.acceptButton, { borderColor: themeColors.primary }]}
          onPress={() => navigation.navigate('AcceptInvitation')}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.accept.title', 'Code invoeren')}
        >
          <Icon name="key" size={20} color={themeColors.primary} />
          <Text style={[styles.acceptButtonText, { color: themeColors.primary }]}>
            {t('contacts.accept.title', 'Code invoeren')}
          </Text>
        </HapticTouchable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.xl,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    minHeight: touchTargets.large,
    gap: spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTextContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  optionTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  optionDescription: {
    ...typography.label,
  },
  acceptContainer: {
    marginTop: spacing.xl * 2,
    alignItems: 'center',
    gap: spacing.md,
  },
  acceptLabel: {
    ...typography.body,
    textAlign: 'center',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
  },
  acceptButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
});
