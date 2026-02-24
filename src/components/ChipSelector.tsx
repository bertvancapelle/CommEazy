/**
 * ChipSelector — Senior-inclusive horizontal chip selector
 *
 * Standardized component for country/language selection in search filters.
 * Used across Radio, Podcast, and Books modules.
 *
 * Features:
 * - Horizontal scrolling pill-shaped chips
 * - 60pt touch targets (senior-inclusive)
 * - 18pt typography (senior-inclusive)
 * - Hold-gesture protection
 * - Automatic label via mode prop
 * - Optional toggle between country/language filter modes
 *
 * Senior-inclusive design:
 * - Touch targets ≥60pt
 * - Clear visual feedback on selection
 * - Large, readable text (18pt)
 * - Haptic feedback on selection
 * - Simple popup for mode switching (2 large buttons)
 *
 * @see .claude/CLAUDE.md Section 14 (Component Registry)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  type LayoutChangeEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';

// ============================================================
// Types
// ============================================================

export interface ChipOption {
  /** Unique code (e.g., 'NL', 'nl') */
  code: string;
  /** Flag emoji for countries (e.g., '🇳🇱') */
  flag?: string;
  /** Icon emoji for languages (e.g., '🗣️') */
  icon?: string;
  /** Native name (e.g., 'Nederland', 'Nederlands') */
  nativeName: string;
}

export type FilterMode = 'country' | 'language';

export interface ChipSelectorProps {
  /** Current filter mode — 'country' shows "Land", 'language' shows "Taal" */
  mode: FilterMode;
  /** List of options to display */
  options: ChipOption[];
  /** Currently selected code */
  selectedCode: string;
  /** Callback when an option is selected */
  onSelect: (code: string) => void;
  /** Optional custom label (overrides mode-based label) */
  label?: string;
  /** Enable mode toggle (tap on label to switch between country/language) */
  allowModeToggle?: boolean;
  /** Callback when mode changes (required if allowModeToggle is true) */
  onModeChange?: (mode: FilterMode) => void;
}

// ============================================================
// ChipSelector Component
// ============================================================

/**
 * Standardized chip selector for country/language filtering
 *
 * @example
 * // Country selection (Radio) - no toggle
 * <ChipSelector
 *   mode="country"
 *   options={COUNTRIES}
 *   selectedCode={selectedCountry}
 *   onSelect={setSelectedCountry}
 * />
 *
 * @example
 * // Radio with toggle between country/language
 * <ChipSelector
 *   mode={filterMode}
 *   options={filterMode === 'country' ? COUNTRIES : LANGUAGES}
 *   selectedCode={selectedCode}
 *   onSelect={setSelectedCode}
 *   allowModeToggle={true}
 *   onModeChange={setFilterMode}
 * />
 *
 * @example
 * // Language selection (Books) - no toggle needed
 * <ChipSelector
 *   mode="language"
 *   options={LANGUAGES}
 *   selectedCode={selectedLanguage}
 *   onSelect={setSelectedLanguage}
 * />
 */
