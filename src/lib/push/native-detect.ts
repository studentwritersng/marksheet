export interface CapacitorGlobalShape {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, unknown>;
}

/** True only inside the Capacitor WebView with the push plugin injected. */
export function isNativeWithPushPlugin(cap: CapacitorGlobalShape | undefined | null): boolean {
  return Boolean(cap?.isNativePlatform?.() && cap.Plugins?.PushNotifications);
}
