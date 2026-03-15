/**
 * AskAIScreen — Main screen for the AI assistant module
 *
 * Chat-like interface where seniors can ask questions and get
 * clear, friendly answers powered by Google Gemini.
 *
 * Features:
 * - Google account linking (first-time use)
 * - Chat interface with WhatsApp-style bubbles
 * - Conversation history
 * - New conversation button
 * - Auto-scroll to latest message
 *
 * @see .claude/plans/VRAAG_HET_AI_MODULE.md
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { ModuleHeader, ModuleScreenLayout, Icon, ScrollViewWithIndicator } from '@/components';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { AskAIProvider, useAskAI } from '@/contexts/AskAIContext';

import {
  AskAIWelcomeScreen,
  AskAIChatBubble,
  AskAIInputBar,
  AskAITypingIndicator,
  AskAIHistoryModal,
} from '@/components/askAI';

// ============================================================
// Inner Screen (wrapped in AskAIProvider)
// ============================================================

function AskAIScreenInner() {
  const { t } = useTranslation();
  const moduleColor = useModuleColor('askAI');

  const {
    isGoogleLinked,
    messages,
    isLoading,
    error,
    dismissError,
    sendMessage,
    startNewConversation,
    currentConversation,
  } = useAskAI();

  const [showHistory, setShowHistory] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isLoading]);

  const handleNewConversation = useCallback(() => {
    if (currentConversation && messages.length > 0) {
      Alert.alert(
        t('modules.askAI.chat.newConversation'),
        t('modules.askAI.chat.newConversationConfirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.yes'),
            onPress: startNewConversation,
          },
        ],
      );
    } else {
      startNewConversation();
    }
  }, [currentConversation, messages.length, startNewConversation, t]);

  // Show welcome screen if not linked
  if (!isGoogleLinked) {
    return (
      <View style={styles.container}>
        <ModuleHeader
          moduleId="askAI"
          icon="chatbubble"
          title={t('modules.askAI.title')}
        />
        <AskAIWelcomeScreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ModuleScreenLayout
        moduleBlock={
          <ModuleHeader
            moduleId="askAI"
            icon="chatbubble"
            title={t('modules.askAI.title')}
            skipSafeArea
          />
        }
        controlsBlock={
          <View style={styles.actionBar}>
            <HapticTouchable hapticDisabled
              style={styles.actionButton}
              onPress={() => setShowHistory(true)}
              accessibilityRole="button"
              accessibilityLabel={t('modules.askAI.a11y.viewHistory')}
            >
              <Icon name="list" size={22} color={moduleColor} />
              <Text style={[styles.actionButtonText, { color: moduleColor }]}>
                {t('modules.askAI.chat.history')}
              </Text>
            </HapticTouchable>
            <HapticTouchable hapticDisabled
              style={styles.actionButton}
              onPress={handleNewConversation}
              accessibilityRole="button"
              accessibilityLabel={t('modules.askAI.a11y.newConversation')}
            >
              <Icon name="plus" size={22} color={moduleColor} />
              <Text style={[styles.actionButtonText, { color: moduleColor }]}>
                {t('modules.askAI.chat.newConversation')}
              </Text>
            </HapticTouchable>
          </View>
        }
        contentBlock={
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            {/* Error banner */}
            {error && (
              <View style={styles.errorBanner}>
                <Icon name="warning" size={20} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
                <HapticTouchable hapticDisabled
                  onPress={dismissError}
                  style={styles.errorDismiss}
                >
                  <Text style={styles.errorDismissText}>
                    {t('common.dismiss')}
                  </Text>
                </HapticTouchable>
              </View>
            )}

            {/* Chat messages */}
            <ScrollViewWithIndicator
              ref={scrollViewRef}
              style={styles.chatArea}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Welcome greeting */}
              {messages.length === 0 && (
                <View style={styles.greetingContainer}>
                  <View style={styles.greetingBubble}>
                    <Text style={styles.greetingText}>
                      {t('modules.askAI.chat.greeting')}
                    </Text>
                  </View>
                </View>
              )}

              {/* Messages */}
              {messages.map((msg) => (
                <AskAIChatBubble
                  key={msg.id}
                  message={msg}
                  moduleColor={moduleColor}
                />
              ))}

              {/* Typing indicator */}
              {isLoading && <AskAITypingIndicator />}
            </ScrollViewWithIndicator>

            {/* Input bar */}
            <AskAIInputBar
              onSend={sendMessage}
              isLoading={isLoading}
              moduleColor={moduleColor}
            />
          </KeyboardAvoidingView>
        }
      />

      {/* History modal */}
      <AskAIHistoryModal
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        moduleColor={moduleColor}
      />
    </View>
  );
}

// ============================================================
// Exported Screen (with Provider wrapper)
// ============================================================

export function AskAIScreen() {
  return (
    <AskAIProvider>
      <AskAIScreenInner />
    </AskAIProvider>
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
  keyboardAvoid: {
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.sm,
  },
  actionButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    flex: 1,
  },
  errorDismiss: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  errorDismissText: {
    ...typography.body,
    color: colors.error,
    fontWeight: '600',
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    paddingVertical: spacing.md,
  },
  greetingContainer: {
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  greetingBubble: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    borderBottomLeftRadius: 4,
    padding: spacing.md,
    maxWidth: '85%',
  },
  greetingText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 26,
  },
});
