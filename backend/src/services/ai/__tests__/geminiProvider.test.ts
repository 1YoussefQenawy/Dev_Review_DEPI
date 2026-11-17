import { AiError } from '../errors';
import { GeminiProvider } from '../geminiProvider';
import type { Logger } from '../logger';
import { UsageTracker } from '../usage';

const SECRET = 'AIza-super-secret-key';
const SECRET_CODE = 'const topSecretBusinessLogic = 42;';

function setup(fetchImpl: typeof fetch, cooldown = 300_000) {
  const logs: string[] = [];
  const logger: Logger = {
    info: (m, meta) => logs.push(m + JSON.stringify(meta ?? {})),
    warn: (m, meta) => logs.push(m + JSON.stringify(meta ?? {})),
    error: (m, meta) => logs.push(m + JSON.stringify(meta ?? {})),
  };
  const usage = new UsageTracker();
  const provider = new GeminiProvider({ apiKey: SECRET, model: 'test-model', baseUrl: 'https://example.invalid/v1beta', quotaCooldownMs: cooldown, usage, logger, fetchImpl });
  return { provider, usage, logs };
}

const req = { systemInstruction: 'sys', userPrompt: SECRET_CODE, timeoutMs: 1000, code: SECRET_CODE, language: 'javascript' as const };
const okBody = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"a":1}' }] } }] };
const jsonRes = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

describe('GeminiProvider', () => {
  it('sends exactly one request and returns the text', async () => {
    const f = jest.fn().mockResolvedValue(jsonRes(okBody));
    const { provider, usage } = setup(f);
    await expect(provider.generate(req)).resolves.toBe('{"a":1}');
    expect(f).toHaveBeenCalledTimes(1);
    expect(usage.snapshot()).toEqual({ geminiRequests: 1, succeeded: 1, failed: 0, quotaExceeded: 0 });
    expect(f.mock.calls[0][1].headers['x-goog-api-key']).toBe(SECRET);
  });

  it('turns HTTP 429 into QUOTA_EXCEEDED and does not retry', async () => {
    const f = jest.fn().mockResolvedValue(jsonRes({}, 429));
    const { provider, usage } = setup(f);
    await expect(provider.generate(req)).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED', httpStatus: 429 });
    expect(f).toHaveBeenCalledTimes(1);
    expect(usage.snapshot().quotaExceeded).toBe(1);
  });

  it('blocks further calls during the cooldown after a 429 (no request is sent)', async () => {
    const f = jest.fn().mockResolvedValue(jsonRes({}, 429));
    const { provider } = setup(f);
    await expect(provider.generate(req)).rejects.toBeInstanceOf(AiError);
    await expect(provider.generate(req)).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
    await expect(provider.generate(req)).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('maps an abort to TIMEOUT', async () => {
    const f = jest.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(setup(f).provider.generate(req)).rejects.toMatchObject({ code: 'TIMEOUT', httpStatus: 504 });
  });

  it('actually times out a hanging request using AI timeout', async () => {
    const f = jest.fn((_url: unknown, init: RequestInit) =>
      new Promise<Response>((_res, rej) => {
        init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      })) as unknown as typeof fetch;
    await expect(setup(f).provider.generate({ ...req, timeoutMs: 20 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('maps network failure and 5xx to PROVIDER_UNAVAILABLE', async () => {
    await expect(setup(jest.fn().mockRejectedValue(new TypeError('fetch failed'))).provider.generate(req)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    await expect(setup(jest.fn().mockResolvedValue(jsonRes({}, 503))).provider.generate(req)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });

  it('maps 400/403 to PROVIDER_NOT_CONFIGURED and 404 to a model hint', async () => {
    await expect(setup(jest.fn().mockResolvedValue(jsonRes({}, 403))).provider.generate(req)).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });
    await expect(setup(jest.fn().mockResolvedValue(jsonRes({}, 404))).provider.generate(req)).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED', message: expect.stringContaining('GEMINI_MODEL') });
  });

  it('rejects empty, truncated and blocked replies as INVALID_RESPONSE', async () => {
    for (const body of [
      { candidates: [{ content: { parts: [{ text: '' }] } }] },
      { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{' }] } }] },
      { promptFeedback: { blockReason: 'SAFETY' } },
    ]) {
      await expect(setup(jest.fn().mockResolvedValue(jsonRes(body))).provider.generate(req)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });

  it('never leaks the API key or the user code into logs or error messages', async () => {
    const { provider, logs } = setup(jest.fn().mockResolvedValue(jsonRes({}, 429)));
    const err = await provider.generate(req).catch((e) => e as AiError);
    // before
//const everything = logs.join('\n') + err.message;

// after
const errText = typeof err === 'string' ? err : err.message;
const everything = logs.join('\n') + errText;

    expect(everything).not.toContain(SECRET);
    expect(everything).not.toContain(SECRET_CODE);
    expect(logs.some((l) => l.includes('requestNumber'))).toBe(true);
  });
});
