package com.marksheet.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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
}
