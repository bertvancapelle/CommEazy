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
    
    // Track if we've received props from React Native
    private var hasReceivedProps = false

    // ============================================================
    // MARK: Props from React Native
    // ============================================================

    /// Tint color in hex format (e.g., "#00897B")
    @objc var tintColorHex: String = "#007AFF" {
        didSet {
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

        // Use blur + tint effect for visible glass-like appearance
        // UIGlassEffect requires content behind it to blur, which doesn't work
        // for module headers on solid backgrounds. UIBlurEffect with tint overlay
        // provides a consistent glass-like effect that's always visible.
        if #available(iOS 26, *) {
            createBlurWithTintEffect()
        } else {
            createFallbackBackground()
        }
    }

    /// Creates the actual UIGlassEffect (iOS 26+)
    @available(iOS 26.0, *)
    private func createLiquidGlassEffect() {
        // Create glass effect with tint
        var effect = UIGlassEffect()
        
        // Apply tint color to the glass effect
        if let baseColor = UIColor(hexString: tintColorHex) {
            effect.tintColor = baseColor
        }

        // Create visual effect view with the glass effect
        let effectView = UIVisualEffectView(effect: effect)
        effectView.translatesAutoresizingMaskIntoConstraints = false
        effectView.layer.cornerRadius = cornerRadius
        effectView.clipsToBounds = cornerRadius > 0
        
        // Add a subtle colored overlay inside the glass for visibility
        // This ensures the module color is visible while glass effect shows through
        if let baseColor = UIColor(hexString: tintColorHex) {
            let colorOverlay = UIView()
            colorOverlay.translatesAutoresizingMaskIntoConstraints = false
            // Low opacity (0.4) so glass effect is visible underneath
            colorOverlay.backgroundColor = baseColor.withAlphaComponent(0.4)
            colorOverlay.layer.cornerRadius = cornerRadius
            colorOverlay.clipsToBounds = cornerRadius > 0
            
            effectView.contentView.addSubview(colorOverlay)
            NSLayoutConstraint.activate([
                colorOverlay.leadingAnchor.constraint(equalTo: effectView.contentView.leadingAnchor),
                colorOverlay.trailingAnchor.constraint(equalTo: effectView.contentView.trailingAnchor),
                colorOverlay.topAnchor.constraint(equalTo: effectView.contentView.topAnchor),
                colorOverlay.bottomAnchor.constraint(equalTo: effectView.contentView.bottomAnchor),
            ])
        }
        
        // Set our background to clear so glass can show through
        backgroundColor = .clear

        // Insert as background (behind content)
        insertSubview(effectView, at: 0)
        NSLayoutConstraint.activate([
            effectView.leadingAnchor.constraint(equalTo: leadingAnchor),
            effectView.trailingAnchor.constraint(equalTo: trailingAnchor),
            effectView.topAnchor.constraint(equalTo: topAnchor),
            effectView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        glassEffectView = effectView

        NSLog("[LiquidGlass] Created UIGlassEffect - tint: %@, radius: %.1f, frame: %@", 
              tintColorHex, cornerRadius, NSCoder.string(for: bounds))
    }
    
    /// Creates a REAL blur effect that can see through to content underneath
    /// This requires the view to be positioned as an overlay OVER the content (absolute positioning)
    ///
    /// Architecture for true transparency:
    /// - MiniPlayer/ModuleHeader must be position:absolute OVER the ScrollView content
    /// - Content ScrollView must extend UNDER the overlay
    /// - UIBlurEffect will then blur the content that's visually behind it
    private func createBlurWithTintEffect() {
        guard let baseColor = UIColor(hexString: tintColorHex) else {
            createFallbackBackground()
            return
        }

        // === REAL UIBlurEffect for true see-through transparency ===
        // Use systemThinMaterial for a subtle, modern blur
        let blurStyle: UIBlurEffect.Style = glassStyle == "prominent"
            ? .systemThickMaterial
            : .systemThinMaterial
        let blurEffect = UIBlurEffect(style: blurStyle)
        let blurView = UIVisualEffectView(effect: blurEffect)
        blurView.translatesAutoresizingMaskIntoConstraints = false
        blurView.layer.cornerRadius = cornerRadius
        blurView.clipsToBounds = cornerRadius > 0

        // === Tint overlay INSIDE the blur's contentView ===
        // This adds the module color on top of the blur
        let tintOverlay = UIView()
        tintOverlay.translatesAutoresizingMaskIntoConstraints = false
        // Use tintIntensity to control how much color shows (0.3-0.6 works well)
        let adjustedIntensity = min(max(tintIntensity * 0.6, 0.3), 0.7)
        tintOverlay.backgroundColor = baseColor.withAlphaComponent(adjustedIntensity)
        tintOverlay.layer.cornerRadius = cornerRadius
        tintOverlay.clipsToBounds = cornerRadius > 0
        blurView.contentView.addSubview(tintOverlay)

        NSLayoutConstraint.activate([
            tintOverlay.leadingAnchor.constraint(equalTo: blurView.contentView.leadingAnchor),
            tintOverlay.trailingAnchor.constraint(equalTo: blurView.contentView.trailingAnchor),
            tintOverlay.topAnchor.constraint(equalTo: blurView.contentView.topAnchor),
            tintOverlay.bottomAnchor.constraint(equalTo: blurView.contentView.bottomAnchor),
        ])

        // === Top edge highlight for glass-like depth ===
        let highlightView = UIView()
        highlightView.translatesAutoresizingMaskIntoConstraints = false
        highlightView.backgroundColor = UIColor.white.withAlphaComponent(0.25)
        blurView.contentView.addSubview(highlightView)

        NSLayoutConstraint.activate([
            highlightView.leadingAnchor.constraint(equalTo: blurView.contentView.leadingAnchor),
            highlightView.trailingAnchor.constraint(equalTo: blurView.contentView.trailingAnchor),
            highlightView.topAnchor.constraint(equalTo: blurView.contentView.topAnchor),
            highlightView.heightAnchor.constraint(equalToConstant: 1.0),
        ])

        // === Outer border for definition ===
        blurView.layer.borderColor = UIColor.white.withAlphaComponent(0.2).cgColor
        blurView.layer.borderWidth = 0.5

        // Clear our background so blur can see through
        backgroundColor = .clear

        // Insert blur view as background (at index 0, behind React children)
        insertSubview(blurView, at: 0)
        NSLayoutConstraint.activate([
            blurView.leadingAnchor.constraint(equalTo: leadingAnchor),
            blurView.trailingAnchor.constraint(equalTo: trailingAnchor),
            blurView.topAnchor.constraint(equalTo: topAnchor),
            blurView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        glassEffectView = blurView

        NSLog("[LiquidGlass] Created REAL UIBlurEffect - tint: %@, intensity: %.2f, radius: %.1f, frame: %@",
              tintColorHex, adjustedIntensity, cornerRadius, NSCoder.string(for: bounds))
    }

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
    
    private var lastBounds: CGRect = .zero

    override func layoutSubviews() {
        super.layoutSubviews()
        glassEffectView?.frame = bounds
        
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
        // Insert after glass effect view (if present)
        let insertIndex = glassEffectView != nil ? atIndex + 1 : atIndex
        insertSubview(subview, at: insertIndex)
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
