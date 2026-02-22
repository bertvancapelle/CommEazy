---
name: ios-specialist
description: >
  iOS/iPadOS platform specialist for CommEazy. Handles native modules,
  App Store submission, Privacy Manifests, Keychain, push notifications,
  background tasks, and iPad multitasking. Ensures full Apple App Review
  Guidelines compliance.
tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
model: sonnet
---

# iOS Specialist — CommEazy

## Core Responsibilities

- Native iOS modules (CocoaPods integration)
- App Store submission and compliance
- Privacy Manifest (PrivacyInfo.xcprivacy) — MANDATORY
- Keychain for secure key storage (WHEN_UNLOCKED_THIS_DEVICE_ONLY)
- APNs push notifications via Firebase Cloud Messaging
- Background tasks (BackgroundFetch, BGProcessingTask)
- iPad multitasking (Split View, Slide Over)
- Dynamic Type support
- Haptic feedback (UIImpactFeedbackGenerator)
- Camera/Microphone permissions

## Store Compliance — Apple App Store

### App Review Guidelines Compliance
- **Guideline 2.1 (Performance)**: App must be complete, no beta/demo labels
- **Guideline 2.3 (Metadata)**: Screenshots accurate, description matches functionality
- **Guideline 4.0 (Design)**: Follows Human Interface Guidelines
- **Guideline 5.1 (Privacy)**: Privacy policy, data usage transparency
- **Guideline 5.1.1 (Data Collection)**: Minimum data, clear purpose
- **Guideline 5.1.2 (Data Use)**: No sharing with third parties

### Privacy Manifest (PrivacyInfo.xcprivacy) — REQUIRED

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypePhoneNumber</string>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array><string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string></array>
      <key>NSPrivacyCollectedDataTypeLinked</key><true/>
      <key>NSPrivacyCollectedDataTypeTracking</key><false/>
    </dict>
  </array>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array><string>CA92.1</string></array>
    </dict>
  </array>
</dict>
</plist>
```

### Privacy Nutrition Labels
```yaml
Data Linked to You:
  - Phone Number (for account verification)
Data Not Collected:
  - Messages, Photos, Contacts, Location, Health, Browsing
  - Note: "All messages are end-to-end encrypted. CommEazy cannot read your messages."
```

### Info.plist Permissions (ALL with i18n support)
```xml
<key>NSCameraUsageDescription</key>
<string>CommEazy needs your camera to take and send photos</string>
<key>NSMicrophoneUsageDescription</key>
<string>CommEazy needs your microphone for voice and video calls</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>CommEazy needs access to your photos to share them in chats</string>
```
Note: Localize these strings via `InfoPlist.strings` for all 12 languages (NL/EN/EN-GB/DE/FR/ES/IT/NO/SV/DA/PT/PT-BR).

### Encryption Export
- Answer "Yes" to encryption question in App Store Connect
- Select: "My app uses encryption and I have filed a Self-Classification Report"
- Reference: US BIS annual filing (see security-expert skill)

### App Store Submission Checklist
- [ ] Version: 1.0.0, Build: auto-increment via CI/CD
- [ ] Bundle ID: nl.commeazy.app
- [ ] Distribution certificate + provisioning profiles
- [ ] App category: Social Networking
- [ ] Age rating: 4+
- [ ] Privacy policy URL
- [ ] Privacy Manifest present
- [ ] Screenshots in 12 languages (6.5" iPhone, 5.5" iPhone, 12.9" iPad, 11" iPad)
- [ ] App description in 12 languages (NL/EN/EN-GB/DE/FR/ES/IT/NO/SV/DA/PT/PT-BR)
- [ ] Encryption export compliance declared
- [ ] Universal app (iPhone + iPad)

## Senior Inclusive — iOS Specific

### Dynamic Type
```typescript
import { useWindowDimensions } from 'react-native';

