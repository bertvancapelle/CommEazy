/**
 * useScrollToField — Ensures form fields are visible when focused or after modal interactions
 *
 * Solves two problems for senior users:
 * 1. KEYBOARD: When a TextInput is focused, the ScrollView scrolls to show the field above the keyboard
 * 2. MODAL-RETURN: When a modal (DateTimePickerModal, PickerModal) closes, the ScrollView scrolls
 *    back to show the field that was just edited
 *
 * @example
 * const { scrollRef, registerField, scrollToField, getFieldFocusHandler, handleScroll, getFieldHighlightStyle } = useScrollToField();
 * const moduleColor = useModuleColor('contacts');
 *
 * // Attach ref and onScroll to ScrollView
 * <ScrollViewWithIndicator ref={scrollRef} onScroll={handleScroll}>
 *
 *   // For TextInput fields — auto-scroll on focus + highlight
 *   <View ref={registerField('email')} style={[styles.fieldContainer, getFieldHighlightStyle('email', moduleColor)]}>
 *     <TextInput onFocus={getFieldFocusHandler('email')} />
 *   </View>
 *
 *   // For modal-triggered fields — scroll back after modal closes + highlight
 *   <View ref={registerField('birthDate')} style={[styles.fieldContainer, getFieldHighlightStyle('birthDate', moduleColor)]}>
 *     <HapticTouchable onPress={() => setShowDatePicker(true)}>
 *       <Text>{birthDate}</Text>
 *     </HapticTouchable>
 *   </View>
 *
 *   // In modal onClose:
 *   <DateTimePickerModal
 *     onClose={() => {
 *       setShowDatePicker(false);
 *       scrollToField('birthDate', { isModalReturn: true });
 *     }}
 *   />
 * </ScrollViewWithIndicator>
 */

import { useRef, useCallback, useState } from 'react';
import {
  type ScrollView,
  type View,
  type ViewStyle,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  Keyboard,
} from 'react-native';

export interface UseScrollToFieldReturn {
  /** Ref to attach to ScrollViewWithIndicator */
  scrollRef: React.RefObject<ScrollView>;
  /** Register a field's View ref by key — use as ref callback on the wrapping View */
  registerField: (key: string) => (ref: View | null) => void;
  /** Scroll to a specific field by key — call after modal closes */
  scrollToField: (key: string, options?: ScrollToFieldOptions) => void;
  /** Returns an onFocus handler for TextInput that scrolls to the field */
  getFieldFocusHandler: (key: string) => () => void;
  /** onScroll handler — pass to ScrollViewWithIndicator to track scroll offset */
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Currently focused/active field key (null when none) */
  focusedField: string | null;
  /** Set the focused field without scrolling — use when opening a modal for a field */
  setFieldFocus: (key: string | null) => void;
  /** Returns a highlight style for the field wrapper View — applies module accent bg when active */
  getFieldHighlightStyle: (key: string, moduleColor: string) => ViewStyle | undefined;
}

export interface ScrollToFieldOptions {
  /** Delay before scrolling (ms). Default: 300 for modals, 100 for keyboard */
  delay?: number;
  /** Extra offset above the field (pt). Default: 80 to account for headers */
  topOffset?: number;
  /** Whether this is a modal-return scroll (uses longer delay). Default: false */
  isModalReturn?: boolean;
}

/** Default offset above field — ensures field isn't hidden behind ModuleHeader */
const DEFAULT_TOP_OFFSET = 80;

/** Delay for keyboard focus scroll — allows keyboard animation to start */
const KEYBOARD_SCROLL_DELAY = 150;

/** Delay for modal-return scroll — allows modal dismiss animation to complete */
const MODAL_RETURN_SCROLL_DELAY = 350;

/** Hex opacity suffix for 10% — used for field highlight background */
const HIGHLIGHT_OPACITY_HEX = '1A';

/** Border radius for highlight background — matches borderRadius.md (12pt) */
const HIGHLIGHT_BORDER_RADIUS = 12;

