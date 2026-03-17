/**
 * useScrollToField — Ensures form fields are visible when focused or after modal interactions
 *
 * Solves two problems for senior users:
 * 1. KEYBOARD: When a TextInput is focused, the ScrollView scrolls to show the field above the keyboard
 * 2. MODAL-RETURN: When a modal (DateTimePickerModal, PickerModal) closes, the ScrollView scrolls
 *    back to show the field that was just edited
 *
 * @example
 * const { scrollRef, registerField, scrollToField, getFieldFocusHandler } = useScrollToField();
 *
 * // Attach ref to ScrollView
 * <ScrollViewWithIndicator ref={scrollRef}>
 *
 *   // For TextInput fields — auto-scroll on focus
 *   <View ref={registerField('email')}>
 *     <TextInput onFocus={getFieldFocusHandler('email')} />
 *   </View>
 *
 *   // For modal-triggered fields — scroll back after modal closes
 *   <View ref={registerField('birthDate')}>
 *     <HapticTouchable onPress={() => setShowDatePicker(true)}>
 *       <Text>{birthDate}</Text>
 *     </HapticTouchable>
 *   </View>
 *
 *   // In modal onClose:
 *   <DateTimePickerModal
 *     onClose={() => {
 *       setShowDatePicker(false);
 *       scrollToField('birthDate');
 *     }}
 *   />
 * </ScrollViewWithIndicator>
 */

import { useRef, useCallback } from 'react';
import {
  type ScrollView,
  type View,
  findNodeHandle,
  UIManager,
  Platform,
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

export function useScrollToField(): UseScrollToFieldReturn {
  const scrollRef = useRef<ScrollView>(null);
  const fieldRefs = useRef<Map<string, View>>(new Map());

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
   * Uses measureLayout to get the field's position relative to the ScrollView.
   */
  const scrollToField = useCallback(
    (key: string, options?: ScrollToFieldOptions) => {
      const isModalReturn = options?.isModalReturn ?? false;
      const delay =
        options?.delay ?? (isModalReturn ? MODAL_RETURN_SCROLL_DELAY : KEYBOARD_SCROLL_DELAY);
      const topOffset = options?.topOffset ?? DEFAULT_TOP_OFFSET;

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

        const scrollViewNode = findNodeHandle(scrollView);
        if (!scrollViewNode) {
          return;
        }

        // Measure field position relative to ScrollView
        if (Platform.OS === 'ios') {
          // iOS: use measureLayout for accurate positioning
          (fieldRef as any).measureLayout(
            scrollViewNode,
            (_x: number, y: number, _width: number, _height: number) => {
              const targetY = Math.max(0, y - topOffset);
              scrollView.scrollTo({ y: targetY, animated: true });
            },
            () => {
              // Fallback: measureLayout failed, do nothing
            },
          );
        } else {
          // Android: UIManager.measureLayout
          const fieldNode = findNodeHandle(fieldRef);
          if (!fieldNode) return;

          UIManager.measureLayout(
            fieldNode,
            scrollViewNode,
            () => {
              // Error callback — do nothing
            },
            (_x: number, y: number, _width: number, _height: number) => {
              const targetY = Math.max(0, y - topOffset);
              scrollView.scrollTo({ y: targetY, animated: true });
            },
          );
        }
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

  return {
    scrollRef,
    registerField,
    scrollToField,
    getFieldFocusHandler,
  };
}
