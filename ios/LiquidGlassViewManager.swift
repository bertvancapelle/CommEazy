/**
 * LiquidGlassViewManager — React Native View Manager for Liquid Glass
 *
 * Bridges LiquidGlassNativeView to React Native.
 *
 * @see LiquidGlassModule.swift for the actual view implementation
 * @see LiquidGlassViewManager.m for Objective-C bridge
 * @see .claude/plans/LIQUID_GLASS_IMPLEMENTATION.md
 */

import React

// ============================================================
// MARK: - LiquidGlassViewManager
// ============================================================

@objc(LiquidGlassViewManager)
class LiquidGlassViewManager: RCTViewManager {

    override func view() -> UIView! {
        return LiquidGlassNativeView()
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}
