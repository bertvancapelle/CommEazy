/**
 * ModulePanel — Panel wrapper for iPad Split View
 *
 * Wraps a module component with:
 * - Long-press gesture for opening module picker
 * - Two-finger long-press for panel-scoped voice commands
 * - Panel identification for context
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, { useCallback, useRef, lazy, Suspense } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  type GestureResponderEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSplitViewContext, type PanelId } from '@/contexts/SplitViewContext';
import { useHoldGestureContext } from '@/contexts/HoldGestureContext';
import type { NavigationDestination } from '@/types/navigation';
import { colors, typography, spacing } from '@/theme';

// ============================================================
// Lazy-loaded Module Components
// ============================================================

// Core modules
const MenuModule = lazy(() => import('@/components/modules/MenuModule'));
const ChatListScreen = lazy(() => import('@/screens/chat/ChatListScreen'));
const ContactListScreen = lazy(() => import('@/screens/contacts/ContactListScreen'));
const GroupListScreen = lazy(() => import('@/screens/group/GroupListScreen'));
const CallsScreen = lazy(() => import('@/screens/modules/CallsScreen'));

// Media modules
const RadioScreen = lazy(() => import('@/screens/modules/RadioScreen'));
const PodcastScreen = lazy(() => import('@/screens/modules/PodcastScreen'));
const BooksScreen = lazy(() => import('@/screens/modules/BooksScreen'));
const WeatherScreen = lazy(() => import('@/screens/modules/WeatherScreen'));

// System modules
const SettingsMainScreen = lazy(() => import('@/screens/settings/SettingsMainScreen'));

// ============================================================
// Constants
// ============================================================

/** Long-press duration in milliseconds */
const LONG_PRESS_DURATION = 800;

/** Two-finger long-press duration for voice commands */
const TWO_FINGER_LONG_PRESS_DURATION = 1000;

// ============================================================
// Types
// ============================================================

export interface ModulePanelProps {
  /** Panel identifier */
  panelId: PanelId;
  /** Module to display */
  moduleId: NavigationDestination;
}

// ============================================================
// Component
// ============================================================

export function ModulePanel({ panelId, moduleId }: ModulePanelProps) {
  const { t } = useTranslation();
  const { openModulePicker, setActiveVoicePanel } = useSplitViewContext();
  const holdGesture = useHoldGestureContext();

  // Touch tracking refs
  const touchCountRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const twoFingerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================
  // Gesture Handlers
  // ============================================================

  const clearTimers = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (twoFingerTimerRef.current) {
      clearTimeout(twoFingerTimerRef.current);
      twoFingerTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      const touchCount = event.nativeEvent.touches.length;
      touchCountRef.current = touchCount;

      clearTimers();

      if (touchCount === 1) {
        // Single finger: start long-press timer for module picker
        longPressTimerRef.current = setTimeout(() => {
          // Consume gesture to prevent underlying elements from firing
          holdGesture?.consumeGesture();
          openModulePicker(panelId);
        }, LONG_PRESS_DURATION);
      } else if (touchCount === 2) {
        // Two fingers: start timer for voice commands
        twoFingerTimerRef.current = setTimeout(() => {
          holdGesture?.consumeGesture();
          setActiveVoicePanel(panelId);
          // TODO: Trigger voice commands for this panel
          console.log(`[ModulePanel] Voice activated for ${panelId} panel`);
        }, TWO_FINGER_LONG_PRESS_DURATION);
      }
    },
    [panelId, openModulePicker, setActiveVoicePanel, holdGesture, clearTimers]
  );

  const handleTouchMove = useCallback(() => {
    // Any movement cancels the long-press
    clearTimers();
  }, [clearTimers]);

  const handleTouchEnd = useCallback(() => {
    touchCountRef.current = 0;
    clearTimers();
  }, [clearTimers]);

  // ============================================================
  // Module Rendering
  // ============================================================

  const renderModule = useCallback(() => {
    // Map moduleId to component
    switch (moduleId) {
      case 'menu':
        return <MenuModule panelId={panelId} />;
      case 'chats':
        return <ChatListScreen />;
      case 'contacts':
        return <ContactListScreen />;
      case 'groups':
        return <GroupListScreen />;
      case 'calls':
        return <CallsScreen />;
      case 'radio':
        return <RadioScreen />;
      case 'podcast':
        return <PodcastScreen />;
      case 'books':
        return <BooksScreen />;
      case 'weather':
        return <WeatherScreen />;
      case 'settings':
        return <SettingsMainScreen />;
      case 'help':
        // TODO: Add HelpScreen
        return (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>{t('navigation.help')}</Text>
          </View>
        );
      default:
        // Handle dynamic modules (module:xyz)
        if (moduleId.startsWith('module:')) {
          // TODO: Render dynamic module based on ID
          return (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>{moduleId}</Text>
            </View>
          );
        }
        return (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>{t('common.unknown')}</Text>
          </View>
        );
    }
  }, [moduleId, panelId, t]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <View
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <Suspense fallback={<LoadingFallback />}>
        {renderModule()}
      </Suspense>
    </View>
  );
}

// ============================================================
// Loading Fallback
// ============================================================

function LoadingFallback() {
  const { t } = useTranslation();

  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>{t('common.loading')}</Text>
    </View>
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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  placeholderText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
});

export default ModulePanel;
