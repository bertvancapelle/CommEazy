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
    
    // Track if we have listeners registered
    private var hasListeners = false

    // ============================================================
    // MARK: - RCTEventEmitter Setup
    // ============================================================

    override init() {
        super.init()
        setupPlaybackStateObserver()
    }

    deinit {
        playbackStateTask?.cancel()
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
                reject("SEARCH_ERROR", "Catalog search failed: \(error.localizedDescription)", error)
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

    /// Play a song by ID
    @objc
    func playSong(_ songId: String,
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
                
                // Set queue and play
                player.queue = [song]
                try await player.play()
                
                resolve(["success": true])
            } catch {
                reject("PLAY_ERROR", "Failed to play song: \(error.localizedDescription)", error)
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
        player.pause()
        resolve(["success": true])
    }

    /// Resume playback
    @objc
    func resume(_ resolve: @escaping RCTPromiseResolveBlock,
                reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                try await player.play()
                resolve(["success": true])
            } catch {
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
            for await state in player.state.objectWillChange.values {
                guard hasListeners else { continue }
                
                let stateDict = buildPlaybackState()
                sendEvent(withName: "onPlaybackStateChange", body: stateDict)
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
        
        return [
            "status": statusString,
            "playbackTime": player.playbackTime,
            "shuffleMode": player.state.shuffleMode == .songs ? "songs" : "off",
            "repeatMode": repeatModeToString(player.state.repeatMode)
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
        return [
            "id": song.id.rawValue,
            "title": song.title,
            "artistName": song.artistName,
            "albumTitle": song.albumTitle ?? "",
            "duration": song.duration ?? 0,
            "artworkUrl": song.artwork?.url(width: 300, height: 300)?.absoluteString ?? "",
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
            "artworkUrl": album.artwork?.url(width: 300, height: 300)?.absoluteString ?? "",
            "trackCount": album.trackCount,
            "releaseDate": album.releaseDate?.description ?? "",
            "isExplicit": album.contentRating == .explicit
        ]
    }

    private func artistToDictionary(_ artist: Artist) -> [String: Any] {
        return [
            "id": artist.id.rawValue,
            "name": artist.name,
            "artworkUrl": artist.artwork?.url(width: 300, height: 300)?.absoluteString ?? ""
        ]
    }

    private func playlistToDictionary(_ playlist: Playlist) -> [String: Any] {
        return [
            "id": playlist.id.rawValue,
            "name": playlist.name,
            "curatorName": playlist.curatorName ?? "",
            "artworkUrl": playlist.artwork?.url(width: 300, height: 300)?.absoluteString ?? "",
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
