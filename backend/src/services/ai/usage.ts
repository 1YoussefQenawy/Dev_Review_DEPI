/**
 * Counts real Gemini requests so we can see how much free quota we are using.
 * It stores ONLY numbers. It never stores code, prompts, replies or keys.
 */
export interface UsageSnapshot {
  geminiRequests: number;
  succeeded: number;
  failed: number;
  quotaExceeded: number;
}

export class UsageTracker {
  private requests = 0;
  private succeeded = 0;
  private failed = 0;
  private quotaHits = 0;

  recordRequest(): number {
    this.requests += 1;
    return this.requests;
  }
  recordSuccess(): void {
    this.succeeded += 1;
  }
  recordFailure(quota: boolean): void {
    this.failed += 1;
    if (quota) this.quotaHits += 1;
  }
  snapshot(): UsageSnapshot {
    return {
      geminiRequests: this.requests,
      succeeded: this.succeeded,
      failed: this.failed,
      quotaExceeded: this.quotaHits,
    };
  }
}
