package com.tiffsy.consumer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build

/**
 * Helper object for creating notification channels at app startup.
 * Called from Application.onCreate() to ensure channels exist
 * BEFORE any background FCM messages arrive.
 */
object NotificationHelper {

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val soundAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        // 1. Orders Channel (High Priority)
        val ordersChannel = NotificationChannel(
            "orders_channel",
            "Orders",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Order status updates and delivery notifications"
            enableLights(true)
            lightColor = android.graphics.Color.parseColor("#ff8800")
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 300, 200, 300)
            setSound(defaultSound, soundAttributes)
            setShowBadge(true)
        }

        // 2. Subscriptions Channel (High Priority)
        val subscriptionsChannel = NotificationChannel(
            "subscriptions_channel",
            "Subscriptions",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Subscription and voucher notifications"
            enableLights(true)
            lightColor = android.graphics.Color.parseColor("#8B5CF6")
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 200, 100, 200)
            setSound(defaultSound, soundAttributes)
            setShowBadge(true)
        }

        // 3. General Channel (High Priority)
        val generalChannel = NotificationChannel(
            "general_channel",
            "General",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Admin announcements, menu updates and promotional messages"
            enableLights(true)
            lightColor = android.graphics.Color.parseColor("#10B981")
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 200, 100, 200)
            setSound(defaultSound, soundAttributes)
            setShowBadge(true)
        }

        // 4. Default Channel (Fallback)
        val defaultChannel = NotificationChannel(
            "default_channel",
            "Default",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Default notifications"
            enableLights(true)
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 250, 250)
            setShowBadge(true)
        }

        notificationManager.createNotificationChannel(ordersChannel)
        notificationManager.createNotificationChannel(subscriptionsChannel)
        notificationManager.createNotificationChannel(generalChannel)
        notificationManager.createNotificationChannel(defaultChannel)
    }
}
