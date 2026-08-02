import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { getContentBlocks, blockContent, FAQ_KEYS } from "@/lib/marketing/content";
import { DemoRequestForm } from "./(marketing)/demo-request-form";
import Link from "next/link";

export const metadata = {
  title: "Marksheet — Syllabus, Exams & Results Portal for Nigerian Schools",
  description:
    "The complete academic portal for Nigerian secondary schools. Manage syllabus, lesson notes, examinations, AI-assisted grading, results, and public report-card verification — all in one calm platform.",
  openGraph: {
    title: "Marksheet — Syllabus, Exams & Results Portal for Nigerian Schools",
    description:
      "Syllabus, lesson notes, examinations, AI-assisted grading, results, and public report-card verification for Nigerian secondary schools.",
    type: "website",
  },
};

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Why Marksheet", href: "#why" },
  { label: "Addons", href: "#addons" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === "platform_owner") redirect("/console");
    if (user.role === "referral") redirect("/referral/dashboard");
    redirect("/dashboard");
  }

  const [blocks, addons] = await Promise.all([
    getContentBlocks(),
    prisma.addon.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const content = (key: string) => blockContent(blocks, key);

  const pillars = [
    { icon: content("pillar_1_icon") || "menu_book", title: content("pillar_1_title"), desc: content("pillar_1_desc") },
    { icon: content("pillar_2_icon") || "quiz", title: content("pillar_2_title"), desc: content("pillar_2_desc") },
    { icon: content("pillar_3_icon") || "verified", title: content("pillar_3_title"), desc: content("pillar_3_desc") },
  ];

  const differentiators = [
    { icon: "wifi_off", title: content("diff_1_title"), desc: content("diff_1_desc") },
    { icon: "lock", title: content("diff_2_title"), desc: content("diff_2_desc") },
    { icon: "policy", title: content("diff_3_title"), desc: content("diff_3_desc") },
    { icon: "swap_horiz", title: content("diff_4_title"), desc: content("diff_4_desc") },
  ];

  const faqItems = [];
  for (let i = 0; i < FAQ_KEYS.length; i += 2) {
    const q = content(FAQ_KEYS[i]);
    const a = content(FAQ_KEYS[i + 1]);
    if (q && a) faqItems.push({ q, a });
  }

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur border-b border-outline-variant">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px] text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                school
              </span>
            </div>
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">Marksheet</span>
          </a>

          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/verify"
              className="hidden sm:flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              Verify a Result
            </Link>
            <a
              href="#demo"
              className="bg-primary text-on-primary font-label-md text-label-md py-2.5 px-5 rounded-lg hover:bg-primary-container transition-colors"
            >
              Book a Demo
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary-container" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-16 left-10 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 bg-white/10 text-white/90 border border-white/20 rounded-full px-3 py-1.5 font-label-sm text-label-sm mb-6">
                <span className="material-symbols-outlined text-[16px]">flag</span>
                {content("hero_badge")}
              </span>
              <h1 className="font-headline-lg text-headline-lg md:text-[44px] leading-[1.15] text-white mb-5 tracking-tight">
                {content("hero_headline")}
              </h1>
              <p className="font-body-lg text-body-lg text-white/85 max-w-xl mb-8 leading-relaxed">
                {content("hero_subheadline")}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="#demo"
                  className="bg-white text-primary font-label-md text-label-md py-3.5 px-8 rounded-lg hover:bg-surface-container shadow-lg transition-colors"
                >
                  {content("hero_cta")}
                </a>
                <Link
                  href="/verify"
                  className="flex items-center gap-2 border-2 border-white/60 text-white font-label-md text-label-md py-3 px-8 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  {content("hero_secondary")}
                </Link>
              </div>

              {/* Product screenshot placeholder — swappable image reference */}
              <div className="mt-10 hidden lg:flex items-center gap-2 text-white/60 font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[16px]">monitoring</span>
                One school. One term. Every result computed, verified, and published.
              </div>
            </div>

            {/* Product visual */}
            <div className="hidden lg:block">
              <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 bg-surface-container-low border-b border-outline-variant">
                  <span className="w-3 h-3 rounded-full bg-error/70" />
                  <span className="w-3 h-3 rounded-full bg-[#f5a623]/70" />
                  <span className="w-3 h-3 rounded-full bg-secondary/70" />
                  <span className="ml-3 font-label-sm text-label-sm text-on-surface-variant">Report card preview — SS1 Science</span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-headline-sm text-headline-sm text-on-surface">Adaeze Okafor</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">SS1 Science · First Term 2025/2026</p>
                    </div>
                    <span className="bg-primary text-on-primary font-label-sm text-label-sm px-3 py-1.5 rounded-lg">
                      A1
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      ["Mathematics", 87, "A1"],
                      ["English Language", 82, "B2"],
                      ["Biology", 78, "B2"],
                      ["Chemistry", 74, "B3"],
                      ["Physics", 79, "B2"],
                    ].map(([subj, score, grade]) => (
                      <div key={subj as string} className="flex items-center gap-3 bg-surface-container-low rounded-lg px-3 py-2.5">
                        <span className="flex-1 font-body-sm text-body-sm text-on-surface">{subj as string}</span>
                        <span className="font-label-md text-label-md text-on-surface">{score as string}</span>
                        <span className="bg-surface-variant text-on-surface-variant font-label-sm text-label-sm px-2 py-0.5 rounded">{grade as string}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-outline-variant pt-3">
                    <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
                      Verified · Code MS-8KQ2X7L3P
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface">80.0%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem framing */}
      <section className="py-20 md:py-28 bg-surface">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <span className="font-label-md text-label-md text-primary font-semibold uppercase tracking-wider mb-3 block">
                The problem
              </span>
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-5 tracking-tight">
                {content("problem_headline")}
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
                {content("problem_text")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                [content("problem_stat_1"), content("problem_stat_1_label")],
                [content("problem_stat_2"), content("problem_stat_2_label")],
                [content("problem_stat_3"), content("problem_stat_3_label")],
              ].map(([stat, label]) => (
                <div key={label} className="bg-surface-container-low rounded-xl p-6 text-center">
                  <p className="font-headline-lg text-headline-lg text-primary mb-1">{stat}</p>
                  <p className="font-label-md text-label-md text-on-surface-variant">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Three core feature pillars */}
      <section id="features" className="py-20 md:py-28 bg-surface-container-lowest border-y border-outline-variant">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="font-label-md text-label-md text-primary font-semibold uppercase tracking-wider mb-3 block">
              The platform
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4 tracking-tight">
              Everything in the academic cycle, in one place
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mx-auto">
              Three pillars carry the whole school year — from the first syllabus upload to a verified report card.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {pillars.map((p) => (
              <div key={p.title} className="bg-surface border border-outline-variant rounded-2xl p-8 hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className="w-14 h-14 rounded-xl bg-primary-container flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-[30px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {p.icon}
                  </span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-3">{p.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section id="why" className="py-20 md:py-28 bg-surface">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="font-label-md text-label-md text-primary font-semibold uppercase tracking-wider mb-3 block">
              Why Marksheet
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4 tracking-tight">
              Built for the realities of running a school in Nigeria
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mx-auto">
              We designed around the things that break paper systems — unreliable internet, busy exam seasons, and the need to prove results are genuine.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {differentiators.map((d) => (
              <div key={d.title} className="flex gap-5 bg-surface-container-lowest border border-outline-variant rounded-2xl p-7">
                <div className="w-12 h-12 shrink-0 rounded-lg bg-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[26px] text-on-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {d.icon}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">{d.title}</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Addon marketplace teaser — pulled live from the catalog */}
      <section id="addons" className="py-20 md:py-28 bg-primary text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 font-label-md text-label-md text-primary-fixed bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
              <span className="material-symbols-outlined text-[18px]">extension</span>
              Addon Marketplace
            </span>
            <h2 className="font-headline-lg text-headline-lg text-white mb-4 tracking-tight">
              {content("addons_headline")}
            </h2>
            <p className="font-body-md text-body-md text-white/80 max-w-2xl mx-auto">
              {content("addons_subheadline")}
            </p>
          </div>

          {addons.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {addons.map((a) => (
                <div key={a.id} className="bg-white/10 border border-white/15 rounded-2xl p-7 backdrop-blur-sm hover:bg-white/15 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px] text-primary-fixed">extension</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-white">{a.name}</h3>
                  </div>
                  <p className="font-body-sm text-body-sm text-white/75 leading-relaxed">{a.description}</p>
                  <div className="mt-5">
                    <span className="font-label-sm text-label-sm text-primary-fixed">
                      Available on request
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto bg-white/10 border border-white/15 rounded-2xl p-8 text-center">
              <p className="font-body-md text-body-md text-white/80">
                New addons — like the Timetable Generator and SMS &amp; WhatsApp messaging — are arriving soon. Ask about them in your demo.
              </p>
            </div>
          )}

          <div className="mt-10 text-center">
            <a
              href="#demo"
              className="bg-white text-primary font-label-md text-label-md py-3 px-8 rounded-lg hover:bg-surface-container transition-colors"
            >
              Ask about addons in your demo
            </a>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-28 bg-surface">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="font-label-md text-label-md text-primary font-semibold uppercase tracking-wider mb-3 block">
              Pricing
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4 tracking-tight">
              Simple pricing, set up personally
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mx-auto">
              {content("pricing_note")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
              <p className="font-label-md text-label-md text-on-surface-variant mb-3">Monthly</p>
              <p className="font-headline-lg text-headline-lg text-on-surface mb-1">{content("pricing_monthly")}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">per school, per month</p>
              <a href="#demo" className="w-full block bg-surface-container border border-outline-variant text-on-surface font-label-md text-label-md py-3 px-6 rounded-lg hover:bg-surface-container-high transition-colors">
                {content("pricing_cta")}
              </a>
            </div>
            <div className="bg-primary text-white rounded-2xl p-8 text-center shadow-xl relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-on-secondary font-label-sm text-label-sm px-3 py-1 rounded-full">
                Most popular
              </span>
              <p className="font-label-md text-label-md text-white/80 mb-3">Termly</p>
              <p className="font-headline-lg text-headline-lg text-white mb-1">{content("pricing_termly")}</p>
              <p className="font-body-sm text-body-sm text-white/70 mb-6">per school, per term</p>
              <a href="#demo" className="w-full block bg-white text-primary font-label-md text-label-md py-3 px-6 rounded-lg hover:bg-surface-container transition-colors">
                {content("pricing_cta")}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-28 bg-surface-container-lowest border-y border-outline-variant">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="font-label-md text-label-md text-primary font-semibold uppercase tracking-wider mb-3 block">
              FAQ
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4 tracking-tight">
              Questions schools ask us
            </h2>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <details key={i} className="group bg-surface border border-outline-variant rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none">
                  <span className="font-label-md text-label-md text-on-surface">{item.q}</span>
                  <span className="material-symbols-outlined text-[22px] text-on-surface-variant transition-transform group-open:rotate-180">
                    expand_more
                  </span>
                </summary>
                <div className="px-6 pb-5">
                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final lead-capture CTA */}
      <section id="demo" className="py-20 md:py-28 bg-surface">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="lg:sticky lg:top-24">
              <span className="font-label-md text-label-md text-primary font-semibold uppercase tracking-wider mb-3 block">
                Book a demo
              </span>
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-5 tracking-tight">
                {content("cta_headline")}
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed mb-8">
                {content("cta_subheadline")}
              </p>

              <div className="space-y-4">
                {[
                  ["person", "A short call with someone who knows the product", "Tell us about your school, and we'll show the platform fitted to it."],
                  ["quiz", "A live walkthrough, not a slide deck", "We run through a session setup, a real exam, and a published report card."],
                  ["receipt_long", "A clear next step, no pressure", "You'll know exactly what licensing looks like and what happens next."],
                ].map(([icon, title, desc]) => (
                  <div key={title} className="flex gap-4">
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-secondary-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px] text-on-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {icon}
                      </span>
                    </div>
                    <div>
                      <p className="font-headline-sm text-headline-sm text-on-surface mb-1">{title}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-7 md:p-9 shadow-xl">
              <DemoRequestForm source="homepage_cta" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-14 bg-primary text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                    school
                  </span>
                </div>
                <span className="font-headline-sm text-headline-sm text-white font-semibold">Marksheet</span>
              </div>
              <p className="font-body-sm text-body-sm text-white/70 leading-relaxed">
                Syllabus, lesson note, examination &amp; result portal for Nigerian secondary schools.
              </p>
            </div>

            <div>
              <p className="font-label-md text-label-md text-white/90 font-semibold mb-4">Platform</p>
              <ul className="space-y-2.5 font-body-sm text-body-sm text-white/70">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#why" className="hover:text-white transition-colors">Why Marksheet</a></li>
                <li><a href="#addons" className="hover:text-white transition-colors">Addons</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>

            <div>
              <p className="font-label-md text-label-md text-white/90 font-semibold mb-4">For Parents &amp; Employers</p>
              <ul className="space-y-2.5 font-body-sm text-body-sm text-white/70">
                <li>
                  <Link href="/verify" className="flex items-center gap-1.5 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    Result Verification Portal
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="font-label-md text-label-md text-white/90 font-semibold mb-4">Contact</p>
              <ul className="space-y-2.5 font-body-sm text-body-sm text-white/70">
                <li><a href="#demo" className="hover:text-white transition-colors">Book a demo</a></li>
                <li><a href="mailto:hello@marksheet.dev" className="hover:text-white transition-colors">hello@marksheet.dev</a></li>
                <li>Nigeria</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/15 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-body-sm text-body-sm text-white/60">
              © {new Date().getFullYear()} Marksheet. Built for Nigerian schools.
            </p>
            <p className="font-body-sm text-body-sm text-white/60">
              Syllabus · Lesson Notes · Exams · Results
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
