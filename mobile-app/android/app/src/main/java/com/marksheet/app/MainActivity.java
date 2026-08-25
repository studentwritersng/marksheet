package com.marksheet.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Matches push.ts FCM android.notification.channel_id and the sound file
    // res/raw/marksheet_notification.mp3 (named without extension).
    private static final String NOTIF_CHANNEL_ID = "marksheet_notifications";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();

        Bridge bridge = getBridge();
        if (bridge != null) {
            bridge.setWebViewClient(new InAppWebViewClient(bridge));

            // If a school's login domain was remembered, open it directly instead
            // of the generic login. Persists until app data is wiped/uninstalled.
            android.content.SharedPreferences prefs =
                getSharedPreferences(InAppWebViewClient.PREFS_NAME, android.content.Context.MODE_PRIVATE);
            String schoolLoginUrl = prefs.getString(InAppWebViewClient.KEY_SCHOOL_LOGIN, null);
            WebView wv = bridge.getWebView();
            if (schoolLoginUrl != null && !schoolLoginUrl.isEmpty() && wv != null) {
                wv.loadUrl(schoolLoginUrl);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        Uri sound = Uri.parse("android.resource://" + getPackageName() + "/raw/marksheet_notification");
        NotificationChannel channel = new NotificationChannel(
            NOTIF_CHANNEL_ID, "Notifications", NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Marksheet notifications");
        channel.enableVibration(true);
        channel.setSound(sound, new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build());
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) {
            nm.createNotificationChannel(channel);
        }
    }
}
