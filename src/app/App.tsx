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

import React, { useEffect, useState, useRef } from 'react';
import { StatusBar, AccessibilityInfo, AppState, AppStateStatus, Dimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/i18n'; // Initialize i18n
import AppNavigator from '@/navigation';
import { colors } from '@/theme';
import { ServiceProvider } from '@/hooks/useServices';
import { HoldToNavigateProvider } from '@/hooks/useHoldToNavigate';
import { AccentColorProvider } from '@/contexts/AccentColorContext';
import { ThemeProvider, useTheme, useColors } from '@/contexts/ThemeContext';
import { LiquidGlassProvider } from '@/contexts/LiquidGlassContext';
import { ModuleColorsProvider } from '@/contexts/ModuleColorsContext';
import { VoiceFocusProvider } from '@/contexts/VoiceFocusContext';
import { VoiceSettingsProvider } from '@/contexts/VoiceSettingsContext';
import { VoiceFormProvider } from '@/contexts/VoiceFormContext';
import { HoldGestureProvider } from '@/contexts/HoldGestureContext';
import { RadioProvider } from '@/contexts/RadioContext';
import { PodcastProvider } from '@/contexts/PodcastContext';
import { BooksProvider } from '@/contexts/BooksContext';
import { AppleMusicProvider } from '@/contexts/AppleMusicContext';
import { ModuleConfigProvider } from '@/contexts/ModuleConfigContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { CallProvider } from '@/contexts/CallContext';
import { AudioOrchestratorProvider } from '@/contexts/AudioOrchestratorContext';
import { FavoriteLocationsProvider } from '@/contexts/FavoriteLocationsContext';
import { ReducedMotionProvider } from '@/contexts/ReducedMotionContext';
import { ServiceContainer } from '@/services/container';
import { chatService } from '@/services/chat';
import { initializePodcastCache } from '@/services/podcastService';

/**
 * ThemedStatusBar — Dynamically updates StatusBar based on theme
 */
function ThemedStatusBar() {
  const { isDarkMode } = useTheme();
  const themeColors = useColors();

  return (
    <StatusBar
      barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      backgroundColor={themeColors.background}
    />
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

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

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // App came to foreground from background/inactive
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[App] App returned to foreground, reconnecting XMPP...');
        await handleAppForeground();
      }

      // App going to background - send unavailable presence
      if (
        appStateRef.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        console.log('[App] App going to background, sending unavailable presence...');
        await handleAppBackground();
      }

      appStateRef.current = nextAppState;
    };

    const appStateSubscription = AppState.addEventListener(
      'change',
      (state) => void handleAppStateChange(state),
    );

    return () => {
      appStateSubscription.remove();
    };
  }, []);

  if (!isReady) {
    // Return empty View instead of null to keep React Native's UI tree alive
    // This prevents iOS watchdog timeout during service initialization
    // The native splash screen remains visible until the app is ready
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <ReducedMotionProvider>
      <ServiceProvider reducedMotion={reducedMotion}>
        <ThemeProvider>
          <ThemedStatusBar />
          <AccentColorProvider>
            <LiquidGlassProvider>
              <ModuleColorsProvider>
            <VoiceSettingsProvider>
            <VoiceFocusProvider>
              <VoiceFormProvider>
                <HoldGestureProvider>
                  <AudioOrchestratorProvider>
                    <RadioProvider>
                      <PodcastProvider>
                        <BooksProvider>
                          <AppleMusicProvider>
                            <ModuleConfigProvider>
                            <NavigationProvider>
                              <FavoriteLocationsProvider>
                                <CallProvider>
                                  <HoldToNavigateProvider>
                                    <AppNavigator />
                                  </HoldToNavigateProvider>
                                </CallProvider>
                              </FavoriteLocationsProvider>
                            </NavigationProvider>
                            </ModuleConfigProvider>
                          </AppleMusicProvider>
                        </BooksProvider>
                      </PodcastProvider>
                    </RadioProvider>
                  </AudioOrchestratorProvider>
                </HoldGestureProvider>
              </VoiceFormProvider>
            </VoiceFocusProvider>
          </VoiceSettingsProvider>
            </ModuleColorsProvider>
            </LiquidGlassProvider>
          </AccentColorProvider>
        </ThemeProvider>
      </ServiceProvider>
      </ReducedMotionProvider>
    </SafeAreaProvider>
  );
}

