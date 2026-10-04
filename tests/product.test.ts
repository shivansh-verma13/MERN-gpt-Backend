import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import type { Config } from "../src/app.js";
import { JsonStore } from "../src/store.js";
import { retrieve } from "../src/retrieval.js";
import { validateAnswer, answerQuestion } from "../src/ai.js";
import { hashPassword, checkPassword } from "../src/auth.js";
import { sampleSources } from "../src/demo.js";
const origin = "http://localhost:5174";
async function fixture(overrides: Partial<Config> = {}) {
  const store = await new JsonStore().init();
  const app = createApp(store, {
    origin,
    production: false,
    demo: false,
    mode: "demo",
    dailyLimit: 4,
    timeout: 100,
    ...overrides,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address() as { port: number };
  const base = "http://127.0.0.1:" + address.port;
  type Client = { cookie: string; csrf: string };
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    client?: Client,
    headers: Record<string, string> = {},
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(client
          ? { Cookie: client.cookie, "X-CSRF-Token": client.csrf }
          : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    return { response, data };
  }
  async function user(email: string) {
    const { response, data } = await call("/api/auth/register", "POST", {
      name: "Test Engineer",
      email,
      password: "correct-horse-123",
    });
    assert.equal(response.status, 201);
    return {
      cookie: response.headers.get("set-cookie")!.split(";")[0],
      csrf: data.csrf,
      id: data.user.id,
    };
  }
  return {
    base,
    store,
    call,
    user,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      await store.close();
    },
  };
}
test("password hashes are salted and verify safely", async () => {
  const a = await hashPassword("password-123");
  const b = await hashPassword("password-123");
  assert.notEqual(a, b);
  assert.equal(await checkPassword("password-123", a), true);
  assert.equal(await checkPassword("wrong", a), false);
});
test("authentication, origin checks, CSRF, duplicate accounts, logout and session expiry", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call("/api/sources")).response.status, 401);
    const u = await f.user("one@example.com");
    assert.equal(
      (await f.call("/api/auth/me", "GET", undefined, u)).data.user.id,
      u.id,
    );
    assert.equal(
      (
        await f.call("/api/auth/register", "POST", {
          name: "Test",
          email: "one@example.com",
          password: "correct-horse-123",
        })
      ).response.status,
      409,
    );
    assert.equal(
      (
        await f.call("/api/auth/login", "POST", {
          email: "one@example.com",
          password: "incorrect-pass",
        })
      ).response.status,
      401,
    );
    const login = await f.call("/api/auth/login", "POST", {
      email: "ONE@example.com",
      password: "correct-horse-123",
    });
    assert.equal(login.response.status, 200);
    assert.match(login.response.headers.get("set-cookie")!, /HttpOnly/);
    assert.match(login.response.headers.get("set-cookie")!, /SameSite=Lax/);
  } finally {
    await f.close();
  }
});
test("resource-level authorization hides other users sources and threads; logout revokes cookie", async () => {
  const f = await fixture();
  try {
    const a = await f.user("a@example.com"),
      b = await f.user("b@example.com");
    const created = await f.call(
      "/api/sources",
      "POST",
      {
        title: "Private plan",
        content: "Private source content for user A only.",
      },
      a,
    );
    assert.equal(created.response.status, 201);
    assert.equal(
      (await f.call("/api/sources", "GET", undefined, b)).data.items.length,
      0,
    );
    assert.equal(
      (await f.call("/api/sources/" + created.data.id, "DELETE", undefined, b))
        .response.status,
      404,
    );
    assert.equal(
      (
        await f.call(
          "/api/sources",
          "POST",
          {
            title: "Forbidden",
            content: "This source must never be persisted.",
          },
          { ...a, csrf: "bad" },
        )
      ).response.status,
      403,
    );
    assert.equal(
      (
        await f.call(
          "/api/sources",
          "POST",
          {
            title: "Forbidden",
            content: "This source must never be persisted.",
          },
          a,
          { Origin: "https://evil.invalid" },
        )
      ).response.status,
      403,
    );
    const t = await f.call(
      "/api/threads",
      "POST",
      { title: "Private thread" },
      a,
    );
    assert.equal(
      (await f.call("/api/threads/" + t.data.id, "GET", undefined, b)).response
        .status,
      404,
    );
    assert.equal(
      (
        await f.call(
          "/api/threads/" + t.data.id + "/questions",
          "POST",
          { question: "private plan", requestId: randomUUID(), consent: false },
          b,
        )
      ).response.status,
      404,
    );
    assert.equal(
      (await f.call("/api/auth/logout", "POST", {}, a)).response.status,
      200,
    );
    assert.equal(
      (await f.call("/api/auth/me", "GET", undefined, a)).response.status,
      401,
    );
  } finally {
    await f.close();
  }
});
test("bounded validation, pagination, source caps and expired sessions", async () => {
  const f = await fixture();
  try {
    const a = await f.user("bounds@example.com");
    assert.equal(
      (await f.call("/api/sources", "POST", { title: "x", content: "tiny" }, a))
        .response.status,
      422,
    );
    assert.equal(
      (
        await f.call(
          "/api/sources",
          "POST",
          { title: "x", content: "x".repeat(17000) },
          a,
        )
      ).response.status,
      422,
    );
    for (let i = 0; i < 99; i++)
      await f.store.insert("threads", {
        id: randomUUID(),
        ownerId: a.id,
        title: "Existing",
        messages: [],
        createdAt: "2026-10-04",
        updatedAt: "2026-10-04",
      });
    const concurrent = await Promise.all([
      f.call("/api/threads", "POST", { title: "Final slot" }, a),
      f.call("/api/threads", "POST", { title: "Overflow" }, a),
    ]);
    assert.equal(concurrent.filter((r) => r.response.status === 201).length, 1);
    assert.equal(
      (await f.store.find("threads", { ownerId: a.id }, 101)).length,
      100,
    );
    for (let i = 0; i < 50; i++)
      await f.store.insert("sources", {
        id: randomUUID(),
        ownerId: a.id,
        title: "s" + i,
        content: "bounded source test content",
        createdAt: new Date().toISOString(),
      });
    assert.equal(
      (await f.call("/api/sources?limit=5", "GET", undefined, a)).data.items
        .length,
      5,
    );
    assert.equal(
      (await f.call("/api/sources?limit=5", "GET", undefined, a)).data.hasMore,
      true,
    );
    assert.equal(
      (
        await f.call(
          "/api/sources",
          "POST",
          {
            title: "Overflow",
            content: "This exceeds the source count limit.",
          },
          a,
        )
      ).response.status,
      409,
    );
    const sessions = await f.store.find("sessions", { ownerId: a.id }, 1);
    await f.store.update(
      "sessions",
      sessions[0].id,
      {},
      { expiresAt: new Date(0) },
    );
    assert.equal(
      (await f.call("/api/auth/me", "GET", undefined, a)).response.status,
      401,
    );
  } finally {
    await f.close();
  }
});
test("demo source journey, quoted answer, durable thread, idempotency and daily cap", async () => {
  const f = await fixture({ demo: true, dailyLimit: 2 });
  try {
    const session = await f.call("/api/auth/demo", "POST", {});
    const a = {
      cookie: session.response.headers.get("set-cookie")!.split(";")[0],
      csrf: session.data.csrf,
    };
    const sources = (await f.call("/api/sources", "GET", undefined, a)).data
      .items;
    assert.equal(sources.length, 3);
    const t = (await f.call("/api/threads", "POST", { title: "Launch" }, a))
      .data;
    const requestId = randomUUID();
    const payload = {
      question: "When is the pilot launch?",
      requestId,
      consent: false,
    };
    const result = await f.call(
      "/api/threads/" + t.id + "/questions",
      "POST",
      payload,
      a,
    );
    assert.equal(result.response.status, 200);
    assert.equal(result.data.mode, "demo");
    assert.ok(
      result.data.citations.some((c: { quote: string }) =>
        c.quote.includes("November 12"),
      ),
    );
    const repeat = await f.call(
      "/api/threads/" + t.id + "/questions",
      "POST",
      payload,
      a,
    );
    assert.deepEqual(repeat.data, result.data);
    assert.equal(
      (await f.call("/api/threads/" + t.id, "GET", undefined, a)).data.messages
        .length,
      2,
    );
    assert.equal(
      (
        await f.call(
          "/api/threads/" + t.id + "/questions",
          "POST",
          { ...payload, requestId: randomUUID() },
          a,
        )
      ).response.status,
      200,
    );
    assert.equal(
      (
        await f.call(
          "/api/threads/" + t.id + "/questions",
          "POST",
          { ...payload, requestId: randomUUID() },
          a,
        )
      ).response.status,
      429,
    );
    assert.equal(
      (await f.call("/api/threads", "GET", undefined, a)).data.items[0]
        .messageCount,
      4,
    );
  } finally {
    await f.close();
  }
});
test("live provider requires consent; errors do not save partial turns", async () => {
  let calls = 0;
  const f = await fixture({
    mode: "live",
    generate: async () => {
      calls++;
      throw new Error("provider failure");
    },
  });
  try {
    const a = await f.user("provider@example.com");
    await f.call(
      "/api/sources",
      "POST",
      {
        title: "Launch",
        content: "The pilot launch is scheduled for November 12.",
      },
      a,
    );
    const t = (await f.call("/api/threads", "POST", { title: "Launch" }, a))
      .data;
    const path = "/api/threads/" + t.id + "/questions";
    const payload = {
      question: "When is the pilot launch?",
      requestId: randomUUID(),
      consent: false,
    };
    assert.equal((await f.call(path, "POST", payload, a)).response.status, 422);
    assert.equal(calls, 0);
    assert.equal(
      (await f.call(path, "POST", { ...payload, consent: true }, a)).response
        .status,
      502,
    );
    assert.equal(calls, 1);
    assert.equal(
      (await f.call("/api/threads/" + t.id, "GET", undefined, a)).data.messages
        .length,
      0,
    );
  } finally {
    await f.close();
  }
});
test("provider timeout cancels request and successful structured output persists", async () => {
  const f = await fixture({
    mode: "live",
    timeout: 30,
    generate: async (_q, chunks, signal) =>
      new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
        if (_q.includes("successful"))
          resolve({
            output: {
              answer: "November 12.",
              insufficient: false,
              citations: [
                { chunkId: chunks[0].chunkId, quote: chunks[0].quote },
              ],
            },
            tokens: 45,
          });
      }),
  });
  try {
    const a = await f.user("timeout@example.com");
    await f.call(
      "/api/sources",
      "POST",
      {
        title: "Launch",
        content: "The pilot launch is scheduled for November 12.",
      },
      a,
    );
    const t = (await f.call("/api/threads", "POST", { title: "Launch" }, a))
      .data;
    const path = "/api/threads/" + t.id + "/questions";
    assert.equal(
      (
        await f.call(
          path,
          "POST",
          {
            question: "When is pilot launch?",
            requestId: randomUUID(),
            consent: true,
          },
          a,
        )
      ).response.status,
      504,
    );
    const result = await f.call(
      path,
      "POST",
      {
        question: "successful pilot launch",
        requestId: randomUUID(),
        consent: true,
      },
      a,
    );
    assert.equal(result.response.status, 200);
    assert.equal(result.data.tokens, 45);
    assert.equal(result.data.mode, "live");
  } finally {
    await f.close();
  }
});
test("citation validation rejects invented sources, fabricated quotes and uncited certainty", () => {
  const chunks = [
    {
      sourceId: "s",
      chunkId: "s:0",
      title: "Plan",
      quote: "Launch is November 12.",
      score: 1,
    },
  ];
  assert.throws(() =>
    validateAnswer(
      { answer: "Yes", insufficient: false, citations: [] },
      chunks,
    ),
  );
  assert.throws(() =>
    validateAnswer(
      {
        answer: "Yes",
        insufficient: false,
        citations: [{ chunkId: "s:9", quote: "Launch" }],
      },
      chunks,
    ),
  );
  assert.throws(() =>
    validateAnswer(
      {
        answer: "Yes",
        insufficient: false,
        citations: [{ chunkId: "s:0", quote: "December" }],
      },
      chunks,
    ),
  );
  assert.throws(() =>
    validateAnswer({ answer: 1, citations: [], insufficient: true }, chunks),
  );
});
test("retrieval excludes unrelated sources and unsupported questions abstain", async () => {
  const sources = sampleSources.map((s, i) => ({
    ...s,
    id: "s" + i,
    ownerId: "u",
    createdAt: "",
  }));
  assert.ok(
    retrieve("When is the pilot launch?", sources).some((c) =>
      c.quote.includes("November 12"),
    ),
  );
  assert.equal(
    retrieve("quantum gravitational singularities", sources).length,
    0,
  );
  let called = false;
  const result = await answerQuestion(
    "Unknown",
    [],
    "live",
    async () => {
      called = true;
      throw new Error();
    },
    new AbortController().signal,
  );
  assert.equal(result.insufficient, true);
  assert.equal(called, false);
});
test("JSON demo store survives restart and quota reservations stay atomic", async () => {
  const dir = await mkdtemp(join(tmpdir(), "briefcase-test-"));
  try {
    const file = join(dir, "demo.json");
    const a = await new JsonStore(file).init();
    await a.insert("sources", {
      id: "s",
      ownerId: "a",
      title: "Plan",
      content: "Launch November 12",
      createdAt: "",
    });
    const quotas = await Promise.all(
      Array.from({ length: 10 }, () => a.reserve("a", "2026-10-04", 3)),
    );
    assert.equal(quotas.filter((v) => v > 0).length, 3);
    await a.close();
    const b = await new JsonStore(file).init();
    assert.equal((await b.get("sources", "s"))?.title, "Plan");
    assert.equal(await b.reserve("a", "2026-10-04", 3), -1);
    await b.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("global provider budget caps paid requests across accounts", async () => {
  let calls = 0;
  const f = await fixture({
    mode: "live",
    globalDailyLimit: 1,
    generate: async (_q, chunks) => {
      calls++;
      return {
        output: {
          answer: "The launch is November 12.",
          citations: [{ chunkId: chunks[0].chunkId, quote: chunks[0].quote }],
          insufficient: false,
        },
        tokens: 30,
      };
    },
  });
  try {
    for (const [index, email] of [
      "first@example.com",
      "second@example.com",
    ].entries()) {
      const u = await f.user(email);
      await f.call(
        "/api/sources",
        "POST",
        {
          title: "Launch",
          content: "The launch is scheduled for November 12.",
        },
        u,
      );
      const t = await f.call(
        "/api/threads",
        "POST",
        { title: "Launch question" },
        u,
      );
      const answer = await f.call(
        "/api/threads/" + t.data.id + "/questions",
        "POST",
        {
          question: "When is the launch?",
          requestId: randomUUID(),
          consent: true,
        },
        u,
      );
      assert.equal(answer.response.status, index === 0 ? 200 : 429);
    }
    assert.equal(calls, 1);
  } finally {
    await f.close();
  }
});

test("same-origin release serves SPA without disguising API or malformed JSON errors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "briefcase-web-"));
  await writeFile(join(dir, "index.html"), "<h1>Release fixture</h1>");
  const f = await fixture({ webRoot: dir });
  try {
    const page = await fetch(f.base + "/workspace");
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Release fixture/);
    const api = await f.call("/api/not-a-route");
    assert.equal(api.response.status, 404);
    assert.equal(api.data.error, "Endpoint not found.");
    const malformed = await fetch(f.base + "/api/auth/register", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: "{broken",
    });
    assert.equal(malformed.status, 400);
    assert.equal(
      malformed.headers.get("content-type")?.includes("application/json"),
      true,
    );
  } finally {
    await f.close();
    await rm(dir, { recursive: true, force: true });
  }
});
