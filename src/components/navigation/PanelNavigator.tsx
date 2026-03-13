/**
 * PanelNavigator — Stack navigator wrapper for pane-based layout
 *
 * Provides navigation context for each pane, enabling sub-navigation
 * (e.g., ContactList → ContactDetail) within the pane.
 *
 * Each module that needs sub-navigation gets its own Stack Navigator
 * wrapped in an independent NavigationContainer.
 *
 * IMPORTANT: We wrap each NavigationContainer in NavigationIndependentTree
 * (React Navigation 7) to create isolated navigation contexts for each pane.
 * This allows multiple navigators to coexist without conflicting with the
 * root navigator.
 *
 * Used by both iPhone (1 pane) and iPad (2 panes).
 *
 * @see .claude/plans/sunny-yawning-sunset.md
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { NavigationContainer, NavigationIndependentTree, type NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAccentColor } from '@/hooks/useAccentColor';
import { colors, typography } from '@/theme';
import type { NavigationDestination } from '@/types/navigation';
import { usePanelId, type PaneId } from '@/contexts/PanelIdContext';
import { usePaneContextSafe } from '@/contexts/PaneContext';
import { useModuleBrowsingContextSafe, type BooksBrowsingState } from '@/contexts/ModuleBrowsingContext';

// Chat screens
import { ChatListScreen, ChatScreen } from '@/screens/chat';

// Contact screens
import {
  ContactListScreen,
  ContactDetailScreen,
  AddContactScreen,
  ManualAddContactScreen,
  InviteContactScreen,
  AcceptInvitationScreen,
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
  MailSettingsScreen,
  AppleMusicSettingsScreen,
} from '@/screens/settings';

// HomeScreen (start screen / grid)
import { HomeScreen } from '@/screens/HomeScreen';

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
  AskAIScreen,
  AgendaScreen,
} from '@/screens/modules';

// Mail screens
import { MailScreen } from '@/screens/mail/MailScreen';
import { MailOnboardingScreen } from '@/screens/mail/MailOnboardingScreen';

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
  ManualAddContact: undefined;
  InviteContact: undefined;
  AcceptInvitation: undefined;
  VerifyContact: { jid: string; name: string };
};

type GroupPanelParams = {
  GroupList: undefined;
  GroupDetail: { groupId: string; name: string };
  CreateGroup: undefined;
};

type BooksPanelParams = {
  BooksList: undefined;
  BookReader: undefined;
  BookPlayer: undefined;
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
  MailSettings: undefined;
  MailOnboarding: undefined;
  AppleMusicSettings: undefined;
};

// ============================================================
// Stack Navigators
// ============================================================

const ChatPanelStack = createNativeStackNavigator<ChatPanelParams>();
const ContactPanelStack = createNativeStackNavigator<ContactPanelParams>();
const GroupPanelStack = createNativeStackNavigator<GroupPanelParams>();
const BooksPanelStack = createNativeStackNavigator<BooksPanelParams>();
const SettingsPanelStack = createNativeStackNavigator<SettingsPanelParams>();

// ============================================================
// Shared Hooks
// ============================================================

/**
 * Listen for pane:goBack events and pop the navigation stack.
 * Each panel navigator calls this to enable voice command "back" support.
 */
function usePaneGoBack(
  navRef: React.RefObject<NavigationContainerRef<any> | null>,
  panelId: PaneId | undefined
) {
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'pane:goBack',
      (event: { paneId: string }) => {
        if (!panelId || event.paneId !== panelId) return;
        if (navRef.current?.canGoBack()) {
          navRef.current.goBack();
        }
      }
    );
    return () => subscription.remove();
  }, [navRef, panelId]);
}

// ============================================================
// Panel Navigator Components
// ============================================================

function ChatPanelNavigator() {
  const { accentColor } = useAccentColor();
  const panelId = usePanelId();
  const paneCtx = usePaneContextSafe();
  const navRef = useRef<NavigationContainerRef<ChatPanelParams>>(null);
  const isReadyRef = useRef(false);

  usePaneGoBack(navRef, panelId);

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
    <NavigationIndependentTree>
      <NavigationContainer ref={navRef} onReady={handleReady}>
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
    </NavigationIndependentTree>
  );
}

