/**
 * ContactSelectionModal — Modal for selecting from multiple matching contacts
 *
 * Shows when:
 * 1. Voice action targets multiple contacts (e.g., "Stuur bericht naar Oma" with 2 "Oma"s)
 * 2. Voice list navigation finds multiple matches (e.g., saying "Oma" in contacts list)
 * 3. No match found (with option to browse contacts)
 *
 * The modal is voice-navigable (volgende/vorige/open commands work).
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing, borderRadius, touchTargets, animation } from '@/theme';
import { Button } from './Button';
import { ContactAvatar } from './ContactAvatar';
import { FloatingMicIndicator } from './FloatingMicIndicator';
import type { Contact } from '@/services/interfaces';
import type { MicIndicatorPosition } from '@/hooks/useVoiceCommands';

// ============================================================
// Types
// ============================================================

export interface ContactMatch {
  contact: Contact;
  score: number;
}

export type ContactSelectionMode =
  | 'action'        // Voice action (bel/stuur bericht naar X)
  | 'listNavigation'; // List navigation (saying a name in contacts list)

export interface ContactSelectionModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** The matches to display (can be empty for "not found") */
  matches: ContactMatch[];
  /** The original search term */
  searchTerm: string;
  /** Action being performed (for action mode) */
  pendingAction?: 'call' | 'message';
  /** Current mode */
  mode: ContactSelectionMode;
  /** Called when a contact is selected */
  onSelect: (contact: Contact) => void;
  /** Called when "Bekijk contacten" is pressed */
  onBrowseContacts: () => void;
  /** Called when modal is closed/cancelled */
  onClose: () => void;
  /** Current voice-focused index (for voice navigation) */
  voiceFocusedIndex?: number;
  /** Callback to register for voice navigation */
  onRegisterVoiceNav?: (handlers: {
    focusNext: () => void;
    focusPrevious: () => void;
    selectFocused: () => void;
  }) => void;
  /** Whether voice session is active (shows voice hint) */
  isVoiceSessionActive?: boolean;
  /** Whether currently listening for voice input */
  isVoiceListening?: boolean;
  /** Whether currently processing voice input */
  isVoiceProcessing?: boolean;
  /** Position of the mic indicator */
  micIndicatorPosition?: MicIndicatorPosition;
  /** Callback when mic indicator is pressed (to stop session) */
  onMicPress?: () => void;
  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;
}

// ============================================================
// Component
// ============================================================

