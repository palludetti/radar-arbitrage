import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSession,
  isAdminAuthConfigured,
  RADAR_SESSION_COOKIE,
  sessionCookieOptions,
  verifyAdminPassword,
} from "../../../lib/admin-session";

export const runtime = "nodejs";

type LoginBucket = { attempts: number; resetAt: number };
const globalLoginBuckets = globalThis as typeof globalThis & { __radarLoginBuckets?: Map<string, LoginBucket> };
const loginBuckets = globalLoginBuckets.__radarLoginBuckets || new Map<string, LoginBucket>();
globalLoginBuckets.__radarLoginBuckets = loginBuckets;

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/radar";
}

function publicOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, publicOrigin(request)), 303);
}

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function isRateLimited(request: NextRequest) {
  const now = Date.now();
  const key = clientIp(request);
  const current = loginBuckets.get(key);
  const bucket = !current || current.resetAt <= now ? { attempts: 0, resetAt: now + 15 * 60_000 } : current;
  bucket.attempts += 1;
  loginBuckets.set(key, bucket);
  return bucket.attempts > 8;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== publicOrigin(request)) return new NextResponse("Origem não autorizada.", { status: 403 });
  if (!isAdminAuthConfigured()) return redirectTo(request, "/login?error=config");
  if (isRateLimited(request)) return new NextResponse("Muitas tentativas. Aguarde 15 minutos.", { status: 429 });

  const form = await request.formData();
  const next = safeNext(form.get("next"));
  if (!verifyAdminPassword(String(form.get("password") || ""))) {
    return redirectTo(request, `/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const response = redirectTo(request, next);
  response.cookies.set(RADAR_SESSION_COOKIE, createAdminSession(), sessionCookieOptions());
  return response;
}
