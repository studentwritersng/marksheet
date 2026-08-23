package com.marksheet.app;

import android.os.Bundle;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Bridge bridge = getBridge();
        if (bridge != null) {
            bridge.setWebViewClient(new InAppWebViewClient(bridge));
        }
    }
}
