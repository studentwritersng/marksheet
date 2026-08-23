package com.marksheet.app;

import android.graphics.Bitmap;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Keeps every http(s) navigation inside the app WebView instead of handing it
 * to the system browser. Non-http(s) schemes (tel:, mailto:, intent:, ...) are
 * still delegated to the system via Bridge.launchIntent.
 *
 * Also remembers the school's unique login domain: the first time a user lands
 * on a *.marksheet.top school subdomain, that host is persisted so the app can
 * open that school's dedicated login URL on later launches and after sign-out.
 */
public class InAppWebViewClient extends BridgeWebViewClient {

    static final String PREFS_NAME = "marksheet_app";
    static final String KEY_SCHOOL_LOGIN = "schoolLoginUrl";

    private final Bridge bridgeRef;

    public InAppWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridgeRef = bridge;
    }

    @Override
    public void onPageStarted(WebView view, String url, Bitmap favicon) {
        super.onPageStarted(view, url, favicon);
        captureSchoolDomain(view, url);
    }

    private void captureSchoolDomain(WebView view, String url) {
        try {
            Uri uri = Uri.parse(url);
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
                return;
            }
            String host = uri.getHost();
            if (host == null) return;
            String h = host.toLowerCase();
            // Only persist real school subdomains; never the apex, www, or
            // external hosts (e.g. OAuth providers).
            if (!h.endsWith(".marksheet.top")) return;
            if (h.equals("www.marksheet.top")) return;

            String schoolLoginUrl = "https://" + h + "/login";
            android.content.SharedPreferences prefs =
                view.getContext().getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE);
            if (!schoolLoginUrl.equals(prefs.getString(KEY_SCHOOL_LOGIN, null))) {
                prefs.edit().putString(KEY_SCHOOL_LOGIN, schoolLoginUrl).apply();
            }
        } catch (Exception ignored) {
            // Never let capture logic break page loading.
        }
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        String scheme = url.getScheme();
        if (scheme != null && !scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https")) {
            return bridgeRef.launchIntent(url);
        }
        return false;
    }

    @Override
    @Deprecated
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        if (scheme != null && !scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https")) {
            return bridgeRef.launchIntent(uri);
        }
        return false;
    }
}
