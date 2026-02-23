# Apple Music Module — Implementatieplan

## Status: Grotendeels Voltooid ✅

**Laatst bijgewerkt:** 2026-02-23

## Overzicht

Apple Music integratie voor CommEazy: muziek afspelen EN ontdekken met senior-inclusive UX.

**Platformondersteuning:**
- **iOS/iPadOS:** Volledige integratie via MusicKit framework ✅
- **Android:** Detectie + prompt om Apple Music app te installeren ⏳

---

## Implementatie Status

| Fase | Beschrijving | Status | Opmerkingen |
|------|--------------|--------|-------------|
| **Fase 1** | iOS Foundation (MusicKit native module) | ✅ **VOLTOOID** | 1050 regels Swift |
| **Fase 2** | Android Stub (app detectie) | ⏳ **TE VALIDEREN** | Moet worden gecontroleerd |
| **Fase 3** | React Native Context & Hooks | ✅ **VOLTOOID** | AppleMusicContext.tsx |
| **Fase 4** | Discovery Screens | ✅ **VOLTOOID** | Search, Library, Playlists tabs |
| **Fase 5** | Player Extensions (RN) | ✅ **VOLTOOID** | Glass Player integratie |
| **Fase 6** | Native Feature Parity (iOS 26+) | ⏳ **TE VALIDEREN** | Shuffle/repeat in native player? |
| **Fase 7** | i18n (13 talen) | ⏳ **TE VALIDEREN** | Controleer completeness |

---

## Geïmplementeerde Bestanden

### iOS Native Layer ✅

| Bestand | Regels | Status |
|---------|--------|--------|
| `ios/CommEazyTemp/AppleMusicModule.swift` | 1050 | ✅ Volledig |
| `ios/CommEazyTemp/AppleMusicModule.m` | 130 | ✅ Volledig |

**Geïmplementeerde features in native module:**
- ✅ MusicKit authorization (checkAuthStatus, requestAuthorization)
- ✅ Subscription check (checkSubscription)
- ✅ Catalog search (songs, albums, artists, playlists)
- ✅ Top charts
- ✅ Playback control (playSong, playLibrarySong, playAlbum, playPlaylist)
- ✅ Pause, resume, stop
- ✅ Skip next/previous
- ✅ Seek to position
- ✅ Shuffle mode (off, songs)
- ✅ Repeat mode (off, one, all)
- ✅ Queue management (getQueue, addToQueue)
- ✅ Playback state events (onPlaybackStateChange, onNowPlayingItemChange, onQueueChange)
- ✅ State debouncing (prevents UI flicker)
- ✅ Time update timer (progress slider)

### React Native Layer ✅

| Bestand | Status |
|---------|--------|
| `src/contexts/AppleMusicContext.tsx` | ✅ Volledig |
| `src/screens/modules/AppleMusicScreen.tsx` | ✅ Volledig |

**Geïmplementeerde features in RN:**
- ✅ Native module bridge met event listeners
- ✅ Auth status management
- ✅ Playback state (playing, paused, loading)
- ✅ Search, Library, Playlists tabs
- ✅ MiniPlayer integratie
- ✅ ExpandedAudioPlayer integratie
- ✅ Glass Player integratie (`useModuleColor('appleMusic')`)
- ✅ VoiceFocusable song lists
- ✅ Shuffle/repeat mode controls
- ✅ Sleep timer
- ✅ Android graceful degradation

---

## Architectuur (Geïmplementeerd)

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Native Layer                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AppleMusicContext.tsx                                       ││
│  │  - Auth status (authorized/denied/checking)                  ││
│  │  - Playback state (playing/paused/loading)                   ││
│  │  - Queue management                                          ││
│  │  - Shuffle/Repeat modes                                      ││
│  │  - Native event listeners                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AppleMusicScreen.tsx                                        ││
│  │  - Search / Library / Playlists tabs                         ││
│  │  - MiniPlayer / ExpandedAudioPlayer                          ││
│  │  - Glass Player integratie                                   ││
│  │  - VoiceFocusable lijsten                                    ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    Native iOS Layer (MusicKit)                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AppleMusicModule.swift (1050 regels)                        ││
│  │  - MusicKit authorization ✅                                 ││
│  │  - Catalog search (songs, albums, artists, playlists) ✅     ││
│  │  - Top charts ✅                                             ││
│  │  - Playback control (ApplicationMusicPlayer) ✅              ││
│  │  - Shuffle/Repeat modes ✅                                   ││
│  │  - Queue management ✅                                       ││
│  │  - Real-time events ✅                                       ││
│  │  - State debouncing ✅                                       ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    Android Layer (Stub)                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AppleMusicModule.kt (te valideren)                          ││
│  │  - App detectie                                              ││
│  │  - Play Store link                                           ││
│  │  - Open app intent                                           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Nog Te Valideren / Voltooien

