import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FEATURES } from "@/lib/features";
import { SITE_URL } from "@/lib/site";

export const metadata = {
  title: "All Features — Marksheet",
  description:
    "18 modules that run the Nigerian secondary school term end to end — from syllabus and lesson notes through exams, results, fees, messaging and push. Browse every feature and read the deep dive.",
  alternates: {
    canonical: `${SITE_URL}/features`,
  },
};

export default function FeaturesIndex() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Marksheet Features",
    itemListElement: FEATURES.map((f, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://marksheet.top/features/${f.slug}`,
      name: f.title,
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 lg:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <div className="max-w-3xl">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">Features</p>
        <h1 className="mt-4 font-mk-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
          One structured home for the whole school term.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-mk-muted-fg">
          Eighteen modules, one tenant per school. Start with the term you already run — Marksheet simply
          gives it a shape that can be taught, examined, computed, verified and audited without re-typing
          anything. Every card below opens a deep dive: the real challenge, how Marksheet solves it, and
          what changes for the school.
        </p>
      </div>

      {/* Grid — one card per feature: category, title, excerpt, Read about this feature */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Link
            key={f.slug}
            href={`/features/${f.slug}`}
            className="group flex flex-col overflow-hidden rounded-3xl border border-mk-border bg-mk-card shadow-mk-soft transition-colors hover:border-mk-primary/40"
          >
             <div className="flex min-w-0 flex-1 flex-col p-6">
               <div className="flex items-center gap-2">
                 <span className="rounded-full bg-mk-secondary px-2.5 py-0.5 text-xs font-medium text-mk-secondary-fg">
                   {f.category}
                 </span>
                 <span className="text-xs text-mk-muted-fg">{f.module}</span>
               </div>
               <h2 className="mt-3 font-mk-display text-xl font-bold leading-snug transition-colors group-hover:text-mk-primary">
                 {f.shortTitle}
               </h2>
               <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-mk-muted-fg">{f.excerpt}</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-mk-primary">
                Read about this feature
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/#platform"
          className="inline-flex items-center gap-2 rounded-full bg-mk-ink px-6 py-3 text-sm font-bold text-mk-ink-fg"
        >
          See how it fits the term
          <ArrowUpRight className="h-4 w-4" />
        </Link>
        <Link
          href="/#demo"
          className="inline-flex items-center gap-2 rounded-full border border-mk-border bg-mk-card px-6 py-3 text-sm font-semibold"
        >
          Book a demo
        </Link>
      </div>
    </div>
  );
}
