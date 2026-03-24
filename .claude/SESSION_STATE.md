# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-24
- **Sessie:** Date picker timezone off-by-one fix + ProfileSettings cursor jumping fix
- **Commit:** `47004ff`

## Voltooide Taken Deze Sessie

1. **Date picker timezone off-by-one fix** (Bug 1)
   - Root cause: `toISOString().split('T')[0]` converteert naar UTC, in CET/CEST (UTC+1/+2) verschuift middernacht naar vorige dag
   - Fix: Vervangen door lokale date components (`getFullYear()`/`getMonth()+1`/`getDate()` met `padStart`)
   - Scope: 4 bestanden, 10 date picker handlers totaal:
     - `ProfileSettingsScreen.tsx` (2 pickers: birth, wedding)
     - `ProfileStep1Screen.tsx` (2 pickers: birth, wedding)
     - `ContactDetailScreen.tsx` (3 pickers: birth, wedding, death)
     - `ManualAddContactScreen.tsx` (3 pickers: birth, wedding, death)
   - Niet gefixt (intentioneel): `AgendaContext.tsx`, `AgendaItemDetailScreen.tsx`, `ComplianceReportScreen.tsx` — gebruiken UTC voor database/compliance doeleinden

2. **ProfileSettings cursor jumping fix** (Bug 2)
   - Root cause: `isDirty` useMemo met 14 velden als dependencies → re-render bij dirty status flip (false→true) op eerste keystroke → TextInput cursor reset
   - Fix: `isDirty` useMemo vervangen door `getIsDirty()` useCallback (on-demand evaluatie)
   - `handleCancelEdit` roept nu `getIsDirty()` aan i.p.v. `isDirty` te lezen

3. **View/Edit mode op ProfileSettingsScreen** (vorige sessie, behouden context)
   - View mode (standaard): alle velden read-only `<Text>`, "Bewerken" knop
   - Edit mode: alle velden editeerbaar, "Annuleer" + "✓ Opslaan" bar
   - Batch save in één `saveProfile()` call

## Openstaande Taken

1. **Uncommitted changes:** `MediaIndicator.tsx` (1 regel) + `AppleMusicScreen.tsx` (grote refactor) — niet gerelateerd, apart committen.
2. **Bluetooth media controls** — Hardware play/pause/next/prev knoppen. Nooit geïmplementeerd.
3. **Glass Player flickering** — Bottom + right side flicker. Separate issue.
4. **SongCollectionModal uitbreiding** — Bulk album toevoegen was in PNA ontwerp maar nog niet geïmplementeerd.

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen — alle beslissingen zijn geïmplementeerd.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Lokale date components i.p.v. toISOString() | `toISOString()` converteert naar UTC → CET/CEST timezone veroorzaakt off-by-one. Lokale getFullYear/getMonth/getDate geeft correcte lokale datum. |
| getIsDirty() useCallback i.p.v. isDirty useMemo | useMemo triggert re-render bij boolean flip → cursor reset. useCallback wordt alleen on-demand aangeroepen (bij Cancel). |
| AgendaContext/ComplianceReport NIET gefixed | Deze gebruiken toISOString() op dates die al in UTC in de database staan of intentioneel UTC moeten zijn. |

## Context voor Volgende Sessie

- **ProfileSettingsScreen.tsx:** View/edit mode + beide bugs gefixt. Pattern matcht ContactDetailScreen.
- **Date picker pattern:** Alle 4 screens met date pickers gebruiken nu lokale date components.
- **Modals buiten ScrollView:** ALLE screens zijn geaudit. Correct pattern is gevestigd.
- **ContactAvatar is uniform** — presence + badge on ALL 12 consumer screens
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx` — apart committen
- **Audio Orchestrator:** `src/contexts/AudioOrchestratorContext.tsx` — centraal punt
- **Glass Player flicker:** `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
