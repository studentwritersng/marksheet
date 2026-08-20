"use client";
import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics/events";

export function PublicAnalytics({
  measurementId,
  consentModeEnabled,
  isActive,
}: {
  measurementId: string | null;
  consentModeEnabled: boolean;
  isActive: boolean;
}) {
  const [consent, setConsent] = useState<"pending" | "granted" | "denied">(
    consentModeEnabled ? "pending" : "denied"
  );

  useEffect(() => {
    if (!isActive || !measurementId) return;

    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).gtag = function () {
      (window as any).dataLayer.push(arguments);
    };

    // Consent Mode v2 / NDPR: default DENIED until the visitor accepts.
    (window as any).gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      wait_for_update: 500,
    });

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(s);

    (window as any).gtag("js", new Date());
    (window as any).gtag("config", measurementId, {
      anonymize_ip: true,
      allow_google_signals: false,
    });

    if (consentModeEnabled) {
      const stored = window.localStorage.getItem("mk_ga_consent");
      if (stored === "granted") setConsent("granted");
      else if (stored === "denied") setConsent("denied");
    } else {
      setConsent("denied");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementId, consentModeEnabled, isActive]);

  useEffect(() => {
    if (!isActive || !measurementId) return;
    if (!consentModeEnabled) return;
    if (consent === "granted") {
      (window as any).gtag?.("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "granted",
      });
      trackEvent("consent_granted");
    } else if (consent === "denied") {
      (window as any).gtag?.("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
      });
    }
  }, [consent, consentModeEnabled, isActive, measurementId]);

  if (!isActive || !measurementId) return null;

  return (
    <div aria-hidden>
      <ConsentBanner
        consentModeEnabled={consentModeEnabled}
        consent={consent}
        onAccept={() => {
          window.localStorage.setItem("mk_ga_consent", "granted");
          setConsent("granted");
        }}
        onDecline={() => {
          window.localStorage.setItem("mk_ga_consent", "denied");
          setConsent("denied");
        }}
      />
    </div>
  );
}

function ConsentBanner({
  consentModeEnabled,
  consent,
  onAccept,
  onDecline,
}: {
  consentModeEnabled: boolean;
  consent: "pending" | "granted" | "denied";
  onAccept: () => void;
  onDecline: () => void;
}) {
  if (!consentModeEnabled) return null;
  if (consent !== "pending") return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-lg bg-white p-4 text-sm shadow-lg ring-1 ring-black/5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-mk-fg">
        We use cookies to understand how our public pages are used. No student or
        school data is ever tracked. You can decline and still use the site.
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onDecline}
          className="rounded-full border border-mk-border px-4 py-2 font-medium text-mk-muted-fg transition-colors hover:bg-mk-secondary"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="rounded-full bg-mk-ink px-4 py-2 font-semibold text-mk-ink-fg transition-colors hover:bg-mk-primary"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
