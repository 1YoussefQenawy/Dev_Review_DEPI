import type { AiConfig } from './config';
import { AiError } from './errors';
import { consoleLogger, type Logger } from './logger';
import { buildRepairPrompt, buildUserPrompt, SYSTEM_INSTRUCTION } from './prompt';
import type { AiProvider } from './provider';
import { reviewSchema, type Review } from './schema';

export interface AnalyzeInput {
  code: string;
  language?: string;
  filename?: string;
}

export interface AnalyzeResult {
  review: Review;
  meta: { provider: string; durationMs: number; providerCalls: number };
}

export type SupportedLanguage = 'javascript' | 'typescript';

const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  js: 'javascript', javascript: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', typescript: 'typescript', tsx: 'typescript',
};

export function resolveLanguage(language?: string, filename?: string): SupportedLanguage {
  const fromName = filename?.includes('.') ? filename.split('.').pop() : undefined;
  const raw = (language ?? fromName ?? '').trim().toLowerCase();
  const resolved = LANGUAGE_ALIASES[raw];
  if (!resolved) {
    throw new AiError('UNSUPPORTED_LANGUAGE', 'Only JavaScript and TypeScript code can be analyzed.');
  }
  return resolved;
}

/** Turns the model's raw text into an object. Tolerates ```json fences, nothing else. */
export function parseModelJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) t = fence[1];
  try {
    return JSON.parse(t);
  } catch {
    throw new AiError('INVALID_RESPONSE', 'The AI reply was not valid JSON.');
  }
}

export class CodeAnalyzer {
  private readonly provider: AiProvider;
  private readonly config: AiConfig;
  private readonly logger: Logger;

  constructor(deps: { provider: AiProvider; config: AiConfig; logger?: Logger }) {
    this.provider = deps.provider;
    this.config = deps.config;
    this.logger = deps.logger ?? consoleLogger;
  }

  /**
   * Runs ONE analysis. Called only when a user explicitly asks for it.
   * Provider calls: exactly 1, plus at most `maxRepairAttempts` more, and only if the reply
   * was not valid JSON / not matching the schema. Quota, timeout and network errors are never retried.
   */
  async analyze(input: AnalyzeInput): Promise<AnalyzeResult> {
    if (!input || typeof input.code !== 'string' || input.code.trim() === '') {
      throw new AiError('INVALID_INPUT', 'No code was provided to analyze.');
    }
    if (input.code.length > this.config.maxInputChars) {
      throw new AiError('INPUT_TOO_LARGE', `The code is too large. The limit is ${this.config.maxInputChars} characters.`);
    }
    const language = resolveLanguage(input.language, input.filename);

    const basePrompt = buildUserPrompt(input.code, language, input.filename);
    const started = Date.now();
    let prompt = basePrompt;
    let calls = 0;
    let lastProblem = '';

    for (let attempt = 0; attempt <= this.config.maxRepairAttempts; attempt++) {
      calls += 1;
      const raw = await this.provider.generate({
        systemInstruction: SYSTEM_INSTRUCTION,
        userPrompt: prompt,
        timeoutMs: this.config.timeoutMs,
        code: input.code,
        language,
      });

      try {
        const parsed = parseModelJson(raw);
        const result = reviewSchema.safeParse(parsed);
        if (result.success) {
          const durationMs = Date.now() - started;
          this.logger.info('Analysis completed', { provider: this.provider.name, providerCalls: calls, durationMs });
          return { review: result.data, meta: { provider: this.provider.name, durationMs, providerCalls: calls } };
        }
        lastProblem = result.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; ');
      } catch (err) {
        if (!(err instanceof AiError)) throw err;
        lastProblem = err.message;
      }

      this.logger.warn('AI reply rejected by validation', { attempt: attempt + 1 });
      prompt = buildRepairPrompt(basePrompt, lastProblem);
    }

    throw new AiError('INVALID_RESPONSE', 'The AI returned a review in an unexpected format. Please try again.');
  }
}
