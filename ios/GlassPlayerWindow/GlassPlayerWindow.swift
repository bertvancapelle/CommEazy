/**
 * GlassPlayerWindow — UIWindow subclass for Liquid Glass Player
 *
 * A separate UIWindow that floats above the main React Native app content.
 * This enables real UIGlassEffect blur because the glass window can see
 * and blur the content in Window 1 (main app) below it.
 *
 * States:
 * - hidden: Window is not visible
 * - mini: Compact player bar at bottom of screen (80pt height)
 * - full: Full screen expanded player
 *
 * @see .claude/plans/LIQUID_GLASS_PLAYER_WINDOW.md
 */

import UIKit

// ============================================================
// MARK: - Event Delegate Protocol
// ============================================================

@objc protocol GlassPlayerWindowEventDelegate: AnyObject {
    func playerDidTapPlayPause()
    func playerDidTapStop()
    func playerDidTapExpand()
    func playerDidTapCollapse()
    func playerDidSeek(to position: Double)
    func playerDidSkipForward()
    func playerDidSkipBackward()
    func playerDidClose()
    func playerDidTapFavorite()
    func playerDidSetSleepTimer(_ minutes: NSNumber?)
    func playerDidChangeSpeed(_ speed: Float)
    func playerDidTapShuffle()
    func playerDidTapRepeat()
}

// ============================================================
// MARK: - GlassPlayerWindow
// ============================================================

@available(iOS 26.0, *)
class GlassPlayerWindow: UIWindow {

    // ============================================================
    // MARK: Types
    // ============================================================

    enum PlayerState {
        case hidden
        case mini
        case full
    }

    // ============================================================
    // MARK: Properties
    // ============================================================

    weak var eventDelegate: GlassPlayerWindowEventDelegate?

    private var currentState: PlayerState = .hidden
    private let glassView: GlassPlayerView
    private let miniPlayerView: MiniPlayerNativeView
    private let fullPlayerView: FullPlayerNativeView
    private var currentTintColor: UIColor?  // Store for shuffle/repeat coloring
    private var lastShownTitle: String = ""  // Track to detect content changes

    // ============================================================
    // MARK: Layout Constants
    // ============================================================

    private let miniPlayerHeight: CGFloat = 88  // Larger for better visibility and senior-inclusive design
    private let horizontalMargin: CGFloat = 16  // Side margins for floating effect
    private let bottomMargin: CGFloat = 20      // Space above safe area
    private let fullPlayerMargin: CGFloat = 16  // All-around margin for full player
    private let cornerRadius: CGFloat = 24      // Rounded corners

    private var safeAreaBottom: CGFloat {
        // Use window's safe area insets if available, otherwise get from scene
        let windowInsets = safeAreaInsets.bottom
        if windowInsets > 0 {
            return windowInsets
        }
        
        // Fallback: get safe area from the window scene
        if let scene = windowScene {
            // Use the first window's safe area as reference
            for window in scene.windows where window !== self {
                let insets = window.safeAreaInsets.bottom
                if insets > 0 {
                    return insets
                }
            }
        }
        
        // Final fallback: standard iPhone bottom safe area (home indicator)
        return 34
    }
    
    private var safeAreaTop: CGFloat {
        // Use window's safe area insets if available, otherwise get from scene
        let windowInsets = safeAreaInsets.top
        if windowInsets > 0 {
            return windowInsets
        }
        
        // Fallback: get safe area from the window scene
        if let scene = windowScene {
            for window in scene.windows where window !== self {
                let insets = window.safeAreaInsets.top
                if insets > 0 {
                    return insets
                }
            }
        }
        
        // Final fallback: Dynamic Island / notch safe area
        return 59
    }

    // ============================================================
    // MARK: Initialization
    // ============================================================

