import type { CapacitorConfig } from "@capacitor/cli";
import { APP_CONFIG } from "./app.config";

const config: CapacitorConfig = {
  appId: APP_CONFIG.packageId,
  appName: APP_CONFIG.appName,
  webDir: "www",
  server: {
    url: APP_CONFIG.defaultUrl,
    cleartext: false,
  },
  android: {
    backgroundColor: APP_CONFIG.backgroundColor,
    allowMixedContent: false,
  },
};

export default config;
