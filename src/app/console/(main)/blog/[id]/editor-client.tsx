"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { validateBlogSeo, countInternalLinks, slugify } from "@/lib/blog/seo";
import {
  generateDraftAction,
  updatePostAction,
  createDraftPostAction,
  publishPostAction,
} from "../drafts/actions";

interface KeywordVM {
  id: string;
  keywordText: string;
}

interface CategoryVM {
  id: string;
  name: string;
}

interface PostVM {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  excerpt: string | null;
  body: string;
  status: string;
  metaTitle: string | null;
  metaDescription: string | null;
  tags: string[];
  categoryId: string | null;
  primaryKeywordId: string | null;
  primaryKeywordText?: string | null;
  featuredImageUrl: string | null;
  featuredImageAltText: string | null;
  canonicalUrl: string | null;
}

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30";

const STATUSES = ["draft", "pending_review", "archived"];

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-800 text-slate-300",
  pending_review: "bg-amber-900/50 text-amber-300",
  published: "bg-emerald-900/50 text-emerald-300",
  archived: "bg-gray-800 text-gray-400",
};

export function EditorClient({
  post,
  keywords,
  categories,
}: {
  post: PostVM | null;
  keywords: KeywordVM[];
  categories: CategoryVM[];
}) {
  const router = useRouter();
  const isNew = post === null;

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [subtitle, setSubtitle] = useState(post?.subtitle ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [metaTitle, setMetaTitle] = useState(post?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(post?.metaDescription ?? "");
  const [tagsInput, setTagsInput] = useState((post?.tags ?? []).join(", "));
  const [categoryId, setCategoryId] = useState(post?.categoryId ?? "");
  const [primaryKeywordId, setPrimaryKeywordId] = useState(
    post?.primaryKeywordId ?? (post?.primaryKeywordText ? "manual" : ""),
  );
  const [manualKeyword, setManualKeyword] = useState(post?.primaryKeywordText ?? "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState(post?.featuredImageUrl ?? "");
  const [featuredImageAltText, setFeaturedImageAltText] = useState(post?.featuredImageAltText ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(post?.canonicalUrl ?? "");
  const [status, setStatus] = useState(post?.status ?? "draft");

  const [topic, setTopic] = useState("");
  const [genError, setGenError] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const primaryKeywordText = useMemo(
    () => keywords.find((k) => k.id === primaryKeywordId)?.keywordText ?? null,
    [keywords, primaryKeywordId],
  );

  const internalLinkCount = useMemo(() => countInternalLinks(body), [body]);

  const seoWarnings = useMemo(
    () =>
      validateBlogSeo({
        title,
        slug,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        excerpt: excerpt || null,
        body,
        featuredImageAltText: featuredImageAltText || null,
        internalLinkCount,
        primaryKeyword: primaryKeywordText,
        primaryKeywordText: primaryKeywordId === "manual" ? manualKeyword : null,
      }),
    [title, slug, metaTitle, metaDescription, excerpt, body, featuredImageAltText, internalLinkCount, primaryKeywordText],
  );

  function parseTags(): string[] {
    return tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function handleGenerate() {
    setGenBusy(true);
    setGenError(null);
    try {
      const res = await generateDraftAction({
        keyword: primaryKeywordText ?? undefined,
        topic: topic.trim() || undefined,
        targetAudience: "general",
        keywordId: primaryKeywordId || undefined,
      });
      if (!res.ok || !res.pkg) {
        setGenError(res.error ?? "Generation failed.");
        return;
      }
      const pkg = res.pkg;
      if (pkg.titleOptions[0]) setTitle(pkg.titleOptions[0]);
      if (pkg.subtitle) setSubtitle(pkg.subtitle);
      if (pkg.excerpt) setExcerpt(pkg.excerpt);
      if (pkg.body) setBody(pkg.body);
      if (pkg.metaTitle) setMetaTitle(pkg.metaTitle);
      if (pkg.metaDescription) setMetaDescription(pkg.metaDescription);
      if (pkg.tags?.length) setTagsInput(pkg.tags.join(", "));
      if (pkg.imagePrompt) setImagePrompt(pkg.imagePrompt);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenBusy(false);
    }
  }

  async function persist(): Promise<string | null> {
    const data = {
      title,
      slug: slug || undefined,
      subtitle: subtitle || null,
      excerpt: excerpt || null,
      body,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      tags: parseTags(),
      categoryId: categoryId || null,
      primaryKeywordId: primaryKeywordId === "manual" ? null : primaryKeywordId || null,
      primaryKeywordText: primaryKeywordId === "manual" ? manualKeyword || null : null,
      featuredImageUrl: featuredImageUrl || null,
      featuredImageAltText: featuredImageAltText || null,
      canonicalUrl: canonicalUrl || null,
      status,
    };

    if (isNew) {
      const res = await createDraftPostAction(
        {
          title,
          subtitle: subtitle || null,
          excerpt: excerpt || null,
          body,
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null,
          tags: parseTags(),
          featuredImageUrl: featuredImageUrl || null,
          featuredImageAltText: featuredImageAltText || null,
        },
        {
          categoryId: categoryId || null,
          primaryKeywordId: primaryKeywordId === "manual" ? null : primaryKeywordId || null,
          primaryKeywordText: primaryKeywordId === "manual" ? manualKeyword || null : null,
          slug: slug || null,
        },
      );
      if (!res.ok || !res.id) return res.error ?? "Failed to create post.";
      router.push(`/console/blog/${res.id}`);
      return null;
    }

    const res = await updatePostAction(post!.id, data);
    if (!res.ok) return res.error ?? "Failed to save post.";
    return null;
  }

  async function handleSave() {
    setBusy(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const err = await persist();
      if (err) setSaveError(err);
      else setSaveSuccess("Saved.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (isNew) {
      setSaveError("Save the post before publishing.");
      return;
    }
    setBusy(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const res = await publishPostAction(post!.id);
      if (!res.ok) setSaveError(res.error ?? "Failed to publish.");
      else {
        setStatus("published");
        setSaveSuccess("Published.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {isNew ? "New Blog Post" : "Edit Blog Post"}
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {isNew ? "Create a new platform-owned post." : `Editing "${post!.title}"`}
          </p>
        </div>
        <span
          className={`rounded-full text-[11px] px-2.5 py-0.5 font-medium ${
            STATUS_STYLES[status] ?? "bg-slate-800 text-slate-300"
          }`}
        >
          {status.replace(/_/g, " ")}
        </span>
      </div>

      {saveError && (
        <div className="text-xs px-4 py-2 rounded-lg bg-red-900/40 text-red-300">{saveError}</div>
      )}
      {saveSuccess && (
        <div className="text-xs px-4 py-2 rounded-lg bg-emerald-900/40 text-emerald-300">
          {saveSuccess}
        </div>
      )}

      {/* Generate AI draft */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Generate AI draft</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-white/50">Keyword</span>
            <select
              value={primaryKeywordId}
              onChange={(e) => setPrimaryKeywordId(e.target.value)}
              className={inputClass}
            >
              <option value="">— none —</option>
              {keywords.map((k) => (
                <option key={k.id} value={k.id}>{k.keywordText}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Topic / angle (optional)</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. how to prepare for WAEC"
              className={inputClass}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={genBusy}
          className="text-xs bg-white text-[#0a0e1a] font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors disabled:opacity-60"
        >
          {genBusy ? "Generating…" : "Generate AI draft"}
        </button>
        {genError && <p className="text-red-400 text-xs">{genError}</p>}
        {imagePrompt && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-xs text-white/50 mb-1">Suggested image prompt</p>
            <p className="text-xs text-white/80 whitespace-pre-wrap">{imagePrompt}</p>
          </div>
        )}
      </div>

      {/* Editor form */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block md:col-span-2">
            <span className="text-xs text-white/50">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Slug</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={title ? slugify(title) : ""}
              className={`${inputClass} font-mono`}
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Subtitle</span>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              <option value="">— none —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Primary keyword</span>
            <select value={primaryKeywordId} onChange={(e) => setPrimaryKeywordId(e.target.value)} className={inputClass}>
              <option value="">— none —</option>
              {keywords.map((k) => (
                <option key={k.id} value={k.id}>{k.keywordText}</option>
              ))}
              <option value="manual">Manual (write your own)</option>
            </select>
          </label>
          {primaryKeywordId === "manual" && (
            <label className="block">
              <span className="text-xs text-white/50">Manual keyword</span>
              <input
                value={manualKeyword}
                onChange={(e) => setManualKeyword(e.target.value)}
                placeholder="e.g. best school app in Lagos"
                className={inputClass}
              />
            </label>
          )}
          <label className="block md:col-span-2">
            <span className="text-xs text-white/50">Excerpt</span>
            <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} className={inputClass} />
          </label>
          <label className="block md:col-span-2">
            <span className="text-xs text-white/50">Body (markdown)</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className={`${inputClass} font-mono`} />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Meta title</span>
            <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Meta description</span>
            <input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Tags (comma separated)</span>
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Canonical URL</span>
            <input value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Featured image URL</span>
            <input value={featuredImageUrl} onChange={(e) => setFeaturedImageUrl(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Featured image alt text</span>
            <input value={featuredImageAltText} onChange={(e) => setFeaturedImageAltText(e.target.value)} className={inputClass} />
          </label>
        </div>
      </div>

      {/* Live SEO check */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">
          Live SEO check
        </h3>
        {seoWarnings.length === 0 ? (
          <p className="text-xs text-emerald-300">No SEO warnings. Looking good.</p>
        ) : (
          <ul className="space-y-2">
            {seoWarnings.map((w) => (
              <li
                key={w.code}
                className="text-xs px-3 py-2 rounded-lg bg-amber-900/30 text-amber-200 border border-amber-800/30"
              >
                <span className="font-mono mr-2">{w.code}</span>
                {w.message}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-white/30 mt-3">
          SEO warnings are informational and do not block saving.
        </p>
      </div>

      {/* Actions */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
        <label className="block max-w-xs">
          <span className="text-xs text-white/50">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={busy || isNew}
            className="text-xs bg-white text-[#0a0e1a] font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors disabled:opacity-60"
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