    override init(windowScene: UIWindowScene) {
        glassView = GlassPlayerView()
        miniPlayerView = MiniPlayerNativeView()
        fullPlayerView = FullPlayerNativeView()

        super.init(windowScene: windowScene)

        setupWindow()
        setupViews()
        setupGestures()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupWindow() {
        // Place above main app window AND React Native's window
        // UIWindow.Level.normal is 0, React Native uses this level
        // Use .statusBar level (1000) to ensure we're above everything except alerts
        windowLevel = .statusBar - 1  // 999, above RN but below system alerts

        // Start hidden
        isHidden = true

        // Clear background — glass effect provides visuals
        backgroundColor = .clear

        // Root view controller (required for UIWindow)
        let rootVC = UIViewController()
        rootVC.view.backgroundColor = .clear
        rootViewController = rootVC

        NSLog("[GlassPlayer] Window setup complete - windowLevel: \(windowLevel.rawValue)")
    }

    private func setupViews() {
        guard let rootView = rootViewController?.view else { return }

        // Glass container (fills window)
        rootView.addSubview(glassView)
        glassView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            glassView.leadingAnchor.constraint(equalTo: rootView.leadingAnchor),
            glassView.trailingAnchor.constraint(equalTo: rootView.trailingAnchor),
            glassView.topAnchor.constraint(equalTo: rootView.topAnchor),
            glassView.bottomAnchor.constraint(equalTo: rootView.bottomAnchor),
        ])

        // Mini player content (fills glass view, 80pt height at top)
        glassView.addSubview(miniPlayerView)
        miniPlayerView.translatesAutoresizingMaskIntoConstraints = false
        miniPlayerView.delegate = self
        NSLayoutConstraint.activate([
            miniPlayerView.leadingAnchor.constraint(equalTo: glassView.leadingAnchor),
            miniPlayerView.trailingAnchor.constraint(equalTo: glassView.trailingAnchor),
            miniPlayerView.topAnchor.constraint(equalTo: glassView.topAnchor),
            miniPlayerView.heightAnchor.constraint(equalToConstant: miniPlayerHeight),
        ])

        // Full player content (hidden initially, fills glass view)
        glassView.addSubview(fullPlayerView)
        fullPlayerView.translatesAutoresizingMaskIntoConstraints = false
        fullPlayerView.delegate = self
        fullPlayerView.isHidden = true
        fullPlayerView.alpha = 0
        NSLayoutConstraint.activate([
            fullPlayerView.leadingAnchor.constraint(equalTo: glassView.leadingAnchor),
            fullPlayerView.trailingAnchor.constraint(equalTo: glassView.trailingAnchor),
            fullPlayerView.topAnchor.constraint(equalTo: glassView.topAnchor),
            fullPlayerView.bottomAnchor.constraint(equalTo: glassView.bottomAnchor),
        ])
        
