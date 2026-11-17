import type { AiConfig } from '../config';
import { silentLogger } from '../logger';
import { CodeAnalyzer } from '../analyzer';
import type { AiProvider } from '../provider';

export const baseConfig: AiConfig = {
  provider: 'mock',
  geminiBaseUrl: 'https://example.invalid/v1beta',
  timeoutMs: 30_000,
  maxInputChars: 20_000,
  maxRepairAttempts: 0,
  quotaCooldownMs: 300_000,
};

export function makeAnalyzer(provider: AiProvider, overrides: Partial<AiConfig> = {}) {
  return new CodeAnalyzer({ provider, config: { ...baseConfig, ...overrides }, logger: silentLogger });
}

/** A provider that returns whatever text we script, and counts calls. */
export function scriptedProvider(replies: Array<string | Error>): AiProvider & { calls: number } {
  const p = {
    name: 'scripted',
    calls: 0,
    async generate(): Promise<string> {
      const r = replies[Math.min(p.calls, replies.length - 1)];
      p.calls += 1;
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return p;
}
