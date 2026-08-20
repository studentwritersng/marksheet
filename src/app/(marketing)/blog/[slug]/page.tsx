import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || post.status !== "published") return {};
  return {
    title: post.metaTitle ?? post.title,
    description: post.metaDescription ?? post.excerpt ?? undefined,
    openGraph: {
      title: post.metaTitle ?? post.title,
      description: post.metaDescription ?? post.excerpt ?? undefined,
      type: "article",
      ...(post.featuredImageUrl ? { images: [post.featuredImageUrl] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    include: { category: true },
  });
  if (!post || post.status !== "published") notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type":
      post.schemaType === "FAQPage"
        ? "FAQPage"
        : post.schemaType === "Article"
          ? "Article"
          : "BlogPosting",
    headline: post.title,
    ...(post.subtitle ? { alternativeHeadline: post.subtitle } : {}),
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(post.metaDescription ? { abstract: post.metaDescription } : {}),
    ...(post.featuredImageUrl ? { image: post.featuredImageUrl } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    dateModified: post.updatedAt,
    ...(post.author ? { author: { "@type": "Person", name: post.author } } : {}),
    ...(post.canonicalUrl
      ? { mainEntityOfPage: post.canonicalUrl, url: post.canonicalUrl }
      : {
          mainEntityOfPage: `https://marksheet.ng/blog/${post.slug}`,
          url: `https://marksheet.ng/blog/${post.slug}`,
        }),
    ...(post.category ? { articleSection: post.category.name } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link href="/blog" className="text-sm font-medium text-mk-muted-fg hover:underline">
        ← Back to blog
      </Link>

      <article className="mt-6">
        <header className="border-b border-mk-border pb-8">
          <h1 className="font-mk-display text-3xl font-bold leading-tight sm:text-4xl">
            {post.title}
          </h1>
          {post.subtitle && (
            <p className="mt-3 text-lg text-mk-muted-fg">{post.subtitle}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-mk-muted-fg">
            {post.publishedAt && (
              <span>
                {new Date(post.publishedAt).toLocaleDateString("en-NG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            )}
            {post.author && <span>· {post.author}</span>}
            {post.category && (
              <span className="rounded-full bg-mk-secondary px-2.5 py-0.5 font-medium text-mk-secondary-fg">
                {post.category.name}
              </span>
            )}
          </div>
        </header>

        {post.featuredImageUrl && (
          <img
            src={post.featuredImageUrl}
            alt={post.featuredImageAltText ?? post.title}
            className="my-8 w-full rounded-lg object-cover"
          />
        )}

        <div className="prose-mk mt-8 text-base leading-relaxed text-mk-fg">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
        </div>
      </article>
    </>
  );
}
