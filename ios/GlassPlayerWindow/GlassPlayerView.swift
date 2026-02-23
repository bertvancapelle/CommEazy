/**
 * GlassPlayerView — UIView with UIGlassEffect for Liquid Glass Player
 *
 * This view provides the actual Liquid Glass visual effect using iOS 26's
 * UIGlassEffect API. Because this view is in a separate UIWindow above
 * the main app content, UIGlassEffect can properly blur the content underneath.
 *
 * Layers (from bottom to top):
 * 1. UIGlassEffect - Apple's native glass material
 * 2. Tint overlay - Module-specific color at 25% opacity
 * 3. Top highlight gradient - Specular reflection
 * 4. Border - Subtle white edge
 *
 * @see .claude/plans/LIQUID_GLASS_PLAYER_WINDOW.md
 */

import UIKit

// ============================================================
// MARK: - GlassPlayerView
// ============================================================

@available(iOS 26.0, *)
class GlassPlayerView: UIView {

    // ============================================================
    // MARK: Properties
    // ============================================================

    private var glassEffectView: UIVisualEffectView?
    private var tintOverlay: UIView?
    private var highlightGradient: CAGradientLayer?
    private var currentTintColor: UIColor

    // ============================================================
    // MARK: Initialization
    // ============================================================

    /// Initialize with optional tint color (defaults to Radio teal for backward compatibility)
    init(tintColorHex: String? = nil) {
        // Parse hex color or use default teal (Radio)
        if let hex = tintColorHex, let color = UIColor.fromHex(hex) {
            currentTintColor = color
        } else {
            currentTintColor = UIColor(red: 0, green: 0.537, blue: 0.482, alpha: 1.0)  // #00897B Radio teal
        }
        super.init(frame: .zero)
        setupGlassEffect()
    }

    override init(frame: CGRect) {
        currentTintColor = UIColor(red: 0, green: 0.537, blue: 0.482, alpha: 1.0)  // #00897B Radio teal
        super.init(frame: frame)
        setupGlassEffect()
    }

    required init?(coder: NSCoder) {
        currentTintColor = UIColor(red: 0, green: 0.537, blue: 0.482, alpha: 1.0)  // #00897B Radio teal
        super.init(coder: coder)
        setupGlassEffect()
    }

    // ============================================================
    // MARK: Setup
    // ============================================================

