import { Validator } from "../middleware/validate";

export const ALLOWED_LANGUAGES = ["javascript", "typescript"];
const MAX_CODE_LENGTH = 100000;

export const createSnippetValidator: Validator = (body) => {
  const errors: string[] = [];
  const { title, code, language } = body;

  if (typeof title !== "string" || title.trim() === "" || title.length > 100) {
    errors.push("title is required and must be at most 100 characters");
  }
  if (typeof code !== "string" || code.trim() === "") {
    errors.push("code is required");
  } else if (code.length > MAX_CODE_LENGTH) {
    errors.push(`code must be at most ${MAX_CODE_LENGTH} characters`);
  }
  if (typeof language !== "string" || !ALLOWED_LANGUAGES.includes(language)) {
    errors.push(`language must be one of: ${ALLOWED_LANGUAGES.join(", ")}`);
  }

  return errors;
};
