/**
 * PanelNavigator — Stack navigator wrapper for pane-based layout
 *
 * Provides navigation context for each pane, enabling sub-navigation
 * (e.g., ContactList → ContactDetail) within the pane.
 *
 * Each module that needs sub-navigation gets its own Stack Navigator
 * wrapped in an independent NavigationContainer.
 *
 * IMPORTANT: We use NavigationContainer with independent={true} to create
 * isolated navigation contexts for each pane. This allows multiple
 * navigators to coexist without conflicting with the root navigator.
 *
 * Used by both iPhone (1 pane) and iPad (2 panes).
 *
 * @see .claude/plans/sunny-yawning-sunset.md
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { useAccentColor } from '@/hooks/useAccentColor';
import { colors, typography } from '@/theme';
import type { NavigationDestination } from '@/types/navigation';
import { usePanelId, type PaneId } from '@/contexts/PanelIdContext';
import { usePaneContextSafe } from '@/contexts/PaneContext';

// Chat screens
import { ChatListScreen, ChatScreen } from '@/screens/chat';

// Contact screens
import {
  ContactListScreen,
  ContactDetailScreen,
  AddContactScreen,
  VerifyContactScreen,
} from '@/screens/contacts';

// Group screens
import {
  GroupListScreen,
  GroupDetailScreen,
  CreateGroupScreen,
} from '@/screens/group';

// Settings screens
import {
  SettingsMainScreen,
  ProfileSettingsScreen,
  PrivacySettingsScreen,
  AccessibilitySettingsScreen,
  VoiceSettingsScreen,
  ModulesSettingsScreen,
  CallSettingsScreen,
  ComplianceReportScreen,
  AppearanceSettingsScreen,
} from '@/screens/settings';

// Module screens (no sub-navigation needed)
import {
  CallsScreen,
  PodcastScreen,
  RadioScreen,
  BooksScreen,
  BookReaderScreen,
  BookPlayerScreen,
  EBookScreen,
  AudioBookScreen,
  NuNlScreen,
  WeatherScreen,
  AppleMusicScreen,
  CameraScreen,
  PhotoAlbumScreen,
} from '@/screens/modules';

// Components
import { MenuModule } from '@/components/modules/MenuModule';
import { PlaceholderScreen } from '@/screens/PlaceholderScreen';

// Onboarding screens reused in settings
import { DeviceLinkShowQRScreen } from '@/screens/onboarding';

// Dev screens
import { PiperTtsTestScreen } from '@/screens/dev/PiperTtsTestScreen';

// ============================================================
// Type Definitions
// ============================================================

type ChatPanelParams = {
  ChatList: undefined;
  ChatDetail: { chatId: string; name: string; contactJid: string };
};

type ContactPanelParams = {
  ContactList: undefined;
  ContactDetail: { jid: string };
  AddContact: undefined;
  VerifyContact: { jid: string; name: string };
};

type GroupPanelParams = {
  GroupList: undefined;
  GroupDetail: { groupId: string; name: string };
  CreateGroup: undefined;
};

type SettingsPanelParams = {
  SettingsMain: undefined;
  ProfileSettings: undefined;
  PrivacySettings: undefined;
  AccessibilitySettings: undefined;
  VoiceSettings: undefined;
  ModulesSettings: undefined;
  CallSettings: undefined;
  ComplianceReport: undefined;
  AppearanceSettings: undefined;
  LanguageSettings: undefined;
  BackupSettings: undefined;
  DeviceTransfer: undefined;
  DeviceLinkShowQR: undefined;
  PiperTtsTest: undefined;
};

// ============================================================
// Stack Navigators
// ============================================================

const ChatPanelStack = createNativeStackNavigator<ChatPanelParams>();
const ContactPanelStack = createNativeStackNavigator<ContactPanelParams>();
const GroupPanelStack = createNativeStackNavigator<GroupPanelParams>();
const SettingsPanelStack = createNativeStackNavigator<SettingsPanelParams>();

// ============================================================
// Panel Navigator Components
// ============================================================

function ChatPanelNavigator() {
  const { accentColor } = useAccentColor();
  const panelId = usePanelId();
  const paneCtx = usePaneContextSafe();
  const navRef = useRef<NavigationContainerRef<ChatPanelParams>>(null);
  const isReadyRef = useRef(false);

  // Consume pending navigation — called on mount (onReady) and on state changes
  const consumePending = useCallback(() => {
    if (!panelId || !paneCtx || !navRef.current) return;
    const pending = paneCtx.consumePendingNavigation(panelId);
    if (pending && pending.screen === 'ChatDetail') {
      console.info('[ChatPanelNav] Navigating to ChatDetail via pending navigation');
      navRef.current.navigate('ChatDetail', pending.params as ChatPanelParams['ChatDetail']);
    }
  }, [panelId, paneCtx]);

  const handleReady = useCallback(() => {
    isReadyRef.current = true;
    consumePending();
  }, [consumePending]);

  // When the pane already shows 'chats' and a new pendingNavigation arrives,
  // the component is NOT remounted — we need an effect to catch it
  const paneState = paneCtx && panelId ? paneCtx.panes[panelId] : null;

  useEffect(() => {
    if (isReadyRef.current && paneState?.pendingNavigation) {
      consumePending();
    }
  }, [paneState?.pendingNavigation, consumePending]);

  return (
    <NavigationContainer independent={true} ref={navRef} onReady={handleReady}>
      <ChatPanelStack.Navigator
        screenOptions={{
          headerTitleStyle: typography.h3,
          headerBackTitleVisible: false,
          headerTintColor: accentColor.primary,
          headerStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <ChatPanelStack.Screen
          name="ChatList"
          component={ChatListScreen}
          options={{ headerShown: false }}
        />
        <ChatPanelStack.Screen
          name="ChatDetail"
          component={ChatScreen}
          options={({ route }) => ({ title: route.params.name })}
        />
      </ChatPanelStack.Navigator>
    </NavigationContainer>
  );
}

function ContactPanelNavigator() {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();

  return (
    <NavigationContainer independent={true}>
      <ContactPanelStack.Navigator
        screenOptions={{
          headerTitleStyle: typography.h3,
          headerBackTitleVisible: false,
          headerTintColor: accentColor.primary,
          headerStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <ContactPanelStack.Screen
          name="ContactList"
          component={ContactListScreen}
          options={{ headerShown: false }}
        />
        <ContactPanelStack.Screen
          name="ContactDetail"
          component={ContactDetailScreen}
          options={{ title: t('contacts.details') }}
        />
        <ContactPanelStack.Screen
          name="AddContact"
          component={AddContactScreen}
          options={{ title: t('contacts.add') }}
        />
        <ContactPanelStack.Screen
          name="VerifyContact"
          component={VerifyContactScreen}
          options={{ title: t('contacts.verify') }}
        />
      </ContactPanelStack.Navigator>
    </NavigationContainer>
  );
}

function GroupPanelNavigator() {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();

  return (
    <NavigationContainer independent={true}>
      <GroupPanelStack.Navigator
        screenOptions={{
          headerTitleStyle: typography.h3,
          headerBackTitleVisible: false,
          headerTintColor: accentColor.primary,
          headerStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <GroupPanelStack.Screen
          name="GroupList"
          component={GroupListScreen}
          options={{ headerShown: false }}
        />
        <GroupPanelStack.Screen
          name="GroupDetail"
          component={GroupDetailScreen}
          options={({ route }) => ({ title: route.params.name })}
        />
        <GroupPanelStack.Screen
          name="CreateGroup"
          component={CreateGroupScreen}
          options={{ title: t('group.create') }}
        />
      </GroupPanelStack.Navigator>
    </NavigationContainer>
  );
}

function SettingsPanelNavigator() {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();

  return (
    <NavigationContainer independent={true}>
      <SettingsPanelStack.Navigator
        screenOptions={{
          headerTitleStyle: typography.h3,
          headerBackTitleVisible: false,
          headerTintColor: accentColor.primary,
          headerStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <SettingsPanelStack.Screen
          name="SettingsMain"
          component={SettingsMainScreen}
          options={{ headerShown: false }}
        />
        <SettingsPanelStack.Screen
          name="ProfileSettings"
          component={ProfileSettingsScreen}
          options={{ title: t('profile.changePhoto') }}
        />
        <SettingsPanelStack.Screen
          name="PrivacySettings"
          component={PrivacySettingsScreen}
          options={{ title: t('privacySettings.title') }}
        />
        <SettingsPanelStack.Screen
          name="AccessibilitySettings"
          component={AccessibilitySettingsScreen}
          options={{ title: t('settings.accessibility') }}
        />
        <SettingsPanelStack.Screen
          name="ComplianceReport"
          component={ComplianceReportScreen}
          options={{ headerShown: false }}
        />
        <SettingsPanelStack.Screen
          name="VoiceSettings"
          component={VoiceSettingsScreen}
          options={{ title: t('voiceSettings.title') }}
        />
        <SettingsPanelStack.Screen
          name="ModulesSettings"
          component={ModulesSettingsScreen}
          options={{ title: t('modulesSettings.title'), headerShown: false }}
        />
        <SettingsPanelStack.Screen
          name="CallSettings"
          component={CallSettingsScreen}
          options={{ title: t('callSettings.title') }}
        />
        <SettingsPanelStack.Screen
          name="AppearanceSettings"
          component={AppearanceSettingsScreen}
          options={{ title: t('appearance.title') }}
        />
        <SettingsPanelStack.Screen
          name="LanguageSettings"
          component={PlaceholderScreen}
          options={{ title: t('settings.language') }}
        />
        <SettingsPanelStack.Screen
          name="BackupSettings"
          component={PlaceholderScreen}
          options={{ title: t('settings.backup') }}
        />
        <SettingsPanelStack.Screen
          name="DeviceTransfer"
          component={PlaceholderScreen}
        />
        <SettingsPanelStack.Screen
          name="DeviceLinkShowQR"
          component={DeviceLinkShowQRScreen}
          options={{ title: t('settings.deviceLink') }}
        />
        {/* DEV: Piper TTS Test Screen */}
        {__DEV__ && (
          <SettingsPanelStack.Screen
            name="PiperTtsTest"
            component={PiperTtsTestScreen}
            options={{ title: '🔊 Piper TTS Test' }}
          />
        )}
      </SettingsPanelStack.Navigator>
    </NavigationContainer>
  );
}

