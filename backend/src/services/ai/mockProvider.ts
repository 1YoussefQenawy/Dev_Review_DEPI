import { analyzeSource } from './mockAnalysis';
import type { AiProvider, GenerateRequest } from './provider';

/**
 * Free, offline provider. It makes NO network calls. The real work is in mockAnalysis.ts, which
 * inspects the code with text analysis so the demo review is specific to the uploaded file.
 * It returns a JSON *string* exactly like a real model would, so the same parsing + validation
 * code path (analyzer.ts) is exercised.
 */
export class MockProvider implements AiProvider {
  readonly name = 'mock';

  async generate(req: GenerateRequest): Promise<string> {
    return JSON.stringify(analyzeSource(req.code, req.language));
  }
}