        NSLog("[GlassPlayer] setupViews complete - constraints activated")
    }

    private func setupGestures() {
        // Tap on mini player to expand
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleMiniPlayerTap))
        miniPlayerView.addGestureRecognizer(tapGesture)
    }

    @objc private func handleMiniPlayerTap() {
        guard currentState == .mini else { return }
        expandToFull()
        eventDelegate?.playerDidTapExpand()
    }

    // ============================================================
    // MARK: State Transitions
    // ============================================================

    func showMini(with config: NSDictionary) {
        // Check if content changed (new song)
        let newContent = PlayerContent(from: config)
        let contentChanged = newContent.title != lastShownTitle
        lastShownTitle = newContent.title
        
        // Reset sleep timer when showing NEW content (different song)
        if contentChanged {
            fullPlayerView.resetSleepTimer()
            NSLog("[GlassPlayer] showMini - new content, reset sleep timer")
        }
        
        updateContent(config)

        guard currentState == .hidden else {
            // Already showing, just update content
            NSLog("[GlassPlayer] showMini - already visible, just updating content")
            return
        }

        let screenBounds = UIScreen.main.bounds
        let bottomSafe = safeAreaBottom
        
        // Floating mini player: smaller with margins all around
        let playerWidth = screenBounds.width - (horizontalMargin * 2)
        let windowHeight = miniPlayerHeight + bottomMargin + bottomSafe

        // Position at bottom with margins
        let windowFrame = CGRect(
            x: horizontalMargin,
            y: screenBounds.height - windowHeight,
            width: playerWidth,
            height: miniPlayerHeight  // Just the player height, not including safe area
        )
        frame = windowFrame

        NSLog("[GlassPlayer] showMini - screenBounds: \(screenBounds), safeAreaBottom: \(bottomSafe), windowHeight: \(windowHeight), frame: \(windowFrame)")

        // Layout views
        layoutViewsForMini()

        // Make window visible FIRST, then animate alpha
        isHidden = false
        makeKeyAndVisible()
        alpha = 1  // Set to 1 directly (animation was skipped for debugging)

        // Log all windows to verify hierarchy
        if let scene = windowScene {
            NSLog("[GlassPlayer] All windows in scene:")
            for (index, window) in scene.windows.enumerated() {
                NSLog("[GlassPlayer]   Window \(index): level=\(window.windowLevel.rawValue), isHidden=\(window.isHidden), alpha=\(window.alpha), frame=\(window.frame)")
            }
        }

        currentState = .mini
        NSLog("[GlassPlayer] ✅ Mini player now visible - isHidden: \(isHidden), alpha: \(alpha), frame: \(frame), windowLevel: \(windowLevel.rawValue)")
    }

    func expandToFull() {
        guard currentState == .mini else { return }

        let screenBounds = UIScreen.main.bounds
        let topSafe = safeAreaTop
        let bottomSafe = safeAreaBottom
        
        // Full player floats below the module header
        // Module header height (from React Native) = 120pt including safe area
        let moduleHeaderHeight: CGFloat = 120
        let topOffset = topSafe + moduleHeaderHeight + fullPlayerMargin
        
        // Full player with margins all around for floating glass effect
        let fullFrame = CGRect(
            x: fullPlayerMargin,
            y: topOffset,
            width: screenBounds.width - (fullPlayerMargin * 2),
            height: screenBounds.height - topOffset - bottomSafe - fullPlayerMargin
        )

        // Step 1: Fade out mini player first
        UIView.animate(
            withDuration: 0.15,
            delay: 0,
            options: .curveEaseOut
        ) {
            self.miniPlayerView.alpha = 0
        } completion: { _ in
            // Step 2: Hide mini player and prepare full player
            self.miniPlayerView.isHidden = true
            self.fullPlayerView.isHidden = false
            self.fullPlayerView.alpha = 0
            
            // Step 3: Expand window and fade in full player
            UIView.animate(
                withDuration: 0.35,
                delay: 0,
                usingSpringWithDamping: 0.85,
                initialSpringVelocity: 0.5,
                options: .curveEaseInOut
            ) {
                self.frame = fullFrame
                self.layoutViewsForFull()
                self.fullPlayerView.alpha = 1
            } completion: { _ in
                self.currentState = .full
                NSLog("[GlassPlayer] Expanded to full player - frame: \(fullFrame)")
            }
        }
    }

    func collapseToMini() {
        guard currentState == .full else { return }

        let screenBounds = UIScreen.main.bounds
        let bottomSafe = safeAreaBottom
        let playerWidth = screenBounds.width - (horizontalMargin * 2)
        let windowHeight = miniPlayerHeight + bottomMargin + bottomSafe
        
        let miniFrame = CGRect(
            x: horizontalMargin,
            y: screenBounds.height - windowHeight,
            width: playerWidth,
            height: miniPlayerHeight
        )

        // IMPORTANT: First fade out full player, then resize window
        // This prevents the "shrinking full player" visual bug
        
        // Step 1: Fade out full player quickly
        UIView.animate(
            withDuration: 0.15,
            delay: 0,
            options: .curveEaseOut
        ) {
            self.fullPlayerView.alpha = 0
        } completion: { _ in
            // Step 2: Hide full player and show mini player
            self.fullPlayerView.isHidden = true
            self.miniPlayerView.isHidden = false
            self.miniPlayerView.alpha = 1
            
            // Step 3: Animate window collapse with mini player visible
            UIView.animate(
                withDuration: 0.3,
                delay: 0,
                usingSpringWithDamping: 0.85,
                initialSpringVelocity: 0.5,
                options: .curveEaseInOut
            ) {
                self.frame = miniFrame
                self.layoutViewsForMini()
            } completion: { _ in
                self.currentState = .mini
                NSLog("[GlassPlayer] Collapsed to mini player - frame: \(miniFrame)")
            }
        }
    }

    func hide() {
        guard currentState != .hidden else { return }

        // Reset sleep timer state when hiding player
        fullPlayerView.resetSleepTimer()

        UIView.animate(withDuration: 0.25) {
            self.alpha = 0
        } completion: { _ in
            self.isHidden = true
            self.currentState = .hidden
            NSLog("[GlassPlayer] Hidden")
        }
    }

    // ============================================================
    // MARK: Layout Helpers
    // ============================================================

    private func layoutViewsForMini() {
        guard let rootView = rootViewController?.view else {
            NSLog("[GlassPlayer] layoutViewsForMini - rootView is nil!")
            return
        }

        // Ensure rootView matches window bounds
        rootView.frame = bounds
        
        // Force layout update for Auto Layout constraints
        rootView.layoutIfNeeded()
        
        NSLog("[GlassPlayer] layoutViewsForMini - bounds: \(bounds), glassView.frame: \(glassView.frame), miniPlayerView.frame: \(miniPlayerView.frame)")
    }

    private func layoutViewsForFull() {
        guard let rootView = rootViewController?.view else { return }

        // Ensure rootView matches window bounds
        rootView.frame = bounds
        
        // Force layout update for Auto Layout constraints
        rootView.layoutIfNeeded()
        
        NSLog("[GlassPlayer] layoutViewsForFull - bounds: \(bounds)")
    }

    // ============================================================
    // MARK: Content Updates
    // ============================================================

    func updateContent(_ config: NSDictionary) {
        let content = PlayerContent(from: config)
        miniPlayerView.updateContent(
            title: content.title,
            subtitle: content.subtitle,
            artworkURL: content.artwork
        )
        fullPlayerView.updateContent(
            title: content.title,
            subtitle: content.subtitle,
            artworkURL: content.artwork
        )
        miniPlayerView.updateTintColor(content.tintColorHex)
        fullPlayerView.updateTintColor(content.tintColorHex)
        glassView.updateTintColor(content.tintColorHex)

        // Store tint color for shuffle/repeat button coloring
        currentTintColor = UIColor.fromHex(content.tintColorHex)
    }

    func updatePlaybackState(_ state: NSDictionary) {
        let playbackState = PlaybackState(from: state)
        miniPlayerView.updatePlaybackState(
            isPlaying: playbackState.isPlaying,
            isLoading: playbackState.isLoading,
            isBuffering: playbackState.isBuffering,
            progress: playbackState.progress,
            listenDuration: playbackState.listenDuration,
            showStopButton: playbackState.showStopButton
        )
        fullPlayerView.updatePlaybackState(
            isPlaying: playbackState.isPlaying,
            isLoading: playbackState.isLoading,
            isBuffering: playbackState.isBuffering,
            position: playbackState.position,
            duration: playbackState.duration,
            isFavorite: playbackState.isFavorite
        )

        // Update shuffle/repeat state
        fullPlayerView.updateShuffleRepeatState(
            shuffleMode: playbackState.shuffleMode,
            repeatMode: playbackState.repeatMode,
            tintColor: currentTintColor
        )
    }

    func configureControls(_ controls: NSDictionary) {
        NSLog("[GlassPlayer] configureControls called with: \(controls)")
        fullPlayerView.configure(controls: controls)
    }
}

