import { Request } from "express";
import { AppError } from "../errors/AppError";

export function parseIdParam(req: Request, label: string): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, `${label} id must be a positive integer`);
  }
  return id;
}
