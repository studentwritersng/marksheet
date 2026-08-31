import Link from "next/link";

const blogNav = [
  { label: "Blog", href: "/blog" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Cookie Policy", href: "/legal/cookies" },
];

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto max-w-5xl px-5 py-14 lg:py-20">{children}</main>

      <footer className="bg-mk-ink pb-10 text-mk-ink-fg">
        <div className="mx-auto grid max-w-6xl gap-6 border-t border-white/10 px-5 pt-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-center gap-1.5">
            <img src="/marksheet_logo.png" alt="Marksheet" className="h-6 w-auto brightness-0 invert" />
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs text-mk-ink-fg/50">
            {blogNav.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-mk-ink-fg">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-xs text-mk-ink-fg/50">
            © {new Date().getFullYear()} Marksheet · Built for Nigerian schools
          </p>
        </div>
      </footer>
    </>
  );
}