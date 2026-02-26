/**
 * GlassPlayerWindowModule — Native iOS Glass Player Window for React Native
 *
 * Provides a separate UIWindow for MiniPlayer and FullPlayer that floats above
 * the main React Native content. This enables real UIGlassEffect blur since the
 * glass window is in a separate window hierarchy above the main app content.
 *
 * ARCHITECTURE:
 * - UIWindow 1 (Main): React Native app content
 * - UIWindow 2 (Glass): Player UI with UIGlassEffect - can blur Window 1 content
 *
 * @see .claude/plans/LIQUID_GLASS_PLAYER_WINDOW.md
 * @see .claude/CLAUDE.md section 16 - Apple Liquid Glass Compliance
 */

import UIKit
import React

// ============================================================
// MARK: - GlassPlayerWindowModule (RCT Bridge)
// ============================================================

@objc(GlassPlayerWindowModule)
class GlassPlayerWindowModule: RCTEventEmitter {

    // Singleton window instance (iOS 26+ only)
    private var playerWindow: Any?
    
    @available(iOS 26.0, *)
    private var glassWindow: GlassPlayerWindow? {
        get { playerWindow as? GlassPlayerWindow }
        set { playerWindow = newValue }
    }

    // ============================================================
    // MARK: RCTEventEmitter
    // ============================================================

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    override func supportedEvents() -> [String]! {
        return [
            "onPlayPause",
            "onStop",
            "onExpand",
            "onCollapse",
            "onMinimize",
            "onSeek",
            "onSkipForward",
            "onSkipBackward",
            "onClose",
            "onFavoriteToggle",
            "onSleepTimerSet",
            "onSpeedChange",
            "onShuffleToggle",
            "onRepeatToggle"
        ]
    }

    // ============================================================
    // MARK: React Native Bridge Methods
    // ============================================================

    /// Check if Glass Player Window is available (iOS 26+)
    @objc
    func isAvailable(_ resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 26, *) {
            resolve(true)
        } else {
            resolve(false)
        }
    }

    /// Show mini player with content
    @objc
    func showMiniPlayer(_ config: NSDictionary,
                        resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                self.ensureWindowExists()
                self.glassWindow?.showMini(with: config)
                resolve(true)
            }
        } else {
            reject("UNSUPPORTED", "Glass Player requires iOS 26+", nil)
        }
    }

    /// Expand to full player
    @objc
    func expandToFullPlayer(_ resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                self.glassWindow?.expandToFull()
                self.sendEvent(withName: "onExpand", body: nil)
                resolve(true)
            }
        } else {
            reject("UNSUPPORTED", "Glass Player requires iOS 26+", nil)
        }
    }

    /// Collapse to mini player
    @objc
    func collapseToMini(_ resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                self.glassWindow?.collapseToMini()
                self.sendEvent(withName: "onCollapse", body: nil)
                resolve(true)
            }
        } else {
            reject("UNSUPPORTED", "Glass Player requires iOS 26+", nil)
        }
    }

    /// Hide player completely
    @objc
    func hidePlayer(_ resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                self.glassWindow?.hide()
                resolve(true)
            }
        } else {
            reject("UNSUPPORTED", "Glass Player requires iOS 26+", nil)
        }
    }

    /// Minimize player — hide without stopping audio (iPad only)
    /// The player can be restored via showFromMinimized()
    @objc
    func minimizePlayer(_ resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                self.glassWindow?.minimize()
                self.sendEvent(withName: "onMinimize", body: nil)
                resolve(true)
            }
        } else {
            reject("UNSUPPORTED", "Glass Player requires iOS 26+", nil)
        }
    }
    
    /// Show player from minimized state
    @objc
    func showFromMinimized(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                self.glassWindow?.showFromMinimized()
                resolve(true)
            }
        } else {
            reject("UNSUPPORTED", "Glass Player requires iOS 26+", nil)
        }
    }
    
    /// Enable or disable the minimize button on the mini player (iPad only)
    @objc
    func setMinimizeButtonVisible(_ visible: Bool) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                self.glassWindow?.setMinimizeButtonVisible(visible)
            }
        }
    }
    
    /// Check if the player is currently minimized (hidden but audio still playing)
    @objc
    func isMinimized(_ resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                resolve(self.glassWindow?.isMinimized ?? false)
            }
        } else {
            resolve(false)
        }
    }
    
    /// Temporarily hide player (e.g., when navigation menu is open)
    /// This preserves state and allows resuming visibility
    @objc
    func setTemporarilyHidden(_ hidden: Bool) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                self.glassWindow?.setTemporarilyHidden(hidden)
            }
        }
    }

    /// Update panel bounds for iPad Split View positioning
    /// Pass null/empty to reset to full screen mode
    @objc
    func updatePanelBounds(_ bounds: NSDictionary?) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                if let bounds = bounds,
                   let x = bounds["x"] as? CGFloat,
                   let y = bounds["y"] as? CGFloat,
                   let width = bounds["width"] as? CGFloat,
                   let height = bounds["height"] as? CGFloat {
                    self.glassWindow?.updatePanelBounds(CGRect(x: x, y: y, width: width, height: height))
                } else {
                    self.glassWindow?.updatePanelBounds(nil)
                }
            }
        }
    }

    /// Update player content (artwork, title, progress, etc.)
    @objc
    func updateContent(_ config: NSDictionary) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                self.glassWindow?.updateContent(config)
            }
        }
    }

    /// Update playback state (isPlaying, isLoading, isBuffering)
    @objc
    func updatePlaybackState(_ state: NSDictionary) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                self.glassWindow?.updatePlaybackState(state)
            }
        }
    }

    /// Configure full player controls (which buttons to show/hide)
    @objc
    func configureControls(_ controls: NSDictionary) {
        if #available(iOS 26.0, *) {
            DispatchQueue.main.async {
                self.glassWindow?.configureControls(controls)
            }
        }
    }

    // ============================================================
    // MARK: Window Management
    // ============================================================

    @available(iOS 26.0, *)
    private func ensureWindowExists() {
        guard glassWindow == nil else { return }

        // Get the active window scene
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene else {
            NSLog("[GlassPlayer] ERROR: No window scene available")
            return
        }

        let window = GlassPlayerWindow(windowScene: scene)
        window.eventDelegate = self
        glassWindow = window

        NSLog("[GlassPlayer] ✅ Created GlassPlayerWindow")
    }
}

