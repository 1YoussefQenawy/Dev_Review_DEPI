/**
 * Every AI backend (mock, Gemini, anything later) implements this one interface.
 * To switch provider, only the factory in index.ts changes.
 */
export interface GenerateRequest {
  systemInstruction: string;
  userPrompt: string;
  timeoutMs: number;
  /** Raw inputs. Only the mock provider reads these; real providers use the prompts. */
  code: string;
  language: 'javascript' | 'typescript';
}

export interface AiProvider {
  readonly name: string;
  /** Returns the model's raw text reply (expected to be a JSON string). */
  generate(request: GenerateRequest): Promise<string>;
}
