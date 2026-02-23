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

                // Send immediate state update
                if self.hasListeners {
                    let stateDict = self.buildPlaybackState()
                    NSLog("[AppleMusicModule] Sending initial playing state: \(stateDict)")
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

                // Send immediate state update
                if self.hasListeners {
                    let stateDict = self.buildPlaybackState()
                    NSLog("[AppleMusicModule] Sending initial playing state: \(stateDict)")
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

        // Send immediate state update
        if hasListeners {
            let stateDict = buildPlaybackState()
            NSLog("[AppleMusicModule] Sending paused state: \(stateDict)")
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

                // Send immediate state update
                if self.hasListeners {
                    let stateDict = self.buildPlaybackState()
                    NSLog("[AppleMusicModule] Sending playing state after resume: \(stateDict)")
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
                NSLog("[AppleMusicModule] Playback state changed: \(status), time: \(stateDict["currentTime"] ?? 0)")
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
            
            // Get artwork URL
            if let artwork = song.artwork {
                if let url = artwork.url(width: 300, height: 300) {
                    let httpUrl = url.httpURLString
                    NSLog("[AppleMusicModule] buildPlaybackState artwork URL: original=\(url.absoluteString), http=\(httpUrl)")
                    artworkUrl = httpUrl
                } else {
                    NSLog("[AppleMusicModule] buildPlaybackState: artwork.url() returned nil")
                }
            } else {
                NSLog("[AppleMusicModule] buildPlaybackState: no artwork available for '\(title)'")
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
            "artworkUrl": artworkUrl
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
        // Get artwork URL with detailed logging
        let artworkURL: String
        if let artwork = song.artwork {
            if let url = artwork.url(width: 300, height: 300) {
                let httpUrl = url.httpURLString
                NSLog("[AppleMusicModule] Artwork URL for '\(song.title)': original=\(url.absoluteString), http=\(httpUrl)")
                artworkURL = httpUrl
            } else {
                NSLog("[AppleMusicModule] Artwork URL for '\(song.title)': url(width:height:) returned nil")
                artworkURL = ""
            }
        } else {
            NSLog("[AppleMusicModule] Artwork for '\(song.title)': no artwork available")
            artworkURL = ""
        }
        
        return [
            "id": song.id.rawValue,
            "title": song.title,
            "artistName": song.artistName,
            "albumTitle": song.albumTitle ?? "",
            "duration": song.duration ?? 0,
            "artworkUrl": artworkURL,
            "trackNumber": song.trackNumber ?? 0,
            "discNumber": song.discNumber ?? 1,
            "isExplicit": song.contentRating == .explicit
        ]
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
        NSLog("[AppleMusicModule] httpURLString input: scheme=\(self.scheme ?? "nil"), url=\(self.absoluteString.prefix(100))")

        if self.scheme == "https" || self.scheme == "http" {
            NSLog("[AppleMusicModule] httpURLString: returning https/http URL directly")
            return self.absoluteString
        }

        // musicKit:// URLs contain a fallback URL in the 'fat' query parameter
        if self.scheme == "musicKit" {
            NSLog("[AppleMusicModule] httpURLString: musicKit scheme detected, looking for 'fat' param")
            if let components = URLComponents(url: self, resolvingAgainstBaseURL: false) {
                NSLog("[AppleMusicModule] httpURLString: queryItems count = \(components.queryItems?.count ?? 0)")
                if let fatParam = components.queryItems?.first(where: { $0.name == "fat" })?.value {
                    NSLog("[AppleMusicModule] httpURLString: found 'fat' param: \(fatParam.prefix(100))")
                    if let decodedURL = fatParam.removingPercentEncoding {
                        NSLog("[AppleMusicModule] httpURLString: decoded URL: \(decodedURL.prefix(100))")
                        return decodedURL
                    }
                } else {
                    // Log all query params for debugging
                    let params = components.queryItems?.map { "\($0.name)=\($0.value?.prefix(20) ?? "nil")" }.joined(separator: ", ") ?? "none"
                    NSLog("[AppleMusicModule] httpURLString: no 'fat' param found, available params: \(params)")
                }
            }
        }

        NSLog("[AppleMusicModule] httpURLString: returning empty string for scheme: \(self.scheme ?? "nil")")
        return ""
    }
}
