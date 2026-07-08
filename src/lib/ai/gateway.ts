/**
 * AI Gateway Service (PRD 14)
 * ---------------------------------------------------------------------------
 * The SINGLE place in the codebase that knows how to talk to an AI provider.
 * Every AI-consuming module (lesson notes, question generation, essay grading,
 * comment drafting) MUST call through this service. No module may instantiate a
 * provider SDK or hardcode a base URL / model name.
 *
 * Switching dev -> OpenRouter is configuration-only (see .env):
 *   AI_BASE_URL, AI_API_KEY, AI_DEFAULT_MODEL, AI_MOCK
 *
 * The provider is assumed to expose an OpenAI-compatible
 * /chat/completions interface, which OpenRouter and most modern providers do.
 */

export type AiTaskType =
  | "lesson_note_generation"
  | "question_generation"
  | "essay_grading"
  | "comment_drafting";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionOptions {
  taskType: AiTaskType;
  messages: AiMessage[];
  model?: string; // per-task override; falls back to AI_DEFAULT_MODEL
  temperature?: number;
  maxTokens?: number;
  schoolId?: string; // for cost/usage attribution in AI Call Log
}

export interface AiCompletionResult {
  content: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  mocked: boolean;
}

export class AiGatewayError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

interface GatewayConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  mock: boolean;
}

function loadConfig(): GatewayConfig {
  return {
    baseUrl: process.env.AI_BASE_URL ?? "",
    apiKey: process.env.AI_API_KEY ?? "",
    defaultModel: process.env.AI_DEFAULT_MODEL ?? "gpt-4o-mini",
    mock: (process.env.AI_MOCK ?? "false").toLowerCase() === "true",
  };
}

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const REQUEST_TIMEOUT_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Deterministic mock response so AI-consuming features can be developed and
 * tested without a live provider or incurring cost.
 * Returns task-type-specific realistic content matching the expected JSON schema.
 */
function mockCompletion(opts: AiCompletionOptions): AiCompletionResult {
  const task = opts.taskType;
  const last = opts.messages[opts.messages.length - 1]?.content ?? "";
  const subjectMatch = last.match(/Subject:\s*(.+)/i);
  const classMatch = last.match(/Class:\s*(.+)/i);
  const topicMatch = last.match(/Topic:\s*(.+)/i);
  const subject = subjectMatch?.[1]?.trim() ?? "the subject";
  const cls = classMatch?.[1]?.trim() ?? "the class";
  const topic = topicMatch?.[1]?.trim() ?? "the topic";

  const nigerianNames = ["Chiamaka", "Tunde", "Aisha", "Emeka", "Folake", "Musa", "Ngozi", "Kunle", "Zainab", "Chidi", "Yetunde", "Obinna", "Hauwa", "Segun", "Adaeze", "Ibrahim", "Kehinde", "Oluwaseun", "Rahmat", "Ebuka"];
  const pickName = (offset = 0) => nigerianNames[(nigerianNames.indexOf(topic[0] ?? "C") + offset) % nigerianNames.length];
  const towns = ["Lagos", "Abuja", "Kano", "Ibadan", "Enugu", "Port Harcourt", "Kaduna", "Jos", "Benin City", "Maiduguri", "Calabar", "Abeokuta", "Onitsha", "Ilorin", "Warri"];
  const pickTown = (offset = 0) => towns[(topic.length + offset) % towns.length];

  let content: string;

  switch (task) {
    case "lesson_note_generation": {
      // Generate realistic lesson note JSON matching prompt.txt structure exactly
      const sampleNote = generateLessonNote(subject, cls, topic, pickName, pickTown);
      content = JSON.stringify(sampleNote);
      break;
    }
    default: {
      content = `[[MOCK:${task}]] ` + last.slice(0, 400);
    }
  }

  return {
    content,
    model: opts.model ?? loadConfig().defaultModel,
    promptTokens: null,
    completionTokens: null,
    latencyMs: 1,
    mocked: true,
  };
}

