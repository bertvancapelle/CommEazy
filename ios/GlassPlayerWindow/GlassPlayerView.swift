/**
 * GlassPlayerView — UIView with UIGlassEffect for Liquid Glass Player
 *
 * This view provides the actual Liquid Glass visual effect using iOS 26's
 * UIGlassEffect API. Because this view is in a separate UIWindow above
 * the main app content, UIGlassEffect can properly blur the content underneath.
 *
 * Layers (from bottom to top):
 * 1. Base layer - Dark background for visibility
 * 2. UIGlassEffect - Apple's native glass material (provides its own specular highlights)
 * 3. Tint overlay - Module-specific color at 50% opacity
 *
 * Note: highlightGradient, border, and shadow were removed because they caused
 * rendering conflicts with UIGlassEffect's internal specular highlights, resulting
 * in visible flickering at the bottom and right edges of the full player.
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
        clipsToBounds = true
        
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
    }

    // ============================================================
    // MARK: Public Methods
    // ============================================================

    // ============================================================
    // MARK: Touch Passthrough
    // ============================================================

    /// Pass touches through the glass view to subviews (miniPlayer/fullPlayer).
    /// If no subview claims the touch, return nil so the window's hitTest
    /// can pass it through to React Native.
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        // If only this view (the glass container) was hit, pass through
        if hit === self { return nil }
        return hit
    }

    /// Update the tint color for the glass effect
    func updateTintColor(_ hexColor: String) {
        guard let color = UIColor.fromHex(hexColor) else { return }

        currentTintColor = color

        // Update tint overlay with animation
        UIView.animate(withDuration: 0.2) {
            self.tintOverlay?.backgroundColor = color.withAlphaComponent(0.50)
        }

        // Update glass effect tint - UIGlassEffect tintColor affects the glass material
        if var effect = glassEffectView?.effect as? UIGlassEffect {
            effect.tintColor = color.withAlphaComponent(0.3)
            glassEffectView?.effect = effect
        }
    }
}