export function ContactSelectionModal({
  visible,
  matches,
  searchTerm,
  pendingAction,
  mode,
  onSelect,
  onBrowseContacts,
  onClose,
  voiceFocusedIndex: externalFocusIndex,
  onRegisterVoiceNav,
  isVoiceSessionActive = false,
  isVoiceListening = false,
  isVoiceProcessing = false,
  micIndicatorPosition = 'top-right',
  onMicPress,
  reducedMotion = false,
}: ContactSelectionModalProps) {
  const { t } = useTranslation();
  const [internalFocusIndex, setInternalFocusIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Use external focus index if provided, otherwise use internal
  const focusedIndex = externalFocusIndex ?? internalFocusIndex;

  // Animate in/out
  useEffect(() => {
    if (visible) {
      setInternalFocusIndex(0);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: animation.normal,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: animation.normal,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: animation.fast,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: animation.fast,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  // Voice navigation handlers
  const focusNext = useCallback(() => {
    setInternalFocusIndex((prev) => {
      const next = Math.min(prev + 1, matches.length - 1);
      // Scroll to focused item
      scrollViewRef.current?.scrollTo({
        y: next * (touchTargets.comfortable + spacing.sm),
        animated: true,
      });
      return next;
    });
  }, [matches.length]);

  const focusPrevious = useCallback(() => {
    setInternalFocusIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      scrollViewRef.current?.scrollTo({
        y: next * (touchTargets.comfortable + spacing.sm),
        animated: true,
      });
      return next;
    });
  }, []);

  const selectFocused = useCallback(() => {
    if (matches.length > 0 && focusedIndex < matches.length) {
      onSelect(matches[focusedIndex].contact);
    }
  }, [matches, focusedIndex, onSelect]);

  // Register voice navigation handlers
  useEffect(() => {
    if (visible && onRegisterVoiceNav) {
      onRegisterVoiceNav({
        focusNext,
        focusPrevious,
        selectFocused,
      });
    }
  }, [visible, onRegisterVoiceNav, focusNext, focusPrevious, selectFocused]);

  // Announce changes for accessibility
  useEffect(() => {
    if (visible && matches.length > 0) {
      const focusedMatch = matches[focusedIndex];
      if (focusedMatch) {
        AccessibilityInfo.announceForAccessibility(
          t('voiceCommands.focusedOnMatch', {
            name: focusedMatch.contact.name,
            current: focusedIndex + 1,
            total: matches.length,
          })
        );
      }
    }
  }, [visible, focusedIndex, matches, t]);

  // Get title based on mode and matches
  const getTitle = () => {
    if (matches.length === 0) {
      return t('contactSelection.notFound', { name: searchTerm });
    }
    if (mode === 'action' && pendingAction) {
      return t('contactSelection.selectForAction', {
        action: pendingAction === 'call' ? t('contacts.call') : t('chat.startChat'),
      });
    }
    return t('contactSelection.multipleMatches', { name: searchTerm, count: matches.length });
  };

  // Get subtitle based on mode
  const getSubtitle = () => {
    if (matches.length === 0) {
      return t('contactSelection.notFoundHint');
    }
    if (matches.length > 1) {
      return t('contactSelection.selectOne');
    }
    return null;
  };

  const handleContactPress = (contact: Contact) => {
    onSelect(contact);
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Animated.View
        style={[
          styles.overlay,
          { opacity: fadeAnim },
        ]}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
        />

        <Animated.View
          style={[
            styles.modal,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          accessible
          accessibilityRole="dialog"
          accessibilityLabel={getTitle()}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{getTitle()}</Text>
            {getSubtitle() && (
              <Text style={styles.subtitle}>{getSubtitle()}</Text>
            )}
            {/* Voice session hint */}
            {isVoiceSessionActive && matches.length > 0 && (
              <View style={styles.voiceHint}>
                <Text style={styles.voiceHintIcon}>🎤</Text>
                <Text style={styles.voiceHintText}>
                  {t('voiceCommands.modalHint', 'Zeg "volgende", "vorige" of "open"')}
                </Text>
              </View>
            )}
          </View>

          {/* Contact list */}
          {matches.length > 0 ? (
            <ScrollView
              ref={scrollViewRef}
              style={styles.contactList}
              contentContainerStyle={styles.contactListContent}
              showsVerticalScrollIndicator={false}
            >
              {matches.map((match, index) => (
                <TouchableOpacity
                  key={match.contact.jid}
                  style={[
                    styles.contactRow,
                    index === focusedIndex && styles.contactRowFocused,
                  ]}
                  onPress={() => handleContactPress(match.contact)}
                  accessibilityRole="button"
                  accessibilityLabel={match.contact.name}
                  accessibilityHint={t('accessibility.startChatHint', { name: match.contact.name })}
                  accessibilityState={{ selected: index === focusedIndex }}
                >
                  <ContactAvatar
                    name={match.contact.name}
                    photoUri={match.contact.avatarUrl}
                    size={48}
                  />
                  <Text style={styles.contactName}>{match.contact.name}</Text>
                  {/* Show score badge for debugging in dev mode */}
                  {__DEV__ && (
                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreText}>{Math.round(match.score * 100)}%</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            /* No matches - show browse option */
            <View style={styles.noMatchesContainer}>
              <Text style={styles.noMatchesIcon}>🔍</Text>
              <Text style={styles.noMatchesText}>
                {t('contactSelection.noMatchesFor', { name: searchTerm })}
              </Text>
            </View>
          )}

          {/* Footer buttons */}
          <View style={styles.footer}>
            {matches.length === 0 && (
              <Button
                title={t('contactSelection.browseContacts')}
                onPress={onBrowseContacts}
                variant="primary"
                style={styles.browseButton}
              />
            )}
            <Button
              title={t('common.cancel')}
              onPress={onClose}
              variant="secondary"
              style={styles.cancelButton}
            />
          </View>
        </Animated.View>

        {/* Floating mic indicator - rendered INSIDE modal so it appears above the modal */}
        {isVoiceSessionActive && onMicPress && (
          <FloatingMicIndicator
            visible={true}
            isListening={isVoiceListening}
            isProcessing={isVoiceProcessing}
            position={micIndicatorPosition}
            onPress={onMicPress}
            reducedMotion={reducedMotion}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  voiceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
  },
  voiceHintIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  voiceHintText: {
    ...typography.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  contactList: {
    maxHeight: 300,
  },
  contactListContent: {
    padding: spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    minHeight: touchTargets.comfortable,
  },
  contactRowFocused: {
    borderWidth: 4,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  contactName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: spacing.md,
    flex: 1,
  },
  scoreBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  scoreText: {
    ...typography.small,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  noMatchesContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  noMatchesIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  noMatchesText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  browseButton: {
    marginBottom: spacing.xs,
  },
  cancelButton: {},
});
