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

import { colors, typography, touchTargets } from '@/theme';

// Placeholder screens — replace with actual implementations
import { PlaceholderScreen } from '@/screens/PlaceholderScreen';

// Onboarding screens
import {
  LanguageSelectScreen,
  WelcomeScreen,
  PhoneVerificationScreen,
  NameInputScreen,
  PinSetupScreen,
  CompletionScreen,
} from '@/screens/onboarding';

// ============================================================
// Type Definitions
// ============================================================

export type OnboardingStackParams = {
  LanguageSelect: undefined;
  Welcome: undefined;
  PhoneVerification: undefined;
  NameInput: undefined;
  PinSetup: { name: string };
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
};

export type MainTabParams = {
  ChatsTab: undefined;
  ContactsTab: undefined;
  GroupsTab: undefined;
  SettingsTab: undefined;
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
        name="PhoneVerification"
        component={PhoneVerificationScreen}
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
        name="Completion"
        component={CompletionScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </OnboardingStack.Navigator>
  );
}

function ChatsNavigator() {
  return (
    <ChatStack.Navigator
      screenOptions={{
        headerTitleStyle: typography.h3,
        headerBackTitleVisible: false,
      }}
    >
      <ChatStack.Screen name="ChatList" component={PlaceholderScreen} />
      <ChatStack.Screen name="ChatDetail" component={PlaceholderScreen} />
      <ChatStack.Screen name="AudioCall" component={PlaceholderScreen} />
      <ChatStack.Screen name="VideoCall" component={PlaceholderScreen} />
    </ChatStack.Navigator>
  );
}

function ContactsNavigator() {
  return (
    <ContactStack.Navigator>
      <ContactStack.Screen name="ContactList" component={PlaceholderScreen} />
      <ContactStack.Screen name="ContactDetail" component={PlaceholderScreen} />
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
  return (
    <SettingsStack.Navigator>
      <SettingsStack.Screen name="SettingsMain" component={PlaceholderScreen} />
      <SettingsStack.Screen name="LanguageSettings" component={PlaceholderScreen} />
      <SettingsStack.Screen name="ProfileSettings" component={PlaceholderScreen} />
      <SettingsStack.Screen name="BackupSettings" component={PlaceholderScreen} />
      <SettingsStack.Screen name="DeviceTransfer" component={PlaceholderScreen} />
    </SettingsStack.Navigator>
  );
}

// ============================================================
// Main Tab Navigator
// ============================================================

function MainNavigator() {
  const { t } = useTranslation();

  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarLabelStyle: {
          ...typography.label,
          fontSize: 14,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          height: touchTargets.comfortable,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          minHeight: touchTargets.minimum,
        },
      }}
    >
      <MainTab.Screen
        name="ChatsTab"
        component={ChatsNavigator}
        options={{ tabBarLabel: t('tabs.chats') }}
      />
      <MainTab.Screen
        name="ContactsTab"
        component={ContactsNavigator}
        options={{ tabBarLabel: t('tabs.contacts') }}
      />
      <MainTab.Screen
        name="GroupsTab"
        component={GroupsNavigator}
        options={{ tabBarLabel: t('tabs.groups') }}
      />
      <MainTab.Screen
        name="SettingsTab"
        component={SettingsNavigator}
        options={{ tabBarLabel: t('tabs.settings') }}
      />
    </MainTab.Navigator>
  );
}

// ============================================================
// Root Navigator
// ============================================================

export default function AppNavigator() {
  // TODO: Check if user has completed onboarding
  const hasCompletedOnboarding = false;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!hasCompletedOnboarding ? (
          <RootStack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <RootStack.Screen name="Main" component={MainNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
