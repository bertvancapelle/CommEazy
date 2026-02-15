/**
 * CreateGroupScreen — Create a new group (3-step flow)
 *
 * Step 1: Enter group name
 * Step 2: Select members from contacts
 * Step 3: Review & create
 *
 * Senior-inclusive design:
 * - Max 3 steps per flow
 * - Large touch targets (60pt+)
 * - Clear visual progress
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Button, TextInput, LoadingView } from '@/components';
import type { GroupStackParams } from '@/navigation';
import { ServiceContainer } from '@/services/container';
import { groupChatService } from '@/services/groupChat';
import type { Contact } from '@/services/interfaces';
import { triggerHaptic } from '@/hooks/useHoldToNavigate';

type NavigationProp = NativeStackNavigationProp<GroupStackParams, 'CreateGroup'>;

type Step = 1 | 2 | 3;

export function CreateGroupScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Form state
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Contact[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);

  // Load contacts
  useEffect(() => {
    let cancelled = false;

    const loadContacts = async () => {
      try {
        if (ServiceContainer.isInitialized) {
          const contactList: Contact[] = [];
          const unsubscribe = ServiceContainer.database.getContacts().subscribe(c => {
            contactList.push(...c);
          });
          unsubscribe();
          if (!cancelled) setContacts(contactList);
        } else if (__DEV__) {
          // Mock contacts for dev mode
          const { getMockContacts } = await import('@/services/mock');
          if (!cancelled) setContacts(getMockContacts());
        }
      } catch (error) {
        console.error('Failed to load contacts:', error);
      } finally {
        if (!cancelled) setLoadingContacts(false);
      }
    };

    void loadContacts();
    return () => { cancelled = true; };
  }, []);

  // Validation
  const isStep1Valid = groupName.trim().length >= 2;
  const isStep2Valid = selectedMembers.length >= 1;

  const handleNext = useCallback(() => {
    triggerHaptic('light');
    if (currentStep === 1 && isStep1Valid) {
      setCurrentStep(2);
      AccessibilityInfo.announceForAccessibility(t('group.step2'));
    } else if (currentStep === 2 && isStep2Valid) {
      setCurrentStep(3);
      AccessibilityInfo.announceForAccessibility(t('group.step3'));
    }
  }, [currentStep, isStep1Valid, isStep2Valid, t]);

  const handleBack = useCallback(() => {
    triggerHaptic('light');
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    } else {
      navigation.goBack();
    }
  }, [currentStep, navigation]);

  const handleToggleMember = useCallback((contact: Contact) => {
    triggerHaptic('light');
    setSelectedMembers(prev => {
      const isSelected = prev.some(c => c.jid === contact.jid);
      if (isSelected) {
        return prev.filter(c => c.jid !== contact.jid);
      } else {
        return [...prev, contact];
      }
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!isStep2Valid) return;

    setLoading(true);
    triggerHaptic('medium');

    try {
      const memberJids = selectedMembers.map(c => c.jid);
      const result = await groupChatService.createGroup(groupName.trim(), memberJids);

      AccessibilityInfo.announceForAccessibility(t('group.created'));

      // Navigate to the new group
      navigation.replace('GroupDetail', {
        groupId: result.groupId,
        name: groupName.trim(),
      });
    } catch (error) {
      console.error('Failed to create group:', error);
      triggerHaptic('error');
      // Show error (in real app, use toast or error view)
    } finally {
      setLoading(false);
    }
  }, [groupName, selectedMembers, isStep2Valid, navigation, t]);

  // Step 1: Group name
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('group.nameTitle')}</Text>
      <Text style={styles.stepDescription}>{t('group.nameHint')}</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>{t('group.name')}</Text>
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder={t('group.namePlaceholder')}
          autoFocus
          maxLength={50}
          accessibilityLabel={t('group.name')}
        />
      </View>

      <Button
        title={t('common.next')}
        onPress={handleNext}
        disabled={!isStep1Valid}
        style={styles.primaryButton}
      />
    </View>
  );

  // Step 2: Select members
  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('group.selectMembers')}</Text>
      <Text style={styles.stepDescription}>
        {t('group.selectedCount', { count: selectedMembers.length })}
      </Text>

      {loadingContacts ? (
        <LoadingView message={t('common.loading')} />
      ) : contacts.length === 0 ? (
        <View style={styles.emptyContacts}>
          <Text style={styles.emptyText}>{t('contacts.noContacts')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.contactList} showsVerticalScrollIndicator={false}>
          {contacts.map(contact => {
            const isSelected = selectedMembers.some(c => c.jid === contact.jid);
            return (
              <TouchableOpacity
                key={contact.jid}
                style={[styles.contactItem, isSelected && styles.contactItemSelected]}
                onPress={() => handleToggleMember(contact)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={contact.name}
              >
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>
                    {contact.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.contactName}>{contact.name}</Text>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.buttonRow}>
        <Button
          title={t('common.back')}
          onPress={handleBack}
          variant="secondary"
          style={styles.secondaryButton}
        />
        <Button
          title={t('common.next')}
          onPress={handleNext}
          disabled={!isStep2Valid}
          style={styles.primaryButton}
        />
      </View>
    </View>
  );

  // Step 3: Review & create
  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('group.reviewTitle')}</Text>

      {/* Group name summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>{t('group.name')}</Text>
        <Text style={styles.summaryValue}>{groupName}</Text>
      </View>

      {/* Members summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          {t('group.memberCount', { count: selectedMembers.length })}
        </Text>
        <View style={styles.membersList}>
          {selectedMembers.map(member => (
            <View key={member.jid} style={styles.memberChip}>
              <Text style={styles.memberChipText}>{member.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Encryption info */}
      <View style={styles.encryptionInfo}>
        <Text style={styles.encryptionIcon}>🔒</Text>
        <Text style={styles.encryptionText}>
          {t('group.encryptionInfo', {
            mode: selectedMembers.length <= 8 ? t('group.encryptToAll') : t('group.sharedKey'),
          })}
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <Button
          title={t('common.back')}
          onPress={handleBack}
          variant="secondary"
          style={styles.secondaryButton}
        />
        <Button
          title={t('group.create')}
          onPress={() => void handleCreate()}
          disabled={loading}
          loading={loading}
          style={styles.primaryButton}
        />
      </View>
    </View>
  );

  // Progress indicator
  const renderProgress = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3].map(step => (
        <View
          key={step}
          style={[
            styles.progressDot,
            currentStep >= step && styles.progressDotActive,
          ]}
          accessibilityLabel={t('group.stepOf', { current: currentStep, total: 3 })}
        />
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {renderProgress()}

      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  stepTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  stepDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  inputContainer: {
    marginBottom: spacing.xl,
  },
  inputLabel: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  contactList: {
    flex: 1,
    marginBottom: spacing.lg,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    minHeight: touchTargets.minimum,
  },
  contactItemSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  contactAvatarText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  contactName: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyContacts: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  primaryButton: {
    flex: 1,
  },
  secondaryButton: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  memberChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  memberChipText: {
    ...typography.body,
    color: colors.primary,
  },
  encryptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  encryptionIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  encryptionText: {
    ...typography.body,
    color: colors.success,
    flex: 1,
  },
});
