import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const RADAR_SESSION_COOKIE = "radar_admin_session";
export const RADAR_SESSION_MAX_AGE = 12 * 60 * 60;

function safeEqual(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function password() {
  return process.env.RADAR_ADMIN_PASSWORD || "";
}

function sessionSecret() {
  return process.env.RADAR_SESSION_SECRET || "";
}

export function isAdminAuthConfigured() {
  return password().length >= 12 && sessionSecret().length >= 32;
}

export function verifyAdminPassword(received: string) {
  const expected = password();
  return expected.length >= 12 && safeEqual(received, expected);
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createAdminSession(now = Date.now()) {
  if (!isAdminAuthConfigured()) throw new Error("RADAR_ADMIN_PASSWORD e RADAR_SESSION_SECRET não configurados.");
  const expiresAt = Math.floor(now / 1_000) + RADAR_SESSION_MAX_AGE;
  const payload = `v1.${expiresAt}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${signature(payload)}`;
}

export function isValidAdminSession(token: string | undefined, now = Date.now()) {
  if (!token || !isAdminAuthConfigured()) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const expiresAt = Number(parts[1]);
  const nowSeconds = Math.floor(now / 1_000);
  if (!Number.isInteger(expiresAt) || expiresAt <= nowSeconds || expiresAt > nowSeconds + RADAR_SESSION_MAX_AGE) return false;
  const payload = parts.slice(0, 3).join(".");
  return safeEqual(parts[3], signature(payload));
}

export function sessionFromCookieHeader(header: string | null) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === RADAR_SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function requestHasValidAdminSession(request: Request) {
  return isValidAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: RADAR_SESSION_MAX_AGE,
  };
}
