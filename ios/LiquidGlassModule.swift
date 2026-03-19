/**
 * LiquidGlassModule — Native iOS Liquid Glass Support for React Native
 *
 * Provides UIGlassEffect (iOS 26+) for CommEazy's module headers and components.
 * Uses progressive enhancement: Liquid Glass on iOS 26+, solid colors on older iOS.
 *
 * ARCHITECTURE:
 * - LiquidGlassModule: RCT module for isSupported() check
 * - LiquidGlassNativeView: UIView with UIGlassEffect background
 * - LiquidGlassFallbackView: Plain UIView for iOS <26
 *
 * @see .claude/CLAUDE.md section 16 - Apple Liquid Glass Compliance
 * @see .claude/plans/LIQUID_GLASS_IMPLEMENTATION.md
 */

import UIKit
import React
// FORCE RECOMPILE: 2026-03-19T5 — remove RED canary diagnostic, restore normal module colors

// ============================================================
// MARK: - LiquidGlassModule (RCT Bridge Module)
// ============================================================

@objc(LiquidGlassModule)
class LiquidGlassModule: NSObject {

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return true
    }

    /// Check if Liquid Glass is supported on current device
    /// Returns true on iOS 26+, false otherwise
    @objc
    func isSupported(_ resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        // iOS 26 is not yet released, so we check for availability
        // When iOS 26 SDK is available, this will use @available(iOS 26, *)
        #if swift(>=5.9)
        // Future: Use actual iOS 26 check when SDK is available
        // For now, always return false as iOS 26 is not released
        if #available(iOS 26, *) {
            resolve(true)
        } else {
            resolve(false)
        }
        #else
        resolve(false)
        #endif
    }

    /// Get the current iOS version
    @objc
    func getIOSVersion(_ resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
        let version = ProcessInfo.processInfo.operatingSystemVersion
        resolve(version.majorVersion)
    }
}

// ============================================================
// MARK: - LiquidGlassNativeView (iOS 26+ Only)
// ============================================================

/// Native view that renders UIGlassEffect on iOS 26+
/// Falls back to solid backgroundColor on older iOS versions
@objc(LiquidGlassNativeView)
class LiquidGlassNativeView: UIView {

    // Glass effect view (UIVisualEffectView on iOS 26+, UIView for fallback)
    private var glassEffectView: UIView?
    
    // Track if we've received props from React Native
    private var hasReceivedProps = false

    // ============================================================
    // MARK: Props from React Native
    // ============================================================

    /// Tint color in hex format (e.g., "#00897B")
    @objc var tintColorHex: String = "#007AFF" {
        didSet {
            NSLog("[LiquidGlass] 🎨 tintColorHex set to: %@ (was: %@)", tintColorHex, oldValue)
            hasReceivedProps = true
            updateGlassEffect()
        }
    }

    /// Tint intensity (0.0 - 1.0)
    @objc var tintIntensity: CGFloat = 0.5 {
        didSet { updateGlassEffect() }
    }

    /// Glass style variant: "regular" or "prominent"
    @objc var glassStyle: String = "regular" {
        didSet { updateGlassEffect() }
    }

    /// Corner radius
    @objc var cornerRadius: CGFloat = 0 {
        didSet {
            layer.cornerRadius = cornerRadius
            glassEffectView?.layer.cornerRadius = cornerRadius
            clipsToBounds = cornerRadius > 0
            updateGlassEffect()
        }
    }

    /// Fallback color for iOS <26 (hex format)
    @objc var fallbackColorHex: String = "#007AFF" {
        didSet { updateGlassEffect() }
    }

    // ============================================================
    // MARK: Initialization
    // ============================================================

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        // React Native handles its own layout, so we don't need a container
        // Children will be added directly to this view
        // NOTE: Don't call updateGlassEffect() here - wait for props to be set via didSet
        // The effect will be created when tintColorHex is set from React Native
        
