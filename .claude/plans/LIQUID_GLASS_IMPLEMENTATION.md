# Liquid Glass Implementation Plan

## Doel

Vollledige ondersteuning van Apple's Liquid Glass design systeem (iOS/iPadOS 26+) met:
- Behoud van CommEazy's module kleurenschema als tints
- Instelbare tint intensiteit per gebruiker
- Volledige backward compatibility (iOS <26, Android)
- Senior-inclusive accessibility fallbacks

---

## Architectuur Overzicht

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Native Layer                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  LiquidGlassContext                                       │   │
│  │  - useLiquidGlass() hook                                  │   │
│  │  - tintIntensity: 0.0 - 1.0                              │   │
│  │  - isSupported: boolean                                   │   │
│  │  - reduceTransparency: boolean                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                    │
│                              ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  LiquidGlassView (Wrapper Component)                      │   │
│  │  - iOS 26+: renders native LiquidGlassNativeView          │   │
│  │  - iOS <26: renders View with solid backgroundColor       │   │
│  │  - Android: renders View with solid backgroundColor       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                    │
└──────────────────────────────┼────────────────────────────────────┘
                               │
                               ▼ (iOS 26+ only)
┌─────────────────────────────────────────────────────────────────┐
│                     Native iOS Layer                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  LiquidGlassModule.swift                                  │   │
│  │  - UIGlassEffect with tintColor                          │   │
│  │  - Respects reduceTransparency                           │   │
│  │  - Dynamic tint intensity                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Foundation — Context & Settings

### 1.1 LiquidGlassContext

**Bestand:** `src/contexts/LiquidGlassContext.tsx`

```typescript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform, AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// iOS version check
const getIOSVersion = (): number => {
  if (Platform.OS !== 'ios') return 0;
  const version = Platform.Version;
  if (typeof version === 'string') {
    return parseInt(version.split('.')[0], 10);
  }
  return version;
};

interface LiquidGlassContextValue {
  // Feature detection
  isSupported: boolean;           // iOS 26+ only
  isEnabled: boolean;             // User preference
  reduceTransparency: boolean;    // System accessibility setting

  // Tint settings
  tintIntensity: number;          // 0.0 (subtle) - 1.0 (vivid)
  setTintIntensity: (value: number) => void;

  // Toggle
  setEnabled: (enabled: boolean) => void;

  // Computed
  shouldUseLiquidGlass: boolean;  // isSupported && isEnabled && !reduceTransparency
}

const LiquidGlassContext = createContext<LiquidGlassContextValue | null>(null);

const STORAGE_KEY_ENABLED = '@liquidglass_enabled';
const STORAGE_KEY_INTENSITY = '@liquidglass_intensity';
const DEFAULT_INTENSITY = 0.5;

export function LiquidGlassProvider({ children }: { children: React.ReactNode }) {
  const isSupported = getIOSVersion() >= 26;

  const [isEnabled, setIsEnabledState] = useState(true);
  const [tintIntensity, setTintIntensityState] = useState(DEFAULT_INTENSITY);
  const [reduceTransparency, setReduceTransparency] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [enabledStr, intensityStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ENABLED),
          AsyncStorage.getItem(STORAGE_KEY_INTENSITY),
        ]);

        if (enabledStr !== null) {
          setIsEnabledState(enabledStr === 'true');
        }
        if (intensityStr !== null) {
          setTintIntensityState(parseFloat(intensityStr));
        }
      } catch (error) {
        console.warn('[LiquidGlass] Failed to load preferences:', error);
      }
    };

    loadPreferences();
  }, []);

  // Listen for accessibility changes
  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency
    );

    return () => subscription.remove();
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    setIsEnabledState(enabled);
    await AsyncStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
  }, []);

  const setTintIntensity = useCallback(async (value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setTintIntensityState(clamped);
    await AsyncStorage.setItem(STORAGE_KEY_INTENSITY, String(clamped));
  }, []);

  const shouldUseLiquidGlass = isSupported && isEnabled && !reduceTransparency;

  const value: LiquidGlassContextValue = {
    isSupported,
    isEnabled,
    reduceTransparency,
    tintIntensity,
    setTintIntensity,
    setEnabled,
    shouldUseLiquidGlass,
  };

  return (
    <LiquidGlassContext.Provider value={value}>
      {children}
    </LiquidGlassContext.Provider>
  );
}

export function useLiquidGlass(): LiquidGlassContextValue {
  const context = useContext(LiquidGlassContext);
  if (!context) {
    throw new Error('useLiquidGlass must be used within LiquidGlassProvider');
  }
  return context;
}

export function useLiquidGlassSafe(): LiquidGlassContextValue | null {
  return useContext(LiquidGlassContext);
}
```

