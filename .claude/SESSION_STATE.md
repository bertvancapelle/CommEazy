# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-26
- **Sessie:** Onboarding validation consistency + Mail email-check modal
- **Commit:** `ca1933b`

## Voltooide Taken Deze Sessie

1. **FEAT: ProfileStep1Screen — consistent required field validation** (commit `ca1933b`)
   - Added red asterisks (`*`) on required fields (firstName, lastName, gender, birthDate)
   - Added `invalidField` highlight (light-red background `rgba(255,0,0,0.08)`) with auto-scroll to first empty field
   - Added reactive clearing of highlight when field is filled
   - Now matches ProfileSettingsScreen validation pattern (commit `ffb2789`)

2. **FEAT: ProfileStep2Screen — changed required fields + consistent validation** (commit `ca1933b`)
   - Changed required fields from (country, postcode, **city**) to (country, postcode, **houseNumber**)
   - Rationale: city is auto-filled by GISCO Address API when country + postcode + housenumber are provided
   - Applied same validation pattern: red asterisks, invalidField highlight, scrollToField, reactive clearing
   - Added `useScrollToField` hook for keyboard + modal-return focus

3. **FEAT: MailScreen — email-check modal before MailWelcomeModal** (commit `ca1933b`)
   - Before showing MailWelcomeModal, checks if user profile has email address
   - If NO email → shows `EmailRequiredModal` with email input + format validation
   - [Annuleren] = close modal, stay on "not configured" placeholder
   - [Doorgaan] = validate email format → save to profile → proceed to MailWelcomeModal
   - Same check when tapping "E-mail instellen" button on not-configured screen
   - Email format validation: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

4. **i18n: emailRequired keys in all 13 locales** (commit `ca1933b`)
   - Added `modules.mail.emailRequired` section with 7 keys to all locale files

5. **FIX: ProfileSettingsScreen redundant ErrorView banner** (commit `9d33063`, previous session)
   - Removed redundant required-field ErrorView banner from profile validation

6. **Vorige sessies (behouden context):**
   - MailWelcomeModal LiquidGlassView → View fix (commit `d54a0a2`)
   - Dead code cleanup in MailWelcomeModal.tsx (commit `02e85bd`)
   - useLabelStyle + useFieldTextStyle hooks op 6 formulier-schermen (commit `bb9e9f9`)
   - PanelAwareModal panelId 'main' fix (commit `815b605`)
   - DateTimePickerModal compact bottom-sheet (commit `46dec4c`)
   - Required field validation op ProfileSettingsScreen (commit `ffb2789`)

## Openstaande Taken

1. **Andere transparent modals met LiquidGlassView:** 3 modals hebben potentieel hetzelfde probleem:
   - `ContactSelectionModal` — transparent=true + LiquidGlassView
   - `ModulePickerModal` — transparent=true + LiquidGlassView (iPad only)
   - `VoiceCommandOverlay` — transparent=true + LiquidGlassView
   - **Prioriteit:** Lager dan MailWelcomeModal (minder kritiek pad), maar moet gevalideerd worden
2. **Uncommitted changes:** `MediaIndicator.tsx` (1 regel) + `AppleMusicScreen.tsx` (grote refactor) — niet gerelateerd, apart committen.
3. **Bluetooth media controls** — Hardware play/pause/next/prev knoppen. Nooit geimplementeerd.
4. **Glass Player flickering** — Bottom + right side flicker. Separate issue.
5. **SongCollectionModal uitbreiding** — Bulk album toevoegen was in PNA ontwerp maar nog niet geimplementeerd.

## Lopende PNA-Conclusies (Nog Niet Geimplementeerd)

Geen — alle beslissingen zijn geimplementeerd.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| ProfileStep2Screen: houseNumber verplicht i.p.v. city | GISCO API auto-fills city vanuit country + postcode + housenumber. NL wordt ondersteund. City verplicht maken dwingt senioren onnodig tot dubbel werk. |
| Mail email-check modal vóór MailWelcomeModal | Email is noodzakelijk voor IMAP/SMTP setup. Zonder email-check strandt de wizard later. Modal met inline validatie is senior-friendly (één stap, duidelijke foutmelding). |
| Validation pattern: invalidField highlight + scrollToField | Consistent met ProfileSettingsScreen (commit `ffb2789`). Geen banner die automatisch verdwijnt — highlight blijft tot veld is ingevuld. Senior-friendly: veld wordt in beeld gescrolld. |

## Context voor Volgende Sessie

- **Validation pattern nu consistent** op ProfileSettingsScreen, ProfileStep1Screen en ProfileStep2Screen: `invalidField` state → `requiredFields.find()` → `scrollToField()` → reactive clearing via `useEffect`
- **`invalidFieldHighlight` style:** `backgroundColor: 'rgba(255, 0, 0, 0.08)'`, borderRadius, padding, marginHorizontal — identiek op alle drie schermen
- **`requiredMark`:** Inline `<Text style={{ color: '#D32F2F', fontWeight: '700' }}> *</Text>` — NIET als style in StyleSheet
- **MailScreen email check flow:** `checkState()` leest profiel → geen email → `setShowEmailRequired(true)`. Ook `handleStartSetup()` (knop "E-mail instellen") checkt profiel.
- **EmailRequiredModal:** Saves email via `ServiceContainer.database.saveUserProfile()`, then sets `showWelcome(true)`
- **GISCO Address API:** `addressLookupService.ts` — EU Commission geocoding. `GISCO_SUPPORTED_COUNTRIES` includes 'NL'. Auto-fills street, city, province from country + postcode + housenumber.
- **Form Field Styling:** 8 regels in CLAUDE.md. Hooks `useLabelStyle()` + `useFieldTextStyle()` uit `FieldTextStyleContext` zijn VERPLICHT op alle formulier-schermen.
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx` — apart committen
- **Glass Player flicker:** `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