export function useScrollToField(): UseScrollToFieldReturn {
  const scrollRef = useRef<ScrollView>(null);
  const fieldRefs = useRef<Map<string, View>>(new Map());
  const scrollOffsetY = useRef(0);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  /**
   * Track current scroll offset — consumers must pass this to ScrollView's onScroll.
   * This enables accurate field positioning with measureInWindow.
   */
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetY.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  /**
   * Register a field's View ref by key.
   * Usage: <View ref={registerField('email')}>
   */
  const registerField = useCallback(
    (key: string) => (ref: View | null) => {
      if (ref) {
        fieldRefs.current.set(key, ref);
      } else {
        fieldRefs.current.delete(key);
      }
    },
    [],
  );

  /**
   * Scroll the ScrollView to make a specific field visible.
   * Uses measureInWindow (compatible with both Old and New Architecture)
   * to get absolute screen positions, then computes the content offset.
   */
  const scrollToField = useCallback(
    (key: string, options?: ScrollToFieldOptions) => {
      const isModalReturn = options?.isModalReturn ?? false;
      const delay =
        options?.delay ?? (isModalReturn ? MODAL_RETURN_SCROLL_DELAY : KEYBOARD_SCROLL_DELAY);
      const topOffset = options?.topOffset ?? DEFAULT_TOP_OFFSET;

      // Mark this field as the active/focused field for highlight
      setFocusedField(key);

      // Dismiss keyboard if this is a modal-return scroll (field is a picker, not TextInput)
      if (isModalReturn) {
        Keyboard.dismiss();
      }

      setTimeout(() => {
        const fieldRef = fieldRefs.current.get(key);
        const scrollView = scrollRef.current;

        if (!fieldRef || !scrollView) {
          return;
        }

        // measureInWindow gives absolute screen coordinates.
        // Works on both Old Architecture and New Architecture (Fabric/RN 0.84+),
        // avoiding the "measureLayout must be called with a ref to a native component" error.
        (scrollView as any).measureInWindow(
          (_sx: number, scrollViewScreenY: number) => {
            (fieldRef as any).measureInWindow(
              (_fx: number, fieldScreenY: number) => {
                // fieldScreenY = scrollViewScreenY + fieldContentY - currentScrollOffset
                // => fieldContentY = (fieldScreenY - scrollViewScreenY) + currentScrollOffset
                const fieldContentY =
                  (fieldScreenY - scrollViewScreenY) + scrollOffsetY.current;

                const targetY = Math.max(0, fieldContentY - topOffset);
                scrollView.scrollTo({ y: targetY, animated: true });
              },
            );
          },
        );
      }, delay);
    },
    [],
  );

  /**
   * Returns an onFocus handler for TextInput that scrolls to the field.
   * Usage: <TextInput onFocus={getFieldFocusHandler('email')} />
   */
  const getFieldFocusHandler = useCallback(
    (key: string) => () => {
      scrollToField(key, { isModalReturn: false });
    },
    [scrollToField],
  );

  /**
   * Returns a highlight style for the field wrapper View when it's the active field.
   * Applies the module accent color at 10% opacity as background.
   * Usage: <View ref={registerField('email')} style={[styles.fieldContainer, getFieldHighlightStyle('email', moduleColor)]}>
   */
  const getFieldHighlightStyle = useCallback(
    (key: string, moduleColor: string): ViewStyle | undefined => {
      if (focusedField !== key) return undefined;
      return {
        backgroundColor: `${moduleColor}${HIGHLIGHT_OPACITY_HEX}`,
        borderRadius: HIGHLIGHT_BORDER_RADIUS,
      };
    },
    [focusedField],
  );

  return {
    scrollRef,
    registerField,
    scrollToField,
    getFieldFocusHandler,
    handleScroll,
    focusedField,
    setFieldFocus: setFocusedField,
    getFieldHighlightStyle,
  };
}
