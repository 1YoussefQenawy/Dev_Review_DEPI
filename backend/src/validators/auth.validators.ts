import { Validator } from "../middleware/validate";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerValidator: Validator = (body) => {
  const errors: string[] = [];
  const { email, password, name } = body;

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
    errors.push("email must be a valid email address");
  }
  if (typeof password !== "string" || password.length < 6 || password.length > 72) {
    errors.push("password must be a string between 6 and 72 characters");
  }
  if (name !== undefined && (typeof name !== "string" || name.length > 100)) {
    errors.push("name must be a string of at most 100 characters");
  }

  return errors;
};

export const loginValidator: Validator = (body) => {
  const errors: string[] = [];
  const { email, password } = body;

  if (typeof email !== "string" || email.trim() === "") {
    errors.push("email is required");
  }
  if (typeof password !== "string" || password === "") {
    errors.push("password is required");
  }

  return errors;
};
