import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminSession,
  isAdminAuthConfigured,
  isValidAdminSession,
  sessionFromCookieHeader,
  verifyAdminPassword,
} from "../lib/admin-session.ts";

function withAuthEnvironment(run: () => void) {
  process.env.RADAR_ADMIN_PASSWORD = "test-password-with-length";
  process.env.RADAR_SESSION_SECRET = "test-session-secret-with-at-least-thirty-two-characters";
  try {
    run();
  } finally {
    delete process.env.RADAR_ADMIN_PASSWORD;
    delete process.env.RADAR_SESSION_SECRET;
  }
}

test("admin auth requires strong enough environment values", () => {
  delete process.env.RADAR_ADMIN_PASSWORD;
  delete process.env.RADAR_SESSION_SECRET;
  assert.equal(isAdminAuthConfigured(), false);
  withAuthEnvironment(() => assert.equal(isAdminAuthConfigured(), true));
});

test("password comparison and signed session validation reject tampering", () => {
  withAuthEnvironment(() => {
    const now = Date.now();
    const token = createAdminSession(now);
    assert.equal(verifyAdminPassword("test-password-with-length"), true);
    assert.equal(verifyAdminPassword("wrong-password"), false);
    assert.equal(isValidAdminSession(token, now), true);
    assert.equal(isValidAdminSession(`${token.slice(0, -1)}x`, now), false);
  });
});

test("expired sessions and unrelated cookies are rejected", () => {
  withAuthEnvironment(() => {
    const createdAt = Date.now();
    const token = createAdminSession(createdAt);
    assert.equal(isValidAdminSession(token, createdAt + 13 * 60 * 60 * 1_000), false);
    assert.equal(sessionFromCookieHeader(`other=1; radar_admin_session=${token}; theme=dark`), token);
    assert.equal(sessionFromCookieHeader("other=1"), undefined);
  });
});
