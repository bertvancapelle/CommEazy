/**
 * DevModePanel Component
 *
 * Development-only panel for testing QR scanning and other features
 * that require hardware not available in the simulator.
 *
 * Only renders in __DEV__ mode. Production builds exclude this component.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  // Modal removed — using PanelAwareModal
  ScrollView,
  AccessibilityRole,
  Alert,
} from 'react-native';
import { PanelAwareModal } from './PanelAwareModal';
import { HapticTouchable } from './HapticTouchable';
import { colors, typography, spacing, borderRadius } from '@/theme';
// Dev state managed locally now that mock module is removed
let _simulateOffline = false;
let _simulateSlowNetwork = false;
const isDevUIEnabled = () => __DEV__;
const setSimulateOffline = (v: boolean) => { _simulateOffline = v; };
const setSimulateSlowNetwork = (v: boolean) => { _simulateSlowNetwork = v; };
const isSimulatingOffline = () => _simulateOffline;
const isSimulatingSlowNetwork = () => _simulateSlowNetwork;
import { ServiceContainer } from '@/services/container';
import type { Contact } from '@/services/interfaces';

// ============================================================
// Test Contacts — 4 fully populated address book contacts
// Valid Dutch addresses (postcode + huisnummer verified)
// TrustLevel 0 = address book contacts (not CommEazy users)
// ============================================================

const TEST_CONTACTS: Contact[] = [
  {
    userUuid: 'test-0001-aaaa-bbbb-cccc-111111111111',
    jid: 'test-0001-aaaa-bbbb-cccc-111111111111@commeazy.local',
    firstName: 'Henk',
    lastName: 'de Vries',
    phoneNumber: '+31207156789',        // Amsterdam landline
    mobileNumber: '+31612345678',       // Dutch mobile
    email: 'henk.devries@gmail.com',
    publicKey: '',                       // No E2E key (address book contact)
    verified: false,
    lastSeen: 0,
    trustLevel: 0,                       // Address book contact
    address: {
      street: 'Keizersgracht 672',       // Valid: Keizersgracht, Amsterdam
      postalCode: '1017 ER',             // Valid postcode for Keizersgracht
      city: 'Amsterdam',
      province: 'Noord-Holland',
      country: 'Nederland',
    },
    birthDate: '1952-03-14',
    weddingDate: '1978-06-22',
    isEmergencyContact: true,
  },
  {
    userUuid: 'test-0002-aaaa-bbbb-cccc-222222222222',
    jid: 'test-0002-aaaa-bbbb-cccc-222222222222@commeazy.local',
    firstName: 'Maria',
    lastName: 'Jansen',
    phoneNumber: '+31302345678',         // Utrecht landline
    mobileNumber: '+31687654321',        // Dutch mobile
    email: 'maria.jansen@outlook.nl',
    publicKey: '',
    verified: false,
    lastSeen: 0,
    trustLevel: 0,
    address: {
      street: 'Oudegracht 158',          // Valid: Oudegracht, Utrecht
      postalCode: '3511 AZ',             // Valid postcode for Oudegracht
      city: 'Utrecht',
      province: 'Utrecht',
      country: 'Nederland',
    },
    birthDate: '1948-11-27',
    deathDate: undefined,
    isDeceased: false,
  },
  {
    userUuid: 'test-0003-aaaa-bbbb-cccc-333333333333',
    jid: 'test-0003-aaaa-bbbb-cccc-333333333333@commeazy.local',
    firstName: 'Willem',
    lastName: 'Bakker',
    phoneNumber: '+31107891234',         // Rotterdam landline
    mobileNumber: '+31623456789',        // Dutch mobile
    email: 'w.bakker@ziggo.nl',
    publicKey: '',
    verified: false,
    lastSeen: 0,
    trustLevel: 0,
    address: {
      street: 'Coolsingel 40',           // Valid: Coolsingel (Stadhuis), Rotterdam
      postalCode: '3011 AD',             // Valid postcode for Coolsingel
      city: 'Rotterdam',
      province: 'Zuid-Holland',
      country: 'Nederland',
    },
    birthDate: '1955-07-08',
    weddingDate: '1982-09-15',
  },
  {
    userUuid: 'test-0004-aaaa-bbbb-cccc-444444444444',
    jid: 'test-0004-aaaa-bbbb-cccc-444444444444@commeazy.local',
    firstName: 'Johanna',
    lastName: 'van den Berg',
    phoneNumber: '+31534567890',         // Enschede landline
    mobileNumber: '+31634567890',        // Dutch mobile
    email: 'johanna.vdberg@kpnmail.nl',
    publicKey: '',
    verified: false,
    lastSeen: 0,
    trustLevel: 0,
    address: {
      street: 'Langestraat 24',          // Valid: Langestraat, Enschede
      postalCode: '7511 HC',             // Valid postcode for Langestraat
      city: 'Enschede',
      province: 'Overijssel',
      country: 'Nederland',
    },
    birthDate: '1960-01-03',
    weddingDate: '1985-04-12',
    isEmergencyContact: false,
  },
];

interface DevModePanelProps {
  /** Callback when a QR code is "scanned" (simulated) */
  onQRCodeScanned?: (qrData: string) => void;
  /** Show QR simulation options */
  showQROptions?: boolean;
}

