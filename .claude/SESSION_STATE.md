# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-24
- **Sessie:** ProfileSettings view/edit mode + DateTimePickerModal date jumping fix
- **Commit:** (pending)

## Voltooide Taken Deze Sessie

1. **View/Edit mode op ProfileSettingsScreen** (gecombineerde fix)
   - View mode (standaard): alle velden read-only `<Text>`, "Bewerken" knop in fixed edit bar
   - Edit mode: alle velden editeerbaar `<TextInput>` / picker triggers, "Annuleer" + "✓ Opslaan" bar
   - `isEditing` state + `EditSnapshot` interface voor cancel/restore
   - `isDirty` useMemo vergelijkt huidige waarden met snapshot
   - Cancel bij dirty → `Alert.alert` bevestigingsdialoog ("Wijzigingen weggooien?")
   - Batch save: alle velden in één `saveProfile()` call (geen auto-save meer per veld)
   - Foto wijzigen + consent toggles blijven instant-save (buiten edit mode)

2. **DateTimePickerModal date jumping fix**
   - Root cause: `parseDateValue()` creëerde elke render een nieuw `Date` object → native iOS spinner reset
   - Fix: `tempBirthDate` / `tempWeddingDate` als lokale `Date` state objecten
   - Picker ontvangt stabiele Date referentie, pas bij sluiten geconverteerd naar ISO string
   - `handleBirthDatePickerClose` / `handleWeddingDatePickerClose` committen temp date → string state

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
| View/edit mode pattern op ProfileSettings | Matcht ContactDetailScreen pattern. Voorkomt per-ongeluk wijzigingen. Fixed bar altijd zichtbaar boven ScrollView. |
| Batch save i.p.v. auto-save per veld | Auto-save vuurde saveProfile bij elke blur/change. Batch save is efficiënter en voorspelbaarder. |
| Lokale Date state voor pickers | `parseDateValue()` string→Date roundtrip veroorzaakte nieuwe Date objecten elke render → native iOS spinner reset. Lokale Date state is stabiel. |
| Foto + consent blijven instant-save | Foto is een aparte actie (camera/gallery). Consent toggles zijn directe database writes, niet profiel-velden. |

## Context voor Volgende Sessie

- **ProfileSettingsScreen.tsx:** Nu met view/edit mode. Pattern matcht ContactDetailScreen.
- **DateTimePickerModal:** Bug was alleen op ProfileSettingsScreen (niet AgendaItemFormScreen) omdat AgendaItemFormScreen al lokale Date state gebruikte.
- **Modals buiten ScrollView:** ALLE screens zijn geaudit. Correct pattern is gevestigd.
- **ContactAvatar is uniform** — presence + badge on ALL 12 consumer screens
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx` — apart committen
- **Audio Orchestrator:** `src/contexts/AudioOrchestratorContext.tsx` — centraal punt
- **Glass Player flicker:** `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