### 1.2 Settings UI

**Bestand:** `src/screens/settings/AppearanceSettingsScreen.tsx`

Toevoegen aan bestaande instellingen of nieuw scherm:

```typescript
// Liquid Glass sectie (alleen tonen op iOS 26+)
{liquidGlass.isSupported && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{t('settings.appearance.liquidGlass')}</Text>

    {/* Toggle */}
    <SettingsRow
      label={t('settings.appearance.enableLiquidGlass')}
      description={t('settings.appearance.liquidGlassDescription')}
    >
      <Switch
        value={liquidGlass.isEnabled}
        onValueChange={liquidGlass.setEnabled}
        disabled={liquidGlass.reduceTransparency}
      />
    </SettingsRow>

    {/* Tint Intensity Slider */}
    {liquidGlass.isEnabled && !liquidGlass.reduceTransparency && (
      <SettingsRow
        label={t('settings.appearance.tintIntensity')}
        description={t('settings.appearance.tintIntensityDescription')}
      >
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>{t('settings.appearance.subtle')}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.1}
            value={liquidGlass.tintIntensity}
            onValueChange={liquidGlass.setTintIntensity}
            minimumTrackTintColor={accentColor.primary}
            thumbTintColor={accentColor.primary}
          />
          <Text style={styles.sliderLabel}>{t('settings.appearance.vivid')}</Text>
        </View>
      </SettingsRow>
    )}

    {/* Accessibility warning */}
    {liquidGlass.reduceTransparency && (
      <View style={styles.infoBox}>
        <Icon name="info" size={20} color={colors.textSecondary} />
        <Text style={styles.infoText}>
          {t('settings.appearance.reduceTransparencyWarning')}
        </Text>
      </View>
    )}
  </View>
)}
```

---

## Fase 2: Native Module — iOS

### 2.1 LiquidGlassModule.swift

**Bestand:** `ios/CommEazyTemp/LiquidGlassModule.swift`

```swift
import UIKit
import React

@available(iOS 26.0, *)
@objc(LiquidGlassModule)
class LiquidGlassModule: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc
  func isSupported(_ resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 26, *) {
      resolve(true)
    } else {
      resolve(false)
    }
  }
}

// MARK: - LiquidGlassView

@available(iOS 26.0, *)
@objc(LiquidGlassNativeView)
class LiquidGlassNativeView: UIView {

  private var glassEffectView: UIVisualEffectView?
  private var contentView: UIView?

  // Props from React Native
  @objc var tintColorHex: String = "#007AFF" {
    didSet { updateGlassEffect() }
  }

  @objc var tintIntensity: CGFloat = 0.5 {
    didSet { updateGlassEffect() }
  }

  @objc var glassStyle: String = "regular" {
    didSet { updateGlassEffect() }
  }

  @objc var cornerRadius: CGFloat = 0 {
    didSet {
      layer.cornerRadius = cornerRadius
      glassEffectView?.layer.cornerRadius = cornerRadius
      clipsToBounds = cornerRadius > 0
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    setupView()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupView()
  }

  private func setupView() {
    // Content view for React Native children
    contentView = UIView()
    contentView?.translatesAutoresizingMaskIntoConstraints = false

    updateGlassEffect()
  }

  private func updateGlassEffect() {
    // Remove existing effect
    glassEffectView?.removeFromSuperview()

    // Create glass effect
    let style: UIGlassEffect.Style = glassStyle == "prominent" ? .prominent : .regular
    let effect = UIGlassEffect(style: style)

    // Apply tint color with intensity
    let baseColor = UIColor(hex: tintColorHex) ?? .systemBlue
    effect.tintColor = baseColor.withAlphaComponent(tintIntensity)

    // Create visual effect view
    glassEffectView = UIVisualEffectView(effect: effect)
    glassEffectView?.translatesAutoresizingMaskIntoConstraints = false
    glassEffectView?.layer.cornerRadius = cornerRadius
    glassEffectView?.clipsToBounds = cornerRadius > 0

    // Add as background
    if let glass = glassEffectView {
      insertSubview(glass, at: 0)
      NSLayoutConstraint.activate([
        glass.leadingAnchor.constraint(equalTo: leadingAnchor),
        glass.trailingAnchor.constraint(equalTo: trailingAnchor),
        glass.topAnchor.constraint(equalTo: topAnchor),
        glass.bottomAnchor.constraint(equalTo: bottomAnchor),
      ])
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    glassEffectView?.frame = bounds
  }
}

// MARK: - UIColor Extension

extension UIColor {
  convenience init?(hex: String) {
    var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

    var rgb: UInt64 = 0
    guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

    let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
    let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
    let b = CGFloat(rgb & 0x0000FF) / 255.0

    self.init(red: r, green: g, blue: b, alpha: 1.0)
  }
}
```

