package com.yathralanka.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(true);
        // Keep Capacitor's WebChromeClient installed. It owns WebView camera
        // permission requests, which allows getUserMedia() to remain inside the
        // app instead of falling back to the device's external camera screen.
    }
}
