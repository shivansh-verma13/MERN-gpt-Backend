import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import type { Config } from "../src/app.js";
import { JsonStore } from "../src/store.js";
import { hashPassword, checkPassword } from "../src/auth.js";
import {
  demoPlan,
  demoReview,
  validatePlan,
  validateReview,
} from "../src/interview.js";
import type { Interview, Profile } from "../src/interview.js";
const origin = "http://localhost:5174";
async function fixture(overrides: Partial<Config> = {}) {
  const store = await new JsonStore().init();
  const app = createApp(store, {
    origin,
    production: false,
    demo: false,
    mode: "demo",
    dailyLimit: 20,
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

const profile: Profile = {
  role: "Backend Engineer",
  level: "early-career",
  focus: "backend",
  resume:
    "Synthetic candidate built an Express API with MongoDB and tests. No client data or real credentials are used.",
  job: "Build reliable Node APIs, validate inputs, enforce authorization and explain database query trade-offs.",
};
const start = (requestId = randomUUID(), consent = false) => ({
  ...profile,
  requestId,
  consent,
});
const answer =
  "I built the endpoint with validation because malformed requests should fail early. I tested ownership checks and measured query latency. Instead of caching immediately, I profiled database queries and checked the indexes before changing the design.";
const submission = (
  v: Interview,
  requestId = randomUUID(),
  consent = false,
) => ({ answer, requestId, version: v.version, consent });
test("salted password hashes, authentication, cookies, CSRF, origin checks and logout", async () => {
  const f = await fixture();
  try {
    const a = await hashPassword("password-123");
    assert.notEqual(a, await hashPassword("password-123"));
    assert.equal(await checkPassword("wrong", a), false);
    assert.equal(await checkPassword("password-123", a), true);
    assert.equal((await f.call("/api/interviews")).response.status, 401);
    const u = await f.user("auth@example.com");
    assert.match(u.cookie, /interview_session/);
    assert.equal(
      (await f.call("/api/auth/me", "GET", undefined, u)).data.user.id,
      u.id,
    );
    assert.equal(
      (
        await f.call("/api/interviews", "POST", start(), u, {
          "X-CSRF-Token": "wrong",
        })
      ).response.status,
      403,
    );
    assert.equal(
      (
        await f.call("/api/interviews", "POST", start(), u, {
          Origin: "https://evil.example",
        })
      ).response.status,
      403,
    );
    assert.equal(
      (
        await f.call("/api/auth/register", "POST", {
          name: "Another",
          email: "auth@example.com",
          password: "correct-horse-123",
        })
      ).response.status,
      409,
    );
    const login = await f.call("/api/auth/login", "POST", {
      email: "AUTH@example.com",
      password: "correct-horse-123",
    });
    assert.equal(login.response.status, 200);
    assert.match(login.response.headers.get("set-cookie")!, /HttpOnly/);
    await f.call("/api/auth/logout", "POST", {}, u);
    assert.equal(
      (await f.call("/api/auth/me", "GET", undefined, u)).response.status,
      401,
    );
  } finally {
    await f.close();
  }
});
test("complete 3-question round with one follow-up, safe replay, stale writes and review", async () => {
  const f = await fixture();
  try {
    const u = await f.user("flow@example.com");
    const request = start();
    let r = await f.call("/api/interviews", "POST", request, u);
    assert.equal(r.response.status, 201);
    let v = r.data as Interview;
    const duplicate = await f.call("/api/interviews", "POST", request, u);
    assert.equal(duplicate.data.id, v.id);
    const first = submission(v);
    r = await f.call("/api/interviews/" + v.id + "/answers", "POST", first, u);
    assert.equal(r.response.status, 200);
    v = r.data;
    assert.equal(v.cursor, 0);
    assert.ok(v.pendingFollowUp);
    assert.equal(
      (await f.call("/api/interviews/" + v.id + "/answers", "POST", first, u))
        .data.turns.length,
      1,
    );
    assert.equal(
      (
        await f.call(
          "/api/interviews/" + v.id + "/answers",
          "POST",
          { ...first, requestId: randomUUID() },
          u,
        )
      ).response.status,
      409,
    );
    for (let i = 0; i < 3; i++) {
      r = await f.call(
        "/api/interviews/" + v.id + "/answers",
        "POST",
        submission(v),
        u,
      );
      assert.equal(r.response.status, 200);
      v = r.data;
    }
    assert.equal(v.status, "completed");
    assert.equal(v.cursor, 3);
    assert.equal(v.turns.length, 4);
    assert.equal(v.turns.filter((t) => t.kind === "follow-up").length, 1);
    assert.match(r.data.report.disclaimer, /not a hiring decision/);
    assert.equal(
      (
        await f.call(
          "/api/interviews/" + v.id + "/answers",
          "POST",
          submission(v),
          u,
        )
      ).response.status,
      409,
    );
    assert.equal(
      (await f.call("/api/interviews", "GET", undefined, u)).data.items[0]
        .answered,
      3,
    );
  } finally {
    await f.close();
  }
});
test("session isolation, bounded history and authorized deletion", async () => {
  const f = await fixture();
  try {
    const a = await f.user("owner@example.com"),
      b = await f.user("other@example.com");
    const v = (await f.call("/api/interviews", "POST", start(), a)).data;
    for (const method of ["GET", "DELETE"])
      assert.equal(
        (await f.call("/api/interviews/" + v.id, method, undefined, b)).response
          .status,
        404,
      );
    assert.equal(
      (
        await f.call(
          "/api/interviews/" + v.id + "/answers",
          "POST",
          submission(v),
          b,
        )
      ).response.status,
      404,
    );
    assert.equal(
      (await f.call("/api/interviews", "GET", undefined, b)).data.items.length,
      0,
    );
    assert.equal(
      (await f.call("/api/interviews?limit=1", "GET", undefined, a)).data.items
        .length,
      1,
    );
    assert.equal(
      (await f.call("/api/interviews/" + v.id, "DELETE", undefined, a)).response
        .status,
      200,
    );
    assert.equal(
      (await f.call("/api/interviews/" + v.id, "GET", undefined, a)).response
        .status,
      404,
    );
  } finally {
    await f.close();
  }
});
test("invalid inputs and daily quotas do not silently create sessions", async () => {
  const f = await fixture({ dailyLimit: 1 });
  try {
    const u = await f.user("quota@example.com");
    assert.equal(
      (
        await f.call(
          "/api/interviews",
          "POST",
          { ...start(), resume: "short" },
          u,
        )
      ).response.status,
      422,
    );
    assert.equal(
      (await f.call("/api/interviews", "POST", start(), u)).response.status,
      201,
    );
    assert.equal(
      (await f.call("/api/interviews", "POST", start(), u)).response.status,
      429,
    );
  } finally {
    await f.close();
  }
});
test("live provider requires consent and reserves global budget", async () => {
  let calls = 0;
  const f = await fixture({
    mode: "live",
    globalDailyLimit: 1,
    interviewGenerate: async (input) => {
      calls++;
      return { output: demoPlan(input.profile), tokens: 30 };
    },
  });
  try {
    const u = await f.user("live@example.com");
    assert.equal(
      (await f.call("/api/interviews", "POST", start(), u)).response.status,
      422,
    );
    assert.equal(calls, 0);
    const v = (
      await f.call("/api/interviews", "POST", start(randomUUID(), true), u)
    ).data;
    assert.equal(v.mode, "live");
    assert.equal(calls, 1);
    assert.equal(
      (
        await f.call(
          "/api/interviews/" + v.id + "/answers",
          "POST",
          submission(v),
          u,
        )
      ).response.status,
      422,
    );
    assert.equal(
      (await f.call("/api/interviews", "POST", start(randomUUID(), true), u))
        .response.status,
      429,
    );
    assert.equal(calls, 1);
  } finally {
    await f.close();
  }
});
test("provider refusal, timeout and malformed question plan have clear errors", async () => {
  for (const [expected, generate] of [
    [
      502,
      async () => {
        throw Error("failure");
      },
    ],
    [504, async () => new Promise<never>(() => {})],
    [502, async () => ({ output: { questions: [] }, tokens: 0 })],
  ] as const) {
    const f = await fixture({
      mode: "live",
      timeout: 40,
      interviewGenerate: generate,
    });
    try {
      const u = await f.user("failure@example.com");
      assert.equal(
        (await f.call("/api/interviews", "POST", start(randomUUID(), true), u))
          .response.status,
        expected,
      );
      assert.equal(
        (await f.call("/api/interviews", "GET", undefined, u)).data.items
          .length,
        0,
      );
    } finally {
      await f.close();
    }
  }
});
test("invented feedback evidence is rejected and does not advance saved answer", async () => {
  const f = await fixture({
    mode: "live",
    interviewGenerate: async (input) => ({
      output:
        input.task === "plan"
          ? demoPlan(input.profile)
          : {
              ...demoReview(input.answer!, false),
              evidence: [
                {
                  quote: "fabricated qualification",
                  observation: "An unsupported claim.",
                },
              ],
            },
      tokens: 30,
    }),
  });
  try {
    const u = await f.user("evidence@example.com");
    const v = (
      await f.call("/api/interviews", "POST", start(randomUUID(), true), u)
    ).data;
    assert.equal(
      (
        await f.call(
          "/api/interviews/" + v.id + "/answers",
          "POST",
          submission(v, randomUUID(), true),
          u,
        )
      ).response.status,
      502,
    );
    assert.equal(
      (await f.call("/api/interviews/" + v.id, "GET", undefined, u)).data
        .version,
      0,
    );
  } finally {
    await f.close();
  }
});
test("duplicate in-flight writes are rejected, and locks clear after failure", async () => {
  let release!: () => void;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  const f = await fixture({
    mode: "live",
    timeout: 1000,
    interviewGenerate: async (input) => {
      if (input.task === "review") await wait;
      return {
        output:
          input.task === "plan"
            ? demoPlan(input.profile)
            : demoReview(input.answer!, false),
        tokens: 10,
      };
    },
  });
  try {
    const u = await f.user("concurrent@example.com");
    const v = (
      await f.call("/api/interviews", "POST", start(randomUUID(), true), u)
    ).data;
    const pending = f.call(
      "/api/interviews/" + v.id + "/answers",
      "POST",
      submission(v, randomUUID(), true),
      u,
    );
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(
      (
        await f.call(
          "/api/interviews/" + v.id + "/answers",
          "POST",
          submission(v, randomUUID(), true),
          u,
        )
      ).response.status,
      409,
    );
    assert.equal(
      (await f.call("/api/interviews/" + v.id, "DELETE", undefined, u)).response
        .status,
      409,
    );
    release();
    assert.equal((await pending).response.status, 200);
  } finally {
    release();
    await f.close();
  }
});
test("validation rejects invented profile quotes and unsupported praise", () => {
  const p = demoPlan(profile);
  assert.throws(() =>
    validatePlan(
      {
        ...p,
        questions: p.questions.map((q, i) =>
          i ? q : { ...q, contextQuote: "not in this resume" },
        ),
      },
      profile,
    ),
  );
  assert.throws(() =>
    validateReview({ ...demoReview(answer, false), evidence: [] }, answer),
  );
  assert.equal(
    validateReview(demoReview("I do not know.", false), "I do not know.")
      .strengths.length,
    0,
  );
});
test("JSON interview persistence survives restart and preserves legacy collections", async () => {
  const dir = await mkdtemp(join(tmpdir(), "interview-test-"));
  const file = join(dir, "data.json");
  let s = await new JsonStore(file).init();
  try {
    await s.insert("sources", {
      id: "legacy",
      ownerId: "a",
      title: "Old source",
      content: "Recoverable original data.",
      createdAt: "2026-01-01",
    });
    const v: Interview = {
      id: randomUUID(),
      ownerId: "a",
      profile,
      questions: demoPlan(profile).questions,
      cursor: 0,
      pendingFollowUp: null,
      followUpUsed: false,
      turns: [],
      status: "active",
      version: 0,
      createRequestId: randomUUID(),
      mode: "demo",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await s.insert("interviews", v);
    await s.close();
    s = await new JsonStore(file).init();
    assert.equal((await s.get("interviews", v.id))?.profile.role, profile.role);
    assert.ok(await s.get("sources", "legacy"));
  } finally {
    await s.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("authenticated Markdown export downloads real saved content, hides foreign sessions and escapes HTML", async () => {
  const f = await fixture();
  try {
    const u = await f.user("export@example.com"),
      other = await f.user("export-other@example.com");
    const v = (await f.call("/api/interviews", "POST", start(), u)).data;
    await f.call(
      "/api/interviews/" + v.id + "/answers",
      "POST",
      {
        ...submission(v),
        answer:
          "<script>alert(1)</script> I tested the API because access checks matter.",
      },
      u,
    );
    const r = await fetch(f.base + "/api/interviews/" + v.id + "/export", {
      headers: { Cookie: u.cookie },
    });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-disposition")!, /attachment/);
    assert.match(r.headers.get("content-type")!, /text\/markdown/);
    const text = await r.text();
    assert.match(text, /Local demo/);
    assert.match(text, /tested the API/);
    assert.doesNotMatch(text, /<script>/);
    assert.equal(
      (
        await fetch(f.base + "/api/interviews/" + v.id + "/export", {
          headers: { Cookie: other.cookie },
        })
      ).status,
      404,
    );
  } finally {
    await f.close();
  }
});
test("simulation gates answers and persists deduplicated owner-only interruption events", async () => {
  const f = await fixture();
  try {
    const u = await f.user("simulation@example.com"),
      other = await f.user("foreign@example.com");
    const { data: v } = await f.call(
      "/api/interviews",
      "POST",
      { ...start(), format: "simulation" },
      u,
    );
    assert.equal(v.format, "simulation");
    const path = "/api/interviews/" + v.id;
    assert.equal(
      (await f.call(path + "/answers", "POST", submission(v), u)).response
        .status,
      409,
    );
    const e = {
      id: randomUUID(),
      type: "fullscreen_exit",
      at: new Date().toISOString(),
    };
    assert.equal(
      (await f.call(path + "/events", "POST", e, other)).response.status,
      404,
    );
    assert.equal(
      (await f.call(path + "/events", "POST", e, u)).response.status,
      200,
    );
    await f.call(path + "/events", "POST", e, u);
    assert.equal(
      (await f.call(path, "GET", undefined, u)).data.integrity.length,
      1,
    );
    assert.equal(
      (
        await f.call(
          path + "/events",
          "POST",
          { ...e, type: "eye_tracking" },
          u,
        )
      ).response.status,
      422,
    );
    assert.equal(
      (
        await f.call(
          path + "/answers",
          "POST",
          {
            ...submission(v),
            environment: { fullscreen: true, camera: true, microphone: true },
          },
          u,
        )
      ).response.status,
      200,
    );
  } finally {
    await f.close();
  }
});
test("audio transcription requires ownership, consent and current version and does not persist raw media", async () => {
  let calls = 0;
  const f = await fixture({
    mode: "live",
    interviewGenerate: async () => ({ output: demoPlan(profile), tokens: 1 }),
    transcribe: async () => {
      calls++;
      return {
        transcript: "I measured database latency before adding caching.",
        tokens: 3,
      };
    },
  });
  try {
    const u = await f.user("audio@example.com"),
      other = await f.user("audio-foreign@example.com");
    const { data: v } = await f.call(
      "/api/interviews",
      "POST",
      { ...start(randomUUID(), true), format: "audio" },
      u,
    );
    const send = (client = u, extra: Record<string, string> = {}) =>
      fetch(f.base + "/api/interviews/" + v.id + "/transcribe", {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: client.cookie,
          "X-CSRF-Token": client.csrf,
          "Content-Type": "audio/wav",
          "X-Audio-Consent": "true",
          "X-Interview-Version": "0",
          ...extra,
        },
        body: Buffer.alloc(200),
      });
    assert.equal((await send(other)).status, 404);
    assert.equal((await send(u, { "X-Audio-Consent": "false" })).status, 422);
    assert.equal((await send(u, { "X-Interview-Version": "2" })).status, 409);
    const r = await send();
    assert.equal(r.status, 200);
    assert.match((await r.json()).transcript, /database latency/);
    assert.equal(calls, 1);
    const saved = await f.store.get("interviews", v.id);
    assert.equal(saved?.turns.length, 0);
    assert.equal(saved?.version, 0);
  } finally {
    await f.close();
  }
});
test("transcription provider failures and invalid output return recoverable errors", async () => {
  for (const output of ["error", "invalid", "empty"]) {
    const f = await fixture({
      mode: "live",
      interviewGenerate: async () => ({ output: demoPlan(profile), tokens: 1 }),
      transcribe: async () => {
        if (output === "error") throw Error("private provider error");
        return {
          transcript: output === "empty" ? "" : (null as unknown as string),
          tokens: 1,
        };
      },
    });
    try {
      const u = await f.user(output + "@example.com");
      const { data: v } = await f.call(
        "/api/interviews",
        "POST",
        { ...start(randomUUID(), true), format: "video" },
        u,
      );
      const r = await fetch(
        f.base + "/api/interviews/" + v.id + "/transcribe",
        {
          method: "POST",
          headers: {
            Origin: origin,
            Cookie: u.cookie,
            "X-CSRF-Token": u.csrf,
            "Content-Type": "audio/webm",
            "X-Audio-Consent": "true",
            "X-Interview-Version": "0",
          },
          body: Buffer.alloc(200),
        },
      );
      assert.equal(r.status, output === "empty" ? 422 : 502);
      assert.doesNotMatch(
        JSON.stringify(await r.json()),
        /private provider error/,
      );
    } finally {
      await f.close();
    }
  }
});
