/**
 * PUBLIC API of the AI module. Member 3 only needs:
 *
 *   import { analyzeCode, isAiError, getAiStatus } from './services/ai';
 *
 *   try {
 *     const { review, meta } = await analyzeCode({ code, language: 'typescript', filename });
 *     res.json({ review, meta });
 *   } catch (err) {
 *     if (isAiError(err)) return res.status(err.httpStatus).json({ code: err.code, message: err.message });
 *     throw err;
 *   }
 */
import { CodeAnalyzer, type AnalyzeInput, type AnalyzeResult } from './analyzer';
import { loadAiConfig, type AiConfig } from './config';
import { GeminiProvider } from './geminiProvider';
import { consoleLogger, type Logger } from './logger';
import { MockProvider } from './mockProvider';
import type { AiProvider } from './provider';
import { UsageTracker, type UsageSnapshot } from './usage';

export { isAiError, AiError } from './errors';
export type { AiErrorCode } from './errors';
export type { AnalyzeInput, AnalyzeResult } from './analyzer';
export type { Review, Finding, CategoryKey } from './schema';
export { reviewSchema, CATEGORY_KEYS } from './schema';
export { toFrontendReview } from './frontendDto';
export type { FrontendReview, ToFrontendOptions } from './frontendDto';

const usage = new UsageTracker();
let analyzer: CodeAnalyzer | undefined;
let activeConfig: AiConfig | undefined;

export function createProvider(config: AiConfig, logger: Logger = consoleLogger, tracker: UsageTracker = usage): AiProvider {
  if (config.provider === 'gemini') {
    return new GeminiProvider({
      apiKey: config.geminiApiKey!,
      model: config.geminiModel!,
      baseUrl: config.geminiBaseUrl,
      quotaCooldownMs: config.quotaCooldownMs,
      usage: tracker,
      logger,
    });
  }
  return new MockProvider();
}

/** Built lazily on the first analysis request, never at server start, so nothing is called automatically. */
function getAnalyzer(): CodeAnalyzer {
  if (!analyzer) {
    activeConfig = loadAiConfig();
    analyzer = new CodeAnalyzer({ provider: createProvider(activeConfig), config: activeConfig });
  }
  return analyzer;
}

export function analyzeCode(input: AnalyzeInput): Promise<AnalyzeResult> {
  return getAnalyzer().analyze(input);
}

/** Safe to expose on a /health or /ai/status route. Contains no secrets and no code. */
export function getAiStatus(): { provider: string; usage: UsageSnapshot } {
  let provider = activeConfig?.provider;
  if (!provider) {
    try {
      provider = loadAiConfig().provider;
    } catch {
      provider = undefined;
    }
  }
  return { provider: provider ?? 'unconfigured', usage: usage.snapshot() };
}

/** For tests only. */
export function resetAiModuleForTests(): void {
  analyzer = undefined;
  activeConfig = undefined;
}

export { CodeAnalyzer, MockProvider, GeminiProvider, UsageTracker, loadAiConfig };
