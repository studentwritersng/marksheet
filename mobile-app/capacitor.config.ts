import { APP_CONFIG } from "./app.config";

const config = {
  appId: APP_CONFIG.packageId,
  appName: APP_CONFIG.appName,
  webDir: "www",
  // Hosts that are allowed to load inside the app WebView instead of being
  // handed off to the system browser. The portal may redirect between the apex
  // and www hosts (and subdomains), so list them all.
  allowNavigation: ["marksheet.top", "www.marksheet.top", "*.marksheet.top"],
  server: {
    url: APP_CONFIG.defaultUrl,
    cleartext: false,
  },
  android: {
    backgroundColor: APP_CONFIG.backgroundColor,
    allowMixedContent: true,
    // Marker appended to the WebView user-agent. Bridge.java sets this natively
    // (setUserAgentString) for every page load, independent of JS bridge
    // injection — so the web app can report exactly which APK build is running.
    appendUserAgent: " CapApk4",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
