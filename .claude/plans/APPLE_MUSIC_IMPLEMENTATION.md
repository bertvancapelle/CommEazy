# Apple Music Module — Implementatieplan

## Overzicht

Apple Music integratie voor CommEazy: muziek afspelen EN ontdekken met senior-inclusive UX.

**Platformondersteuning:**
- **iOS/iPadOS:** Volledige integratie via MusicKit framework
- **Android:** Detectie + prompt om Apple Music app te installeren

---

## Architectuur

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Native Layer                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AppleMusicContext.tsx                                       ││
│  │  - Auth status (logged in / not logged in / checking)        ││
│  │  - Playback state (playing/paused/loading)                   ││
│  │  - Queue management                                          ││
│  │  - Current track + lyrics                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AppleMusicScreen.tsx                                        ││
│  │  - Discovery tabs: Zoeken / Aanbevelingen / Genres / Favorieten││
│  │  - MiniPlayer / ExpandedPlayer (met shuffle/repeat/queue)    ││
│  │  - Gesynchroniseerde lyrics view                             ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    Native iOS Layer (MusicKit)                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AppleMusicModule.swift                                      ││
│  │  - MusicKit authorization                                    ││
│  │  - Catalog search (songs, albums, artists)                   ││
│  │  - Playback control (via ApplicationMusicPlayer)             ││
│  │  - Recommendations & genres                                  ││
│  │  - Lyrics API                                                ││
│  │  - Queue management                                          ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    Android Layer                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AppleMusicModule.java                                       ││
│  │  - Detecteert of Apple Music app geïnstalleerd is            ││
│  │  - Opent Play Store link indien niet geïnstalleerd           ││
│  │  - Retourneert altijd "not_available" voor playback          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Bestanden Structuur

```
src/
├── screens/
│   └── modules/
│       ├── AppleMusicScreen.tsx         ← Hoofdscherm
│       └── appleMusic/
│           ├── SearchTab.tsx             ← Zoeken tab
│           ├── RecommendationsTab.tsx    ← Aanbevelingen tab
│           ├── GenresTab.tsx             ← Genres/Stemmingen tab
│           ├── FavoritesTab.tsx          ← Favorieten tab
│           ├── QueueView.tsx             ← Queue in expanded player
│           └── LyricsView.tsx            ← Gesynchroniseerde lyrics
│
├── contexts/
│   └── AppleMusicContext.tsx            ← Global state provider
│
├── services/
│   └── appleMusic/
│       ├── index.ts                     ← Service exports
│       ├── types.ts                     ← TypeScript types
│       └── appleMusicService.ts         ← Bridge naar native module
│
├── components/
│   ├── MiniPlayer.tsx                   ← EXTEND met shuffle indicator
│   └── ExpandedAudioPlayer.tsx          ← EXTEND met shuffle/repeat/queue
│
└── locales/
    ├── nl.json                          ← +modules.appleMusic.*
    ├── en.json                          ← +modules.appleMusic.*
    └── ... (10 andere talen)

ios/
└── CommEazyTemp/
    ├── AppleMusicModule.swift           ← MusicKit bridge
    ├── AppleMusicModule.m               ← ObjC bridge header
    └── GlassPlayerWindow/
        ├── FullPlayerNativeView.swift   ← EXTEND met shuffle/repeat/queue
        └── MiniPlayerNativeView.swift   ← EXTEND met shuffle indicator

android/
└── app/src/main/java/com/commeazy/
    └── AppleMusicModule.java            ← App detection + Play Store link
```

---

## Fase 1: Fundament (iOS Native Module)

### 1.1 MusicKit Integratie

