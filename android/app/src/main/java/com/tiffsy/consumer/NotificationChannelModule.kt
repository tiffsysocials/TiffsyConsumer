package com.tiffsy.consumer

import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

/**
 * Native module for creating Android notification channels
 * Required for Android 8.0 (API level 26) and above
 */
class NotificationChannelModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "NotificationChannelModule"
    }

    /**
     * Create all notification channels for the app
     * Should be called once when app starts
     */
    @ReactMethod
    fun createNotificationChannels(promise: Promise) {
        try {
            NotificationHelper.createChannels(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CHANNEL_ERROR", "Failed to create notification channels: ${e.message}", e)
        }
    }

    /**
     * Delete a notification channel
     * Useful for testing or cleanup
     */
    @ReactMethod
    fun deleteNotificationChannel(channelId: String, promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val notificationManager = reactApplicationContext
                    .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                notificationManager.deleteNotificationChannel(channelId)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("DELETE_ERROR", "Failed to delete channel: ${e.message}", e)
            }
        } else {
            promise.resolve(true)
        }
    }

    /**
     * Get list of all notification channels
     * Useful for debugging
     */
    @ReactMethod
    fun getNotificationChannels(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val notificationManager = reactApplicationContext
                    .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                val channels = notificationManager.notificationChannels
                val channelList = channels.map { channel ->
                    mapOf(
                        "id" to channel.id,
                        "name" to channel.name.toString(),
                        "importance" to channel.importance
                    )
                }

                promise.resolve(channelList)
            } catch (e: Exception) {
                promise.reject("GET_ERROR", "Failed to get channels: ${e.message}", e)
            }
        } else {
            promise.resolve(emptyList<Map<String, Any>>())
        }
    }
}