// ============================================================
// MARK: - GlassPlayerWindowEventDelegate
// ============================================================

extension GlassPlayerWindowModule: GlassPlayerWindowEventDelegate {

    func playerDidTapPlayPause() {
        sendEvent(withName: "onPlayPause", body: nil)
    }

    func playerDidTapStop() {
        sendEvent(withName: "onStop", body: nil)
    }

    func playerDidTapExpand() {
        sendEvent(withName: "onExpand", body: nil)
    }
    
    func playerDidTapMinimize() {
        sendEvent(withName: "onMinimize", body: nil)
    }

    func playerDidTapCollapse() {
        sendEvent(withName: "onCollapse", body: nil)
    }

    func playerDidSeek(to position: Double) {
        sendEvent(withName: "onSeek", body: ["position": position])
    }

    func playerDidSkipForward() {
        sendEvent(withName: "onSkipForward", body: nil)
    }

    func playerDidSkipBackward() {
        sendEvent(withName: "onSkipBackward", body: nil)
    }

    func playerDidClose() {
        sendEvent(withName: "onClose", body: nil)
    }
    
    func playerDidTapFavorite() {
        sendEvent(withName: "onFavoriteToggle", body: nil)
    }
    
    func playerDidSetSleepTimer(_ minutes: NSNumber?) {
        if let mins = minutes {
            sendEvent(withName: "onSleepTimerSet", body: ["minutes": mins.intValue])
        } else {
            sendEvent(withName: "onSleepTimerSet", body: ["minutes": NSNull()])
        }
    }
    
    func playerDidChangeSpeed(_ speed: Float) {
        sendEvent(withName: "onSpeedChange", body: ["speed": speed])
    }

    func playerDidTapShuffle() {
        sendEvent(withName: "onShuffleToggle", body: nil)
    }

    func playerDidTapRepeat() {
        sendEvent(withName: "onRepeatToggle", body: nil)
    }
}
