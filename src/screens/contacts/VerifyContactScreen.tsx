/**
 * VerifyContactScreen — QR code verification for contacts
 *
 * Senior-inclusive design:
 * - Large QR code (200pt+)
 * - Clear instructions
 * - Tab-based navigation (Show/Scan)
 * - Haptic feedback on success
 * - VoiceOver support
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/security-expert/SKILL.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { Camera } from 'react-native-camera-kit';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import type { ContactStackParams } from '@/navigation';

type NavigationProp = NativeStackNavigationProp<ContactStackParams, 'VerifyContact'>;
type VerifyContactRouteProp = RouteProp<ContactStackParams, 'VerifyContact'>;

type TabMode = 'show' | 'scan';

export function VerifyContactScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<VerifyContactRouteProp>();
  const { jid, name } = route.params;
  const themeColors = useColors();

  const [activeTab, setActiveTab] = useState<TabMode>('show');
  const [qrData, setQrData] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [cameraPermission, setCameraPermission] = useState<boolean>(false);
  const [scanning, setScanning] = useState(false);
  const [verified, setVerified] = useState(false);

  // Generate QR data on mount
  useEffect(() => {
    const generateQR = async () => {
      try {
        if (__DEV__) {
          // Dynamic import to avoid module loading at bundle time
          const { generateMockMyQRData } = await import('@/services/mock');
          const data = generateMockMyQRData();
          setQrData(data);
        } else {
          // Production: use real encryption service
          // const encryption = ServiceContainer.encryption;
          // const data = await encryption.generateQRData();
          // setQrData(data);
          setQrData('production_qr_not_implemented');
        }
      } catch (error) {
        console.error('Failed to generate QR data:', error);
        Alert.alert(t('errors.genericError'));
      } finally {
        setLoading(false);
      }
    };

    void generateQR();
  }, [t]);

  // Check camera permission when switching to scan tab
  const checkCameraPermission = useCallback(async (): Promise<boolean> => {
    const permission = Platform.OS === 'ios'
      ? PERMISSIONS.IOS.CAMERA
      : PERMISSIONS.ANDROID.CAMERA;

    const result = await check(permission);

    if (result === RESULTS.GRANTED) {
      setCameraPermission(true);
      return true;
    }

    if (result === RESULTS.DENIED) {
      const requestResult = await request(permission);
      if (requestResult === RESULTS.GRANTED) {
        setCameraPermission(true);
        return true;
      }
    }

    // Permission denied or blocked
    setCameraPermission(false);
    Alert.alert(
      t('errors.E401'),
      t('contacts.cameraPermissionDenied'),
      [{ text: t('common.ok'), style: 'default' }]
    );
    return false;
  }, [t]);

  const handleTabChange = useCallback(async (tab: TabMode) => {
    if (tab === 'scan') {
      const hasPermission = await checkCameraPermission();
      if (!hasPermission) return;
    }
    setActiveTab(tab);
    setScanning(tab === 'scan');
  }, [checkCameraPermission]);

  const handleQRCodeRead = useCallback(async (event: { nativeEvent: { codeStringValue: string } }) => {
    if (verified || !scanning) return;

    const scannedData = event.nativeEvent.codeStringValue;
    if (!scannedData) return;

    setScanning(false);

    try {
      let contact;
      let isValid = false;

      if (__DEV__) {
        // Dynamic import to avoid module loading at bundle time
        const { getMockContactByJid, verifyMockQRData } = await import('@/services/mock');
        contact = getMockContactByJid(jid);
        if (contact) {
          const result = verifyMockQRData(scannedData);
          isValid = result.success;
        }
      } else {
        // Production: use real services
        // const db = ServiceContainer.database;
        // contact = await db.getContact(jid);
        // if (contact) {
        //   const encryption = ServiceContainer.encryption;
        //   isValid = encryption.verifyQRData(scannedData, contact.publicKey);
        // }
      }

      if (!contact) {
        Alert.alert(t('errors.genericError'));
        setScanning(true);
        return;
      }

      if (isValid) {
        // Haptic feedback for success
        ReactNativeHapticFeedback.trigger('notificationSuccess', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });

        if (__DEV__) {
          // In dev mode, just log (mock data is in memory)
          console.log('[DEV] Would mark contact as verified:', jid);
        } else {
          // Production: Mark contact as verified
          // await db.saveContact({ ...contact, verified: true });
        }

        setVerified(true);

        Alert.alert(
          t('contacts.verificationSuccess'),
          t('contacts.verificationSuccessMessage', { name }),
          [
            {
              text: t('common.ok'),
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        // Haptic feedback for failure
        ReactNativeHapticFeedback.trigger('notificationError', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });

        Alert.alert(
          t('contacts.verificationFailed'),
          t('contacts.verificationFailedMessage'),
          [
            {
              text: t('common.tryAgain'),
              onPress: () => setScanning(true),
            },
            {
              text: t('common.cancel'),
              style: 'cancel',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Failed to verify QR code:', error);
      Alert.alert(t('errors.genericError'));
      setScanning(true);
    }
  }, [verified, scanning, jid, name, navigation, t]);

  const renderShowTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentContainer}
    >
      <Text style={[styles.instructions, { color: themeColors.textPrimary }]}>
        {t('contacts.showQRInstructions')}
      </Text>

      {loading ? (
        <View style={[styles.qrPlaceholder, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>{t('common.loading')}</Text>
        </View>
      ) : (
        <View
          style={[styles.qrContainer, { backgroundColor: themeColors.surface }]}
          accessibilityLabel={t('accessibility.yourQRCode')}
        >
          <QRCode
            value={qrData}
            size={220}
            backgroundColor={themeColors.surface}
            color={themeColors.textPrimary}
          />
        </View>
      )}

      <Text style={[styles.helpText, { color: themeColors.textSecondary }]}>
        {t('contacts.verifyInstructions')}
      </Text>
    </ScrollView>
  );

  const renderScanTab = () => (
    <View style={styles.scanContainer}>
      {cameraPermission && scanning ? (
        <>
          <Camera
            style={styles.camera}
            scanBarcode
            onReadCode={(event) => void handleQRCodeRead(event)}
          />
          <View style={styles.scanOverlay}>
            <Text style={[styles.scanInstructions, { color: themeColors.textOnPrimary }]}>
              {t('contacts.scanQRInstructions', { name })}
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.noCameraContainer}>
          <Text style={[styles.noCameraText, { color: themeColors.textSecondary }]}>
            {t('contacts.cameraNotAvailable')}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: themeColors.primary }]}
            onPress={() => void handleTabChange('scan')}
            accessibilityRole="button"
            accessibilityLabel={t('common.tryAgain')}
          >
            <Text style={[styles.retryButtonText, { color: themeColors.textOnPrimary }]}>{t('common.tryAgain')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Success state
  if (verified) {
    return (
      <View style={[styles.successContainer, { backgroundColor: themeColors.background }]}>
        <View style={styles.successIcon}>
          <Text style={[styles.successIconText, { color: themeColors.textOnPrimary }]}>✓</Text>
        </View>
        <Text style={[styles.successTitle, { color: themeColors.textPrimary }]}>{t('contacts.verified')}</Text>
        <Text style={[styles.successMessage, { color: themeColors.textSecondary }]}>
          {t('contacts.verificationSuccessMessage', { name })}
        </Text>
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: themeColors.primary }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.done')}
        >
          <Text style={[styles.doneButtonText, { color: themeColors.textOnPrimary }]}>{t('common.done')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.divider }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'show' && [styles.tabButtonActive, { borderBottomColor: themeColors.primary }],
          ]}
          onPress={() => void handleTabChange('show')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'show' }}
          accessibilityLabel={t('contacts.showMyQR')}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: themeColors.textSecondary },
              activeTab === 'show' && { color: themeColors.primary },
            ]}
          >
            {t('contacts.showMyQR')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'scan' && [styles.tabButtonActive, { borderBottomColor: themeColors.primary }],
          ]}
          onPress={() => void handleTabChange('scan')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'scan' }}
          accessibilityLabel={t('contacts.scanTheirQR')}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: themeColors.textSecondary },
              activeTab === 'scan' && { color: themeColors.primary },
            ]}
          >
            {t('contacts.scanTheirQR')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab content */}
      {activeTab === 'show' ? renderShowTab() : renderScanTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  tabButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: colors.primary,
  },
  tabContent: {
    flex: 1,
  },
  tabContentContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  instructions: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  qrContainer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  qrPlaceholder: {
    width: 220 + spacing.lg * 2,
    height: 220 + spacing.lg * 2,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  helpText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  scanContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: spacing.lg,
  },
  scanInstructions: {
    ...typography.body,
    color: colors.textOnPrimary,
    textAlign: 'center',
  },
  noCameraContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  noCameraText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  successContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  successIconText: {
    fontSize: 60,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  successTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  successMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  doneButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
});
