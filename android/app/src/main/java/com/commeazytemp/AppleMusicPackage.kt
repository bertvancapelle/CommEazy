package com.commeazytemp

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * React Native Package for AppleMusicModule.
 *
 * Registers the AppleMusicModule with React Native's module system.
 * On Android, this module provides app detection and deep linking only.
 *
 * @see AppleMusicModule
 * @see .claude/plans/APPLE_MUSIC_IMPLEMENTATION.md
 */
class AppleMusicPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(AppleMusicModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
