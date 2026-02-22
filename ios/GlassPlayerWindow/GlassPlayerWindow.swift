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

    // ============================================================
    // MARK: Layout Constants
    // ============================================================

    private let miniPlayerHeight: CGFloat = 80

    private var safeAreaBottom: CGFloat {
        safeAreaInsets.bottom
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
        // Place above main app window
        windowLevel = .normal + 1

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

        // Mini player content
        glassView.addSubview(miniPlayerView)
        miniPlayerView.translatesAutoresizingMaskIntoConstraints = false
        miniPlayerView.delegate = self

        // Full player content (hidden initially)
        glassView.addSubview(fullPlayerView)
        fullPlayerView.translatesAutoresizingMaskIntoConstraints = false
        fullPlayerView.delegate = self
        fullPlayerView.isHidden = true
        fullPlayerView.alpha = 0
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
        updateContent(config)

        guard currentState == .hidden else {
            // Already showing, just update content
            return
        }

        let screenBounds = UIScreen.main.bounds
        let windowHeight = miniPlayerHeight + safeAreaBottom

        // Position at bottom of screen
        frame = CGRect(
            x: 0,
            y: screenBounds.height - windowHeight,
            width: screenBounds.width,
            height: windowHeight
        )

        // Layout views
        layoutViewsForMini()

        // Show with animation
        alpha = 0
        isHidden = false

        UIView.animate(withDuration: 0.3, delay: 0, options: .curveEaseOut) {
            self.alpha = 1
        }

        currentState = .mini
        NSLog("[GlassPlayer] Showing mini player")
    }

    func expandToFull() {
        guard currentState == .mini else { return }

        let screenBounds = UIScreen.main.bounds

        // Prepare full player
        fullPlayerView.isHidden = false
        fullPlayerView.alpha = 0
        fullPlayerView.frame = screenBounds

        // Animate expansion
        UIView.animate(
            withDuration: 0.4,
            delay: 0,
            usingSpringWithDamping: 0.85,
            initialSpringVelocity: 0.5,
            options: .curveEaseInOut
        ) {
            // Expand window to full screen
            self.frame = screenBounds
            self.glassView.frame = screenBounds

            // Layout full player
            self.layoutViewsForFull()

            // Fade transition
            self.miniPlayerView.alpha = 0
            self.fullPlayerView.alpha = 1
        } completion: { _ in
            self.miniPlayerView.isHidden = true
            self.currentState = .full
            NSLog("[GlassPlayer] Expanded to full player")
        }
    }

    func collapseToMini() {
        guard currentState == .full else { return }

        let screenBounds = UIScreen.main.bounds
        let windowHeight = miniPlayerHeight + safeAreaBottom
        let miniFrame = CGRect(
            x: 0,
            y: screenBounds.height - windowHeight,
            width: screenBounds.width,
            height: windowHeight
        )

        // Prepare mini player
        miniPlayerView.isHidden = false
        miniPlayerView.alpha = 0

        // Animate collapse
        UIView.animate(
            withDuration: 0.35,
            delay: 0,
            usingSpringWithDamping: 0.9,
            initialSpringVelocity: 0.3,
            options: .curveEaseInOut
        ) {
            // Collapse window
            self.frame = miniFrame
            self.glassView.frame = CGRect(origin: .zero, size: miniFrame.size)

            // Layout mini player
            self.layoutViewsForMini()

            // Fade transition
            self.fullPlayerView.alpha = 0
            self.miniPlayerView.alpha = 1
        } completion: { _ in
            self.fullPlayerView.isHidden = true
            self.currentState = .mini
            NSLog("[GlassPlayer] Collapsed to mini player")
        }
    }

    func hide() {
        guard currentState != .hidden else { return }

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
        guard let rootView = rootViewController?.view else { return }

        glassView.frame = rootView.bounds
        miniPlayerView.frame = CGRect(
            x: 0,
            y: 0,
            width: rootView.bounds.width,
            height: miniPlayerHeight
        )
    }

    private func layoutViewsForFull() {
        guard let rootView = rootViewController?.view else { return }

        glassView.frame = rootView.bounds
        fullPlayerView.frame = rootView.bounds
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
    }

    func updatePlaybackState(_ state: NSDictionary) {
        let playbackState = PlaybackState(from: state)
        miniPlayerView.updatePlaybackState(
            isPlaying: playbackState.isPlaying,
            progress: playbackState.progress,
            showStopButton: playbackState.showStopButton
        )
        fullPlayerView.updatePlaybackState(
            isPlaying: playbackState.isPlaying,
            position: playbackState.position,
            duration: playbackState.duration,
            isFavorite: playbackState.isFavorite
        )
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
        // Speed change handled by React Native via event
        // Could add event emission here if needed
    }
    
    func fullPlayerDidSetSleepTimer(_ minutes: Int?) {
        // Sleep timer handled by React Native via event
        // Could add event emission here if needed
    }
    
    func fullPlayerDidTapFavorite() {
        // Favorite toggle handled by React Native via event
        // Could add event emission here if needed
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
        artwork = config["artwork"] as? String
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
    let showStopButton: Bool
    let isFavorite: Bool

    init(from state: NSDictionary) {
        isPlaying = state["isPlaying"] as? Bool ?? false
        progress = (state["progress"] as? NSNumber)?.floatValue
        position = (state["position"] as? NSNumber)?.floatValue
        duration = (state["duration"] as? NSNumber)?.floatValue
        showStopButton = state["showStopButton"] as? Bool ?? false
        isFavorite = state["isFavorite"] as? Bool ?? false
        isLoading = state["isLoading"] as? Bool ?? false
        isBuffering = state["isBuffering"] as? Bool ?? false
    }
}
