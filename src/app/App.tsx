/**
 * CommEazy — App Entry Point
 *
 * Initializes services in correct order:
 * 1. i18n (language detection)
 * 2. Encryption (libsodium + keychain)
 * 3. Database (WatermelonDB)
 * 4. XMPP (connection to Prosody)
 * 5. Notifications (Firebase)
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/i18n'; // Initialize i18n
import AppNavigator from '@/navigation';
import { colors } from '@/theme';
import { ServiceProvider } from '@/hooks/useServices';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Respect system reduced motion preference
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );

    // Initialize services
    void initializeApp().then(() => setIsReady(true));

    return () => {
      subscription.remove();
    };
  }, []);

  if (!isReady) {
    return null; // Splash screen handled by native side
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
      />
      <ServiceProvider reducedMotion={reducedMotion}>
        <AppNavigator />
      </ServiceProvider>
    </SafeAreaProvider>
  );
}

async function initializeApp(): Promise<void> {
  // Service initialization will be implemented here
  // Order matters: encryption → database → xmpp → notifications
}
