# 11 — AI Integration

## 1. Design principle

**`src/lib/ai/gateway.ts` is the SINGLE place that talks to an AI provider.** No module may instantiate a provider SDK or hardcode a base URL/model. All AI features route through the gateway:

- Lesson note generation
- Question generation
- Essay grading
- Comment drafting
- Curriculum parsing

## 2. Gateway API

```ts
type AiTaskType =
  | "lesson_note_generation"
  | "question_generation"
  | "essay_grading"
  | "comment_drafting"
  | "curriculum_parsing";

interface AiCompletionOptions {
  taskType: AiTaskType;
  messages: AiMessage[];            // { role: "system"|"user"|"assistant", content }
  model?: string;                    // per-task override → AI_DEFAULT_MODEL
  temperature?: number;
  maxTokens?: number;
  schoolId?: string;                 // cost/usage attribution
}

interface AiCompletionResult {
  content: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  mocked: boolean;
}
```

## 3. Provider resolution order

1. **DB-configured providers** — active `AiProviderConfig` rows, sorted by `priority` asc (1 = default, tried first). Keys are decrypted from `apiKeyEncrypted` via `src/lib/secrets.ts`.
2. **Environment fallback** — `AI_BASE_URL` + `AI_API_KEY` + `AI_DEFAULT_MODEL`.

The provider is assumed to expose an **OpenAI-compatible `/chat/completions`** interface (OpenRouter and most providers do).

## 4. Failover, retries & timeouts

`gateway.ts` implements:

- **Provider priority stack** — tries providers in order with silent failover (if the default provider errors, it falls through to the next in the stack).
- **Retries** — `MAX_RETRIES = 3` with exponential backoff (`BASE_BACKOFF_MS = 500`).
- **Timeout** — `REQUEST_TIMEOUT_MS = 120_000`.

Errors surface as `AiGatewayError` (message + optional detail).

## 5. Mock mode (development)

When `AI_MOCK=true` (or when no provider is configured), the gateway returns a **deterministic mock** result instead of calling a provider. This lets AI features be developed and tested without cost or network. The mock is task-aware:

- **Lesson notes**: produces realistic, subject-specific content (English, Maths, Science, Chemistry, Physics, Government, History, Geography, Economics, Languages, Religious Studies, Agric, Computer, etc.) in the exact lesson-note JSON schema — useful because `AI_MOCK=true` is the default in `.env.example`.
- **Questions**: generates Nigerian-standard MCQ/essay questions with plausible distractors and a grounded/extension split.
- **Curriculum parsing**: returns sample week/topic/subTopics/objectives JSON.

`AiCompletionResult.mocked` tells callers whether a mock was used.

> Tip: `AI_MOCK=true` in `.env.example` is intentional — first-time setup works without an API key. Switch to `false` and add a key to test real calls.

## 6. AI configuration (Console)

Platform Owner console:

- `/console/ai` — manage providers (`AiProviderConfig`), task profiles (`AiTaskProfile`), enable/disable.
- `/console/ai/call-log` — telemetry per AI call: tokens, latency, status, error (`AiCallLog`).

Models:

| Model | Purpose |
|---|---|
| `AiProviderConfig` | endpoint, encrypted API key, default model, priority, active |
| `AiTaskProfile` | per-task model override, temperature, max tokens, prompt template |
| `AiCallLog` | telemetry per call (school attribution via `schoolId`) |

## 7. At-rest key encryption — `src/lib/secrets.ts`

Provider API keys are **encrypted at rest** before being written to the DB (AES-256-GCM):

- `encryptSecret(plaintext) → "enc:v1:<iv>.<tag>.<ciphertext>"`
- `decryptSecret(stored) → plaintext` (legacy plaintext values are returned unchanged)
- `isEncryptedSecret(stored)` — true when already encrypted.
- The encryption key is derived from `ENCRYPTION_KEY`, falling back to `AUTH_SECRET`.

> **Warning:** if you change `ENCRYPTION_KEY`/`AUTH_SECRET`, previously stored encrypted secrets become undecryptable (the helper throws). Rotate keys only with a migration plan.
>
> `npm run db:encrypt-ai-keys` converts any legacy plain-text AI keys still stored in the DB.

## 8. Where AI is consumed

| Feature | Caller | Notes |
|---|---|---|
| Lesson notes | `src/app/(app)/lesson-notes` + `src/lib/ai/class-level-guidance.ts` | Ordered by curriculum week |
| Question generation | question-bank UI → gateway | MCQs + essays |
| Essay grading | `src/lib/exams/essay-grading.ts` | AI-suggested score + rubric match; teacher confirms via `ManualScore` override |
| Comment drafting | results/remarks | Uses `comment_drafting` task |
| Curriculum parsing | syllabus uploads | Uses `curriculum_parsing` task |

## 9. Gotchas

- Always call through the gateway — never hardcode a model/base URL in a feature module.
- Pass `schoolId` for call-log attribution.
- Handle `AiGatewayError` gracefully in UI (show a friendly message; offer mock/retry).
- Keep `AI_MOCK` toggled off in production unless intentionally testing.
- Do not log prompt contents or decrypted keys.