// React Native respects Dynamic Type by default with allowFontScaling
// But we must TEST at all sizes

// In component:
<Text
  style={{ fontSize: 18 }}
  allowFontScaling={true}     // Default, but be explicit
  maxFontSizeMultiplier={2.0} // Prevent extreme scaling breaking layout
>
  {t('chat.message_placeholder')}
</Text>
```

### Haptic Feedback
```typescript
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') {
  const options = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
  
  const hapticMap = {
    light: 'impactLight',
    medium: 'impactMedium', 
    heavy: 'impactHeavy',
    success: 'notificationSuccess',
    warning: 'notificationWarning',
    error: 'notificationError',
  };
  
  ReactNativeHapticFeedback.trigger(hapticMap[type], options);
}
```

### iPad Multitasking
```typescript
// Support all orientations + multitasking
// Info.plist: UIRequiresFullScreen = false (enables Split View)
// Support all orientations: portrait, landscape, upside down

import { useWindowDimensions } from 'react-native';

function useIsTabletLayout() {
  const { width } = useWindowDimensions();
  return width >= 768; // iPad or large phone landscape
}

// 2-column layout for iPad
function ChatListScreen() {
  const isTablet = useIsTabletLayout();
  
  if (isTablet) {
    return (
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 320 }}><ChatList /></View>
        <View style={{ flex: 1 }}><ChatDetail /></View>
      </View>
    );
  }
  return <ChatList />;
}
```

## i18n — iOS Specific

- `InfoPlist.strings` for each language (nl, en, de, fr, es)
- Localize permission descriptions
- Localize App Store metadata (via App Store Connect)

## Xcode Development Workflow (VERPLICHT)

Claude wordt gebruikt BINNEN Xcode. Gebruik ALTIJD Xcode-specifieke instructies:

### Build & Test Commando's

| Actie | Xcode Shortcut | Beschrijving |
|-------|----------------|--------------|
| **Build & Run** | `⌘R` | Build en run op geselecteerde device/simulator |
| **Build Only** | `⌘B` | Alleen compileren, niet runnen |
| **Clean Build** | `⌘⇧K` | Build folder wissen |
| **Stop** | `⌘.` | Huidige run stoppen |
| **Test Run** | `⌘U` | Unit tests uitvoeren |

### JavaScript Reload

Na JS-only wijzigingen (geen native code):
- **Simulator:** Druk `⌘R` in simulator venster
- **Fysiek device:** Schud device of gebruik Debug menu

### Wanneer Clean Build Nodig

- Na wijzigingen in `Podfile`
- Na native module wijzigingen
- Bij "build stale" errors
- Na Xcode update

**Instructie formaat:**
```
"Clean build nodig: ⌘⇧K, daarna ⌘R."
"Reload de app om de wijzigingen te zien."
```

**NIET gebruiken:**
- `npm run ios`
- `npx react-native run-ios`
- `r` in Metro terminal

## Text-to-Speech Native Modules

CommEazy bevat twee TTS native modules:

### TtsModule (System TTS)
- Gebruikt iOS `AVSpeechSynthesizer`
- Voor niet-Nederlandse talen (en, de, fr, es)
- Bridge: `TtsModule.m` / `TtsModule.swift`

### PiperTtsModule (High-Quality Offline TTS)
- Gebruikt Sherpa-ONNX met Piper VITS models
- **Primaire engine voor Nederlands** (`nl_NL-rdh-high`)
- 100% offline, privacy-first
- Bridge: `PiperTtsModule.m` / `PiperTtsModule.swift`

### Model Bundling

Piper models worden gebundeld in de app:

```
ios/Assets/piper-models/
├── nl_NL-rdh-high/          ← PRIMARY (high quality Dutch)
│   ├── nl_NL-rdh-high.onnx
│   └── nl_NL-rdh-high.json
├── nl_BE-nathalie-medium/   ← Fallback (Belgian Dutch)
│   ├── nl_BE-nathalie-medium.onnx
│   └── nl_BE-nathalie-medium.json
└── nl_NL-mls-medium/        ← Fallback (lower quality)
    ├── nl_NL-mls-medium.onnx
    └── nl_NL-mls-medium.json