        let version = ProcessInfo.processInfo.operatingSystemVersion
        NSLog("[LiquidGlass] 🔧 setupView() called - iOS %d.%d.%d", version.majorVersion, version.minorVersion, version.patchVersion)
    }

    // ============================================================
    // MARK: Glass Effect
    // ============================================================

    private func updateGlassEffect() {
        // Only update if we've received props from React Native
        guard hasReceivedProps else {
            NSLog("[LiquidGlass] Skipping update - waiting for props from React Native")
            return
        }

        // Remove existing effect
        glassEffectView?.removeFromSuperview()

        // iOS 26+: Use real UIGlassEffect for authentic Liquid Glass
        // iOS <26: Fall back to solid color
        if #available(iOS 26, *) {
            NSLog("[LiquidGlass] iOS 26+ detected - using REAL UIGlassEffect")
            createLiquidGlassEffect()
        } else {
            NSLog("[LiquidGlass] iOS <26 - using fallback")
            createFallbackBackground()
        }
    }

    /// Creates the actual UIGlassEffect (iOS 26+)
    /// Uses Apple's native Liquid Glass material with module tint color
    ///
    /// APPROACH: Dark base + UIGlassEffect overlay + tint + visual enhancements
    /// The dark base ensures the glass is visible even inside Modal UIWindows
    /// (where UIBlurEffect has nothing to blur because Modal creates a separate UIWindow).
    /// This matches GlassPlayerView's proven approach.
    @available(iOS 26.0, *)
    private func createLiquidGlassEffect() {
        guard let baseColor = UIColor(hexString: tintColorHex) else {
            NSLog("[LiquidGlass] WARNING: Failed to parse tintColorHex: %@", tintColorHex)
            createFallbackBackground()
            return
        }

        // === Container for all glass layers ===
        let containerView = UIView()
        containerView.translatesAutoresizingMaskIntoConstraints = false
        containerView.isUserInteractionEnabled = false  // Touches must pass through to React Native children
        containerView.layer.cornerRadius = cornerRadius
        containerView.layer.cornerCurve = .continuous
        containerView.clipsToBounds = true  // Clip children to corner radius

        // === Layer 1: Semi-transparent dark base for visibility ===
        // Unlike UIBlurEffect (which needs native content behind it to blur),
        // this dark base provides a visible foundation in ANY context — including
        // Modal UIWindows where there's no blurrable content.
        // Matches GlassPlayerView's proven Layer 0 approach.
        let darkBase = UIView()
        darkBase.translatesAutoresizingMaskIntoConstraints = false
        darkBase.backgroundColor = UIColor.black.withAlphaComponent(0.35)
        containerView.addSubview(darkBase)

        NSLayoutConstraint.activate([
            darkBase.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            darkBase.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            darkBase.topAnchor.constraint(equalTo: containerView.topAnchor),
            darkBase.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
        ])

        // === Layer 2: UIGlassEffect for Liquid Glass highlights ===
        let glassEffect = UIGlassEffect()
        // Map tintIntensity to glass tint alpha: subtle range so glass material shows through
        let glassAlpha = 0.10 + (tintIntensity * 0.20)  // tintIntensity 0→10%, 0.5→20%, 1.0→30%
        glassEffect.tintColor = baseColor.withAlphaComponent(glassAlpha)
        glassEffect.isInteractive = false  // Touches pass to React Native children via hitTest override

        let glassView = UIVisualEffectView(effect: glassEffect)
        glassView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(glassView)

        NSLayoutConstraint.activate([
            glassView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            glassView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            glassView.topAnchor.constraint(equalTo: containerView.topAnchor),
            glassView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
        ])

        // === Layer 3: Semi-transparent tint color overlay ===
        // Gives the glass its characteristic module color
        // Map tintIntensity to alpha range: 0.10 (10%) to 0.40 (40%)
        let tintAlpha = 0.10 + (tintIntensity * 0.30)  // tintIntensity 0→10%, 0.5→25%, 1.0→40%
        let tintOverlay = UIView()
        tintOverlay.translatesAutoresizingMaskIntoConstraints = false
        tintOverlay.backgroundColor = baseColor.withAlphaComponent(tintAlpha)
        containerView.addSubview(tintOverlay)

        NSLayoutConstraint.activate([
            tintOverlay.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            tintOverlay.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            tintOverlay.topAnchor.constraint(equalTo: containerView.topAnchor),
            tintOverlay.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
        ])

        // === Layer 4: Top specular highlight (glass reflection) ===
        // Skip highlight for full-screen modals (cornerRadius=0) to avoid visible white line at top
        if cornerRadius > 0 {
            let highlightGradient = CAGradientLayer()
            highlightGradient.colors = [
                UIColor.white.withAlphaComponent(0.30).cgColor,  // Bright top highlight
                UIColor.white.withAlphaComponent(0.10).cgColor,  // Gentle fade
                UIColor.clear.cgColor,                            // Transparent middle
                UIColor.white.withAlphaComponent(0.05).cgColor,  // Subtle bottom glow
            ]
            highlightGradient.locations = [0.0, 0.12, 0.5, 1.0]
            highlightGradient.startPoint = CGPoint(x: 0.5, y: 0.0)
            highlightGradient.endPoint = CGPoint(x: 0.5, y: 1.0)

            let highlightView = UIView()
            highlightView.translatesAutoresizingMaskIntoConstraints = false
            highlightView.layer.addSublayer(highlightGradient)
            highlightView.isUserInteractionEnabled = false
            containerView.addSubview(highlightView)

            NSLayoutConstraint.activate([
                highlightView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
                highlightView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
                highlightView.topAnchor.constraint(equalTo: containerView.topAnchor),
                highlightView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
            ])

            // Store gradient for bounds updates
            self.gradientLayerRef = highlightGradient
        }

        // === Layer 5: Glass edge border ===
        // Skip border for full-screen modals (cornerRadius=0) to avoid visible white line at top
        if cornerRadius > 0 {
            containerView.layer.borderColor = UIColor.white.withAlphaComponent(0.15).cgColor
            containerView.layer.borderWidth = 0.5
            NSLog("[LiquidGlass] ✅ Layer 5 BORDER applied (radius: %.1f)", cornerRadius)
        } else {
            NSLog("[LiquidGlass] ⏭️ Layer 5 BORDER SKIPPED (radius: 0 — full-screen modal)")
        }

        // Clear our background so layers can show
        backgroundColor = .clear

        // === Shadow on parent view (not container) ===
        // Shadow must be on the parent (self) because container has clipsToBounds = true.
        // clipsToBounds clips children to corner radius but masks shadow too.
        // By putting shadow on self (which doesn't clip), both work correctly.
        // Skip shadow for full-screen modals (cornerRadius=0) — no visible edges to shadow
        if cornerRadius > 0 {
            layer.shadowColor = UIColor.black.cgColor
            layer.shadowOffset = CGSize(width: 0, height: 4)
            layer.shadowOpacity = 0.25
            layer.shadowRadius = 8
            NSLog("[LiquidGlass] ✅ SHADOW applied (radius: %.1f)", cornerRadius)
        } else {
            NSLog("[LiquidGlass] ⏭️ SHADOW SKIPPED (radius: 0 — full-screen modal)")
        }

        // Insert container as background (behind React Native children)
        insertSubview(containerView, at: 0)

        // For full-screen modals (cornerRadius=0): extend container 20pt ABOVE the view bounds.
        // This hides UIGlassEffect's inherent top edge highlight off-screen.
        // UIGlassEffect renders its own edge/highlight as part of its material —
        // we can't disable it (only tintColor + isInteractive are configurable),
        // so we push it off the visible area.
        let topOverflow: CGFloat = cornerRadius > 0 ? 0 : -20

        NSLayoutConstraint.activate([
            containerView.leadingAnchor.constraint(equalTo: leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: trailingAnchor),
            containerView.topAnchor.constraint(equalTo: topAnchor, constant: topOverflow),
            containerView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        glassEffectView = containerView

        // Log for debugging
        let version = ProcessInfo.processInfo.operatingSystemVersion
        NSLog("[LiquidGlass] ✅ Created Glass Effect (iOS %d.%d.%d) - layers: darkBase + UIGlassEffect + tint @%.0f%% + highlight gradient + border, tint: %@, intensity: %.2f, radius: %.1f",
              version.majorVersion, version.minorVersion, version.patchVersion,
              tintAlpha * 100, tintColorHex, tintIntensity, cornerRadius)
    }
    
    /// Creates a REAL blur effect that can see through to content underneath
    /// This requires the view to be positioned as an overlay OVER the content (absolute positioning)
    ///
    /// Architecture for true transparency:
    /// - MiniPlayer/ModuleHeader must be position:absolute OVER the ScrollView content
    /// - Content ScrollView must extend UNDER the overlay
    /// - UIBlurEffect will then blur the content that's visually behind it
    /// Creates a visually distinct "frosted glass" effect
    /// Since UIBlurEffect only blurs native iOS views behind it (not React Native content),
    /// we create a glass-like appearance using layered effects that work regardless of view hierarchy
    private func createBlurWithTintEffect() {
        guard let baseColor = UIColor(hexString: tintColorHex) else {
            createFallbackBackground()
            return
        }

        // === Container view for all glass effect layers ===
        let containerView = UIView()
        containerView.translatesAutoresizingMaskIntoConstraints = false
        containerView.isUserInteractionEnabled = false  // Touches must pass through to React Native children
        containerView.layer.cornerRadius = cornerRadius
        containerView.clipsToBounds = cornerRadius > 0

        // === Layer 1: Base color with high saturation, lower opacity ===
        // This creates the "colored glass" foundation
        let baseLayer = UIView()
        baseLayer.translatesAutoresizingMaskIntoConstraints = false
        // Use 70% opacity for rich color that still feels glass-like
        baseLayer.backgroundColor = baseColor.withAlphaComponent(0.70)
        containerView.addSubview(baseLayer)

        NSLayoutConstraint.activate([
            baseLayer.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            baseLayer.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            baseLayer.topAnchor.constraint(equalTo: containerView.topAnchor),
            baseLayer.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
        ])

        // === Layer 2: White gradient overlay for glass depth ===
        // Creates the "frosted" appearance with light diffusion
        let gradientLayer = CAGradientLayer()
        gradientLayer.colors = [
            UIColor.white.withAlphaComponent(0.35).cgColor,  // Top: more light
            UIColor.white.withAlphaComponent(0.10).cgColor,  // Middle: subtle
            UIColor.white.withAlphaComponent(0.05).cgColor,  // Bottom: minimal
        ]
        gradientLayer.locations = [0.0, 0.3, 1.0]
        gradientLayer.startPoint = CGPoint(x: 0.5, y: 0.0)
        gradientLayer.endPoint = CGPoint(x: 0.5, y: 1.0)

        let gradientView = UIView()
        gradientView.translatesAutoresizingMaskIntoConstraints = false
        gradientView.layer.addSublayer(gradientLayer)
        containerView.addSubview(gradientView)

        NSLayoutConstraint.activate([
            gradientView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            gradientView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            gradientView.topAnchor.constraint(equalTo: containerView.topAnchor),
            gradientView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
        ])

        // Store gradient layer for bounds updates
        self.gradientLayerRef = gradientLayer

        // === Layer 3: Top edge highlight (specular reflection) ===
        let highlightView = UIView()
        highlightView.translatesAutoresizingMaskIntoConstraints = false
        highlightView.backgroundColor = UIColor.white.withAlphaComponent(0.50)
        containerView.addSubview(highlightView)

        NSLayoutConstraint.activate([
            highlightView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            highlightView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            highlightView.topAnchor.constraint(equalTo: containerView.topAnchor),
            highlightView.heightAnchor.constraint(equalToConstant: 1.0),
        ])

        // === Layer 4: Outer border for definition ===
        containerView.layer.borderColor = UIColor.white.withAlphaComponent(0.30).cgColor
        containerView.layer.borderWidth = 0.5

        // === Layer 5: Inner shadow for depth (via additional border) ===
        containerView.layer.shadowColor = UIColor.black.cgColor
        containerView.layer.shadowOffset = CGSize(width: 0, height: 1)
        containerView.layer.shadowOpacity = 0.10
        containerView.layer.shadowRadius = 2

        // Clear our background
        backgroundColor = .clear

        // Insert container as background (at index 0, behind React children)
        insertSubview(containerView, at: 0)
        NSLayoutConstraint.activate([
            containerView.leadingAnchor.constraint(equalTo: leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: trailingAnchor),
            containerView.topAnchor.constraint(equalTo: topAnchor),
            containerView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        glassEffectView = containerView

        NSLog("[LiquidGlass] Created FROSTED GLASS effect - tint: %@, radius: %.1f, frame: %@",
              tintColorHex, cornerRadius, NSCoder.string(for: bounds))
    }

    // Reference to gradient layer for bounds updates
    private var gradientLayerRef: CAGradientLayer?

    /// Creates a solid background fallback for iOS <26
    private func createFallbackBackground() {
        // Use fallback color or tint color
        let colorHex = fallbackColorHex.isEmpty ? tintColorHex : fallbackColorHex

        if let color = UIColor(hexString: colorHex) {
            backgroundColor = color
        } else {
            backgroundColor = .systemBlue
        }

        layer.cornerRadius = cornerRadius
        clipsToBounds = cornerRadius > 0

        NSLog("[LiquidGlass] Using fallback solid color: %@", colorHex)
    }

    // ============================================================
    // MARK: Touch Passthrough
    // ============================================================

    /// Override hitTest to ensure touches pass through the glass effect layers
    /// to reach React Native children (buttons, TextInput, ScrollView, etc.)
    ///
    /// Without this override, touches on "empty" areas (between React children)
    /// are consumed by this UIView without being forwarded to React Native's
    /// touch system — making the entire view unresponsive.
    ///
    /// This is the same pattern used by GlassPlayerView (which works correctly).
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard isUserInteractionEnabled, !isHidden, alpha > 0.01 else { return nil }

        // Check React Native children (all subviews except the glass container)
        // Iterate in reverse order (highest index = topmost view first)
        for subview in subviews.reversed() {
            // Skip decorative-only view (glass container)
            if subview === glassEffectView { continue }

            guard subview.isUserInteractionEnabled, !subview.isHidden, subview.alpha > 0.01 else { continue }

            let convertedPoint = subview.convert(point, from: self)
            if let hitView = subview.hitTest(convertedPoint, with: event) {
                return hitView
            }
        }

        // No React child was hit — return nil so the touch passes through
        // to the modal's background or parent view hierarchy
        return nil
    }

    // ============================================================
    // MARK: Layout
    // ============================================================

    private var lastBounds: CGRect = .zero

    override func layoutSubviews() {
        super.layoutSubviews()
        // DO NOT set glassEffectView?.frame = bounds here!
        // The container uses Auto Layout constraints (including -20pt top overflow
        // for cornerRadius=0 full-screen modals). Setting frame directly overrides
        // those constraints every layout cycle, wiping out the overflow.

        // Update gradient layer frame if present (for frosted glass fallback)
        if let gradientLayer = gradientLayerRef {
            gradientLayer.frame = glassEffectView?.bounds ?? bounds
        }

        // Recreate effect if bounds changed significantly (first layout or resize)
        // This ensures the glass effect is created after the view has its proper size
        if hasReceivedProps && !bounds.isEmpty && bounds != lastBounds {
            lastBounds = bounds
            NSLog("[LiquidGlass] layoutSubviews - recreating effect with bounds: %@", NSCoder.string(for: bounds))
            updateGlassEffect()
        }
    }

    // React Native children are added directly to this view
    override func insertReactSubview(_ subview: UIView!, at atIndex: Int) {
        // Insert after glass effect view (which is at index 0)
        let offset = glassEffectView != nil ? 1 : 0
        insertSubview(subview, at: atIndex + offset)
    }

    override func removeReactSubview(_ subview: UIView!) {
        subview.removeFromSuperview()
    }

    override func reactSubviews() -> [UIView]! {
        // Return all subviews except the glass effect view
        return subviews.filter { $0 !== glassEffectView }
    }
}

// ============================================================
// MARK: - UIColor Extension (Hex Support)
// ============================================================

extension UIColor {
    /// Initialize UIColor from hex string
    /// Supports formats: "#RRGGBB", "RRGGBB", "#RGB", "RGB"
    convenience init?(hexString: String) {
        var hexSanitized = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        // Handle short format (RGB -> RRGGBB)
        if hexSanitized.count == 3 {
            let chars = Array(hexSanitized)
            hexSanitized = "\(chars[0])\(chars[0])\(chars[1])\(chars[1])\(chars[2])\(chars[2])"
        }

        guard hexSanitized.count == 6 else {
            NSLog("[LiquidGlass] Invalid hex color: %@", hexString)
            return nil
        }

        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else {
            NSLog("[LiquidGlass] Failed to parse hex color: %@", hexString)
            return nil
        }

        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
        let b = CGFloat(rgb & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b, alpha: 1.0)
    }
}
