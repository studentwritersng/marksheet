import { createCompletion } from "@/lib/ai/gateway";

export interface BlogDraftInput {
  keyword?: string;
  topic?: string;
  targetAudience: string;
}

export interface BlogDraftPackage {
  titleOptions: string[];
  subtitle: string;
  excerpt: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  imagePrompt: string;
}

const SYSTEM = `You are an SEO and GEO (generative-engine-optimization) copywriter for Marksheet, a Nigerian secondary school syllabus/exam/result platform. Produce a JSON object ONLY (no prose) with keys: titleOptions (array of 3-5 strings, each <60 chars, primary keyword placed naturally), subtitle (string), excerpt (string 150-160 chars, also usable as meta description), body (markdown: exactly one H1 matching the chosen title, H2/H3 hierarchy, natural keyword use, 2-3 internal links to real existing site pages like /features, /pricing, /result-verification written as [label](/path), external citations to authoritative sources like WAEC/NECO/government where factual claims are made, and a clear self-contained direct-answer paragraph within the first 2-3 sentences), metaTitle (string <60 chars), metaDescription (string 150-160 chars), tags (array of strings), imagePrompt (a complete structured image-generation prompt: subject, composition, style, brand colors #002046 and #1e3a5f — not vague).`;

function extractJson(content: string): any {
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : content;
  try { return JSON.parse(raw.trim()); } catch { return {}; }
}

export async function generateBlogDraft(input: BlogDraftInput): Promise<BlogDraftPackage> {
  const focus = input.keyword ? `keyword "${input.keyword}"` : `topic "${input.topic ?? ""}"`;
  const user = `Target audience: ${input.targetAudience}. Write about ${focus}. Return ONLY the JSON object.`;
  const res = await createCompletion({
    taskType: "blog_generation",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
  });
  const j = extractJson(res.content);
  return {
    titleOptions: Array.isArray(j.titleOptions) ? j.titleOptions : [],
    subtitle: j.subtitle ?? "",
    excerpt: j.excerpt ?? "",
    body: j.body ?? "",
    metaTitle: j.metaTitle ?? "",
    metaDescription: j.metaDescription ?? "",
    tags: Array.isArray(j.tags) ? j.tags : [],
    imagePrompt: j.imagePrompt ?? "",
  };
}