/**
 * Handle app going to background.
 * Sends unavailable presence and stops retry timer.
 *
 * IMPORTANT: This must complete quickly before iOS suspends the app.
 * We await sendUnavailable() with a small timeout to ensure the packet is flushed.
 */
async function handleAppBackground(): Promise<void> {
  console.log('[App] handleAppBackground called');

  if (!ServiceContainer.isInitialized) {
    console.log('[App] ServiceContainer not initialized, skipping background handler');
    return;
  }

  try {
    // Stop the outbox retry timer
    chatService.stopRetryTimer();

    // Send unavailable presence
    // We await this to ensure the packet is sent before iOS suspends the app
    const xmpp = ServiceContainer.xmpp;
    const status = xmpp.getConnectionStatus();
    console.log(`[App] XMPP connection status: ${status}`);

    if (status === 'connected') {
      console.log('[App] Sending unavailable presence...');
      await xmpp.sendUnavailable();
      console.log('[App] sendUnavailable completed');
    } else {
      console.log('[App] XMPP not connected, skipping unavailable presence');
    }
  } catch (error) {
    console.warn('[App] Error in background handler:', error);
  }
}

/**
 * Handle app returning to foreground.
 * Reconnects XMPP, sends presence, and starts retry timer for pending messages.
 */
async function handleAppForeground(): Promise<void> {
  if (!ServiceContainer.isInitialized) {
    console.log('[App] ServiceContainer not initialized, skipping foreground handler');
    return;
  }

  try {
    const xmpp = ServiceContainer.xmpp;
    const status = xmpp.getConnectionStatus();

    if (status === 'connected') {
      // Already connected, just send presence to refresh status
      console.log('[App] XMPP already connected, sending presence');
      await xmpp.sendPresence();
    } else {
      // Reconnect XMPP
      console.log(`[App] XMPP status is ${status}, attempting reconnect...`);

      // In dev mode, use stored credentials (same logic as container.ts)
      if (__DEV__) {
        const windowDims = Dimensions.get('window');
        const screenDims = Dimensions.get('screen');
        const width = windowDims.width > 0 ? windowDims.width : screenDims.width;
        const height = windowDims.height > 0 ? windowDims.height : screenDims.height;
        const screenSize = width * height;
        const isSmallDevice = screenSize < 335000;

        const credentials = isSmallDevice
          ? { jid: 'oma@commeazy.local', password: 'test123' }
          : { jid: 'ik@commeazy.local', password: 'test123' };

        try {
          await xmpp.connect(credentials.jid, credentials.password);
          console.log('[App] XMPP reconnected successfully');

          // Re-subscribe to contacts' presence after reconnect
          // This is needed because presence subscriptions may be lost on disconnect
          if (chatService.isInitialized) {
            console.log('[App] Re-subscribing to contacts presence...');
            await chatService.refreshPresenceSubscriptions();
          }
        } catch (connectError) {
          console.warn('[App] XMPP reconnect failed:', connectError);
        }
      }
    }

    // Start the outbox retry timer for pending messages
    // This will retry with exponential backoff: 30s → 1m → 2m → 5m → 15m
    if (chatService.isInitialized) {
      const hasPending = await chatService.hasPendingMessages();
      if (hasPending) {
        console.log('[App] Starting outbox retry timer for pending messages');
        chatService.startRetryTimer();
      }
    }
  } catch (error) {
    console.error('[App] Error in foreground handler:', error);
  }
}

async function initializeApp(): Promise<void> {
  // Add a small delay to ensure all native modules are fully initialized
  // This helps avoid race conditions with the native bridge
  await new Promise(resolve => setTimeout(resolve, 100));

  // Initialize all services (encryption → database → xmpp → notifications)
  try {
    await ServiceContainer.initialize();
    console.log('[App] Services initialized successfully');
  } catch (error) {
    console.error('[App] Service initialization failed:', error);
    // In dev mode, continue anyway so we can test the UI
    if (!__DEV__) {
      throw error;
    }
  }

  // Initialize podcast cache service (for rate limiting and caching)
  try {
    await initializePodcastCache();
    console.log('[App] Podcast cache initialized successfully');
  } catch (error) {
    console.warn('[App] Podcast cache initialization failed:', error);
    // Non-critical, continue anyway
  }
}
