import assert from "node:assert/strict";
import test from "node:test";
import { guardApiRequest } from "../lib/api-guard.ts";
import { createAdminSession, RADAR_SESSION_COOKIE } from "../lib/admin-session.ts";

function request(headers: Record<string, string> = {}) {
  return new Request("https://radar.example/api/compare", {
    method: "POST",
    headers: { origin: "https://radar.example", host: "radar.example", ...headers },
  });
}

test("production requests must come from the public site origin", () => {
  const env = process.env as Record<string, string | undefined>;
  const previous = env.NODE_ENV;
  env.NODE_ENV = "production";
  try {
    const response = guardApiRequest(request({ origin: "https://attacker.example" }), "compare");
    assert.equal(response?.status, 403);
  } finally {
    if (previous === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previous;
  }
});

test("optional access token blocks unauthenticated AI calls", () => {
  process.env.RADAR_API_ACCESS_TOKEN = "private-token";
  try {
    const missing = guardApiRequest(request({ "x-forwarded-for": "guard-token-missing" }), "compare");
    const accepted = guardApiRequest(request({
      "x-forwarded-for": "guard-token-present",
      "x-radar-access-token": "private-token",
    }), "compare");
    assert.equal(missing?.status, 401);
    assert.equal(missing?.headers.get("x-radar-auth"), "required");
    assert.equal(accepted, null);
  } finally {
    delete process.env.RADAR_API_ACCESS_TOKEN;
  }
});

test("configured admin auth blocks missing sessions and accepts signed cookies", () => {
  process.env.RADAR_ADMIN_PASSWORD = "test-password-with-length";
  process.env.RADAR_SESSION_SECRET = "test-session-secret-with-at-least-thirty-two-characters";
  try {
    const missing = guardApiRequest(request({ "x-forwarded-for": "guard-session-missing" }), "compare");
    const accepted = guardApiRequest(request({
      "x-forwarded-for": "guard-session-present",
      cookie: `${RADAR_SESSION_COOKIE}=${createAdminSession()}`,
    }), "compare");
    assert.equal(missing?.status, 401);
    assert.equal(missing?.headers.get("x-radar-session"), "required");
    assert.equal(accepted, null);
  } finally {
    delete process.env.RADAR_ADMIN_PASSWORD;
    delete process.env.RADAR_SESSION_SECRET;
  }
});

test("rate limit rejects calls beyond the configured window", () => {
  process.env.RADAR_COMPARE_RATE_LIMIT = "2";
  try {
    const headers = { "x-forwarded-for": "guard-rate-limit" };
    assert.equal(guardApiRequest(request(headers), "compare"), null);
    assert.equal(guardApiRequest(request(headers), "compare"), null);
    const limited = guardApiRequest(request(headers), "compare");
    assert.equal(limited?.status, 429);
    assert.ok(Number(limited?.headers.get("retry-after")) >= 1);
  } finally {
    delete process.env.RADAR_COMPARE_RATE_LIMIT;
  }
});