### 1. Android Module (Fase 2)

**Status:** ⏳ Te valideren

**Controleer:**
- [ ] `android/app/src/main/java/.../AppleMusicModule.kt` bestaat
- [ ] App detectie werkt
- [ ] Play Store link werkt
- [ ] Open app intent werkt

### 2. Native Glass Player Feature Parity (Fase 6)

**Status:** ⏳ Te valideren

**Controleer in `FullPlayerNativeView.swift`:**
- [ ] Shuffle button aanwezig en werkt
- [ ] Repeat button aanwezig en werkt (cyclet: off → all → one)
- [ ] Shuffle/repeat state wordt doorgegeven via bridge

**Controleer in `glassPlayer.ts`:**
- [ ] `shuffleMode` en `repeatMode` in `GlassPlayerPlaybackState`
- [ ] `configureControls()` accepteert `shuffle` en `repeat` options

### 3. i18n Completeness (Fase 7)

**Status:** ⏳ Te valideren

**Controleer of `modules.appleMusic.*` keys aanwezig zijn in alle 13 locale bestanden:**
- [ ] nl.json
- [ ] en.json
- [ ] en-GB.json
- [ ] de.json
- [ ] fr.json
- [ ] es.json
- [ ] it.json
- [ ] no.json
- [ ] sv.json
- [ ] da.json
- [ ] pt.json
- [ ] pt-BR.json
- [ ] pl.json

### 4. Module Registratie

**Controleer:**
- [ ] `appleMusic` in `NavigationDestination` type
- [ ] `appleMusic` in `ALL_MODULES` array
- [ ] `appleMusic` in `DEFAULT_MODULE_ORDER` array
- [ ] `appleMusic` in `STATIC_MODULE_DEFINITIONS`
- [ ] `appleMusic` in `MODULE_TINT_COLORS`
- [ ] `appleMusic` in `ModuleColorId` type
- [ ] `appleMusic` in `CUSTOMIZABLE_MODULES`
- [ ] Navigation route in `navigation/index.tsx`

---

## Test Scenario's

| Test | Platform | Status | Opmerkingen |
|------|----------|--------|-------------|
| Auth check - niet ingelogd | iOS | ⏳ | Login prompt tonen |
| Auth check - geen subscription | iOS | ⏳ | Subscription melding |
| Auth check - app niet geïnstalleerd | Android | ⏳ | Play Store link |
| Auth check - app geïnstalleerd | Android | ⏳ | "Open app" prompt |
| Zoeken | iOS | ⏳ | Resultaten tonen |
| Song afspelen | iOS | ⏳ | Muziek speelt, artwork toont |
| Shuffle toggle | iOS | ⏳ | Mode wisselt, icon update |
| Repeat toggle | iOS | ⏳ | Mode cycled: off → all → one |
| Queue bekijken | iOS | ⏳ | Queue zichtbaar in player |
| Favorite toggle | iOS | ⏳ | Voegt toe aan bibliotheek |
| Glass Player | iOS 26+ | ⏳ | Native player met alle controls |
| Module kleur | iOS | ⏳ | User-customizable via Instellingen |

---

## Bekende Beperkingen

1. **Android:** Geen directe playback control — alleen app detection + deep link
2. **Lyrics:** Niet geïmplementeerd in huidige versie (was in plan, niet in code)
3. **Recommendations:** Niet geïmplementeerd in huidige versie
4. **Genres:** Niet geïmplementeerd in huidige versie
5. **Offline:** Niet geïmplementeerd

---

## Volgende Stappen

1. **Valideer Android module** — Check of AppleMusicModule.kt bestaat en werkt
2. **Valideer Native Glass Player** — Check shuffle/repeat in FullPlayerNativeView.swift
3. **Valideer i18n** — Run completeness check voor alle 13 talen
4. **Valideer module registratie** — Check alle vereiste locaties
5. **Test op fysiek device** — MusicKit werkt niet in simulator

---

*Oorspronkelijk plan: 2026-02-22*
*Status update: 2026-02-23*
*Geschatte resterende effort: Klein (validatie + eventuele gaps)*
