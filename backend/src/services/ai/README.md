# AI Analysis Module (Member 5)

One function for the backend: `analyzeCode({ code, language, filename })` -> validated review.

## Files
| File | Job |
|---|---|
| `schema.ts` | The exact JSON shape of a review (Zod). Anything else from the AI is rejected. |
| `prompt.ts` | The instructions sent to the AI + protection against prompt injection. |
| `provider.ts` | Interface every AI backend implements. |
| `mockProvider.ts` | Free offline fake AI. Used for all development and tests. |
| `geminiProvider.ts` | Real Gemini call: 1 request, no retry, 429 cooldown, timeout. |
| `config.ts` | Reads `.env` settings, safe defaults (mock). |
| `usage.ts` / `logger.ts` | Counts Gemini calls (numbers only) / logging. |
| `analyzer.ts` | Validate input -> build prompt -> call provider -> parse -> validate. |
| `errors.ts` | Typed errors with HTTP status. |
| `index.ts` | Public API for Member 3. |

## Quota protection
Default provider is `mock`. Gemini is called only when `AI_PROVIDER=gemini` AND a user requests an analysis.
One request per analysis. No retry on 429/timeout/network errors; after a 429, Gemini calls are blocked for `AI_QUOTA_COOLDOWN_MS`.
Only an invalid-JSON reply may trigger one extra call, and only if `AI_MAX_REPAIR_ATTEMPTS=1`.

## Run tests (no API key, no internet needed)
    cd backend && npm install && npm test

## Get a Gemini API key (free)
1. Open https://aistudio.google.com and sign in with a Google account.
2. Click "Get API key" -> "Create API key" (create or pick a project).
3. Copy the key. Treat it like a password.
4. In `backend/`, copy `.env.example` to `.env`. Paste the key into `GEMINI_API_KEY`.
5. In AI Studio, choose a model that shows free-tier access and copy its exact name into `GEMINI_MODEL`.
6. Set `AI_PROVIDER=gemini` only for the final demo.
`.env` is already ignored by Git. Never commit or share the key.
