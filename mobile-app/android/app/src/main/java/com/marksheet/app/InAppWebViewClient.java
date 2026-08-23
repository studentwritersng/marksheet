package com.marksheet.app;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Keeps every http(s) navigation inside the app WebView instead of handing it
 * to the system browser. Non-http(s) schemes (tel:, mailto:, intent:, ...) are
 * still delegated to the system via Bridge.launchIntent.
 */
public class InAppWebViewClient extends BridgeWebViewClient {

    private final Bridge bridgeRef;

    public InAppWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridgeRef = bridge;
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
