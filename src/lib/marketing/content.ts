import { prisma } from "@/lib/prisma";

/**
 * PRD 20 — Homepage Content Blocks (CMS-lite).
 * Editable from the Platform Owner Console without a code deployment.
 * Every section key has a sensible fallback so a missing/empty block never
 * renders a broken section.
 */

export interface ContentBlock {
  sectionKey: string;
  content: string;
}

export const DEFAULT_CONTENT: Record<string, string> = {
  hero_badge: "For Nigerian secondary schools",
  hero_headline: "Syllabus, lesson notes, exams & results — one calm academic portal",
  hero_subheadline:
    "Marksheet replaces the paper and spreadsheet chaos of school administration with a single, reliable platform built around the Nigerian school calendar — sessions, terms, CA, and the main exam.",
  hero_cta: "Book a Demo",
  hero_secondary: "Verify a Result",

  problem_headline: "School records deserve better than paper trails and scattered spreadsheets",
  problem_text:
    "Every term, schools juggle syllabi, lesson notes, question papers, invigilation rosters, and result computation. When that lives in notebooks and shared Excel files, results come late, mistakes creep in, and no one can prove a report card is genuine. Marksheet gives you one calm, structured home for the whole academic cycle.",
  problem_stat_1: "3 terms",
  problem_stat_1_label: "fully structured session",
  problem_stat_2: "1 platform",
  problem_stat_2_label: "syllabus to report card",
  problem_stat_3: "0 lost",
  problem_stat_3_label: "or re-typed results",

  pillar_1_title: "Syllabus & Lesson Notes",
  pillar_1_desc:
    "Upload syllabi, track curriculum coverage week by week, and generate consistent lesson notes — manually or with AI — all tied to your NERDC-aligned topics.",
  pillar_2_title: "Exams & AI Grading",
  pillar_2_desc:
    "Set objective and essay questions from a shared question bank, deliver exams in the hall or online, and grade essays with rubric-grounded AI assistance.",
  pillar_3_title: "Results & Verification",
  pillar_3_desc:
    "Compute weighted term scores, publish report cards, and give every report card a verification code that parents and employers can check in seconds.",
  pillar_1_icon: "menu_book",
  pillar_2_icon: "quiz",
  pillar_3_icon: "verified",

  diff_1_title: "Offline exam hall, online sync",
  diff_1_desc:
    "Exams and MCQ grading keep working on a school LAN even when the internet is unreliable. Results sync when connectivity returns — no lost papers, no waiting for network.",
  diff_2_title: "Tamper-proof result verification",
  diff_2_desc:
    "Every published report card carries a unique code that anyone can verify on our public portal — protecting your school's reputation and your students' credentials.",
  diff_3_title: "NDPR-aware by design",
  diff_3_desc:
    "Guardian consent capture, role-scoped data access, and full audit logging keep student records compliant and traceable.",
  diff_4_title: "Migrate from spreadsheets",
  diff_4_desc:
    "Bring over your existing students and records with downloadable CSV templates that are staged, validated, and error-checked before anything touches live data.",

  addons_headline: "Extend your school with optional addons",
  addons_subheadline:
    "Turn on exactly what your school needs — from a timetable generator to SMS and WhatsApp messaging — no code changes required.",

  pricing_monthly: "₦25,000",
  pricing_termly: "₦60,000",
  pricing_note:
    "Licensing is handled personally — tell us about your school and we'll set up the right plan. No online checkout, no surprise renewal fees.",
  pricing_cta: "Book a Demo",

  cta_headline: "See Marksheet in action at your school",
  cta_subheadline:
    "Book a short demo with our team. We'll walk through your session setup, an exam run, and a published report card — tailored to how your school works.",
  cta_cta: "Book a Demo",

  faq_1_q: "What happens if the internet is unreliable during exams?",
  faq_1_a:
    "Exam delivery and MCQ grading are designed to run on a school LAN with no internet. Invigilated sessions proceed normally, answers are stored locally, and results sync to the cloud once connectivity returns. AI-assisted features and cloud sync are online-only, but the core exam never depends on your connection.",
  faq_2_q: "Can we move our records from our current system?",
  faq_2_a:
    "Yes. We provide downloadable CSV templates for students and other records. Your data is staged, validated, and shown with clear error reports before anything is committed to live records — nothing silently overwrites what you already have.",
  faq_3_q: "What happens if our license lapses?",
  faq_3_a:
    "Nothing is deleted. The platform enters a soft-lock state — you keep access to your data and can still read historical records — while renewal is arranged with our team. Your students' results and records remain safe and recoverable.",
  faq_4_q: "How do you handle student data privacy?",
  faq_4_a:
    "Student and guardian personal data is protected in line with the NDPR. We capture guardian consent, restrict access by role, and keep a full audit log of who viewed or changed sensitive records.",
  faq_5_q: "Is there a way to prove a report card is authentic?",
  faq_5_a:
    "Every published report card carries a unique verification code. Parents, employers, or anyone with the code can check it on our public Result Verification portal and see the authenticated result summary.",
  faq_6_q: "Do we have to sign up and pay online?",
  faq_6_a:
    "No. Onboarding is sales-led — you book a demo, we understand your school, and we activate your license personally. There is no self-serve signup or online checkout.",
};

export const FAQ_KEYS = [
  "faq_1_q",
  "faq_1_a",
  "faq_2_q",
  "faq_2_a",
  "faq_3_q",
  "faq_3_a",
  "faq_4_q",
  "faq_4_a",
  "faq_5_q",
  "faq_5_a",
  "faq_6_q",
  "faq_6_a",
] as const;

export function blockContent(blocks: Record<string, string>, key: string): string {
  const value = blocks[key];
  if (value === undefined || value === null || value.trim() === "") {
    return DEFAULT_CONTENT[key] ?? "";
  }
  return value;
}

export async function getContentBlocks(): Promise<Record<string, string>> {
  try {
    const rows = await prisma.homepageContentBlock.findMany({
      where: { isVisible: true },
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.sectionKey] = row.content;
    return map;
  } catch {
    return {};
  }
}
