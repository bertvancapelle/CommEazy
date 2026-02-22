package com.commeazytemp

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * AppleMusicModule — Android Apple Music App Detection
 *
 * On Android, Apple Music functionality is limited to detecting if the Apple Music app
 * is installed and providing options to:
 * - Open the Play Store to download Apple Music
 * - Open the Apple Music app if installed
 *
 * Full playback integration is only available on iOS via MusicKit.
 *
 * @see .claude/plans/APPLE_MUSIC_IMPLEMENTATION.md
 */
class AppleMusicModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AppleMusicModule"
        private const val APPLE_MUSIC_PACKAGE = "com.apple.android.music"
        private const val PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=$APPLE_MUSIC_PACKAGE"
    }

    override fun getName(): String = "AppleMusicModule"

    /**
     * Check if Apple Music app is installed on the device.
     *
     * Returns:
     * - "app_installed": Apple Music app is available
     * - "app_not_installed": Apple Music app is not installed
     */
    @ReactMethod
    fun checkAuthStatus(promise: Promise) {
        try {
            val isInstalled = isAppleMusicInstalled()
            val status = if (isInstalled) "app_installed" else "app_not_installed"
            Log.d(TAG, "checkAuthStatus: $status")
            promise.resolve(status)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking auth status: ${e.message}")
            promise.reject("CHECK_ERROR", "Failed to check Apple Music status", e)
        }
    }

    /**
     * Check if Apple Music app is installed (helper method for UI).
     */
    @ReactMethod
    fun isAppInstalled(promise: Promise) {
        try {
            promise.resolve(isAppleMusicInstalled())
        } catch (e: Exception) {
            Log.e(TAG, "Error checking app installation: ${e.message}")
            promise.reject("CHECK_ERROR", "Failed to check if Apple Music is installed", e)
        }
    }

    /**
     * Open Google Play Store to download Apple Music app.
     */
    @ReactMethod
    fun openPlayStore(promise: Promise) {
        try {
            // Try to open Play Store app first
            val playStoreIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("market://details?id=$APPLE_MUSIC_PACKAGE")
                setPackage("com.android.vending")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val context = reactApplicationContext
            if (playStoreIntent.resolveActivity(context.packageManager) != null) {
                context.startActivity(playStoreIntent)
                Log.d(TAG, "Opened Play Store app")
                promise.resolve(mapOf("success" to true, "method" to "play_store_app"))
            } else {
                // Fallback to web browser
                val webIntent = Intent(Intent.ACTION_VIEW).apply {
                    data = Uri.parse(PLAY_STORE_URL)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(webIntent)
                Log.d(TAG, "Opened Play Store in browser")
                promise.resolve(mapOf("success" to true, "method" to "browser"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error opening Play Store: ${e.message}")
            promise.reject("PLAY_STORE_ERROR", "Failed to open Play Store", e)
        }
    }

    /**
     * Open the Apple Music app if installed.
     * User chose "Open Apple Music" when app is installed.
     */
    @ReactMethod
    fun openAppleMusicApp(promise: Promise) {
        try {
            val context = reactApplicationContext
            val launchIntent = context.packageManager.getLaunchIntentForPackage(APPLE_MUSIC_PACKAGE)

            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(launchIntent)
                Log.d(TAG, "Opened Apple Music app")
                promise.resolve(mapOf("success" to true))
            } else {
                Log.w(TAG, "Apple Music app not found")
                promise.reject("APP_NOT_FOUND", "Apple Music app is not installed", null)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error opening Apple Music app: ${e.message}")
            promise.reject("OPEN_ERROR", "Failed to open Apple Music app", e)
        }
    }

    /**
     * Deep link into Apple Music with a specific content.
     * Tries to open a song, album, playlist, or artist in Apple Music.
     *
     * @param type Content type: "song", "album", "playlist", "artist"
     * @param id Apple Music content ID
     */
    @ReactMethod
    fun openContent(type: String, id: String, promise: Promise) {
        try {
            if (!isAppleMusicInstalled()) {
                promise.reject("APP_NOT_INSTALLED", "Apple Music app is not installed", null)
                return
            }

            // Apple Music deep links use music.apple.com URLs
            // The app should intercept these if installed
            val deepLink = when (type) {
                "song" -> "https://music.apple.com/song/$id"
                "album" -> "https://music.apple.com/album/$id"
                "playlist" -> "https://music.apple.com/playlist/$id"
                "artist" -> "https://music.apple.com/artist/$id"
                else -> {
                    promise.reject("INVALID_TYPE", "Invalid content type: $type", null)
                    return
                }
            }

            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse(deepLink)
                setPackage(APPLE_MUSIC_PACKAGE)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            reactApplicationContext.startActivity(intent)
            Log.d(TAG, "Opened Apple Music content: $type/$id")
            promise.resolve(mapOf("success" to true, "deepLink" to deepLink))
        } catch (e: Exception) {
            Log.e(TAG, "Error opening content: ${e.message}")
            promise.reject("OPEN_ERROR", "Failed to open content in Apple Music", e)
        }
    }

    /**
     * Get information about the platform's Apple Music capabilities.
     */
    @ReactMethod
    fun getCapabilities(promise: Promise) {
        val capabilities = mapOf(
            "platform" to "android",
            "hasMusicKit" to false,
            "canSearch" to false,          // No search API on Android
            "canPlayback" to false,        // No playback control on Android
            "canDeepLink" to isAppleMusicInstalled(),
            "appInstalled" to isAppleMusicInstalled()
        )
        promise.resolve(capabilities)
    }

    // ============================================================
    // Helper Methods
    // ============================================================

    private fun isAppleMusicInstalled(): Boolean {
        return try {
            val packageManager = reactApplicationContext.packageManager
            packageManager.getPackageInfo(APPLE_MUSIC_PACKAGE, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }
}