### 2.2 LiquidGlassViewManager.swift

**Bestand:** `ios/CommEazyTemp/LiquidGlassViewManager.swift`

```swift
import React

@available(iOS 26.0, *)
@objc(LiquidGlassViewManager)
class LiquidGlassViewManager: RCTViewManager {

  override func view() -> UIView! {
    return LiquidGlassNativeView()
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}

// Fallback for iOS < 26
@objc(LiquidGlassFallbackViewManager)
class LiquidGlassFallbackViewManager: RCTViewManager {

  override func view() -> UIView! {
    return UIView() // Plain view, styling handled in React Native
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
```

### 2.3 Bridge Header

**Bestand:** `ios/CommEazyTemp/LiquidGlassModule.m`

```objc
#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>

// Module bridge
@interface RCT_EXTERN_MODULE(LiquidGlassModule, NSObject)
RCT_EXTERN_METHOD(isSupported:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
@end

// View manager bridge (iOS 26+)
@interface RCT_EXTERN_REMAP_VIEW(LiquidGlassNativeView, LiquidGlassViewManager)
RCT_EXPORT_VIEW_PROPERTY(tintColorHex, NSString)
RCT_EXPORT_VIEW_PROPERTY(tintIntensity, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(glassStyle, NSString)
RCT_EXPORT_VIEW_PROPERTY(cornerRadius, CGFloat)
@end

// Fallback view manager (iOS < 26)
@interface RCT_EXTERN_REMAP_VIEW(LiquidGlassFallbackView, LiquidGlassFallbackViewManager)
@end
```

---

## Fase 3: React Native Wrapper Component

### 3.1 LiquidGlassView Component

**Bestand:** `src/components/LiquidGlassView.tsx`

```typescript
import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  requireNativeComponent,
  ViewProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useLiquidGlass } from '@/contexts/LiquidGlassContext';
import { colors, borderRadius as themeBorderRadius } from '@/theme';

// Native component (iOS 26+ only)
const LiquidGlassNativeView = Platform.OS === 'ios'
  ? requireNativeComponent<LiquidGlassNativeProps>('LiquidGlassNativeView')
  : null;

interface LiquidGlassNativeProps {
  tintColorHex: string;
  tintIntensity: number;
  glassStyle: 'regular' | 'prominent';
  cornerRadius: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export interface LiquidGlassViewProps extends ViewProps {
  /** Tint color in hex format (e.g., "#00897B") */
  tintColor: string;

  /** Override the global tint intensity (0.0 - 1.0) */
  tintIntensityOverride?: number;

  /** Glass style variant */
  glassStyle?: 'regular' | 'prominent';

  /** Corner radius */
  borderRadius?: number;

  /** Fallback background color (used on non-Liquid Glass platforms) */
  fallbackColor?: string;

  children?: React.ReactNode;
}

export function LiquidGlassView({
  tintColor,
  tintIntensityOverride,
  glassStyle = 'regular',
  borderRadius = 0,
  fallbackColor,
  style,
  children,
  ...viewProps
}: LiquidGlassViewProps) {
  const liquidGlass = useLiquidGlass();

  // Use override intensity if provided, otherwise use global setting
  const intensity = tintIntensityOverride ?? liquidGlass.tintIntensity;

  // Fallback color defaults to the tint color
  const solidColor = fallbackColor ?? tintColor;

  // Flatten style to extract width/height for native component
  const flatStyle = useMemo(() => StyleSheet.flatten(style), [style]);

  // Render native Liquid Glass on iOS 26+ when enabled
  if (liquidGlass.shouldUseLiquidGlass && LiquidGlassNativeView) {
    return (
      <LiquidGlassNativeView
        tintColorHex={tintColor}
        tintIntensity={intensity}
        glassStyle={glassStyle}
        cornerRadius={borderRadius}
        style={[styles.container, style]}
        {...viewProps}
      >
        {children}
      </LiquidGlassNativeView>
    );
  }

  // Fallback: solid color view
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: solidColor,
          borderRadius,
        },
        style,
      ]}
      {...viewProps}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});

export default LiquidGlassView;
```

