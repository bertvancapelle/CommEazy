/**
 * UIColorExtensions — Shared UIColor extensions for GlassPlayerWindow
 *
 * Provides hex color initialization for all glass player components.
 */

import UIKit

// Only define if not already defined elsewhere
// Using a unique name to avoid conflicts with LiquidGlassModule

extension UIColor {
    /// Initialize UIColor from hex string (e.g., "#00897B" or "00897B")
    /// This is named differently to avoid conflict with LiquidGlassModule
    static func fromHex(_ hex: String) -> UIColor? {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        
        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }
        
        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
        let b = CGFloat(rgb & 0x0000FF) / 255.0
        
        return UIColor(red: r, green: g, blue: b, alpha: 1.0)
    }
}
