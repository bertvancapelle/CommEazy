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

    // Visual effect view for glass effect
    private var glassEffectView: UIVisualEffectView?

    // Content container for React Native children
    private var contentContainer: UIView?

    // ============================================================
    // MARK: Props from React Native
    // ============================================================

    /// Tint color in hex format (e.g., "#00897B")
    @objc var tintColorHex: String = "#007AFF" {
        didSet { updateGlassEffect() }
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
        // Create content container for React Native children
        contentContainer = UIView()
        contentContainer?.translatesAutoresizingMaskIntoConstraints = false

        if let container = contentContainer {
            addSubview(container)
            NSLayoutConstraint.activate([
                container.leadingAnchor.constraint(equalTo: leadingAnchor),
                container.trailingAnchor.constraint(equalTo: trailingAnchor),
                container.topAnchor.constraint(equalTo: topAnchor),
                container.bottomAnchor.constraint(equalTo: bottomAnchor),
            ])
        }

        updateGlassEffect()
    }

    // ============================================================
    // MARK: Glass Effect
    // ============================================================

    private func updateGlassEffect() {
        // Remove existing effect
        glassEffectView?.removeFromSuperview()

        // Check iOS 26 availability
        // NOTE: When iOS 26 SDK is available, uncomment the UIGlassEffect code
        #if swift(>=5.9)
        if #available(iOS 26, *) {
            // TODO: iOS 26 - Uncomment when SDK is available
            // createLiquidGlassEffect()
            // return

            // For now, use fallback
            createFallbackBackground()
        } else {
            createFallbackBackground()
        }
        #else
        createFallbackBackground()
        #endif
    }

    /// Creates the actual UIGlassEffect (iOS 26+)
    /// NOTE: This code will be uncommented when iOS 26 SDK is available
    /*
    @available(iOS 26.0, *)
    private func createLiquidGlassEffect() {
        // Determine glass style
        let style: UIGlassEffect.Style = glassStyle == "prominent" ? .prominent : .regular

        // Create glass effect
        let effect = UIGlassEffect(style: style)

        // Apply tint color with intensity
        if let baseColor = UIColor(hexString: tintColorHex) {
            effect.tintColor = baseColor.withAlphaComponent(tintIntensity)
        }

        // Create visual effect view
        let effectView = UIVisualEffectView(effect: effect)
        effectView.translatesAutoresizingMaskIntoConstraints = false
        effectView.layer.cornerRadius = cornerRadius
        effectView.clipsToBounds = cornerRadius > 0

        // Insert as background (behind content)
        insertSubview(effectView, at: 0)
        NSLayoutConstraint.activate([
            effectView.leadingAnchor.constraint(equalTo: leadingAnchor),
            effectView.trailingAnchor.constraint(equalTo: trailingAnchor),
            effectView.topAnchor.constraint(equalTo: topAnchor),
            effectView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        glassEffectView = effectView

        NSLog("[LiquidGlass] Created UIGlassEffect with tint: %@, intensity: %.2f", tintColorHex, tintIntensity)
    }
    */

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
    // MARK: Layout
    // ============================================================

    override func layoutSubviews() {
        super.layoutSubviews()
        glassEffectView?.frame = bounds
    }

    // React Native inserts children into the first subview
    // We need to redirect to content container
    override func insertReactSubview(_ subview: UIView!, at atIndex: Int) {
        contentContainer?.insertSubview(subview, at: atIndex)
    }

    override func removeReactSubview(_ subview: UIView!) {
        subview.removeFromSuperview()
    }

    override func reactSubviews() -> [UIView]! {
        return contentContainer?.subviews ?? []
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
