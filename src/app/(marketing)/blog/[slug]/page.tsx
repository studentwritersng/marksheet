import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BlogReadTracker } from "./BlogReadTracker";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://marksheet.ng";

// Social crawlers require absolute image URLs — resolve relative paths against the site origin.
function toAbsoluteUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.startsWith("http") ? raw : new URL(raw, SITE_URL).toString();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug }, include: { category: true } });
  if (!post || post.status !== "published") return {};

  const title = post.metaTitle ?? post.title;
  const description = post.metaDescription ?? post.excerpt ?? undefined;
  const ogImage = toAbsoluteUrl(post.featuredImageUrl);

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: {
      type: "article",
      title,
      description,
      url: `${SITE_URL}/blog/${post.slug}`,
      siteName: "Marksheet",
      publishedTime: post.publishedAt?.toISOString(),
      section: post.category?.name ?? undefined,
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630, alt: post.featuredImageAltText ?? post.title }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
    ...(toAbsoluteUrl(post.featuredImageUrl) ? { image: toAbsoluteUrl(post.featuredImageUrl) } : {}),
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

      <BlogReadTracker slug={slug} />

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
