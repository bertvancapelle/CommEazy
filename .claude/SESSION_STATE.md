# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-27
- **Sessie:** Dead code cleanup — categorie 1 (veilig verwijderbaar)
- **Commit:** `9d36645`

## Voltooide Taken Deze Sessie

1. **CHORE: Dead code cleanup** (commit `9d36645`)
   - **Verwijderde bestanden:**
     - `src/components/AirPlayButton.tsx` — nooit gebruikt
     - `src/components/AirPlayPresetHint.tsx` — nooit gebruikt
     - `src/components/NavigationMenu.tsx` — vervangen door WheelNavigationMenu
     - `src/hooks/useSiriCall.ts` — ongebruikte hook (228 regels)
   - **Opgeschoonde barrel exports:**
     - `components/index.ts` — verwijderd: NavigationMenu, AirPlayButton, AirPlayPresetHint, SearchButton (dead), StatusIndicator (dead). Behouden: SearchTabButton (actief in 8 files), MessageStatus (actief in 9 files), SeekSlider (actief in UnifiedFullPlayer)
     - `hooks/index.ts` — verwijderd: useSiriCall export block (6 regels)
   - **Verwijderde npm dependencies:**
     - `@react-native-community/blur` — 0 imports
     - `react-native-maps` — vervangen door WebView + Leaflet
     - `detox` (devDep) — geen e2e tests
   - **Config cleanup:** `react-native.config.js` — verwijderd orphaned react-native-maps autolink disable entry
   - **False positives geïdentificeerd en behouden:**
     - `base-64` — vereiste polyfill voor XMPP SASL auth in `index.js`
     - `libsodium-wrappers` + `@types/libsodium-wrappers` — gebruikt in test mocks en `jest.setup.js`
     - `useMailUnreadCount` — actief in `useModuleBadges.ts`
     - `SeekSlider` — actief in `UnifiedFullPlayer.tsx`

2. **Dead code analyse voltooid (PNA)**
   - Categorie 1 (veilig verwijderbaar): UITGEVOERD
   - Categorie 2 (geplande features, beslissing nodig): NOG OPEN — zie Openstaande Taken

## Openstaande Taken

1. **Dead code categorie 2 — Geplande features (beslissing nodig):**
   - 8 componenten voor ongebouwde features (AdMobBanner, EBookReader, AudioBookPlayer, GamePlaceholder, etc.)
   - 3 iPad Split View componenten (DraggableDivider, SplitViewLayout, ModulePanel)
   - ~9.767 ongebruikte StyleSheet entries across 165 bestanden
   - Beslissing: behouden voor toekomstig gebruik of verwijderen?
2. **Andere transparent modals met LiquidGlassView:** 3 modals te valideren:
   - `ContactSelectionModal`, `ModulePickerModal`, `VoiceCommandOverlay`
3. **Uncommitted changes:** `MediaIndicator.tsx` (1 regel) + `AppleMusicScreen.tsx` (grote refactor)
4. **Bluetooth media controls** — Hardware play/pause/next/prev knoppen. Nooit geimplementeerd.
5. **Glass Player flickering** — Bottom + right side flicker. Separate issue.
6. **SongCollectionModal uitbreiding** — Bulk album toevoegen (PNA ontwerp, niet geimplementeerd).

## Lopende PNA-Conclusies (Nog Niet Geimplementeerd)

Geen — alle beslissingen zijn geimplementeerd.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| `base-64` behouden | Vereiste polyfill voor `@xmpp/client` SASL auth — import in `index.js` was gemist door initiële analyse |
| `libsodium-wrappers` behouden | Gebruikt in `jest.setup.js` + test bestanden — runtime replaced door `react-native-libsodium` native module |
| `SearchButton.tsx` file behouden | Exporteert ook `SearchTabButton` die actief is in 8+ bestanden |
| `StatusIndicator.tsx` file behouden | Exporteert ook `MessageStatus` enum die actief is in 9+ bestanden |
| `react-native-maps` verwijderd | Vervangen door WebView + Leaflet (gedocumenteerd in `RadarMap.tsx`) |

## Context voor Volgende Sessie

- **Dead code categorie 2** nog open — geplande features, iPad Split View, ~9.767 unused styles
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx` — apart committen
- **Glass Player flicker:** `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
- **SiriCallModule.swift** native module is behouden — alleen de RN hook `useSiriCall.ts` is verwijderd
