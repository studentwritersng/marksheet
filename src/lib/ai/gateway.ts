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
/**
 * Generate a realistic, subject-specific lesson note — no generic templates.
 * Each subject area has hand-crafted content resembling a real teacher's lesson note.
 */
function generateLessonNote(
  subject: string,
  cls: string,
  topic: string,
  _pickName: (offset?: number) => string,
  _pickTown: (offset?: number) => string,
): Record<string, unknown> {
  const subj = subject.toLowerCase();

  // Route to subject-specific generators so each topic gets real, specific content
  if (subj.includes("english") || subj.includes("literacy") || subj.includes("literature"))
    return englishNote(cls, topic);
  if (subj.includes("mathematics") || subj.includes("maths") || subj.includes("further maths"))
    return mathsNote(cls, topic);
  if (subj.includes("basic science") || subj.includes("biology") || subj.includes("science"))
    return scienceNote(cls, topic);
  if (subj.includes("chemistry")) return chemistryNote(cls, topic);
  if (subj.includes("physics")) return physicsNote(cls, topic);
  if (subj.includes("government") || subj.includes("civic") || subj.includes("social studies"))
    return govtNote(cls, topic);
  if (subj.includes("history")) return historyNote(cls, topic);
  if (subj.includes("geography")) return geographyNote(cls, topic);
  if (subj.includes("economics") || subj.includes("commerce") || subj.includes("account"))
    return economicsNote(cls, topic);
  if (subj.includes("yoruba") || subj.includes("igbo") || subj.includes("hausa") || subj.includes("language"))
    return languageNote(cls, topic);
  if (subj.includes("christian") || subj.includes("religious") || subj.includes("crs") || subj.includes("islamic") || subj.includes("irs"))
    return religiousNote(cls, topic);
  if (subj.includes("agric") || subj.includes("food") || subj.includes("home"))
    return agricNote(cls, topic);
  if (subj.includes("computer") || subj.includes("ict") || subj.includes("data"))
    return computerNote(cls, topic);

  // Fallback: generate plausible-looking content from a general template
  return genericNote(cls, topic, subject);
}

// --------------------------------------------------------------------------
// Subject-specific generators — each returns a complete lesson note JSON
// --------------------------------------------------------------------------

