/**
 * NavigationTutorialScreen — Hold-to-Navigate Introduction
 *
 * Teaches new users how to use the Hold-to-Navigate system.
 * Part of the onboarding flow (after DemographicsScreen, before CompletionScreen).
 *
 * Steps:
 * 1. Introduction - explain the concept
 * 2. Practice - user tries long press
 * 3. Menu button - tap to open navigation
 * 4. Customize - optional: reposition the button
 *
 * @see .claude/skills/ui-designer/SKILL.md#hold-to-navigate
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  colors,
  typography,
  spacing,
  borderRadius,
} from '@/theme';
import { Button } from '@/components';
import { HoldIndicator } from '@/components/HoldIndicator';
import { DraggableMenuButton } from '@/components/DraggableMenuButton';
import { useHoldToNavigate } from '@/hooks/useHoldToNavigate';

type TutorialStep = 'intro' | 'practice' | 'menu' | 'customize' | 'done';

interface NavigationTutorialScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export function NavigationTutorialScreen({
  navigation,
}: NavigationTutorialScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    settings,
    reducedMotion,
    showMenuButton,
    hideMenuButton,
    isMenuButtonVisible,
    completeTutorial,
    triggerHaptic,
  } = useHoldToNavigate();

  // State
  const [currentStep, setCurrentStep] = useState<TutorialStep>('intro');
  const [isPressing, setIsPressing] = useState(false);
  const [pressPosition, setPressPosition] = useState({ x: 0, y: 0 });
  const [practiceCompleted, setPracticeCompleted] = useState(false);

  // Animation
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Long press delay for tutorial (use user's setting)
  const longPressDelay = settings.longPressDelay;

  // Handle press start
  const handlePressIn = useCallback(
    (event: any) => {
      if (currentStep !== 'practice') return;

      const { locationX, locationY, pageX, pageY } = event.nativeEvent;
      setPressPosition({ x: pageX || locationX, y: pageY || locationY });
      setIsPressing(true);

      // Start long press timer
      pressTimer.current = setTimeout(() => {
        // Long press completed!
        triggerHaptic();
        setIsPressing(false);
        setPracticeCompleted(true);
        showMenuButton();

        // Move to next step after short delay
        setTimeout(() => {
          setCurrentStep('menu');
        }, 500);
      }, longPressDelay);
    },
    [currentStep, longPressDelay, showMenuButton, triggerHaptic],
  );

  // Handle press end
  const handlePressOut = useCallback(() => {
    setIsPressing(false);
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  // Handle menu button press in tutorial
  const handleMenuButtonPress = useCallback(() => {
    if (currentStep === 'menu') {
      hideMenuButton();

      // Move to customize step
      setTimeout(() => {
        setCurrentStep('customize');
      }, 300);
    }
  }, [currentStep, hideMenuButton]);

  // Go to next step
  const goToNextStep = useCallback(() => {
    fadeAnimation.setValue(1);

    switch (currentStep) {
      case 'intro':
        setCurrentStep('practice');
        break;
      case 'practice':
        // Wait for user to complete long press
        break;
      case 'menu':
        // Wait for user to tap menu button
        break;
      case 'customize':
        setCurrentStep('done');
        break;
      case 'done':
        completeTutorial();
        navigation.navigate('Completion');
        break;
    }
  }, [currentStep, completeTutorial, navigation, fadeAnimation]);

  // Skip tutorial
  const skipTutorial = useCallback(() => {
    completeTutorial();
    navigation.navigate('Completion');
  }, [completeTutorial, navigation]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
      }
    };
  }, []);

  // Announce step changes for screen readers
  useEffect(() => {
    if (Platform.OS === 'ios') {
      const announcements: Record<TutorialStep, string> = {
        intro: t('navigation_tutorial.intro_announce'),
        practice: t('navigation_tutorial.practice_announce'),
        menu: t('navigation_tutorial.menu_announce'),
        customize: t('navigation_tutorial.customize_announce'),
        done: t('navigation_tutorial.done_announce'),
      };
      AccessibilityInfo.announceForAccessibility(announcements[currentStep]);
    }
  }, [currentStep, t]);

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'intro':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>
              {t('navigation_tutorial.intro_title')}
            </Text>
            <Text style={styles.stepDescription}>
              {t('navigation_tutorial.intro_description')}
            </Text>
            <View style={styles.illustration}>
              {/* Simple illustration: finger + hold indicator */}
              <View style={styles.fingerIcon} />
              <View style={styles.illustrationRing} />
            </View>
            <Button
              title={t('navigation_tutorial.lets_try')}
              onPress={goToNextStep}
              variant="primary"
              style={styles.nextButton}
            />
          </View>
        );

      case 'practice':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>
              {t('navigation_tutorial.practice_title')}
            </Text>
            <Text style={styles.stepDescription}>
              {t('navigation_tutorial.practice_description')}
            </Text>

            {/* Practice area */}
            <TouchableWithoutFeedback
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <View style={styles.practiceArea}>
                <Text style={styles.practiceAreaText}>
                  {practiceCompleted
                    ? t('navigation_tutorial.practice_success')
                    : t('navigation_tutorial.practice_instruction')}
                </Text>
              </View>
            </TouchableWithoutFeedback>

            {/* Hold indicator */}
            {isPressing && (
              <HoldIndicator
                isActive={isPressing}
                duration={longPressDelay}
                x={pressPosition.x}
                y={pressPosition.y}
                reducedMotion={reducedMotion}
              />
            )}

            <Text style={styles.hint}>
              {t('navigation_tutorial.hold_time', {
                seconds: (longPressDelay / 1000).toFixed(1),
              })}
            </Text>
          </View>
        );

      case 'menu':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>
              {t('navigation_tutorial.menu_title')}
            </Text>
            <Text style={styles.stepDescription}>
              {t('navigation_tutorial.menu_description')}
            </Text>

            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>↓</Text>
              <Text style={styles.arrowLabel}>
                {t('navigation_tutorial.tap_the_button')}
              </Text>
            </View>
          </View>
        );

      case 'customize':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>
              {t('navigation_tutorial.customize_title')}
            </Text>
            <Text style={styles.stepDescription}>
              {t('navigation_tutorial.customize_description')}
            </Text>
            <Text style={styles.hint}>
              {t('navigation_tutorial.customize_hint')}
            </Text>
            <Button
              title={t('navigation_tutorial.continue')}
              onPress={goToNextStep}
              variant="primary"
              style={styles.nextButton}
            />
          </View>
        );

      case 'done':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>
              {t('navigation_tutorial.done_title')}
            </Text>
            <Text style={styles.stepDescription}>
              {t('navigation_tutorial.done_description')}
            </Text>
            <View style={styles.checkmark}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
            <Button
              title={t('navigation_tutorial.finish')}
              onPress={goToNextStep}
              variant="primary"
              style={styles.nextButton}
            />
          </View>
        );
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        {['intro', 'practice', 'menu', 'customize', 'done'].map((step, index) => (
          <View
            key={step}
            style={[
              styles.progressDot,
              currentStep === step && styles.progressDotActive,
              ['intro', 'practice', 'menu', 'customize', 'done'].indexOf(currentStep) > index &&
                styles.progressDotCompleted,
            ]}
          />
        ))}
      </View>

      {/* Step content */}
      <Animated.View style={[styles.content, { opacity: fadeAnimation }]}>
        {renderStepContent()}
      </Animated.View>

      {/* Skip button */}
      <TouchableWithoutFeedback onPress={skipTutorial}>
        <View style={styles.skipButton}>
          <Text style={styles.skipButtonText}>
            {t('navigation_tutorial.skip')}
          </Text>
        </View>
      </TouchableWithoutFeedback>

      {/* Menu button (shown in menu step) */}
      {currentStep === 'menu' && (
        <DraggableMenuButton
          visible={isMenuButtonVisible}
          onPress={handleMenuButtonPress}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.divider,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  progressDotCompleted: {
    backgroundColor: colors.success,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  stepContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  stepDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  illustration: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  fingerIcon: {
    width: 30,
    height: 50,
    backgroundColor: colors.textSecondary,
    borderRadius: 15,
    transform: [{ rotate: '-15deg' }],
  },
  illustrationRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  practiceArea: {
    width: '100%',
    height: 200,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  practiceAreaText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  hint: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  arrowContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  arrow: {
    fontSize: 48,
    color: colors.primary,
  },
  arrowLabel: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  checkmark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  checkmarkText: {
    fontSize: 48,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  nextButton: {
    marginTop: spacing.lg,
    minWidth: 200,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipButtonText: {
    ...typography.body,
    color: colors.textTertiary,
    textDecorationLine: 'underline',
  },
});
