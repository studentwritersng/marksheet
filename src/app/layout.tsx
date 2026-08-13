import type { Metadata } from "next";
import { after } from "next/server";
import "./globals.css";
import { pruneStaleRateLimitBuckets } from "@/lib/ai/prune-buckets";

export const metadata: Metadata = {
  title: "Marksheet",
  description:
    "Syllabus, lesson note, examination & result portal for Nigerian secondary schools",
  icons: {
    icon: "/marksheet_favicon.png",
    apple: "/marksheet_favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Post-render cleanup: prune stale AI rate-limit buckets without cron
  // infrastructure. `after` runs after the response is flushed; the job is
  // throttle-guarded to at most once per hour per process.
  after(() => {
    void pruneStaleRateLimitBuckets();
  });
  return (
    <html lang="en" className="light h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
