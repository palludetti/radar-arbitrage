import { timingSafeEqual } from "node:crypto";
import { isAdminAuthConfigured, requestHasValidAdminSession } from "./admin-session.ts";

type Bucket = { count: number; resetAt: number };
type GuardRoute = "analyze" | "compare";

const globalBuckets = globalThis as typeof globalThis & {
  __radarApiBuckets?: Map<string, Bucket>;
};
const buckets = globalBuckets.__radarApiBuckets || new Map<string, Bucket>();
globalBuckets.__radarApiBuckets = buckets;

function jsonError(status: number, error: string, headers: Record<string, string> = {}) {
  return Response.json({ error }, { status, headers });
}

function sameSecret(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export function guardApiRequest(request: Request, route: GuardRoute): Response | null {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "");
  const publicOrigin = forwardedHost ? `${forwardedProtocol}://${forwardedHost}` : requestUrl.origin;
  const expectedOrigin = process.env.RADAR_ALLOWED_ORIGIN || publicOrigin;
  const origin = request.headers.get("origin");
  if (process.env.NODE_ENV === "production" && origin !== expectedOrigin) {
    return jsonError(403, "Origem não autorizada para esta API.");
  }

  if (process.env.NODE_ENV === "production" && !isAdminAuthConfigured()) {
    return jsonError(503, "Acesso administrativo do Radar não configurado.");
  }
  if (isAdminAuthConfigured() && !requestHasValidAdminSession(request)) {
    return jsonError(401, "Sessão administrativa necessária.", {
      "x-radar-session": "required",
    });
  }

  const expectedToken = process.env.RADAR_API_ACCESS_TOKEN;
  if (expectedToken) {
    const receivedToken = request.headers.get("x-radar-access-token") || "";
    if (!sameSecret(receivedToken, expectedToken)) {
      return jsonError(401, "Token de acesso do Radar necessário.", {
        "x-radar-auth": "required",
      });
    }
  }

  const now = Date.now();
  const windowMs = 60_000;
  const configuredLimit = Number(process.env[`RADAR_${route.toUpperCase()}_RATE_LIMIT`]);
  const fallbackLimit = route === "compare" ? 4 : 10;
  const limit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : fallbackLimit;
  const key = `${route}:${clientIp(request)}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > 1_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
    return jsonError(429, "Muitas análises em pouco tempo. Aguarde e tente novamente.", {
      "retry-after": String(retryAfter),
    });
  }

  return null;
}
