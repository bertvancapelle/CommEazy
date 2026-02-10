/**
 * DeviceLinkShowQRScreen
 *
 * Primary device shows QR code for tablet to scan.
 * Accessible from Settings > Link New Device.
 *
 * Senior-inclusive: Large QR, clear timer, simple instructions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing } from '@/theme';
import { Button } from '@/components';
import type { SettingsStackParams } from '@/navigation';
import { deviceLinkService } from '@/services/deviceLink';

type Props = NativeStackScreenProps<SettingsStackParams, 'DeviceLinkShowQR'>;

const SESSION_DURATION_SECONDS = 300; // 5 minutes

export function DeviceLinkShowQRScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [qrData, setQrData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(SESSION_DURATION_SECONDS);
  const [linkStatus, setLinkStatus] = useState<'waiting' | 'connected' | 'complete'>('waiting');

  const generateQR = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await deviceLinkService.initialize();

      // Get device name from user profile or use default
      const deviceName = 'iPhone'; // In production: get from UserProfile
      const qr = await deviceLinkService.generateLinkQR(deviceName);

      setQrData(qr);
      setTimeRemaining(SESSION_DURATION_SECONDS);
    } catch (err) {
      console.error('Failed to generate QR:', err);
      setError(t('deviceLink.qrGenerationFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    generateQR();

    return () => {
      deviceLinkService.cancelSession();
    };
  }, [generateQR]);

  // Countdown timer
  useEffect(() => {
    if (!qrData || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          deviceLinkService.cancelSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [qrData, timeRemaining]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRefresh = () => {
    deviceLinkService.cancelSession();
    generateQR();
  };

  const handleCancel = () => {
    deviceLinkService.cancelSession();
    navigation.goBack();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('deviceLink.generatingQR')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title={t('errors.tryAgain')}
            onPress={generateQR}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (timeRemaining <= 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.expiredContainer}>
          <Text style={styles.expiredIcon}>⏱</Text>
          <Text style={styles.expiredTitle}>{t('deviceLink.qrExpired')}</Text>
          <Text style={styles.expiredText}>{t('deviceLink.qrExpiredMessage')}</Text>
          <Button
            title={t('deviceLink.generateNew')}
            onPress={handleRefresh}
            style={{ marginTop: spacing.xl }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('deviceLink.showQRTitle')}</Text>
        <Text style={styles.subtitle}>{t('deviceLink.showQRSubtitle')}</Text>

        {/* QR Code Display */}
        <View style={styles.qrContainer}>
          {/* In production: use react-native-qrcode-svg or similar */}
          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrPlaceholderText}>QR</Text>
            <Text style={styles.qrPlaceholderSubtext}>
              {t('deviceLink.qrPlaceholder')}
            </Text>
          </View>
        </View>

        {/* Timer */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>{t('deviceLink.validFor')}</Text>
          <Text style={[
            styles.timerValue,
            timeRemaining < 60 && styles.timerWarning,
          ]}>
            {formatTime(timeRemaining)}
          </Text>
        </View>

        {/* Status */}
        {linkStatus === 'connected' && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{t('deviceLink.deviceConnected')}</Text>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionStep}>
            1. {t('deviceLink.step1')}
          </Text>
          <Text style={styles.instructionStep}>
            2. {t('deviceLink.step2')}
          </Text>
          <Text style={styles.instructionStep}>
            3. {t('deviceLink.step3')}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title={t('common.cancel')}
          onPress={handleCancel}
          variant="secondary"
        />
      </View>
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
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  qrContainer: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: spacing.lg,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: colors.surface,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrPlaceholderText: {
    ...typography.h1,
    color: colors.textTertiary,
  },
  qrPlaceholderSubtext: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  timerLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  timerValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  timerWarning: {
    color: colors.error,
  },
  statusBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  statusText: {
    ...typography.bodyBold,
    color: colors.success,
  },
  instructions: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.md,
  },
  instructionStep: {
    ...typography.body,
    color: colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
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
  expiredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  expiredIcon: {
    fontSize: 64,
  },
  expiredTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  expiredText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