/** Generate a rich, realistic lesson note matching the prompt.txt structure. */
function generateLessonNote(
  subject: string,
  cls: string,
  topic: string,
  pickName: (offset?: number) => string,
  pickTown: (offset?: number) => string,
): Record<string, unknown> {
  const n = pickName;
  const t = pickTown;
  const h = n(0);
  const h2 = n(1);

  // Determine level-based complexity
  const isSenior = cls.toUpperCase().includes("SS");
  const isJunior = cls.toUpperCase().includes("JS") || cls.toUpperCase().includes("JSS");
  const depth = isSenior ? "detailed" : "intermediate";
  const sentenceLen = isSenior ? "sophisticated" : "clear and simple";

  // Build context-specific content
  const objectives = [
    `Define and explain the concept of ${topic} in their own words with reference to familiar Nigerian examples.`,
    `Identify the key characteristics or components of ${topic} as it relates to everyday life in Nigeria.`,
    `Analyse the importance or application of ${topic} within the Nigerian context.`,
    `Demonstrate understanding by answering evaluation questions and completing assigned tasks on ${topic}.`,
  ];

  const studentsNote = `${topic.toUpperCase()}

1. DEFINITION OF ${topic.toUpperCase()}
${topic} is a fundamental concept in ${subject}. It can be defined as the process or idea that helps us understand how things work in our daily lives. For example, when ${h} from ${t(0)} observes ${topic.toLowerCase()} in her environment, she is able to relate it to what she learns in class.

In the Nigerian context, ${topic.toLowerCase()} is particularly important because it helps students prepare for WAEC, NECO, and JAMB examinations where questions on this topic appear regularly.

2. KEY CHARACTERISTICS / COMPONENTS OF ${topic.toUpperCase()}
The following are the main features of ${topic.toLowerCase()}:

(i) Characteristic One: This refers to the first major aspect of ${topic.toLowerCase()}. For instance, when ${h2} in ${t(1)} notices this characteristic, he can connect it to real-life situations.

(ii) Characteristic Two: The second feature involves understanding how ${topic.toLowerCase()} relates to other concepts within ${subject}. This connection helps students build a stronger foundation for advanced topics.

(iii) Characteristic Three: The third aspect focuses on the practical application of ${topic.toLowerCase()} in solving everyday problems. For example, a student in ${t(2)} who understands this can apply it to improve her understanding of the world around her.

(iv) Characteristic Four: The fourth component ${isSenior ? "requires deeper analysis and critical thinking about" : "introduces students to"} how ${topic.toLowerCase()} ${isSenior ? "interacts with broader themes within" : "fits into"} ${subject}.

3. IMPORTANCE OF ${topic.toUpperCase()}
Understanding ${topic.toLowerCase()} is important for the following reasons:

a) It forms the basis for more advanced topics in ${subject} at higher classes.
b) Examination bodies such as WAEC, NECO, and JAMB frequently test students' knowledge of ${topic.toLowerCase()} in both objective and theory sections.
c) Knowledge of ${topic.toLowerCase()} helps students develop critical thinking and analytical skills that are valuable beyond the classroom.
d) In the Nigerian context, ${topic.toLowerCase()} has practical applications in daily life—from how families in ${t(0)} manage their resources to how businesses in ${t(3)} operate.

4. EXAMPLES AND APPLICATIONS
${isSenior ? `Example 1: A ${subject.toLowerCase()} teacher in ${t(4)} uses ${topic.toLowerCase()} to explain a complex ${depth} phenomenon to her SSS students, demonstrating how theoretical knowledge applies to real-world scenarios.
Example 2: During WAEC preparation, students in ${t(5)} practise past questions on ${topic.toLowerCase()} to familiarise themselves with the examination format and expected responses.
Example 3: ${h} observed that understanding ${topic.toLowerCase()} helped her older brother who is studying at the University of ${t(6)} to excel in his first-year ${subject.toLowerCase()} course.` : `Example 1: ${h} noticed ${topic.toLowerCase()} in his environment in ${t(0)} and was able to describe it correctly to his ${subject.toLowerCase()} teacher.
Example 2: During a class exercise, ${h2} correctly identified an example of ${topic.toLowerCase()} and explained it to the rest of the class.
Example 3: The class visited a local site in ${t(2)} where they observed ${topic.toLowerCase()} being applied in a practical situation.`}

5. COMMON MISTAKES TO AVOID
Students often confuse ${topic.toLowerCase()} with related concepts in ${subject}. The table below clarifies the differences:

| ${topic} | Related Concept |
| Key defining feature | Differentiating characteristic |
| Nigerian example | Non-example |
| Exam tip: Always refer back to the definition when answering questions on ${topic.toLowerCase()} in your WAEC or NECO examinations. | |

6. REVISION QUESTIONS
i. What is ${topic}?
ii. List three characteristics of ${topic.toLowerCase()}.
iii. Explain why ${topic.toLowerCase()} is important in ${isSenior ? "the Nigerian educational system" : "your community"}.
iv. Give two examples of ${topic.toLowerCase()} from your immediate environment.
v. ${isSenior ? "Discuss how" : "Describe"} ${topic.toLowerCase()} relates to other topics you have studied in ${subject}.
`;

  return {
    subject,
    class: cls,
    theme_or_aspect: topic,
    topic,
    duration: "40 minutes",
    reference_books: `Essential ${subject} for ${cls} (Revised Edition), New ${subject} Course for ${cls}, ${subject} for Nigerian Secondary Schools (Books 1-3), WAEC/NECO Past Questions on ${topic}`,
    instructional_materials: `Whiteboard and markers, chart showing the key components of ${topic}, flashcards with key terms, ${subject} textbook (recommended edition), handouts with practice questions`,
    behavioural_objectives: objectives,
    previous_knowledge: `Students are already familiar with basic concepts in ${subject} from previous lessons. They have encountered simple examples of ${topic.toLowerCase()} in their everyday experiences and can relate to the scenarios that will be discussed in class. This lesson builds on their prior knowledge to deepen their understanding of ${topic.toLowerCase()}.`,
    introduction_set_induction: `The teacher begins the lesson by asking students to share what they already know about ${topic}. The teacher then tells a short story about ${n(2)}, a student in ${t(7)} who encountered ${topic.toLowerCase()} while helping her mother at the market. The teacher asks: "Have any of you experienced something similar? How would you explain what happened?" This discussion leads naturally into the formal lesson on ${topic}.`,
    students_note: studentsNote,
    objective_coverage_map: `Objective 1 ("Define and explain...") → covered by section 1 (Definition) and section 2 (Key Characteristics) of students_note.
Objective 2 ("Identify key characteristics...") → covered by section 2 (Characteristics/Components) and section 4 (Examples).
Objective 3 ("Analyse the importance...") → covered by section 3 (Importance) and section 4 (Applications).
Objective 4 ("Demonstrate understanding...") → covered by section 5 (Common Mistakes) and section 6 (Revision Questions).`,
    presentation_steps: [
      {
        step_number: 1,
        objective_reference: "Objective 1 — Definition and explanation",
        teacher_activity: `The teacher writes the definition of ${topic} on the board and explains it using simple, relatable terms. The teacher uses the story from the set induction to illustrate the concept. Examples from ${t(0)} and ${t(2)} are used to make the concept concrete for students.`,
        student_activity: "Students listen attentively, ask questions for clarification, and write the definition in their notebooks.",
      },
      {
        step_number: 2,
        objective_reference: "Objective 2 — Key characteristics",
        teacher_activity: `The teacher displays a pre-prepared chart listing the key characteristics of ${topic} and explains each one with ${depth} examples. The teacher invites students to suggest additional examples from their own experiences in ${t(1)} or ${t(3)}.`,
        student_activity: "Students identify and list the key characteristics in their notebooks. They volunteer examples from their communities and discuss how each characteristic applies to familiar situations.",
      },
      {
        step_number: 3,
        objective_reference: "Objectives 1, 2, and 3 — Guided practice",
        teacher_activity: `The teacher distributes a worksheet with questions on ${topic} and guides students through the first few items. The teacher walks around the classroom, providing individual support and correcting misconceptions. The teacher uses WAEC-style questions to familiarise students with examination requirements.`,
        student_activity: "Students work through the worksheet individually and in pairs. They ask the teacher for help where needed and compare answers with their classmates. Students volunteer to write their answers on the board for class discussion.",
      },
      {
        step_number: 4,
        objective_reference: "Objective 3 — Application and analysis",
        teacher_activity: `The teacher leads a class discussion on how ${topic} applies to real-life situations in Nigeria. The teacher poses thought-provoking questions: "How would life in ${t(4)} be different without ${topic.toLowerCase()}?" and "Why is ${topic.toLowerCase()} important for Nigeria's development?"`,
        student_activity: "Students participate actively in the discussion, sharing their opinions and experiences. They make notes of key points raised during the discussion and reflect on how the lesson connects to their lives.",
      },
      {
        step_number: 5,
        objective_reference: "Objective 4 — Evaluation and assessment",
        teacher_activity: `The teacher administers a short oral or written quiz covering all objectives. The teacher reviews the answers with the class, addresses any remaining misconceptions, and assigns homework.`,
        student_activity: "Students answer the quiz questions individually. They check their answers as the teacher reviews them and note any corrections needed. Students copy the homework assignment into their diaries.",
      },
    ],
    evaluation: `Instructions: Answer the following questions in your exercise book.

1. (Objective 1) What is ${topic}? Write a clear definition in your own words.
2. (Objective 2) List four key characteristics or components of ${topic.toLowerCase()}. Provide one Nigerian example for each.
3. (Objective 2) Identify which of the following is NOT an example of ${topic.toLowerCase()}: (a) a market scene in ${t(0)} (b) a classroom in ${t(2)} (c) a type of food eaten in ${t(4)} (d) a public holiday in Nigeria.
4. (Objective 3) Explain two reasons why ${topic.toLowerCase()} is important for students studying ${subject} in Nigerian secondary schools.
5. (Objective 3) Describe one way in which ${topic.toLowerCase()} applies to everyday life in your community.
6. (Objective 4) ${isSenior ? 'Analyse the relationship between ' + topic.toLowerCase() + ' and one other concept you have studied in ' + subject + '. How does understanding one help you understand the other?' : 'Write a short paragraph (4-5 sentences) explaining ' + topic.toLowerCase() + ' to a younger student who has not studied it before.'}`,
    summary_conclusion: `In today's lesson, we have learnt about ${topic} in ${subject}. We began by defining ${topic.toLowerCase()} and identifying its key characteristics. We explored the importance of ${topic.toLowerCase()} within the Nigerian context, including its relevance to WAEC, NECO, and JAMB examinations. We then examined practical examples and applications, and finally we assessed our understanding through evaluation questions. The class of ${cls} is encouraged to continue practising questions on ${topic.toLowerCase()} at home and to relate the concept to their daily experiences in ${t(0)} and beyond. Remember: a good understanding of ${topic.toLowerCase()} will serve as a strong foundation for more advanced topics in ${subject} in the coming terms.`,
    assignment_homework: `Answer the following questions in your homework notebook. Submission date: next lesson.

1. Write a comprehensive note on ${topic} in not more than one page.
2. List five examples of ${topic.toLowerCase()} that you can observe in your neighbourhood or community in ${t(0)}. For each example, write one sentence explaining how it relates to what we learnt today.
3. (WAEC Practice) Look up three past WAEC or NECO questions on ${topic.toLowerCase()} and write the answers in your notebook. Bring your answers to the next class for discussion.
4. Research: Find out from an elder or a textbook how ${topic.toLowerCase()} was traditionally understood or applied in Nigeria before modern education. Write a short paragraph on your findings.
5. Prepare three of your own questions on ${topic.toLowerCase()} to ask your classmates during the next lesson's revision session.`,
  };
}

