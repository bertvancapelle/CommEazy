/**
 * CommEazy Navigation
 *
 * Structure:
 * - Onboarding Stack (first launch)
 *   └── Language → Welcome → Phone → Profile → Backup
 * - Main Tab Navigator
 *   ├── Chats Stack
 *   │   ├── ChatList
 *   │   └── ChatDetail
 *   ├── Contacts Stack
 *   │   ├── ContactList
 *   │   └── ContactDetail / QR Scanner
 *   ├── Groups Stack
 *   │   ├── GroupList
 *   │   └── GroupDetail / CreateGroup
 *   └── Settings Stack
 *
 * Max 2 navigation levels (senior-inclusive).
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

import { colors, typography } from '@/theme';
import { HoldToNavigateWrapper } from '@/components/HoldToNavigateWrapper';

// Placeholder screens — replace with actual implementations
import { PlaceholderScreen } from '@/screens/PlaceholderScreen';

// Chat screens
import { ChatListScreen, ChatScreen } from '@/screens/chat';

// Contact screens
import {
  ContactListScreen,
  ContactDetailScreen,
  AddContactScreen,
  VerifyContactScreen,
} from '@/screens/contacts';

// Onboarding screens
import {
  LanguageSelectScreen,
  WelcomeScreen,
  DeviceChoiceScreen,
  PhoneVerificationScreen,
  DeviceLinkScanScreen,
  DeviceLinkShowQRScreen,
  NameInputScreen,
  PinSetupScreen,
  DemographicsScreen,
  NavigationTutorialScreen,
  CompletionScreen,
} from '@/screens/onboarding';

// Settings screens
import {
  SettingsMainScreen,
  ProfileSettingsScreen,
} from '@/screens/settings';

// Module screens (placeholder for testing wheel navigation)
import {
  CallsScreen,
  VideoCallScreen,
  EBookScreen,
  AudioBookScreen,
  PodcastScreen,
} from '@/screens/modules';

// ============================================================
// Type Definitions
// ============================================================

export type OnboardingStackParams = {
  LanguageSelect: undefined;
  Welcome: undefined;
  DeviceChoice: undefined;
  PhoneVerification: undefined;
  DeviceLinkScan: undefined;
  NameInput: undefined;
  PinSetup: { name: string };
  Demographics: { name: string };
  NavigationTutorial: { name: string };
  Completion: { name: string };
};

export type ChatStackParams = {
  ChatList: undefined;
  ChatDetail: { chatId: string; name: string };
  AudioCall: { contactJid: string; name: string };
  VideoCall: { contactJid: string; name: string };
};

export type ContactStackParams = {
  ContactList: undefined;
  ContactDetail: { jid: string };
  AddContact: undefined;
  VerifyContact: { jid: string; name: string };
  QRScanner: undefined;
  QRDisplay: undefined;
};

export type GroupStackParams = {
  GroupList: undefined;
  GroupDetail: { groupId: string; name: string };
  CreateGroup: undefined;
};

export type SettingsStackParams = {
  SettingsMain: undefined;
  LanguageSettings: undefined;
  ProfileSettings: undefined;
  BackupSettings: undefined;
  DeviceTransfer: undefined;
  DeviceLinkShowQR: undefined;
};

export type MainTabParams = {
  ChatsTab: undefined;
  ContactsTab: undefined;
  GroupsTab: undefined;
  SettingsTab: undefined;
  CallsTab: undefined;
  VideoCallTab: undefined;
  EBookTab: undefined;
  AudioBookTab: undefined;
  PodcastTab: undefined;
};

export type RootStackParams = {
  Onboarding: undefined;
  Main: undefined;
};

// ============================================================
// Navigators
// ============================================================

const RootStack = createNativeStackNavigator<RootStackParams>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParams>();
const ChatStack = createNativeStackNavigator<ChatStackParams>();
const ContactStack = createNativeStackNavigator<ContactStackParams>();
const GroupStack = createNativeStackNavigator<GroupStackParams>();
const SettingsStack = createNativeStackNavigator<SettingsStackParams>();
const MainTab = createBottomTabNavigator<MainTabParams>();

// ============================================================
// Stack Navigators
// ============================================================

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator
      initialRouteName="LanguageSelect"
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: {
          ...typography.bodyBold,
          color: colors.textPrimary,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerShadowVisible: false,
        animation: 'slide_from_right',
      }}
    >
      <OnboardingStack.Screen
        name="LanguageSelect"
        component={LanguageSelectScreen}
        options={{ headerShown: false }}
      />
      <OnboardingStack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ title: '' }}
      />
      <OnboardingStack.Screen
        name="DeviceChoice"
        component={DeviceChoiceScreen}
        options={{ title: '' }}
      />
      <OnboardingStack.Screen
        name="PhoneVerification"
        component={PhoneVerificationScreen}
        options={{ title: '' }}
      />
      <OnboardingStack.Screen
        name="DeviceLinkScan"
        component={DeviceLinkScanScreen}
        options={{ title: '' }}
      />
      <OnboardingStack.Screen
        name="NameInput"
        component={NameInputScreen}
        options={{ title: '' }}
      />
      <OnboardingStack.Screen
        name="PinSetup"
        component={PinSetupScreen}
        options={{ title: '', headerBackVisible: false }}
      />
      <OnboardingStack.Screen
        name="Demographics"
        component={DemographicsScreen}
        options={{ title: '', headerBackVisible: false }}
      />
      <OnboardingStack.Screen
        name="NavigationTutorial"
        component={NavigationTutorialScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <OnboardingStack.Screen
        name="Completion"
        component={CompletionScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </OnboardingStack.Navigator>
  );
}

function ChatsNavigator() {
  const { t } = useTranslation();

  return (
    <ChatStack.Navigator
      screenOptions={{
        headerTitleStyle: typography.h3,
        headerBackTitleVisible: false,
        headerTintColor: colors.primary,
        headerStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <ChatStack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ title: t('tabs.chats') }}
      />
      <ChatStack.Screen
        name="ChatDetail"
        component={ChatScreen}
        options={({ route }) => ({ title: route.params.name })}
      />
      <ChatStack.Screen name="AudioCall" component={PlaceholderScreen} />
      <ChatStack.Screen name="VideoCall" component={PlaceholderScreen} />
    </ChatStack.Navigator>
  );
}

function ContactsNavigator() {
  const { t } = useTranslation();

  return (
    <ContactStack.Navigator
      screenOptions={{
        headerTitleStyle: typography.h3,
        headerBackTitleVisible: false,
        headerTintColor: colors.primary,
        headerStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <ContactStack.Screen
        name="ContactList"
        component={ContactListScreen}
        options={{ title: t('tabs.contacts') }}
      />
      <ContactStack.Screen
        name="ContactDetail"
        component={ContactDetailScreen}
        options={{ title: t('contacts.details') }}
      />
      <ContactStack.Screen
        name="AddContact"
        component={AddContactScreen}
        options={{ title: t('contacts.add') }}
      />
      <ContactStack.Screen
        name="VerifyContact"
        component={VerifyContactScreen}
        options={({ route }) => ({ title: t('contacts.verify') })}
      />
      <ContactStack.Screen name="QRScanner" component={PlaceholderScreen} />
      <ContactStack.Screen name="QRDisplay" component={PlaceholderScreen} />
    </ContactStack.Navigator>
  );
}

function GroupsNavigator() {
  return (
    <GroupStack.Navigator>
      <GroupStack.Screen name="GroupList" component={PlaceholderScreen} />
      <GroupStack.Screen name="GroupDetail" component={PlaceholderScreen} />
      <GroupStack.Screen name="CreateGroup" component={PlaceholderScreen} />
    </GroupStack.Navigator>
  );
}

function SettingsNavigator() {
  const { t } = useTranslation();

  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerTitleStyle: typography.h3,
        headerBackTitleVisible: false,
        headerTintColor: colors.primary,
        headerStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <SettingsStack.Screen
        name="SettingsMain"
        component={SettingsMainScreen}
        options={{ title: t('tabs.settings') }}
      />
      <SettingsStack.Screen
        name="ProfileSettings"
        component={ProfileSettingsScreen}
        options={{ title: t('profile.changePhoto') }}
      />
      <SettingsStack.Screen
        name="LanguageSettings"
        component={PlaceholderScreen}
        options={{ title: t('settings.language') }}
      />
      <SettingsStack.Screen
        name="BackupSettings"
        component={PlaceholderScreen}
        options={{ title: t('settings.backup') }}
      />
      <SettingsStack.Screen
        name="DeviceTransfer"
        component={PlaceholderScreen}
      />
      <SettingsStack.Screen
        name="DeviceLinkShowQR"
        component={DeviceLinkShowQRScreen}
        options={{ title: t('deviceLink.showQRTitle') }}
      />
    </SettingsStack.Navigator>
  );
}

// ============================================================
// Main Tab Navigator
// ============================================================

function MainNavigator() {
  return (
    <HoldToNavigateWrapper enabled={true}>
      <MainTab.Navigator
        screenOptions={{
          headerShown: false,
          // Hide the bottom tab bar completely — navigation is via Hold-to-Navigate
          tabBarStyle: {
            display: 'none',
          },
        }}
      >
        <MainTab.Screen name="ChatsTab" component={ChatsNavigator} />
        <MainTab.Screen name="ContactsTab" component={ContactsNavigator} />
        <MainTab.Screen name="GroupsTab" component={GroupsNavigator} />
        <MainTab.Screen name="SettingsTab" component={SettingsNavigator} />
        <MainTab.Screen name="CallsTab" component={CallsScreen} />
        <MainTab.Screen name="VideoCallTab" component={VideoCallScreen} />
        <MainTab.Screen name="EBookTab" component={EBookScreen} />
        <MainTab.Screen name="AudioBookTab" component={AudioBookScreen} />
        <MainTab.Screen name="PodcastTab" component={PodcastScreen} />
      </MainTab.Navigator>
    </HoldToNavigateWrapper>
  );
}

// ============================================================
// Root Navigator
// ============================================================

export default function AppNavigator() {
  // TODO: Check if user has completed onboarding (from async storage)
  // Set to true in __DEV__ to skip onboarding during development
  const hasCompletedOnboarding = __DEV__ ? true : false;

  return (
    <NavigationContainer>
      <RootStack.Navigator
        initialRouteName={hasCompletedOnboarding ? 'Main' : 'Onboarding'}
        screenOptions={{ headerShown: false }}
      >
        <RootStack.Screen name="Onboarding" component={OnboardingNavigator} />
        <RootStack.Screen name="Main" component={MainNavigator} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
