import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";

export const ADMIN_COOKIE = "gwiza_admin";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 8;

function sessionSecret(): string | null {
  return process.env.SESSION_SECRET || null;
}

function signature(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function createAdminSessionToken(): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const payload = `${Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${signature(payload, secret)}`;
}

export function isAdminRequest(request: Request): boolean {
  const secret = sessionSecret();
  const token = request.cookies?.[ADMIN_COOKIE];
  if (!secret || typeof token !== "string") return false;

  const [expiry, nonce, suppliedSignature, extra] = token.split(".");
  if (!expiry || !nonce || !suppliedSignature || extra !== undefined) return false;
  const expiresAt = Number(expiry);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const payload = `${expiry}.${nonce}`;
  return constantTimeEqual(signature(payload, secret), suppliedSignature);
}

export function setAdminCookie(response: Response, token: string): void {
  response.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_LIFETIME_SECONDS * 1000,
    path: "/api",
  });
}

export function clearAdminCookie(response: Response): void {
  response.clearCookie(ADMIN_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
  });
}

export const requireAdmin: RequestHandler = (request, response, next) => {
  if (!isAdminRequest(request)) {
    response.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  next();
};

export function getAdminCredentials():
  | { email: string; password: string }
  | undefined {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return undefined;
  return { email, password };
}

export function verifyAdminCredentials(
  submittedEmail: string,
  submittedPassword: string,
): boolean {
  const expected = getAdminCredentials();
  if (!expected) return false;
  return (
    constantTimeEqual(submittedEmail.trim().toLowerCase(), expected.email.toLowerCase()) &&
    constantTimeEqual(submittedPassword, expected.password)
  );
}

export function getAdminEmail(request: Request): string | null {
  return isAdminRequest(request) ? getAdminCredentials()?.email ?? null : null;
}
