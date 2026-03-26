# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-26
- **Sessie:** Required field validation op ManualAddContact, MailCompose, CreateGroup
- **Commit:** `2cb0d4f`

## Voltooide Taken Deze Sessie

1. **FEAT: ManualAddContactScreen — required field validation** (commit `2cb0d4f`)
   - firstName required (≥1 char) + conditional phone (≥1 of landline/mobile)
   - `invalidField` state + `scrollToField()` + reactive clearing via `useEffect`
   - Red asterisks on firstName, phoneLandline, phoneMobile
   - `invalidFieldHighlight` on empty required fields
   - `phoneValidationError` for "at least one phone number" conditional validation
   - Added `useLabelStyle()`, `useFieldTextStyle()`, `useFeedback()` hooks

2. **FEAT: MailComposeScreen — required field validation** (commit `2cb0d4f`)
   - To (≥1 recipient) and Subject (≥1 char) are required
   - `invalidField` state + `scrollToField()` + reactive clearing via `useEffect`
   - Red asterisks on To and Subject fields
   - `invalidFieldHighlight` on empty required fields
   - Validate-on-tap pattern (Send button always enabled, validates on press)

3. **FEAT: CreateGroupScreen — required field validation + ErrorView** (commit `2cb0d4f`)
   - groupName (≥2 chars) required with `invalidField` highlight
   - Red asterisk on group name field
   - Validate-on-tap pattern on Step 1 Next button (removed `disabled` prop)
   - `useLabelStyle()`, `useFieldTextStyle()`, `useFeedback()`, `useScrollToField()` hooks added
   - `ErrorView` for group creation failure in Step 3 (with retry)
   - `createError` state with `triggerFeedback('error')` on failure

4. **i18n: 3 new keys in all 13 locales** (commit `2cb0d4f`)
   - `validation.atLeastOnePhone` — "Vul minimaal één telefoonnummer in"
   - `group.createErrorTitle` — "Groep aanmaken mislukt"
   - `group.createErrorMessage` — "Er ging iets mis bij het aanmaken van de groep. Probeer het opnieuw."

5. **Vorige sessies (behouden context):**
   - ProfileStep1Screen + ProfileStep2Screen validation (commit `ca1933b`)
   - MailScreen email-check modal (commit `ca1933b`)
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
| Validate-on-tap i.p.v. disabled buttons | Disabled buttons geven senioren geen feedback WAAROM ze niet verder kunnen. Validate-on-tap toont highlight + scrollt naar het veld. |
| ManualAddContact: conditional phone validation | "Minimaal 1 telefoonnummer" — beide velden krijgen asterisk + highlight, foutmelding in eerste veld. Consistent met PNA-beslissing. |
| CreateGroupScreen: ErrorView voor create failure | ErrorView met retry is senior-friendlier dan Alert.alert (consistent met CLAUDE.md sectie 5). |
| AgendaItemFormScreen overgeslagen | Module bestaat nog niet — validatie wordt toegevoegd wanneer het scherm wordt gebouwd. |

## Context voor Volgende Sessie

- **Validation pattern nu consistent op 6 schermen:** ProfileSettingsScreen, ProfileStep1Screen, ProfileStep2Screen, ManualAddContactScreen, MailComposeScreen, CreateGroupScreen
- **Pattern:** `invalidField` state → validate-on-tap → `setInvalidField(key)` + `scrollToField(key)` + `triggerFeedback('warning')` → reactive clearing via `useEffect`
- **`invalidFieldHighlight` style:** `backgroundColor: 'rgba(255, 0, 0, 0.08)'`, borderRadius, padding, marginHorizontal — identiek op alle schermen
- **`requiredMark`:** Inline `<Text style={{ color: '#D32F2F', fontWeight: '700' }}> *</Text>` — NIET als style in StyleSheet
- **Conditional validation:** ManualAddContactScreen heeft `phoneValidationError` voor "minimaal 1 telefoon" — aparte state naast `invalidField`
- **Form Field Styling:** 8 regels in CLAUDE.md. Hooks `useLabelStyle()` + `useFieldTextStyle()` uit `FieldTextStyleContext` zijn VERPLICHT op alle formulier-schermen.
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx` — apart committen
- **Glass Player flicker:** `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
