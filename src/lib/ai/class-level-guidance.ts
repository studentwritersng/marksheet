/**
 * Returns per-class-level language, vocabulary, and cognitive-demand rules
 * that are injected into AI generation prompts (lesson notes, questions).
 *
 * The tiers are:
 *   JSS1 — very simple, pure recall, max 12-word stems
 *   JSS2 — simple, basic understanding, short sentences
 *   JSS3 — BECE-ready, limited application
 *   SSS1–3 — standard WAEC/NECO academic language, full range of Bloom's
 */
export function classLevelGuidance(level: string): string {
  const l = level.toUpperCase().replace(/\s+/g, "");

  if (l === "JSS1") return `CLASS-LEVEL LANGUAGE AND COGNITIVE RULES — JSS1 (STRICTLY ENFORCED)
This class contains 10–11 year-old students who have just entered secondary school. EVERY aspect of the output — vocabulary, sentence length, question complexity, model answers, and teaching activities — MUST match this age group.

VOCABULARY: Use only the simplest everyday English words. Avoid ALL technical, academic, or multi-syllable words unless the topic itself introduces them — and if you must use a subject-specific term, immediately follow it with a plain-English explanation in brackets or a short sentence. Wrong: "Identify the morphological characteristics of organisms." Right: "Which of these is an animal?"
SENTENCE LENGTH: Maximum 12 words per sentence in any heading, question stem, note heading, or instruction. Break anything longer into two sentences.
CONTENT DEPTH: Cover one idea at a time. No multi-layered explanations. Every definition must be one sentence. Every example must be something a JSS1 child in Nigeria would know from daily life (food, family, market, home, school).
STUDENTS' NOTE: Short, numbered bullet points. No paragraphs longer than 2 sentences. Use heading + bullet-point format throughout. Diagrams or simple tables are preferred over prose.
QUESTION STYLE (evaluation / homework): "Name one…", "Write two…", "Which of these…?", fill-in-the-blank. No "Explain why…", "Analyse…", "Compare…", "Discuss…", "Differentiate…", "Evaluate…".
TEACHING ACTIVITIES: Classroom activities must be physical, hands-on, or picture-based. No abstract discussions. Examples: hold up objects, draw on the board, point to body parts, sort picture cards.
COGNITIVE LEVEL: Pure recall (Easy) and simple recognition (Medium) only. The "Hard" item for JSS1 is what an SSS student would call trivial.
HOMEWORK: Maximum 2 simple questions. Single-sentence answers expected. No research tasks.`;

  if (l === "JSS2") return `CLASS-LEVEL LANGUAGE AND COGNITIVE RULES — JSS2 (STRICTLY ENFORCED)
This class contains 11–12 year-old students in their second year of secondary school.

VOCABULARY: Plain, everyday English. Common subject-specific terms that appear directly in the lesson note are fine, but do not introduce new technical vocabulary in questions or instructions without defining it first.
SENTENCE LENGTH: Keep all stems and instructions under 16 words. Options and note bullet points under 10 words each where possible.
CONTENT DEPTH: One clear idea per bullet point. Two-sentence maximum per explanation. Examples should be familiar Nigerian everyday situations.
STUDENTS' NOTE: Structured with clear headings and short bullet points. Light prose allowed but keep paragraphs to 2–3 sentences max.
QUESTION STYLE: Mostly recall and basic understanding. One question per set may ask students to give a simple reason ("Give one reason why…"). No abstract reasoning.
TEACHING ACTIVITIES: Hands-on, visual, or Q&A-based. Short group activities are fine.
COGNITIVE LEVEL: Recall and basic understanding. One application item allowed only for Medium/Hard questions.
HOMEWORK: 2–3 short questions, single-paragraph answers at most.`;

  if (l === "JSS3") return `CLASS-LEVEL LANGUAGE AND COGNITIVE RULES — JSS3 (STRICTLY ENFORCED)
This class contains 12–13 year-old students preparing for the Junior WAEC (BECE).

VOCABULARY: Standard everyday academic English appropriate to Nigerian JSS textbooks. Subject-specific terms are expected but should be contextualised with examples. No university-level vocabulary.
SENTENCE LENGTH: Stems up to 20 words. Options up to 10 words. Note prose up to 3 sentences per paragraph.
CONTENT DEPTH: BECE standard. Cover the topic fully but concisely. Each objective should have a clear definition, an explanation, and at least one Nigerian example.
STUDENTS' NOTE: Structured headings with prose paragraphs of 2–3 sentences. May include simple tables or numbered lists.
QUESTION STYLE: BECE-style. "State…", "List…", "Explain…", "Identify…", "Give a reason…". One sub-part per question may ask "Explain why…"
COGNITIVE LEVEL: Recall, basic understanding, and limited application. Hard questions may involve a simple explanation or reason.
HOMEWORK: 3–4 questions, short paragraph answers, BECE-exam style.`;

  if (l === "SSS1") return `CLASS-LEVEL LANGUAGE AND COGNITIVE RULES — SSS1
Students are 14–15 years old in the first year of senior secondary school.

VOCABULARY: Standard senior secondary academic English. Subject-specific terminology is expected and appropriate.
CONTENT DEPTH: Thorough coverage with clear explanations, examples, and worked cases where applicable. WAEC-preparatory standard.
STUDENTS' NOTE: Full structured prose with headings, paragraphs, definitions, examples, and diagrams/tables as appropriate.
QUESTION STYLE: All standard WAEC/NECO formats. Recall, understanding, and application questions. Analysis questions for Hard difficulty.
COGNITIVE LEVEL: Full range — recall through application. Hard questions may introduce simple analysis.
HOMEWORK: 3–5 questions, paragraph-length answers, WAEC exam style.`;

  if (l === "SSS2") return `CLASS-LEVEL LANGUAGE AND COGNITIVE RULES — SSS2
Students are 15–16 years old building toward WAEC/NECO.

VOCABULARY: Full senior secondary academic vocabulary appropriate to the subject.
CONTENT DEPTH: Deep, well-structured coverage. Include worked examples, comparisons, and real-world applications. WAEC standard throughout.
STUDENTS' NOTE: Detailed prose with clear structure, headings, examples, and diagrams/tables as appropriate.
QUESTION STYLE: WAEC/NECO style. Higher-order questions encouraged. Hard questions involve evaluation or comparison.
COGNITIVE LEVEL: Full Bloom's range through analysis. Evaluation-level questions for Hard difficulty.
HOMEWORK: 4–5 WAEC-style questions, well-structured paragraph answers.`;

  if (l === "SSS3") return `CLASS-LEVEL LANGUAGE AND COGNITIVE RULES — SSS3
Students are 16–17 years old sitting or preparing to sit WAEC/NECO.

VOCABULARY: Full WAEC-level academic vocabulary. Use subject-appropriate technical language confidently.
CONTENT DEPTH: Comprehensive, exam-ready coverage. Content should directly prepare students for WAEC/NECO questions on this topic.
STUDENTS' NOTE: Detailed, examination-grade notes with definitions, explanations, examples, diagrams, and summary points.
QUESTION STYLE: Authentic WAEC/NECO exam style. Challenge students to demonstrate mastery across the full topic.
COGNITIVE LEVEL: Full Bloom's taxonomy — analysis, synthesis, and evaluation for Hard questions.
HOMEWORK: WAEC past-question style tasks. Well-structured, argued answers expected.`;

  // Fallback
  return `CLASS-LEVEL: ${level}. Pitch language and cognitive demand appropriately for Nigerian secondary school students at this level.`;
}
