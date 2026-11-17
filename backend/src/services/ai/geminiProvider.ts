import { AiError } from './errors';
import type { Logger } from './logger';
import type { AiProvider, GenerateRequest } from './provider';
import type { UsageTracker } from './usage';

export interface GeminiOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
  quotaCooldownMs: number;
  usage: UsageTracker;
  logger: Logger;
  /** Injectable so tests can use a fake and never touch the network. */
  fetchImpl?: typeof fetch;
}

/**
 * Calls Google's Gemini REST API with exactly ONE HTTP request per generate().
 * It never retries by itself. After an HTTP 429 it refuses further calls during a cooldown,
 * so a quota error can never turn into a request storm.
 */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private quotaBlockedUntil = 0;
  private readonly o: GeminiOptions;

  constructor(options: GeminiOptions) {
    this.o = options;
  }

  async generate(req: GenerateRequest): Promise<string> {
    const now = Date.now();
    if (now < this.quotaBlockedUntil) {
      throw new AiError(
        'QUOTA_EXCEEDED',
        'The Gemini free-tier limit was reached recently. No request was sent. Please try again later.',
        Math.ceil((this.quotaBlockedUntil - now) / 1000),
      );
    }

    const n = this.o.usage.recordRequest();
    this.o.logger.info('Sending Gemini request', { requestNumber: n, model: this.o.model });

    const doFetch = this.o.fetchImpl ?? fetch;
    const url = `${this.o.baseUrl}/models/${encodeURIComponent(this.o.model)}:generateContent`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs);

    try {
      let res: Response;
      try {
        res = await doFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.o.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: req.userPrompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 8192 },
          }),
          signal: controller.signal,
        });
      } catch (err) {
        throw this.networkError(err);
      }

      if (!res.ok) throw this.httpError(res);

      let body: unknown;
      try {
        body = await res.json();
      } catch (err) {
        if (isAbort(err)) throw this.networkError(err);
        throw this.fail(new AiError('INVALID_RESPONSE', 'Gemini returned a response that could not be read.'));
      }

      let text: string;
      try {
        text = extractText(body);
      } catch (err) {
        throw this.fail(err as AiError);
      }
      this.o.usage.recordSuccess();
      this.o.logger.info('Gemini request succeeded', { requestNumber: n });
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  private fail(err: AiError): AiError {
    this.o.usage.recordFailure(err.code === 'QUOTA_EXCEEDED');
    this.o.logger.warn('Gemini request failed', { code: err.code });
    return err;
  }

  private networkError(err: unknown): AiError {
    if (isAbort(err)) {
      return this.fail(new AiError('TIMEOUT', 'The AI service took too long to respond. Please try again.'));
    }
    return this.fail(new AiError('PROVIDER_UNAVAILABLE', 'The AI service could not be reached. The rest of the app still works.'));
  }

  private httpError(res: Response): AiError {
    const s = res.status;
    if (s === 429) {
      const header = Number(res.headers.get('retry-after'));
      const retrySec = Number.isFinite(header) && header > 0 ? header : 0;
      const cooldownMs = Math.max(this.o.quotaCooldownMs, retrySec * 1000);
      this.quotaBlockedUntil = Date.now() + cooldownMs;
      return this.fail(
        new AiError(
          'QUOTA_EXCEEDED',
          'The Gemini free-tier limit has been reached. Please wait and try again later. The rest of the app still works.',
          Math.ceil(cooldownMs / 1000),
        ),
      );
    }
    if (s === 404) return this.fail(new AiError('PROVIDER_NOT_CONFIGURED', 'Gemini model not found. Check GEMINI_MODEL.'));
    if (s === 400 || s === 401 || s === 403) {
      return this.fail(new AiError('PROVIDER_NOT_CONFIGURED', 'Gemini rejected the request. Check GEMINI_API_KEY and GEMINI_MODEL.'));
    }
    return this.fail(new AiError('PROVIDER_UNAVAILABLE', 'The AI service is temporarily unavailable. The rest of the app still works.'));
  }
}

function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

function extractText(body: unknown): string {
  const b = body as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (b?.promptFeedback?.blockReason) {
    throw new AiError('INVALID_RESPONSE', 'Gemini refused to analyze this input.');
  }
  const cand = b?.candidates?.[0];
  if (cand?.finishReason === 'MAX_TOKENS') {
    throw new AiError('INVALID_RESPONSE', 'The AI reply was cut off because it was too long. Try a shorter file.');
  }
  const text = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) throw new AiError('INVALID_RESPONSE', 'Gemini returned an empty reply.');
  return text;
}
