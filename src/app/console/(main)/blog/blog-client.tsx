"use client";

import { useState } from "react";
import Link from "next/link";
import {
  upsertKeywordAction,
  deleteKeywordAction,
  upsertCategoryAction,
  deleteCategoryAction,
} from "./keywords/actions";

interface KeywordVM {
  id: string;
  keywordText: string;
  type: string;
  searchIntent: string;
  targetAudience: string;
  status: string;
  priority: number;
  notes: string | null;
}

interface CategoryVM {
  id: string;
  name: string;
  slug: string;
}

interface PostVM {
  id: string;
  title: string;
  status: string;
  primaryKeyword: string | null;
  category: string | null;
  updatedAt: string;
}

const KEYWORD_TYPES = ["short_tail", "long_tail"];
const SEARCH_INTENTS = ["informational", "commercial", "comparison"];
const AUDIENCES = ["general", "teacher", "school_admin", "proprietor", "parent"];
const KEYWORD_STATUSES = ["planned", "assigned", "published", "ranking"];

const STATUS_STYLES: Record<string, string> = {
  planned: "bg-slate-800 text-slate-300",
  assigned: "bg-blue-900/50 text-blue-300",
  published: "bg-emerald-900/50 text-emerald-300",
  ranking: "bg-purple-900/50 text-purple-300",
  draft: "bg-slate-800 text-slate-300",
  pending_review: "bg-amber-900/50 text-amber-300",
  archived: "bg-gray-800 text-gray-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full text-[10px] px-2 py-0.5 font-medium ${STATUS_STYLES[status] ?? "bg-slate-800 text-slate-300"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30";

export function BlogClient({
  keywords,
  categories,
  posts,
}: {
  keywords: KeywordVM[];
  categories: CategoryVM[];
  posts: PostVM[];
}) {
  const [showKeywordForm, setShowKeywordForm] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<KeywordVM | null>(null);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryVM | null>(null);

  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const pipeline = {
    draft: posts.filter((p) => p.status === "draft").length,
    pending_review: posts.filter((p) => p.status === "pending_review").length,
    published: posts.filter((p) => p.status === "published").length,
  };

  function resetKeywordForm() {
    setShowKeywordForm(false);
    setEditingKeyword(null);
  }

  function resetCategoryForm() {
    setShowCategoryForm(false);
    setEditingCategory(null);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Blog</h1>
          <p className="text-sm text-white/40 mt-1">Keyword bank, categories, and posts</p>
        </div>
        <Link
          href="/console/blog/new"
          className="text-xs bg-white text-[#0a0e1a] font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors shrink-0"
        >
          + New Blog Post
        </Link>
      </div>

      {message && (
        <div
          className={`text-xs px-4 py-2 rounded-lg ${
            message.ok ? "bg-emerald-900/40 text-emerald-300" : "bg-red-900/40 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-white/40">Draft</p>
          <p className="text-2xl font-semibold text-white mt-1">{pipeline.draft}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-white/40">Pending review</p>
          <p className="text-2xl font-semibold text-white mt-1">{pipeline.pending_review}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-white/40">Published</p>
          <p className="text-2xl font-semibold text-white mt-1">{pipeline.published}</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Posts</h2>
          <Link
            href="/console/blog/new"
            className="text-xs bg-white text-[#0a0e1a] font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors"
          >
            + New Blog Post
          </Link>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/40 border-b border-white/10">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Keyword</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <Link href={`/console/blog/${p.id}`} className="text-white hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-white/60">{p.primaryKeyword ?? "—"}</td>
                  <td className="px-4 py-3 text-white/60">{p.category ?? "—"}</td>
                  <td className="px-4 py-3 text-white/60">{new Date(p.updatedAt).toLocaleDateString("en-NG")}</td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-white/30 text-sm">No posts yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Keywords</h2>
          <button
            onClick={() => {
              setEditingKeyword(null);
              setShowKeywordForm((v) => !v);
            }}
            className="text-xs bg-white text-[#0a0e1a] font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors"
          >
            {showKeywordForm ? "Cancel" : "+ Add keyword"}
          </button>
        </div>

        {showKeywordForm && (
          <form
            action={async (fd: FormData) => {
              const res = await upsertKeywordAction(fd);
              if (res.ok) {
                setMessage({ ok: true, text: "Keyword saved." });
                resetKeywordForm();
              } else {
                setMessage({ ok: false, text: res.error ?? "Failed." });
              }
            }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4"
          >
            {editingKeyword && <input type="hidden" name="id" defaultValue={editingKeyword.id} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs text-white/50">Keyword text</span>
                <input name="keywordText" required defaultValue={editingKeyword?.keywordText ?? ""} className={inputClass} />
              </label>
              <label className="block">
                <span className="text-xs text-white/50">Type</span>
                <select name="type" defaultValue={editingKeyword?.type ?? "short_tail"} className={inputClass}>
                  {KEYWORD_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-white/50">Search intent</span>
                <select name="searchIntent" defaultValue={editingKeyword?.searchIntent ?? "informational"} className={inputClass}>
                  {SEARCH_INTENTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-white/50">Target audience</span>
                <select name="targetAudience" defaultValue={editingKeyword?.targetAudience ?? "general"} className={inputClass}>
                  {AUDIENCES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-white/50">Status</span>
                <select name="status" defaultValue={editingKeyword?.status ?? "planned"} className={inputClass}>
                  {KEYWORD_STATUSES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-white/50">Priority</span>
                <input type="number" name="priority" defaultValue={editingKeyword?.priority ?? 0} className={inputClass} />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-white/50">Notes</span>
              <textarea name="notes" defaultValue={editingKeyword?.notes ?? ""} rows={2} className={inputClass} />
            </label>
            <button type="submit" className="text-xs bg-white text-[#0a0e1a] font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors">
              {editingKeyword ? "Save changes" : "Create keyword"}
            </button>
          </form>
        )}

        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/40 border-b border-white/10">
                <th className="px-4 py-3 font-medium">Keyword</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Intent</th>
                <th className="px-4 py-3 font-medium">Audience</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((k) => (
                <tr key={k.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-white">{k.keywordText}</td>
                  <td className="px-4 py-3 text-white/60">{k.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-white/60">{k.searchIntent}</td>
                  <td className="px-4 py-3 text-white/60">{k.targetAudience.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3"><StatusBadge status={k.status} /></td>
                  <td className="px-4 py-3 text-white/60">{k.priority}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingKeyword(k);
                          setShowKeywordForm(true);
                        }}
                        className="text-xs text-white/50 hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/30"
                      >
                        Edit
                      </button>
                      <form
                        action={async (fd: FormData) => {
                          const res = await deleteKeywordAction(fd);
                          setMessage(res.ok ? { ok: true, text: "Keyword deleted." } : { ok: false, text: res.error ?? "Failed." });
                        }}
                      >
                        <input type="hidden" name="id" defaultValue={k.id} />
                        <button type="submit" className="text-xs text-red-300/70 hover:text-red-300 transition-colors px-2 py-1 rounded border border-red-900/40 hover:border-red-700">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {keywords.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-white/30 text-sm">No keywords yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Categories</h2>
          <button
            onClick={() => {
              setEditingCategory(null);
              setShowCategoryForm((v) => !v);
            }}
            className="text-xs bg-white text-[#0a0e1a] font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors"
          >
            {showCategoryForm ? "Cancel" : "+ Add category"}
          </button>
        </div>

        {showCategoryForm && (
          <form
            action={async (fd: FormData) => {
              const res = await upsertCategoryAction(fd);
              if (res.ok) {
                setMessage({ ok: true, text: "Category saved." });
                resetCategoryForm();
              } else {
                setMessage({ ok: false, text: res.error ?? "Failed." });
              }
            }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4"
          >
            {editingCategory && <input type="hidden" name="id" defaultValue={editingCategory.id} />}
            <label className="block">
              <span className="text-xs text-white/50">Name</span>
              <input name="name" required defaultValue={editingCategory?.name ?? ""} className={inputClass} />
            </label>
            <button type="submit" className="text-xs bg-white text-[#0a0e1a] font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors">
              {editingCategory ? "Save changes" : "Create category"}
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 gap-3">
          {categories.map((c) => (
            <div key={c.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-white font-medium">{c.name}</p>
                <p className="text-xs text-white/40 font-mono mt-0.5">{c.slug}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    setEditingCategory(c);
                    setShowCategoryForm(true);
                  }}
                  className="text-xs text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
                >
                  Edit
                </button>
                <form
                  action={async (fd: FormData) => {
                    const res = await deleteCategoryAction(fd);
                    setMessage(res.ok ? { ok: true, text: "Category deleted." } : { ok: false, text: res.error ?? "Failed." });
                  }}
                >
                  <input type="hidden" name="id" defaultValue={c.id} />
                  <button type="submit" className="text-xs text-red-300/70 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg border border-red-900/40 hover:border-red-700">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-white/30 text-sm py-8 text-center">No categories yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
