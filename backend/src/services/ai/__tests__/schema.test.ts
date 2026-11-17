import { MockProvider } from '../mockProvider';
import { reviewSchema } from '../schema';

async function validReview() {
  const raw = await new MockProvider().generate({
    systemInstruction: '', userPrompt: '', timeoutMs: 1000, language: 'javascript',
    code: 'function add(a, b) { return a + b; }',
  });
  return JSON.parse(raw);
}

describe('reviewSchema', () => {
  it('accepts a valid review', async () => {
    expect(reviewSchema.safeParse(await validReview()).success).toBe(true);
  });

  it('rejects a score above 100', async () => {
    const r = await validReview();
    r.overallScore = 101;
    expect(reviewSchema.safeParse(r).success).toBe(false);
  });

  it('rejects a missing category', async () => {
    const r = await validReview();
    delete r.categories.securityIssues;
    expect(reviewSchema.safeParse(r).success).toBe(false);
  });

  it('rejects an unknown severity', async () => {
    const r = await validReview();
    r.categories.codeStyle.findings.push({ title: 'x', severity: 'catastrophic', line: 1, description: 'd', suggestion: 's' });
    expect(reviewSchema.safeParse(r).success).toBe(false);
  });

  it('rejects missing documentation', async () => {
    const r = await validReview();
    delete r.documentation;
    expect(reviewSchema.safeParse(r).success).toBe(false);
  });
});