    private func setupGlassEffect() {
        backgroundColor = .clear
        clipsToBounds = false  // Allow glow to extend outside bounds
        
        // Rounded corners for floating appearance
        layer.cornerRadius = 24
        layer.cornerCurve = .continuous

        // === Layer 0: Subtle dark base for visibility ===
        let baseLayer = UIView()
        baseLayer.translatesAutoresizingMaskIntoConstraints = false
        baseLayer.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        baseLayer.layer.cornerRadius = 24
        baseLayer.layer.cornerCurve = .continuous
        baseLayer.clipsToBounds = true
        addSubview(baseLayer)
        
        NSLayoutConstraint.activate([
            baseLayer.leadingAnchor.constraint(equalTo: leadingAnchor),
            baseLayer.trailingAnchor.constraint(equalTo: trailingAnchor),
            baseLayer.topAnchor.constraint(equalTo: topAnchor),
            baseLayer.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        // === Layer 1: UIGlassEffect — Real Liquid Glass! ===
        var glassEffect = UIGlassEffect()
        glassEffect.isInteractive = true  // Glass highlights respond to touch
        glassEffect.tintColor = currentTintColor.withAlphaComponent(0.3)  // Apply initial tint

        let effectView = UIVisualEffectView(effect: glassEffect)
        effectView.translatesAutoresizingMaskIntoConstraints = false
        effectView.layer.cornerRadius = 24
        effectView.layer.cornerCurve = .continuous
        effectView.clipsToBounds = true
        addSubview(effectView)

        NSLayoutConstraint.activate([
            effectView.leadingAnchor.constraint(equalTo: leadingAnchor),
            effectView.trailingAnchor.constraint(equalTo: trailingAnchor),
            effectView.topAnchor.constraint(equalTo: topAnchor),
            effectView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        glassEffectView = effectView

        // === Layer 2: Tint overlay (50% opacity for visibility) ===
        let tint = UIView()
        tint.translatesAutoresizingMaskIntoConstraints = false
        tint.backgroundColor = currentTintColor.withAlphaComponent(0.50)
        tint.isUserInteractionEnabled = false
        tint.layer.cornerRadius = 24
        tint.layer.cornerCurve = .continuous
        tint.clipsToBounds = true
        addSubview(tint)

        NSLayoutConstraint.activate([
            tint.leadingAnchor.constraint(equalTo: leadingAnchor),
            tint.trailingAnchor.constraint(equalTo: trailingAnchor),
            tint.topAnchor.constraint(equalTo: topAnchor),
            tint.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        tintOverlay = tint

        // === Layer 3: Subtle shadow for depth (dark mode compatible) ===
        // Use dark shadow instead of white glow - works better on dark backgrounds
        // The white glow created an "eye-shaped" artifact on dark backgrounds
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOffset = CGSize(width: 0, height: 4)
        layer.shadowOpacity = 0.3
        layer.shadowRadius = 8

        // === Layer 4: Inner highlight gradient (top specular + subtle bottom) ===
        let gradient = CAGradientLayer()
        gradient.colors = [
            UIColor.white.withAlphaComponent(0.50).cgColor,  // Bright top
            UIColor.white.withAlphaComponent(0.10).cgColor,  // Fade middle-top
            UIColor.clear.cgColor,                            // Clear middle
            UIColor.white.withAlphaComponent(0.05).cgColor,  // Subtle bottom glow
            UIColor.white.withAlphaComponent(0.15).cgColor,  // Bottom edge
        ]
        gradient.locations = [0.0, 0.12, 0.5, 0.88, 1.0]
        gradient.startPoint = CGPoint(x: 0.5, y: 0.0)
        gradient.endPoint = CGPoint(x: 0.5, y: 1.0)
        gradient.cornerRadius = 24
        layer.addSublayer(gradient)

        highlightGradient = gradient

        // === Layer 5: Subtle border (dark mode compatible) ===
        // Reduced opacity to avoid visible line artifact on dark backgrounds
        layer.borderColor = UIColor.white.withAlphaComponent(0.15).cgColor
        layer.borderWidth = 0.5

        // Log initial tint color for debugging
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        currentTintColor.getRed(&r, green: &g, blue: &b, alpha: &a)
        NSLog("[GlassPlayerView] Setup complete - initial tint RGB=(\(Int(r*255)),\(Int(g*255)),\(Int(b*255)))")
    }

    // ============================================================
    // MARK: Layout
    // ============================================================

    override func layoutSubviews() {
        super.layoutSubviews()

        // Update gradient frame
        highlightGradient?.frame = bounds
    }

    // ============================================================
    // MARK: Public Methods
    // ============================================================

    /// Update the tint color for the glass effect
    func updateTintColor(_ hexColor: String) {
        guard let color = UIColor.fromHex(hexColor) else {
            NSLog("[GlassPlayerView] ❌ Invalid hex color: \(hexColor)")
            return
        }

        // Log RGB values for debugging
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        color.getRed(&r, green: &g, blue: &b, alpha: &a)
        NSLog("[GlassPlayerView] 🎨 Updating tint color: hex=\(hexColor), RGB=(\(Int(r*255)),\(Int(g*255)),\(Int(b*255)))")

        currentTintColor = color

        // Update tint overlay with animation
        UIView.animate(withDuration: 0.2) {
            self.tintOverlay?.backgroundColor = color.withAlphaComponent(0.50)
        }

        // Update glass effect tint - IMPORTANT: UIGlassEffect tintColor affects the glass material
        if var effect = glassEffectView?.effect as? UIGlassEffect {
            effect.tintColor = color.withAlphaComponent(0.3)
            glassEffectView?.effect = effect
            NSLog("[GlassPlayerView] ✅ UIGlassEffect tint updated")
        } else {
            NSLog("[GlassPlayerView] ⚠️ Could not update UIGlassEffect tint")
        }
    }
}
