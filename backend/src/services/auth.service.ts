import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export class AuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function validatePasswordStrength(password: string): string | null {
  const missing: string[] = [];
  if (!/[A-Z]/.test(password)) missing.push("uppercase letter (A-Z)");
  if (!/[a-z]/.test(password)) missing.push("lowercase letter (a-z)");
  if (!/[0-9]/.test(password)) missing.push("number (0-9)");
  if (!/[^A-Za-z0-9\s]/.test(password)) missing.push("special character (e.g. !@#$%)");

  if (missing.length === 0) return null;

  return `Password must contain uppercase letters, lowercase letters, numbers, and special characters. Missing: ${missing.join(", ")}.`;
}

function signToken(userId: number): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AuthError(500, "JWT_SECRET is not set");
  }
  return jwt.sign({ userId }, secret, { expiresIn: "1d" });
}

export async function registerUser(email: string, password: string, name?: string) {
  if (!email || typeof email !== "string" || !email.trim()) {
    throw new AuthError(400, "Email or username is required");
  }
  if (!password || typeof password !== "string") {
    throw new AuthError(400, "Password is required");
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    throw new AuthError(400, passwordError);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError(409, "Email or username is already in use");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });

  const token = signToken(user.id);
  return { token, user: { id: String(user.id), email: user.email, name: user.name } };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AuthError(401, "Invalid email or password");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AuthError(401, "Invalid email or password");
  }

  const token = signToken(user.id);
  return { token, user: { id: String(user.id), email: user.email, name: user.name } };
}
