import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { AppError } from "../errors/AppError";

export type UserId = number;

type AuthenticatedRequest = Request & { userId?: UserId };

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "Missing or invalid Authorization header");
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(500, "JWT_SECRET is not set");
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), secret) as JwtPayload;
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }

  if (payload.userId === undefined) {
    throw new AppError(401, "Invalid token payload");
  }

  (req as AuthenticatedRequest).userId = payload.userId as UserId;
  next();
}

export function getUserId(req: Request): UserId {
  const userId = (req as AuthenticatedRequest).userId;
  if (userId === undefined) {
    throw new AppError(401, "Not authenticated");
  }
  return userId;
}
