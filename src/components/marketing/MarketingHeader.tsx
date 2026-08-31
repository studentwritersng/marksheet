"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

const nav = [
  { label: "Features", href: "/features" },
  { label: "The term", href: "#term" },
  { label: "Platform", href: "#platform" },
  { label: "Verify", href: "#verify" },
  { label: "Pricing", href: "#pricing" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

export default function MarketingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-mk-border bg-mk-bg/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 lg:flex lg:justify-between">
        <Link href="/" className="flex min-w-0 items-center gap-1.5">
          <img src="/marksheet_logo.png" alt="Marksheet" className="h-8 w-auto" />
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-mk-border bg-mk-card p-1 lg:flex">
          {nav.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-mk-muted-fg transition-colors hover:bg-mk-secondary hover:text-mk-secondary-fg"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <a
          href="#demo"
          className="hidden items-center gap-1.5 rounded-full bg-mk-ink px-5 py-2.5 text-sm font-semibold text-mk-ink-fg transition-colors hover:bg-mk-primary lg:inline-flex"
        >
          Book a demo
          <ArrowUpRight className="h-4 w-4" />
        </a>

        <button
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((v) => !v)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-mk-border lg:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-mk-border bg-mk-bg px-5 pb-5 pt-2 lg:hidden">
          {nav.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-mk-border py-3.5 text-sm font-medium"
            >
              {l.label}
              <ChevronRight className="h-4 w-4 text-mk-muted-fg" />
            </a>
          ))}
          <a
            href="#demo"
            onClick={() => setMenuOpen(false)}
            className="mt-4 block rounded-full bg-mk-ink px-5 py-3 text-center text-sm font-semibold text-mk-ink-fg"
          >
            Book a demo
          </a>
        </div>
      )}
    </header>
  );
}