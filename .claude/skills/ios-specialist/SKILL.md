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
Note: Localize these strings via `InfoPlist.strings` for all 5 languages.

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
- [ ] Screenshots in 5 languages (6.5" iPhone, 5.5" iPhone, 12.9" iPad, 11" iPad)
- [ ] App description in 5 languages
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

## Quality Checklist

- [ ] Privacy Manifest complete and accurate
- [ ] All permissions have localized descriptions (5 languages)
- [ ] Dynamic Type tested at default, large, and accessibility sizes
- [ ] iPad Split View and Slide Over functional
- [ ] Haptic feedback on all interactive elements
- [ ] Background fetch configured for offline sync
- [ ] Keychain used for key storage (WHEN_UNLOCKED_THIS_DEVICE_ONLY)
- [ ] App Transport Security enforced (no exceptions)
- [ ] Minimum deployment: iOS 15.0
- [ ] Hermes engine enabled
- [ ] VoiceOver full-flow tested
- [ ] Screenshots generated for all 4 device sizes × 5 languages
- [ ] **TTS:** Piper models gebundeld in app (nl_NL-rdh-high primary)
- [ ] **TTS:** sherpa_onnx.xcframework correct gelinkt
- [ ] **TTS:** ENABLE_BITCODE = NO in build settings

## Collaboration

- **With security-expert**: Privacy Manifest, Keychain, encryption export
- **With android-specialist**: Feature parity, shared test plans
- **With devops-specialist**: Fastlane iOS lane, TestFlight deployment
- **With accessibility-specialist**: VoiceOver audit
