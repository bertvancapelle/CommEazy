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
