/**
 * FieldTextStyleContext — User-configurable text styling for form fields
 *
 * Provides 3 independent text style settings, each with color + font style:
 *
 * 1. **Label Style** — Field labels ("Voornaam") + section titles ("Wie ben je?")
 *    Default: black (#1A1A1A), normal weight
 *
 * 2. **Field Text Style** — Typed values + picker trigger-row values
 *    Default: blue (#1565C0), normal weight
 *
 * 3. **Modal Text Style** — Option text inside picker modals (on LiquidGlass bg)
 *    Default: black (#1A1A1A), normal weight
 *
 * Each setting allows:
 * - Color: 16 accent colors + black + white (all WCAG AAA)
 * - Font style: standard / bold / italic / bold+italic
 *
 * Follows the same AsyncStorage persistence pattern as ButtonStyleContext.
 *
 * @see .claude/CLAUDE.md Section "Form Field Styling"
 * @see src/contexts/ButtonStyleContext.tsx (template pattern)
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCENT_COLORS, type AccentColorKey } from '@/theme';

// ============================================================
// Types
// ============================================================

/** Available text colors (16 accent colors + black + white) */
export type TextStyleColor = AccentColorKey | 'black' | 'white';

/** Font style options */
export type FontStyleOption = 'standard' | 'bold' | 'italic' | 'boldItalic';

/** Single text style setting */
export interface TextStyleSetting {
  /** Color key from accent palette, 'black', or 'white' */
  color: TextStyleColor;
  /** Font style option */
  fontStyle: FontStyleOption;
}

/** Resolved style values for direct use in React Native */
export interface ResolvedTextStyle {
  /** Hex color string */
  color: string;
  /** Font weight: '400' or '700' */
  fontWeight: '400' | '700';
  /** Font style: 'normal' or 'italic' */
  fontStyle: 'normal' | 'italic';
}

/** All 3 settings combined */
export interface FieldTextStyleSettings {
  label: TextStyleSetting;
  fieldText: TextStyleSetting;
  modalText: TextStyleSetting;
}

export interface FieldTextStyleContextValue {
  /** Raw settings */
  settings: FieldTextStyleSettings;
  /** Whether settings are loading from AsyncStorage */
  isLoading: boolean;
  /** Resolved label style (ready for React Native) */
  labelStyle: ResolvedTextStyle;
  /** Resolved field text style (ready for React Native) */
  fieldTextStyle: ResolvedTextStyle;
  /** Resolved modal text style (ready for React Native) */
  modalTextStyle: ResolvedTextStyle;
  /** Update label setting */
  setLabelSetting: (setting: Partial<TextStyleSetting>) => Promise<void>;
  /** Update field text setting */
  setFieldTextSetting: (setting: Partial<TextStyleSetting>) => Promise<void>;
  /** Update modal text setting */
  setModalTextSetting: (setting: Partial<TextStyleSetting>) => Promise<void>;
  /** Reset all settings to defaults */
  resetAll: () => Promise<void>;
}

// ============================================================
// Constants
// ============================================================

const STORAGE_PREFIX = '@commeazy/fieldTextStyle';
const STORAGE_KEY_LABEL_COLOR = `${STORAGE_PREFIX}/labelColor`;
const STORAGE_KEY_LABEL_FONT = `${STORAGE_PREFIX}/labelFont`;
const STORAGE_KEY_FIELD_COLOR = `${STORAGE_PREFIX}/fieldColor`;
const STORAGE_KEY_FIELD_FONT = `${STORAGE_PREFIX}/fieldFont`;
const STORAGE_KEY_MODAL_COLOR = `${STORAGE_PREFIX}/modalColor`;
const STORAGE_KEY_MODAL_FONT = `${STORAGE_PREFIX}/modalFont`;

const DEFAULT_SETTINGS: FieldTextStyleSettings = {
  label: { color: 'black', fontStyle: 'standard' },
  fieldText: { color: 'blue', fontStyle: 'standard' },
  modalText: { color: 'black', fontStyle: 'standard' },
};

/** Hex colors for black and white options */
const EXTRA_COLORS: Record<'black' | 'white', string> = {
  black: '#1A1A1A', // textPrimary — not pure black for readability
  white: '#FFFFFF',
};

