import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { BlogSidebar } from "./BlogSidebar";

// Always render from live data — the blog list must reflect the current set of
// published posts (Vercel was serving a cached response that omitted newer posts).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marksheet Blog",
  description:
    "Product updates, guides and perspectives on running the school term with Marksheet for Nigerian secondary schools.",
};

export default async function BlogList({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const posts = await prisma.blogPost.findMany({
    where: category
      ? { status: "published", category: { slug: category } }
      : { status: "published" },
    orderBy: { publishedAt: "desc" },
    include: { category: true },
  });

  const activeCategory = category
    ? await prisma.blogCategory.findUnique({
        where: { slug: category },
        select: { name: true },
      })
    : null;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: posts.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/blog/${p.slug}`,
      name: p.title,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <h1 className="font-mk-display text-3xl font-bold leading-tight sm:text-4xl">
        Marksheet Blog
      </h1>
      <p className="mt-3 text-base text-mk-muted-fg">
        Guides, updates and perspectives for running the school term end to end.
      </p>

      {activeCategory && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-mk-muted-fg">Filtered by</span>
          <span className="rounded-full bg-mk-secondary px-3 py-1 font-medium text-mk-secondary-fg">
            {activeCategory.name}
          </span>
          <Link href="/blog" className="text-mk-primary hover:underline">
            Clear filter
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          {posts.length === 0 ? (
            <p className="mt-10 text-sm text-mk-muted-fg">No posts published yet. Check back soon.</p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2">
              {posts.map((p) => (
                <li key={p.id} className="flex flex-col rounded-2xl border border-mk-border bg-mk-card p-5">
                  <Link
                    href={`/blog/${p.slug}`}
                    className="font-mk-display text-lg font-semibold leading-snug hover:text-mk-primary sm:text-xl"
                  >
                    {p.title}
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {p.category && (
                      <span className="rounded-full bg-mk-secondary px-2.5 py-0.5 text-xs font-medium text-mk-secondary-fg">
                        {p.category.name}
                      </span>
                    )}
                    {p.publishedAt && (
                      <span className="text-xs text-mk-muted-fg">
                        {new Date(p.publishedAt).toLocaleDateString("en-NG", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                        {p.author ? ` · ${p.author}` : ""}
                      </span>
                    )}
                  </div>
                  {p.excerpt && (
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-mk-muted-fg">{p.excerpt}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <BlogSidebar />
      </div>
    </>
  );
}
