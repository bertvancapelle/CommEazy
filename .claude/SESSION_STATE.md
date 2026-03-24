# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-24
- **Sessie:** DateTimePickerModal fix + Dynamic Island overlap fix
- **Commit:** `ce2806e`

## Voltooide Taken Deze Sessie

1. **DateTimePickerModal invisible fix** (commit `ce2806e`)
   - Root cause: `ModalLayout` root View had `flex: 1` maar zat in een content-sized container zonder hoogte → collapste naar 0px
   - Fix: ModalLayout verwijderd uit DateTimePickerModal, header en pickerContainer direct als siblings gerenderd
   - Impact: Alle 15 DateTimePickerModal instances over 5 schermen (AgendaItemFormScreen, ProfileSettingsScreen, ContactDetailScreen, ManualAddContactScreen, ProfileStep1Screen)

2. **Dynamic Island overlap fix op picker modals** (commit `ce2806e`)
   - Root cause: `formPickerStyles.container` (flex: 1) had geen safe area padding → header renderde achter Dynamic Island
   - Fix: Safe area spacer (`<View style={{ height: insets.top }} />`) toegevoegd aan 4 modals in AgendaItemFormScreen:
     - FormPickerModal (repeat/reminder pickers)
     - CategoryPickerModal
     - CreateCategoryModal
     - Contact picker modal (inline)

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
| ModalLayout verwijderd uit DateTimePickerModal | DateTimePickerModal is een bottom-sheet (content-sized), niet een full-screen layout. ModalLayout's flex:1 root collapste in container zonder hoogte. Toolbar positie omdraaien is n.v.t. voor single horizontal row (titel + done knop). |
| Safe area spacer per sub-component | Elke sub-component (FormPickerModal, CategoryPickerModal, CreateCategoryModal) heeft eigen `useSafeAreaInsets()` call nodig — hooks kunnen niet gedeeld worden via StyleSheet.create |
| Contact picker uses parent `insets` | Contact picker is inline in hoofd-component waar `insets` al beschikbaar is (regel 771) |

## Context voor Volgende Sessie

- **DateTimePickerModal:** Gebruikt GEEN ModalLayout meer — directe rendering van header + pickerContainer. CLAUDE.md adoptie tabel was al correct ("DateTimePickerModal: ❌ n.v.t.")
- **ModalLayout flex:1 issue:** Kan potentieel ook andere ModalLayout consumers treffen die in content-sized containers zitten. Alle huidige consumers (PickerModal, CreateGroupModal, etc.) hebben `flex: 1` op hun container → geen probleem.
- **ContactAvatar is uniform** — presence + badge on ALL 12 consumer screens
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx` — apart committen
- **Audio Orchestrator:** `src/contexts/AudioOrchestratorContext.tsx` — centraal punt
- **Glass Player flicker:** `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
