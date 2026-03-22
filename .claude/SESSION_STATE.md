# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-21
- **Sessie:** AirPlay 2 — 3 extra root causes gevonden en gefixt (na eerste 4 fixes onvoldoende bleken)
- **Commit:** `8ffda0d`

## Voltooide Taken Deze Sessie

1. **AirPlay 2 routing failure — 3 EXTRA root causes gefixt** (bovenop eerdere 4 fixes uit `c1aea27`)
   - **Symptoom:** Na eerste 4 fixes bleef 5-6s fallback. Gebruiker bevestigde: "helaas 5/6 sec fallback"
   - **Deep-dive diagnose:** Complete event chain getraced tijdens AirPlay route switching

   | Fix | Bestand | Probleem | Oplossing |
   |-----|---------|----------|-----------|
   | Fix 5a | `AVPlayerWrapper.swift` (Pods) | Route change timer was 1.5s, AirPlay 2 negotiation duurt 5-6s → `applyAVPlayerRate()` verstoorde handshake | Timer 1.5s→7s + smart `.playing` TimeControlStatus detection om guard vroeg te clearen |
   | Fix 5b | `RNTrackPlayer.swift` (node_modules) | `configureAudioSession()` riep `setCategory()` UNCONDITIONALLY aan bij elke `playWhenReady` change → route renegotiation tijdens actief AirPlay | `needsUpdate` guard: alleen `setCategory()` als session config echt verschilt |
   | Fix 6 | `ios/CommEazyTemp/Info.plist` | `AVInitialRouteSharingPolicy` ontbrak — iOS kon routing niet pre-configureren | `AVInitialRouteSharingPolicy = LongFormAudio` toegevoegd (WWDC23 aanbeveling) |
   | Fix 7 | `scripts/patch-packages.js` | Nieuwe patches moeten `npm install` / `pod install` overleven | `patchSwiftAudioExAirPlayGuard` v2→v3 + nieuwe `patchRNTrackPlayerConfigureAudioSession()` |

   - **Technische details:**
     - AirPlay 2 enhanced buffering negotiation duurt 5-6 seconden (Apple docs)
     - `setCategory()` tijdens actieve playback triggert route renegotiation (Apple docs)
     - v3 route change guard: `isRouteChanging` flag + 7s safety timeout + `.playing` early-clear
     - `needsUpdate` check vergelijkt `category`, `mode`, `routeSharingPolicy`, en `categoryOptions`

2. **Eerdere fixes (vorige sessie, commit `c1aea27`)** — nog steeds actief:
   - Fix 1: `allowsExternalPlayback = true` in AVPlayerWrapper.swift
   - Fix 2: TtsModule.m 5-param setCategory met policy preservatie
   - Fix 3: PiperTtsModule.mm 5-param setCategory met policy preservatie
   - Fix 4: patch-packages.js `patchSwiftAudioExAllowsExternalPlayback()`

## Openstaande Taken

1. **AirPlay fixes testen** — Clean build (⌘⇧K → ⌘R) nodig om alle 7 fixes te valideren op fysiek device met AirPlay speaker.
2. **Uncommitted changes:** `MediaIndicator.tsx` (1 regel) + `AppleMusicScreen.tsx` (grote refactor discovery sections) — niet gerelateerd aan AirPlay fixes, apart committen.
3. **Bluetooth media controls** — Hardware play/pause/next/prev knoppen. Nooit geïmplementeerd, niet een regressie.
4. **Glass Player flickering** — Bottom + right side flicker. Separate issue.
5. **Fundamentele UIWindow beperking** — React Native Modal creëert nieuw UIWindow, UIBlurEffect heeft niets om te blurren.
6. **SongCollectionModal uitbreiding** — Bulk album toevoegen was in PNA ontwerp maar nog niet geïmplementeerd.

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Timer 1.5s→7s (niet exact 6s) | AirPlay 2 negotiation duurt 5-6s, 7s geeft 1s marge |
| Smart `.playing` detection | Route kan eerder settlen — timer van 7s alleen als safety timeout |
| `needsUpdate` guard in configureAudioSession | Voorkomt onnodige `setCategory()` calls die route renegotiation triggeren |
| `AVInitialRouteSharingPolicy` in Info.plist | WWDC23 aanbeveling — laat iOS routing pre-configureren vóór playback objects |
| Alleen `setCategory()` skippen, niet `activateSession()` | Session activatie is nodig voor playback, alleen category config is problematisch |

## Context voor Volgende Sessie

- **AirPlay fix bestanden (alle 7 fixes):**
  - `ios/Pods/SwiftAudioEx/.../AVPlayerWrapper.swift`: `allowsExternalPlayback = true` + route change guard v3 (7s + `.playing`)
  - `node_modules/react-native-track-player/.../RNTrackPlayer.swift`: `configureAudioSession()` met `needsUpdate` guard
  - `ios/TtsModule.m`: 5-param `setCategory` met policy preservatie
  - `ios/PiperTtsModule.mm`: 5-param `setCategory` met policy preservatie
  - `ios/CommEazyTemp/Info.plist`: `AVInitialRouteSharingPolicy = LongFormAudio`
  - `scripts/patch-packages.js`: 3 patch functies (allowsExternalPlayback, AirPlay guard v3, configureAudioSession guard)
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx` — apart committen
- **Audio Orchestrator:** `src/contexts/AudioOrchestratorContext.tsx` — centraal punt
- **Glass Player flicker:** `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
- **Bluetooth controls:** Nog niet geïmplementeerd — zou via MPRemoteCommandCenter moeten
