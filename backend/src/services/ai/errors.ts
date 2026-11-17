/**
 * Typed errors for the AI module.
 * Member 3 (backend) maps `code` -> `httpStatus`; Member 1 (frontend) shows `message`.
 * Messages are always safe to show to a user: they never contain the API key or the user's code.
 */
export type AiErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_LANGUAGE'
  | 'INPUT_TOO_LARGE'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'QUOTA_EXCEEDED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE';

const HTTP_STATUS: Record<AiErrorCode, number> = {
  INVALID_INPUT: 400,
  UNSUPPORTED_LANGUAGE: 400,
  INPUT_TOO_LARGE: 413,
  PROVIDER_NOT_CONFIGURED: 503,
  QUOTA_EXCEEDED: 429,
  PROVIDER_UNAVAILABLE: 503,
  TIMEOUT: 504,
  INVALID_RESPONSE: 502,
};

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly httpStatus: number;
  /** Only set for QUOTA_EXCEEDED, when we know roughly how long to wait. */
  readonly retryAfterSeconds?: number;

  constructor(code: AiErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isAiError(err: unknown): err is AiError {
  return err instanceof AiError;
}