// ============================================================
// Props
// ============================================================

export interface PanelNavigatorProps {
  /** Pane identifier */
  panelId: PaneId;
  /** Module to display */
  moduleId: NavigationDestination;
}

// ============================================================
// Main Component
// ============================================================

/**
 * Renders the appropriate navigator or screen for a given module.
 * Modules with sub-navigation get wrapped in their own Stack Navigator.
 * Modules without sub-navigation are rendered directly.
 */
export function PanelNavigator({ panelId, moduleId }: PanelNavigatorProps) {
  switch (moduleId) {
    // Modules WITH sub-navigation — wrapped in Stack Navigators
    case 'chats':
      return <ChatPanelNavigator />;
    case 'contacts':
      return <ContactPanelNavigator />;
    case 'groups':
      return <GroupPanelNavigator />;
    case 'settings':
      return <SettingsPanelNavigator />;

    // Menu module — special case, needs panelId
    case 'menu':
      return <MenuModule panelId={panelId} />;

    // Modules WITHOUT sub-navigation — rendered directly
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
    case 'appleMusic':
      return <AppleMusicScreen />;
    case 'camera':
      return <CameraScreen />;
    case 'photoAlbum':
      return <PhotoAlbumScreen />;
    case 'help':
      return <PlaceholderScreen />;

    default:
      // Handle dynamic modules (module:xyz)
      if (moduleId === 'module:nunl') {
        return <NuNlScreen />;
      }
      if (moduleId.startsWith('module:')) {
        return <PlaceholderScreen />;
      }
      return <PlaceholderScreen />;
  }
}

export default PanelNavigator;
