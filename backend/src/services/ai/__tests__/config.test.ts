import { loadAiConfig } from '../config';

describe('loadAiConfig', () => {
  it('defaults to the mock provider, 30s timeout, no repair retries', () => {
    const c = loadAiConfig({});
    expect(c.provider).toBe('mock');
    expect(c.timeoutMs).toBe(30_000);
    expect(c.maxInputChars).toBe(20_000);
    expect(c.maxRepairAttempts).toBe(0);
  });
  it('reads a custom timeout from the environment', () => {
    expect(loadAiConfig({ AI_TIMEOUT_MS: '45000' }).timeoutMs).toBe(45_000);
  });
  it('requires an API key and model for gemini', () => {
    expect(() => loadAiConfig({ AI_PROVIDER: 'gemini' })).toThrow(/GEMINI_API_KEY/);
    expect(() => loadAiConfig({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' })).toThrow(/GEMINI_MODEL/);
    expect(loadAiConfig({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' }).provider).toBe('gemini');
  });
  it('rejects unknown providers and bad numbers', () => {
    expect(() => loadAiConfig({ AI_PROVIDER: 'openai' })).toThrow();
    expect(() => loadAiConfig({ AI_TIMEOUT_MS: 'abc' })).toThrow();
    expect(() => loadAiConfig({ AI_MAX_REPAIR_ATTEMPTS: '5' })).toThrow();
  });
});
