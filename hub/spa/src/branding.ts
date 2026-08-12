import { useEffect, useState } from "react";
import { fetchBranding, type Branding } from "./api";

export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>({ schoolName: "Exam Hub", logoUrl: null });

  useEffect(() => {
    let alive = true;
    fetchBranding().then((b) => {
      if (alive) setBranding(b);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    document.title = branding.schoolName;
    // Use the school logo as the favicon when one exists.
    if (branding.logoUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.logoUrl;
    }
  }, [branding]);

  return branding;
}