```swift
// AppleMusicModule.swift
import MusicKit
import React

@objc(AppleMusicModule)
class AppleMusicModule: RCTEventEmitter {

    private let player = ApplicationMusicPlayer.shared

    // ============================================================
    // Authorization
    // ============================================================

    @objc func checkAuthStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                                reject: @escaping RCTPromiseRejectBlock) {
        Task {
            let status = await MusicAuthorization.currentStatus
            switch status {
            case .authorized:
                // Check if user has Apple Music subscription
                do {
                    let subscription = try await MusicSubscription.current
                    if subscription.canPlayCatalogContent {
                        resolve(["status": "authorized", "canPlay": true])
                    } else {
                        resolve(["status": "authorized", "canPlay": false,
                                 "reason": "no_subscription"])
                    }
                } catch {
                    resolve(["status": "authorized", "canPlay": false,
                             "reason": "subscription_check_failed"])
                }
            case .notDetermined:
                resolve(["status": "not_determined"])
            case .denied, .restricted:
                resolve(["status": "denied"])
            @unknown default:
                resolve(["status": "unknown"])
            }
        }
    }

    @objc func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                                     reject: @escaping RCTPromiseRejectBlock) {
        Task {
            let status = await MusicAuthorization.request()
            resolve(["status": status == .authorized ? "authorized" : "denied"])
        }
    }

    // ============================================================
    // Search
    // ============================================================

    @objc func searchCatalog(_ query: String,
                              types: [String],
                              limit: Int,
                              resolve: @escaping RCTPromiseResolveBlock,
                              reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                var request = MusicCatalogSearchRequest(term: query, types: [Song.self, Album.self, Artist.self])
                request.limit = limit
                let response = try await request.response()

                let results: [String: Any] = [
                    "songs": response.songs.map { songToDict($0) },
                    "albums": response.albums.map { albumToDict($0) },
                    "artists": response.artists.map { artistToDict($0) }
                ]
                resolve(results)
            } catch {
                reject("SEARCH_ERROR", error.localizedDescription, error)
            }
        }
    }

    // ============================================================
    // Playback
    // ============================================================

    @objc func playSong(_ songId: String,
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
                player.queue = [song]
                try await player.play()
                resolve(["success": true])
            } catch {
                reject("PLAY_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc func pause(_ resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
        player.pause()
        resolve(["success": true])
    }

    @objc func resume(_ resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                try await player.play()
                resolve(["success": true])
            } catch {
                reject("RESUME_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc func skipToNext(_ resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                try await player.skipToNextEntry()
                resolve(["success": true])
            } catch {
                reject("SKIP_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc func skipToPrevious(_ resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                try await player.skipToPreviousEntry()
                resolve(["success": true])
            } catch {
                reject("SKIP_ERROR", error.localizedDescription, error)
            }
        }
    }

    // ============================================================
    // Shuffle & Repeat
    // ============================================================

    @objc func setShuffleMode(_ mode: String,
                               resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
        switch mode {
        case "off":
            player.state.shuffleMode = .off
        case "songs":
            player.state.shuffleMode = .songs
        default:
            player.state.shuffleMode = .off
        }
        resolve(["shuffleMode": mode])
    }

    @objc func setRepeatMode(_ mode: String,
                              resolve: @escaping RCTPromiseResolveBlock,
                              reject: @escaping RCTPromiseRejectBlock) {
        switch mode {
        case "off":
            player.state.repeatMode = .none
        case "one":
            player.state.repeatMode = .one
        case "all":
            player.state.repeatMode = .all
        default:
            player.state.repeatMode = .none
        }
        resolve(["repeatMode": mode])
    }

    // ============================================================
    // Queue
    // ============================================================

    @objc func getQueue(_ resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        let queue = player.queue.entries.compactMap { entry -> [String: Any]? in
            guard let song = entry.item as? Song else { return nil }
            return songToDict(song)
        }
        resolve(["queue": queue, "currentIndex": player.queue.currentEntry?.index ?? 0])
    }

    @objc func playAtIndex(_ index: Int,
                            resolve: @escaping RCTPromiseResolveBlock,
                            reject: @escaping RCTPromiseRejectBlock) {
        // Jump to specific queue position
        // Note: MusicKit doesn't have direct index jumping, need workaround
        resolve(["success": true])
    }

    // ============================================================
    // Lyrics
    // ============================================================

    @objc func getLyrics(_ songId: String,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let request = MusicCatalogResourceRequest<Song>(matching: \.id, equalTo: MusicItemID(songId))
                var response = try await request.response()

                // Fetch lyrics with the song
                guard var song = response.items.first else {
                    reject("NOT_FOUND", "Song not found", nil)
                    return
                }

                // Request lyrics relationship
                song = try await song.with([.lyrics])

                if let lyrics = song.lyrics {
                    // Parse timed lyrics
                    let lines = lyrics.lines.map { line -> [String: Any] in
                        return [
                            "text": line.content,
                            "startTime": line.startTime ?? 0,
                            "endTime": line.endTime ?? 0
                        ]
                    }
                    resolve(["hasLyrics": true, "lines": lines])
                } else {
                    resolve(["hasLyrics": false, "lines": []])
                }
            } catch {
                reject("LYRICS_ERROR", error.localizedDescription, error)
            }
        }
    }

    // ============================================================
    // Recommendations & Genres
    // ============================================================

    @objc func getRecommendations(_ resolve: @escaping RCTPromiseResolveBlock,
                                   reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let request = MusicPersonalRecommendationsRequest()
                let response = try await request.response()

                let recommendations = response.recommendations.map { recommendation -> [String: Any] in
                    return [
                        "id": recommendation.id.rawValue,
                        "title": recommendation.title ?? "",
                        "items": recommendation.items.compactMap { item -> [String: Any]? in
                            if let song = item as? Song {
                                return songToDict(song)
                            } else if let album = item as? Album {
                                return albumToDict(album)
                            }
                            return nil
                        }
                    ]
                }
                resolve(["recommendations": recommendations])
            } catch {
                reject("RECOMMENDATIONS_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc func getGenres(_ resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let request = MusicCatalogResourceRequest<Genre>()
                let response = try await request.response()

                let genres = response.items.map { genre -> [String: Any] in
                    return [
                        "id": genre.id.rawValue,
                        "name": genre.name
                    ]
                }
                resolve(["genres": genres])
            } catch {
                reject("GENRES_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc func getGenreContent(_ genreId: String,
                                resolve: @escaping RCTPromiseResolveBlock,
                                reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Search for songs in this genre
                var request = MusicCatalogSearchRequest(term: "", types: [Song.self])
                // Note: Genre filtering requires different approach in MusicKit
                let response = try await request.response()
                resolve(["songs": response.songs.prefix(50).map { songToDict($0) }])
            } catch {
                reject("GENRE_CONTENT_ERROR", error.localizedDescription, error)
            }
        }
    }

    // ============================================================
    // Favorites (Library)
    // ============================================================

    @objc func getFavorites(_ resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let request = MusicLibraryRequest<Song>()
                let response = try await request.response()

                let songs = response.items.prefix(100).map { songToDict($0) }
                resolve(["favorites": songs])
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

    // ============================================================
    // Helpers
    // ============================================================

    private func songToDict(_ song: Song) -> [String: Any] {
        return [
            "id": song.id.rawValue,
            "title": song.title,
            "artistName": song.artistName,
            "albumTitle": song.albumTitle ?? "",
            "artwork": song.artwork?.url(width: 300, height: 300)?.absoluteString ?? "",
            "duration": song.duration ?? 0
        ]
    }

    private func albumToDict(_ album: Album) -> [String: Any] {
        return [
            "id": album.id.rawValue,
            "title": album.title,
            "artistName": album.artistName,
            "artwork": album.artwork?.url(width: 300, height: 300)?.absoluteString ?? ""
        ]
    }

    private func artistToDict(_ artist: Artist) -> [String: Any] {
        return [
            "id": artist.id.rawValue,
            "name": artist.name,
            "artwork": artist.artwork?.url(width: 300, height: 300)?.absoluteString ?? ""
        ]
    }

    // ============================================================
    // Event Emitter Setup
    // ============================================================

    override func supportedEvents() -> [String]! {
        return [
            "onPlaybackStateChanged",
            "onNowPlayingChanged",
            "onQueueChanged"
        ]
    }

    override static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
```

