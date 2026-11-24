import { RequestHandler } from "express";
import { AppError } from "../errors/AppError";

export type Validator = (body: Record<string, unknown>) => string[];

export function validate(validator: Validator): RequestHandler {
  return (req, _res, next) => {
    const body =
      typeof req.body === "object" && req.body !== null
        ? (req.body as Record<string, unknown>)
        : {};
    const errors = validator(body);
    if (errors.length > 0) {
      throw new AppError(400, "Validation failed", errors);
    }
    next();
  };
}
