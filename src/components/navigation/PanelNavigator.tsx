/**
 * PanelNavigator — Stack navigator wrapper for Split View panels
 *
 * Provides navigation context for each panel, enabling sub-navigation
 * (e.g., ContactList → ContactDetail) within the panel.
 *
 * Each module that needs sub-navigation gets its own Stack Navigator.
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { useAccentColor } from '@/hooks/useAccentColor';
import { colors, typography } from '@/theme';
import type { NavigationDestination } from '@/types/navigation';

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
  AccessibilitySettingsScreen,
  VoiceSettingsScreen,
  ModulesSettingsScreen,
  CallSettingsScreen,
} from '@/screens/settings';

// Module screens (no sub-navigation needed)
import {
  CallsScreen,
  PodcastScreen,
  RadioScreen,
  BooksScreen,
  WeatherScreen,
} from '@/screens/modules';

// Components
import { MenuModule } from '@/components/modules/MenuModule';
import { PlaceholderScreen } from '@/screens/PlaceholderScreen';

import type { PanelId } from '@/contexts/SplitViewContext';

// ============================================================
// Type Definitions
// ============================================================

type ChatPanelParams = {
  ChatList: undefined;
  ChatDetail: { chatId: string; name: string };
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
  AccessibilitySettings: undefined;
  VoiceSettings: undefined;
  ModulesSettings: undefined;
  CallSettings: undefined;
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
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();

  return (
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
  );
}

function ContactPanelNavigator() {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();

  return (
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
  );
}

function GroupPanelNavigator() {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();

  return (
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
  );
}

function SettingsPanelNavigator() {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();

  return (
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
        name="AccessibilitySettings"
        component={AccessibilitySettingsScreen}
        options={{ title: t('settings.accessibility') }}
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
    </SettingsPanelStack.Navigator>
  );
}

// ============================================================
// Props
// ============================================================

export interface PanelNavigatorProps {
  /** Panel identifier */
  panelId: PanelId;
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
  const { t } = useTranslation();

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
    case 'help':
      return <PlaceholderScreen />;

    default:
      // Handle dynamic modules (module:xyz)
      if (moduleId.startsWith('module:')) {
        return <PlaceholderScreen />;
      }
      return <PlaceholderScreen />;
  }
}

export default PanelNavigator;
