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
    func playerDidTapMinimize()
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
    private(set) var isMinimized: Bool = false   // True when hidden but audio still playing
    private var stateBeforeMinimize: PlayerState = .mini
    private let glassView: GlassPlayerView
    private let miniPlayerView: MiniPlayerNativeView
    private let fullPlayerView: FullPlayerNativeView
    private var currentTintColor: UIColor?  // Store for shuffle/repeat coloring
    private var lastShownTitle: String = ""  // Track to detect content changes
    
    /// Panel bounds from React Native (iPad Split View)
    /// When set, the player constrains itself to this region instead of full screen
    private var panelBounds: CGRect?
    
    /// Toolbar position from React Native (user setting: "top" or "bottom")
    /// Determines default mini player placement — "top" = mini at top, "bottom" = mini at bottom
    private var toolbarPosition: String = "top"
    
    /// User's dragged offset for mini player (persistent via UserDefaults)
    /// When nil, mini player uses default position based on toolbarPosition
    private var draggedMiniPlayerY: CGFloat?
    
    /// Key for UserDefaults persistence of dragged position
    private static let dragPositionKey = "commeazy_miniPlayerDraggedY"
    private static let dragToolbarKey = "commeazy_miniPlayerDragToolbar"

    // ============================================================
    // MARK: Layout Constants
    // ============================================================

    private let miniPlayerHeight: CGFloat = 88  // Larger for better visibility and senior-inclusive design
    private let horizontalMargin: CGFloat = 16  // Side margins for floating effect
    private let bottomMargin: CGFloat = 20      // Space above safe area
    private let topMargin: CGFloat = 20         // Space below safe area (toolbar at top)
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
        
        // Auto-enable minimize button on iPad
        // iPad users can minimize the Glass Player to return to pane navigation
        // iPhone users don't need this (single pane, Glass Player is always contextual)
        if UIDevice.current.userInterfaceIdiom == .pad {
            miniPlayerView.setMinimizeButtonVisible(true)
        }
    }

    private func setupGestures() {
        // NOTE: Do NOT add tap gesture here!
        // MiniPlayerNativeView handles its own gestures via delegate pattern.
        // Adding a gesture here would interfere with button touch handling.
    }

    // ============================================================
    // MARK: Touch Passthrough
    // ============================================================

    /// Override hitTest at window level to ensure touches outside the
    /// visible player content fall through to the React Native window below.
    /// Without this, the transparent window area would consume touches,
    /// making the entire app unresponsive.
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard !isHidden, alpha > 0.01 else { return nil }

        // Convert point to rootView coordinate space
        guard let rootView = rootViewController?.view else { return nil }
        let convertedPoint = convert(point, to: rootView)

        // Let the rootView's subviews (glassView → miniPlayer/fullPlayer) do their own hitTest.
        // If they return nil, the touch falls through to RN.
        let hitView = rootView.hitTest(convertedPoint, with: event)

        // If hitView is the rootView itself (not a subview), that means nothing
        // meaningful was hit — pass through to RN.
        if hitView === rootView {
            return nil
        }

        return hitView
    }

    /// Returns the effective bounds for positioning — panelBounds on iPad, screen bounds on iPhone
    private var effectiveBounds: CGRect {
        return panelBounds ?? UIScreen.main.bounds
    }
    
    /// Update panel bounds (called from React Native when iPad Split View changes)
    func updatePanelBounds(_ bounds: CGRect?) {
        panelBounds = bounds
        // Re-layout if currently visible
        if currentState != .hidden {
            restoreCorrectFrameForState()
        }
    }
    
    /// Update toolbar position (called from React Native when user changes setting)
    func updateToolbarPosition(_ position: String) {
        let oldPosition = toolbarPosition
        toolbarPosition = position
        
        // Reset dragged position when toolbar position changes (PNA decision)
        if oldPosition != position {
            clearDraggedPosition()
        }
        
        // Re-layout if currently visible
        if currentState != .hidden {
            restoreCorrectFrameForState()
        }
    }
    
    // ============================================================
    // MARK: Mini Player Frame Calculation
    // ============================================================
    
    /// Calculate the mini player frame based on toolbar position and optional drag offset
    private func calculateMiniFrame() -> CGRect {
        let bounds = effectiveBounds
        let playerWidth = bounds.width - (horizontalMargin * 2)
        
        // If user has dragged to a custom position, use that
        if let draggedY = draggedMiniPlayerY {
            return CGRect(
                x: bounds.origin.x + horizontalMargin,
                y: draggedY,
                width: playerWidth,
                height: miniPlayerHeight
            )
        }
        
        // Default position based on toolbar position
        let y: CGFloat
        if toolbarPosition == "bottom" {
            // Toolbar at bottom → mini player at TOP (below safe area + module header area)
            let topSafe = safeAreaTop
            // Module header height from React Native (safe area + header content)
            let moduleHeaderHeight: CGFloat = 120
            y = topSafe + moduleHeaderHeight + topMargin
        } else {
            // Toolbar at top (default) → mini player at BOTTOM (above safe area)
            let bottomSafe = safeAreaBottom
            let windowHeight = miniPlayerHeight + bottomMargin + bottomSafe
            y = bounds.origin.y + bounds.height - windowHeight
        }
        
        return CGRect(
            x: bounds.origin.x + horizontalMargin,
            y: y,
            width: playerWidth,
            height: miniPlayerHeight
        )
    }
    
    // ============================================================
    // MARK: Drag Position Persistence
    // ============================================================
    
    /// Load saved drag position from UserDefaults
    func loadDraggedPosition() {
        let defaults = UserDefaults.standard
        let savedToolbar = defaults.string(forKey: GlassPlayerWindow.dragToolbarKey)
        
        // Only restore if the saved toolbar position matches current
        if savedToolbar == toolbarPosition {
            let savedY = defaults.double(forKey: GlassPlayerWindow.dragPositionKey)
            if savedY > 0 {
                draggedMiniPlayerY = CGFloat(savedY)
            }
        }
    }
    
    /// Save drag position to UserDefaults
    private func saveDraggedPosition() {
        let defaults = UserDefaults.standard
        if let y = draggedMiniPlayerY {
            defaults.set(Double(y), forKey: GlassPlayerWindow.dragPositionKey)
            defaults.set(toolbarPosition, forKey: GlassPlayerWindow.dragToolbarKey)
        }
    }
    
    /// Clear saved drag position (called when toolbar position changes)
    private func clearDraggedPosition() {
        draggedMiniPlayerY = nil
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: GlassPlayerWindow.dragPositionKey)
        defaults.removeObject(forKey: GlassPlayerWindow.dragToolbarKey)
    }
    
    /// Set a new dragged Y position for the mini player
    /// Called from the drag gesture handler in MiniPlayerNativeView
    func setDraggedPosition(_ y: CGFloat) {
        // Clamp to ensure at least 50% visibility
        let bounds = effectiveBounds
        let minY = bounds.origin.y - (miniPlayerHeight / 2) // 50% off top
        let maxY = bounds.origin.y + bounds.height - (miniPlayerHeight / 2) // 50% off bottom
        
        draggedMiniPlayerY = min(max(y, minY), maxY)
        saveDraggedPosition()
    }
    
    /// Calculate the full player frame based on toolbar position
    private func calculateFullFrame() -> CGRect {
        let bounds = effectiveBounds
        let topSafe = safeAreaTop
        let bottomSafe = safeAreaBottom
        let moduleHeaderHeight: CGFloat = 120
        
        if toolbarPosition == "bottom" {
            // Toolbar at bottom: full player starts below safe area, ends above toolbar
            let topOffset = topSafe + fullPlayerMargin
            // Toolbar area ≈ moduleHeaderHeight from bottom
            let bottomOffset = bottomSafe + moduleHeaderHeight + fullPlayerMargin
            
            return CGRect(
                x: bounds.origin.x + fullPlayerMargin,
                y: topOffset,
                width: bounds.width - (fullPlayerMargin * 2),
                height: bounds.origin.y + bounds.height - topOffset - bottomOffset
            )
        } else {
            // Toolbar at top (default): full player starts below module header
            let topOffset = topSafe + moduleHeaderHeight + fullPlayerMargin
            
            return CGRect(
                x: bounds.origin.x + fullPlayerMargin,
                y: topOffset,
                width: bounds.width - (fullPlayerMargin * 2),
                height: bounds.origin.y + bounds.height - topOffset - bottomSafe - fullPlayerMargin
            )
        }
    }

    // ============================================================
    // MARK: State Transitions
    // ============================================================

    func showMini(with config: NSDictionary) {
        let newContent = PlayerContent(from: config)
        
        // Check if content changed (new song)
        let contentChanged = newContent.title != lastShownTitle
        lastShownTitle = newContent.title
        
        // Update panel bounds from config (iPad Split View)
        if let boundsDict = config["panelBounds"] as? NSDictionary,
           let x = boundsDict["x"] as? CGFloat,
           let y = boundsDict["y"] as? CGFloat,
           let width = boundsDict["width"] as? CGFloat,
           let height = boundsDict["height"] as? CGFloat {
            panelBounds = CGRect(x: x, y: y, width: width, height: height)
        }
        
        // Update toolbar position from config
        let newToolbarPosition = newContent.toolbarPosition
        if newToolbarPosition != toolbarPosition {
            updateToolbarPosition(newToolbarPosition)
        }
        
        // Reset sleep timer when showing NEW content (different song)
        if contentChanged {
            fullPlayerView.resetSleepTimer()
        }
        
        updateContent(config)

        guard currentState == .hidden else {
            // Already showing, just update content
            return
        }

        // Load any persisted drag position
        loadDraggedPosition()
        
        // Calculate position based on toolbar position + optional drag offset
        let windowFrame = calculateMiniFrame()
        frame = windowFrame



        // Ensure full player is hidden and mini player is visible
        fullPlayerView.isHidden = true
        fullPlayerView.alpha = 0
        miniPlayerView.isHidden = false
        miniPlayerView.alpha = 1
        
        // Layout views
        layoutViewsForMini()

        // Cancel any in-progress hide animation before making visible.
        // Without this, a concurrent hide() fade-out animation can override our alpha = 1.
        self.layer.removeAllAnimations()
        
        // Make window visible WITHOUT stealing key window status.
        // Using makeKeyAndVisible() would steal key window from React Native,
        // causing ALL touches to route here first — blocking the entire app.
        isHidden = false
        alpha = 1

        currentState = .mini
    }

    func expandToFull() {
        guard currentState == .mini else { return }
        
        // Set state IMMEDIATELY to prevent race conditions.
        // If collapseToMini() is called during animation, it needs to see .full.
        currentState = .full

        // Calculate full player frame based on toolbar position
        let fullFrame = calculateFullFrame()

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
            }
        }
    }

    func collapseToMini() {
        guard currentState == .full else { return }
        
        // Set state IMMEDIATELY to prevent race conditions.
        // If hide() or expandToFull() is called during animation, it needs to see .mini.
        currentState = .mini

        let miniFrame = calculateMiniFrame()

        // Cancel any in-progress expand animations to prevent visual glitches
        self.layer.removeAllAnimations()
        glassView.layer.removeAllAnimations()
        miniPlayerView.layer.removeAllAnimations()
        fullPlayerView.layer.removeAllAnimations()
        
        // Immediately switch views — no animated fade for snappy response
        fullPlayerView.isHidden = true
        fullPlayerView.alpha = 0
        miniPlayerView.isHidden = false
        miniPlayerView.alpha = 1
        
        // Animate window collapse with mini player visible
        UIView.animate(
            withDuration: 0.3,
            delay: 0,
            usingSpringWithDamping: 0.85,
            initialSpringVelocity: 0.5,
            options: .curveEaseInOut
        ) {
            self.frame = miniFrame
            self.layoutViewsForMini()
        }
    }

    func hide() {
        guard currentState != .hidden else { return }

        // Reset sleep timer state when hiding player
        fullPlayerView.resetSleepTimer()
        
        // Set state to hidden IMMEDIATELY (before animation) to prevent race conditions.
        // If showMini() is called during the fade-out animation, the guard
        // `currentState == .hidden` must pass so the window can be re-shown.
        currentState = .hidden
        isMinimized = false

        // Cancel any in-progress animations to prevent stale completion handlers
        self.layer.removeAllAnimations()

        UIView.animate(withDuration: 0.25) {
            self.alpha = 0
        } completion: { _ in
            // Only hide the window if state is still .hidden.
            // If showMini() was called during the fade-out animation,
            // currentState will be .mini and we must NOT set isHidden = true
            // (that would undo the showMini call).
            if self.currentState == .hidden {
                self.isHidden = true
            }
        }
    }
    
    /// Minimize the player — hide the UIWindow without stopping audio.
    /// The player can be brought back via showFromMinimized().
    /// Used on iPad when user taps the minimize button.
    func minimize() {
        guard currentState != .hidden else { return }
        
        // If full player is showing, collapse to mini first visually, then hide
        stateBeforeMinimize = currentState
        isMinimized = true
        
        UIView.animate(withDuration: 0.2) {
            self.alpha = 0
        } completion: { _ in
            self.isHidden = true
            // Keep currentState as-is so we can restore it
        }
    }
    
    /// Show the player from minimized state.
    /// Restores to mini player state (even if it was full before minimizing).
    func showFromMinimized() {
        guard isMinimized else { return }
        
        isMinimized = false
        
        // Always restore to mini state for simplicity
        let miniFrame = calculateMiniFrame()
        frame = miniFrame
        miniPlayerView.isHidden = false
        miniPlayerView.alpha = 1
        fullPlayerView.isHidden = true
        fullPlayerView.alpha = 0
        layoutViewsForMini()
        currentState = .mini
        
        // Show with animation — do NOT call makeKeyAndVisible()
        // to avoid stealing key window from React Native
        alpha = 0
        isHidden = false
        
        UIView.animate(withDuration: 0.25) {
            self.alpha = 1
        }
    }

    /// Temporarily hide/show the player window (e.g., when navigation menu is open)
    /// This does NOT change state - it just hides the window visually
    func setTemporarilyHidden(_ hidden: Bool) {
        guard currentState != .hidden else { return }  // Only affects visible players

        if hidden {
            UIView.animate(withDuration: 0.15) {
                self.alpha = 0
            }
        } else {
            // Restore correct frame and layout based on current state BEFORE animating alpha
            restoreCorrectFrameForState()
            
            UIView.animate(withDuration: 0.2) {
                self.alpha = 1
            }
        }
    }
    
    /// Restore the correct window frame and view layout for the current state
    /// Called when restoring from temporary hide to ensure visual consistency
    private func restoreCorrectFrameForState() {
        switch currentState {
        case .mini:
            // Restore mini player frame using toolbar-aware calculation
            let miniFrame = calculateMiniFrame()
            frame = miniFrame
            miniPlayerView.isHidden = false
            miniPlayerView.alpha = 1
            fullPlayerView.isHidden = true
            fullPlayerView.alpha = 0
            layoutViewsForMini()
            
        case .full:
            // Restore full player frame using toolbar-aware calculation
            let fullFrame = calculateFullFrame()
            frame = fullFrame
            miniPlayerView.isHidden = true
            miniPlayerView.alpha = 0
            fullPlayerView.isHidden = false
            fullPlayerView.alpha = 1
            layoutViewsForFull()
            
        case .hidden:
            // Should not reach here due to guard, but handle anyway
            break
        }
    }

    // ============================================================
    // MARK: Layout Helpers
    // ============================================================

    private func layoutViewsForMini() {
        guard let rootView = rootViewController?.view else { return }

        // Ensure rootView matches window bounds
        rootView.frame = bounds
        
        // Force layout update for Auto Layout constraints
        rootView.layoutIfNeeded()
    }

    private func layoutViewsForFull() {
        guard let rootView = rootViewController?.view else { return }

        // Ensure rootView matches window bounds
        rootView.frame = bounds
        
        // Force layout update for Auto Layout constraints
        rootView.layoutIfNeeded()
    }

    // ============================================================
    // MARK: Content Updates
    // ============================================================

    func updateContent(_ config: NSDictionary) {
        let content = PlayerContent(from: config)
        
        // Debug logging for artwork issue
        NSLog("[GlassPlayer] updateContent - artwork: \(content.artwork ?? "nil")")
        
        miniPlayerView.updateContent(
            title: content.title,
            subtitle: content.subtitle,
            artworkURL: content.artwork,
            showStopButton: content.showStopButton
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
            listenDuration: playbackState.listenDuration
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
        fullPlayerView.configure(controls: controls)
    }
    
    /// Enable or disable the minimize button on the mini player (iPad only)
    func setMinimizeButtonVisible(_ visible: Bool) {
        miniPlayerView.setMinimizeButtonVisible(visible)
    }
    
    /// Configure button border styling (user setting)
    /// @param borderEnabled Whether to show button borders
    /// @param borderColorHex Hex color for button borders (e.g., "#FFFFFF")
    func configureButtonStyle(borderEnabled: Bool, borderColorHex: String) {
        miniPlayerView.configureButtonStyle(borderEnabled: borderEnabled, borderColorHex: borderColorHex)
        fullPlayerView.configureButtonStyle(borderEnabled: borderEnabled, borderColorHex: borderColorHex)
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
    
    func miniPlayerDidTapMinimize() {
        minimize()
        eventDelegate?.playerDidTapMinimize()
    }

    func miniPlayerDidSwipeDown() {
        // Swipe-down on mini player behaves the same as minimize
        minimize()
        eventDelegate?.playerDidTapMinimize()
    }
    
    func miniPlayerDidDrag(toY newY: CGFloat) {
        guard currentState == .mini else { return }
        
        // Update the dragged position (clamps to 50% visibility)
        setDraggedPosition(newY)
        
        // Move the window frame to the new position
        var newFrame = frame
        newFrame.origin.y = draggedMiniPlayerY ?? newY
        frame = newFrame
    }
    
    func miniPlayerDidEndDrag() {
        // Position is already saved in setDraggedPosition via saveDraggedPosition
        // Nothing extra needed — the position persists in UserDefaults
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
    let panelBounds: CGRect?
    let toolbarPosition: String // "top" or "bottom"

    init(from config: NSDictionary) {
        moduleId = config["moduleId"] as? String ?? "radio"
        tintColorHex = config["tintColorHex"] as? String ?? "#00897B"
        toolbarPosition = config["toolbarPosition"] as? String ?? "top"
        
        // Parse artwork URL
        let rawArtwork = config["artwork"]
        if let artworkString = rawArtwork as? String, !artworkString.isEmpty {
            artwork = artworkString
        } else {
            artwork = nil
        }
        
        title = config["title"] as? String ?? ""
        subtitle = config["subtitle"] as? String
        progressType = config["progressType"] as? String ?? "duration"
        progress = config["progress"] as? Double ?? 0
        listenDuration = config["listenDuration"] as? Double ?? 0
        showStopButton = config["showStopButton"] as? Bool ?? true
        
        // Parse panel bounds for iPad Split View
        if let boundsDict = config["panelBounds"] as? NSDictionary,
           let x = boundsDict["x"] as? CGFloat,
           let y = boundsDict["y"] as? CGFloat,
           let width = boundsDict["width"] as? CGFloat,
           let height = boundsDict["height"] as? CGFloat {
            panelBounds = CGRect(x: x, y: y, width: width, height: height)
        } else {
            panelBounds = nil
        }
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
    // showStopButton removed — now controlled via PlayerContent only (single source of truth)
    let isFavorite: Bool
    let shuffleMode: String  // "off" | "songs"
    let repeatMode: String   // "off" | "one" | "all"

    init(from state: NSDictionary) {
        isPlaying = state["isPlaying"] as? Bool ?? false
        progress = (state["progress"] as? NSNumber)?.floatValue
        position = (state["position"] as? NSNumber)?.floatValue
        duration = (state["duration"] as? NSNumber)?.floatValue
        listenDuration = (state["listenDuration"] as? NSNumber)?.doubleValue
        // showStopButton removed — controlled via PlayerContent
        isFavorite = state["isFavorite"] as? Bool ?? false
        isLoading = state["isLoading"] as? Bool ?? false
        isBuffering = state["isBuffering"] as? Bool ?? false
        shuffleMode = state["shuffleMode"] as? String ?? "off"
        repeatMode = state["repeatMode"] as? String ?? "off"
    }
}
