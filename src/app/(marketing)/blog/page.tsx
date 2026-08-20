import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = {
  title: "Marksheet Blog",
  description:
    "Product updates, guides and perspectives on running the school term with Marksheet for Nigerian secondary schools.",
};

export default async function BlogList() {
  const posts = await prisma.blogPost.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    include: { category: true },
  });

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: posts.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://marksheet.ng/blog/${p.slug}`,
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

      {posts.length === 0 ? (
        <p className="mt-10 text-sm text-mk-muted-fg">No posts published yet. Check back soon.</p>
      ) : (
        <ul className="mt-10 space-y-8">
          {posts.map((p) => (
            <li key={p.id} className="border-b border-mk-border pb-8 last:border-0">
              <Link
                href={`/blog/${p.slug}`}
                className="font-mk-display text-xl font-semibold hover:underline sm:text-2xl"
              >
                {p.title}
              </Link>
              {p.category && (
                <span className="ml-3 rounded-full bg-mk-secondary px-2.5 py-0.5 text-xs font-medium text-mk-secondary-fg">
                  {p.category.name}
                </span>
              )}
              {p.excerpt && (
                <p className="mt-3 text-sm leading-relaxed text-mk-muted-fg">{p.excerpt}</p>
              )}
              {p.publishedAt && (
                <p className="mt-3 text-xs text-mk-muted-fg">
                  {new Date(p.publishedAt).toLocaleDateString("en-NG", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {p.author ? ` · ${p.author}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
