/**
 * CommEazy Navigation
 *
 * Structure:
 * - Onboarding Stack (first launch)
 *   └── Language → Welcome → Phone → Profile → Backup
 * - Main (pane-based)
 *   ├── iPhone: PaneProvider(1) → SinglePaneLayout → PanelNavigator
 *   └── iPad:  PaneProvider(2) → SplitViewLayout  → PanelNavigator ×2
 * - Call screens (full-screen modals over everything)
 *
 * All module stacks defined in PanelNavigator.tsx.
 * Max 2 navigation levels (senior-inclusive).
 */

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useCall } from '@/contexts/CallContext';

import { colors, typography } from '@/theme';
import { AdaptiveNavigationWrapper } from '@/components/navigation';
import { useAccentColor } from '@/hooks/useAccentColor';

// Onboarding screens
import {
  LanguageSelectScreen,
  WelcomeScreen,
  DeviceChoiceScreen,
  PhoneVerificationScreen,
  DeviceLinkScanScreen,
  NameInputScreen,
  PinSetupScreen,
  DemographicsScreen,
  NavigationTutorialScreen,
  CompletionScreen,
} from '@/screens/onboarding';

// Call screens (presented as modals over root navigator)
import {
  IncomingCallScreen,
  ActiveCallScreen,
} from '@/screens/call';

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
  PrivacySettings: undefined;  // External links, etc.
  AccessibilitySettings: undefined;
  ComplianceReport: undefined;  // WCAG AAA + EN 301 549 compliance report
  VoiceSettings: undefined;
  ModulesSettings: undefined;
  CallSettings: undefined;  // Call sound and vibration settings
  AppearanceSettings: undefined;  // Theme (light/dark/system) + Accent color + Liquid Glass
  BackupSettings: undefined;
  DeviceTransfer: undefined;
  DeviceLinkShowQR: undefined;
  PiperTtsTest: undefined;  // DEV: Test screen for Piper TTS
};

// MainTabParams removed — tab navigation replaced by PaneContext

export type CallStackParams = {
  IncomingCall: { callId: string };
  ActiveCall: { callId: string };
};

export type RootStackParams = {
  Onboarding: undefined;
  Main: undefined;
  // Call screens presented as modals over everything
  IncomingCall: { callId: string };
  ActiveCall: { callId: string };
};

// ============================================================
// Navigators
// ============================================================

const RootStack = createNativeStackNavigator<RootStackParams>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParams>();
// Old stack/tab navigators (ChatStack, ContactStack, GroupStack, SettingsStack, MainTab)
// removed — screen stacks are now in PanelNavigator.tsx

// ============================================================
// Stack Navigators
// ============================================================

function OnboardingNavigator() {
  const { accentColor } = useAccentColor();

  return (
    <OnboardingStack.Navigator
      initialRouteName="LanguageSelect"
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
        headerTintColor: accentColor.primary,
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

// Old stack navigators (ChatsNavigator, ContactsNavigator, GroupsNavigator, SettingsNavigator)
// removed — screen stacks are now defined in PanelNavigator.tsx

// ============================================================
// Main Navigator (pane-based)
// ============================================================

function MainNavigator() {
  return <AdaptiveNavigationWrapper enabled={true} />;
}

// ============================================================
// Root Navigator
// ============================================================

/**
 * Inner navigator that can use useCall hook (inside CallProvider).
 * Handles automatic navigation to IncomingCall screen.
 */
function RootNavigator() {
  const navigationRef = useNavigationContainerRef<RootStackParams>();
  const { activeCall } = useCall();
  const previousCallStateRef = useRef<string | null>(null);

  // TODO: Check if user has completed onboarding (from async storage)
  // Set to true in __DEV__ to skip onboarding during development
  const hasCompletedOnboarding = __DEV__ ? true : false;

  // Navigate to IncomingCall when an incoming call is detected
  useEffect(() => {
    if (!activeCall) {
      previousCallStateRef.current = null;
      return;
    }

    const currentState = activeCall.state;
    const previousState = previousCallStateRef.current;

    // Only navigate on state changes
    if (currentState === previousState) return;
    previousCallStateRef.current = currentState;

    // Navigate to IncomingCall for incoming ringing calls
    if (
      activeCall.direction === 'incoming' &&
      currentState === 'ringing' &&
      previousState !== 'ringing'
    ) {
      console.info('[Navigation] Navigating to IncomingCall:', activeCall.id);
      navigationRef.navigate('IncomingCall', { callId: activeCall.id });
    }

    // Navigate to ActiveCall when call connects
    if (currentState === 'connected' && previousState !== 'connected') {
      console.info('[Navigation] Navigating to ActiveCall:', activeCall.id);
      navigationRef.navigate('ActiveCall', { callId: activeCall.id });
    }
  }, [activeCall, navigationRef]);

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator
        initialRouteName={hasCompletedOnboarding ? 'Main' : 'Onboarding'}
        screenOptions={{ headerShown: false }}
      >
        <RootStack.Screen name="Onboarding" component={OnboardingNavigator} />
        <RootStack.Screen name="Main" component={MainNavigator} />

        {/* Call screens — presented as full-screen modals over everything */}
        <RootStack.Screen
          name="IncomingCall"
          component={IncomingCallScreen}
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
            gestureEnabled: false, // Can't swipe away incoming call
          }}
        />
        <RootStack.Screen
          name="ActiveCall"
          component={ActiveCallScreen}
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
            gestureEnabled: false, // Can't swipe away active call
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function AppNavigator() {
  return <RootNavigator />;
}
