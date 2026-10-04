import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { JsonStore } from "../src/store.js";
// Factory tests use the supplied app; runtime initialization is lazy in the handler.
// @ts-expect-error JavaScript function adapter has no declaration file.
import { createFunction, createProxy } from "../netlify/functions/api.mjs";
test("Render proxy preserves secure cookies, CSRF, audio bytes and bounded routing", async () => {
  let captured: { url: string; options: RequestInit } | undefined;
  const fn = createProxy("https://interview-test.onrender.com", async (url: string, options: RequestInit) => {
    captured = { url, options };
    return new Response('{"transcript":"synthetic answer"}', { status: 200, headers: {
      "Content-Type":"application/json", "Set-Cookie":"interview_session=synthetic; Secure; HttpOnly; SameSite=Lax; Path=/",
    }});
  });
  const audio = Buffer.from([0, 1, 255, 3]);
  const response = await fn({ path:"/.netlify/functions/api/interviews/synthetic/transcribe", httpMethod:"POST",
    headers:{Origin:"https://interview-test.netlify.app",Cookie:"interview_session=synthetic","X-CSRF-Token":"csrf","X-Audio-Consent":"true","Content-Type":"audio/webm",Authorization:"ignored"},
    body:audio.toString("base64"),isBase64Encoded:true,queryStringParameters:{limit:"2"} });
  assert.equal(captured?.url,"https://interview-test.onrender.com/api/interviews/synthetic/transcribe?limit=2");
  assert.deepEqual(captured?.options.body,audio);
  assert.equal((captured?.options.headers as Record<string,string>)["X-CSRF-Token"],"csrf");
  assert.equal((captured?.options.headers as Record<string,string>).Authorization,undefined);
  assert.equal(response.headers["Cache-Control"],"no-store");
  assert.match(response.multiValueHeaders["Set-Cookie"][0],/Secure; HttpOnly/);
  assert.equal(JSON.parse(Buffer.from(response.body,"base64").toString()).transcript,"synthetic answer");
  assert.equal((await fn({path:"//foreign.example/api",httpMethod:"GET"})).statusCode,404);
  assert.throws(()=>createProxy("http://interview-test.onrender.com"));
  assert.throws(()=>createProxy("https://foreign.example"));
});
test("Render proxy returns a recoverable error without leaking upstream failures", async () => {
  const fn=createProxy("https://interview-test.onrender.com",async()=>{throw new Error("private upstream details");});
  const response=await fn({path:"/health",httpMethod:"GET"});
  assert.equal(response.statusCode,503);
  assert.equal(response.headers["Retry-After"],"5");
  assert.ok(!response.body.includes("private upstream details"));
});
test("Netlify adapter preserves API routes, secure cookies, CSRF, ownership and base64 audio parsing", async () => {
  const store = await new JsonStore().init();
  const origin = "https://interview-test.netlify.app";
  const fn = createFunction(
    createApp(store, {
      origin,
      production: true,
      demo: false,
      mode: "demo",
      dailyLimit: 10,
      timeout: 100,
    }),
  );
  const call = async (
    path: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
    base64 = false,
  ) => {
    const result = await fn(
      {
        path,
        httpMethod: method,
        headers: { origin, "content-type": "application/json", ...headers },
        body: body === undefined ? null : base64 ? body : JSON.stringify(body),
        isBase64Encoded: base64,
        queryStringParameters: {},
        requestContext: { identity: { sourceIp: "127.0.0.1" } },
      },
      {},
    );
    return { ...result, data: JSON.parse(result.body) };
  };
  try {
    assert.equal(
      (await call("/.netlify/functions/api/health")).statusCode,
      200,
    );
    const r = await call("/.netlify/functions/api/auth/register", "POST", {
      name: "Adapter Test",
      email: "adapter@example.com",
      password: "Synthetic-Test-123!",
    });
    assert.equal(r.statusCode, 201);
    const cookieHeader = Object.entries({
      ...r.headers,
      ...r.multiValueHeaders,
    }).find(([k]) => k.toLowerCase() === "set-cookie")?.[1];
    const cookie = Array.isArray(cookieHeader)
      ? cookieHeader[0]
      : String(cookieHeader);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /HttpOnly/);
    const auth = { cookie: cookie.split(";")[0], "x-csrf-token": r.data.csrf };
    assert.equal(
      (await call("/api/auth/me", "GET", undefined, auth)).statusCode,
      200,
    );
    assert.equal(
      (
        await call(
          "/.netlify/functions/api/interviews",
          "POST",
          {},
          { ...auth, "x-csrf-token": "bad" },
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call(
          "/.netlify/functions/api/interviews/missing/transcribe",
          "POST",
          Buffer.alloc(200).toString("base64"),
          {
            ...auth,
            "content-type": "audio/webm",
            "x-audio-consent": "true",
            "x-interview-version": "0",
          },
          true,
        )
      ).statusCode,
      404,
    );
    const created = await call(
      "/.netlify/functions/api/interviews",
      "POST",
      {
        role: "Backend Engineer",
        level: "early-career",
        focus: "backend",
        resume:
          "Synthetic developer built Express services and tested MongoDB ownership checks.",
        job: "Build Node APIs with validation, authorization and database indexes for a synthetic role.",
        requestId: crypto.randomUUID(),
        consent: false,
        format: "audio",
      },
      auth,
    );
    assert.equal(created.statusCode, 201);
    const audio = await call(
      "/.netlify/functions/api/interviews/" + created.data.id + "/transcribe",
      "POST",
      Buffer.alloc(200).toString("base64"),
      {
        ...auth,
        "content-type": "audio/webm",
        "x-audio-consent": "true",
        "x-interview-version": "0",
      },
      true,
    );
    assert.equal(audio.statusCode, 503); // Parsed binary correctly; explicitly no live provider in this fixture.
  } finally {
    await store.close();
  }
});
