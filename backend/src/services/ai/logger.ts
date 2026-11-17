/** Minimal logger interface so tests can stay silent and the backend can plug in its own logger. */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export const consoleLogger: Logger = {
  info: (m, meta) => console.log(`[ai] ${m}`, meta ?? ''),
  warn: (m, meta) => console.warn(`[ai] ${m}`, meta ?? ''),
  error: (m, meta) => console.error(`[ai] ${m}`, meta ?? ''),
};

export const silentLogger: Logger = { info() {}, warn() {}, error() {} };