// ============================================================
// MARK: - MiniPlayerNativeViewDelegate
// ============================================================

@available(iOS 26.0, *)
extension GlassPlayerWindow: MiniPlayerNativeViewDelegate {

    func miniPlayerDidTapPlayPause() {
        eventDelegate?.playerDidTapPlayPause()
    }

    func miniPlayerDidTapStop() {
        eventDelegate?.playerDidTapStop()
    }
    
    func miniPlayerDidTapExpand() {
        expandToFull()
        eventDelegate?.playerDidTapExpand()
    }
}

// ============================================================
// MARK: - FullPlayerNativeViewDelegate
// ============================================================

@available(iOS 26.0, *)
extension GlassPlayerWindow: FullPlayerNativeViewDelegate {

    func fullPlayerDidTapPlayPause() {
        eventDelegate?.playerDidTapPlayPause()
    }

    func fullPlayerDidTapStop() {
        eventDelegate?.playerDidTapStop()
    }

    func fullPlayerDidTapClose() {
        collapseToMini()
        eventDelegate?.playerDidTapCollapse()
    }

    func fullPlayerDidSeek(to position: Float) {
        eventDelegate?.playerDidSeek(to: Double(position))
    }

    func fullPlayerDidTapSkipForward() {
        eventDelegate?.playerDidSkipForward()
    }