/** Valid font style values */
const VALID_FONT_STYLES: FontStyleOption[] = ['standard', 'bold', 'italic', 'boldItalic'];

// ============================================================
// Helpers
// ============================================================

/** Get hex color from a TextStyleColor key — uses primaryLight for text readability */
function getHexColor(colorKey: TextStyleColor): string {
  if (colorKey === 'black' || colorKey === 'white') {
    return EXTRA_COLORS[colorKey];
  }
  const accent = ACCENT_COLORS[colorKey];
  return accent?.primaryLight || accent?.primary || EXTRA_COLORS.black;
}

/** Resolve a TextStyleSetting to React Native style values */
function resolveStyle(setting: TextStyleSetting): ResolvedTextStyle {
  return {
    color: getHexColor(setting.color),
    fontWeight: setting.fontStyle === 'bold' || setting.fontStyle === 'boldItalic' ? '700' : '400',
    fontStyle: setting.fontStyle === 'italic' || setting.fontStyle === 'boldItalic' ? 'italic' : 'normal',
  };
}

/** Validate a font style string from storage */
function isValidFontStyle(value: string | null): value is FontStyleOption {
  return value !== null && VALID_FONT_STYLES.includes(value as FontStyleOption);
}

/** Validate a color string from storage */
function isValidTextStyleColor(value: string | null): value is TextStyleColor {
  if (!value) return false;
  if (value === 'black' || value === 'white') return true;
  return value in ACCENT_COLORS;
}

// ============================================================
// Context
// ============================================================

const FieldTextStyleContext = createContext<FieldTextStyleContextValue | null>(null);

interface FieldTextStyleProviderProps {
  children: ReactNode;
}