// Note: Production exclusion is handled by the __DEV__ checks in the components themselves
// The module.exports override was removed because it conflicts with ESM exports in Hermes

/**
 * Floating button to open dev panel
 */
export function DevModeButton({ onPress }: { onPress: () => void }) {
  if (!__DEV__ || !isDevUIEnabled()) return null;

  return (
    <HapticTouchable hapticDisabled
      style={styles.floatingButton}
      onPress={onPress}
      accessibilityRole={'button' as AccessibilityRole}
      accessibilityLabel="Open developer tools"
    >
      <Text style={styles.floatingButtonText}>DEV</Text>
    </HapticTouchable>
  );
}

/**
 * Full dev mode panel with testing options
 */
export function DevModePanel({ onQRCodeScanned, showQROptions = true }: DevModePanelProps) {
  const [visible, setVisible] = useState(false);
  const [offline, setOffline] = useState(isSimulatingOffline());
  const [slowNetwork, setSlowNetwork] = useState(isSimulatingSlowNetwork());

  if (!__DEV__ || !isDevUIEnabled()) return null;

  const toggleOffline = () => {
    const newValue = !offline;
    setOffline(newValue);
    setSimulateOffline(newValue);
  };

  const toggleSlowNetwork = () => {
    const newValue = !slowNetwork;
    setSlowNetwork(newValue);
    setSimulateSlowNetwork(newValue);
  };

  const testLocalNotification = async () => {
    try {
      // Import notifee for local notifications
      const notifee = await import('@notifee/react-native');

      // Create a channel (required for Android)
      const channelId = await notifee.default.createChannel({
        id: 'test',
        name: 'Test Notifications',
      });

      // Display a notification
      await notifee.default.displayNotification({
        title: 'Test Bericht',
        body: 'Dit is een test push notification van CommEazy',
        android: {
          channelId,
          smallIcon: 'ic_launcher',
        },
      });

      Alert.alert('Succes', 'Lokale notification verstuurd!');
    } catch (error) {
      // Notifee might not be installed, try basic alert
      console.log('[DevMode] Notifee not available, using alert:', error instanceof Error ? error.message : error);
      Alert.alert(
        'Push Notification Test',
        'Notifee is niet geïnstalleerd. FCM token check:\n\n' +
        'Check de console logs voor het FCM token.'
      );
    }
  };

  const showFCMToken = async () => {
    if (!ServiceContainer.isPushAvailable) {
      Alert.alert(
        'Push Niet Beschikbaar',
        'Push notifications vereisen een betaald Apple Developer account ($99/jaar).\n\n' +
        'De app werkt prima zonder push - je krijgt alleen geen meldingen als de app op de achtergrond draait.'
      );
      return;
    }

    try {
      const token = await ServiceContainer.notifications?.getToken();
      if (!token) {
        Alert.alert('Error', 'FCM token niet beschikbaar');
        return;
      }
      // SECURITY: Don't log full token even in dev mode - use clipboard instead
      const Clipboard = await import('@react-native-clipboard/clipboard');
      Alert.alert(
        'FCM Device Token',
        `Token (eerste 50 chars):\n\n${token.substring(0, 50)}...\n\nGebruik "Copy" om volledige token naar clipboard te kopiëren.`,
        [
          { text: 'OK' },
          {
            text: 'Copy',
            onPress: () => {
              Clipboard.default.setString(token);
              Alert.alert('Gekopieerd', 'FCM token is naar clipboard gekopieerd');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', `Kon FCM token niet ophalen: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
    }
  };

  const seedTestContacts = async () => {
    try {
      const db = ServiceContainer.database;
      let created = 0;
      for (const contact of TEST_CONTACTS) {
        await db.saveContact(contact);
        created++;
      }
      Alert.alert(
        'Test Contacten',
        `${created} adresboek-contacten aangemaakt:\n\n` +
        TEST_CONTACTS.map(c => `• ${c.firstName} ${c.lastName} (${c.address?.city})`).join('\n')
      );
    } catch (error) {
      Alert.alert('Error', `Kon contacten niet aanmaken: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
    }
  };

  const testPushPermission = async () => {
    try {
      const messaging = await import('@react-native-firebase/messaging');
      const authStatus = await messaging.default().requestPermission();
      const enabled =
        authStatus === messaging.default.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.default.AuthorizationStatus.PROVISIONAL;

      Alert.alert(
        'Push Permission Status',
        `Status: ${authStatus}\nEnabled: ${enabled ? 'Ja' : 'Nee'}\n\n` +
        '0 = NOT_DETERMINED\n1 = DENIED\n2 = AUTHORIZED\n3 = PROVISIONAL'
      );
    } catch (error) {
      Alert.alert('Error', `Permission check failed: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
    }
  };

  return (
    <>
      <DevModeButton onPress={() => setVisible(true)} />

      <PanelAwareModal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Developer Tools</Text>
            <HapticTouchable hapticDisabled
              onPress={() => setVisible(false)}
              style={styles.closeButton}
              accessibilityRole={'button' as AccessibilityRole}
              accessibilityLabel="Close developer tools"
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </HapticTouchable>
          </View>

          <ScrollView style={styles.content}>
            {/* Network Simulation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Network Simulation</Text>

              <HapticTouchable hapticDisabled
                style={[styles.option, offline && styles.optionActive]}
                onPress={toggleOffline}
              >
                <Text style={styles.optionText}>
                  {offline ? 'Disable' : 'Enable'} Offline Mode
                </Text>
                {offline && <Text style={styles.optionStatus}>ACTIVE</Text>}
              </HapticTouchable>

              <HapticTouchable hapticDisabled
                style={[styles.option, slowNetwork && styles.optionActive]}
                onPress={toggleSlowNetwork}
              >
                <Text style={styles.optionText}>
                  {slowNetwork ? 'Disable' : 'Enable'} Slow Network
                </Text>
                {slowNetwork && <Text style={styles.optionStatus}>ACTIVE</Text>}
              </HapticTouchable>
            </View>

            {/* Push Notification Testing */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Push Notifications</Text>
              <Text style={styles.sectionDescription}>
                {ServiceContainer.isPushAvailable
                  ? 'Test push notification setup'
                  : '⚠️ Niet beschikbaar (vereist betaald Apple Developer account)'}
              </Text>

              <HapticTouchable hapticDisabled
                style={styles.option}
                onPress={showFCMToken}
              >
                <Text style={styles.optionText}>Show FCM Token</Text>
              </HapticTouchable>

              <HapticTouchable hapticDisabled
                style={styles.option}
                onPress={testPushPermission}
              >
                <Text style={styles.optionText}>Check Permission Status</Text>
              </HapticTouchable>

              <HapticTouchable hapticDisabled
                style={[styles.option, styles.optionSuccess]}
                onPress={testLocalNotification}
              >
                <Text style={styles.optionText}>Send Test Notification</Text>
              </HapticTouchable>
            </View>

            {/* Test Data */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Test Data</Text>

              <HapticTouchable hapticDisabled
                style={[styles.option, styles.optionSuccess]}
                onPress={seedTestContacts}
              >
                <Text style={styles.optionText}>Seed 4 Test Contacten (NL)</Text>
              </HapticTouchable>
            </View>

            {/* Service Status Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Service Status</Text>
              <Text style={styles.infoText}>
                ServiceContainer: {ServiceContainer.isInitialized ? 'Initialized' : 'Not initialized'}
              </Text>
              <Text style={styles.infoText}>
                Push: {ServiceContainer.isPushAvailable ? 'Available' : 'Not available'}
              </Text>
            </View>
          </ScrollView>
        </View>
      </PanelAwareModal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  floatingButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#FF6B00',
  },
  title: {
    ...typography.h2,
    color: '#FFF',
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeButtonText: {
    ...typography.body,
    color: '#FFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    marginVertical: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionActive: {
    borderColor: '#FF6B00',
    backgroundColor: '#FFF5EB',
  },
  optionWarning: {
    borderColor: colors.error,
  },
  optionSuccess: {
    borderColor: colors.success,
    backgroundColor: '#E8F5E9',
  },
  optionText: {
    ...typography.body,
    flex: 1,
  },
  optionStatus: {
    ...typography.caption,
    color: '#FF6B00',
    fontWeight: '700',
  },
  infoText: {
    ...typography.body,
    marginVertical: spacing.xs,
  },
  contactInfo: {
    ...typography.caption,
    fontFamily: 'Courier',
    marginVertical: 2,
    color: colors.textSecondary,
  },
});
