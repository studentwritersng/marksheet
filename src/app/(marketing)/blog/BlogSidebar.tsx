import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getSidebarData(currentSlug?: string, currentCategoryId?: string | null) {
  const [categories, latest, related] = await Promise.all([
    prisma.blogCategory.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { posts: { where: { status: "published" } } } } },
    }),
    prisma.blogPost.findMany({
      where: { status: "published", ...(currentSlug ? { slug: { not: currentSlug } } : {}) },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: { slug: true, title: true, excerpt: true, publishedAt: true },
    }),
    currentCategoryId
      ? prisma.blogPost.findMany({
          where: {
            status: "published",
            categoryId: currentCategoryId,
            ...(currentSlug ? { slug: { not: currentSlug } } : {}),
          },
          orderBy: { publishedAt: "desc" },
          take: 3,
          select: { slug: true, title: true, excerpt: true, publishedAt: true },
        })
      : Promise.resolve([]),
  ]);

  return { categories, latest, related };
}

function formatDate(d?: Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function BlogSidebar({
  currentSlug,
  currentCategoryId,
}: {
  currentSlug?: string;
  currentCategoryId?: string | null;
}) {
  const { categories, latest, related } = await getSidebarData(currentSlug, currentCategoryId);

  const hasRelated = related.length > 0;
  const postsForRail = hasRelated ? related : latest.slice(0, 3);
  const railHeading = hasRelated ? "Related posts" : "Latest posts";
  const activeCategories = categories.filter((c) => c._count.posts > 0);

  return (
    <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
      {/* Related / latest posts */}
      <section className="rounded-2xl border border-mk-border bg-mk-card p-5">
        <h2 className="font-mk-display text-base font-semibold text-mk-fg">{railHeading}</h2>
        <ul className="mt-4 space-y-4">
          {postsForRail.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="group block">
                <span className="font-medium text-mk-fg transition-colors group-hover:text-mk-primary">
                  {p.title}
                </span>
                {p.excerpt && (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-mk-muted-fg">{p.excerpt}</p>
                )}
                {p.publishedAt && (
                  <p className="mt-1 text-xs text-mk-muted-fg/70">{formatDate(p.publishedAt)}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Categories */}
      {activeCategories.length > 0 && (
        <section className="rounded-2xl border border-mk-border bg-mk-card p-5">
          <h2 className="font-mk-display text-base font-semibold text-mk-fg">Categories</h2>
          <ul className="mt-4 space-y-1">
            {activeCategories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/blog?category=${c.slug}`}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-mk-muted-fg transition-colors hover:bg-mk-secondary hover:text-mk-secondary-fg"
                >
                  <span>{c.name}</span>
                  <span className="rounded-full bg-mk-secondary px-2 py-0.5 text-xs font-medium text-mk-secondary-fg">
                    {c._count.posts}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Other important info — platform promo */}
      <section className="rounded-2xl border border-mk-border bg-mk-ink p-5 text-mk-ink-fg">
        <h2 className="font-mk-display text-base font-semibold">Run your school on Marksheet</h2>
        <p className="mt-2 text-sm leading-relaxed text-mk-ink-fg/80">
          Syllabus, lesson notes, exams and results for Nigerian secondary schools — in one place.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-mk-primary px-5 py-2.5 text-sm font-semibold text-mk-primary-fg transition-colors hover:bg-mk-violet"
        >
          Explore Marksheet
        </Link>
      </section>
    </aside>
  );
}
