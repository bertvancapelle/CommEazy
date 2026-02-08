# CommEazy Unified Quality Gates

**Version:** 1.0 | **Date:** 2026-02-07
**Status:** MANDATORY — All skills MUST validate against these gates before any release.

---

## Gate 1: Store Compliance

### Apple App Store (iOS/iPadOS)
- [ ] App Review Guidelines 4.0-4.7 (Design) compliance
- [ ] Privacy Nutrition Labels complete and accurate
- [ ] PrivacyInfo.xcprivacy manifest present (iOS 17+)
- [ ] Encryption export compliance (US BIS Self-Classification Report filed)
- [ ] NSCameraUsageDescription, NSMicrophoneUsageDescription, NSPhotoLibraryUsageDescription in Info.plist
- [ ] App Transport Security (ATS) enforced (no exceptions)
- [ ] Minimum iOS 15.0 deployment target
- [ ] Universal app (iPhone + iPad) with proper multitasking
- [ ] Screenshots: 6.5" iPhone, 5.5" iPhone, 12.9" iPad, 11" iPad
- [ ] Age rating 4+ (no user-generated content visible to minors without moderation plan)
- [ ] Privacy policy URL accessible
- [ ] App category: Social Networking
- [ ] No private API usage

### Google Play Store (Android)
- [ ] Data Safety Section complete and accurate
- [ ] Target API level ≥ 34 (Android 14)
- [ ] Minimum SDK 24 (Android 7.0, 95%+ devices)
- [ ] Permissions declared with rationale
- [ ] 64-bit support mandatory
- [ ] App signing by Google Play
- [ ] Content rating questionnaire (IARC)
- [ ] Privacy policy URL
- [ ] Screenshots: Phone (16:9), 7" tablet, 10" tablet
- [ ] Feature graphic (1024×500)
- [ ] No background location unless justified

### Both Stores
- [ ] 5-language store listings (NL/EN/DE/FR/ES)
- [ ] Accessibility statement
- [ ] GDPR compliance documented
- [ ] Under-13 data handling (COPPA/GDPR-K) — CommEazy targets 60+ but family members may include minors

---

## Gate 2: Senior Inclusive Design

### Principles (NON-NEGOTIABLE)
These are not "elderly accommodations" — they are inclusive design standards that improve usability for ALL users.

- [ ] **Typography**: All body text ≥ 18pt, headings ≥ 24pt, labels ≥ 16pt
- [ ] **Touch targets**: All interactive elements ≥ 60×60pt (Apple HIG: 44pt minimum, we exceed)
- [ ] **Contrast**: WCAG AAA (7:1) for body text, AA (4.5:1) for large text minimum
- [ ] **Dynamic Type**: Respects system font size (iOS), font scaling (Android)
- [ ] **Colour blindness**: Never use color as sole indicator; always combine with icon/text/shape
- [ ] **Reduced motion**: Respects system `prefers-reduced-motion`; no auto-playing animations
- [ ] **Haptic feedback**: Confirm actions with haptic (UIImpactFeedbackGenerator iOS, VibrationEffect Android)
- [ ] **Audio feedback**: Optional sound cues for message sent/received (configurable)
- [ ] **Flow simplicity**: Max 3 steps per user flow, no nested menus deeper than 2 levels
- [ ] **Clear feedback**: Every action shows immediate visual + optional haptic response
- [ ] **Error recovery**: Every error state has a clear, single-action recovery path
- [ ] **No jargon**: All UI text in plain language, tested with non-technical users
- [ ] **No gesture-only**: Every gesture has a button alternative (no pinch-to-zoom required)
- [ ] **VoiceOver (iOS)**: All elements labeled, logical reading order
- [ ] **TalkBack (Android)**: All elements labeled, content descriptions
- [ ] **Screen reader testing**: Full flow tested with VoiceOver AND TalkBack

### Senior Testing Protocol
- [ ] Prototype tested with minimum 5 users aged 65-80
- [ ] Task completion rate ≥ 80%
- [ ] Error rate < 10%
- [ ] Satisfaction score ≥ 3.5/5
- [ ] "Would use with family" ≥ 70%

---

## Gate 3: Internationalization (i18n/L10n)

### Supported Languages at Launch
| Code | Language | Direction | Plural rules |
|------|----------|-----------|-------------|
| nl | Nederlands | LTR | one/other |
| en | English | LTR | one/other |
| de | Deutsch | LTR | one/other |
| fr | Français | LTR | one/other |
| es | Español | LTR | one/other |

### Requirements
- [ ] All UI strings externalized via i18n framework (react-i18next)
- [ ] No hardcoded strings in components
- [ ] Language selector in Settings (first-run + changeable)
- [ ] Date/time formatting per locale (Intl.DateTimeFormat)
- [ ] Number formatting per locale (Intl.NumberFormat)
- [ ] Plural rules implemented per language
- [ ] Text expansion tested (German expands ~30% vs English)
- [ ] All 5 languages complete before release
- [ ] Store listings in all 5 languages
- [ ] Error messages translated in all 5 languages
- [ ] Push notification text translated
- [ ] Onboarding flow in selected language
- [ ] Fallback: English if translation missing
- [ ] No text in images (use text overlays)
- [ ] Font supports all 5 languages' character sets

### Translation Key Naming Convention
```
screen.component.element
chat.input.placeholder = "Typ een bericht..."
error.network.offline = "Geen internetverbinding"
onboarding.welcome.title = "Welkom bij CommEazy"
```

---

## Gate 4: Security

- [ ] All messages E2E encrypted before leaving device
- [ ] Private keys never in logs, never transmitted
- [ ] Prosody zero-storage verified (max_history_messages=0, no MAM)
- [ ] TLS enforced for all connections
- [ ] Input validation on all user input
- [ ] Sensitive data cleared from memory after use
- [ ] Realm/database encrypted at rest
- [ ] 7-day outbox auto-cleanup implemented
- [ ] QR code key verification available
- [ ] No plaintext in error messages/crash reports

---

## Gate 5: Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cold start | < 3 sec | Time to interactive |
| Message scroll | 60 fps | 1000+ messages |
| Photo encryption (1MB) | < 500ms | iPhone SE baseline |
| Memory usage | < 200 MB | After 1hr use |
| Bundle size (iOS) | < 25 MB | IPA after thinning |
| Bundle size (Android) | < 20 MB | AAB after splits |
| Offline sync | < 10 sec | 50 messages, member back online |
| Battery | < 5% per hour | Active messaging |

---

## Gate 6: Code Quality

- [ ] TypeScript strict mode, zero `any` types
- [ ] ESLint zero warnings
- [ ] Unit test coverage > 80%
- [ ] All public APIs documented (TSDoc)
- [ ] No TODO/FIXME in production code
- [ ] Consistent naming (camelCase functions, PascalCase components)
- [ ] Max file length: 300 lines (split if larger)
- [ ] Error handling: no unhandled promises
- [ ] Cleanup: all listeners/subscriptions cleaned in useEffect return

---

## Pre-Release Checklist (ALL Gates Combined)

```
[ ] Gate 1: Store Compliance — iOS ✓, Android ✓
[ ] Gate 2: Senior Inclusive Design — All checks pass
[ ] Gate 3: i18n — All 5 languages complete and tested
[ ] Gate 4: Security — Audit passed, zero-storage verified
[ ] Gate 5: Performance — All metrics within targets
[ ] Gate 6: Code Quality — Clean build, tests pass, coverage met
```