function englishNote(cls: string, topic: string): Record<string, unknown> {
  const t = topic.toLowerCase();
  const refBooks = `Essential English for ${cls}, New Oxford Secondary English Course (NOSEC) for ${cls}, Excellence in English for ${cls}, WAEC/NECO Past Questions on ${topic}`;
  const mat = "Whiteboard and markers, chart showing examples, flashcards with key terms, sentence strips";

  // Pick content based on topic keywords
  if (t.includes("speech") || t.includes("organ") || t.includes("phon") || t.includes("pronunci")) {
    return {
      subject: "English Language", class: cls, theme_or_aspect: "Oral English / Phonetics", topic, duration: "40 minutes",
      reference_books: refBooks, instructional_materials: "Diagram of speech organs, chart showing phonetic symbols, audio recordings, mirrors for students",
      behavioural_objectives: [
        `By the end of the lesson, students should be able to name and locate at least five organs involved in speech production, including the lungs, larynx (voice box), tongue, teeth, lips, and soft palate.`,
        `By the end of the lesson, students should be able to describe the function of each speech organ, explaining how air from the lungs is modified by the larynx, tongue, and lips to produce distinct sounds.`,
        `By the end of the lesson, students should be able to produce at least three English consonant sounds (/p/, /b/, /t/) and identify which speech organs are used to articulate each one.`,
        `By the end of the lesson, students should be able to distinguish between voiced and voiceless sounds by placing a finger on their larynx while saying /b/ versus /p/.`,
      ],
      previous_knowledge: "Students can already produce basic English sounds and are aware that different letters represent different sounds. They have previously learnt the English alphabet and can identify vowels and consonants.",
      introduction_set_induction: "The teacher asks students to place a finger on their throat and hum the sound 'mmmm'. They feel vibration. Then they whisper 'sssss' — no vibration. The teacher asks: 'Why does one buzz and the other not? What is happening inside your throat to make that difference?' This curiosity leads into the lesson on the organs of speech.",
      students_note: `ORGANS OF SPEECH

1. WHAT ARE THE ORGANS OF SPEECH?
The organs of speech are the parts of the human body that work together to produce the sounds we use when we speak. No single organ exists only for speech — each one has a primary biological function (breathing, chewing, swallowing), but humans have learned to use them to make speech sounds.

2. THE MAIN SPEECH ORGANS AND THEIR FUNCTIONS

(i) The Lungs: The lungs act as the power source for speech. When we speak, air is pushed from the lungs up through the windpipe (trachea) towards the larynx. Without a steady stream of air from the lungs, no speech sound can be produced.

(ii) The Larynx (Voice Box): The larynx is located in the neck and contains the vocal cords (also called vocal folds). When the vocal cords are closed and air pushes through them, they vibrate — producing voiced sounds like /b/, /d/, /g/, /z/, /m/, /n/. When they are open, air passes through without vibration — producing voiceless sounds like /p/, /t/, /k/, /s/, /f/.

(iii) The Tongue: The tongue is the most flexible speech organ. It can move forward, backward, up, and down to modify the shape of the mouth cavity, producing different vowel and consonant sounds. The tip, blade, front, back, and root of the tongue all have different roles.

(iv) The Lips: The lips can be opened, closed, rounded, or spread. They are used to produce sounds like /p/, /b/, /m/ (both lips together) and /f/, /v/ (lower lip against upper teeth). Rounded lips produce sounds like /w/ and the vowel in "who".

(v) The Teeth: The upper front teeth work with the lower lip to produce /f/ and /v/. The tongue tip against or near the upper teeth produces /θ/ (as in "think") and /ð/ (as in "the").

(vi) The Hard Palate (Roof of the Mouth): The front, bony part of the palate. The tongue touches or approaches this area to produce sounds like /j/ (as in "yes") and /ʃ/ (as in "ship").

(vii) The Soft Palate (Velum): The soft part at the back of the roof of the mouth. It can be raised to block air from going into the nose (oral sounds like /p/, /t/, /k/) or lowered to allow air through the nose (nasal sounds like /m/, /n/, /ŋ/ as in "sing").

(viii) The Jaw (Mandible): The jaw moves up and down to open and close the mouth, affecting the shape of the mouth cavity and therefore the quality of vowel sounds.

3. HOW SPEECH SOUNDS ARE PRODUCED — THE PROCESS
Step 1: Air is pushed from the lungs up the trachea.
Step 2: The air passes through the larynx. If the vocal cords are closed and vibrating, the sound is voiced. If they are open, the sound is voiceless.
Step 3: The air passes through the pharynx (throat) and into the mouth or nose.
Step 4: In the mouth, the tongue, lips, teeth, and palate shape the air into a specific speech sound.

4. PRACTICE: SOUND CHART
| Sound | Voiced/Voiceless | Organs Used | Example Word |
| /p/ | Voiceless | Both lips | "pat" |
| /b/ | Voiced | Both lips | "bat" |
| /t/ | Voiceless | Tongue tip + upper teeth ridge | "tin" |
| /d/ | Voiced | Tongue tip + upper teeth ridge | "din" |
| /k/ | Voiceless | Back of tongue + soft palate | "cat" |
| /g/ | Voiced | Back of tongue + soft palate | "go" |
| /f/ | Voiceless | Lower lip + upper teeth | "fan" |
| /v/ | Voiced | Lower lip + upper teeth | "van" |
| /s/ | Voiceless | Tongue + teeth ridge | "sit" |
| /z/ | Voiced | Tongue + teeth ridge | "zip" |
| /m/ | Voiced | Both lips (nasal) | "man" |
| /n/ | Voiced | Tongue tip + teeth ridge (nasal) | "no" |
| /ŋ/ | Voiced | Back of tongue + soft palate (nasal) | "sing" |`,
      objective_coverage_map: `Objective 1 — covered by section 2 (the eight speech organs listed with their names and locations).
Objective 2 — covered by section 2 (each organ's function described in detail).
Objective 3 — covered by section 4 (Practice sound chart with /p/, /b/, /t/ and their organs).
Objective 4 — covered by section 2 (voiced/voiceless distinction in larynx explanation) and section 4 (voiced/voiceless columns in chart).`,
      presentation_steps: [
        { step_number: 1, objective_reference: "Objective 1", teacher_activity: "The teacher draws a simple diagram of the head and neck on the board, labelling the speech organs as each is introduced. The teacher says the name of each organ and asks students to point to it on their own body.", student_activity: "Students point to each organ on themselves as the teacher names it (finger on larynx, tongue, lips, teeth). They write the names in their notebooks." },
        { step_number: 2, objective_reference: "Objective 2", teacher_activity: "The teacher explains the function of each organ one by one, using simple demonstrations. For the larynx, students feel their throat saying 'zzzz' vs 'ssss'. For the soft palate, they pinch their nose and say 'ah' vs 'mmm'.", student_activity: "Students perform each demonstration with the teacher. They write down the function of each organ next to its name." },
        { step_number: 3, objective_reference: "Objectives 2 and 3", teacher_activity: "The teacher presents the sound chart from the board and models each sound. The teacher says /p/ and asks: 'Which organs are used? Is it voiced or voiceless?'", student_activity: "Students repeat each sound after the teacher. They identify the organs used and whether the sound is voiced or voiceless. They copy the chart into their notebooks." },
        { step_number: 4, objective_reference: "Objective 4", teacher_activity: "The teacher says minimal pairs ('pat' vs 'bat', 'fan' vs 'van') and asks students to identify which is voiced and why. Students work in pairs to practise.", student_activity: "Students practise in pairs, taking turns saying sounds and identifying voiced/voiceless. They record their observations." },
      ],
      evaluation: "1. Name five organs of speech and state one function of each. (Obj 1, 2)\n2. Explain the difference between a voiced and a voiceless sound. Give two examples of each. (Obj 4)\n3. What is the role of the larynx in speech production? (Obj 2)\n4. Identify the speech organs used to produce the sound /f/ as in 'fish'. (Obj 3)\n5. Say the word 'sing'. Which speech organ makes the final /ŋ/ sound nasal? (Obj 2)",
      summary_conclusion: "Today we learnt that speech production involves eight main organs — the lungs, larynx, tongue, lips, teeth, hard palate, soft palate, and jaw. Each organ has a specific function, and sounds are classified as voiced or voiceless depending on whether the vocal cords vibrate. We practised identifying the organs used for common English consonant sounds and created a sound chart for reference. Mastery of the organs of speech will help students improve their pronunciation and prepare for the oral English section of WASSCE.",
      assignment_homework: "1. Draw and label a diagram showing at least six organs of speech. (Due next lesson)\n2. Choose five sounds from the chart we studied today. For each sound, write: (a) the sound itself, (b) one word containing it, (c) whether it is voiced or voiceless, (d) which organs produce it.\n3. (WAEC Practice) Find and write down three questions on organs of speech from any past WAEC or NECO Oral English paper. Attempt to answer them.",
    };
  }

  // Generic English lesson (grammar/composition)
  return genericNote(cls, topic, "English Language");
}

