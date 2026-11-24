import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  const info = err as { type?: string; code?: string };

  if (info.type === "entity.parse.failed") {
    res.status(400).json({ message: "Request body is not valid JSON" });
    return;
  }

  if (info.type === "entity.too.large") {
    res.status(413).json({ message: "Request body is too large" });
    return;
  }

  if (info.code === "P2002") {
    res.status(409).json({ message: "Resource already exists" });
    return;
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}
