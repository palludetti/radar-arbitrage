import { NextRequest, NextResponse } from "next/server";
import { RADAR_SESSION_COOKIE, sessionCookieOptions } from "../../../../lib/admin-session";

export async function POST(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  const origin = host ? `${protocol}://${host}` : request.nextUrl.origin;
  const response = NextResponse.redirect(new URL("/", origin), 303);
  response.cookies.set(RADAR_SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
