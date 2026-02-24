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

// ============================================================
// MARK: - AppleMusicModule (RCT Bridge Module)
// ============================================================

@objc(AppleMusicModule)
class AppleMusicModule: RCTEventEmitter {

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
    // Minimum interval between state events (100ms)
    private let minStateEventInterval: CFAbsoluteTime = 0.1

    // ============================================================
    // MARK: - RCTEventEmitter Setup
    // ============================================================

    override init() {
        super.init()
        setupPlaybackStateObserver()
        setupQueueObserver()
    }

    deinit {
        playbackStateTask?.cancel()
        queueObservationTask?.cancel()
        stopTimeUpdateTimer()
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
            "onAuthorizationStatusChange"
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

                NSLog("[AppleMusicModule] Found song: '\(song.title)' by \(song.artistName), duration: \(song.duration ?? 0)s")

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

                NSLog("[AppleMusicModule] Found library song: '\(song.title)' by \(song.artistName)")

                // Set queue and play
                player.queue = [song]
                try await player.play()

                NSLog("[AppleMusicModule] Library song playing successfully")

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
                reject("PLAY_ERROR", "Failed to play library song: \(error.localizedDescription)", error)
            }
        }
    }

    /// Play an album by ID
    @objc
    func playAlbum(_ albumId: String,
                   startIndex: Int,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Fetch the album with tracks
                var request = MusicCatalogResourceRequest<Album>(matching: \.id, equalTo: MusicItemID(albumId))
                request.properties = [.tracks]
                let response = try await request.response()
                
                guard let album = response.items.first,
                      let tracks = album.tracks else {
                    reject("ALBUM_NOT_FOUND", "Album with ID \(albumId) not found", nil)
                    return
                }
                
                // Set queue with all tracks
                player.queue = ApplicationMusicPlayer.Queue(for: tracks, startingAt: tracks[safe: startIndex])
                try await player.play()
                
                resolve(["success": true])
            } catch {
                reject("PLAY_ERROR", "Failed to play album: \(error.localizedDescription)", error)
            }
        }
    }

    /// Play a playlist by ID
    @objc
    func playPlaylist(_ playlistId: String,
                      startIndex: Int,
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Fetch the playlist with tracks
                var request = MusicCatalogResourceRequest<Playlist>(matching: \.id, equalTo: MusicItemID(playlistId))
                request.properties = [.tracks]
                let response = try await request.response()
                
                guard let playlist = response.items.first,
                      let tracks = playlist.tracks else {
                    reject("PLAYLIST_NOT_FOUND", "Playlist with ID \(playlistId) not found", nil)
                    return
                }
                
                // Set queue with all tracks
                player.queue = ApplicationMusicPlayer.Queue(for: tracks, startingAt: tracks[safe: startIndex])
                try await player.play()
                
                resolve(["success": true])
            } catch {
                reject("PLAY_ERROR", "Failed to play playlist: \(error.localizedDescription)", error)
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
            player.state.repeatMode = .none
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
                
                // DEBOUNCING: Only emit if status actually changed OR enough time has passed
                let now = CFAbsoluteTimeGetCurrent()
                let statusChanged = (status != lastEmittedStatus)
                let enoughTimePassed = (now - lastStateEventTime) >= minStateEventInterval
                
                if statusChanged || enoughTimePassed {
                    // Only log when actually emitting to reduce noise
                    if statusChanged {
                        NSLog("[AppleMusicModule] Playback status changed: \(lastEmittedStatus ?? "nil") -> \(status)")
                    }
                    
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
                }

                // Also check if now playing changed (always check, regardless of debouncing)
                checkNowPlayingChange()
            }
        }
    }

    // ============================================================
    // MARK: - Periodic Time Update Timer
    // ============================================================

    /// Start periodic timer to send time updates every 500ms while playing
    private func startTimeUpdateTimer() {
        // Don't start if already running
        guard timeUpdateTimer == nil else { return }

        NSLog("[AppleMusicModule] Starting time update timer")
        timeUpdateTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self, self.hasListeners else { return }

            // Only send updates while playing
            guard self.player.state.playbackStatus == .playing else {
                self.stopTimeUpdateTimer()
                return
            }

            let stateDict = self.buildPlaybackState()
            self.sendEvent(withName: "onPlaybackStateChange", body: stateDict)
        }
        // Add to common run loop mode to ensure timer fires during UI interactions
        RunLoop.main.add(timeUpdateTimer!, forMode: .common)
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

    private func repeatModeToString(_ mode: MusicPlayer.RepeatMode?) -> String {
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
        NSLog("[AppleMusicModule] songToDictionary called for: '\(song.title)' by \(song.artistName)")
        
        // Get artwork URL - try multiple approaches
        var artworkURL = ""
        var artworkBgColor = ""
        
        if let artwork = song.artwork {
            NSLog("[AppleMusicModule] Song '\(song.title)' HAS artwork object")
            
            // Get background color for fallback (if no URL available)
            if let bgColor = artwork.backgroundColor,
               let components = bgColor.components,
               components.count >= 3 {
                artworkBgColor = String(format: "#%02X%02X%02X",
                    Int(components[0] * 255),
                    Int(components[1] * 255),
                    Int(components[2] * 255))
                NSLog("[AppleMusicModule] Song '\(song.title)' has bgColor: \(artworkBgColor)")
            }
            
            // Try to get URL
            if let url = artwork.url(width: 300, height: 300) {
                NSLog("[AppleMusicModule] Song '\(song.title)' artwork.url() returned: \(url.absoluteString.prefix(150))")
                let httpUrl = url.httpURLString
                if !httpUrl.isEmpty {
                    artworkURL = httpUrl
                    NSLog("[AppleMusicModule] Song '\(song.title)' final artworkURL: \(artworkURL.prefix(100))")
                } else {
                    NSLog("[AppleMusicModule] Song '\(song.title)': httpURLString returned empty")
                }
            } else {
                NSLog("[AppleMusicModule] Song '\(song.title)' artwork.url(width:height:) returned nil!")
            }
        } else {
            NSLog("[AppleMusicModule] Song '\(song.title)' has NO artwork object (nil)")
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
    @objc
    func getAlbumDetails(_ albumId: String,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Fetch the album with tracks
                var request = MusicCatalogResourceRequest<Album>(matching: \.id, equalTo: MusicItemID(albumId))
                request.properties = [.tracks, .artists]
                let response = try await request.response()

                guard let album = response.items.first else {
                    reject("ALBUM_NOT_FOUND", "Album with ID \(albumId) not found", nil)
                    return
                }

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
            } catch {
                reject("ALBUM_ERROR", "Failed to get album details: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get artist details including top songs and albums
    /// Returns artist info + topSongs array + albums array
    @objc
    func getArtistDetails(_ artistId: String,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Fetch the artist with related content
                var request = MusicCatalogResourceRequest<Artist>(matching: \.id, equalTo: MusicItemID(artistId))
                request.properties = [.topSongs, .albums]
                let response = try await request.response()

                guard let artist = response.items.first else {
                    reject("ARTIST_NOT_FOUND", "Artist with ID \(artistId) not found", nil)
                    return
                }

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
            } catch {
                reject("ARTIST_ERROR", "Failed to get artist details: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get playlist details including all tracks
    /// Returns playlist info + array of songs
    @objc
    func getPlaylistDetails(_ playlistId: String,
                            resolve: @escaping RCTPromiseResolveBlock,
                            reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Fetch the playlist with tracks
                var request = MusicCatalogResourceRequest<Playlist>(matching: \.id, equalTo: MusicItemID(playlistId))
                request.properties = [.tracks]
                let response = try await request.response()

                guard let playlist = response.items.first else {
                    reject("PLAYLIST_NOT_FOUND", "Playlist with ID \(playlistId) not found", nil)
                    return
                }

                var result = playlistToDictionary(playlist)

                // Add tracks (Track is an enum that can be Song or MusicVideo)
                if let tracks = playlist.tracks {
                    result["tracks"] = tracks.map { trackToDictionary($0) }
                } else {
                    result["tracks"] = []
                }

                resolve(result)
            } catch {
                reject("PLAYLIST_ERROR", "Failed to get playlist details: \(error.localizedDescription)", error)
            }
        }
    }

    // ============================================================
    // MARK: - Library Management
    // ============================================================

    /// Add a song to the user's library
    /// Requires Apple Music subscription
    @objc
    func addToLibrary(_ songId: String,
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Fetch the song first
                var request = MusicCatalogResourceRequest<Song>(matching: \.id, equalTo: MusicItemID(songId))
                let response = try await request.response()

                guard let song = response.items.first else {
                    reject("SONG_NOT_FOUND", "Song with ID \(songId) not found", nil)
                    return
                }

                // Add to library
                try await MusicLibrary.shared.add(song)

                resolve(true)
            } catch {
                reject("ADD_TO_LIBRARY_ERROR", "Failed to add song to library: \(error.localizedDescription)", error)
            }
        }
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
    /// Returns array of songs sorted by title
    @objc
    func getLibrarySongs(_ limit: Int,
                         offset: Int,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                var request = MusicLibraryRequest<Song>()
                request.sort(by: \.title, ascending: true)
                let response = try await request.response()

                // Apply pagination
                let startIndex = min(offset, response.items.count)
                let endIndex = min(offset + limit, response.items.count)
                let paginatedItems = Array(response.items[startIndex..<endIndex])

                let songs = paginatedItems.map { songToDictionary($0) }

                resolve([
                    "items": songs,
                    "total": response.items.count,
                    "offset": offset,
                    "limit": limit
                ])
            } catch {
                reject("LIBRARY_ERROR", "Failed to get library songs: \(error.localizedDescription)", error)
            }
        }
    }

    /// Get all albums from the user's library
    /// Returns array of albums sorted by title
    @objc
    func getLibraryAlbums(_ limit: Int,
                          offset: Int,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                var request = MusicLibraryRequest<Album>()
                request.sort(by: \.title, ascending: true)
                let response = try await request.response()

                // Apply pagination
                let startIndex = min(offset, response.items.count)
                let endIndex = min(offset + limit, response.items.count)
                let paginatedItems = Array(response.items[startIndex..<endIndex])

                let albums = paginatedItems.map { albumToDictionary($0) }

                resolve([
                    "items": albums,
                    "total": response.items.count,
                    "offset": offset,
                    "limit": limit
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

                let playlists = paginatedItems.map { playlistToDictionary($0) }

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
    @objc
    func getLibraryCounts(_ resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Fetch counts for each category in parallel
                async let songsRequest = MusicLibraryRequest<Song>().response()
                async let albumsRequest = MusicLibraryRequest<Album>().response()
                async let artistsRequest = MusicLibraryRequest<Artist>().response()
                async let playlistsRequest = MusicLibraryRequest<Playlist>().response()

                let (songs, albums, artists, playlists) = try await (songsRequest, albumsRequest, artistsRequest, playlistsRequest)

                resolve([
                    "songs": songs.items.count,
                    "albums": albums.items.count,
                    "artists": artists.items.count,
                    "playlists": playlists.items.count
                ])
            } catch {
                reject("LIBRARY_ERROR", "Failed to get library counts: \(error.localizedDescription)", error)
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
        NSLog("[AppleMusicModule] httpURLString called with URL: \(self.absoluteString.prefix(200))")
        NSLog("[AppleMusicModule] httpURLString scheme: \(self.scheme ?? "nil")")
        
        // Quick path for http/https URLs
        if self.scheme == "https" || self.scheme == "http" {
            NSLog("[AppleMusicModule] httpURLString: returning https/http URL directly")
            return self.absoluteString
        }

        // musicKit:// URLs contain a fallback URL in the 'fat' query parameter
        if self.scheme == "musicKit" {
            NSLog("[AppleMusicModule] httpURLString: musicKit scheme detected")
            if let components = URLComponents(url: self, resolvingAgainstBaseURL: false) {
                let paramNames = components.queryItems?.map { $0.name } ?? []
                NSLog("[AppleMusicModule] httpURLString: query params available: \(paramNames)")
                
                // Try 'fat' parameter first (fallback URL)
                if let fatParam = components.queryItems?.first(where: { $0.name == "fat" })?.value,
                   let decodedURL = fatParam.removingPercentEncoding {
                    NSLog("[AppleMusicModule] httpURLString: found 'fat' param: \(decodedURL.prefix(100))")
                    return decodedURL
                }
                
                // Try 'u' parameter (some MusicKit URLs use this)
                if let uParam = components.queryItems?.first(where: { $0.name == "u" })?.value,
                   let decodedURL = uParam.removingPercentEncoding {
                    NSLog("[AppleMusicModule] httpURLString: found 'u' param: \(decodedURL.prefix(100))")
                    return decodedURL
                }
                
                // Try 'url' parameter
                if let urlParam = components.queryItems?.first(where: { $0.name == "url" })?.value,
                   let decodedURL = urlParam.removingPercentEncoding {
                    NSLog("[AppleMusicModule] httpURLString: found 'url' param: \(decodedURL.prefix(100))")
                    return decodedURL
                }
                
                NSLog("[AppleMusicModule] httpURLString: no known URL param found in musicKit URL")
            }
        }

        // Last resort: return empty - can't use musicKit:// URLs in React Native
        NSLog("[AppleMusicModule] httpURLString: returning empty for scheme: \(self.scheme ?? "nil")")
        return ""
    }
}
