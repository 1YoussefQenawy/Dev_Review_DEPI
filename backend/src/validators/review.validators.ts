import { Validator } from "../middleware/validate";

export const createReviewValidator: Validator = (body) => {
  const errors: string[] = [];
  const { snippetId } = body;

  if (typeof snippetId !== "number" || !Number.isInteger(snippetId) || snippetId <= 0) {
    errors.push("snippetId must be a positive integer");
  }

  return errors;
};