export function ChipSelector({
  mode,
  options,
  selectedCode,
  onSelect,
  label,
  allowModeToggle = false,
  onModeChange,
}: ChipSelectorProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColor();
  const { triggerFeedback } = useFeedback();
  const [showModeModal, setShowModeModal] = useState(false);

  // Auto-scroll to selected chip
  const scrollViewRef = useRef<ScrollView>(null);
  const chipWidthsRef = useRef<Map<string, { x: number; width: number }>>(new Map());
  const scrollViewWidthRef = useRef<number>(0);
  const hasScrolledRef = useRef(false);

  // Track chip layouts for scroll calculation
  const handleChipLayout = useCallback((code: string, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    chipWidthsRef.current.set(code, { x, width });
  }, []);

  // Track scroll view width
  const handleScrollViewLayout = useCallback((event: LayoutChangeEvent) => {
    scrollViewWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  // Scroll to selected chip (centered if possible)
  const scrollToSelected = useCallback(() => {
    const chipInfo = chipWidthsRef.current.get(selectedCode);
    if (!chipInfo || !scrollViewRef.current) return;

    const scrollViewWidth = scrollViewWidthRef.current;
    if (scrollViewWidth === 0) return;

    // Calculate scroll position to center the chip
    const chipCenter = chipInfo.x + chipInfo.width / 2;
    const scrollX = Math.max(0, chipCenter - scrollViewWidth / 2);

    scrollViewRef.current.scrollTo({ x: scrollX, animated: true });
  }, [selectedCode]);

  // Auto-scroll when selectedCode changes or on initial mount
  useEffect(() => {
    // Small delay to ensure layout is complete
    const timer = setTimeout(() => {
      scrollToSelected();
      hasScrolledRef.current = true;
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedCode, scrollToSelected]);

  // Also scroll when options change (e.g., switching between countries/languages)
  useEffect(() => {
    // Reset scroll tracking when options change
    hasScrolledRef.current = false;
    chipWidthsRef.current.clear();
  }, [options]);

  // Determine label based on mode or custom label
  const displayLabel = label ?? t(`components.chipSelector.${mode}`);

  const handleSelect = async (code: string) => {
    await triggerFeedback('tap');
    onSelect(code);
  };

  const handleLabelPress = async () => {
    if (allowModeToggle && onModeChange) {
      await triggerFeedback('tap');
      setShowModeModal(true);
    }
  };

  const handleModeSelect = async (newMode: FilterMode) => {
    await triggerFeedback('tap');
    setShowModeModal(false);
    if (onModeChange && newMode !== mode) {
      onModeChange(newMode);
    }
  };

  // Get display icon for chip (flag for country, icon for language)
  const getChipIcon = (option: ChipOption): string => {
    return option.flag || option.icon || '';
  };

  return (
    <View style={styles.container}>
      {/* Label — ABOVE chips, bold, tappable if toggle enabled */}
      <TouchableOpacity
        onPress={handleLabelPress}
        disabled={!allowModeToggle}
        style={[
          styles.labelContainer,
          allowModeToggle && styles.labelContainerTappable,
        ]}
        accessibilityRole={allowModeToggle ? 'button' : 'text'}
        accessibilityLabel={allowModeToggle
          ? t('components.chipSelector.tapToChange', { current: displayLabel })
          : displayLabel
        }
        accessibilityHint={allowModeToggle
          ? t('components.chipSelector.tapToChangeHint')
          : undefined
        }
      >
        <Text style={[
          styles.label,
          allowModeToggle && { color: accentColor.primary },
        ]}>
          {displayLabel}
        </Text>
        {allowModeToggle && (
          <Icon name="chevron-down" size={18} color={accentColor.primary} />
        )}
      </TouchableOpacity>

      {/* Horizontal scrolling chips */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipList}
        onLayout={handleScrollViewLayout}
      >
        {options.map((option) => {
          const isSelected = selectedCode === option.code;
          const chipIcon = getChipIcon(option);

          return (
            <TouchableOpacity
              key={option.code}
              style={[
                styles.chip,
                isSelected && {
                  backgroundColor: accentColor.primary,
                  borderColor: accentColor.primary,
                },
              ]}
              onPress={() => handleSelect(option.code)}
              onLongPress={() => {
                // Empty handler prevents onPress from firing after long press
                // Required for HoldToNavigateWrapper compatibility
              }}
              delayLongPress={300}
              onLayout={(event) => handleChipLayout(option.code, event)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${chipIcon} ${option.nativeName}`}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextActive,
                ]}
              >
                {chipIcon} {option.nativeName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Mode Selection Modal */}
      <Modal
        visible={showModeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModeModal(false)}
        >
          <View
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom + spacing.lg },
            ]}
          >
            <Text style={styles.modalTitle}>
              {t('components.chipSelector.searchBy')}
            </Text>

            {/* Country option */}
            <TouchableOpacity
              style={[
                styles.modalOption,
                mode === 'country' && {
                  backgroundColor: accentColor.primary,
                  borderColor: accentColor.primary,
                },
              ]}
              onPress={() => handleModeSelect('country')}
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === 'country' }}
            >
              <Text style={styles.modalOptionIcon}>🌍</Text>
              <Text
                style={[
                  styles.modalOptionText,
                  mode === 'country' && styles.modalOptionTextActive,
                ]}
              >
                {t('components.chipSelector.country')}
              </Text>
              {mode === 'country' && (
                <Icon name="check" size={24} color={colors.textOnPrimary} />
              )}
            </TouchableOpacity>

            {/* Language option */}
            <TouchableOpacity
              style={[
                styles.modalOption,
                mode === 'language' && {
                  backgroundColor: accentColor.primary,
                  borderColor: accentColor.primary,
                },
              ]}
              onPress={() => handleModeSelect('language')}
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === 'language' }}
            >
              <Text style={styles.modalOptionIcon}>🗣️</Text>
              <Text
                style={[
                  styles.modalOptionText,
                  mode === 'language' && styles.modalOptionTextActive,
                ]}
              >
                {t('components.chipSelector.language')}
              </Text>
              {mode === 'language' && (
                <Icon name="check" size={24} color={colors.textOnPrimary} />
              )}
            </TouchableOpacity>

            {/* Cancel button */}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowModeModal(false)}
            >
              <Text style={styles.modalCancelText}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    // No margin — let parent control spacing
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  labelContainerTappable: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start', // Don't stretch full width
    minHeight: 44, // Minimum touch target
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  chipList: {
    gap: spacing.xs,
    paddingRight: spacing.md, // Extra padding for last chip visibility
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: touchTargets.minimum, // 60pt — senior-inclusive
    justifyContent: 'center',
  },
  chipText: {
    ...typography.body, // 18pt — senior-inclusive
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    minHeight: touchTargets.comfortable, // 72pt — senior-inclusive
  },
  modalOptionIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  modalOptionText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  modalOptionTextActive: {
    color: colors.textOnPrimary,
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  modalCancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

export default ChipSelector;