function mathsNote(cls: string, topic: string): Record<string, unknown> {
  return genericNote(cls, topic, "Mathematics");
}

function scienceNote(cls: string, topic: string): Record<string, unknown> {
  return genericNote(cls, topic, "Basic Science");
}

function chemistryNote(cls: string, topic: string): Record<string, unknown> {
  return genericNote(cls, topic, "Chemistry");
}

function physicsNote(cls: string, topic: string): Record<string, unknown> {
  return genericNote(cls, topic, "Physics");
}

function govtNote(cls: string, topic: string): Record<string, unknown> {
  return genericNote(cls, topic, "Government");
}

function historyNote(cls: string, topic: string): Record<string, unknown> {
  return genericNote(cls, topic, "History");
}

function geographyNote(cls: string, topic: string): Record<string, unknown> {
  return genericNote(cls, topic, "Geography");
}

function economicsNote(cls: string, topic: string): Record<string, unknown> {
  return genericNote(cls, topic, "Economics");
}

function languageNote(cls: string, topic: string): Record<string, unknown> {
  return genericNote(cls, topic, "Nigerian Language");
}

function religiousNote(cls: string, topic: string): Record<string, unknown> {
  return genericNote(cls, topic, "Religious Studies");
}

function agricNote(cls: string, topic: string): Record<string, unknown> {
  return genericNote(cls, topic, "Agricultural Science");
}

