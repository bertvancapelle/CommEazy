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
    private var currentTintColor: UIColor = .systemTeal

    // ============================================================
    // MARK: Initialization
    // ============================================================

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupGlassEffect()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupGlassEffect()
    }

    // ============================================================
    // MARK: Setup
    // ============================================================

    private func setupGlassEffect() {
        backgroundColor = .clear
        clipsToBounds = true

        // === Layer 1: UIGlassEffect — Real Liquid Glass! ===
        var glassEffect = UIGlassEffect()
        glassEffect.isInteractive = true  // Glass highlights respond to touch

        let effectView = UIVisualEffectView(effect: glassEffect)
        effectView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(effectView)

        NSLayoutConstraint.activate([
            effectView.leadingAnchor.constraint(equalTo: leadingAnchor),
            effectView.trailingAnchor.constraint(equalTo: trailingAnchor),
            effectView.topAnchor.constraint(equalTo: topAnchor),
            effectView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        glassEffectView = effectView

        // === Layer 2: Tint overlay ===
        let tint = UIView()
        tint.translatesAutoresizingMaskIntoConstraints = false
        tint.backgroundColor = currentTintColor.withAlphaComponent(0.25)
        tint.isUserInteractionEnabled = false
        addSubview(tint)

        NSLayoutConstraint.activate([
            tint.leadingAnchor.constraint(equalTo: leadingAnchor),
            tint.trailingAnchor.constraint(equalTo: trailingAnchor),
            tint.topAnchor.constraint(equalTo: topAnchor),
            tint.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        tintOverlay = tint

        // === Layer 3: Top highlight gradient (specular reflection) ===
        let gradient = CAGradientLayer()
        gradient.colors = [
            UIColor.white.withAlphaComponent(0.40).cgColor,
            UIColor.white.withAlphaComponent(0.15).cgColor,
            UIColor.clear.cgColor,
        ]
        gradient.locations = [0.0, 0.15, 0.35]
        gradient.startPoint = CGPoint(x: 0.5, y: 0.0)
        gradient.endPoint = CGPoint(x: 0.5, y: 1.0)
        layer.addSublayer(gradient)

        highlightGradient = gradient

        // === Layer 4: Border ===
        layer.borderColor = UIColor.white.withAlphaComponent(0.30).cgColor
        layer.borderWidth = 0.5

        NSLog("[GlassPlayerView] Setup complete with UIGlassEffect")
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
            NSLog("[GlassPlayerView] Invalid hex color: \(hexColor)")
            return
        }

        currentTintColor = color

        UIView.animate(withDuration: 0.2) {
            self.tintOverlay?.backgroundColor = color.withAlphaComponent(0.25)
        }

        // Update glass effect tint
        if var effect = glassEffectView?.effect as? UIGlassEffect {
            effect.tintColor = color.withAlphaComponent(0.3)
            glassEffectView?.effect = effect
        }

        NSLog("[GlassPlayerView] Updated tint color to: \(hexColor)")
    }
}
