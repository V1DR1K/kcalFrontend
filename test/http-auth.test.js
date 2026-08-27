import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { request } from "../src/services/http.js";

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return body == null ? "" : JSON.stringify(body); },
    async json() { return body; },
  };
}

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

beforeEach(() => {
  global.localStorage = storage();
  global.window = { dispatchEvent() {} };
});

test("refreshes an expired cookie session and retries the original request", { concurrency: false }, async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === "/api/auth/refresh") return response(200, {});
    if (calls.length === 1) return response(401, { message: "expired" });
    return response(200, { ok: true });
  };

  assert.deepEqual(await request("/api/foods", { method: "GET" }), { ok: true });
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(calls.at(-1).options.credentials, "include");
});

test("emits session-expired when a refresh token is rejected", { concurrency: false }, async () => {
  let expired = 0;
  global.window = { dispatchEvent(event) { if (event.type === "scalegrams:session-expired") expired += 1; } };
  global.fetch = async (url) => url === "/api/auth/refresh"
    ? response(401, { message: "invalid refresh" })
    : response(401, { message: "expired" });

  await assert.rejects(() => request("/api/foods"), { status: 401 });
  assert.equal(expired, 1);
});
