/**
 * AppleMusicModule — Native iOS MusicKit Integration for React Native
 *
 * Provides full Apple Music integration for CommEazy using MusicKit framework.
 * Features: catalog search, playback control, shuffle/repeat modes, queue, lyrics.
 *
 * ARCHITECTURE:
 * - MusicKit framework for Apple Music API access
 * - ApplicationMusicPlayer for playback control
 * - MusicAuthorization for permission handling
 * - RCTEventEmitter for real-time playback state updates
 *
 * @see .claude/plans/APPLE_MUSIC_IMPLEMENTATION.md
 * @see .claude/CLAUDE.md section 16 - Feature Parity requirement
 */

import UIKit
import React
import MusicKit
import MediaPlayer  // For MPMediaLibrary change notifications

// ============================================================
// MARK: - AppleMusicModule (RCT Bridge Module)
// ============================================================

@objc(AppleMusicModule)
class AppleMusicModule: RCTEventEmitter, @unchecked Sendable {

    // MusicKit player instance
    private let player = ApplicationMusicPlayer.shared

    // Playback state observation task
    private var playbackStateTask: Task<Void, Never>?

    // Queue observation task
    private var queueObservationTask: Task<Void, Never>?

    // Periodic time update timer (for progress slider)
    private var timeUpdateTimer: Timer?

    // Track current entry ID to detect changes
    private var currentEntryId: String?

    // Track if we have listeners registered
    private var hasListeners = false
    
    // MARK: - State Debouncing (prevents UI flicker)
    // Track last emitted playback status to avoid duplicate events
    private var lastEmittedStatus: String?
    // Timestamp of last state event to rate-limit emissions
    private var lastStateEventTime: CFAbsoluteTime = 0
    // Minimum interval between observer-emitted playback state events.
    // The timer handles periodic position updates at 1s intervals,
    // so the observer only needs to fire promptly for status changes (play/pause/stop).
    // A 500ms debounce prevents redundant bridge events while keeping status transitions responsive.
    private let minStateEventInterval: CFAbsoluteTime = 0.5
    
    // MARK: - Library Change Debouncing (batches rapid changes)
    // When a playlist with 20 songs is added, observer fires 20+ times rapidly.
    // 2-second debounce ensures we emit only ONE event to React Native.
    private var libraryChangeDebounceTimer: DispatchWorkItem?
    private let libraryChangeDebounceInterval: TimeInterval = 2.0
    
    // ============================================================
    // MARK: - Library Cache (for large libraries like 23K+ songs)
    // ============================================================
    
    /// Cache structure for library counts
    /// Avoids loading 23K+ songs into memory on every tab open
    private struct LibraryCache {
        var counts: [String: Int]?      // { songs: 23000, albums: 4800, ... }
        var lastModified: Date?         // MPMediaLibrary.lastModifiedDate
        var isValid: Bool = false       // Cache validity flag
        var isRefreshing: Bool = false  // Prevent concurrent refreshes
    }
    
    /// In-memory library cache
    private var libraryCache = LibraryCache()
    
    /// In-memory cache for library songs (avoids reloading 23K songs on every access)
    /// Key: "songs", "albums", etc. Value: Array of dictionaries ready for React Native
    private var librarySongsCache: [[String: Any]]?
    private var libraryAlbumsCache: [[String: Any]]?
    private var libraryCacheTimestamp: Date?
    
    /// Thread-safe access to cache
    private let cacheQueue = DispatchQueue(label: "com.commeazy.appleMusicCache", qos: .userInitiated)
    
    /// UserDefaults key for cached library modification date
    private let cacheModifiedDateKey = "AppleMusicLibraryCacheDate"

    // ============================================================
    // MARK: - RCTEventEmitter Setup
    // ============================================================

    override init() {
        super.init()
        setupPlaybackStateObserver()
        setupQueueObserver()
        setupLibraryObservers()
        
        // Check for library changes on init (app start)
        checkLibraryVersionOnStartup()
    }

    deinit {
        playbackStateTask?.cancel()
        queueObservationTask?.cancel()
        stopTimeUpdateTimer()
        
        // Cancel pending library change debounce
        libraryChangeDebounceTimer?.cancel()
        
        // Stop library notifications
        MPMediaLibrary.default().endGeneratingLibraryChangeNotifications()
        NotificationCenter.default.removeObserver(self)
    }
    
    // ============================================================
    // MARK: - Library Cache Observers
    // ============================================================
    
    /// Setup observers for library changes and app lifecycle
    private func setupLibraryObservers() {
        // Start receiving library change notifications from MediaPlayer framework
        MPMediaLibrary.default().beginGeneratingLibraryChangeNotifications()
        
        // Listen for library changes (user adds/removes songs in Apple Music app)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(libraryDidChange),
            name: .MPMediaLibraryDidChange,
            object: nil
        )
        
        // Listen for app coming to foreground
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
        
