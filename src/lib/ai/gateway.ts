/**
 * AI Gateway Service (PRD 14)
 * ---------------------------------------------------------------------------
 * The SINGLE place in the codebase that knows how to talk to an AI provider.
 * Every AI-consuming module (lesson notes, question generation, essay grading,
 * comment drafting) MUST call through this service. No module may instantiate a
 * provider SDK or hardcode a base URL / model name.
 *
 * Resolution order:
 *   1. Active provider from the AiProviderConfig table (configured in Console → AI Config)
 *   2. Environment variables (AI_BASE_URL, AI_API_KEY, AI_DEFAULT_MODEL, AI_MOCK)
 *
 * The provider is assumed to expose an OpenAI-compatible
 * /chat/completions interface, which OpenRouter and most modern providers do.
 */

export type AiTaskType =
  | "lesson_note_generation"
  | "question_generation"
  | "essay_grading"
  | "comment_drafting"
  | "curriculum_parsing";

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

async function loadBestConfig(): Promise<GatewayConfig> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const dbProvider = await prisma.aiProviderConfig.findFirst({
      where: { isActive: true },
    });
    if (dbProvider?.baseUrl && dbProvider?.apiKeyEncrypted && dbProvider?.defaultModelName) {
      return {
        baseUrl: dbProvider.baseUrl,
        apiKey: dbProvider.apiKeyEncrypted,
        defaultModel: dbProvider.defaultModelName,
        mock: false,
      };
    }
  } catch {
    // DB unavailable — fall through to env
  }
  return loadConfig();
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
    case "question_generation": {
      content = JSON.stringify(generateQuestions(last));
      break;
    }
    case "curriculum_parsing": {
      content = JSON.stringify([
        { week: 1, topic: "Introduction to the Subject", subTopics: ["Meaning and scope", "Importance"], behaviouralObjectives: ["Define the subject", "Explain its importance"] },
        { week: 2, topic: "Core Concepts", subTopics: ["Key terminology", "Basic principles"], behaviouralObjectives: ["Identify key concepts", "Apply basic principles"] },
      ]);
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
 * Generate mock exam questions that match the Nigerian school standard format.
 * Produces specific, knowledge-testing questions with plausible options (MCQ)
 * or sub-part (a)(b)(c) structure (essay), following the templates in /questions/.
 */
function generateQuestions(userPrompt: string): Record<string, unknown> {
  const isMcq = /MCQ/i.test(userPrompt);
  const countMatch = userPrompt.match(/Number of (?:MCQ |essay )?questions to generate:\s*(\d+)/i);
  const marksMatch = userPrompt.match(/Marks per question:\s*(\d+)/i);
  const classMatch = userPrompt.match(/Class:\s*(\S+)/i);
  const subjectMatch = userPrompt.match(/Subject:\s*(.+)/i);
  const topicMatch = userPrompt.match(/Topic:\s*(.+)/i);
  const groundingMatch = userPrompt.match(/Grounding percentage:\s*(\d+)/i);

  const count = countMatch ? Math.max(1, Math.min(50, Number(countMatch[1]))) : 3;
  const marks = marksMatch ? Number(marksMatch[1]) : 5;
  const cls = classMatch ? classMatch[1] : "SSS1";
  const subject = subjectMatch?.[1]?.trim() ?? "the subject";
  const topic = topicMatch?.[1]?.trim() ?? "the topic";
  const groundingPercentage = groundingMatch ? Math.max(0, Math.min(100, Number(groundingMatch[1]))) : 75;

  // Extract lesson note content from prompt (text after "Lesson note content:")
  const lessonNoteContent = extractLessonNoteContent(userPrompt);

  // Grounding split: first N questions use lesson-note content, rest use pool
  const groundedCount = Math.round(count * groundingPercentage / 100);
  const extensionCount = count - groundedCount;

  // 40-40-20 distribution
  const diffLevels = ["Easy", "Medium", "Hard"];
  const diffCounts = [
    Math.round(count * 0.4),
    Math.round(count * 0.4),
    count - Math.round(count * 0.4) - Math.round(count * 0.4),
  ];
  // Build an array: [Easy, Easy, Medium, Medium, Hard, ...]
  const diffAssign: string[] = [];
  for (let d = 0; d < diffLevels.length; d++) {
    for (let i = 0; i < diffCounts[d]; i++) diffAssign.push(diffLevels[d]);
  }
  // Shuffle so they're not grouped
  for (let i = diffAssign.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [diffAssign[i], diffAssign[j]] = [diffAssign[j], diffAssign[i]];
  }

  const isSenior = cls.toUpperCase().includes("SS");

  if (isMcq) {
    const questions = Array.from({ length: count }, (_, i) => {
      const isGrounded = i < groundedCount;
      const q = generateMcq(subject, cls, topic, isSenior, i, marks, diffAssign[i] ?? "Medium");
      return injectLessonContentIntoMcq(q, lessonNoteContent, isGrounded, i);
    });
    return { questions };
  }

  const questions = Array.from({ length: count }, (_, i) => {
    const isGrounded = i < groundedCount;
    const q = generateEssay(subject, cls, topic, isSenior, i, marks, diffAssign[i] ?? "Medium");
    return injectLessonContentIntoEssay(q, lessonNoteContent, isGrounded, topic, marks);
  });
  return { questions };
}

/**
 * Extract the Student's Note (content) section from the lesson note prompt block.
 * Looks for the `*** STUDENT'S NOTE ***` marker, then `Content:`, then everything else.
 */
function extractLessonNoteContent(prompt: string): string {
  const fullMatch = prompt.match(/Lesson note content:\s*([\s\S]*?)(?:\n\n(?:Subject|Class|Number of|Marks per|Grounding|Difficulty)|$)/i);
  if (!fullMatch) return "";
  const raw = fullMatch[1];

  // Extract the Student's Note section (new format: "Student's Note:\n...")
  const studentNoteMatch = raw.match(/Student's Note:\s*([\s\S]*?)(?:\n--- Lesson Note:|$)/i);
  if (studentNoteMatch) return studentNoteMatch[1].trim();

  // Fallback: try *** STUDENT'S NOTE *** (old format)
  const legacyMatch = raw.match(/\*\*\* STUDENT'S NOTE[^*]+\*\*\*\s*([\s\S]*?)(?:\n\n(?:Evaluation|Summary|Assignment|Previous Knowledge|Introduction)|\n--- Lesson Note:|$)/i);
  if (legacyMatch) return legacyMatch[1].trim();

  // Fallback: try Content: marker (older format)
  const contentMatch = raw.match(/Content:\s*([\s\S]*?)(?:\n\n(?:Evaluation|Summary|Assignment|Previous Knowledge|Introduction)|\n--- Lesson Note:|$)/i);
  if (contentMatch) return contentMatch[1].trim();

  // Last fallback: return everything stripping headers
  const lines = raw.split("\n").filter((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith("---") && !/^(Student's Note|Previous Knowledge|Introduction|Content|Evaluation|Summary|Assignment):/i.test(t);
  });
  return lines.join("\n").trim();
}

/**
 * Split content into meaningful sentences, filtering out short/trivial lines.
 */
function extractSentences(content: string): string[] {
  const lines = content
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 25)
    // Exclude lines that are only uppercase, digits, and punctuation (headings)
    .filter((l) => /[a-z]/.test(l));
  if (lines.length < 2) {
    // Fall back to sentence-boundary splitting
    return content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25 && !/^\d/.test(s) && /[a-z]/.test(s));
  }
  return lines;
}

/** Pick a short (~5 word) key term from a sentence for question focus. */
function pickTerm(sentence: string): string | null {
  const words = sentence.split(/\s+/);
  // Prefer a capitalized multi-word term early in the sentence
  for (let i = 0; i < Math.min(8, words.length); i++) {
    if (words[i].length > 4 && /^[A-Z]/.test(words[i]) && !["Which", "What", "Where", "When", "Why", "How", "The", "This", "These", "Those"].includes(words[i])) {
      // Take up to 3 consecutive capitalized words
      const term: string[] = [words[i].replace(/[^a-zA-Z0-9]/g, "")];
      for (let j = i + 1; j < Math.min(i + 4, words.length); j++) {
        if (/^[A-Z]/.test(words[j])) term.push(words[j].replace(/[^a-zA-Z0-9]/g, ""));
        else break;
      }
      return term.join(" ");
    }
  }
  // Fallback: use the longest word
  const longest = [...words].filter((w) => w.length > 5).sort((a, b) => b.length - a.length)[0];
  return longest ? longest.replace(/[^a-zA-Z0-9]/g, "") : null;
}

/** For a grounded MCQ, generate a natural question from the lesson content. */
function injectLessonContentIntoMcq(
  q: Record<string, unknown>,
  lessonContent: string,
  isGrounded: boolean,
  index: number,
): Record<string, unknown> {
  if (!lessonContent || !isGrounded) return q;

  const sentences = extractSentences(lessonContent);
  if (sentences.length === 0) return q;

  const si = index % sentences.length;
  const sentence = sentences[si];
  const term = pickTerm(sentence);

  // Build distractors from other sentences (key concepts)
  const distractorTerms: string[] = [];
  for (let i = 0; i < sentences.length && distractorTerms.length < 3; i++) {
    if (i === si) continue;
    const t = pickTerm(sentences[i]);
    if (t && t !== term && !distractorTerms.includes(t)) distractorTerms.push(t);
  }

  // Pick question pattern based on index for diversity
  const pattern = index % 5;
  const marks = q.marks as number;
  const difficulty = q.difficulty as string;

  // Common helpers
  const baseOpts = (correct: string, wrong1: string, wrong2: string, wrong3: string) => [
    { label: "A", text: correct, is_correct: true },
    { label: "B", text: wrong1, is_correct: false },
    { label: "C", text: wrong2, is_correct: false },
    { label: "D", text: wrong3, is_correct: false },
  ];
  const distractorPool = distractorTerms.length >= 3 ? distractorTerms : ["a different process", "an unrelated part", "the opposite concept"];

  if (pattern === 0 && term) {
    // Definition / best-answer
    const opts = baseOpts(
      sentence.slice(0, 80),
      `${distractorPool[0]} described in the lesson`,
      `${distractorPool[1]} as explained in the note`,
      `${distractorPool[2]} mentioned in the text`,
    );
    return {
      question_text: `Which of the following best describes ${term}?`,
      marks, difficulty, options: opts,
      rationale: `The lesson note states: ${sentence.slice(0, 150)}`,
      grounding_summary: { target_grounding_percentage: 75, grounded_count: 1, extension_count: 0 },
    };
  }

  if (pattern === 1 && term) {
    // Negative option — pick what does NOT belong
    const opts = baseOpts(
      sentence.slice(0, 80),
      `${distractorPool[0]}`,
      `${distractorPool[1]}`,
      `${distractorPool[2]}`,
    );
    return {
      question_text: `Which of the following is NOT true about ${term}?`,
      marks, difficulty, options: opts,
      rationale: `Based on the lesson note: ${sentence.slice(0, 150)}`,
      grounding_summary: { target_grounding_percentage: 75, grounded_count: 1, extension_count: 0 },
    };
  }

  if (pattern === 2) {
    // Fill-in-the-blank (sentence completion)
    const words = sentence.split(/\s+/);
    const blankIdx = Math.min(Math.floor(words.length / 2), words.length - 2);
    const blankWord = words[blankIdx].replace(/[^a-zA-Z0-9]/g, "");
    if (blankWord.length >= 4) {
      const stem = words.slice(0, blankIdx).join(" ");
      const rest = words.slice(blankIdx + 1).join(" ");
      const fillers = distractorTerms.length >= 3
        ? distractorTerms
        : ["component", "element", "factor"];
      const opts = baseOpts(blankWord, fillers[0], fillers[1], fillers[2]);
      return {
        question_text: `Complete the sentence: "${stem} ________ ${rest}"`,
        marks, difficulty, options: opts,
        rationale: `The lesson note states: ${sentence.slice(0, 150)}`,
        grounding_summary: { target_grounding_percentage: 75, grounded_count: 1, extension_count: 0 },
      };
    }
  }

  if (pattern === 3 && term) {
    // Comprehension / true-statement
    const opts = baseOpts(
      sentence.slice(0, 80),
      `The opposite of what the lesson teaches about ${term}`,
      `An incorrect claim about ${distractorPool[0]}`,
      `A statement not supported by the lesson note`,
    );
    return {
      question_text: `According to the lesson note, which of the following statements is true about ${term}?`,
      marks, difficulty, options: opts,
      rationale: `The lesson note states: ${sentence.slice(0, 150)}`,
      grounding_summary: { target_grounding_percentage: 75, grounded_count: 1, extension_count: 0 },
    };
  }

  if (pattern === 4 && term && distractorTerms.length >= 2) {
    // Classification / cause-effect
    const opts = baseOpts(
      sentence.slice(0, 80),
      `${distractorTerms[0]}`,
      `${distractorTerms[1]}`,
      distractorTerms[2] || "none of the above",
    );
    return {
      question_text: `Which of the following is an example or consequence of ${term}?`,
      marks, difficulty, options: opts,
      rationale: `The lesson note states: ${sentence.slice(0, 150)}`,
      grounding_summary: { target_grounding_percentage: 75, grounded_count: 1, extension_count: 0 },
    };
  }

  // Final fallback: simple definition question
  if (term) {
    const opts = baseOpts(
      sentence.slice(0, 80),
      `A different concept: ${distractorPool[0]}`,
      `An unrelated idea: ${distractorPool[1]}`,
      `Another topic: ${distractorPool[2]}`,
    );
    return {
      question_text: `What does the lesson note say about ${term}?`,
      marks, difficulty, options: opts,
      rationale: `The lesson note states: ${sentence.slice(0, 150)}`,
      grounding_summary: { target_grounding_percentage: 75, grounded_count: 1, extension_count: 0 },
    };
  }

  return q;
}

/** For a grounded essay, use content sentences for (a)(b)(c) parts. */
function injectLessonContentIntoEssay(
  q: Record<string, unknown>,
  lessonContent: string,
  isGrounded: boolean,
  topic: string,
  marks: number,
): Record<string, unknown> {
  if (!lessonContent || !isGrounded) return q;

  const sentences = extractSentences(lessonContent);
  if (sentences.length < 2) return q;

  const p1 = Math.round(marks * 0.35);
  const p2 = Math.round(marks * 0.35);
  const p3 = marks - p1 - p2;

  const sA = sentences[0];
  const sB = sentences[Math.min(1, sentences.length - 1)];
  const termA = pickTerm(sA) || topic;
  const termB = pickTerm(sB) || topic;

  const qText = `Question 1 [${marks} marks]\n(a) Explain ${termA} as discussed in the lesson note. [${p1} marks]\n(b) Describe ${termB} based on what you have learned. [${p2} marks]\n(c) With reference to ${termA} and ${termB}, explain their importance in everyday life. Give one relevant Nigerian example. [${p3} marks]`;

  return {
    question_text: qText,
    marks,
    difficulty: q.difficulty,
    model_answer: `(a) ${sA.slice(0, 250)}\n\n(b) ${sB.slice(0, 250)}\n\n(c) [Student explains relevance with a Nigerian example — e.g. how ${termA} and ${termB} apply to farming, healthcare, education, or daily communication in Nigeria.]`,
    rubric_points: [
      { description: `Correct explanation of ${termA}`, marks: p1, source_type: "grounded", lesson_note_reference: sA.slice(0, 80) },
      { description: `Correct explanation of ${termB}`, marks: p2, source_type: "grounded", lesson_note_reference: sB.slice(0, 80) },
      { description: "Relevant application to real life with a valid Nigerian example", marks: p3, source_type: "extension", lesson_note_reference: "" },
    ],
    grounding_summary: { target_grounding_percentage: 75, actual_grounded_points: 2, actual_extension_points: 1 },
  };
}

/** Generate a single Nigerian-standard MCQ with specific content and plausible options. */
function generateMcq(
  subject: string, cls: string, topic: string, isSenior: boolean,
  index: number, marks: number, difficulty: string,
): Record<string, unknown> {
  const subj = subject.toLowerCase();

  // Route to subject-specific MCQ banks
  if (subj.includes("english") || subj.includes("literacy") || subj.includes("literature"))
    return mcqEnglish(cls, index, marks, difficulty);
  if (subj.includes("mathematics") || subj.includes("maths") || subj.includes("further maths"))
    return mcqMaths(cls, index, marks, difficulty);
  if (subj.includes("basic science") || subj.includes("biology") || subj.includes("science"))
    return mcqScience(cls, index, marks, difficulty);
  if (subj.includes("chemistry")) return mcqChemistry(cls, index, marks, difficulty);
  if (subj.includes("physics")) return mcqPhysics(cls, index, marks, difficulty);
  if (subj.includes("government") || subj.includes("civic") || subj.includes("social studies"))
    return mcqGovt(cls, index, marks, difficulty);
  if (subj.includes("history")) return mcqHistory(cls, index, marks, difficulty);
  if (subj.includes("geography")) return mcqGeography(cls, index, marks, difficulty);
  if (subj.includes("economics") || subj.includes("commerce") || subj.includes("account"))
    return mcqEconomics(cls, index, marks, difficulty);
  if (subj.includes("christian") || subj.includes("religious") || subj.includes("crs"))
    return mcqReligious(cls, index, marks, difficulty);
  if (subj.includes("agric") || subj.includes("food") || subj.includes("home") || subj.includes("pvs"))
    return mcqAgric(cls, index, marks, difficulty);
  if (subj.includes("computer") || subj.includes("ict") || subj.includes("data"))
    return mcqComputer(cls, index, marks, difficulty);
  if (subj.includes("bst"))
    return mcqBst(cls, index, marks, difficulty);

  return mcqGeneric(cls, topic, subject, index, marks, difficulty, isSenior);
}

/** Generate a single Nigerian-standard essay question with (a)(b)(c) sub-parts. */
function generateEssay(
  subject: string, cls: string, topic: string, isSenior: boolean,
  index: number, marks: number, difficulty: string,
): Record<string, unknown> {
  const subj = subject.toLowerCase();

  if (subj.includes("english") || subj.includes("literacy") || subj.includes("literature"))
    return essayEnglish(cls, topic, index, marks, difficulty);
  if (subj.includes("mathematics") || subj.includes("maths") || subj.includes("further maths"))
    return essayMaths(cls, topic, index, marks, difficulty);
  if (subj.includes("basic science") || subj.includes("biology") || subj.includes("science"))
    return essayScience(cls, topic, index, marks, difficulty);
  if (subj.includes("chemistry")) return essayChemistry(cls, topic, index, marks, difficulty);
  if (subj.includes("physics")) return essayPhysics(cls, topic, index, marks, difficulty);
  if (subj.includes("government") || subj.includes("civic") || subj.includes("social studies"))
    return essayGovt(cls, topic, index, marks, difficulty);
  if (subj.includes("history")) return essayHistory(cls, topic, index, marks, difficulty);
  if (subj.includes("geography")) return essayGeography(cls, topic, index, marks, difficulty);
  if (subj.includes("economics") || subj.includes("commerce") || subj.includes("account"))
    return essayEconomics(cls, topic, index, marks, difficulty);
  if (subj.includes("christian") || subj.includes("religious") || subj.includes("crs"))
    return essayReligious(cls, topic, index, marks, difficulty);
  if (subj.includes("agric") || subj.includes("food") || subj.includes("home") || subj.includes("pvs"))
    return essayAgric(cls, topic, index, marks, difficulty);
  if (subj.includes("computer") || subj.includes("ict") || subj.includes("data"))
    return essayComputer(cls, topic, index, marks, difficulty);
  if (subj.includes("bst"))
    return essayBst(cls, topic, index, marks, difficulty);

  return essayGeneric(cls, topic, subject, index, marks, difficulty, isSenior);
}

// --------------------------------------------------------------------------
// MCQ Banks — each returns one MCQ object in Nigerian standard format
// --------------------------------------------------------------------------

const nigerianNames = ["Chiamaka", "Tunde", "Aisha", "Emeka", "Folake", "Musa", "Ngozi", "Kunle", "Zainab", "Chidi"];
const pickName = (i: number) => nigerianNames[i % nigerianNames.length];
const nigerianTowns = ["Lagos", "Kano", "Ibadan", "Enugu", "Abuja", "Port Harcourt", "Kaduna", "Jos", "Benin City", "Maiduguri"];
const pickTown = (i: number) => nigerianTowns[i % nigerianTowns.length];

// MCQ question pools keyed by subject
const mcqPools: Record<string, { stem: string; options: string[]; correct: number; rationale: string }[]> = {
  english: [
    { stem: "Which of the following is a vowel sound?", options: ["/b/", "/p/", "/i:/", "/t/"], correct: 2, rationale: "/i:/ is a vowel sound; the others are consonant sounds." },
    { stem: "The plural of 'child' is ________.", options: ["Childs", "Children", "Childes", "Childen"], correct: 1, rationale: "'Children' is the correct irregular plural form of 'child'." },
    { stem: "Which of these sentences is in the past tense?", options: ["She goes to school", "She went to school", "She will go to school", "She is going to school"], correct: 1, rationale: "'She went' is the past tense form." },
    { stem: "The opposite of 'generous' is ________.", options: ["Kind", "Selfish", "Friendly", "Brave"], correct: 1, rationale: "Selfish is the opposite of generous." },
    { stem: "A noun that names a specific person, place, or thing is called a ________ noun.", options: ["Common", "Proper", "Abstract", "Collective"], correct: 1, rationale: "A proper noun names a specific entity and is capitalised." },
    { stem: "Identify the conjunction in this sentence: 'She worked hard but she failed the examination.'", options: ["She", "Hard", "But", "Examination"], correct: 2, rationale: "'But' is a conjunction joining two clauses." },
    { stem: "The word 'beautiful' is an example of a/an ________.", options: ["Noun", "Verb", "Adjective", "Adverb"], correct: 2, rationale: "'Beautiful' describes a noun, making it an adjective." },
    { stem: "Which tense is used to express a habitual action?", options: ["Present continuous", "Present simple", "Past perfect", "Future continuous"], correct: 1, rationale: "Present simple tense expresses habitual actions (e.g., 'I wake up at 6am daily')." },
    { stem: "The literary device that compares two unlike things using 'like' or 'as' is called ________.", options: ["Metaphor", "Simile", "Personification", "Hyperbole"], correct: 1, rationale: "A simile uses 'like' or 'as' to make a comparison." },
    { stem: "Which of these words is an adverb?", options: ["Quick", "Quickly", "Quicken", "Quickness"], correct: 1, rationale: "'Quickly' is an adverb modifying a verb." },
  ],
  maths: [
    { stem: "What is the value of 25% of 200?", options: ["25", "50", "75", "100"], correct: 1, rationale: "25% of 200 = (25/100) × 200 = 50." },
    { stem: "Simplify: 3(x + 2) - 2x", options: ["x + 6", "5x + 6", "x + 2", "3x + 6"], correct: 0, rationale: "3(x+2) - 2x = 3x + 6 - 2x = x + 6." },
    { stem: "The sum of the interior angles of a triangle is ________.", options: ["90°", "180°", "270°", "360°"], correct: 1, rationale: "The interior angles of any triangle sum to 180°." },
    { stem: "What is the place value of 7 in the number 3,742?", options: ["Tens", "Hundreds", "Thousands", "Units"], correct: 1, rationale: "7 is in the hundreds place (700)." },
    { stem: "Convert 0.75 to a fraction in its simplest form.", options: ["3/4", "7/10", "3/5", "5/8"], correct: 0, rationale: "0.75 = 75/100 = 3/4 in simplest form." },
    { stem: "A rectangle has length 8 cm and width 5 cm. What is its perimeter?", options: ["13 cm", "26 cm", "40 cm", "20 cm"], correct: 1, rationale: "Perimeter = 2(L+W) = 2(8+5) = 26 cm." },
    { stem: "Which of these numbers is a prime number?", options: ["15", "21", "23", "27"], correct: 2, rationale: "23 has only two factors: 1 and itself." },
    { stem: "If a : b = 2 : 3 and b = 12, what is the value of a?", options: ["6", "8", "12", "18"], correct: 1, rationale: "a/12 = 2/3 → a = 8." },
    { stem: "The square root of 144 is ________.", options: ["11", "12", "13", "14"], correct: 1, rationale: "12 × 12 = 144." },
    { stem: "Solve for x: 2x + 5 = 13", options: ["3", "4", "5", "6"], correct: 1, rationale: "2x = 8 → x = 4." },
  ],
  science: [
    { stem: "Which organ is responsible for pumping blood around the body?", options: ["Lungs", "Heart", "Liver", "Kidney"], correct: 1, rationale: "The heart pumps blood through the circulatory system." },
    { stem: "The process by which plants make their own food is called ________.", options: ["Respiration", "Photosynthesis", "Digestion", "Transpiration"], correct: 1, rationale: "Photosynthesis uses sunlight, water, and carbon dioxide to produce food." },
    { stem: "Which of these is a renewable source of energy?", options: ["Coal", "Natural gas", "Solar energy", "Petroleum"], correct: 2, rationale: "Solar energy is renewable; fossil fuels are non-renewable." },
    { stem: "The basic unit of life is the ________.", options: ["Tissue", "Organ", "Cell", "Molecule"], correct: 2, rationale: "The cell is the fundamental structural unit of all living organisms." },
    { stem: "Which of these animals is a mammal?", options: ["Crocodile", "Frog", "Whale", "Lizard"], correct: 2, rationale: "Whales are mammals — they breathe air, are warm-blooded, and feed milk to their young." },
    { stem: "The force that pulls objects towards the centre of the Earth is called ________.", options: ["Magnetism", "Friction", "Gravity", "Tension"], correct: 2, rationale: "Gravity is the force of attraction between objects with mass." },
    { stem: "Which of the following is a liquid at room temperature?", options: ["Oxygen", "Water", "Iron", "Sand"], correct: 1, rationale: "Water is a liquid at room temperature; oxygen is a gas, iron is a solid." },
    { stem: "The function of the human skeleton includes ________.", options: ["Digestion", "Support and protection", "Breathing", "Circulation"], correct: 1, rationale: "The skeleton supports the body and protects internal organs." },
    { stem: "Which gas do plants absorb from the atmosphere during photosynthesis?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], correct: 2, rationale: "Plants take in carbon dioxide and release oxygen during photosynthesis." },
    { stem: "The change of state from solid to liquid is called ________.", options: ["Evaporation", "Condensation", "Melting", "Freezing"], correct: 2, rationale: "Melting occurs when a solid gains heat and turns into a liquid." },
  ],
  chemistry: [
    { stem: "The chemical symbol for gold is ________.", options: ["Go", "Gd", "Au", "Ag"], correct: 2, rationale: "Au is the symbol for gold (from Latin 'aurum')." },
    { stem: "Water is composed of hydrogen and ________.", options: ["Helium", "Oxygen", "Nitrogen", "Chlorine"], correct: 1, rationale: "Water is H₂O — two hydrogen atoms and one oxygen atom." },
    { stem: "Which of the following is an acid?", options: ["Soap", "Lemon juice", "Baking soda", "Ash"], correct: 1, rationale: "Lemon juice contains citric acid." },
    { stem: "The pH of a neutral solution is ________.", options: ["0", "7", "14", "10"], correct: 1, rationale: "A pH of 7 is neutral (pure water)." },
    { stem: "The smallest particle of an element that retains its chemical properties is a/an ________.", options: ["Molecule", "Atom", "Ion", "Compound"], correct: 1, rationale: "An atom is the smallest particle of an element." },
  ],
  physics: [
    { stem: "The SI unit of force is the ________.", options: ["Newton", "Joule", "Watt", "Pascal"], correct: 0, rationale: "Force is measured in newtons." },
    { stem: "Sound cannot travel through ________.", options: ["Air", "Water", "Vacuum", "Metal"], correct: 2, rationale: "Sound requires a medium; it cannot travel through a vacuum." },
    { stem: "The device used to measure electric current is called an ________.", options: ["Voltmeter", "Ammeter", "Ohmmeter", "Thermometer"], correct: 1, rationale: "An ammeter measures electric current in amperes." },
    { stem: "What is the speed of an object that travels 100 metres in 10 seconds?", options: ["5 m/s", "10 m/s", "20 m/s", "100 m/s"], correct: 1, rationale: "Speed = distance / time = 100/10 = 10 m/s." },
    { stem: "Heat transfer by the movement of fluids is called ________.", options: ["Conduction", "Convection", "Radiation", "Insulation"], correct: 1, rationale: "Convection is heat transfer through the movement of liquids or gases." },
  ],
  govt: [
    { stem: "Nigeria gained independence from Britain in the year ________.", options: ["1957", "1960", "1963", "1970"], correct: 1, rationale: "Nigeria became independent on 1st October 1960." },
    { stem: "Which of these is a function of the Nigerian police force?", options: ["Printing money", "Maintaining law and order", "Conducting elections", "Making laws"], correct: 1, rationale: "The police maintain law and order." },
    { stem: "The highest court in Nigeria is the ________.", options: ["High Court", "Court of Appeal", "Supreme Court", "Magistrate Court"], correct: 2, rationale: "The Supreme Court is the highest court in Nigeria." },
    { stem: "A system of government where power is shared between central and regional governments is called ________.", options: ["Unitary", "Federal", "Parliamentary", "Presidential"], correct: 1, rationale: "Federalism divides power between a central authority and constituent states." },
    { stem: "The National Assembly of Nigeria consists of ________.", options: ["Senate only", "House of Representatives only", "Senate and House of Representatives", "Senate, House of Reps and President"], correct: 2, rationale: "The National Assembly is bicameral: Senate (upper) and House of Representatives (lower)." },
  ],
  history: [
    { stem: "The first president of Nigeria was ________.", options: ["Nnamdi Azikiwe", "Abubakar Tafawa Balewa", "Olusegun Obasanjo", "Shehu Shagari"], correct: 0, rationale: "Nnamdi Azikiwe was Nigeria's first president (1963-1966)." },
    { stem: "The Berlin Conference of 1884-85 partitioned ________ among European powers.", options: ["Asia", "Africa", "South America", "Australia"], correct: 1, rationale: "European powers met in Berlin to partition Africa." },
    { stem: "The trans-Atlantic slave trade involved the forced movement of Africans to ________.", options: ["Asia", "Europe", "The Americas", "Australia"], correct: 2, rationale: "Enslaved Africans were transported to the Americas." },
    { stem: "The River Niger and River ________ are the two major rivers in Nigeria.", options: ["Benue", "Gambia", "Volta", "Nile"], correct: 0, rationale: "The Niger and Benue are Nigeria's two major rivers." },
    { stem: "The Biafran War in Nigeria took place between ________.", options: ["1960-1963", "1967-1970", "1975-1979", "1983-1985"], correct: 1, rationale: "The Nigerian Civil War (Biafran War) lasted from 1967 to 1970." },
  ],
  geography: [
    { stem: "The largest continent by land area is ________.", options: ["Africa", "Asia", "North America", "Europe"], correct: 1, rationale: "Asia is the largest continent." },
    { stem: "The imaginary line that divides the Earth into northern and southern hemispheres is the ________.", options: ["Prime Meridian", "Equator", "Tropic of Cancer", "International Date Line"], correct: 1, rationale: "The Equator is at 0° latitude." },
    { stem: "Which of these is a type of rock?", options: ["Igneous", "Atmospheric", "Aquatic", "Aerial"], correct: 0, rationale: "Igneous, sedimentary, and metamorphic are the three rock types." },
    { stem: "The climate of the Sahara Desert is best described as ________.", options: ["Tropical", "Temperate", "Arid", "Mediterranean"], correct: 2, rationale: "The Sahara has an arid (dry) climate." },
    { stem: "The movement of the Earth around the Sun is called ________.", options: ["Rotation", "Revolution", "Orbit", "Spin"], correct: 1, rationale: "Revolution is the Earth's yearly orbit around the Sun." },
  ],
  economics: [
    { stem: "The basic economic problem is the scarcity of ________ in relation to unlimited wants.", options: ["Money", "Resources", "Labour", "Technology"], correct: 1, rationale: "Scarcity of resources relative to unlimited wants is the fundamental economic problem." },
    { stem: "The demand for a good increases when its price ________.", options: ["Rises", "Falls", "Stays the same", "Doubles"], correct: 1, rationale: "According to the law of demand, quantity demanded rises when price falls." },
    { stem: "Which sector of the Nigerian economy contributes most to GDP?", options: ["Agriculture", "Manufacturing", "Oil and gas", "Education"], correct: 2, rationale: "Oil and gas is the largest contributor to Nigeria's GDP." },
    { stem: "A market where there is only one seller is called a ________.", options: ["Monopoly", "Oligopoly", "Perfect competition", "Duopoly"], correct: 0, rationale: "A monopoly has a single seller dominating the market." },
    { stem: "Inflation refers to a sustained increase in the ________.", options: ["Population", "General price level", "Unemployment rate", "Money supply"], correct: 1, rationale: "Inflation is a sustained rise in the general price level of goods and services." },
  ],
  religious: [
    { stem: "According to the Bible, who built the ark?", options: ["Abraham", "Moses", "Noah", "David"], correct: 2, rationale: "Noah built the ark to survive the great flood." },
    { stem: "The first book of the Bible is ________.", options: ["Exodus", "Genesis", "Leviticus", "Deuteronomy"], correct: 1, rationale: "Genesis is the first book of the Bible." },
    { stem: "How many disciples did Jesus have?", options: ["7", "10", "12", "14"], correct: 2, rationale: "Jesus chose twelve disciples." },
    { stem: "In Islam, the Five Pillars include prayer (Salah) and ________.", options: ["Fasting (Sawm)", "Dancing", "Singing", "Painting"], correct: 0, rationale: "Sawm (fasting during Ramadan) is one of the Five Pillars of Islam." },
    { stem: "According to Christian teaching, what is the greatest commandment?", options: ["Love your neighbour as yourself", "Honour your parents", "Go to church", "Tithe your income"], correct: 0, rationale: "Jesus taught that loving God and loving your neighbour are the greatest commandments." },
  ],
  agric: [
    { stem: "A weed is best defined as a plant growing ________.", options: ["In a farm", "Where it is not wanted", "During the dry season", "In the forest"], correct: 1, rationale: "A weed is any plant growing where it is not wanted." },
    { stem: "The chemical used to kill weeds is called a/an ________.", options: ["Insecticide", "Rodenticide", "Herbicide", "Fungicide"], correct: 2, rationale: "Herbicides are chemicals designed to kill weeds." },
    { stem: "Which of these is a farm animal used for work (draught)?", options: ["Rabbit", "Bull/Ox", "Chicken", "Pig"], correct: 1, rationale: "Oxen and bulls are used for pulling ploughs and carts." },
    { stem: "The process of keeping and breeding fish in a controlled environment is called ________.", options: ["Agriculture", "Aquaculture", "Aeroponics", "Hydroponics"], correct: 1, rationale: "Aquaculture is the farming of fish and other aquatic organisms." },
    { stem: "Which of these is a method of preserving fish in Nigeria?", options: ["Smoking", "Painting", "Planting", "Burying"], correct: 0, rationale: "Smoking is a common traditional method of fish preservation in Nigeria." },
    { stem: "The practice of planting trees where there were no trees before is called ________.", options: ["Deforestation", "Reforestation", "Afforestation", "Desertification"], correct: 2, rationale: "Afforestation is establishing a forest where none existed before." },
    { stem: "Crop rotation is a ________ method of weed control.", options: ["Chemical", "Cultural", "Mechanical", "Biological"], correct: 1, rationale: "Crop rotation is a cultural practice that disrupts weed life cycles." },
    { stem: "Which of these is a common weed on Nigerian farms?", options: ["Spear grass", "Orange tree", "Rice plant", "Oil palm"], correct: 0, rationale: "Spear grass (Imperata cylindrica) is a common invasive weed." },
    { stem: "The main product obtained from a dairy cow is ________.", options: ["Meat", "Milk", "Leather", "Wool"], correct: 1, rationale: "Dairy cows are raised primarily for milk production." },
    { stem: "A tool used for cutting grass and light weeds is a ________.", options: ["Cutlass", "Spade", "Rake", "Hoe"], correct: 0, rationale: "A cutlass is commonly used for slashing grass and weeds on Nigerian farms." },
  ],
  computer: [
    { stem: "ICT stands for ________.", options: ["Information and Communication Technology", "Internal Computer Transmission", "Integrated Communication Tool", "International Computer Terminology"], correct: 0, rationale: "ICT stands for Information and Communication Technology." },
    { stem: "Which of these is an example of a web browser?", options: ["Google", "Bing", "Mozilla Firefox", "Yahoo"], correct: 2, rationale: "Mozilla Firefox is a web browser; Google and Bing are search engines." },
    { stem: "The 'brain' of the computer is called the ________.", options: ["Monitor", "Keyboard", "Central Processing Unit (CPU)", "Hard drive"], correct: 2, rationale: "The CPU is the brain of the computer that processes instructions." },
    { stem: "Which of these is an output device?", options: ["Keyboard", "Mouse", "Monitor", "Scanner"], correct: 2, rationale: "A monitor displays output; the others are input devices." },
    { stem: "The full meaning of WWW is ________.", options: ["World Wide Web", "Western Website Works", "World Wing Web", "Wide World Wrestling"], correct: 0, rationale: "WWW stands for World Wide Web." },
    { stem: "A set of rules that governs data exchange between computers is called a ________.", options: ["Protocol", "Program", "Password", "Path"], correct: 0, rationale: "A protocol defines rules for data communication (e.g., HTTP, TCP/IP)." },
    { stem: "Which storage device has the largest capacity?", options: ["Floppy disk", "Compact disc", "Hard disk drive", "USB flash drive"], correct: 2, rationale: "Hard disk drives typically have the largest storage capacity among these options." },
    { stem: "The 'S' in HTTPS stands for ________.", options: ["Simple", "Secure", "System", "Standard"], correct: 1, rationale: "HTTPS is HTTP with encryption for secure communication." },
    { stem: "Which of these is a search engine?", options: ["Microsoft Word", "Google", "Adobe Reader", "VLC Player"], correct: 1, rationale: "Google is a search engine for finding information on the web." },
    { stem: "A computer virus is a ________.", options: ["Hardware component", "Type of monitor", "Harmful program", "Keyboard shortcut"], correct: 2, rationale: "A computer virus is a malicious software program designed to cause harm." },
  ],
  bst: [
    { stem: "The way an individual holds his or her body while standing, sitting, or moving is called ________.", options: ["Posture", "Exercise", "Gymnastics", "Flexibility"], correct: 0, rationale: "Posture refers to the position in which someone holds their body." },
    { stem: "Which postural defect is characterised by an excessive outward curve of the upper back (hunchback)?", options: ["Scoliosis", "Kyphosis", "Lordosis", "Flat foot"], correct: 1, rationale: "Kyphosis is the excessive outward curvature of the thoracic spine." },
    { stem: "The immediate temporary care given to an injured person before professional medical help arrives is called ________.", options: ["Hospitalisation", "Surgery", "First Aid", "Vaccination"], correct: 2, rationale: "First Aid is emergency care before professional medical help arrives." },
    { stem: "What does ABC stand for in First Aid?", options: ["Accuracy, Balance, Care", "Action, Blood, Circulation", "Airway, Breathing, Circulation", "Accident, Breath, Cold"], correct: 2, rationale: "ABC = Airway, Breathing, Circulation — the priority sequence in emergencies." },
    { stem: "Drug abuse is the ________.", options: ["Proper use of drugs", "Use of drugs as prescribed", "Excessive and wrong use of drugs", "Selling of drugs in a pharmacy"], correct: 2, rationale: "Drug abuse refers to the excessive or inappropriate use of drugs." },
    { stem: "Which Nigerian agency is responsible for drug law enforcement?", options: ["NAFDAC", "NDLEA", "EFCC", "ICPC"], correct: 1, rationale: "NDLEA (National Drug Law Enforcement Agency) combats drug trafficking and abuse." },
    { stem: "The 'Fosbury Flop' is a technique used in which athletic event?", options: ["Shot put", "High jump", "Long jump", "Javelin"], correct: 1, rationale: "The Fosbury Flop is a high jump technique where the jumper goes over backwards." },
    { stem: "A balanced diet contains ________.", options: ["Only carbohydrates", "Only proteins", "All nutrients in correct proportions", "Only vitamins"], correct: 2, rationale: "A balanced diet includes all essential nutrients in the right proportions." },
    { stem: "Which of these is a way to prevent the spread of germs?", options: ["Sharing towels", "Washing hands regularly", "Coughing openly", "Littering"], correct: 1, rationale: "Regular hand washing with soap reduces the spread of germs." },
    { stem: "The game of basketball was invented by ________.", options: ["James Naismith", "William Morgan", "Isaac Newton", "Pele"], correct: 0, rationale: "James Naismith invented basketball in 1891." },
  ],
};

function mcqFromPool(
  poolKey: string, cls: string, index: number, marks: number, difficulty: string,
): Record<string, unknown> {
  const pool = mcqPools[poolKey] ?? mcqPools.english;
  const q = pool[index % pool.length];
  const opts = q.options.map((text, i) => ({
    label: String.fromCharCode(65 + i),
    text,
    is_correct: i === q.correct,
  }));
  return {
    question_text: q.stem,
    marks,
    difficulty,
    options: opts,
    rationale: q.rationale,
    grounding_summary: { target_grounding_percentage: 75, grounded_count: 1, extension_count: 0 },
  };
}

function mcqEnglish(cls: string, i: number, m: number, d: string) { return mcqFromPool("english", cls, i, m, d); }
function mcqMaths(cls: string, i: number, m: number, d: string) { return mcqFromPool("maths", cls, i, m, d); }
function mcqScience(cls: string, i: number, m: number, d: string) { return mcqFromPool("science", cls, i, m, d); }
function mcqChemistry(cls: string, i: number, m: number, d: string) { return mcqFromPool("chemistry", cls, i, m, d); }
function mcqPhysics(cls: string, i: number, m: number, d: string) { return mcqFromPool("physics", cls, i, m, d); }
function mcqGovt(cls: string, i: number, m: number, d: string) { return mcqFromPool("govt", cls, i, m, d); }
function mcqHistory(cls: string, i: number, m: number, d: string) { return mcqFromPool("history", cls, i, m, d); }
function mcqGeography(cls: string, i: number, m: number, d: string) { return mcqFromPool("geography", cls, i, m, d); }
function mcqEconomics(cls: string, i: number, m: number, d: string) { return mcqFromPool("economics", cls, i, m, d); }
function mcqReligious(cls: string, i: number, m: number, d: string) { return mcqFromPool("religious", cls, i, m, d); }
function mcqAgric(cls: string, i: number, m: number, d: string) { return mcqFromPool("agric", cls, i, m, d); }
function mcqComputer(cls: string, i: number, m: number, d: string) { return mcqFromPool("computer", cls, i, m, d); }
function mcqBst(cls: string, i: number, m: number, d: string) { return mcqFromPool("bst", cls, i, m, d); }

function mcqGeneric(cls: string, _topic: string, _subject: string, i: number, marks: number, difficulty: string, _isSenior: boolean): Record<string, unknown> {
  return mcqFromPool("english", cls, i, marks, difficulty);
}

// --------------------------------------------------------------------------
// Essay (Theory) Banks — each returns one essay question with (a)(b)(c) sub-parts
// --------------------------------------------------------------------------

const essayPools: Record<string, { question: string; answer: string; rubric: { desc: string; mark: number }[] }[]> = {
  english: [
    {
      question: `Question 1 [6 marks]\n(a) Define the term 'noun' and give three examples. [2 marks]\n(b) List and explain the four types of nouns with two examples of each. [2 marks]\n(c) Write three sentences, each using a different type of noun correctly. [2 marks]`,
      answer: "(a) A noun is a name of a person, place, animal, thing, or idea. Examples: Lagos (place), Chiamaka (person), dog (animal). (b) The four types are: (i) Common noun — names general items (city, boy); (ii) Proper noun — names specific entities (Abuja, Tunde); (iii) Abstract noun — names ideas/feelings (love, courage); (iv) Collective noun — names groups (team, flock). (c) [Student sentences will vary — correct usage assessed.]",
      rubric: [
        { desc: "Correct definition of noun", mark: 1 },
        { desc: "Three valid examples of nouns", mark: 1 },
        { desc: "Four types of nouns listed and explained", mark: 1 },
        { desc: "Two correct examples per noun type", mark: 1 },
        { desc: "Three correct sentences each using a different noun type", mark: 2 },
      ],
    },
    {
      question: `Question 2 [6 marks]\n(a) Explain the difference between a simile and a metaphor, giving one example of each. [2 marks]\n(b) Identify the figure of speech in the following sentences: (i) 'The wind whispered through the trees.' (ii) 'I have told you a million times.' [2 marks]\n(c) Write two original sentences, one containing a simile and one containing a personification. [2 marks]`,
      answer: "(a) A simile compares two unlike things using 'like' or 'as' (e.g., 'Her smile is as bright as the sun'). A metaphor makes a direct comparison without 'like' or 'as' (e.g., 'Time is a thief'). (b)(i) Personification — the wind is given the human action of whispering. (ii) Hyperbole — exaggerated statement. (c) [Student originals assessed for correct usage.]",
      rubric: [
        { desc: "Correct definition of simile with example", mark: 1 },
        { desc: "Correct definition of metaphor with example", mark: 1 },
        { desc: "Correct identification of personification and hyperbole", mark: 2 },
        { desc: "Two original sentences with correct figures of speech", mark: 2 },
      ],
    },
    {
      question: `Question 3 [6 marks]\n(a) Define 'tenses' in English grammar. [1 mark]\n(b) Conjugate the verb 'go' in present, past, and future tenses using the first-person singular pronoun. [3 marks]\n(c) Write one sentence each in present continuous tense and past perfect tense. [2 marks]`,
      answer: "(a) Tense is the form of a verb that indicates the time of an action or state. (b) Present: I go / I am going; Past: I went / I was going; Future: I will go / I shall go. (c) Present continuous: 'She is reading her textbook.' Past perfect: 'He had finished his homework before the teacher arrived.'",
      rubric: [
        { desc: "Correct definition of tense", mark: 1 },
        { desc: "Correct present tense conjugation", mark: 1 },
        { desc: "Correct past tense conjugation", mark: 1 },
        { desc: "Correct future tense conjugation", mark: 1 },
        { desc: "Correct sentence in present continuous", mark: 1 },
        { desc: "Correct sentence in past perfect", mark: 1 },
      ],
    },
    {
      question: `Question 4 [6 marks]\n(a) What is a paragraph? [1 mark]\n(b) List and explain the three main parts of a well-structured paragraph. [3 marks]\n(c) Write a short paragraph of not less than five sentences on the topic: 'The importance of reading books.' [2 marks]`,
      answer: "(a) A paragraph is a group of related sentences about a single main idea. (b) The three parts are: (i) Topic sentence — states the main idea; (ii) Supporting sentences — develop the idea with details and examples; (iii) Concluding sentence — summarises or transitions. (c) [Student paragraph assessed for structure and content.]",
      rubric: [
        { desc: "Correct definition of a paragraph", mark: 1 },
        { desc: "Topic sentence correctly explained", mark: 1 },
        { desc: "Supporting sentences correctly explained", mark: 1 },
        { desc: "Concluding sentence correctly explained", mark: 1 },
        { desc: "Well-structured paragraph with at least five sentences on the given topic", mark: 2 },
      ],
    },
  ],
  maths: [
    {
      question: `Question 1 [6 marks]\n(a) Define a prime number and list all prime numbers between 1 and 20. [2 marks]\n(b) Express 72 as a product of its prime factors. [2 marks]\n(c) Find the Highest Common Factor (HCF) of 36 and 48. [2 marks]`,
      answer: "(a) A prime number is a number that has exactly two factors: 1 and itself. Prime numbers between 1 and 20: 2, 3, 5, 7, 11, 13, 17, 19. (b) 72 = 2 × 2 × 2 × 3 × 3 = 2³ × 3². (c) Factors of 36: 1,2,3,4,6,9,12,18,36. Factors of 48: 1,2,3,4,6,8,12,16,24,48. Common factors: 1,2,3,4,6,12. HCF = 12.",
      rubric: [
        { desc: "Correct definition of prime number", mark: 1 },
        { desc: "All prime numbers between 1 and 20 correctly listed", mark: 1 },
        { desc: "72 correctly expressed as product of prime factors", mark: 2 },
        { desc: "HCF of 36 and 48 correctly calculated", mark: 2 },
      ],
    },
    {
      question: `Question 2 [6 marks]\n(a) State the formula for the area of a triangle. [1 mark]\n(b) A triangle has a base of 10 cm and a height of 8 cm. Calculate its area. [2 marks]\n(c) If the area of a triangle is 30 cm² and its base is 6 cm, find the height. [3 marks]`,
      answer: "(a) Area = ½ × base × height. (b) Area = ½ × 10 × 8 = 40 cm². (c) 30 = ½ × 6 × h → 30 = 3h → h = 10 cm.",
      rubric: [
        { desc: "Correct formula for area of a triangle", mark: 1 },
        { desc: "Correct substitution into formula", mark: 1 },
        { desc: "Correct answer (40 cm²) with unit", mark: 1 },
        { desc: "Correct equation set up from given values", mark: 1 },
        { desc: "Correct algebraic manipulation", mark: 1 },
        { desc: "Correct final answer (10 cm) with unit", mark: 1 },
      ],
    },
  ],
  science: [
    {
      question: `Question 1 [6 marks]\n(a) Define photosynthesis. [1 mark]\n(b) List the four requirements for photosynthesis to take place. [2 marks]\n(c) Explain the importance of photosynthesis to: (i) plants, (ii) animals, (iii) the environment. [3 marks]`,
      answer: "(a) Photosynthesis is the process by which green plants use sunlight, water, and carbon dioxide to produce food (glucose) and oxygen. (b) Requirements: (i) Sunlight, (ii) Water, (iii) Carbon dioxide, (iv) Chlorophyll. (c) (i) Plants produce their own food for growth and energy. (ii) Animals depend on plants directly or indirectly for food. (iii) Plants release oxygen into the atmosphere and absorb carbon dioxide, maintaining the balance of gases.",
      rubric: [
        { desc: "Correct definition of photosynthesis", mark: 1 },
        { desc: "Four requirements correctly listed", mark: 2 },
        { desc: "Correct explanation of importance to plants", mark: 1 },
        { desc: "Correct explanation of importance to animals", mark: 1 },
        { desc: "Correct explanation of importance to the environment", mark: 1 },
      ],
    },
    {
      question: `Question 2 [6 marks]\n(a) Define a habitat. [1 mark]\n(b) Identify three types of habitats and give two examples of organisms found in each. [3 marks]\n(c) Explain how each habitat supports the survival of the organisms living in it. [2 marks]`,
      answer: "(a) A habitat is the natural home or environment where an organism lives. (b) (i) Aquatic habitat (water): fish, tilapia; (ii) Terrestrial habitat (land): goat, grass; (iii) Arboreal habitat (trees): monkey, bird. (c) Aquatic habitat provides oxygen dissolved in water and supports fish respiration; terrestrial habitat provides food and shelter; arboreal habitat offers protection from ground predators and access to fruits/leaves.",
      rubric: [
        { desc: "Correct definition of habitat", mark: 1 },
        { desc: "Three types of habitats correctly identified", mark: 1 },
        { desc: "Two valid organisms per habitat listed", mark: 2 },
        { desc: "Clear explanation of habitat suitability", mark: 2 },
      ],
    },
  ],
  agric: [
    {
      question: `Question 1 [6 marks]\n(a) Define a weed and give three examples of weeds commonly found on Nigerian farms. [2 marks]\n(b) List four methods of weed control and briefly explain one of them. [2 marks]\n(c) State two harmful effects of weeds on crop production. [2 marks]`,
      answer: "(a) A weed is any plant growing where it is not wanted. Examples: Spear grass, Tridax (coat buttons), Water hyacinth. (b) Methods: (i) Physical/Mechanical — using hoe or cutlass; (ii) Chemical — using herbicides; (iii) Cultural — crop rotation; (iv) Biological — using natural enemies. Physical method is the most common: weeds are manually removed using farm tools. (c) Harmful effects: (i) Weeds compete with crops for nutrients, water, and sunlight; (ii) Weeds harbour pests and diseases that attack crops.",
      rubric: [
        { desc: "Correct definition of a weed", mark: 1 },
        { desc: "Three valid examples of weeds", mark: 1 },
        { desc: "Four methods of weed control listed", mark: 1 },
        { desc: "One method clearly explained", mark: 1 },
        { desc: "Competition for nutrients and resources", mark: 1 },
        { desc: "Harbouring of pests and diseases", mark: 1 },
      ],
    },
    {
      question: `Question 2 [6 marks]\n(a) Define soil fertility. [1 mark]\n(b) List three methods a Nigerian farmer can use to maintain soil fertility. [3 marks]\n(c) Explain the importance of soil conservation to agricultural production in Nigeria. [2 marks]`,
      answer: "(a) Soil fertility is the ability of the soil to provide essential nutrients to plants for growth. (b) Methods: (i) Application of organic manure (animal droppings, compost); (ii) Crop rotation — planting different crops in sequence to avoid nutrient depletion; (iii) Use of inorganic fertilisers to supplement soil nutrients. (c) Soil conservation is vital because Nigerian agriculture depends heavily on the land. Without conservation, soil erosion and nutrient depletion will reduce crop yields, threatening food security and farmers' livelihoods.",
      rubric: [
        { desc: "Correct definition of soil fertility", mark: 1 },
        { desc: "Organic manure method described", mark: 1 },
        { desc: "Crop rotation method described", mark: 1 },
        { desc: "Fertiliser application method described", mark: 1 },
        { desc: "Explanation of why soil conservation matters for Nigeria", mark: 2 },
      ],
    },
    {
      question: `Question 3 [6 marks]\n(a) What is aquaculture? [1 mark]\n(b) List four types of fish commonly farmed in Nigeria. [2 marks]\n(c) Describe the steps involved in setting up a fish pond for catfish production. [3 marks]`,
      answer: "(a) Aquaculture is the farming of fish and other aquatic organisms in controlled environments. (b) Catfish, Tilapia, Carp, and Mudfish. (c) Steps: (i) Select a suitable site with good water supply; (ii) Construct the pond with proper inlet and outlet systems; (iii) Prepare the pond by clearing and applying lime; (iv) Fill the pond with clean water and allow it to stabilise; (v) Stock with healthy fingerlings and feed appropriately.",
      rubric: [
        { desc: "Correct definition of aquaculture", mark: 1 },
        { desc: "Four types of farmed fish listed", mark: 2 },
        { desc: "Site selection and pond construction described", mark: 1 },
        { desc: "Pond preparation and filling described", mark: 1 },
        { desc: "Stocking and feeding described", mark: 1 },
      ],
    },
  ],
  govt: [
    {
      question: `Question 1 [6 marks]\n(a) Define democracy. [1 mark]\n(b) List and explain four features of democratic government. [4 marks]\n(c) State one advantage and one disadvantage of democracy in Nigeria. [1 mark]`,
      answer: "(a) Democracy is a system of government in which the people exercise power directly or through elected representatives. (b) Features: (i) Regular free and fair elections; (ii) Rule of law — everyone is equal before the law; (iii) Fundamental human rights — freedom of speech, assembly, etc.; (iv) Separation of powers among executive, legislature, and judiciary. (c) Advantage: citizens have the right to choose their leaders. Disadvantage: elections can be expensive and sometimes marred by violence.",
      rubric: [
        { desc: "Correct definition of democracy", mark: 1 },
        { desc: "Free and fair elections explained", mark: 1 },
        { desc: "Rule of law explained", mark: 1 },
        { desc: "Fundamental human rights explained", mark: 1 },
        { desc: "Separation of powers explained", mark: 1 },
        { desc: "One advantage and one disadvantage stated", mark: 1 },
      ],
    },
    {
      question: `Question 2 [6 marks]\n(a) What is the constitution? [1 mark]\n(b) Explain the three arms of government in Nigeria and state the primary function of each. [3 marks]\n(c) Describe the relationship between the three arms of government in a presidential system. [2 marks]`,
      answer: "(a) A constitution is a body of rules and principles by which a country is governed. (b) (i) Executive — implements and enforces laws (President and ministers); (ii) Legislature — makes laws (National Assembly); (iii) Judiciary — interprets laws (courts). (c) The three arms work through a system of checks and balances. The legislature makes laws, the executive implements them but can be checked by the judiciary if laws are unconstitutional. The legislature can impeach the executive for serious violations.",
      rubric: [
        { desc: "Correct definition of constitution", mark: 1 },
        { desc: "Executive arm and its function explained", mark: 1 },
        { desc: "Legislative arm and its function explained", mark: 1 },
        { desc: "Judicial arm and its function explained", mark: 1 },
        { desc: "Checks and balances described", mark: 1 },
        { desc: "Specific examples of inter-arm relationships", mark: 1 },
      ],
    },
  ],
  chemistry: [
    {
      question: `Question 1 [6 marks]\n(a) Define an acid and a base. [2 marks]\n(b) State three properties of acids. [1.5 marks]\n(c) State three properties of bases. [1.5 marks]\n(d) Give one example each of a common acid and a common base found in a Nigerian home. [1 mark]`,
      answer: "(a) An acid is a substance that donates protons (H⁺ ions) in aqueous solution and has a pH below 7. A base is a substance that accepts protons or donates OH⁻ ions and has a pH above 7. (b) Properties of acids: sour taste, turn blue litmus red, corrosive. (c) Properties of bases: bitter taste, feel slippery, turn red litmus blue. (d) Acid: lemon juice (citric acid). Base: lime water (calcium hydroxide) used in making tuwo.",
      rubric: [
        { desc: "Correct definition of acid", mark: 1 },
        { desc: "Correct definition of base", mark: 1 },
        { desc: "Three properties of acids correctly listed", mark: 1.5 },
        { desc: "Three properties of bases correctly listed", mark: 1.5 },
        { desc: "Valid example of a common acid", mark: 0.5 },
        { desc: "Valid example of a common base", mark: 0.5 },
      ],
    },
    {
      question: `Question 2 [6 marks]\n(a) What is the pH scale and what range does it cover? [1 mark]\n(b) Classify the following substances as acidic, basic, or neutral: lemon juice, soap solution, pure water, vinegar. [2 marks]\n(c) Explain how a farmer can use knowledge of pH to improve crop yield on acidic soil. [3 marks]`,
      answer: "(a) The pH scale measures how acidic or basic a substance is, ranging from 0 (most acidic) to 14 (most basic), with 7 being neutral. (b) Lemon juice — acidic; Soap solution — basic; Pure water — neutral; Vinegar — acidic. (c) A farmer with acidic soil can apply lime (calcium carbonate) to neutralise the acidity, raising the pH to a level suitable for crop growth. Most Nigerian crops grow best at pH 6.0-7.5. The farmer should first test the soil pH using a soil testing kit.",
      rubric: [
        { desc: "Correct explanation of pH scale with range", mark: 1 },
        { desc: "Lemon juice correctly classified as acidic", mark: 0.5 },
        { desc: "Soap solution correctly classified as basic", mark: 0.5 },
        { desc: "Pure water correctly classified as neutral", mark: 0.5 },
        { desc: "Vinegar correctly classified as acidic", mark: 0.5 },
        { desc: "Correct explanation of liming to neutralise acidic soil", mark: 3 },
      ],
    },
  ],
  physics: [
    {
      question: `Question 1 [6 marks]\n(a) Define work and state its SI unit. [1 mark]\n(b) A boy of mass 50 kg climbs a flight of stairs of height 5 metres. Calculate the work done against gravity. (Take g = 10 m/s²) [3 marks]\n(c) If the boy takes 10 seconds to climb the stairs, calculate his power output. [2 marks]`,
      answer: "(a) Work is done when a force moves an object through a distance. The SI unit of work is the joule (J). (b) Work done against gravity = mgh = 50 × 10 × 5 = 2500 J. (c) Power = Work / Time = 2500 / 10 = 250 W.",
      rubric: [
        { desc: "Correct definition of work", mark: 1 },
        { desc: "Correct formula (mgh) written", mark: 1 },
        { desc: "Correct substitution (50 × 10 × 5)", mark: 1 },
        { desc: "Correct answer (2500 J) with unit", mark: 1 },
        { desc: "Correct formula (P = W/t)", mark: 1 },
        { desc: "Correct answer (250 W) with unit", mark: 1 },
      ],
    },
  ],
  history: [
    {
      question: `Question 1 [6 marks]\n(a) Define the term 'independence' as it applies to nations. [1 mark]\n(b) State the year Nigeria gained independence and name the country that colonised Nigeria. [1 mark]\n(c) List four factors that led to Nigeria's independence. [2 marks]\n(d) Name Nigeria's first Prime Minister and first President. [2 marks]`,
      answer: "(a) Independence is the state of a nation being self-governing and free from external control. (b) 1st October 1960; Great Britain (United Kingdom). (c) Factors: (i) Nationalist movements and pressure from leaders like Nnamdi Azikiwe and Obafemi Awolowo; (ii) Post-World War II decline of British colonial power; (iii) International pressure from the UN and other nations; (iv) The Macpherson and Lyttleton constitutions that increased Nigerian participation in governance. (d) Prime Minister: Sir Abubakar Tafawa Balewa; President: Dr Nnamdi Azikiwe.",
      rubric: [
        { desc: "Correct definition of independence", mark: 1 },
        { desc: "Correct year and colonising country", mark: 1 },
        { desc: "Nationalist movements correctly cited", mark: 0.5 },
        { desc: "Decline of British power cited", mark: 0.5 },
        { desc: "International pressure cited", mark: 0.5 },
        { desc: "Constitutional developments cited", mark: 0.5 },
        { desc: "Correct names of first Prime Minister and first President", mark: 2 },
      ],
    },
  ],
  geography: [
    {
      question: `Question 1 [6 marks]\n(a) Distinguish between weather and climate. [2 marks]\n(b) List four elements of weather and state one instrument used to measure each. [2 marks]\n(c) Describe how the location of Nigeria affects its climate. [2 marks]`,
      answer: "(a) Weather is the day-to-day condition of the atmosphere in a place, while climate is the average weather condition over a long period (usually 30-35 years). (b) (i) Temperature — thermometer; (ii) Rainfall — rain gauge; (iii) Wind direction — wind vane; (iv) Atmospheric pressure — barometer. (c) Nigeria lies between 4°N and 14°N, placing it in the tropics. This gives it a tropical climate with distinct wet and dry seasons. The Inter-Tropical Discontinuity (ITD) influences the movement of rain-bearing winds.",
      rubric: [
        { desc: "Correct definition of weather", mark: 1 },
        { desc: "Correct definition of climate", mark: 1 },
        { desc: "Four elements of weather with matching instruments", mark: 2 },
        { desc: "Nigeria's latitudinal position stated", mark: 1 },
        { desc: "Link to tropical climate explained", mark: 1 },
      ],
    },
  ],
  economics: [
    {
      question: `Question 1 [6 marks]\n(a) Define scarcity and opportunity cost. [2 marks]\n(b) Explain how a student sitting a WAEC examination faces the concept of opportunity cost. [2 marks]\n(c) List and briefly explain the four basic economic problems faced by every society. [2 marks]`,
      answer: "(a) Scarcity is the limited nature of resources relative to unlimited human wants. Opportunity cost is the value of the next best alternative forgone when a choice is made. (b) A student who chooses to spend time studying Economics instead of Mathematics has an opportunity cost of the knowledge they would have gained from studying Mathematics. Time is the scarce resource here. (c) (i) What to produce — due to limited resources, every society must choose which goods to produce; (ii) How to produce — the method of production (labour-intensive vs capital-intensive); (iii) For whom to produce — who gets the goods; (iv) How much to produce — the quantity of goods.",
      rubric: [
        { desc: "Correct definition of scarcity", mark: 1 },
        { desc: "Correct definition of opportunity cost", mark: 1 },
        { desc: "Clear example of opportunity cost in the WAEC context", mark: 2 },
        { desc: "Four basic economic problems identified", mark: 1 },
        { desc: "Each problem briefly explained", mark: 1 },
      ],
    },
  ],
  religious: [
    {
      question: `Question 1 [6 marks]\n(a) Define faith according to the Bible. [1 mark]\n(b) Using the story of Abraham, explain how faith is demonstrated. [3 marks]\n(c) State two lessons Christians can learn from Abraham's example of faith. [2 marks]`,
      answer: "(a) According to Hebrews 11:1, 'Faith is the substance of things hoped for, the evidence of things not seen.' (b) Abraham demonstrated faith by: (i) Leaving his home in Ur at God's command without knowing where he was going; (ii) Believing God's promise that he would have a son even though he and Sarah were very old; (iii) Being willing to sacrifice Isaac, his only son, when God tested him. (c) (i) True faith requires action, not just belief; (ii) God rewards those who trust and obey Him even when the circumstances seem impossible.",
      rubric: [
        { desc: "Correct biblical definition of faith (Hebrews 11:1)", mark: 1 },
        { desc: "Abraham's willingness to leave home", mark: 1 },
        { desc: "Abraham's belief in God's promise of a son", mark: 1 },
        { desc: "Abraham's willingness to sacrifice Isaac", mark: 1 },
        { desc: "Lesson about faith requiring action", mark: 1 },
        { desc: "Lesson about God rewarding trust", mark: 1 },
      ],
    },
  ],
  computer: [
    {
      question: `Question 1 [6 marks]\n(a) Define a computer and state its four main functions. [2 marks]\n(b) List and explain four types of computers based on size and processing power. [2 marks]\n(c) Describe two areas where computers are used in Nigeria and the benefits they provide. [2 marks]`,
      answer: "(a) A computer is an electronic device that accepts data as input, processes it, and produces information as output. Functions: Input, Processing, Output, and Storage. (b) (i) Microcomputer (PC) — personal use; (ii) Minicomputer — medium-sized organisations; (iii) Mainframe — large organisations like banks; (iv) Supercomputer — complex scientific calculations. (c) (i) Banking: computers enable online banking, ATM transactions, and account management, making banking faster and more convenient for Nigerians. (ii) Education: computers enable e-learning platforms like the one used in this school for record-keeping and lesson delivery.",
      rubric: [
        { desc: "Correct definition of a computer", mark: 1 },
        { desc: "Four main functions correctly stated", mark: 1 },
        { desc: "Microcomputer correctly described", mark: 0.5 },
        { desc: "Mainframe correctly described", mark: 0.5 },
        { desc: "Supercomputer correctly described", mark: 0.5 },
        { desc: "Minicomputer correctly described", mark: 0.5 },
        { desc: "Computer use in banking with benefit", mark: 1 },
        { desc: "Computer use in education with benefit", mark: 1 },
      ],
    },
  ],
  bst: [
    {
      question: `Question 1 [6 marks]\n(a) What is First Aid? [1 mark]\n(b) List the contents of a standard First Aid box and state the use of any four items. [3 marks]\n(c) Describe the steps you would take if you find an unconscious person at school. [2 marks]`,
      answer: "(a) First Aid is the immediate temporary care given to an injured or suddenly ill person before professional medical help arrives. (b) Contents: (i) Methylated spirit/antiseptic — cleaning wounds; (ii) Cotton wool — applying antiseptic; (iii) Bandages — dressing wounds; (iv) Plaster — covering small cuts; (v) Scissors — cutting bandages; (vi) Clinical thermometer — checking temperature. (c) Steps: (i) Check the scene for safety; (ii) Check if the person responds (tap and shout); (iii) If no response, shout for help; (iv) Check airway, breathing, and circulation (ABC); (v) If not breathing normally, begin CPR and call emergency services.",
      rubric: [
        { desc: "Correct definition of First Aid", mark: 1 },
        { desc: "At least four First Aid box items listed", mark: 1 },
        { desc: "Correct uses of four items explained", mark: 2 },
        { desc: "Scene safety checked and response checked", mark: 1 },
        { desc: "ABC sequence followed correctly", mark: 1 },
      ],
    },
    {
      question: `Question 2 [6 marks]\n(a) Define posture. [1 mark]\n(b) List and describe three common postural defects. [3 marks]\n(c) State three ways to maintain good posture as a student. [2 marks]`,
      answer: "(a) Posture is the way an individual holds his or her body while standing, sitting, or moving. (b) (i) Kyphosis (hunchback) — excessive outward curve of the upper back, often caused by slouching; (ii) Lordosis (swayback) — exaggerated inward curve of the lower back, common in pregnant women and people who carry heavy bellies; (iii) Scoliosis — lateral or sideways curvature of the spine, often detected during school screening. (c) (i) Sit upright with your back straight and shoulders back when reading or writing; (ii) Carry school bags evenly on both shoulders, not slung over one shoulder; (iii) Avoid sleeping on very soft mattresses that do not support the spine.",
      rubric: [
        { desc: "Correct definition of posture", mark: 1 },
        { desc: "Kyphosis correctly described", mark: 1 },
        { desc: "Lordosis correctly described", mark: 1 },
        { desc: "Scoliosis correctly described", mark: 1 },
        { desc: "Sitting correctly with back straight", mark: 1 },
        { desc: "Even bag carrying and proper sleeping surface", mark: 1 },
      ],
    },
    {
      question: `Question 3 [6 marks]\n(a) Define drug abuse. [1 mark]\n(b) List four substances commonly abused by young people in Nigeria. [2 marks]\n(c) Explain three consequences of drug abuse on the individual and society. [3 marks]`,
      answer: "(a) Drug abuse is the excessive or inappropriate use of drugs (legal or illegal) without medical supervision. (b) (i) Alcohol; (ii) Cigarettes/tobacco; (iii) Cannabis (marijuana); (iv) Codeine-containing cough syrups. (c) (i) Health problems — drug abuse can cause liver damage, mental illness, and organ failure. (ii) Academic decline — students who abuse drugs often perform poorly in school. (iii) Social consequences — drug abuse leads to crime, family breakdown, and financial loss for individuals and society.",
      rubric: [
        { desc: "Correct definition of drug abuse", mark: 1 },
        { desc: "Four commonly abused substances listed", mark: 2 },
        { desc: "Health consequences explained", mark: 1 },
        { desc: "Academic consequences explained", mark: 1 },
        { desc: "Social consequences explained", mark: 1 },
      ],
    },
  ],
};

function essayFromPool(
  poolKey: string, _cls: string, _topic: string, index: number, marks: number, difficulty: string,
): Record<string, unknown> {
  const pool = essayPools[poolKey] ?? essayPools.english;
  const q = pool[index % pool.length];
  const rubric = q.rubric.map((r) => ({
    description: r.desc,
    marks: r.mark,
    source_type: "grounded" as const,
    lesson_note_reference: "From the Content section of the lesson note",
  }));
  return {
    question_text: q.question,
    marks,
    difficulty,
    model_answer: q.answer,
    rubric_points: rubric,
    grounding_summary: { target_grounding_percentage: 75, actual_grounded_points: rubric.length, actual_extension_points: 0 },
  };
}

function essayEnglish(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("english", cls, topic, i, m, d); }
function essayMaths(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("maths", cls, topic, i, m, d); }
function essayScience(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("science", cls, topic, i, m, d); }
function essayChemistry(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("chemistry", cls, topic, i, m, d); }
function essayPhysics(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("physics", cls, topic, i, m, d); }
function essayGovt(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("govt", cls, topic, i, m, d); }
function essayHistory(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("history", cls, topic, i, m, d); }
function essayGeography(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("geography", cls, topic, i, m, d); }
function essayEconomics(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("economics", cls, topic, i, m, d); }
function essayReligious(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("religious", cls, topic, i, m, d); }
function essayAgric(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("agric", cls, topic, i, m, d); }
function essayComputer(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("computer", cls, topic, i, m, d); }
function essayBst(cls: string, topic: string, i: number, m: number, d: string) { return essayFromPool("bst", cls, topic, i, m, d); }

function essayGeneric(cls: string, _topic: string, _subject: string, i: number, marks: number, difficulty: string, _isSenior: boolean): Record<string, unknown> {
  return essayFromPool("english", cls, _topic, i, marks, difficulty);
}

/**
 * Core entry point. Callers pass task type + messages; the gateway handles
 * provider selection, retries, timeout, and (later) logging to AI Call Log.
 */
export async function createCompletion(
  opts: AiCompletionOptions,
): Promise<AiCompletionResult> {
  const envCfg = loadConfig();
  const cfg = envCfg.mock ? envCfg : await loadBestConfig();

  if (cfg.mock) {
    return mockCompletion(opts);
  }

  if (!cfg.baseUrl || !cfg.apiKey) {
    throw new AiGatewayError(
      "AI provider is not configured. Go to Console → AI Config to set one up, or configure AI_BASE_URL/AI_API_KEY in .env.",
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
          max_tokens: opts.maxTokens ?? 4096,
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
