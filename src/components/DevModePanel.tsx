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
  TouchableOpacity,
  Modal,
  ScrollView,
  AccessibilityRole,
  Alert,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';
import {
  simulateQRScan,
  isDevUIEnabled,
  setSimulateOffline,
  setSimulateSlowNetwork,
  isSimulatingOffline,
  isSimulatingSlowNetwork,
  DevMockData,
} from '@/services/mock';
import { ServiceContainer } from '@/services/container';

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
    <TouchableOpacity
      style={styles.floatingButton}
      onPress={onPress}
      accessibilityRole={'button' as AccessibilityRole}
      accessibilityLabel="Open developer tools"
    >
      <Text style={styles.floatingButtonText}>DEV</Text>
    </TouchableOpacity>
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

  const handleSimulateQR = (
    scenario: 'success' | 'unverified' | 'expired' | 'invalid' | 'device_link'
  ) => {
    const { qrData, verification } = simulateQRScan(scenario);
    console.log('[DevMode] Simulated QR scan:', scenario, verification);

    if (onQRCodeScanned) {
      onQRCodeScanned(qrData);
    }
    setVisible(false);
  };

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
    } catch (error: any) {
      // Notifee might not be installed, try basic alert
      console.log('[DevMode] Notifee not available, using alert:', error.message);
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
    } catch (error: any) {
      Alert.alert('Error', `Kon FCM token niet ophalen: ${error.message}`);
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
    } catch (error: any) {
      Alert.alert('Error', `Permission check failed: ${error.message}`);
    }
  };

  return (
    <>
      <DevModeButton onPress={() => setVisible(true)} />

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Developer Tools</Text>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={styles.closeButton}
              accessibilityRole={'button' as AccessibilityRole}
              accessibilityLabel="Close developer tools"
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Network Simulation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Network Simulation</Text>

              <TouchableOpacity
                style={[styles.option, offline && styles.optionActive]}
                onPress={toggleOffline}
              >
                <Text style={styles.optionText}>
                  {offline ? 'Disable' : 'Enable'} Offline Mode
                </Text>
                {offline && <Text style={styles.optionStatus}>ACTIVE</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.option, slowNetwork && styles.optionActive]}
                onPress={toggleSlowNetwork}
              >
                <Text style={styles.optionText}>
                  {slowNetwork ? 'Disable' : 'Enable'} Slow Network
                </Text>
                {slowNetwork && <Text style={styles.optionStatus}>ACTIVE</Text>}
              </TouchableOpacity>
            </View>

            {/* Push Notification Testing */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Push Notifications</Text>
              <Text style={styles.sectionDescription}>
                {ServiceContainer.isPushAvailable
                  ? 'Test push notification setup'
                  : '⚠️ Niet beschikbaar (vereist betaald Apple Developer account)'}
              </Text>

              <TouchableOpacity
                style={styles.option}
                onPress={showFCMToken}
              >
                <Text style={styles.optionText}>Show FCM Token</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.option}
                onPress={testPushPermission}
              >
                <Text style={styles.optionText}>Check Permission Status</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.option, styles.optionSuccess]}
                onPress={testLocalNotification}
              >
                <Text style={styles.optionText}>Send Test Notification</Text>
              </TouchableOpacity>
            </View>

            {/* QR Code Simulation */}
            {showQROptions && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Simulate QR Scan</Text>
                <Text style={styles.sectionDescription}>
                  Test QR scanning without a camera
                </Text>

                <TouchableOpacity
                  style={styles.option}
                  onPress={() => handleSimulateQR('success')}
                >
                  <Text style={styles.optionText}>Scan: Verified Contact (Oma)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.option}
                  onPress={() => handleSimulateQR('unverified')}
                >
                  <Text style={styles.optionText}>Scan: Unverified Contact (Tante Maria)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.option}
                  onPress={() => handleSimulateQR('device_link')}
                >
                  <Text style={styles.optionText}>Scan: Device Link QR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.option, styles.optionWarning]}
                  onPress={() => handleSimulateQR('expired')}
                >
                  <Text style={styles.optionText}>Scan: Expired QR (Error)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.option, styles.optionWarning]}
                  onPress={() => handleSimulateQR('invalid')}
                >
                  <Text style={styles.optionText}>Scan: Invalid QR (Error)</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Mock Data Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mock Data</Text>
              <Text style={styles.infoText}>
                Contacts: {DevMockData?.contacts.length ?? 0}
              </Text>
              <Text style={styles.infoText}>
                Chats: {Object.keys(DevMockData?.messages ?? {}).length}
              </Text>
              {DevMockData?.contacts.map(contact => (
                <Text key={contact.jid} style={styles.contactInfo}>
                  {contact.verified ? 'V' : '-'} {contact.name} ({contact.phoneNumber})
                </Text>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
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