/**
 * Core entry point. Callers pass task type + messages; the gateway handles
 * provider selection, retries, timeout, and (later) logging to AI Call Log.
 */
export async function createCompletion(
  opts: AiCompletionOptions,
): Promise<AiCompletionResult> {
  const cfg = loadConfig();

  if (cfg.mock) {
    return mockCompletion(opts);
  }

  if (!cfg.baseUrl || !cfg.apiKey) {
    throw new AiGatewayError(
      "AI provider is not configured (missing AI_BASE_URL or AI_API_KEY).",
    );
  }

  const model = opts.model ?? cfg.defaultModel;
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens ?? 1024,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Retry transient 5xx / 429; fail fast on 4xx (bad key, bad model).
        if (res.status >= 500 || res.status === 429) {
          lastError = new AiGatewayError(
            `Provider returned ${res.status}`,
            text,
          );
          throw lastError;
        }
        throw new AiGatewayError(
          `Provider rejected request (${res.status}): ${text}`,
          text,
        );
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = json.choices?.[0]?.message?.content ?? "";
      return {
        content,
        model,
        promptTokens: json.usage?.prompt_tokens ?? null,
        completionTokens: json.usage?.completion_tokens ?? null,
        latencyMs: Date.now() - startedAt,
        mocked: false,
      };
    } catch (err) {
      lastError = err;
      // Do not retry a definitive client rejection.
      if (
        err instanceof AiGatewayError &&
        err.message.startsWith("Provider rejected request")
      ) {
        throw err;
      }
      if (attempt < MAX_RETRIES) {
        await sleep(BASE_BACKOFF_MS * attempt);
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new AiGatewayError(
    "AI provider unavailable after retries.",
    lastError,
  );
}
