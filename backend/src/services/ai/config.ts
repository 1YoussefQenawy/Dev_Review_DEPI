import { AiError } from './errors';

export type ProviderName = 'mock' | 'gemini';

export interface AiConfig {
  provider: ProviderName;
  geminiApiKey?: string;
  geminiModel?: string;
  geminiBaseUrl: string;
  timeoutMs: number;
  maxInputChars: number;
  /** Extra Gemini calls allowed ONLY when the reply was invalid JSON. 0 or 1. */
  maxRepairAttempts: number;
  quotaCooldownMs: number;
}

type Env = Record<string, string | undefined>;

function intFromEnv(env: Env, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new AiError('PROVIDER_NOT_CONFIGURED', `${name} must be a whole number between ${min} and ${max}.`);
  }
  return n;
}

/**
 * Reads settings from environment variables.
 * Default provider is "mock", so nothing ever calls Gemini unless someone deliberately sets AI_PROVIDER=gemini.
 */
export function loadAiConfig(env: Env = process.env): AiConfig {
  const provider = (env.AI_PROVIDER?.trim().toLowerCase() || 'mock') as string;
  if (provider !== 'mock' && provider !== 'gemini') {
    throw new AiError('PROVIDER_NOT_CONFIGURED', 'AI_PROVIDER must be "mock" or "gemini".');
  }

  const config: AiConfig = {
    provider,
    geminiApiKey: env.GEMINI_API_KEY?.trim() || undefined,
    geminiModel: env.GEMINI_MODEL?.trim() || undefined,
    geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    timeoutMs: intFromEnv(env, 'AI_TIMEOUT_MS', 300_000, 1_000, 600_000),
    maxInputChars: intFromEnv(env, 'AI_MAX_INPUT_CHARS', 100_000, 100, 500_000),
    maxRepairAttempts: intFromEnv(env, 'AI_MAX_REPAIR_ATTEMPTS', 0, 0, 1),
    quotaCooldownMs: intFromEnv(env, 'AI_QUOTA_COOLDOWN_MS', 300_000, 0, 86_400_000),
  };

  if (provider === 'gemini') {
    if (!config.geminiApiKey) {
      throw new AiError('PROVIDER_NOT_CONFIGURED', 'AI_PROVIDER=gemini but GEMINI_API_KEY is not set.');
    }
    if (!config.geminiModel) {
      throw new AiError('PROVIDER_NOT_CONFIGURED', 'AI_PROVIDER=gemini but GEMINI_MODEL is not set.');
    }
  }
  return config;
}
