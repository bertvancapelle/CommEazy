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
import { StatusBar, AccessibilityInfo, AppState, AppStateStatus, View } from 'react-native';
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
import { ButtonStyleProvider } from '@/contexts/ButtonStyleContext';
import { PresenceProvider } from '@/contexts/PresenceContext';
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

    // Handle memory warnings - log for debugging memory issues
    const memoryWarningSubscription = AppState.addEventListener('memoryWarning', () => {
      console.warn('[App] Memory warning received from OS - consider clearing caches');
      // In the future, we could clear image caches here with FastImage.clearMemoryCache()
    });

    // Initialize services
    void initializeApp().then(() => setIsReady(true));

    return () => {
      subscription.remove();
      memoryWarningSubscription.remove();
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
              <ButtonStyleProvider>
              <ModuleColorsProvider>
            <PresenceProvider>
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
            </PresenceProvider>
            </ModuleColorsProvider>
              </ButtonStyleProvider>
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
 * Sends 'away' presence so contacts see orange dot (not offline grey).
 *
 * IMPORTANT: This must complete quickly before iOS suspends the app.
 * We await sendPresence() with a small timeout to ensure the packet is flushed.
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

    // Send away presence so contacts see orange dot
    // We await this to ensure the packet is sent before iOS suspends the app
    const xmpp = ServiceContainer.xmpp;
    const status = xmpp.getConnectionStatus();
    console.log(`[App] XMPP connection status: ${status}`);

    if (status === 'connected') {
      console.log('[App] Sending away presence...');
      await xmpp.sendPresence('away');
      console.log('[App] sendPresence(away) completed');
    } else {
      console.log('[App] XMPP not connected, skipping away presence');
    }
  } catch (error) {
    console.warn('[App] Error in background handler:', error);
  }
}

/**
 * Handle app returning to foreground.
 *
 * CRITICAL: After iOS suspends the app, the WebSocket to Prosody is dead
 * but the in-memory XMPP status may still show 'connected'. We MUST verify
 * the connection is actually alive with a ping before trusting the status.
 * If the ping fails, we disconnect and reconnect to get a fresh session.
 */
async function handleAppForeground(): Promise<void> {
  if (!ServiceContainer.isInitialized) {
    console.log('[App] ServiceContainer not initialized, skipping foreground handler');
    return;
  }

  try {
    const xmpp = ServiceContainer.xmpp;
    const status = xmpp.getConnectionStatus();
    console.log(`[App] Foreground handler: XMPP status = ${status}`);

    if (status === 'connected') {
      // Status says connected, but the WebSocket may be dead after iOS suspension.
      // Send a ping to verify the connection is actually alive.
      console.log('[App] Verifying XMPP connection with ping...');
      const isAlive = await xmpp.ping(3000);

      if (isAlive) {
        // Connection is genuinely alive — just refresh presence
        console.log('[App] XMPP connection verified alive, sending presence');
        await xmpp.sendPresence();
      } else {
        // Connection is dead — force reconnect
        console.log('[App] XMPP connection is dead (ping failed), forcing reconnect...');
        await forceReconnect(xmpp);
      }
    } else {
      // Status is already disconnected/error — reconnect
      console.log(`[App] XMPP status is ${status}, reconnecting...`);
      await forceReconnect(xmpp);
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

/**
 * Force disconnect and reconnect XMPP using stored credentials.
 * Used when the WebSocket is dead after iOS app suspension.
 */
async function forceReconnect(xmpp: typeof ServiceContainer.xmpp): Promise<void> {
  const credentials = ServiceContainer.credentials;

  if (!credentials) {
    console.warn('[App] No stored credentials for reconnect');
    return;
  }

  try {
    // Disconnect the stale session first
    try {
      await xmpp.disconnect();
    } catch {
      // Disconnect may fail on dead socket — that's OK
    }

    // Reconnect with stored credentials
    await xmpp.connect(credentials.jid, credentials.password);
    console.log('[App] XMPP reconnected successfully as', credentials.jid);

    // Re-subscribe to contacts' presence after reconnect
    if (chatService.isInitialized) {
      console.log('[App] Re-subscribing to contacts presence...');
      await chatService.refreshPresenceSubscriptions();
    }
  } catch (connectError) {
    console.warn('[App] XMPP reconnect failed:', connectError);
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