### 1.2 Info.plist Configuratie

```xml
<!-- Info.plist -->
<key>NSAppleMusicUsageDescription</key>
<string>CommEazy gebruikt Apple Music om je favoriete muziek af te spelen</string>

<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

### 1.3 Entitlements

```xml
<!-- CommEazyTemp.entitlements -->
<key>com.apple.developer.music-kit</key>
<true/>
```

---

## Fase 2: Android Module (App Detection)

```java
// AppleMusicModule.java
package com.commeazy;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

public class AppleMusicModule extends ReactContextBaseJavaModule {

    private static final String APPLE_MUSIC_PACKAGE = "com.apple.android.music";
    private static final String PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.apple.android.music";

    public AppleMusicModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "AppleMusicModule";
    }

    @ReactMethod
    public void checkAuthStatus(Promise promise) {
        boolean isInstalled = isAppleMusicInstalled();

        WritableMap result = Arguments.createMap();
        if (isInstalled) {
            // App is installed, but we can't control playback from here
            result.putString("status", "app_installed");
            result.putBoolean("canPlay", false);
            result.putString("reason", "external_app_required");
        } else {
            result.putString("status", "app_not_installed");
            result.putBoolean("canPlay", false);
            result.putString("reason", "app_not_installed");
        }
        promise.resolve(result);
    }

    @ReactMethod
    public void openPlayStore(Promise promise) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(PLAY_STORE_URL));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("PLAY_STORE_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void openAppleMusicApp(Promise promise) {
        try {
            Intent intent = getReactApplicationContext()
                .getPackageManager()
                .getLaunchIntentForPackage(APPLE_MUSIC_PACKAGE);

            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getReactApplicationContext().startActivity(intent);
                promise.resolve(true);
            } else {
                promise.reject("APP_NOT_FOUND", "Apple Music app not installed");
            }
        } catch (Exception e) {
            promise.reject("OPEN_ERROR", e.getMessage());
        }
    }

    private boolean isAppleMusicInstalled() {
        try {
            getReactApplicationContext()
                .getPackageManager()
                .getPackageInfo(APPLE_MUSIC_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    // Stub methods that return "not available" for all playback operations
    @ReactMethod
    public void playSong(String songId, Promise promise) {
        promise.reject("NOT_AVAILABLE", "Apple Music playback requires iOS");
    }

    @ReactMethod
    public void searchCatalog(String query, ReadableArray types, int limit, Promise promise) {
        promise.reject("NOT_AVAILABLE", "Apple Music search requires iOS");
    }

    // ... other stub methods
}
```

---

## Fase 3: React Native Layer

### 3.1 AppleMusicContext.tsx

```typescript
// src/contexts/AppleMusicContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';

const { AppleMusicModule } = NativeModules;

// ============================================================
// Types
// ============================================================

export type AuthStatus =
  | 'checking'
  | 'authorized'
  | 'not_logged_in'
  | 'no_subscription'
  | 'denied'
  | 'app_not_installed'  // Android only
  | 'not_available';     // Android (can't play from RN)

export type ShuffleMode = 'off' | 'songs';
export type RepeatMode = 'off' | 'one' | 'all';

export interface Song {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string;
  artwork: string | null;
  duration: number;
}

export interface LyricLine {
  text: string;
  startTime: number;
  endTime: number;
}

export interface AppleMusicContextValue {
  // Auth
  authStatus: AuthStatus;
  checkAuth: () => Promise<void>;
  requestAuth: () => Promise<void>;
  openPlayStore: () => Promise<void>;  // Android only

  // Playback
  isPlaying: boolean;
  isLoading: boolean;
  currentTrack: Song | null;
  position: number;
  duration: number;

  // Controls
  playSong: (songId: string) => Promise<void>;
  playAlbum: (albumId: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;

  // Shuffle & Repeat
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
  setShuffleMode: (mode: ShuffleMode) => Promise<void>;
  setRepeatMode: (mode: RepeatMode) => Promise<void>;

  // Queue
  queue: Song[];
  currentQueueIndex: number;
  playAtIndex: (index: number) => Promise<void>;

  // Lyrics
  lyrics: LyricLine[];
  hasLyrics: boolean;
  currentLyricIndex: number;

  // Discovery
  search: (query: string) => Promise<SearchResults>;
  getRecommendations: () => Promise<Recommendation[]>;
  getGenres: () => Promise<Genre[]>;
  getGenreContent: (genreId: string) => Promise<Song[]>;

  // Favorites
  favorites: Song[];
  addToLibrary: (songId: string) => Promise<void>;
  removeFromLibrary: (songId: string) => Promise<void>;
  refreshFavorites: () => Promise<void>;
}

// ... Implementation follows CommEazy patterns
```

### 3.2 AppleMusicScreen.tsx

```typescript
// src/screens/modules/AppleMusicScreen.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModuleHeader, MiniPlayer, ExpandedAudioPlayer, SearchBar } from '@/components';
import { FavoriteTabButton, SearchTabButton } from '@/components';
import { useAppleMusicContext } from '@/contexts/AppleMusicContext';
import { useAccentColor } from '@/contexts/AccentColorContext';
import useGlassPlayer from '@/hooks/useGlassPlayer';

// Module color (consistent met WheelNavigationMenu)
const APPLE_MUSIC_COLOR = '#FC3C44';  // Apple Music rood

// Tabs
import SearchTab from './appleMusic/SearchTab';
import RecommendationsTab from './appleMusic/RecommendationsTab';
import GenresTab from './appleMusic/GenresTab';
import FavoritesTab from './appleMusic/FavoritesTab';

export function AppleMusicScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColor();

  const {
    authStatus,
    checkAuth,
    requestAuth,
    openPlayStore,
    isPlaying,
    isLoading,
    currentTrack,
    // ... other context values
  } = useAppleMusicContext();

  const [activeTab, setActiveTab] = useState<'search' | 'recommendations' | 'genres' | 'favorites'>('search');
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);

  // ============================================================
  // Auth Check on Mount
  // ============================================================

  useEffect(() => {
    checkAuth();
  }, []);

  // ============================================================
  // Not Logged In / Not Installed States
  // ============================================================

  if (authStatus === 'checking') {
    return <LoadingState />;
  }

  if (authStatus === 'app_not_installed') {
    // Android: Show install prompt
    return (
      <AndroidInstallPrompt onInstall={openPlayStore} />
    );
  }

  if (authStatus === 'not_logged_in' || authStatus === 'denied') {
    // iOS: Show login prompt
    return (
      <iOSLoginPrompt onRequestAuth={requestAuth} />
    );
  }

  if (authStatus === 'no_subscription') {
    return (
      <NoSubscriptionMessage />
    );
  }

  if (authStatus === 'not_available') {
    // Android: App installed but can't control from here
    return (
      <AndroidOpenAppPrompt />
    );
  }

  // ============================================================
  // Main Content (Authorized)
  // ============================================================

  return (
    <View style={styles.container}>
      <ModuleHeader
        moduleId="appleMusic"
        icon="music"
        title={t('modules.appleMusic.title')}
        currentSource="appleMusic"
        showAdMob={true}
      />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TabButton
          label={t('modules.appleMusic.tabs.search')}
          isActive={activeTab === 'search'}
          onPress={() => setActiveTab('search')}
        />
        <TabButton
          label={t('modules.appleMusic.tabs.recommendations')}
          isActive={activeTab === 'recommendations'}
          onPress={() => setActiveTab('recommendations')}
        />
        <TabButton
          label={t('modules.appleMusic.tabs.genres')}
          isActive={activeTab === 'genres'}
          onPress={() => setActiveTab('genres')}
        />
        <TabButton
          label={t('modules.appleMusic.tabs.favorites')}
          isActive={activeTab === 'favorites'}
          onPress={() => setActiveTab('favorites')}
        />
      </View>

      {/* Tab Content */}
      {activeTab === 'search' && <SearchTab />}
      {activeTab === 'recommendations' && <RecommendationsTab />}
      {activeTab === 'genres' && <GenresTab />}
      {activeTab === 'favorites' && <FavoritesTab />}

      {/* Mini Player */}
      {currentTrack && !isPlayerExpanded && (
        <MiniPlayer
          moduleId="appleMusic"
          artwork={currentTrack.artwork}
          title={currentTrack.title}
          subtitle={currentTrack.artistName}
          accentColor={APPLE_MUSIC_COLOR}
          isPlaying={isPlaying}
          isLoading={isLoading}
          progressType="bar"
          progress={position / duration}
          onPress={() => setIsPlayerExpanded(true)}
          onPlayPause={isPlaying ? pause : resume}
          // Music-specific: shuffle indicator
          showShuffleIndicator={shuffleMode === 'songs'}
        />
      )}

      {/* Expanded Player with Queue & Lyrics */}
      <ExpandedAudioPlayer
        visible={isPlayerExpanded}
        artwork={currentTrack?.artwork}
        title={currentTrack?.title}
        subtitle={currentTrack?.artistName}
        accentColor={APPLE_MUSIC_COLOR}
        isPlaying={isPlaying}
        isLoading={isLoading}
        position={position}
        duration={duration}
        onSeek={seekTo}
        onPlayPause={isPlaying ? pause : resume}
        onClose={() => setIsPlayerExpanded(false)}

        // Music-specific controls (ALLEEN in Apple Music module)
        controls={{
          seekSlider: true,
          skipButtons: true,
          shuffle: true,          // ← NEW
          repeat: true,           // ← NEW
          queue: true,            // ← NEW
          lyrics: true,           // ← NEW
          sleepTimer: true,
          favorite: true,
        }}

        // Music-specific callbacks
        onSkipBackward={skipToPrevious}
        onSkipForward={skipToNext}
        shuffleMode={shuffleMode}
        onShuffleModeChange={setShuffleMode}
        repeatMode={repeatMode}
        onRepeatModeChange={setRepeatMode}
        queue={queue}
        currentQueueIndex={currentQueueIndex}
        onQueueItemPress={playAtIndex}
        lyrics={lyrics}
        currentLyricIndex={currentLyricIndex}
        hasLyrics={hasLyrics}

        isFavorite={favorites.some(f => f.id === currentTrack?.id)}
        onFavoriteToggle={() => currentTrack && toggleFavorite(currentTrack.id)}
      />
    </View>
  );
}
```

---

## Fase 4: Player Component Extensions

### 4.1 ExpandedAudioPlayer — Nieuwe Props

```typescript
// Toevoegen aan ExpandedAudioPlayerProps interface

interface ExpandedAudioPlayerProps {
  // ... existing props ...

  // Music-specific controls (ALLEEN tonen als true)
  controls: {
    // ... existing ...
    shuffle?: boolean;
    repeat?: boolean;
    queue?: boolean;
    lyrics?: boolean;
  };

  // Shuffle & Repeat
  shuffleMode?: 'off' | 'songs';
  onShuffleModeChange?: (mode: 'off' | 'songs') => void;
  repeatMode?: 'off' | 'one' | 'all';
  onRepeatModeChange?: (mode: 'off' | 'one' | 'all') => void;

  // Queue
  queue?: Array<{ id: string; title: string; artistName: string; artwork: string | null }>;
  currentQueueIndex?: number;
  onQueueItemPress?: (index: number) => void;

  // Lyrics
  lyrics?: Array<{ text: string; startTime: number; endTime: number }>;
  currentLyricIndex?: number;
  hasLyrics?: boolean;
}
```

### 4.2 Feature Parity — Native Swift Extensions

**KRITIEK:** Volgens `COORDINATION_PROTOCOL.md` MOETEN deze features ook in native player.

```swift
// FullPlayerNativeView.swift — Toevoegingen

// Shuffle button
private lazy var shuffleButton: UIButton = {
    let button = UIButton(type: .system)
    button.setImage(UIImage(systemName: "shuffle"), for: .normal)
    button.tintColor = .white
    button.addTarget(self, action: #selector(shuffleTapped), for: .touchUpInside)
    return button
}()

// Repeat button
private lazy var repeatButton: UIButton = {
    let button = UIButton(type: .system)
    button.setImage(UIImage(systemName: "repeat"), for: .normal)
    button.tintColor = .white
    button.addTarget(self, action: #selector(repeatTapped), for: .touchUpInside)
    return button
}()

// Queue button (opens queue sheet)
private lazy var queueButton: UIButton = {
    let button = UIButton(type: .system)
    button.setImage(UIImage(systemName: "list.bullet"), for: .normal)
    button.tintColor = .white
    button.addTarget(self, action: #selector(queueTapped), for: .touchUpInside)
    return button
}()

// Lyrics button (opens lyrics view)
private lazy var lyricsButton: UIButton = {
    let button = UIButton(type: .system)
    button.setImage(UIImage(systemName: "text.quote"), for: .normal)
    button.tintColor = .white
    button.addTarget(self, action: #selector(lyricsTapped), for: .touchUpInside)
    return button
}()

// State
private var shuffleMode: String = "off"
private var repeatMode: String = "off"
private var showMusicControls: Bool = false  // Only show for Apple Music

func updateMusicControls(_ state: NSDictionary) {
    showMusicControls = state["showMusicControls"] as? Bool ?? false
    shuffleMode = state["shuffleMode"] as? String ?? "off"
    repeatMode = state["repeatMode"] as? String ?? "off"

    shuffleButton.isHidden = !showMusicControls
    repeatButton.isHidden = !showMusicControls
    queueButton.isHidden = !showMusicControls
    lyricsButton.isHidden = !showMusicControls

    // Update button states
    shuffleButton.tintColor = shuffleMode == "songs" ? tintColor : .white.withAlphaComponent(0.5)

    switch repeatMode {
    case "one":
        repeatButton.setImage(UIImage(systemName: "repeat.1"), for: .normal)
        repeatButton.tintColor = tintColor
    case "all":
        repeatButton.setImage(UIImage(systemName: "repeat"), for: .normal)
        repeatButton.tintColor = tintColor
    default:
        repeatButton.setImage(UIImage(systemName: "repeat"), for: .normal)
        repeatButton.tintColor = .white.withAlphaComponent(0.5)
    }
}
```

---

## Fase 5: i18n Strings

```json
// src/locales/nl.json
{
  "modules": {
    "appleMusic": {
      "title": "Apple Music",
      "tabs": {
        "search": "Zoeken",
        "recommendations": "Voor jou",
        "genres": "Genres",
        "favorites": "Bibliotheek"
      },
      "search": {
        "placeholder": "Zoek nummers, albums, artiesten...",
        "noResults": "Geen resultaten gevonden"
      },
      "auth": {
        "notLoggedIn": "Je bent niet ingelogd in Apple Music",
        "loginPrompt": "Log in via Instellingen > Apple Music om muziek af te spelen",
        "noSubscription": "Je hebt geen Apple Music abonnement",
        "subscriptionPrompt": "Een Apple Music abonnement is vereist om muziek af te spelen"
      },
      "android": {
        "notInstalled": "Apple Music app niet geïnstalleerd",
        "installPrompt": "Installeer de Apple Music app om deze functie te gebruiken",
        "installButton": "Installeren",
        "openApp": "Open Apple Music app"
      },
      "player": {
        "shuffle": "Shuffle",
        "shuffleOn": "Shuffle aan",
        "shuffleOff": "Shuffle uit",
        "repeat": "Herhalen",
        "repeatOff": "Niet herhalen",
        "repeatOne": "Dit nummer herhalen",
        "repeatAll": "Alles herhalen",
        "queue": "Wachtrij",
        "lyrics": "Songtekst",
        "noLyrics": "Geen songtekst beschikbaar"
      },
      "recommendations": {
        "title": "Aanbevolen voor jou",
        "loading": "Aanbevelingen laden...",
        "empty": "Geen aanbevelingen beschikbaar"
      },
      "genres": {
        "title": "Genres & Stemmingen",
        "loading": "Genres laden..."
      },
      "favorites": {
        "title": "Jouw bibliotheek",
        "empty": "Je bibliotheek is leeg",
        "addHint": "Voeg nummers toe door op ❤️ te tikken"
      }
    }
  }
}
```

---

## Implementatie Volgorde

### Fase 1: iOS Foundation ✅
1. [ ] AppleMusicModule.swift — MusicKit bridge
2. [ ] AppleMusicModule.m — ObjC bridge header
3. [ ] Info.plist — NSAppleMusicUsageDescription
4. [ ] Entitlements — com.apple.developer.music-kit
5. [ ] Test: Auth flow werkt

### Fase 2: Android Stub ✅
1. [ ] AppleMusicModule.java — App detection
2. [ ] Play Store link
3. [ ] Test: Install prompt toont correct

### Fase 3: React Native Context ✅
1. [ ] types.ts — TypeScript types
2. [ ] appleMusicService.ts — Native bridge wrapper
3. [ ] AppleMusicContext.tsx — Global state
4. [ ] Test: Context mount/unmount

### Fase 4: Discovery Screens ✅
1. [ ] AppleMusicScreen.tsx — Main screen met tabs
2. [ ] SearchTab.tsx — Zoeken
3. [ ] RecommendationsTab.tsx — Aanbevelingen
4. [ ] GenresTab.tsx — Genres
5. [ ] FavoritesTab.tsx — Bibliotheek
6. [ ] Test: Alle tabs tonen content

### Fase 5: Player Extensions ✅
1. [ ] MiniPlayer.tsx — shuffleIndicator prop
2. [ ] ExpandedAudioPlayer.tsx — shuffle/repeat/queue/lyrics
3. [ ] QueueView.tsx — Queue weergave
4. [ ] LyricsView.tsx — Gesynchroniseerde lyrics
5. [ ] Test: Player controls werken

### Fase 6: Native Feature Parity ✅
1. [ ] MiniPlayerNativeView.swift — shuffle indicator
2. [ ] FullPlayerNativeView.swift — shuffle/repeat/queue/lyrics
3. [ ] GlassPlayerWindowModule.swift — nieuwe events
4. [ ] Test: iOS 26+ native player matcht RN player

### Fase 7: i18n & Polish ✅
1. [ ] nl.json — Nederlandse strings
2. [ ] en.json — Engelse strings
3. [ ] ... (10 andere talen)
4. [ ] VoiceOver/accessibility audit
5. [ ] Test: Alle talen compleet

---

## Test Scenario's

| Test | Platform | Verwacht Resultaat |
|------|----------|-------------------|
| Auth check - niet ingelogd | iOS | Login prompt tonen |
| Auth check - geen subscription | iOS | Subscription melding |
| Auth check - app niet geïnstalleerd | Android | Play Store link |
| Auth check - app geïnstalleerd | Android | "Open app" prompt |
| Zoeken | iOS | Resultaten tonen |
| Song afspelen | iOS | Muziek speelt, artwork toont |
| Shuffle toggle | iOS | Mode wisselt, icon update |
| Repeat toggle | iOS | Mode cycled: off → all → one |
| Queue bekijken | iOS | Swipe-up toont queue |
| Queue item tap | iOS | Speelt geselecteerd nummer |
| Lyrics sync | iOS | Tekst scrollt mee met muziek |
| Favorite toggle | iOS | Voegt toe aan bibliotheek |
| Glass Player | iOS 26+ | Native player met alle controls |

---

## Privacy & Compliance

### Privacy Manifest Update

```xml
<!-- PrivacyInfo.xcprivacy -->
<dict>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <!-- Existing... -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeAudioData</string>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
    </dict>
  </array>
</dict>
```

### App Store Connect

- **Privacy Nutrition Label:** Audio Data (Not Linked to You)
- **MusicKit entitlement:** Vereist voor Apple Music playback
- **Encryption:** Geen extra declaratie nodig (MusicKit handled dit)

---

## Bekende Beperkingen

1. **Android:** Geen directe playback control — alleen app detection + deep link
2. **Lyrics:** Niet alle nummers hebben gesynchroniseerde lyrics
3. **Recommendations:** Vereist dat gebruiker enige luistergeschiedenis heeft
4. **Offline:** Niet geïmplementeerd in V1 (mogelijk toekomst)

---

## Volgende Stappen na Goedkeuring

1. **Gebruiker goedkeuring** van dit plan
2. **Fase 1 starten:** iOS MusicKit module implementeren
3. **Test op fysiek device** (MusicKit werkt niet in simulator)
4. **Iteratief** de andere fasen implementeren

---

*Plan opgesteld: 2026-02-22*
*Geschatte effort: Medium-Large (MusicKit integratie + dual-platform + player extensions)*