        // Listen for app going to background (save cache state)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
    }
    
    /// Called when library changes are detected (realtime from Apple Music app)
    /// Uses 2-second debounce to batch rapid changes (e.g., adding a playlist with 20 songs)
    @objc private func libraryDidChange(_ notification: Notification) {
        NSLog("[AppleMusicModule] Library change detected via MPMediaLibraryDidChange (debouncing...)")
        
        // Cancel any pending debounce timer
        libraryChangeDebounceTimer?.cancel()
        
        // Schedule new debounced handler
        let workItem = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            NSLog("[AppleMusicModule] Library change debounce fired — fetching fresh counts")
            
            // Invalidate native cache so next getLibrarySongs/Albums returns fresh data
            self.invalidateCache()
            
            // Fetch fresh counts to send with the event
            // React Native uses these to determine if items were added or removed
            Task { [weak self] in
                guard let self = self else { return }
                
                do {
                    let startTime = CFAbsoluteTimeGetCurrent()
                    
                    async let songsRequest = MusicLibraryRequest<Song>().response()
                    async let albumsRequest = MusicLibraryRequest<Album>().response()
                    async let artistsRequest = MusicLibraryRequest<Artist>().response()
                    async let playlistsRequest = MusicLibraryRequest<Playlist>().response()
                    
                    let (songs, albums, artists, playlists) = try await (songsRequest, albumsRequest, artistsRequest, playlistsRequest)
                    
                    let counts: [String: Int] = [
                        "songs": songs.items.count,
                        "albums": albums.items.count,
                        "artists": artists.items.count,
                        "playlists": playlists.items.count
                    ]
                    
                    let duration = CFAbsoluteTimeGetCurrent() - startTime
                    NSLog("[AppleMusicModule] Library change counts fetched in \(String(format: "%.2f", duration))s: \(counts)")
                    
                    // Update cache with fresh counts
                    self.cacheQueue.async { [weak self] in
                        guard let self = self else { return }
                        self.libraryCache.counts = counts
                        self.libraryCache.lastModified = MPMediaLibrary.default().lastModifiedDate
                        self.libraryCache.isValid = true
                        UserDefaults.standard.set(self.libraryCache.lastModified, forKey: self.cacheModifiedDateKey)
                    }
                    
                    // Emit event to React Native with fresh counts
                    if self.hasListeners {
                        self.sendEvent(withName: "AppleMusicLibraryDidChange", body: [
                            "counts": counts
                        ])
                    }
                } catch {
                    NSLog("[AppleMusicModule] Library change count fetch failed: \(error.localizedDescription)")
                    // Still emit event without counts so React Native can do a full refresh
                    if self.hasListeners {
                        self.sendEvent(withName: "AppleMusicLibraryDidChange", body: nil)
                    }
                }
            }
        }
        
        libraryChangeDebounceTimer = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + libraryChangeDebounceInterval, execute: workItem)
    }
    
    /// Called when app comes to foreground
    @objc private func appWillEnterForeground(_ notification: Notification) {
        NSLog("[AppleMusicModule] App entering foreground, checking library version")
        checkAndRefreshIfNeeded()
    }
    
    /// Called when app goes to background
    @objc private func appDidEnterBackground(_ notification: Notification) {
        // Save current cache state to UserDefaults
        if let lastModified = libraryCache.lastModified {
            UserDefaults.standard.set(lastModified, forKey: cacheModifiedDateKey)
            NSLog("[AppleMusicModule] Saved cache date to UserDefaults: \(lastModified)")
        }
    }
    
    /// Check library version on app startup (cold start)
    private func checkLibraryVersionOnStartup() {
        // Delay slightly to not block init
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.checkAndRefreshIfNeeded()
        }
    }
    
    /// Compare MPMediaLibrary.lastModifiedDate with cached date
    /// Triggers background refresh if library has changed
    private func checkAndRefreshIfNeeded() {
        let currentModified = MPMediaLibrary.default().lastModifiedDate
        let cachedModified = UserDefaults.standard.object(forKey: cacheModifiedDateKey) as? Date
        
        NSLog("[AppleMusicModule] Library check: current=\(currentModified), cached=\(cachedModified?.description ?? "nil")")
        
        if cachedModified == nil || currentModified > cachedModified! {
            NSLog("[AppleMusicModule] Library has changed, refreshing cache in background")
            refreshCacheInBackground()
        } else {
            NSLog("[AppleMusicModule] Library unchanged, cache is valid")
        }
    }
    
    /// Invalidate the in-memory cache
    private func invalidateCache() {
        cacheQueue.async { [weak self] in
            self?.libraryCache.isValid = false
            self?.libraryCache.counts = nil
            // Also clear the songs/albums cache
            self?.librarySongsCache = nil
            self?.libraryAlbumsCache = nil
            self?.libraryCacheTimestamp = nil
            NSLog("[AppleMusicModule] Cache invalidated (counts + songs/albums)")
        }
    }
    
    /// Refresh cache counts in the background
    /// This runs silently without blocking UI
    private func refreshCacheInBackground() {
        cacheQueue.async { [weak self] in
            guard let self = self else { return }
            
            // Prevent concurrent refreshes
            guard !self.libraryCache.isRefreshing else {
                NSLog("[AppleMusicModule] Cache refresh already in progress, skipping")
                return
            }
            self.libraryCache.isRefreshing = true
        }
        
        Task { [weak self] in
            guard let self = self else { return }
            
            do {
                NSLog("[AppleMusicModule] Starting background cache refresh")
                let startTime = CFAbsoluteTimeGetCurrent()
                
                // Fetch counts only (not full item lists)
                async let songsRequest = MusicLibraryRequest<Song>().response()
                async let albumsRequest = MusicLibraryRequest<Album>().response()
                async let artistsRequest = MusicLibraryRequest<Artist>().response()
                async let playlistsRequest = MusicLibraryRequest<Playlist>().response()
                
                let (songs, albums, artists, playlists) = try await (songsRequest, albumsRequest, artistsRequest, playlistsRequest)
                
                let counts: [String: Int] = [
                    "songs": songs.items.count,
                    "albums": albums.items.count,
                    "artists": artists.items.count,
                    "playlists": playlists.items.count
                ]
                
                let duration = CFAbsoluteTimeGetCurrent() - startTime
                NSLog("[AppleMusicModule] Cache refresh complete in \(String(format: "%.2f", duration))s: \(counts)")
                
                // Update cache
                self.cacheQueue.async { [weak self] in
                    guard let self = self else { return }
                    self.libraryCache.counts = counts
                    self.libraryCache.lastModified = MPMediaLibrary.default().lastModifiedDate
                    self.libraryCache.isValid = true
                    self.libraryCache.isRefreshing = false
                    
                    // Save to UserDefaults
                    UserDefaults.standard.set(self.libraryCache.lastModified, forKey: self.cacheModifiedDateKey)
                }
            } catch {
                NSLog("[AppleMusicModule] Cache refresh failed: \(error.localizedDescription)")
                self.cacheQueue.async { [weak self] in
                    self?.libraryCache.isRefreshing = false
                }
            }
        }
    }

    @objc
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    override func supportedEvents() -> [String]! {
        return [
            "onPlaybackStateChange",
            "onNowPlayingItemChange",
            "onQueueChange",
            "onAuthorizationStatusChange",
            "AppleMusicLibraryDidChange"  // Library sync event
        ]
    }

    override func startObserving() {
        hasListeners = true
    }

    override func stopObserving() {
        hasListeners = false
    }

    // ============================================================
    // MARK: - Authorization
    // ============================================================

    /// Check current MusicKit authorization status
    /// Returns: "authorized", "denied", "notDetermined", "restricted"
    @objc
    func checkAuthStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        Task {
            let status = MusicAuthorization.currentStatus
            let statusString = self.authStatusToString(status)
            resolve(statusString)
        }
    }

    /// Request MusicKit authorization from user
    /// Returns: "authorized", "denied", "notDetermined", "restricted"
    @objc
    func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
        Task {
            let status = await MusicAuthorization.request()
            let statusString = self.authStatusToString(status)
            
            // Emit event for status change
            if self.hasListeners {
                self.sendEvent(withName: "onAuthorizationStatusChange", body: ["status": statusString])
            }
            
            resolve(statusString)
        }
    }

    /// Check if user has Apple Music subscription
    /// Returns: { "canPlayCatalogContent": Bool, "hasCloudLibraryEnabled": Bool }
    @objc
    func checkSubscription(_ resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let subscription = try await MusicSubscription.current
                resolve([
                    "canPlayCatalogContent": subscription.canPlayCatalogContent,
                    "hasCloudLibraryEnabled": subscription.hasCloudLibraryEnabled
                ])
            } catch {
                reject("SUBSCRIPTION_ERROR", "Failed to check subscription: \(error.localizedDescription)", error)
            }
        }
    }

    // ============================================================
    // MARK: - Catalog Search
    // ============================================================

    /// Search Apple Music catalog
    /// @param query Search query string
    /// @param types Array of types to search: "songs", "albums", "artists", "playlists"
    /// @param limit Maximum results per type (default 25)
    @objc
    func searchCatalog(_ query: String,
                       types: [String],
                       limit: Int,
                       resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
        
        Task {
            do {
                // First verify authorization status
                let authStatus = MusicAuthorization.currentStatus
                guard authStatus == .authorized else {
                    reject("AUTH_ERROR", "MusicKit not authorized. Status: \(authStatus)", nil)
                    return
                }
                
                var results: [String: Any] = [:]
                
                // Search for songs
                if types.contains("songs") {
                    var request = MusicCatalogSearchRequest(term: query, types: [Song.self])
                    request.limit = limit
                    let response = try await request.response()
                    results["songs"] = response.songs.map { self.songToDictionary($0) }
                }
                
                // Search for albums
                if types.contains("albums") {
                    var request = MusicCatalogSearchRequest(term: query, types: [Album.self])
                    request.limit = limit
                    let response = try await request.response()
                    results["albums"] = response.albums.map { self.albumToDictionary($0) }
                }
                
                // Search for artists
                if types.contains("artists") {
                    var request = MusicCatalogSearchRequest(term: query, types: [Artist.self])
                    request.limit = limit
                    let response = try await request.response()
                    results["artists"] = response.artists.map { self.artistToDictionary($0) }
                }
                
                // Search for playlists
                if types.contains("playlists") {
                    var request = MusicCatalogSearchRequest(term: query, types: [Playlist.self])
                    request.limit = limit
                    let response = try await request.response()
                    results["playlists"] = response.playlists.map { self.playlistToDictionary($0) }
                }
                
                resolve(results)
            } catch {
                // Detailed error logging
                let nsError = error as NSError
                let errorInfo = """
                    Domain: \(nsError.domain)
                    Code: \(nsError.code)
                    Description: \(error.localizedDescription)
                    UserInfo: \(nsError.userInfo)
                    """
                print("[AppleMusicModule] Search error details: \(errorInfo)")
                reject("SEARCH_ERROR", "Search failed [\(nsError.domain):\(nsError.code)]: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get top charts
    /// @param types Array of chart types: "songs", "albums", "playlists"
    /// @param limit Maximum results per type
    @objc
    func getTopCharts(_ types: [String],
                      limit: Int,
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
        
        Task {
            do {
                // First verify authorization status
                let authStatus = MusicAuthorization.currentStatus
                guard authStatus == .authorized else {
                    reject("AUTH_ERROR", "MusicKit not authorized. Status: \(authStatus)", nil)
                    return
                }
                var results: [String: Any] = [:]
                
                // Get top songs
                if types.contains("songs") {
                    var request = MusicCatalogChartsRequest(kinds: [.mostPlayed], types: [Song.self])
                    request.limit = limit
                    let response = try await request.response()
                    if let songChart = response.songCharts.first {
                        results["songs"] = songChart.items.map { self.songToDictionary($0) }
                    }
                }
                
                // Get top albums
                if types.contains("albums") {
                    var request = MusicCatalogChartsRequest(kinds: [.mostPlayed], types: [Album.self])
                    request.limit = limit
                    let response = try await request.response()
                    if let albumChart = response.albumCharts.first {
                        results["albums"] = albumChart.items.map { self.albumToDictionary($0) }
                    }
                }
                
                // Get top playlists
                if types.contains("playlists") {
                    var request = MusicCatalogChartsRequest(kinds: [.mostPlayed], types: [Playlist.self])
                    request.limit = limit
                    let response = try await request.response()
                    if let playlistChart = response.playlistCharts.first {
                        results["playlists"] = playlistChart.items.map { self.playlistToDictionary($0) }
                    }
                }
                
                resolve(results)
            } catch {
                reject("CHARTS_ERROR", "Failed to get charts: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get available music genres from the Apple Music catalog
    @objc
    func getGenres(_ resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let authStatus = MusicAuthorization.currentStatus
                guard authStatus == .authorized else {
                    reject("AUTH_ERROR", "MusicKit not authorized. Status: \(authStatus)", nil)
                    return
                }

                // Fetch top-level genres from the catalog
                var request = MusicCatalogResourceRequest<Genre>()
                request.limit = 50
                let response = try await request.response()

                let genres: [[String: Any]] = response.items.map { genre in
                    return [
                        "id": genre.id.rawValue,
                        "name": genre.name,
                    ]
                }

                NSLog("[AppleMusicModule] Loaded \(genres.count) genres")
                resolve(genres)
            } catch {
                NSLog("[AppleMusicModule] Failed to load genres: \(error.localizedDescription)")
                reject("GENRES_ERROR", "Failed to get genres: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get top charts filtered by genre
    /// @param genreId The MusicKit genre ID to filter by
    /// @param types Array of chart types: "songs", "albums", "playlists"
    /// @param limit Maximum results per type
    @objc
    func getTopChartsByGenre(_ genreId: String,
                             types: [String],
                             limit: Int,
                             resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let authStatus = MusicAuthorization.currentStatus
                guard authStatus == .authorized else {
                    reject("AUTH_ERROR", "MusicKit not authorized. Status: \(authStatus)", nil)
                    return
                }

                // Fetch the Genre object by ID (MusicCatalogChartsRequest requires Genre, not MusicItemID)
                let genreRequest = MusicCatalogResourceRequest<Genre>(matching: \.id, equalTo: MusicItemID(genreId))
                let genreResponse = try await genreRequest.response()
                guard let genre = genreResponse.items.first else {
                    reject("GENRE_NOT_FOUND", "Genre not found for ID: \(genreId)", nil)
                    return
                }

                var results: [String: Any] = [:]

                // Get top songs for genre
                if types.contains("songs") {
                    var request = MusicCatalogChartsRequest(genre: genre, kinds: [.mostPlayed], types: [Song.self])
                    request.limit = limit
                    let response = try await request.response()
                    if let songChart = response.songCharts.first {
                        results["songs"] = songChart.items.map { self.songToDictionary($0) }
                    }
                }

                // Get top albums for genre
                if types.contains("albums") {
                    var request = MusicCatalogChartsRequest(genre: genre, kinds: [.mostPlayed], types: [Album.self])
                    request.limit = limit
                    let response = try await request.response()
                    if let albumChart = response.albumCharts.first {
                        results["albums"] = albumChart.items.map { self.albumToDictionary($0) }
                    }
                }

                // Get top playlists for genre
                if types.contains("playlists") {
                    var request = MusicCatalogChartsRequest(genre: genre, kinds: [.mostPlayed], types: [Playlist.self])
                    request.limit = limit
                    let response = try await request.response()
                    if let playlistChart = response.playlistCharts.first {
                        results["playlists"] = playlistChart.items.map { self.playlistToDictionary($0) }
                    }
                }

                NSLog("[AppleMusicModule] Loaded charts for genre \(genreId) (\(genre.name)): songs=\(String(describing: (results["songs"] as? [Any])?.count)), albums=\(String(describing: (results["albums"] as? [Any])?.count))")
                resolve(results)
            } catch {
                NSLog("[AppleMusicModule] Failed to get charts for genre \(genreId): \(error.localizedDescription)")
                reject("CHARTS_ERROR", "Failed to get charts for genre: \(error.localizedDescription)", error)
            }
        }
    }

    // ============================================================
    // MARK: - Playback Control
    // ============================================================

    /// Play a song by ID (catalog song)
    @objc
    func playSong(_ songId: String,
                  resolve: @escaping RCTPromiseResolveBlock,
                  reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                NSLog("[AppleMusicModule] playSong called with ID: \(songId)")

                // Fetch the song from catalog
                let request = MusicCatalogResourceRequest<Song>(matching: \.id, equalTo: MusicItemID(songId))
                let response = try await request.response()

                guard let song = response.items.first else {
                    NSLog("[AppleMusicModule] Song not found in catalog: \(songId)")
                    reject("SONG_NOT_FOUND", "Song with ID \(songId) not found in catalog", nil)
                    return
                }

                #if DEBUG
                NSLog("[AppleMusicModule] Found song: '\(song.title)' by \(song.artistName), duration: \(song.duration ?? 0)s")
                #endif

                // Set queue and play
                player.queue = [song]
                NSLog("[AppleMusicModule] Queue set, calling play()")
                try await player.play()

                NSLog("[AppleMusicModule] play() completed successfully")
                NSLog("[AppleMusicModule] Player state: \(player.state.playbackStatus)")

                // Start time update timer immediately after successful play
                DispatchQueue.main.async { [weak self] in
                    self?.startTimeUpdateTimer()
                }

                // Send immediate state update with debounce reset
                if self.hasListeners {
                    let stateDict = self.buildPlaybackState()
                    self.lastEmittedStatus = "playing"  // Update debounce state
                    self.lastStateEventTime = CFAbsoluteTimeGetCurrent()
                    NSLog("[AppleMusicModule] Sending initial playing state")
                    self.sendEvent(withName: "onPlaybackStateChange", body: stateDict)
                }

                resolve(["success": true])
            } catch {
                NSLog("[AppleMusicModule] playSong error: \(error.localizedDescription)")
                // Stop the player to prevent state cycling that floods the bridge
                self.player.stop()
                DispatchQueue.main.async { [weak self] in
                    self?.stopTimeUpdateTimer()
                }
                reject("PLAY_ERROR", "Failed to play catalog song: \(error.localizedDescription)", error)
            }
        }
    }

    /// Play a library song by ID (local library song)
    /// Library song IDs start with "i." prefix (e.g., "i.8BCC85DD-...")
    @objc
    func playLibrarySong(_ songId: String,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                NSLog("[AppleMusicModule] playLibrarySong called with ID: \(songId)")

                // Fetch the song from user's library
                var request = MusicLibraryRequest<Song>()
                request.filter(matching: \.id, equalTo: MusicItemID(songId))
                let response = try await request.response()

                guard let song = response.items.first else {
                    NSLog("[AppleMusicModule] Library song not found: \(songId)")
                    reject("SONG_NOT_FOUND", "Song with ID \(songId) not found in library", nil)
                    return
                }

                #if DEBUG
                NSLog("[AppleMusicModule] Found library song: '\(song.title)' by \(song.artistName)")
                #endif

                // Use ApplicationMusicPlayer.Queue for proper queue setup
                player.queue = ApplicationMusicPlayer.Queue(for: [song])

                do {
                    try await player.play()
                    NSLog("[AppleMusicModule] Library song playing successfully")
                } catch {
                    // ApplicationMusicPlayer can fail on library-only songs (not in Apple Music catalog).
                    // Fallback: try to find the catalog equivalent by title + artist and play that instead.
                    NSLog("[AppleMusicModule] ApplicationMusicPlayer failed for library song, trying catalog fallback: \(error.localizedDescription)")

                    let catalogRequest = MusicCatalogSearchRequest(term: "\(song.artistName) \(song.title)", types: [Song.self])
                    let catalogResponse = try await catalogRequest.response()

                    if let catalogSong = catalogResponse.songs.first(where: {
                        $0.title.lowercased() == song.title.lowercased() &&
                        $0.artistName.lowercased() == song.artistName.lowercased()
                    }) ?? catalogResponse.songs.first {
                        #if DEBUG
                        NSLog("[AppleMusicModule] Found catalog equivalent: '\(catalogSong.title)' by \(catalogSong.artistName)")
                        #endif
                        player.queue = ApplicationMusicPlayer.Queue(for: [catalogSong])
                        try await player.play()
                        NSLog("[AppleMusicModule] Catalog fallback playing successfully")
                    } else {
                        throw error  // Re-throw original error if no catalog match found
                    }
                }

                // Start time update timer immediately after successful play
                DispatchQueue.main.async { [weak self] in
                    self?.startTimeUpdateTimer()
                }

                // Send immediate state update with debounce reset
                if self.hasListeners {
                    let stateDict = self.buildPlaybackState()
                    self.lastEmittedStatus = "playing"  // Update debounce state
                    self.lastStateEventTime = CFAbsoluteTimeGetCurrent()
                    NSLog("[AppleMusicModule] Sending initial playing state")
                    self.sendEvent(withName: "onPlaybackStateChange", body: stateDict)
                }

                resolve(["success": true])
            } catch {
                NSLog("[AppleMusicModule] playLibrarySong error: \(error.localizedDescription)")
                // Stop the player to prevent state cycling (stopped→paused→playing→stopped loop)
                // that floods the bridge with events and freezes the UI
                self.player.stop()
                DispatchQueue.main.async { [weak self] in
                    self?.stopTimeUpdateTimer()
                }
                reject("PLAY_ERROR", "Failed to play library song: \(error.localizedDescription)", error)
            }
        }
    }

    /// Play an album by ID
    /// Tries catalog first, then falls back to library (matches getAlbumDetails dual-path)
    @objc
    func playAlbum(_ albumId: String,
                   startIndex: Int,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
        Task {
            // Try catalog first
            do {
                var request = MusicCatalogResourceRequest<Album>(matching: \.id, equalTo: MusicItemID(albumId))
                request.properties = [.tracks]
                let response = try await request.response()
                
                if let album = response.items.first, let tracks = album.tracks, !tracks.isEmpty {
                    player.queue = ApplicationMusicPlayer.Queue(for: tracks, startingAt: tracks[safe: startIndex])
                    try await player.play()
                    resolve(["success": true])
                    return
                }
            } catch {
                NSLog("[AppleMusicModule] Catalog playAlbum failed, trying library: \(error.localizedDescription)")
            }
            
            // Fallback to library
            do {
                var libraryRequest = MusicLibraryRequest<Album>()
                libraryRequest.filter(matching: \.id, equalTo: MusicItemID(albumId))
                let libraryResponse = try await libraryRequest.response()
                
                guard let album = libraryResponse.items.first else {
                    reject("ALBUM_NOT_FOUND", "Album with ID \(albumId) not found in catalog or library", nil)
                    return
                }
                
                // Fetch songs for this library album by title
                var songsRequest = MusicLibraryRequest<Song>()
                songsRequest.filter(matching: \.albumTitle, equalTo: album.title)
                songsRequest.sort(by: \.trackNumber, ascending: true)
                let songsResponse = try await songsRequest.response()
                let songs = Array(songsResponse.items)
                
                guard !songs.isEmpty else {
                    reject("ALBUM_EMPTY", "Album '\(album.title)' has no playable tracks in library", nil)
                    return
                }
                
                player.queue = ApplicationMusicPlayer.Queue(for: songs, startingAt: songs[safe: startIndex])
                try await player.play()
                resolve(["success": true])
            } catch {
                reject("PLAY_ERROR", "Failed to play album: \(error.localizedDescription)", error)
            }
        }
    }

    /// Play a playlist by ID
    /// Tries catalog first, then falls back to library (matches dual-path pattern)
    @objc
    func playPlaylist(_ playlistId: String,
                      startIndex: Int,
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
        Task {
            // Try catalog first
            do {
                var request = MusicCatalogResourceRequest<Playlist>(matching: \.id, equalTo: MusicItemID(playlistId))
                request.properties = [.tracks]
                let response = try await request.response()
                
                if let playlist = response.items.first, let tracks = playlist.tracks, !tracks.isEmpty {
                    player.queue = ApplicationMusicPlayer.Queue(for: tracks, startingAt: tracks[safe: startIndex])
                    try await player.play()
                    resolve(["success": true])
                    return
                }
            } catch {
                NSLog("[AppleMusicModule] Catalog playPlaylist failed, trying library: \(error.localizedDescription)")
            }
            
            // Fallback to library
            do {
                var libraryRequest = MusicLibraryRequest<Playlist>()
                libraryRequest.filter(matching: \.id, equalTo: MusicItemID(playlistId))
                let libraryResponse = try await libraryRequest.response()
                
                guard let playlist = libraryResponse.items.first else {
                    reject("PLAYLIST_NOT_FOUND", "Playlist with ID \(playlistId) not found in catalog or library", nil)
                    return
                }
                
                // Queue the library playlist directly
                player.queue = ApplicationMusicPlayer.Queue(for: [playlist])
                try await player.play()
                resolve(["success": true])
            } catch {
                reject("PLAY_ERROR", "Failed to play playlist: \(error.localizedDescription)", error)
            }
        }
    }

    /// Play a station by ID (for recently played stations)
    @objc
    func playStation(_ stationId: String,
                     resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let request = MusicCatalogResourceRequest<Station>(matching: \.id, equalTo: MusicItemID(stationId))
                let response = try await request.response()

                guard let station = response.items.first else {
                    reject("STATION_NOT_FOUND", "Station with ID \(stationId) not found", nil)
                    return
                }

                player.queue = ApplicationMusicPlayer.Queue(for: [station])
                try await player.play()

                resolve(["success": true])
            } catch {
                reject("PLAY_ERROR", "Failed to play station: \(error.localizedDescription)", error)
            }
        }
    }

    /// Pause playback
    @objc
    func pause(_ resolve: @escaping RCTPromiseResolveBlock,
               reject: @escaping RCTPromiseRejectBlock) {
        NSLog("[AppleMusicModule] pause() called")
        player.pause()

        // Stop time update timer immediately
        DispatchQueue.main.async { [weak self] in
            self?.stopTimeUpdateTimer()
        }

        // Send immediate state update with debounce reset
        if hasListeners {
            let stateDict = buildPlaybackState()
            lastEmittedStatus = "paused"  // Update debounce state
            lastStateEventTime = CFAbsoluteTimeGetCurrent()
            NSLog("[AppleMusicModule] Sending paused state")
            sendEvent(withName: "onPlaybackStateChange", body: stateDict)
        }

        resolve(["success": true])
    }

    /// Resume playback
    @objc
    func resume(_ resolve: @escaping RCTPromiseResolveBlock,
                reject: @escaping RCTPromiseRejectBlock) {
        NSLog("[AppleMusicModule] resume() called")
        Task {
            do {
                try await player.play()
                NSLog("[AppleMusicModule] resume() - play() succeeded, status: \(player.state.playbackStatus)")

                // Start time update timer
                DispatchQueue.main.async { [weak self] in
                    self?.startTimeUpdateTimer()
                }

                // Send immediate state update with debounce reset
                if self.hasListeners {
                    let stateDict = self.buildPlaybackState()
                    self.lastEmittedStatus = "playing"  // Update debounce state
                    self.lastStateEventTime = CFAbsoluteTimeGetCurrent()
                    NSLog("[AppleMusicModule] Sending playing state after resume")
                    self.sendEvent(withName: "onPlaybackStateChange", body: stateDict)
                }

                resolve(["success": true])
            } catch {
                NSLog("[AppleMusicModule] resume() failed: \(error.localizedDescription)")
                reject("RESUME_ERROR", "Failed to resume: \(error.localizedDescription)", error)
            }
        }
    }

    /// Toggle playback (play/pause based on current state)
    /// This is more reliable than checking isPlaying in JS due to race conditions
    @objc
    func togglePlayback(_ resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
        let currentStatus = player.state.playbackStatus
        NSLog("[AppleMusicModule] togglePlayback() called, current status: \(currentStatus)")
        
        if currentStatus == .playing {
            // Currently playing -> pause
            player.pause()
            
            DispatchQueue.main.async { [weak self] in
                self?.stopTimeUpdateTimer()
            }
            
            if hasListeners {
                let stateDict = buildPlaybackState()
                lastEmittedStatus = "paused"
                lastStateEventTime = CFAbsoluteTimeGetCurrent()
                sendEvent(withName: "onPlaybackStateChange", body: stateDict)
            }
            
            resolve(["success": true, "newState": "paused"])
        } else {
            // Not playing -> resume
            Task {
                do {
                    try await player.play()
                    
                    DispatchQueue.main.async { [weak self] in
                        self?.startTimeUpdateTimer()
                    }
                    
                    if self.hasListeners {
                        let stateDict = self.buildPlaybackState()
                        self.lastEmittedStatus = "playing"
                        self.lastStateEventTime = CFAbsoluteTimeGetCurrent()
                        self.sendEvent(withName: "onPlaybackStateChange", body: stateDict)
                    }
                    
                    resolve(["success": true, "newState": "playing"])
                } catch {
                    NSLog("[AppleMusicModule] togglePlayback() play failed: \(error.localizedDescription)")
                    reject("TOGGLE_ERROR", "Failed to toggle playback: \(error.localizedDescription)", error)
                }
            }
        }
    }

    /// Stop playback
    @objc
    func stop(_ resolve: @escaping RCTPromiseResolveBlock,
              reject: @escaping RCTPromiseRejectBlock) {
        player.stop()
        resolve(["success": true])
    }

    /// Skip to next track
    @objc
    func skipToNext(_ resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                try await player.skipToNextEntry()
                resolve(["success": true])
            } catch {
                reject("SKIP_ERROR", "Failed to skip to next: \(error.localizedDescription)", error)
            }
        }
    }

    /// Skip to previous track
    @objc
    func skipToPrevious(_ resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                try await player.skipToPreviousEntry()
                resolve(["success": true])
            } catch {
                reject("SKIP_ERROR", "Failed to skip to previous: \(error.localizedDescription)", error)
            }
        }
    }

    /// Seek to position in seconds
    @objc
    func seekTo(_ position: Double,
                resolve: @escaping RCTPromiseResolveBlock,
                reject: @escaping RCTPromiseRejectBlock) {
        player.playbackTime = position
        resolve(["success": true])
    }

    // ============================================================
    // MARK: - Shuffle & Repeat Modes
    // ============================================================

    /// Set shuffle mode
    /// @param mode "off", "songs"
    @objc
    func setShuffleMode(_ mode: String,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
        switch mode {
        case "songs":
            player.state.shuffleMode = .songs
        default:
            player.state.shuffleMode = .off
        }
        resolve(["success": true, "mode": mode])
    }

    /// Get current shuffle mode
    @objc
    func getShuffleMode(_ resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
        let mode: String
        switch player.state.shuffleMode {
        case .songs:
            mode = "songs"
        default:
            mode = "off"
        }
        resolve(mode)
    }

    /// Set repeat mode
    /// @param mode "off", "one", "all"
    @objc
    func setRepeatMode(_ mode: String,
                       resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
        switch mode {
        case "one":
            player.state.repeatMode = .one
        case "all":
            player.state.repeatMode = .all
        default:
            player.state.repeatMode = MusicPlayer.RepeatMode.none
        }
        resolve(["success": true, "mode": mode])
    }

    /// Get current repeat mode
    @objc
    func getRepeatMode(_ resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
        let mode: String
        switch player.state.repeatMode {
        case .one:
            mode = "one"
        case .all:
            mode = "all"
        default:
            mode = "off"
        }
        resolve(mode)
    }

    // ============================================================
    // MARK: - Queue Management
    // ============================================================

    /// Get current queue
    @objc
    func getQueue(_ resolve: @escaping RCTPromiseResolveBlock,
                  reject: @escaping RCTPromiseRejectBlock) {
        Task {
            let entries = player.queue.entries
            let items = entries.compactMap { entry -> [String: Any]? in
                guard case .song(let song) = entry.item else { return nil }
                return self.songToDictionary(song)
            }
            resolve(items)
        }
    }

    /// Add song to queue
    @objc
    func addToQueue(_ songId: String,
                    position: String, // "next" or "last"
                    resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Fetch the song
                let request = MusicCatalogResourceRequest<Song>(matching: \.id, equalTo: MusicItemID(songId))
                let response = try await request.response()
                
                guard let song = response.items.first else {
                    reject("SONG_NOT_FOUND", "Song with ID \(songId) not found", nil)
                    return
                }
                
                // Add to queue
                if position == "next" {
                    try await player.queue.insert(song, position: .afterCurrentEntry)
                } else {
                    try await player.queue.insert(song, position: .tail)
                }
                
                resolve(["success": true])
            } catch {
                reject("QUEUE_ERROR", "Failed to add to queue: \(error.localizedDescription)", error)
            }
        }
    }

    // ============================================================
    // MARK: - Playback State
    // ============================================================

    /// Get current playback state
    @objc
    func getPlaybackState(_ resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        let state = buildPlaybackState()
        resolve(state)
    }

    /// Get current now playing item
    @objc
    func getNowPlaying(_ resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
        Task {
            guard let entry = player.queue.currentEntry,
                  case .song(let song) = entry.item else {
                resolve(nil)
                return
            }
            resolve(self.songToDictionary(song))
        }
    }

    // ============================================================
    // MARK: - Playback State Observer
    // ============================================================

    private func setupPlaybackStateObserver() {
        playbackStateTask = Task {
            // Observe playback state changes
            for await _ in player.state.objectWillChange.values {
                guard hasListeners else { continue }

                let stateDict = buildPlaybackState()
                let status = stateDict["status"] as? String ?? "unknown"
                
                // DEBOUNCING: Throttle all emissions to avoid flooding the bridge.
                // Status changes are emitted immediately but at most once per minStateEventInterval.
                // Same-status events (e.g. position-only updates) are dropped here — the timer handles those.
                let now = CFAbsoluteTimeGetCurrent()
                let statusChanged = (status != lastEmittedStatus)
                let enoughTimePassed = (now - lastStateEventTime) >= minStateEventInterval

                // Require minimum interval even for status changes to prevent
                // rapid cycling (stopped→paused→playing→stopped) from flooding the bridge
                guard enoughTimePassed else { continue }
                guard statusChanged else { continue }

                NSLog("[AppleMusicModule] Playback status changed: \(lastEmittedStatus ?? "nil") -> \(status)")

                lastEmittedStatus = status
                lastStateEventTime = now
                sendEvent(withName: "onPlaybackStateChange", body: stateDict)

                // Start/stop time update timer based on playback state
                DispatchQueue.main.async { [weak self] in
                    if status == "playing" {
                        self?.startTimeUpdateTimer()
                    } else {
                        self?.stopTimeUpdateTimer()
                    }
                }

                // Also check if now playing changed
                checkNowPlayingChange()
            }
        }
    }

    // ============================================================
    // MARK: - Periodic Time Update Timer
    // ============================================================

    /// Start periodic timer to send time updates every 1s while playing
    private func startTimeUpdateTimer() {
        // Don't start if already running
        guard timeUpdateTimer == nil else { return }

        NSLog("[AppleMusicModule] Starting time update timer")
        timeUpdateTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self, self.hasListeners else { return }

            // Only send updates while playing
            guard self.player.state.playbackStatus == .playing else {
                self.stopTimeUpdateTimer()
                return
            }

            let stateDict = self.buildPlaybackState()
            self.sendEvent(withName: "onPlaybackStateChange", body: stateDict)
        }
        // Use .default run loop mode so timer does NOT fire during touch tracking.
        // Using .common would block touch handling by firing bridge events during gestures.
        RunLoop.main.add(timeUpdateTimer!, forMode: .default)
    }

    /// Stop the periodic time update timer
    private func stopTimeUpdateTimer() {
        if timeUpdateTimer != nil {
            NSLog("[AppleMusicModule] Stopping time update timer")
        }
        timeUpdateTimer?.invalidate()
        timeUpdateTimer = nil
    }

    private func setupQueueObserver() {
        queueObservationTask = Task {
            // Observe queue changes
            for await _ in player.queue.objectWillChange.values {
                guard hasListeners else { continue }

                // Check if current entry changed
                checkNowPlayingChange()

                // Send queue update
                let entries = player.queue.entries
                let items = entries.compactMap { entry -> [String: Any]? in
                    guard case .song(let song) = entry.item else { return nil }
                    return self.songToDictionary(song)
                }
                sendEvent(withName: "onQueueChange", body: items)
            }
        }
    }

    private func checkNowPlayingChange() {
        guard let entry = player.queue.currentEntry else {
            if currentEntryId != nil {
                currentEntryId = nil
                sendEvent(withName: "onNowPlayingItemChange", body: NSNull())
            }
            return
        }

        let entryId = "\(entry.id)"
        if entryId != currentEntryId {
            currentEntryId = entryId

            if case .song(let song) = entry.item {
                let songDict = songToDictionary(song)
                sendEvent(withName: "onNowPlayingItemChange", body: songDict)
            }
        }
    }

    private func buildPlaybackState() -> [String: Any] {
        let statusString: String
        switch player.state.playbackStatus {
        case .playing:
            statusString = "playing"
        case .paused:
            statusString = "paused"
        case .stopped:
            statusString = "stopped"
        case .interrupted:
            statusString = "interrupted"
        case .seekingForward:
            statusString = "seekingForward"
        case .seekingBackward:
            statusString = "seekingBackward"
        @unknown default:
            statusString = "unknown"
        }
        
        // Get duration and artwork from current queue entry
        var duration: Double = 0
        var artworkUrl: String = ""
        var artworkBgColor: String = ""
        var title: String = ""
        var artistName: String = ""
        var songId: String = ""
        
        if let entry = player.queue.currentEntry,
           case .song(let song) = entry.item {
            if let songDuration = song.duration {
                duration = songDuration
            }
            songId = song.id.rawValue
            title = song.title
            artistName = song.artistName
            
            // Get artwork URL and fallback color
            if let artwork = song.artwork {
                // Get background color for fallback
                if let bgColor = artwork.backgroundColor,
                   let components = bgColor.components,
                   components.count >= 3 {
                    artworkBgColor = String(format: "#%02X%02X%02X",
                        Int(components[0] * 255),
                        Int(components[1] * 255),
                        Int(components[2] * 255))
                }
                
                if let url = artwork.url(width: 300, height: 300) {
                    let httpUrl = url.httpURLString
                    artworkUrl = httpUrl
                }
            }
        }
        
        return [
            "status": statusString,
            "playbackTime": player.playbackTime,
            "currentTime": player.playbackTime,  // Alias for React Native compatibility
            "duration": duration,
            "shuffleMode": player.state.shuffleMode == .songs ? "songs" : "off",
            "repeatMode": repeatModeToString(player.state.repeatMode),
            // Include song info for Glass Player
            "songId": songId,
            "title": title,
            "artistName": artistName,
            "artworkUrl": artworkUrl,
            "artworkBgColor": artworkBgColor
        ]
    }

    // ============================================================
    // MARK: - Helper Methods
    // ============================================================

    private func authStatusToString(_ status: MusicAuthorization.Status) -> String {
        switch status {
        case .authorized:
            return "authorized"
        case .denied:
            return "denied"
        case .notDetermined:
            return "notDetermined"
        case .restricted:
            return "restricted"
        @unknown default:
            return "unknown"
        }
    }

    private func repeatModeToString(_ mode: MusicKit.MusicPlayer.RepeatMode?) -> String {
        switch mode {
        case .one:
            return "one"
        case .all:
            return "all"
        default:
            return "off"
        }
    }

    private func songToDictionary(_ song: Song) -> [String: Any] {
        // Get artwork URL - try multiple approaches
        var artworkURL = ""
        var artworkBgColor = ""
        
        if let artwork = song.artwork {
            // Get background color for fallback (if no URL available)
            if let bgColor = artwork.backgroundColor,
               let components = bgColor.components,
               components.count >= 3 {
                artworkBgColor = String(format: "#%02X%02X%02X",
                    Int(components[0] * 255),
                    Int(components[1] * 255),
                    Int(components[2] * 255))
            }
            
            // Try to get URL
            if let url = artwork.url(width: 300, height: 300) {
                let httpUrl = url.httpURLString
                if !httpUrl.isEmpty {
                    artworkURL = httpUrl
                }
            }
        }
        
        return [
            "id": song.id.rawValue,
            "title": song.title,
            "artistName": song.artistName,
            "albumTitle": song.albumTitle ?? "",
            "duration": song.duration ?? 0,
            "artworkUrl": artworkURL,
            "artworkBgColor": artworkBgColor,  // Fallback color if no URL
            "trackNumber": song.trackNumber ?? 0,
            "discNumber": song.discNumber ?? 1,
            "isExplicit": song.contentRating == .explicit
        ]
    }

    /// Convert Track enum (can be Song or MusicVideo) to dictionary
    /// Used for album tracks and playlist tracks
    private func trackToDictionary(_ track: Track) -> [String: Any] {
        switch track {
        case .song(let song):
            return songToDictionary(song)
        case .musicVideo(let musicVideo):
            // Handle music video case
            var artworkURL = ""
            if let artwork = musicVideo.artwork,
               let url = artwork.url(width: 300, height: 300) {
                artworkURL = url.httpURLString
            }
            return [
                "id": musicVideo.id.rawValue,
                "title": musicVideo.title,
                "artistName": musicVideo.artistName,
                "albumTitle": "",
                "duration": musicVideo.duration ?? 0,
                "artworkUrl": artworkURL,
                "artworkBgColor": "",
                "trackNumber": 0,
                "discNumber": 1,
                "isExplicit": musicVideo.contentRating == .explicit,
                "isMusicVideo": true
            ]
        @unknown default:
            return [
                "id": "",
                "title": "Unknown",
                "artistName": "",
                "albumTitle": "",
                "duration": 0,
                "artworkUrl": "",
                "artworkBgColor": "",
                "trackNumber": 0,
                "discNumber": 1,
                "isExplicit": false
            ]
        }
    }

    private func albumToDictionary(_ album: Album) -> [String: Any] {
        return [
            "id": album.id.rawValue,
            "title": album.title,
            "artistName": album.artistName,
            "artworkUrl": album.artwork?.url(width: 300, height: 300)?.httpURLString ?? "",
            "trackCount": album.trackCount,
            "releaseDate": album.releaseDate?.description ?? "",
            "isExplicit": album.contentRating == .explicit
        ]
    }

    private func artistToDictionary(_ artist: Artist) -> [String: Any] {
        return [
            "id": artist.id.rawValue,
            "name": artist.name,
            "artworkUrl": artist.artwork?.url(width: 300, height: 300)?.httpURLString ?? ""
        ]
    }

    private func playlistToDictionary(_ playlist: Playlist) -> [String: Any] {
        return [
            "id": playlist.id.rawValue,
            "name": playlist.name,
            "curatorName": playlist.curatorName ?? "",
            "artworkUrl": playlist.artwork?.url(width: 300, height: 300)?.httpURLString ?? "",
            "description": playlist.standardDescription ?? ""
        ]
    }

    // ============================================================
    // MARK: - Content Details (for detail screens)
    // ============================================================

    /// Get album details including all tracks
    /// Returns album info + array of songs
    /// Tries catalog first, then falls back to library for local albums
    @objc
    func getAlbumDetails(_ albumId: String,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        Task {
            // Try catalog first (for Apple Music catalog albums)
            do {
                var request = MusicCatalogResourceRequest<Album>(matching: \.id, equalTo: MusicItemID(albumId))
                request.properties = [.tracks, .artists]
                let response = try await request.response()

                if let album = response.items.first {
                    var result = albumToDictionary(album)

                    // Add tracks (Track is an enum that can be Song or MusicVideo)
                    if let tracks = album.tracks {
                        result["tracks"] = tracks.map { trackToDictionary($0) }
                    } else {
                        result["tracks"] = []
                    }

                    // Add artist info if available
                    if let artists = album.artists {
                        result["artists"] = artists.map { artistToDictionary($0) }
                    }

                    resolve(result)
                    return
                }
            } catch {
                NSLog("[AppleMusicModule] Catalog album request failed, trying library: \(error.localizedDescription)")
            }
            
            // Fallback to library (for local library albums)
            do {
                var libraryRequest = MusicLibraryRequest<Album>()
                libraryRequest.filter(matching: \.id, equalTo: MusicItemID(albumId))
                let libraryResponse = try await libraryRequest.response()
                
                guard let album = libraryResponse.items.first else {
                    reject("ALBUM_NOT_FOUND", "Album with ID \(albumId) not found in catalog or library", nil)
                    return
                }
                
                var result = albumToDictionary(album)
                
                // For library albums, fetch tracks via songs filtered by album title
                var songsRequest = MusicLibraryRequest<Song>()
                songsRequest.filter(matching: \.albumTitle, equalTo: album.title)
                songsRequest.sort(by: \.trackNumber, ascending: true)
                let songsResponse = try await songsRequest.response()
                
                result["tracks"] = songsResponse.items.map { songToDictionary($0) }
                result["artists"] = []  // Library albums don't have direct artist references
                
                resolve(result)
            } catch {
                reject("ALBUM_ERROR", "Failed to get album details: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get artist details including top songs and albums
    /// Returns artist info + topSongs array + albums array
    /// Tries catalog first, then falls back to library for local artists
    @objc
    func getArtistDetails(_ artistId: String,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        Task {
            // Try catalog first (for Apple Music catalog artists)
            do {
                var request = MusicCatalogResourceRequest<Artist>(matching: \.id, equalTo: MusicItemID(artistId))
                request.properties = [.topSongs, .albums]
                let response = try await request.response()

                if let artist = response.items.first {
                    var result = artistToDictionary(artist)

                    // Add top songs
                    if let topSongs = artist.topSongs {
                        result["topSongs"] = Array(topSongs.prefix(10)).map { songToDictionary($0) }
                    } else {
                        result["topSongs"] = []
                    }

                    // Add albums
                    if let albums = artist.albums {
                        result["albums"] = Array(albums.prefix(20)).map { albumToDictionary($0) }
                    } else {
                        result["albums"] = []
                    }

                    resolve(result)
                    return
                }
            } catch {
                NSLog("[AppleMusicModule] Catalog artist request failed, trying library: \(error.localizedDescription)")
            }
            
            // Fallback to library (for local library artists)
            do {
                var libraryRequest = MusicLibraryRequest<Artist>()
                libraryRequest.filter(matching: \.id, equalTo: MusicItemID(artistId))
                let libraryResponse = try await libraryRequest.response()
                
                guard let artist = libraryResponse.items.first else {
                    reject("ARTIST_NOT_FOUND", "Artist with ID \(artistId) not found in catalog or library", nil)
                    return
                }
                
                var result = artistToDictionary(artist)
                
                // For library artists, we need to fetch their songs separately
                var songsRequest = MusicLibraryRequest<Song>()
                songsRequest.filter(matching: \.artistName, equalTo: artist.name)
                songsRequest.sort(by: \.playCount, ascending: false)
                let songsResponse = try await songsRequest.response()
                
                result["topSongs"] = Array(songsResponse.items.prefix(10)).map { songToDictionary($0) }
                
                // For library artists, fetch their albums
                var albumsRequest = MusicLibraryRequest<Album>()
                albumsRequest.filter(matching: \.artistName, equalTo: artist.name)
                albumsRequest.sort(by: \.title, ascending: true)
                let albumsResponse = try await albumsRequest.response()
                
                result["albums"] = Array(albumsResponse.items.prefix(20)).map { albumToDictionary($0) }
                
                resolve(result)
            } catch {
                reject("ARTIST_ERROR", "Failed to get artist details: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get playlist details including all tracks
    /// Returns playlist info + array of songs
    /// Tries catalog first, then falls back to library for user playlists
    @objc
    func getPlaylistDetails(_ playlistId: String,
                            resolve: @escaping RCTPromiseResolveBlock,
                            reject: @escaping RCTPromiseRejectBlock) {
        Task {
            // Try catalog first (for Apple Music curated playlists)
            do {
                var request = MusicCatalogResourceRequest<Playlist>(matching: \.id, equalTo: MusicItemID(playlistId))
                request.properties = [.tracks]
                let response = try await request.response()

                if let playlist = response.items.first {
                    var result = playlistToDictionary(playlist)

                    // Add tracks (Track is an enum that can be Song or MusicVideo)
                    if let tracks = playlist.tracks {
                        result["tracks"] = tracks.map { trackToDictionary($0) }
                    } else {
                        result["tracks"] = []
                    }

                    resolve(result)
                    return
                }
            } catch {
                NSLog("[AppleMusicModule] Catalog playlist request failed, trying library: \(error.localizedDescription)")
            }
            
            // Fallback to library (for user-created playlists)
            do {
                var libraryRequest = MusicLibraryRequest<Playlist>()
                libraryRequest.filter(matching: \.id, equalTo: MusicItemID(playlistId))
                let libraryResponse = try await libraryRequest.response()

                guard let playlist = libraryResponse.items.first else {
                    reject("PLAYLIST_NOT_FOUND", "Playlist with ID \(playlistId) not found in catalog or library", nil)
                    return
                }

                // Load tracks explicitly — gives us Track (Song/MusicVideo) with proper IDs and artwork
                // Using .tracks instead of .entries ensures we get song catalog/library IDs (not entry IDs)
                let playlistWithTracks = try await playlist.with(.tracks, preferredSource: .library)

                var result = playlistToDictionary(playlistWithTracks)

                if let tracks = playlistWithTracks.tracks {
                    NSLog("[AppleMusicModule] Library playlist '\(playlistWithTracks.name)' has \(tracks.count) tracks")
                    result["tracks"] = tracks.map { trackToDictionary($0) }
                } else {
                    NSLog("[AppleMusicModule] Library playlist '\(playlist.name)' has NO tracks after loading")
                    result["tracks"] = []
                }

                resolve(result)
            } catch {
                NSLog("[AppleMusicModule] Library playlist request failed: \(error.localizedDescription)")
                reject("PLAYLIST_ERROR", "Failed to get playlist details: \(error.localizedDescription)", error)
            }
        }
    }

    // ============================================================
    // MARK: - Library Management
    // ============================================================

    /// Add a song to the user's library
    /// Requires Apple Music subscription with Cloud Library enabled
    /// Automatically invalidates library cache after adding
    @objc
    func addToLibrary(_ songId: String,
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
        Task {
            // Pre-check 1: MusicKit authorization
            let authStatus = MusicAuthorization.currentStatus
            guard authStatus == .authorized else {
                NSLog("[AppleMusicModule] addToLibrary: not authorized (status: \(authStatus))")
                reject("AUTH_ERROR", "MusicKit not authorized. Status: \(authStatus)", nil)
                return
            }

            // Pre-check 2: Active subscription with Cloud Library enabled
            do {
                let subscription = try await MusicSubscription.current
                NSLog("[AppleMusicModule] addToLibrary: subscription check — canPlayCatalogContent: \(subscription.canPlayCatalogContent), hasCloudLibraryEnabled: \(subscription.hasCloudLibraryEnabled)")

                guard subscription.canPlayCatalogContent else {
                    reject("NO_SUBSCRIPTION", "Apple Music subscription required to add songs to library", nil)
                    return
                }

                guard subscription.hasCloudLibraryEnabled else {
                    reject("CLOUD_LIBRARY_DISABLED", "iCloud Music Library must be enabled. Go to Settings > Music > Sync Library", nil)
                    return
                }
            } catch {
                NSLog("[AppleMusicModule] addToLibrary: subscription check failed — \(error)")
                reject("SUBSCRIPTION_CHECK_ERROR", "Could not verify subscription: \(error.localizedDescription)", error)
                return
            }

            // Step 1: Fetch song from catalog
            let song: Song
            do {
                let request = MusicCatalogResourceRequest<Song>(matching: \.id, equalTo: MusicItemID(songId))
                let response = try await request.response()

                guard let fetchedSong = response.items.first else {
                    reject("SONG_NOT_FOUND", "Song with ID \(songId) not found in catalog", nil)
                    return
                }
                song = fetchedSong
                NSLog("[AppleMusicModule] addToLibrary: fetched song '\(song.title)' from catalog")
            } catch {
                self.logMusicKitError(error, context: "addToLibrary catalog fetch")
                reject("CATALOG_FETCH_ERROR", "Failed to fetch song from catalog: \(self.musicKitErrorMessage(error))", error)
                return
            }

            // Step 2: Add to user's library
            do {
                try await MusicLibrary.shared.add(song)
                self.invalidateCache()
                NSLog("[AppleMusicModule] addToLibrary: successfully added '\(song.title)' and invalidated cache")
                resolve(true)
            } catch {
                self.logMusicKitError(error, context: "addToLibrary MusicLibrary.add")
                reject("LIBRARY_ADD_ERROR", "Failed to add song to library: \(self.musicKitErrorMessage(error))", error)
            }
        }
    }

    /// Log detailed MusicKit error information for debugging
    private func logMusicKitError(_ error: Error, context: String) {
        let nsError = error as NSError
        NSLog("[AppleMusicModule] \(context): domain=\(nsError.domain) code=\(nsError.code)")
        NSLog("[AppleMusicModule] \(context): localizedDescription=\(error.localizedDescription)")

        if let dataRequestError = error as? MusicDataRequest.Error {
            NSLog("[AppleMusicModule] \(context): MusicDataRequest.Error — status=\(dataRequestError.status) code=\(dataRequestError.code)")
            NSLog("[AppleMusicModule] \(context): title=\(dataRequestError.title) detailText=\(dataRequestError.detailText)")
            NSLog("[AppleMusicModule] \(context): id=\(dataRequestError.id)")
        }

        // Log userInfo keys for additional context
        if !nsError.userInfo.isEmpty {
            NSLog("[AppleMusicModule] \(context): userInfo keys=\(nsError.userInfo.keys.joined(separator: ", "))")
        }
    }

    /// Extract a user-friendly message from MusicKit errors
    private func musicKitErrorMessage(_ error: Error) -> String {
        if let dataRequestError = error as? MusicDataRequest.Error {
            let detail = dataRequestError.detailText
            if !detail.isEmpty {
                return detail
            }
            let title = dataRequestError.title
            if !title.isEmpty {
                return title
            }
            return "API error (status \(dataRequestError.status), code \(dataRequestError.code))"
        }
        return error.localizedDescription
    }

    /// Check if a song is in the user's library
    @objc
    func isInLibrary(_ songId: String,
                     resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Search in user's library for this song ID
                var request = MusicLibraryRequest<Song>()
                request.filter(matching: \.id, equalTo: MusicItemID(songId))
                let response = try await request.response()

                resolve(!response.items.isEmpty)
            } catch {
                // If library access fails, assume not in library
                resolve(false)
            }
        }
    }

    /// Remove a song from the user's library
    /// Note: MusicKit doesn't provide a direct remove API, so we return an error
    /// The user must remove songs via the Music app
    @objc
    func removeFromLibrary(_ songId: String,
                           resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock) {
        // MusicKit doesn't support removing items from library programmatically
        // This is a limitation of Apple's API - users must use the Music app
        reject("NOT_SUPPORTED", "Removing songs from library is not supported by Apple Music API. Please use the Music app.", nil)
    }

    // ============================================================
    // MARK: - Library Content Retrieval
    // ============================================================

    /// Get all songs from the user's library
    /// Returns ALL songs sorted by title (uses in-memory cache for 23K+ libraries)
    /// The React Native layer handles display/pagination — native returns the full cached set.
    @objc
    func getLibrarySongs(_ limit: Int,
                         offset: Int,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Check if we have cached songs
                var cachedSongs: [[String: Any]]?
                cacheQueue.sync {
                    cachedSongs = librarySongsCache
                }
                
                let allSongs: [[String: Any]]
                
                if let cached = cachedSongs {
                    // CACHE HIT - return all cached songs instantly
                    NSLog("[AppleMusicModule] getLibrarySongs: CACHE HIT - \(cached.count) songs")
                    allSongs = cached
                } else {
                    // CACHE MISS - load from MusicKit and cache
                    NSLog("[AppleMusicModule] getLibrarySongs: CACHE MISS - loading from MusicKit...")
                    let startTime = CFAbsoluteTimeGetCurrent()
                    
                    var request = MusicLibraryRequest<Song>()
                    request.sort(by: \.title, ascending: true)
                    let response = try await request.response()
                    
                    let loadTime = CFAbsoluteTimeGetCurrent() - startTime
                    NSLog("[AppleMusicModule] getLibrarySongs: MusicKit loaded \(response.items.count) songs in \(String(format: "%.2f", loadTime))s")
                    
                    // Convert to dictionaries
                    let convertStartTime = CFAbsoluteTimeGetCurrent()
                    let songs = response.items.map { songToDictionary($0) }
                    let convertTime = CFAbsoluteTimeGetCurrent() - convertStartTime
                    NSLog("[AppleMusicModule] getLibrarySongs: Converted in \(String(format: "%.2f", convertTime))s")
                    
                    // Store in cache (thread-safe)
                    cacheQueue.async { [weak self] in
                        self?.librarySongsCache = songs
                        self?.libraryCacheTimestamp = Date()
                        NSLog("[AppleMusicModule] getLibrarySongs: Cached \(songs.count) songs")
                    }
                    
                    allSongs = songs
                }

                // Return ALL songs — React Native handles display/filtering
                resolve([
                    "items": allSongs,
                    "total": allSongs.count,
                    "offset": 0,
                    "limit": allSongs.count
                ])
            } catch {
                reject("LIBRARY_ERROR", "Failed to get library songs: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get recently added songs from the user's library
    /// Returns songs sorted by dateAdded (newest first), limited to `limit` items.
    /// Used for delta sync: when library grows, only fetch the new additions.
    @objc
    func getRecentLibrarySongs(_ limit: Int,
                                resolve: @escaping RCTPromiseResolveBlock,
                                reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                NSLog("[AppleMusicModule] getRecentLibrarySongs: fetching \(limit) most recent songs")
                let startTime = CFAbsoluteTimeGetCurrent()
                
                var request = MusicLibraryRequest<Song>()
                request.sort(by: \.libraryAddedDate, ascending: false)
                let response = try await request.response()
                
                // Take only the requested limit
                let recentSongs = Array(response.items.prefix(limit))
                let songs = recentSongs.map { songToDictionary($0) }
                
                let duration = CFAbsoluteTimeGetCurrent() - startTime
                NSLog("[AppleMusicModule] getRecentLibrarySongs: fetched \(songs.count) songs in \(String(format: "%.2f", duration))s")
                
                resolve([
                    "items": songs,
                    "total": response.items.count,
                    "offset": 0,
                    "limit": limit
                ])
            } catch {
                reject("LIBRARY_ERROR", "Failed to get recent library songs: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get recently added albums from the user's library
    /// Returns albums sorted by dateAdded (newest first), limited to `limit` items.
    @objc
    func getRecentLibraryAlbums(_ limit: Int,
                                 resolve: @escaping RCTPromiseResolveBlock,
                                 reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                NSLog("[AppleMusicModule] getRecentLibraryAlbums: fetching \(limit) most recent albums")
                let startTime = CFAbsoluteTimeGetCurrent()
                
                var request = MusicLibraryRequest<Album>()
                request.sort(by: \.libraryAddedDate, ascending: false)
                let response = try await request.response()
                
                // Take only the requested limit
                let recentAlbums = Array(response.items.prefix(limit))
                let albums = recentAlbums.map { albumToDictionary($0) }
                
                let duration = CFAbsoluteTimeGetCurrent() - startTime
                NSLog("[AppleMusicModule] getRecentLibraryAlbums: fetched \(albums.count) albums in \(String(format: "%.2f", duration))s")
                
                resolve([
                    "items": albums,
                    "total": response.items.count,
                    "offset": 0,
                    "limit": limit
                ])
            } catch {
                reject("LIBRARY_ERROR", "Failed to get recent library albums: \(error.localizedDescription)", error)
            }
        }
    }

    // ============================================================
    // MARK: - Recently Played (MusicKit API — Apple Music ecosystem history)
    // ============================================================

    /// Get recently played items from Apple Music.
    /// Tries MusicRecentlyPlayedContainerRequest first (albums, playlists, stations).
    /// Falls back to MusicRecentlyPlayedRequest<Song> if containers fail (iOS beta compatibility).
    @objc
    func getRecentlyPlayed(_ limit: Int,
                            resolve: @escaping RCTPromiseResolveBlock,
                            reject: @escaping RCTPromiseRejectBlock) {
        Task {
            let startTime = CFAbsoluteTimeGetCurrent()

            // Strategy 1: Try container-based API (albums, playlists, stations)
            do {
                NSLog("[AppleMusicModule] getRecentlyPlayed: trying container API (limit: \(limit))")
                var request = MusicRecentlyPlayedContainerRequest()
                request.limit = limit
                let response = try await request.response()

                let containers: [[String: Any]] = response.items.compactMap { item in
                    self.recentlyPlayedItemToDictionary(item)
                }

                let duration = CFAbsoluteTimeGetCurrent() - startTime
                NSLog("[AppleMusicModule] getRecentlyPlayed: container API returned \(containers.count) items in \(String(format: "%.2f", duration))s")

                resolve([
                    "items": containers,
                    "total": containers.count,
                ])
                return
            } catch {
                NSLog("[AppleMusicModule] getRecentlyPlayed: container API failed (\(error.localizedDescription)), trying song fallback")
            }

            // Strategy 2: Fall back to song-based recently played API, load album relationships, group by album
            do {
                var songRequest = MusicRecentlyPlayedRequest<Song>()
                songRequest.limit = min(limit * 5, 50)
                let songResponse = try await songRequest.response()
                NSLog("[AppleMusicModule] getRecentlyPlayed: song fallback fetched \(songResponse.items.count) songs, resolving albums...")

                let items = await self.groupSongsByAlbum(Array(songResponse.items), limit: limit)

                let duration = CFAbsoluteTimeGetCurrent() - startTime
                NSLog("[AppleMusicModule] getRecentlyPlayed: song fallback returned \(items.count) items in \(String(format: "%.2f", duration))s")

                resolve(["items": items, "total": items.count])
                return
            } catch {
                NSLog("[AppleMusicModule] getRecentlyPlayed: song recently-played API also failed (\(error.localizedDescription)), trying library fallback")
            }

            // Strategy 3: Fall back to library songs sorted by lastPlayedDate
            // This works when the MusicKit "recently played" APIs fail (iOS 26 beta bug)
            do {
                var libraryRequest = MusicLibraryRequest<Song>()
                libraryRequest.sort(by: \.lastPlayedDate, ascending: false)
                libraryRequest.limit = min(limit * 5, 50)
                let libraryResponse = try await libraryRequest.response()
                NSLog("[AppleMusicModule] getRecentlyPlayed: library fallback fetched \(libraryResponse.items.count) songs, resolving albums...")

                let items = await self.groupSongsByAlbum(Array(libraryResponse.items), limit: limit)

                let duration = CFAbsoluteTimeGetCurrent() - startTime
                NSLog("[AppleMusicModule] getRecentlyPlayed: library fallback returned \(items.count) items in \(String(format: "%.2f", duration))s")

                resolve(["items": items, "total": items.count])
            } catch {
                NSLog("[AppleMusicModule] getRecentlyPlayed: all 3 strategies failed: \(error.localizedDescription)")
                reject("RECENTLY_PLAYED_ERROR", "Failed to get recently played: \(error.localizedDescription)", error)
            }
        }
    }

    /// Group songs by album, resolving album relationships via `with(.albums)`.
    /// Shared by Strategy 2 (recently played songs) and Strategy 3 (library songs).
    private func groupSongsByAlbum(_ songs: [Song], limit: Int) async -> [[String: Any]] {
        var seenAlbums = Set<String>()
        var items: [[String: Any]] = []

        for song in songs {
            var albumId = ""
            var albumTitle = song.albumTitle ?? ""
            var albumArtworkUrl = ""
            var albumTrackCount = 0

            // Try to load the album relationship
            do {
                let detailedSong = try await song.with(.albums)
                if let album = detailedSong.albums?.first {
                    albumId = album.id.rawValue
                    albumTitle = album.title
                    albumTrackCount = album.trackCount
                    if let artwork = album.artwork,
                       let url = artwork.url(width: 300, height: 300) {
                        albumArtworkUrl = url.httpURLString
                    }
                }
            } catch {
                // Album relationship loading failed — use song-level data
            }

            // Fall back to song artwork if album artwork not available
            if albumArtworkUrl.isEmpty {
                if let artwork = song.artwork,
                   let url = artwork.url(width: 300, height: 300) {
                    albumArtworkUrl = url.httpURLString
                }
            }

            let albumKey = albumId.isEmpty ? "song-\(song.id.rawValue)" : albumId
            guard !seenAlbums.contains(albumKey) else { continue }
            seenAlbums.insert(albumKey)

            if !albumId.isEmpty {
                items.append([
                    "type": "album",
                    "id": albumId,
                    "title": albumTitle,
                    "subtitle": song.artistName,
                    "artworkUrl": albumArtworkUrl,
                    "trackCount": albumTrackCount,
                ])
            } else {
                items.append([
                    "type": "song",
                    "id": song.id.rawValue,
                    "title": song.title,
                    "subtitle": song.artistName,
                    "artworkUrl": albumArtworkUrl,
                    "trackCount": 0,
                ])
            }

            if items.count >= limit { break }
        }

        return items
    }

    /// Convert a RecentlyPlayedMusicItem enum to a dictionary for React Native
    private func recentlyPlayedItemToDictionary(_ item: RecentlyPlayedMusicItem) -> [String: Any]? {
        var artworkUrl = ""
        if let artwork = item.artwork,
           let url = artwork.url(width: 300, height: 300) {
            artworkUrl = url.httpURLString
        }

        switch item {
        case .album(let album):
            return [
                "type": "album",
                "id": album.id.rawValue,
                "title": album.title,
                "subtitle": album.artistName,
                "artworkUrl": artworkUrl,
                "trackCount": album.trackCount,
            ]
        case .playlist(let playlist):
            return [
                "type": "playlist",
                "id": playlist.id.rawValue,
                "title": playlist.name,
                "subtitle": playlist.curatorName ?? "",
                "artworkUrl": artworkUrl,
                "trackCount": 0,
            ]
        case .station(let station):
            return [
                "type": "station",
                "id": station.id.rawValue,
                "title": station.name,
                "subtitle": "",
                "artworkUrl": artworkUrl,
                "trackCount": 0,
            ]
        @unknown default:
            NSLog("[AppleMusicModule] Unknown RecentlyPlayedMusicItem case")
            return nil
        }
    }

    /// Get all albums from the user's library
    /// Returns ALL albums sorted by title (uses in-memory cache)
    @objc
    func getLibraryAlbums(_ limit: Int,
                          offset: Int,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Check if we have cached albums
                var cachedAlbums: [[String: Any]]?
                cacheQueue.sync {
                    cachedAlbums = libraryAlbumsCache
                }
                
                let allAlbums: [[String: Any]]
                
                if let cached = cachedAlbums {
                    NSLog("[AppleMusicModule] getLibraryAlbums: CACHE HIT - \(cached.count) albums")
                    allAlbums = cached
                } else {
                    NSLog("[AppleMusicModule] getLibraryAlbums: CACHE MISS - loading from MusicKit...")
                    
                    var request = MusicLibraryRequest<Album>()
                    request.sort(by: \.title, ascending: true)
                    let response = try await request.response()
                    
                    NSLog("[AppleMusicModule] getLibraryAlbums: MusicKit loaded \(response.items.count) albums")
                    
                    let albums = response.items.map { albumToDictionary($0) }
                    
                    cacheQueue.async { [weak self] in
                        self?.libraryAlbumsCache = albums
                        NSLog("[AppleMusicModule] getLibraryAlbums: Cached \(albums.count) albums")
                    }
                    
                    allAlbums = albums
                }

                // Return ALL albums — React Native handles display/filtering
                resolve([
                    "items": allAlbums,
                    "total": allAlbums.count,
                    "offset": 0,
                    "limit": allAlbums.count
                ])
            } catch {
                reject("LIBRARY_ERROR", "Failed to get library albums: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get all artists from the user's library
    /// Returns array of artists sorted by name
    @objc
    func getLibraryArtists(_ limit: Int,
                           offset: Int,
                           resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                var request = MusicLibraryRequest<Artist>()
                request.sort(by: \.name, ascending: true)
                let response = try await request.response()

                // Debug: log all playlist names to diagnose ghost playlists
                if offset == 0 {
                    NSLog("[AppleMusic] Total playlists from MusicKit: \(response.items.count)")
                    for (i, pl) in response.items.enumerated() {
                        NSLog("[AppleMusic] Playlist \(i+1): \"\(pl.name)\"")
                    }
                }

                // Apply pagination
                let startIndex = min(offset, response.items.count)
                let endIndex = min(offset + limit, response.items.count)
                let paginatedItems = Array(response.items[startIndex..<endIndex])

                let artists = paginatedItems.map { artistToDictionary($0) }

                resolve([
                    "items": artists,
                    "total": response.items.count,
                    "offset": offset,
                    "limit": limit
                ])
            } catch {
                reject("LIBRARY_ERROR", "Failed to get library artists: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get all playlists from the user's library
    /// Returns array of playlists sorted by name
    @objc
    func getLibraryPlaylists(_ limit: Int,
                             offset: Int,
                             resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                var request = MusicLibraryRequest<Playlist>()
                request.sort(by: \.name, ascending: true)
                let response = try await request.response()

                // Apply pagination
                let startIndex = min(offset, response.items.count)
                let endIndex = min(offset + limit, response.items.count)
                let paginatedItems = Array(response.items[startIndex..<endIndex])

                // Load entries for each playlist to get track count + fallback artwork
                var playlists: [[String: Any]] = []
                for playlist in paginatedItems {
                    var dict = playlistToDictionary(playlist)
                    // Load entries relationship to get track count
                    if let detailed = try? await playlist.with(.entries, preferredSource: .library) {
                        let entries = detailed.entries
                        dict["trackCount"] = entries?.count ?? 0
                        // Use first entry's artwork as fallback when playlist has no artwork
                        let currentArtwork = dict["artworkUrl"] as? String ?? ""
                        if currentArtwork.isEmpty, let firstEntry = entries?.first,
                           let entryArtwork = firstEntry.artwork,
                           let artworkUrl = entryArtwork.url(width: 300, height: 300) {
                            dict["artworkUrl"] = artworkUrl.httpURLString
                        }
                    } else {
                        dict["trackCount"] = 0
                    }
                    playlists.append(dict)
                }

                resolve([
                    "items": playlists,
                    "total": response.items.count,
                    "offset": offset,
                    "limit": limit
                ])
            } catch {
                reject("LIBRARY_ERROR", "Failed to get library playlists: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get library counts for all categories
    /// Returns counts for songs, albums, artists, playlists
    /// Uses in-memory cache for performance (23K+ items would take 5-10s otherwise)
    @objc
    func getLibraryCounts(_ resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        
        // Check cache first (synchronous read)
        var cachedCounts: [String: Int]?
        cacheQueue.sync {
            if libraryCache.isValid, let counts = libraryCache.counts {
                cachedCounts = counts
            }
        }
        
        // Return cached counts immediately if available
        if let counts = cachedCounts {
            NSLog("[AppleMusicModule] getLibraryCounts: returning cached counts")
            resolve(counts)
            return
        }
        
        // Cache miss - fetch fresh data
        NSLog("[AppleMusicModule] getLibraryCounts: cache miss, fetching fresh data")
        Task {
            do {
                let startTime = CFAbsoluteTimeGetCurrent()
                
                // Fetch counts for each category in parallel
                async let songsRequest = MusicLibraryRequest<Song>().response()
                async let albumsRequest = MusicLibraryRequest<Album>().response()
                async let artistsRequest = MusicLibraryRequest<Artist>().response()
                async let playlistsRequest = MusicLibraryRequest<Playlist>().response()

                let (songs, albums, artists, playlists) = try await (songsRequest, albumsRequest, artistsRequest, playlistsRequest)

                let counts: [String: Int] = [
                    "songs": songs.items.count,
                    "albums": albums.items.count,
                    "artists": artists.items.count,
                    "playlists": playlists.items.count
                ]
                
                let duration = CFAbsoluteTimeGetCurrent() - startTime
                NSLog("[AppleMusicModule] getLibraryCounts: fetched in \(String(format: "%.2f", duration))s: \(counts)")
                
                // Update cache
                self.cacheQueue.async { [weak self] in
                    guard let self = self else { return }
                    self.libraryCache.counts = counts
                    self.libraryCache.lastModified = MPMediaLibrary.default().lastModifiedDate
                    self.libraryCache.isValid = true
                    
                    // Persist cache date
                    UserDefaults.standard.set(self.libraryCache.lastModified, forKey: self.cacheModifiedDateKey)
                }
                
                resolve(counts)
            } catch {
                reject("LIBRARY_ERROR", "Failed to get library counts: \(error.localizedDescription)", error)
            }
        }
    }
    
    /// Force refresh the library cache (called after addToLibrary)
    /// Exposed to React Native for pull-to-refresh functionality
    @objc
    func refreshLibraryCache(_ resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        invalidateCache()
        
        Task {
            do {
                let startTime = CFAbsoluteTimeGetCurrent()
                
                // Fetch fresh counts
                async let songsRequest = MusicLibraryRequest<Song>().response()
                async let albumsRequest = MusicLibraryRequest<Album>().response()
                async let artistsRequest = MusicLibraryRequest<Artist>().response()
                async let playlistsRequest = MusicLibraryRequest<Playlist>().response()

                let (songs, albums, artists, playlists) = try await (songsRequest, albumsRequest, artistsRequest, playlistsRequest)

                let counts: [String: Int] = [
                    "songs": songs.items.count,
                    "albums": albums.items.count,
                    "artists": artists.items.count,
                    "playlists": playlists.items.count
                ]
                
                let duration = CFAbsoluteTimeGetCurrent() - startTime
                NSLog("[AppleMusicModule] refreshLibraryCache: complete in \(String(format: "%.2f", duration))s")
                
                // Update cache
                self.cacheQueue.async { [weak self] in
                    guard let self = self else { return }
                    self.libraryCache.counts = counts
                    self.libraryCache.lastModified = MPMediaLibrary.default().lastModifiedDate
                    self.libraryCache.isValid = true
                    UserDefaults.standard.set(self.libraryCache.lastModified, forKey: self.cacheModifiedDateKey)
                }
                
                resolve(counts)
            } catch {
                reject("LIBRARY_ERROR", "Failed to refresh library cache: \(error.localizedDescription)", error)
            }
        }
    }
}

// ============================================================
// MARK: - Collection Extension
// ============================================================

extension Collection {
    /// Safe subscript that returns nil for out-of-bounds indices
    subscript(safe index: Index) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
}

// ============================================================
// MARK: - URL Extension for MusicKit Artwork
// ============================================================

extension URL {
    /// Filters out musicKit:// URLs that React Native cannot load
    /// Only returns https:// URLs that can be displayed in Image components
    var httpURLString: String {
        // Quick path for http/https URLs
        if self.scheme == "https" || self.scheme == "http" {
            return self.absoluteString
        }

        // musicKit:// URLs: try to extract fallback HTTP URL from query parameters
        if self.scheme == "musicKit" {
            if let components = URLComponents(url: self, resolvingAgainstBaseURL: false) {
                // Try various known parameter names that contain fallback URLs
                let urlParamNames = ["fat", "u", "url"]
                for paramName in urlParamNames {
                    if let paramValue = components.queryItems?.first(where: { $0.name == paramName })?.value,
                       let decodedURL = paramValue.removingPercentEncoding,
                       !decodedURL.isEmpty {
                        return decodedURL
                    }
                }
                
                // Try 'aat' (Apple Art Template) parameter - contains path to artwork
                // Format: Music122/v4/37/25/f5/3725f515-249f-7b91-77bb-f479cd48201c/22UMGIM32254.rgb.jpg
                if let aatParam = components.queryItems?.first(where: { $0.name == "aat" })?.value,
                   let decodedPath = aatParam.removingPercentEncoding,
                   !decodedPath.isEmpty {
                    // Construct full Apple Music artwork URL from the path
                    // Apple Music uses is1-ssl.mzstatic.com for artwork
                    let fullUrl = "https://is1-ssl.mzstatic.com/image/thumb/\(decodedPath)/300x300bb.jpg"
                    return fullUrl
                }
            }
        }

        // musicKit:// URLs or unsupported schemes - return empty
        // musicKit:// URLs don't work in React Native Image component
        return ""
    }
}