---

## Fase 4: Component Integratie

### 4.1 ModuleHeader met Liquid Glass

**Bestand:** `src/components/ModuleHeader.tsx` (wijzigingen)

```typescript
import { LiquidGlassView } from './LiquidGlassView';
import { MODULE_COLORS } from '@/constants/moduleColors';

interface ModuleHeaderProps {
  moduleId: string;
  icon: IconName;
  title: string;
  // ... existing props
}

export function ModuleHeader({
  moduleId,
  icon,
  title,
  showBackButton = false,
  onBackPress,
  currentSource,
  showAdMob = true,
}: ModuleHeaderProps) {
  const moduleColor = MODULE_COLORS[moduleId] || colors.primary;

  return (
    <LiquidGlassView
      tintColor={moduleColor}
      glassStyle="regular"
      fallbackColor={moduleColor}
      style={styles.header}
    >
      <SafeAreaView edges={['top']}>
        <View style={styles.headerContent}>
          {showBackButton && (
            <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
              <Icon name="chevron-left" size={28} color={colors.textOnPrimary} />
            </TouchableOpacity>
          )}
          <Icon name={icon} size={28} color={colors.textOnPrimary} />
          <Text style={styles.title}>{title}</Text>
          {currentSource && <MediaIndicator source={currentSource} />}
        </View>
        {showAdMob && <AdMobBanner />}
      </SafeAreaView>
    </LiquidGlassView>
  );
}
```

### 4.2 WheelNavigationMenu met Liquid Glass

**Bestand:** `src/components/WheelNavigationMenu.tsx` (wijzigingen)

```typescript
import { LiquidGlassView } from './LiquidGlassView';

// Menu item met Liquid Glass
function MenuItem({ item, isActive, onPress }: MenuItemProps) {
  const liquidGlass = useLiquidGlass();

  return (
    <TouchableOpacity onPress={() => onPress(item.destination)}>
      <LiquidGlassView
        tintColor={item.color}
        glassStyle={isActive ? 'prominent' : 'regular'}
        tintIntensityOverride={isActive ? 0.8 : liquidGlass.tintIntensity}
        borderRadius={borderRadius.lg}
        fallbackColor={item.color}
        style={[styles.menuItem, isActive && styles.menuItemActive]}
      >
        <Icon name={item.icon} size={32} color={colors.textOnPrimary} />
        <Text style={styles.menuItemLabel}>{item.label}</Text>
      </LiquidGlassView>
    </TouchableOpacity>
  );
}
```

### 4.3 MiniPlayer met Liquid Glass

**Bestand:** `src/components/MiniPlayer.tsx` (wijzigingen)

```typescript
import { LiquidGlassView } from './LiquidGlassView';

export function MiniPlayer({
  artwork,
  title,
  subtitle,
  accentColor,
  isPlaying,
  // ... other props
}: MiniPlayerProps) {
  return (
    <LiquidGlassView
      tintColor={accentColor}
      glassStyle="regular"
      borderRadius={borderRadius.lg}
      fallbackColor={accentColor}
      style={styles.container}
    >
      {/* Player content */}
    </LiquidGlassView>
  );
}
```

---

## Fase 5: i18n Strings

**Bestanden:** `src/locales/*.json`

```json
{
  "settings": {
    "appearance": {
      "liquidGlass": "Liquid Glass",
      "enableLiquidGlass": "Gebruik Liquid Glass",
      "liquidGlassDescription": "Modern glaseffect voor headers en controls (iOS 26+)",
      "tintIntensity": "Kleurintensiteit",
      "tintIntensityDescription": "Bepaalt hoe sterk de modulekleuren doorschijnen",
      "subtle": "Subtiel",
      "vivid": "Levendig",
      "reduceTransparencyWarning": "Liquid Glass is uitgeschakeld omdat 'Verminder transparantie' aan staat in je systeeminstellingen."
    }
  }
}
```

---

## Fase 6: Testplan

### 6.1 Device Matrix

