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
 */
function mockCompletion(opts: AiCompletionOptions): AiCompletionResult {
  const last = opts.messages[opts.messages.length - 1]?.content ?? "";
  const content = `[[MOCK:${opts.taskType}]] ` + last.slice(0, 400);
  return {
    content,
    model: opts.model ?? loadConfig().defaultModel,
    promptTokens: null,
    completionTokens: null,
    latencyMs: 1,
    mocked: true,
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