function ContactPanelNavigator() {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const panelId = usePanelId();
  const navRef = useRef<NavigationContainerRef<ContactPanelParams>>(null);

  usePaneGoBack(navRef, panelId);

  return (
    <NavigationIndependentTree>
      <NavigationContainer ref={navRef}>
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
            options={{ title: t('contacts.addButton') }}
          />
          <ContactPanelStack.Screen
            name="ManualAddContact"
            component={ManualAddContactScreen}
            options={{ headerShown: false }}
          />
          <ContactPanelStack.Screen
            name="InviteContact"
            component={InviteContactScreen}
            options={{ title: t('contacts.invite.title', 'Iemand uitnodigen') }}
          />
          <ContactPanelStack.Screen
            name="AcceptInvitation"
            component={AcceptInvitationScreen}
            options={{ title: t('contacts.accept.title', 'Code invoeren') }}
          />
          <ContactPanelStack.Screen
            name="VerifyContact"
            component={VerifyContactScreen}
            options={{ title: t('contacts.verify') }}
          />
        </ContactPanelStack.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}

function GroupPanelNavigator() {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const panelId = usePanelId();
  const navRef = useRef<NavigationContainerRef<GroupPanelParams>>(null);

  usePaneGoBack(navRef, panelId);

  return (
    <NavigationIndependentTree>
      <NavigationContainer ref={navRef}>
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
    </NavigationIndependentTree>
  );
}

/**
 * BooksPanelNavigator — Stack navigation for Books module
 *
 * Enables sub-navigation from BooksScreen → BookReaderScreen / BookPlayerScreen.
 * When user returns via MediaIndicator, the saved activeView in BrowsingContext
 * determines whether to auto-navigate to the reader or player screen.
 */
function BooksPanelNavigator() {
  const panelId = usePanelId();
  const navRef = useRef<NavigationContainerRef<BooksPanelParams>>(null);
  const isReadyRef = useRef(false);
  const browsingCtx = useModuleBrowsingContextSafe();

  usePaneGoBack(navRef, panelId);

  // On mount (when module becomes active), check if we should auto-navigate
  // to BookReader or BookPlayer based on saved browsing state
  const restoreActiveView = useCallback(() => {
    if (!browsingCtx || !navRef.current) return;

    const saved = browsingCtx.getBrowsingState<BooksBrowsingState>('books');
    if (!saved?.activeView || saved.activeView === 'list') return;

    const targetScreen = saved.activeView === 'reader' ? 'BookReader' : 'BookPlayer';
    console.info('[BooksPanelNav] Restoring activeView:', targetScreen);
    navRef.current.navigate(targetScreen);
  }, [browsingCtx]);

  const handleReady = useCallback(() => {
    isReadyRef.current = true;
    restoreActiveView();
  }, [restoreActiveView]);

  return (
    <NavigationIndependentTree>
      <NavigationContainer ref={navRef} onReady={handleReady}>
        <BooksPanelStack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <BooksPanelStack.Screen
            name="BooksList"
            component={BooksScreen}
          />
          <BooksPanelStack.Screen
            name="BookReader"
            component={BookReaderScreen}
          />
          <BooksPanelStack.Screen
            name="BookPlayer"
            component={BookPlayerScreen}
          />
        </BooksPanelStack.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}

/**
 * Wrapper for MailOnboardingScreen within the Settings stack.
 * Provides onComplete/onClose callbacks that navigate back.
 */
function MailOnboardingWrapper({ navigation }: { navigation: NativeStackNavigationProp<SettingsPanelParams, 'MailOnboarding'> }) {
  const handleComplete = useCallback(async () => {
    // Mark onboarding as complete so MailScreen shows the inbox
    await AsyncStorage.setItem('mail_onboarding_complete', 'true');
    await AsyncStorage.setItem('mail_welcome_shown', 'true');
    navigation.goBack();
  }, [navigation]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <MailOnboardingScreen
      onComplete={handleComplete}
      onAddAnother={() => {}}
      onClose={handleClose}
    />
  );
}

function SettingsPanelNavigator() {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const panelId = usePanelId();
  const navRef = useRef<NavigationContainerRef<SettingsPanelParams>>(null);

  usePaneGoBack(navRef, panelId);

  return (
    <NavigationIndependentTree>
      <NavigationContainer ref={navRef}>
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
          <SettingsPanelStack.Screen
            name="MailSettings"
            component={MailSettingsScreen}
            options={{ title: t('mailSettings.title') }}
          />
          <SettingsPanelStack.Screen
            name="MailOnboarding"
            component={MailOnboardingWrapper}
            options={{ headerShown: false }}
          />
          <SettingsPanelStack.Screen
            name="AppleMusicSettings"
            component={AppleMusicSettingsScreen}
            options={{ title: t('appleMusicSettings.title') }}
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
    </NavigationIndependentTree>
  );
}

// ============================================================
// HomeScreen Navigator
// ============================================================

function HomePanelNavigator() {
  const panelId = usePanelId();
  const paneCtx = usePaneContextSafe();

  const handleModulePress = useCallback(
    (moduleId: NavigationDestination) => {
      if (paneCtx && panelId) {
        paneCtx.setPaneModule(panelId, moduleId);
      }
    },
    [paneCtx, panelId],
  );

  return (
    <HomeScreen
      onModulePress={handleModulePress}
      variant={panelId === 'main' ? 'fullscreen' : 'pane'}
    />
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
    // HomeScreen grid — start screen
    case 'home':
      return <HomePanelNavigator />;

    // Modules WITH sub-navigation — wrapped in Stack Navigators
    case 'chats':
      return <ChatPanelNavigator />;
    case 'contacts':
      return <ContactPanelNavigator />;
    case 'groups':
      return <GroupPanelNavigator />;
    case 'books':
      return <BooksPanelNavigator />;
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
    case 'weather':
      return <WeatherScreen />;
    case 'appleMusic':
      return <AppleMusicScreen />;
    case 'camera':
      return <CameraScreen />;
    case 'photoAlbum':
      return <PhotoAlbumScreen />;
    case 'askAI':
      return <AskAIScreen />;
    case 'mail':
      return <MailScreen />;
    case 'agenda':
      return <AgendaScreen />;
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
