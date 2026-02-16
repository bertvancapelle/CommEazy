/**
 * VoiceFocusable — Wrapper component for voice-navigable list items
 *
 * Wraps list items to enable voice focus styling and accessibility.
 * When the item is focused via Voice Session Mode:
 * - Shows 4px accent color border
 * - Shows 10% accent color background tint
 * - Small scale animation (respects reduced motion)
 * - Syncs with VoiceOver/TalkBack accessibilityState.selected
 *
 * @example
 * <VoiceFocusable
 *   id={contact.jid}
 *   label={contact.name}
 *   index={index}
 *   onSelect={() => handleContactPress(contact)}
 * >
 *   <ContactListItem contact={contact} />
 * </VoiceFocusable>
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Animated,
  AccessibilityInfo,
  StyleSheet,
  Easing,
  type ViewStyle,
  type LayoutChangeEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useVoiceFocusContext, type VoiceFocusableItem } from '@/contexts/VoiceFocusContext';
import { borderRadius, animation, colors } from '@/theme';

interface VoiceFocusableProps {
  /** Unique identifier for this item */
  id: string;
  /** Label for voice matching — must be human-readable (e.g., "Oma", not "contact-123") */
  label: string;
  /** Index in the list (for navigation order) */
  index: number;
  /** Callback when this item is selected via voice */
  onSelect: () => void;
  /** Optional: callback when layout changes (for scroll positioning) */
  onLayout?: (id: string, y: number) => void;
  /** Children to render inside the focusable wrapper */
  children: React.ReactNode;
  /** Optional additional styles for the container */
  style?: ViewStyle;
  /** Whether this item is disabled */
  disabled?: boolean;
}

/**
 * Hook for reduced motion preference
 */
function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = React.useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion
    );
    return () => subscription.remove();
  }, []);

  return reducedMotion;
}

/**
 * VoiceFocusable component
 */
export function VoiceFocusable({
  id,
  label,
  index,
  onSelect,
  onLayout,
  children,
  style,
  disabled = false,
}: VoiceFocusableProps): React.ReactElement {
  const { t } = useTranslation();
  const { isFocused, getFocusStyle, isVoiceSessionActive } = useVoiceFocusContext();
  const reducedMotion = useReducedMotion();

  // Animation values
  // IMPORTANT: Keep native-driven and JS-driven animations on SEPARATE Animated.Values
  // Using the same value for both causes "node moved to native" error
  const scaleAnim = useRef(new Animated.Value(1)).current; // Native driver (transform)
  const pulseAnim = useRef(new Animated.Value(0)).current; // JS driver only (border color) - 0 = accent, 1 = white
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Check if this item is focused
  const focused = isFocused(id);

  // Get focus styles from context (uses accent color)
  const focusStyle = getFocusStyle();

  // Animate scale when focus changes
  useEffect(() => {
    if (reducedMotion) return;

    Animated.timing(scaleAnim, {
      toValue: focused ? 1.02 : 1,
      duration: animation.fast,
      useNativeDriver: true,
    }).start();
  }, [focused, scaleAnim, reducedMotion]);

  // Pulsing border animation when focused (accent ↔ white)
  useEffect(() => {
    if (focused && isVoiceSessionActive && !reducedMotion) {
      // Start pulsing animation: accent color → white → accent color
      pulseAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1, // white
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false, // border color can't use native driver
          }),
          Animated.timing(pulseAnim, {
            toValue: 0, // accent color
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );
      pulseAnimRef.current.start();
    } else {
      // Stop pulsing and reset
      if (pulseAnimRef.current) {
        pulseAnimRef.current.stop();
        pulseAnimRef.current = null;
      }
      pulseAnim.setValue(0);
    }

    return () => {
      if (pulseAnimRef.current) {
        pulseAnimRef.current.stop();
      }
    };
  }, [focused, isVoiceSessionActive, reducedMotion, pulseAnim]);

  // Interpolate border color from accent to white
  // Use a safe fallback color if borderColor is undefined
  // Note: Use '#FFFFFF' directly as colors.white doesn't exist in the theme
  const safeAccentColor = focusStyle.borderColor || '#007AFF';
  const animatedBorderColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [safeAccentColor, '#FFFFFF'],
  });

  // Handle layout for scroll positioning
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (onLayout) {
        const { y } = event.nativeEvent.layout;
        onLayout(id, y);
      }
    },
    [id, onLayout]
  );

  // Memoize base container style (without animated border color)
  const containerStyle = useMemo((): ViewStyle[] => {
    const styles: ViewStyle[] = [localStyles.container];

    if (style) {
      styles.push(style);
    }

    if (focused && isVoiceSessionActive) {
      styles.push({
        backgroundColor: focusStyle.backgroundColor,
        borderWidth: focusStyle.borderWidth,
      });
    }

    return styles;
  }, [focused, isVoiceSessionActive, focusStyle, style]);

  // Accessibility hint for voice control
  const accessibilityHint = isVoiceSessionActive
    ? t('a11y.voiceFocusHint', 'Zeg "open" om te selecteren')
    : undefined;

  // We need two nested Animated.Views because:
  // - Border color animation requires useNativeDriver: false (JS driver)
  // - Scale animation uses useNativeDriver: true (native driver)
  // React Native doesn't allow mixing both on the same node
  return (
    <Animated.View
      style={[
        containerStyle,
        // JS-driven: animated border color when focused (pulsing accent ↔ white)
        focused && isVoiceSessionActive && { borderColor: animatedBorderColor },
      ]}
      onLayout={handleLayout}
      accessible={true}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        selected: focused,
        disabled: disabled,
      }}
      accessibilityRole="button"
    >
      {/* Inner view for native-driven scale transform */}
      <Animated.View
        style={!reducedMotion ? { transform: [{ scale: scaleAnim }] } : undefined}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: borderRadius.md,
    // Ensure focus border doesn't shift layout
    overflow: 'hidden',
  },
});

export default VoiceFocusable;
