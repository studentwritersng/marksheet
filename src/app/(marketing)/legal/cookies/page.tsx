import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy | Marksheet",
  description: "How Marksheet uses cookies and similar technologies, and how you can control them.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated="4 August 2026"
      intro="Marksheet uses cookies and similar technologies to keep you signed in, protect your session and understand how the service is used. This policy explains what they are, what we use them for, and how to control them."
      sections={[
        {
          heading: "What cookies are",
          body: "A cookie is a small text file stored on your device when you visit a website. Cookies let the site remember your session and preferences between pages.",
        },
        {
          heading: "Essential cookies",
          body: "These are required for the service to work. We use a session cookie to keep you signed in to the school platform, an owner console cookie, and security-related cookies that help stop unauthorised access. These cannot be switched off without breaking the service.",
        },
        {
          heading: "Preferences and function",
          body: "A small number of cookies store lightweight preferences such as language or layout choices. They do not identify you personally.",
        },
        {
          heading: "Analytics",
          body: "We use privacy-respecting analytics to understand which pages are visited and how the platform performs. These reports are aggregated and are not used to profile individual users.",
        },
        {
          heading: "Third-party cookies",
          body: "Our public pages load fonts from Google Fonts, which may set its own cookies as governed by Google's privacy policy. We do not place advertising cookies and we do not run advertising on the platform.",
        },
        {
          heading: "Controlling cookies",
          body: "You can clear or block cookies in your browser settings. Blocking essential cookies will prevent you from signing in and using the platform. Your browser's help section explains how to manage cookies on your device.",
        },
        {
          heading: "Changes",
          body: "We may update this policy as the platform or law changes. The date at the top of this page shows when it was last updated.",
        },
        {
          heading: "Contact",
          body: "Questions about cookies can be sent to support@marksheet.sch.ng.",
        },
      ]}
    />
  );
}
