export interface LegalSection {
  heading: string;
  body: string;
}

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <article>
      <header className="border-b border-mk-border pb-8">
        <h1 className="font-mk-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-mk-muted-fg">Last updated: {updated}</p>
        {intro && <p className="mt-6 text-base leading-relaxed text-mk-muted-fg">{intro}</p>}
      </header>

      <div className="mt-10 space-y-8">
        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="font-mk-display text-xl font-bold">{s.heading}</h2>
            <div className="mt-3 h-px rule-line" />
            <p className="mt-4 text-base leading-relaxed text-mk-muted-fg">{s.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
