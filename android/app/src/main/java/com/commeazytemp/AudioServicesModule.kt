package com.commeazytemp

import android.content.Context
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * AudioServices Native Module for Android
 *
 * Provides haptic feedback with intensity control and audio feedback.
 * Uses VibrationEffect API (API 26+) for precise haptic control.
 *
 * @see src/hooks/useFeedback.ts
 */
class AudioServicesModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AudioServices"
    }

    override fun getName(): String = "AudioServices"

    private fun getVibrator(): Vibrator? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = reactApplicationContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            reactApplicationContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    /**
     * Play haptic feedback with a specific intensity level.
     *
     * @param intensity The intensity level: 1=veryLight, 2=light, 3=normal, 4=strong
     */
    @ReactMethod
    fun playHapticWithIntensity(intensity: Int) {
        Log.d(TAG, "playHapticWithIntensity called with intensity: $intensity")

        val vibrator = getVibrator()
        if (vibrator == null || !vibrator.hasVibrator()) {
            Log.w(TAG, "No vibrator available")
            return
        }

        // Map intensity levels to vibration parameters
        // Duration in ms, amplitude 1-255 (or VibrationEffect.DEFAULT_AMPLITUDE)
        val (duration, amplitude) = when (intensity) {
            1 -> Pair(30L, 50)    // veryLight: short, weak
            2 -> Pair(50L, 100)   // light: medium duration, medium-weak
            3 -> Pair(75L, 180)   // normal: longer, medium-strong
            4 -> Pair(100L, 255)  // strong: longest, maximum strength
            else -> Pair(50L, 100)
        }

        Log.d(TAG, "Playing haptic: duration=$duration ms, amplitude=$amplitude")

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Use VibrationEffect for API 26+
                val effect = if (intensity == 4) {
                    // For strong: use a double-pulse pattern for emphasis
                    val pattern = longArrayOf(0, duration, 50, duration)
                    val amplitudes = intArrayOf(0, amplitude, 0, amplitude)
                    VibrationEffect.createWaveform(pattern, amplitudes, -1)
                } else {
                    VibrationEffect.createOneShot(duration, amplitude)
                }
                vibrator.vibrate(effect)
                Log.d(TAG, "VibrationEffect played successfully")
            } else {
                // Fallback for older devices
                @Suppress("DEPRECATION")
                if (intensity == 4) {
                    vibrator.vibrate(longArrayOf(0, duration, 50, duration), -1)
                } else {
                    vibrator.vibrate(duration)
                }
                Log.d(TAG, "Legacy vibration played")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play haptic: ${e.message}")
        }
    }

    /**
     * Play a system sound (notification sound).
     * Respects device sound settings.
     *
     * @param soundId Ignored on Android, uses default notification sound
     */
    @ReactMethod
    fun playSystemSound(soundId: Int) {
        Log.d(TAG, "playSystemSound called")
        playNotificationSound(false)
    }

    /**
     * Play an alert sound.
     * On Android, plays the default notification sound.
     *
     * @param soundId Ignored on Android, uses default notification sound
     */
    @ReactMethod
    fun playAlertSound(soundId: Int) {
        Log.d(TAG, "playAlertSound called")
        playNotificationSound(false)
    }

    /**
     * Play a boosted alert sound (sound + vibration).
     *
     * @param soundId Ignored on Android
     */
    @ReactMethod
    fun playBoostedAlertSound(soundId: Int) {
        Log.d(TAG, "playBoostedAlertSound called")
        playNotificationSound(true)
    }

    /**
     * Play strong haptic (double vibration pattern).
     */
    @ReactMethod
    fun playStrongHaptic() {
        Log.d(TAG, "playStrongHaptic called")
        playHapticWithIntensity(4)
    }

    /**
     * Play only vibration.
     */
    @ReactMethod
    fun playVibration() {
        Log.d(TAG, "playVibration called")
        playHapticWithIntensity(3) // Use normal intensity
    }

    private fun playNotificationSound(withVibration: Boolean) {
        try {
            val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

            // Check if we should play sound (respects Do Not Disturb, etc.)
            if (audioManager != null) {
                val ringerMode = audioManager.ringerMode
                Log.d(TAG, "Ringer mode: $ringerMode")

                if (ringerMode == AudioManager.RINGER_MODE_SILENT) {
                    Log.d(TAG, "Device is in silent mode, skipping sound")
                    if (withVibration) {
                        playHapticWithIntensity(3)
                    }
                    return
                }

                if (ringerMode == AudioManager.RINGER_MODE_VIBRATE) {
                    Log.d(TAG, "Device is in vibrate mode")
                    playHapticWithIntensity(3)
                    return
                }
            }

            // Play notification sound
            val notification = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val ringtone = RingtoneManager.getRingtone(reactApplicationContext, notification)
            ringtone?.play()
            Log.d(TAG, "Notification sound played")

            // Add vibration for boosted mode
            if (withVibration) {
                playHapticWithIntensity(3)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play notification sound: ${e.message}")
            // Fallback to vibration
            if (withVibration) {
                playHapticWithIntensity(3)
            }
        }
    }
}