export function FieldTextStyleProvider({ children }: FieldTextStyleProviderProps) {
  const [settings, setSettings] = useState<FieldTextStyleSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const [
          labelColor, labelFont,
          fieldColor, fieldFont,
          modalColor, modalFont,
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_LABEL_COLOR),
          AsyncStorage.getItem(STORAGE_KEY_LABEL_FONT),
          AsyncStorage.getItem(STORAGE_KEY_FIELD_COLOR),
          AsyncStorage.getItem(STORAGE_KEY_FIELD_FONT),
          AsyncStorage.getItem(STORAGE_KEY_MODAL_COLOR),
          AsyncStorage.getItem(STORAGE_KEY_MODAL_FONT),
        ]);

        setSettings({
          label: {
            color: isValidTextStyleColor(labelColor) ? labelColor : DEFAULT_SETTINGS.label.color,
            fontStyle: isValidFontStyle(labelFont) ? labelFont : DEFAULT_SETTINGS.label.fontStyle,
          },
          fieldText: {
            color: isValidTextStyleColor(fieldColor) ? fieldColor : DEFAULT_SETTINGS.fieldText.color,
            fontStyle: isValidFontStyle(fieldFont) ? fieldFont : DEFAULT_SETTINGS.fieldText.fontStyle,
          },
          modalText: {
            color: isValidTextStyleColor(modalColor) ? modalColor : DEFAULT_SETTINGS.modalText.color,
            fontStyle: isValidFontStyle(modalFont) ? modalFont : DEFAULT_SETTINGS.modalText.fontStyle,
          },
        });
      } catch (error) {
        console.error('[FieldTextStyleContext] Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSettings();
  }, []);

  // Update label setting
  const setLabelSetting = useCallback(
    async (partial: Partial<TextStyleSetting>) => {
      const newLabel = { ...settings.label, ...partial };
      setSettings((prev) => ({ ...prev, label: newLabel }));

      try {
        if (partial.color !== undefined) {
          await AsyncStorage.setItem(STORAGE_KEY_LABEL_COLOR, partial.color);
        }
        if (partial.fontStyle !== undefined) {
          await AsyncStorage.setItem(STORAGE_KEY_LABEL_FONT, partial.fontStyle);
        }
      } catch (error) {
        console.error('[FieldTextStyleContext] Failed to save label setting:', error);
      }
    },
    [settings.label]
  );

  // Update field text setting
  const setFieldTextSetting = useCallback(
    async (partial: Partial<TextStyleSetting>) => {
      const newFieldText = { ...settings.fieldText, ...partial };
      setSettings((prev) => ({ ...prev, fieldText: newFieldText }));

      try {
        if (partial.color !== undefined) {
          await AsyncStorage.setItem(STORAGE_KEY_FIELD_COLOR, partial.color);
        }
        if (partial.fontStyle !== undefined) {
          await AsyncStorage.setItem(STORAGE_KEY_FIELD_FONT, partial.fontStyle);
        }
      } catch (error) {
        console.error('[FieldTextStyleContext] Failed to save field text setting:', error);
      }
    },
    [settings.fieldText]
  );

  // Update modal text setting
  const setModalTextSetting = useCallback(
    async (partial: Partial<TextStyleSetting>) => {
      const newModalText = { ...settings.modalText, ...partial };
      setSettings((prev) => ({ ...prev, modalText: newModalText }));

      try {
        if (partial.color !== undefined) {
          await AsyncStorage.setItem(STORAGE_KEY_MODAL_COLOR, partial.color);
        }
        if (partial.fontStyle !== undefined) {
          await AsyncStorage.setItem(STORAGE_KEY_MODAL_FONT, partial.fontStyle);
        }
      } catch (error) {
        console.error('[FieldTextStyleContext] Failed to save modal text setting:', error);
      }
    },
    [settings.modalText]
  );

  // Reset all to defaults
  const resetAll = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);

    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEY_LABEL_COLOR,
        STORAGE_KEY_LABEL_FONT,
        STORAGE_KEY_FIELD_COLOR,
        STORAGE_KEY_FIELD_FONT,
        STORAGE_KEY_MODAL_COLOR,
        STORAGE_KEY_MODAL_FONT,
      ]);
    } catch (error) {
      console.error('[FieldTextStyleContext] Failed to reset settings:', error);
    }
  }, []);

  // Resolve styles for consumers
  const labelStyle = useMemo(() => resolveStyle(settings.label), [settings.label]);
  const fieldTextStyle = useMemo(() => resolveStyle(settings.fieldText), [settings.fieldText]);
  const modalTextStyle = useMemo(() => resolveStyle(settings.modalText), [settings.modalText]);

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      labelStyle,
      fieldTextStyle,
      modalTextStyle,
      setLabelSetting,
      setFieldTextSetting,
      setModalTextSetting,
      resetAll,
    }),
    [settings, isLoading, labelStyle, fieldTextStyle, modalTextStyle, setLabelSetting, setFieldTextSetting, setModalTextSetting, resetAll]
  );

  return (
    <FieldTextStyleContext.Provider value={value}>{children}</FieldTextStyleContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Access the full field text style context.
 * Must be used within a FieldTextStyleProvider.
 */
export function useFieldTextStyleContext(): FieldTextStyleContextValue {
  const context = useContext(FieldTextStyleContext);
  if (!context) {
    throw new Error('useFieldTextStyleContext must be used within a FieldTextStyleProvider');
  }
  return context;
}

/**
 * Safe variant — returns null if used outside provider.
 */
export function useFieldTextStyleContextSafe(): FieldTextStyleContextValue | null {
  return useContext(FieldTextStyleContext);
}

/**
 * Convenience hook: returns only the resolved label style.
 * For use in field labels and section titles.
 */
export function useLabelStyle(): ResolvedTextStyle {
  const context = useFieldTextStyleContext();
  return context.labelStyle;
}

/**
 * Convenience hook: returns only the resolved field text style.
 * For use in TextInput values and picker trigger-row selected values.
 */
export function useFieldTextStyle(): ResolvedTextStyle {
  const context = useFieldTextStyleContext();
  return context.fieldTextStyle;
}

/**
 * Convenience hook: returns only the resolved modal text style.
 * For use in option text inside picker modals.
 */
export function useModalTextStyle(): ResolvedTextStyle {
  const context = useFieldTextStyleContext();
  return context.modalTextStyle;
}

/**
 * Utility: get hex color for a TextStyleColor key.
 * Useful in settings UI for preview swatches.
 */
export function getTextStyleColorHex(colorKey: TextStyleColor): string {
  return getHexColor(colorKey);
}

/** Re-export default settings for reset logic */
export { DEFAULT_SETTINGS as DEFAULT_FIELD_TEXT_STYLE_SETTINGS };
