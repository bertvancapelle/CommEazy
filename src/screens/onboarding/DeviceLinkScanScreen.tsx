/**
 * DeviceLinkScanScreen
 *
 * Tablet scans QR code from primary device to link accounts.
 * Uses camera to scan, then establishes encrypted connection
 * to receive encryption keys.
 *
 * Senior-inclusive: Large viewfinder, clear instructions, audio feedback.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing } from '@/theme';
import { Button } from '@/components';
import type { OnboardingStackParams } from '@/navigation';
import {
  deviceLinkService,
  type DeviceLinkQRData,
} from '@/services/deviceLink';

type Props = NativeStackScreenProps<OnboardingStackParams, 'DeviceLinkScan'>;

type ScanState = 'scanning' | 'connecting' | 'receiving' | 'complete' | 'error';

export function DeviceLinkScanScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [error, setError] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<DeviceLinkQRData | null>(null);

  useEffect(() => {
    deviceLinkService.initialize();
  }, []);

  // Simulated QR scan handler - in production, use react-native-camera or expo-camera
  const handleQRScanned = async (data: string) => {
    try {
      const qrData = deviceLinkService.parseScannedQR(data);

      if (!qrData) {
        setError(t('deviceLink.invalidQR'));
        setScanState('error');
        return;
      }

      setScannedData(qrData);
      setScanState('connecting');

      // Generate ephemeral keys for this tablet
      const tabletKeys = await deviceLinkService.generateTabletEphemeralKeys();

      // In production: establish WebSocket/P2P connection with primary device
      // For now, simulate the connection
      setScanState('receiving');

      // The actual key transfer would happen here via secure channel
      // After receiving and importing keys, navigate to completion

      // Simulated success after 2 seconds
      setTimeout(() => {
        setScanState('complete');
        // Navigate to name confirmation or completion
        // The profile data comes from the bundle
        navigation.navigate('Completion', { name: qrData.deviceName });
      }, 2000);

    } catch (err) {
      console.error('QR scan error:', err);
      setError(t('deviceLink.connectionFailed'));
      setScanState('error');
    }
  };

  const handleRetry = () => {
    setError(null);
    setScanState('scanning');
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  // For demo purposes - simulate a scan
  const handleSimulateScan = () => {
    const mockQR = JSON.stringify({
      version: 1,
      sessionId: 'abc123',
      publicKey: 'mockPublicKey==',
      deviceName: 'Test User',
      timestamp: Date.now(),
    });
    handleQRScanned(mockQR);
  };

  const renderContent = () => {
    switch (scanState) {
      case 'scanning':
        return (
          <>
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.cameraText}>{t('deviceLink.pointCamera')}</Text>
              {/* In production: render actual camera view here */}
              <View style={styles.viewfinder}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
            </View>
            <Text style={styles.instructions}>{t('deviceLink.scanInstructions')}</Text>

            {/* Demo button - remove in production */}
            {__DEV__ && (
              <Button
                title="[DEV] Simulate Scan"
                onPress={handleSimulateScan}
                variant="secondary"
                style={{ marginTop: spacing.lg }}
              />
            )}
          </>
        );

      case 'connecting':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.statusText}>{t('deviceLink.connecting')}</Text>
            <Text style={styles.statusSubtext}>
              {t('deviceLink.connectingTo', { device: scannedData?.deviceName })}
            </Text>
          </View>
        );

      case 'receiving':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.statusText}>{t('deviceLink.receiving')}</Text>
            <Text style={styles.statusSubtext}>{t('deviceLink.receivingKeys')}</Text>
          </View>
        );

      case 'complete':
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.statusText}>{t('deviceLink.success')}</Text>
          </View>
        );

      case 'error':
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.errorIcon}>!</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              title={t('errors.tryAgain')}
              onPress={handleRetry}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('deviceLink.scanTitle')}</Text>
        {renderContent()}
      </View>

      {scanState === 'scanning' && (
        <View style={styles.footer}>
          <Button
            title={t('common.cancel')}
            onPress={handleCancel}
            variant="secondary"
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cameraPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 300,
    backgroundColor: colors.surfaceDark,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cameraText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  viewfinder: {
    width: 200,
    height: 200,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  instructions: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  statusText: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  statusSubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  successIcon: {
    fontSize: 64,
    color: colors.success,
  },
  errorIcon: {
    fontSize: 64,
    color: colors.error,
    fontWeight: 'bold',
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