    func fullPlayerDidTapSkipBackward() {
        eventDelegate?.playerDidSkipBackward()
    }
    
    func fullPlayerDidChangeSpeed(_ speed: Float) {
        eventDelegate?.playerDidChangeSpeed(speed)
    }
    
    func fullPlayerDidSetSleepTimer(_ minutes: Int?) {
        eventDelegate?.playerDidSetSleepTimer(minutes as NSNumber?)
    }
    
    func fullPlayerDidTapFavorite() {
        eventDelegate?.playerDidTapFavorite()
    }

    func fullPlayerDidTapShuffle() {
        eventDelegate?.playerDidTapShuffle()
    }

    func fullPlayerDidTapRepeat() {
        eventDelegate?.playerDidTapRepeat()
    }
}

// ============================================================
// MARK: - PlayerContent
// ============================================================

struct PlayerContent {
    let moduleId: String
    let tintColorHex: String
    let artwork: String?
    let title: String
    let subtitle: String?
    let progressType: String // "bar" or "duration"
    let progress: Double
    let listenDuration: Double
    let showStopButton: Bool

    init(from config: NSDictionary) {
        moduleId = config["moduleId"] as? String ?? "radio"
        tintColorHex = config["tintColorHex"] as? String ?? "#00897B"
        
        // Parse artwork URL - check what we received from React Native
        let rawArtwork = config["artwork"]
        if let artworkString = rawArtwork as? String {
            if artworkString.isEmpty {
                artwork = nil
                NSLog("[GlassPlayer] PlayerContent - artwork is EMPTY STRING")
            } else {
                artwork = artworkString
                NSLog("[GlassPlayer] PlayerContent - artwork URL: \(artworkString.prefix(100))...")
            }
        } else if rawArtwork == nil || rawArtwork is NSNull {
            artwork = nil
            NSLog("[GlassPlayer] PlayerContent - artwork is NULL")
        } else {
            artwork = nil
            NSLog("[GlassPlayer] PlayerContent - artwork has unexpected type: \(type(of: rawArtwork))")
        }
        
        title = config["title"] as? String ?? ""
        subtitle = config["subtitle"] as? String
        progressType = config["progressType"] as? String ?? "duration"
        progress = config["progress"] as? Double ?? 0
        listenDuration = config["listenDuration"] as? Double ?? 0
        showStopButton = config["showStopButton"] as? Bool ?? false
    }
}

// ============================================================
// MARK: - PlaybackState
// ============================================================

struct PlaybackState {
    let isPlaying: Bool
    let isLoading: Bool
    let isBuffering: Bool
    let progress: Float?
    let position: Float?
    let duration: Float?
    let listenDuration: TimeInterval?
    let showStopButton: Bool
    let isFavorite: Bool
    let shuffleMode: String  // "off" | "songs"
    let repeatMode: String   // "off" | "one" | "all"

    init(from state: NSDictionary) {
        isPlaying = state["isPlaying"] as? Bool ?? false
        progress = (state["progress"] as? NSNumber)?.floatValue
        position = (state["position"] as? NSNumber)?.floatValue
        duration = (state["duration"] as? NSNumber)?.floatValue
        listenDuration = (state["listenDuration"] as? NSNumber)?.doubleValue
        showStopButton = state["showStopButton"] as? Bool ?? false
        isFavorite = state["isFavorite"] as? Bool ?? false
        isLoading = state["isLoading"] as? Bool ?? false
        isBuffering = state["isBuffering"] as? Bool ?? false
        shuffleMode = state["shuffleMode"] as? String ?? "off"
        repeatMode = state["repeatMode"] as? String ?? "off"
        
        NSLog("[GlassPlayer] PlaybackState parsed - position: \(position ?? -1), duration: \(duration ?? -1), shuffle: \(shuffleMode), repeat: \(repeatMode)")
    }
}
