# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-24
- **Sessie:** ProfileSettingsScreen required field validation
- **Commit:** `ffb2789`

## Voltooide Taken Deze Sessie

1. **Required field validation op ProfileSettingsScreen** (Bug: save zonder verplichte velden)
   - 8 verplichte velden: firstName, lastName, gender, birthDate, country, postalCode, houseNumber, city
   - Save knop blijft actief (niet disabled) — validatie bij tap
   - Bij leeg veld: scroll naar eerste lege veld + light-red background highlight + ErrorView warning + haptic feedback
   - Reactive clear: highlight verdwijnt zodra gebruiker het veld invult (`useEffect` watcher)
   - i18n: `profile.validation.requiredTitle` + `requiredMessage` in alle 13 locales
   - Style: `invalidFieldHighlight` met `rgba(255, 0, 0, 0.08)` achtergrond

2. **Vorige sessie (behouden context):**
   - Date picker timezone off-by-one fix (4 bestanden, 10 handlers)
   - ProfileSettings cursor jumping fix (getIsDirty useCallback)
   - View/Edit mode op ProfileSettingsScreen

## Openstaande Taken

1. **ProfileSettingsScreen field styling** (Issue 2, apart van validatie): Geen omranding om velden in view mode, labels volgen niet de setting voor labels in de instellingen (FieldTextStyleContext). Bewust als apart issue behandeld.
2. **Uncommitted changes:** `MediaIndicator.tsx` (1 regel) + `AppleMusicScreen.tsx` (grote refactor) — niet gerelateerd, apart committen.
3. **Bluetooth media controls** — Hardware play/pause/next/prev knoppen. Nooit geïmplementeerd.
4. **Glass Player flickering** — Bottom + right side flicker. Separate issue.
5. **SongCollectionModal uitbreiding** — Bulk album toevoegen was in PNA ontwerp maar nog niet geïmplementeerd.

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen — alle beslissingen zijn geïmplementeerd.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Save knop actief houden (niet disablen) | Senior-inclusive: disabled buttons zijn verwarrend. Actieve validatie met duidelijke feedback is beter. |
| Alleen eerste lege veld highlighten | Meerdere highlights tegelijk is overweldigend voor senioren. Eén probleem tegelijk oplossen. |
| Reactive clear via useEffect | Voorkomt stale visuele staat. Highlight verdwijnt automatisch zodra veld wordt ingevuld. |
| Validatie en field styling als aparte issues | Validation (punt 1) is functioneel kritiek, styling (punt 2) is cosmetisch. Aparte commits houden scope beheersbaar. |

## Context voor Volgende Sessie

- **ProfileSettingsScreen.tsx:** View/edit mode + validation + date/cursor bugs gefixt. Issue 2 (field styling/borders) nog open.
- **invalidField state:** `useState<string | null>(null)` op regel ~190, cleared in useEffect ~504-520
- **8 required fields:** displayFirstName, displayLastName, gender, birthDate, country, addressPostalCode, addressHouseNumber, addressCity
- **Date picker pattern:** Alle 4 screens met date pickers gebruiken nu lokale date components.
- **ContactAvatar is uniform** — presence + badge on ALL 12 consumer screens
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx` — apart committen
- **Audio Orchestrator:** `src/contexts/AudioOrchestratorContext.tsx` — centraal punt
- **Glass Player flicker:** `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