| Device | OS | Test |
|--------|------|------|
| iPhone 15 Pro | iOS 26 | Liquid Glass actief |
| iPhone 15 Pro | iOS 26 + Reduce Transparency | Fallback naar solid |
| iPhone 14 | iOS 25 | Solid colors (geen crash) |
| iPhone SE 3 | iOS 26 | Performance check |
| iPad Pro M4 | iPadOS 26 | Split View + Liquid Glass |
| iPad Air | iPadOS 25 | Solid colors |
| Pixel 8 | Android 15 | Solid colors |
| Samsung A54 | Android 14 | Solid colors |

### 6.2 Test Scenarios

1. **Feature Detection**
   - [ ] `isSupported` = true op iOS 26+
   - [ ] `isSupported` = false op iOS <26
   - [ ] `isSupported` = false op Android

2. **Tint Intensity**
   - [ ] Slider wijzigt intensiteit real-time
   - [ ] Waarde wordt bewaard na app restart
   - [ ] Range 0.0-1.0 wordt correct geclamped

3. **Accessibility**
   - [ ] Reduce Transparency AAN → fallback naar solid
   - [ ] Reduce Motion → animaties respecteren dit
   - [ ] VoiceOver leest controls correct

4. **Module Colors**
   - [ ] Radio = Teal tint
   - [ ] Podcast = Paars tint
   - [ ] Luisterboek = Amber tint
   - [ ] Alle modules behouden herkenbare kleur

5. **Performance**
   - [ ] 60fps scroll in module lijsten
   - [ ] Geen merkbare lag bij navigatie
   - [ ] Memory gebruik <200MB

---

## Fase 7: Rollout Plan

### Week 1-2: Foundation
- [ ] LiquidGlassContext implementeren
- [ ] Native module skeleton (compile check)
- [ ] Settings UI toevoegen

### Week 3-4: Native Implementation
- [ ] LiquidGlassNativeView volledig implementeren
- [ ] Bridge testen
- [ ] Fallback verificatie

### Week 5-6: Component Migration
- [ ] ModuleHeader migreren
- [ ] WheelNavigationMenu migreren
- [ ] MiniPlayer / ExpandedAudioPlayer migreren

### Week 7: Testing & Polish
- [ ] Device matrix testen
- [ ] Accessibility audit
- [ ] Performance profiling

### Week 8: Release
- [ ] i18n review (alle 12 talen)
- [ ] Documentation update
- [ ] App Store screenshots bijwerken

---

## Bestanden Overzicht

### Nieuwe Bestanden

| Bestand | Beschrijving |
|---------|--------------|
| `src/contexts/LiquidGlassContext.tsx` | Context + hooks |
| `src/components/LiquidGlassView.tsx` | Wrapper component |
| `ios/CommEazyTemp/LiquidGlassModule.swift` | Native module |
| `ios/CommEazyTemp/LiquidGlassViewManager.swift` | View manager |
| `ios/CommEazyTemp/LiquidGlassModule.m` | Bridge |

### Te Wijzigen Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/ModuleHeader.tsx` | LiquidGlassView wrapper |
| `src/components/WheelNavigationMenu.tsx` | Menu items met glass |
| `src/components/MiniPlayer.tsx` | Glass background |
| `src/components/ExpandedAudioPlayer.tsx` | Glass background |
| `src/screens/settings/SettingsMainScreen.tsx` | Link naar Appearance |
| `src/contexts/index.ts` | Export LiquidGlassContext |
| `src/locales/*.json` | i18n strings (12 bestanden) |
| `App.tsx` | LiquidGlassProvider wrapper |

---

## Verificatie Checklist

Na implementatie:

- [ ] **iOS 26 Simulator:** Liquid Glass zichtbaar met tint
- [ ] **iOS 25 Simulator:** Solid kleuren, geen crash
- [ ] **Android Emulator:** Solid kleuren, geen crash
- [ ] **Settings:** Tint intensity slider werkt
- [ ] **Accessibility:** Reduce Transparency → solid fallback
- [ ] **Performance:** 60fps behouden
- [ ] **i18n:** Alle strings in 12 talen

---

## Afhankelijkheden

- **Xcode 17+** met iOS 26 SDK (wanneer beschikbaar)
- **React Native 0.73+** (huidige versie)
- **@react-native-async-storage/async-storage** (reeds geïnstalleerd)

---

## Risico's & Mitigatie

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| iOS 26 SDK nog niet beschikbaar | Hoog | Skeleton code nu, implementatie later |
| Performance issues op oudere devices | Medium | Intensity slider + disable optie |
| React Native bridge problemen | Medium | Fallback component altijd beschikbaar |
| Contrast problemen voor senioren | Hoog | Instelbare intensity + solid fallback |
