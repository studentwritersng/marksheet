"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateContentBlockAction, resetContentBlockAction } from "./actions";

interface BlockItem {
  key: string;
  defaultContent: string;
  content: string | null;
  isVisible: boolean;
}

interface Group {
  group: string;
  items: BlockItem[];
}

const LABELS: Record<string, string> = {
  hero_badge: "Badge text",
  hero_headline: "Headline",
  hero_subheadline: "Subheadline",
  hero_cta: "Primary button",
  hero_secondary: "Secondary button",
  problem_headline: "Headline",
  problem_text: "Body copy",
  problem_stat_1: "Stat 1 value",
  problem_stat_1_label: "Stat 1 label",
  problem_stat_2: "Stat 2 value",
  problem_stat_2_label: "Stat 2 label",
  problem_stat_3: "Stat 3 value",
  problem_stat_3_label: "Stat 3 label",
  pillar_1_title: "Pillar 1 title",
  pillar_1_desc: "Pillar 1 description",
  pillar_2_title: "Pillar 2 title",
  pillar_2_desc: "Pillar 2 description",
  pillar_3_title: "Pillar 3 title",
  pillar_3_desc: "Pillar 3 description",
  diff_1_title: "Title",
  diff_1_desc: "Description",
  diff_2_title: "Title",
  diff_2_desc: "Description",
  diff_3_title: "Title",
  diff_3_desc: "Description",
  diff_4_title: "Title",
  diff_4_desc: "Description",
  addons_headline: "Headline",
  addons_subheadline: "Subheadline",
  pricing_monthly: "Monthly price",
  pricing_termly: "Termly price",
  pricing_note: "Pricing note",
  pricing_cta: "Button text",
  cta_headline: "Headline",
  cta_subheadline: "Subheadline",
  faq_1_q: "Question",
  faq_1_a: "Answer",
  faq_2_q: "Question",
  faq_2_a: "Answer",
  faq_3_q: "Question",
  faq_3_a: "Answer",
  faq_4_q: "Question",
  faq_4_a: "Answer",
  faq_5_q: "Question",
  faq_5_a: "Answer",
  faq_6_q: "Question",
  faq_6_a: "Answer",
};

export function ContentEditorClient({ grouped }: { grouped: Group[] }) {
  const router = useRouter();
  const [openGroup, setOpenGroup] = useState<string | null>(grouped[0]?.group ?? null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function save(key: string, formData: FormData) {
    setBusyKey(key);
    setMessage(null);
    const res = await updateContentBlockAction({}, formData);
    setBusyKey(null);
    if (res.error) setMessage({ type: "error", text: res.error });
    else setMessage({ type: "success", text: res.success ?? "Saved." });
    router.refresh();
  }

  async function reset(key: string) {
    if (!confirm("Revert this block to its default value?")) return;
    setBusyKey(key);
    setMessage(null);
    const res = await resetContentBlockAction(key);
    setBusyKey(null);
    if (res.error) setMessage({ type: "error", text: res.error });
    else setMessage({ type: "success", text: res.success ?? "Reverted." });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className={`text-sm rounded-lg px-4 py-2 ${message.type === "success" ? "text-green-400 bg-green-100/10" : "text-red-400 bg-red-100/10"}`}>
          {message.text}
        </p>
      )}

      {grouped.map((g) => {
        const open = openGroup === g.group;
        return (
          <div key={g.group} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setOpenGroup(open ? null : g.group)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
            >
              <span className="text-sm font-semibold text-white">{g.group}</span>
              <span className="material-symbols-outlined text-[20px] text-white/40 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}>
                expand_more
              </span>
            </button>

            {open && (
              <div className="px-5 pb-5 space-y-6">
                {g.items.map((item) => {
                  const isEditing = item.content !== null;
                  const isFaqQ = item.key.endsWith("_q");
                  const value = item.content ?? item.defaultContent;
                  return (
                    <div key={item.key} className="border border-white/10 rounded-lg p-4 bg-black/20">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm font-medium text-white">{LABELS[item.key] ?? item.key}</p>
                          <p className="text-[11px] text-white/40 font-mono">{item.key}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[11px] rounded-full px-2 py-0.5 ${isEditing ? "bg-amber-100/10 text-amber-400" : "bg-white/5 text-white/40"}`}>
                            {isEditing ? "Custom" : "Default"}
                          </span>
                          {isEditing && (
                            <button
                              onClick={() => reset(item.key)}
                              disabled={busyKey === item.key}
                              className="text-[11px] text-white/40 hover:text-white disabled:opacity-50"
                            >
                              Reset to default
                            </button>
                          )}
                        </div>
                      </div>

                      <form action={(fd) => save(item.key, fd)} className="space-y-3">
                        <input type="hidden" name="sectionKey" value={item.key} />
                        {item.key.endsWith("_a") || item.key === "problem_text" || item.key.endsWith("_desc") || item.key.endsWith("_note") || item.key.endsWith("_subheadline") || item.key === "cta_subheadline" ? (
                          <textarea
                            name="content"
                            rows={4}
                            defaultValue={value}
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                          />
                        ) : (
                          <input
                            name="content"
                            type="text"
                            defaultValue={value}
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                          />
                        )}

                        {isFaqQ && (
                          <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer select-none">
                            <input type="checkbox" name="isVisible" defaultChecked={item.isVisible} className="accent-white" />
                            Show this item on the homepage
                          </label>
                        )}

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={busyKey === item.key}
                            className="bg-white text-black font-medium text-xs px-4 py-2 rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
                          >
                            {busyKey === item.key ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