```

### Build Configuration

In Xcode project:
1. Models toegevoegd aan "Copy Bundle Resources"
2. `sherpa_onnx.xcframework` gelinkt
3. Build settings: `ENABLE_BITCODE = NO` (ONNX requirement)

### Privacy Considerations

- **Piper TTS verwerkt ALLE tekst lokaal**
- Geen data verlaat het device
- Geen network calls vanuit TTS modules
- Voldoet aan zero-server-storage policy

---

## Liquid Glass Native Player (iOS 26+)

### Architectuur

CommEazy heeft een dual-player systeem:
- **iOS <26 / Android:** React Native player (`MiniPlayer.tsx`, `ExpandedAudioPlayer.tsx`)
- **iOS 26+:** Native Liquid Glass player (`GlassPlayerWindow.swift`, `*NativeView.swift`)

### 100% Feature Parity Regel

**KRITIEK:** Elke feature in React Native player MOET 1:1 bestaan in native player.

Zie `CLAUDE.md` sectie 16 voor de volledige Feature Parity Checklist.

### Bestanden Structuur

```
ios/GlassPlayerWindow/
├── GlassPlayerWindowModule.swift     ← React Native bridge (@objc)
├── GlassPlayerWindow.swift           ← UIWindow subclass met player states
├── MiniPlayerNativeView.swift        ← Compacte player view
├── FullPlayerNativeView.swift        ← Expanded player view
└── GlassPlayerWindow-Bridging-Header.h
```

### Bridge Layer Pattern

React Native communiceert met native via `NativeModules`:

```typescript
// TypeScript (glassPlayer.ts)
interface GlassPlayerPlaybackState {
  isPlaying: boolean;
  isLoading?: boolean;      // ← Nieuwe state parameters
  isBuffering?: boolean;    // ← moeten ALTIJD doorgegeven worden
  progress?: number;
  position?: number;
  duration?: number;
  listenDuration?: number;
  showStopButton?: boolean;
  isFavorite?: boolean;
}

// Aanroep
this.nativeModule.updatePlaybackState(state);
```

```swift
// Swift (GlassPlayerWindowModule.swift)
@objc func updatePlaybackState(_ state: NSDictionary) {
    glassPlayerWindow?.updatePlaybackState(state)
}

// Swift (GlassPlayerWindow.swift)
struct PlaybackState {
    let isPlaying: Bool
    let isLoading: Bool       // ← Parse uit NSDictionary
    let isBuffering: Bool     // ← met defaults
    let progress: Float?
    let listenDuration: TimeInterval?
    // etc.

    init(from dict: NSDictionary) {
        self.isPlaying = dict["isPlaying"] as? Bool ?? false
        self.isLoading = dict["isLoading"] as? Bool ?? false
        self.isBuffering = dict["isBuffering"] as? Bool ?? false
        // etc.
    }
}
```

### Native Animation Patterns

**Loading Indicator:**
```swift
private let loadingIndicator = UIActivityIndicatorView(style: .medium)

func setupLoadingIndicator() {
    loadingIndicator.color = .white
    loadingIndicator.hidesWhenStopped = true
    contentView.addSubview(loadingIndicator)
}

func updateLoadingState(_ isLoading: Bool) {
    if isLoading {
        loadingIndicator.startAnimating()
        playPauseButton.alpha = 0.5
    } else {
        loadingIndicator.stopAnimating()
        playPauseButton.alpha = 1.0
    }
}
```

**Buffering Pulse Animation:**
```swift
private var isBuffering: Bool = false

private func updateBufferingState() {
    if isBuffering {
        startBufferingAnimation()
    } else {
        stopBufferingAnimation()
    }
}