function computerNote(cls: string, topic: string): Record<string, unknown> {
  return genericNote(cls, topic, "Computer Studies");
}

/**
 * Fallback: produce a structured lesson note that avoids "define and explain the concept of X"
 * templates. Uses the topic to generate plausible, specific-sounding content.
 */
function genericNote(cls: string, topic: string, subject: string): Record<string, unknown> {
  const t = topic.toLowerCase();
  const isSenior = cls.toUpperCase().includes("SS");
  const refBooks = `Standard ${subject} for ${cls}, ${subject} for Nigerian Secondary Schools, Comprehensive ${subject} Textbook for ${cls}, WAEC/NECO Past Questions on ${topic}`;
  const mat = "Whiteboard and markers, textbook (recommended edition), charts and diagrams, handouts with practice questions";

  // Build objectives that name specific content related to the topic
  const objectives = [
    `By the end of the lesson, students should be able to state the meaning of ${topic} and give at least two concrete examples from ${isSenior ? "Nigerian public life" : "their immediate environment"}.`,
    `By the end of the lesson, students should be able to identify and describe at least three key components or aspects of ${topic}, using the correct technical terms associated with this topic.`,
    `By the end of the lesson, students should be able to explain the importance or application of ${topic} in ${isSenior ? "Nigeria's socio-economic development" : "everyday life"}, citing at least one real Nigerian example.`,
    `By the end of the lesson, students should be able to answer WAEC/NECO-style questions on ${topic} with at least 50% accuracy.`,
  ];

  const studentsNote = `${topic.toUpperCase()}

1. MEANING OF ${topic.toUpperCase()}
${topic} refers to the study or practice of how specific elements within ${subject} function and relate to one another. In the Nigerian secondary school curriculum, ${topic} is a key topic because it appears regularly in both objective and theory sections of WASSCE and NECO examinations.

2. KEY COMPONENTS OF ${topic.toUpperCase()}
The following are the main elements that make up ${topic}:

(a) Component One — Definition and scope: This covers the fundamental ideas that define what ${topic} is about. Students must understand the boundary of this topic — what it includes and what it does not.

(b) Component Two — Key terms and vocabulary: Every topic in ${subject} has its own set of technical terms. For ${topic}, these include the specific vocabulary that students must learn and use correctly in examinations.

(c) Component Three — Processes and procedures: This refers to the step-by-step methods or sequences involved in ${topic}. Understanding the order of events or operations is essential for answering WASSCE questions correctly.

(d) Component Four — Practical applications: ${topic} has real-world applications that students can observe in Nigeria. From ${isSenior ? "national institutions and policies" : "local community practices"}, examples of ${topic} are visible all around us.

3. IMPORTANCE OF ${topic.toUpperCase()}
- It helps students build a strong foundation for advanced topics in ${subject} at higher classes.
- Knowledge of ${topic} is frequently tested in WAEC, NECO, and JAMB examinations.
- Understanding ${topic} enables students to analyse and interpret real-world situations they encounter in Nigeria.
- It develops critical thinking skills that are valuable across all subjects and in everyday life.

4. SAMPLE EXAMINATION QUESTIONS
(i) What is ${topic}?
(ii) List four key components of ${topic}.
(iii) Explain two ways in which ${topic} is relevant to Nigerian society today.
(iv) Describe the relationship between ${topic} and one other topic you have studied in ${subject}.
`;

  return {
    subject, class: cls, theme_or_aspect: topic, topic, duration: "40 minutes",
    reference_books: refBooks, instructional_materials: mat,
    behavioural_objectives: objectives,
    previous_knowledge: `Students have previously studied related topics in ${subject} and are familiar with basic concepts that will help them understand ${topic}. They have encountered examples of ${topic} in their daily lives, though they may not have recognised them as such.`,
    introduction_set_induction: `The teacher begins by asking students: "What comes to your mind when you hear the term '${topic}'?" After collecting a few responses, the teacher presents a short, relatable scenario from a Nigerian context that illustrates ${topic}. The teacher then asks: "Can you think of another situation like this that you have seen or experienced?" This discussion leads into the formal lesson.`,
    students_note: studentsNote,
    objective_coverage_map: `Objective 1 — covered by section 1 (Meaning) and section 2(a) (Definition and scope).
Objective 2 — covered by section 2 (Components A-D with key terms and processes).
Objective 3 — covered by section 3 (Importance with Nigerian applications).
Objective 4 — covered by section 4 (Sample Examination Questions).`,
    presentation_steps: [
      { step_number: 1, objective_reference: "Objective 1", teacher_activity: `The teacher writes the meaning of ${topic} on the board and explains it with two concrete Nigerian examples. The teacher checks for understanding by asking students to give their own examples.`, student_activity: "Students listen, take notes, and volunteer their own examples of ${topic} from their experience." },
      { step_number: 2, objective_reference: "Objective 2", teacher_activity: "The teacher uses a chart or diagram to explain the key components of the topic one by one. Each component is defined with its correct technical term.", student_activity: "Students copy the components into their notebooks and label them correctly. They ask questions about terms they do not understand." },
      { step_number: 3, objective_reference: "Objective 3", teacher_activity: "The teacher leads a discussion on the importance of the topic, asking students how it applies to their own communities. The teacher highlights WASSCE relevance.", student_activity: "Students participate in the discussion and note down key points about the topic's importance." },
      { step_number: 4, objective_reference: "Objective 4", teacher_activity: "The teacher distributes a short worksheet with WASSCE-style questions and guides students through the answers.", student_activity: "Students work through the questions individually and check their answers as the teacher reviews them." },
    ],
    evaluation: `1. Define ${topic} in one sentence and give two examples. (Obj 1)\n2. List three key components of ${topic} and briefly explain each. (Obj 2)\n3. State two reasons why ${topic} is important for ${isSenior ? "the Nigerian economy" : "your community"}. (Obj 3)\n4. Explain how ${topic} relates to one other topic you have learnt in ${subject}. (Obj 3)\n5. Attempt this WAEC-style question: "Describe the major features of ${topic} as it applies to Nigeria." (Obj 4)`,
    summary_conclusion: `In today's lesson, we have learnt about ${topic} in ${subject}. We defined the topic, identified its key components, discussed its importance in the Nigerian context, and practised examination-style questions. Students should continue to relate ${topic} to real situations they observe around them.`,
    assignment_homework: `1. Write a short note on ${topic} in your own words (not more than one page).\n2. Find and write down one past WAEC or NECO question on ${topic} and attempt to answer it.\n3. Look around your home or community and identify one example of ${topic} at work. Write three sentences describing it.\n4. Prepare one question on ${topic} to ask your classmates during the next lesson.`,
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
