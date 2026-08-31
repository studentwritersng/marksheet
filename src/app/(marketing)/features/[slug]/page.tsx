import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronLeft } from "lucide-react";
import { FEATURES, getFeature } from "@/lib/features";
import { getFeatureDeepDive } from "@/lib/features-content";

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = getFeature(slug);
  if (!f) return {};
  return {
    title: `${f.shortTitle} — Marksheet Feature`,
    description: f.excerpt,
    openGraph: {
      title: f.title,
      description: f.excerpt,
      type: "article",
      url: `https://marksheet.top/features/${f.slug}`,
      images: [{ url: f.image, alt: f.imageAlt }],
    },
  };
}

function Prose({ text }: { text: string }) {
  // Minimal markdown-lite: split paragraphs, keep line breaks.
  return (
    <div className="space-y-4 text-[15px] leading-7 text-mk-muted-fg">
      {text.trim().split(/\n\n+/).map((para, i) => (
        <p key={i} className="whitespace-pre-wrap">{para.trim()}</p>
      ))}
    </div>
  );
}

export default async function FeatureDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = getFeature(slug);
  if (!feature) notFound();
  const deep = getFeatureDeepDive(slug);
  if (!deep) notFound();

  const siblings = FEATURES;
  const idx = siblings.findIndex((f) => f.slug === slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: feature.title,
    description: feature.excerpt,
    image: feature.image,
    about: feature.category,
    isPartOf: { "@type": "ItemList", name: "Marksheet Features" },
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href="/features" className="inline-flex items-center gap-1.5 text-sm font-medium text-mk-muted-fg hover:text-mk-primary">
        <ChevronLeft className="h-4 w-4" />
        All features
      </Link>

      {/* Hero */}
      <div className="mt-6 overflow-hidden rounded-3xl border border-mk-border bg-mk-card shadow-mk-soft">
        <img src={feature.image} alt={feature.imageAlt} className="h-64 w-full object-cover sm:h-72" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-mk-secondary px-2.5 py-0.5 text-xs font-medium text-mk-secondary-fg">{feature.category}</span>
            <span className="text-xs text-mk-muted-fg">{feature.module}</span>
          </div>
          <h1 className="mt-3 font-mk-display text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">{feature.title}</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-mk-muted-fg">{feature.excerpt}</p>
        </div>
      </div>

      {/* The three required sections */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-10">
          <section className="rounded-3xl border border-mk-border bg-mk-card p-6 sm:p-8 shadow-mk-soft">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-coral">01 · The challenge</p>
            <h2 className="mt-3 font-mk-display text-2xl font-bold leading-tight">What actually goes wrong in a real term</h2>
            <div className="mt-4 h-px bg-mk-border" />
            <div className="mt-6"><Prose text={deep.challenge} /></div>
          </section>

          <section className="rounded-3xl border border-mk-border bg-mk-card p-6 sm:p-8 shadow-mk-soft">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">02 · How Marksheet provides the solution</p>
            <h2 className="mt-3 font-mk-display text-2xl font-bold leading-tight">How the module is built — files, flows and the details that matter</h2>
            <div className="mt-4 h-px bg-mk-border" />
            <div className="mt-6"><Prose text={deep.solution} /></div>
          </section>

          <section className="rounded-3xl bg-mk-ink p-6 sm:p-8 text-mk-ink-fg">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-amber">03 · How it helps the school</p>
            <h2 className="mt-3 font-mk-display text-2xl font-bold leading-tight">What changes for teachers, parents and the proprietor</h2>
            <div className="mt-4 h-px bg-white/10" />
            <div className="mt-6 space-y-4 text-[15px] leading-7 text-mk-ink-fg/80">
              {deep.helps.trim().split(/\n\n+/).map((para, i) => (
                <p key={i} className="whitespace-pre-wrap">{para.trim()}</p>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/#demo" className="inline-flex items-center gap-2 rounded-full bg-mk-warm px-5 py-2.5 text-sm font-bold text-mk-ink">
                Book a demo
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/features" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-mk-ink-fg backdrop-blur">
                Explore other features
              </Link>
            </div>
          </section>
        </div>

        {/* Sidebar: jump + siblings */}
        <aside className="min-w-0">
          <div className="sticky top-24 space-y-6">
            <div className="rounded-2xl border border-mk-border bg-mk-card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-mk-muted-fg">On this page</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><span className="font-medium">01 The challenge</span><span className="text-mk-muted-fg"> — why it hurts without it</span></li>
                <li><span className="font-medium">02 The solution</span><span className="text-mk-muted-fg"> — how Marksheet is wired</span></li>
                <li><span className="font-medium">03 How it helps</span><span className="text-mk-muted-fg"> — what the school feels</span></li>
              </ul>
            </div>

            <div className="rounded-2xl border border-mk-border bg-mk-card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-mk-muted-fg">Continue exploring</p>
              <div className="mt-3 grid gap-2">
                {prev && (
                  <Link href={`/features/${prev.slug}`} className="rounded-xl border border-mk-border p-3 hover:border-mk-primary/40">
                    <span className="block text-xs text-mk-muted-fg">Previous</span>
                    <span className="block text-sm font-semibold">{prev.shortTitle}</span>
                  </Link>
                )}
                {next && (
                  <Link href={`/features/${next.slug}`} className="rounded-xl border border-mk-border p-3 hover:border-mk-primary/40">
                    <span className="block text-xs text-mk-muted-fg">Next</span>
                    <span className="block text-sm font-semibold">{next.shortTitle}</span>
                  </Link>
                )}
              </div>
              <Link href="/features" className="mt-3 inline-flex text-sm font-semibold text-mk-primary hover:underline">
                See all 18 features
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