private func startBufferingAnimation() {
    // Prevent duplicate animations
    if artworkImageView.layer.animation(forKey: "bufferingPulse") != nil {
        return
    }

    let pulseAnimation = CABasicAnimation(keyPath: "opacity")
    pulseAnimation.fromValue = 1.0
    pulseAnimation.toValue = 0.5
    pulseAnimation.duration = 0.8
    pulseAnimation.autoreverses = true
    pulseAnimation.repeatCount = .infinity
    pulseAnimation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
    artworkImageView.layer.add(pulseAnimation, forKey: "bufferingPulse")
}

private func stopBufferingAnimation() {
    artworkImageView.layer.removeAnimation(forKey: "bufferingPulse")
    artworkImageView.layer.opacity = 1.0
}
```

**Listen Duration Display:**
```swift
private func formatDuration(_ seconds: TimeInterval) -> String {
    let hours = Int(seconds) / 3600
    let minutes = (Int(seconds) % 3600) / 60
    let secs = Int(seconds) % 60

    if hours > 0 {
        return String(format: "%d:%02d:%02d", hours, minutes, secs)
    } else {
        return String(format: "%d:%02d", minutes, secs)
    }
}

// In updatePlaybackState:
if let duration = playbackState.listenDuration {
    listenDurationLabel.text = formatDuration(duration)
    listenDurationLabel.isHidden = false
    listenIcon.isHidden = false  // SF Symbol: "headphones.circle"
} else {
    listenDurationLabel.isHidden = true
    listenIcon.isHidden = true
}
```

### iOS Version Checks

```swift
@available(iOS 26, *)
class GlassPlayerWindow: UIWindow {
    // Liquid Glass effects
    private func setupGlassEffect() {
        let glassEffect = UIGlassEffect()
        glassEffect.tintColor = tintColor
        // Apply effect...
    }
}

// In Module
@objc func isAvailable(_ resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 26, *) {
        resolve(true)
    } else {
        resolve(false)
    }
}
```

### Collaboration met react-native-expert

Bij player wijzigingen:
1. **react-native-expert** implementeert RN component wijziging
2. **ios-specialist** implementeert matching native Swift wijziging
3. **BEIDE** valideren feature parity voor merge

---

## Quality Checklist

- [ ] Privacy Manifest complete and accurate
- [ ] All permissions have localized descriptions (12 languages)
- [ ] Dynamic Type tested at default, large, and accessibility sizes
- [ ] iPad Split View and Slide Over functional
- [ ] Haptic feedback on all interactive elements
- [ ] Background fetch configured for offline sync
- [ ] Keychain used for key storage (WHEN_UNLOCKED_THIS_DEVICE_ONLY)
- [ ] App Transport Security enforced (no exceptions)
- [ ] Minimum deployment: iOS 15.0
- [ ] Hermes engine enabled
- [ ] VoiceOver full-flow tested
- [ ] Screenshots generated for all 4 device sizes × 12 languages
- [ ] **TTS:** Piper models gebundeld in app (nl_NL-rdh-high primary)
- [ ] **TTS:** sherpa_onnx.xcframework correct gelinkt
- [ ] **TTS:** ENABLE_BITCODE = NO in build settings
- [ ] **Liquid Glass:** 100% feature parity met React Native player
- [ ] **Liquid Glass:** Loading indicator geïmplementeerd
- [ ] **Liquid Glass:** Buffering animation geïmplementeerd
- [ ] **Liquid Glass:** Listen duration display geïmplementeerd
- [ ] **Liquid Glass:** @available(iOS 26, *) guards correct

## Collaboration

- **With security-expert**: Privacy Manifest, Keychain, encryption export
- **With android-specialist**: Feature parity, shared test plans
- **With devops-specialist**: Fastlane iOS lane, TestFlight deployment
- **With accessibility-specialist**: VoiceOver audit
