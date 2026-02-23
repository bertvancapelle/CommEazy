# Apple Music Module — Implementatieplan

## Status: Gedeeltelijk Voltooid ⚠️

**Laatst bijgewerkt:** 2026-02-23

## Overzicht

Apple Music integratie voor CommEazy: muziek afspelen EN ontdekken met senior-inclusive UX.

**Platformondersteuning:**
- **iOS/iPadOS:** Volledige integratie via MusicKit framework
- **Android:** Detectie + prompt om Apple Music app te installeren

---

## Feature Matrix (Origineel Plan: 8 functies + 1 uitzondering)

| # | Functionaliteit | Native Module | React Native | Status |
|---|-----------------|---------------|--------------|--------|
| **1** | Authorization | ✅ checkAuthStatus, requestAuthorization, checkSubscription | ✅ | **VOLTOOID** |
| **2** | Search | ✅ searchCatalog, getTopCharts | ✅ SearchTab | **VOLTOOID** |
| **3** | Playback | ✅ playSong, playLibrarySong, playAlbum, playPlaylist, pause, resume, stop, skipToNext, skipToPrevious, seekTo | ✅ MiniPlayer, ExpandedPlayer | **VOLTOOID** |
| **4** | Shuffle/Repeat | ✅ setShuffleMode, getShuffleMode, setRepeatMode, getRepeatMode | ✅ Controls in player | **VOLTOOID** |
| **5** | Queue | ✅ getQueue, addToQueue | ⚠️ Geen QueueView UI | **GEDEELTELIJK** |
| **6** | Recommendations | ❌ getRecommendations ontbreekt | ❌ RecommendationsTab ontbreekt | **NIET GESTART** |
| **7** | Genres | ❌ getGenres, getGenreContent ontbreekt | ❌ GenresTab ontbreekt | **NIET GESTART** |
| **8** | Favorites/Library | ❌ getFavorites, addToLibrary ontbreekt | ❌ FavoritesTab ontbreekt | **NIET GESTART** |
| **9** | Lyrics *(uitzondering)* | ❌ getLyrics ontbreekt | ❌ LyricsView ontbreekt | **NIET GESTART** |

---

## Implementatie Status per Fase

| Fase | Beschrijving | Status | Opmerkingen |
|------|--------------|--------|-------------|
| **Fase 1** | iOS Foundation (MusicKit native module) | ⚠️ **GEDEELTELIJK** | Basis compleet, discovery APIs ontbreken |
| **Fase 2** | Android Stub (app detectie) | ⏳ **TE VALIDEREN** | Moet worden gecontroleerd |
| **Fase 3** | React Native Context & Hooks | ✅ **VOLTOOID** | AppleMusicContext.tsx |
| **Fase 4** | Discovery Screens | ⚠️ **GEDEELTELIJK** | Alleen Search, Library, Playlists — geen Recommendations/Genres/Favorites tabs |
| **Fase 5** | Player Extensions (RN) | ✅ **VOLTOOID** | Glass Player integratie |
| **Fase 6** | Native Feature Parity (iOS 26+) | ⏳ **TE VALIDEREN** | Shuffle/repeat in native player? |
| **Fase 7** | i18n (13 talen) | ⏳ **TE VALIDEREN** | Controleer completeness |

---

## Geïmplementeerde Bestanden

### iOS Native Layer

| Bestand | Regels | Status |
|---------|--------|--------|
| `ios/AppleMusicModule.swift` | ~980 | ⚠️ Basis compleet, discovery ontbreekt |
| `ios/AppleMusicModule.m` | ~130 | ✅ Bridge volledig |

**Geïmplementeerde functies:**
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
- ✅ Playback state events
- ✅ State debouncing

**Ontbrekende functies (nog te implementeren):**
- ❌ `getRecommendations()` — MusicPersonalRecommendationsRequest
- ❌ `getGenres()` — MusicCatalogGenresRequest
- ❌ `getGenreContent(genreId)` — Content per genre
- ❌ `getFavorites()` — MusicLibraryRequest voor favorieten
- ❌ `addToLibrary(songId)` — Toevoegen aan bibliotheek
- ❌ `getLyrics(songId)` — Gesynchroniseerde lyrics (Apple API beperking?)

### React Native Layer

| Bestand | Status |
|---------|--------|
| `src/contexts/AppleMusicContext.tsx` | ✅ Basis volledig |
| `src/screens/modules/AppleMusicScreen.tsx` | ⚠️ Alleen Search/Library/Playlists |

**Geïmplementeerd:**
- ✅ Native module bridge met event listeners
- ✅ Auth status management
- ✅ Playback state (playing, paused, loading)
- ✅ Search tab
- ✅ Library tab (bestaande bibliotheek)
- ✅ Playlists tab
- ✅ MiniPlayer integratie
- ✅ ExpandedAudioPlayer integratie
- ✅ Glass Player integratie
- ✅ Shuffle/repeat mode controls

**Ontbrekende UI componenten:**
- ❌ `RecommendationsTab.tsx` — "Voor jou" aanbevelingen
- ❌ `GenresTab.tsx` — Genres/Stemmingen browser
- ❌ `FavoritesTab.tsx` — Favorieten beheer
- ❌ `QueueView.tsx` — Queue weergave in expanded player
- ❌ `LyricsView.tsx` — Gesynchroniseerde lyrics weergave

---

## Nog Te Implementeren

### Prioriteit 1: Discovery Features (Fase 1 completeren)

**Native module toevoegingen (`AppleMusicModule.swift`):**

```swift
// 1. Recommendations
@objc func getRecommendations(_ resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
    Task {
        do {
            let request = MusicPersonalRecommendationsRequest()
            let response = try await request.response()
            let recommendations = response.recommendations.map { rec in
                [
                    "id": rec.id.rawValue,
                    "title": rec.title ?? "",
                    "items": rec.items.compactMap { item -> [String: Any]? in
                        // Map albums, playlists, stations
                    }
                ]
            }
            resolve(recommendations)
        } catch {
            reject("RECOMMENDATIONS_ERROR", error.localizedDescription, error)
        }
    }
}

// 2. Genres
@objc func getGenres(_ resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
    Task {
        do {
            var request = MusicCatalogResourceRequest<Genre>()
            request.limit = 50
            let response = try await request.response()
            let genres = response.items.map { genre in
                ["id": genre.id.rawValue, "name": genre.name]
            }
            resolve(genres)
        } catch {
            reject("GENRES_ERROR", error.localizedDescription, error)
        }
    }
}

// 3. Favorites/Library
@objc func getFavorites(_ resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
    Task {
        do {
            var request = MusicLibraryRequest<Song>()
            request.limit = 100
            let response = try await request.response()
            let songs = response.items.map { songToDictionary($0) }
            resolve(songs)
        } catch {
            reject("FAVORITES_ERROR", error.localizedDescription, error)
        }
    }
}

@objc func addToLibrary(_ songId: String,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
    Task {
        do {
            let request = MusicCatalogResourceRequest<Song>(matching: \.id, equalTo: MusicItemID(songId))
            let response = try await request.response()
            guard let song = response.items.first else {
                reject("NOT_FOUND", "Song not found", nil)
                return
            }
            try await MusicLibrary.shared.add(song)
            resolve(["success": true])
        } catch {
            reject("ADD_ERROR", error.localizedDescription, error)
        }
    }
}
```

### Prioriteit 2: React Native Discovery Tabs

**Bestanden te maken:**
```
src/screens/modules/appleMusic/
├── RecommendationsTab.tsx    ← "Voor jou" grid
├── GenresTab.tsx             ← Genre browser
├── FavoritesTab.tsx          ← Bibliotheek favorieten
├── QueueView.tsx             ← Queue in expanded player
└── LyricsView.tsx            ← Lyrics weergave (indien API beschikbaar)
```

### Prioriteit 3: Lyrics (uitzondering)

**Status:** Apple's Lyrics API is beperkt beschikbaar. Controleer of `song.lyrics` property toegankelijk is in huidige MusicKit versie.

---

## Nog Te Valideren

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

### 3. i18n Completeness (Fase 7)

**Status:** ⏳ Te valideren

**Controleer of `modules.appleMusic.*` keys aanwezig zijn in alle 13 locale bestanden.**

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

## Architectuur (Doel)

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Native Layer                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AppleMusicContext.tsx                                       ││
│  │  - Auth status                                               ││
│  │  - Playback state                                            ││
│  │  - Queue management                                          ││
│  │  - Recommendations cache                                     ││
│  │  - Favorites sync                                            ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AppleMusicScreen.tsx                                        ││
│  │  - Search tab ✅                                              ││
│  │  - Recommendations tab ❌                                     ││
│  │  - Genres tab ❌                                              ││
│  │  - Favorites tab ❌                                           ││
│  │  - Library tab ✅                                             ││
│  │  - Playlists tab ✅                                           ││
│  │  - QueueView ❌                                               ││
│  │  - LyricsView ❌                                              ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    Native iOS Layer (MusicKit)                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AppleMusicModule.swift                                      ││
│  │  - Authorization ✅                                          ││
│  │  - Search ✅                                                  ││
│  │  - Playback ✅                                                ││
│  │  - Shuffle/Repeat ✅                                          ││
│  │  - Queue ✅                                                   ││
│  │  - Recommendations ❌                                         ││
│  │  - Genres ❌                                                  ││
│  │  - Favorites/Library ❌                                       ││
│  │  - Lyrics ❌                                                  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Test Scenario's

| Test | Platform | Status | Opmerkingen |
|------|----------|--------|-------------|
| Auth check - niet ingelogd | iOS | ⏳ | Login prompt tonen |
| Auth check - geen subscription | iOS | ⏳ | Subscription melding |
| Zoeken | iOS | ⏳ | Resultaten tonen |
| Song afspelen | iOS | ⏳ | Muziek speelt, artwork toont |
| Shuffle toggle | iOS | ⏳ | Mode wisselt |
| Repeat toggle | iOS | ⏳ | Mode cycled |
| Recommendations laden | iOS | ❌ | Niet geïmplementeerd |
| Genres browsen | iOS | ❌ | Niet geïmplementeerd |
| Favoriet toevoegen | iOS | ❌ | Niet geïmplementeerd |
| Lyrics weergeven | iOS | ❌ | Niet geïmplementeerd |

---

## Volgende Stappen

1. **Besluit:** Wil je de ontbrekende discovery features (Recommendations, Genres, Favorites) implementeren voor v1.0?
2. **Indien ja:** Implementeer native module uitbreidingen eerst
3. **Valideer Android module** — Check of AppleMusicModule.kt bestaat
4. **Valideer Native Glass Player** — Check shuffle/repeat in FullPlayerNativeView.swift
5. **Valideer i18n** — Run completeness check
6. **Test op fysiek device** — MusicKit werkt niet in simulator

---

*Oorspronkelijk plan: 2026-02-22*
*Status update: 2026-02-23*
*Resterende effort: Medium (discovery features) + Klein (validatie)*
