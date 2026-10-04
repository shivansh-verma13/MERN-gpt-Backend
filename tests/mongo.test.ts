import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import { demoPlan } from "../src/interview.js";
import type { Interview, Profile } from "../src/interview.js";
import { MongoStore } from "../src/store.js";
test("MongoDB indexes, isolation, atomic quotas and restart persistence", async () => {
  const server = await MongoMemoryServer.create({
    binary: { version: "7.0.14" },
  });
  const url = server.getUri();
  let store = await new MongoStore(url, "interview_lab_test").init();
  try {
    await store.migrate();
    await store.migrate();
    await store.insert("sources", {
      id: "source-a",
      ownerId: "a",
      title: "Private plan",
      content: "Synthetic test source only.",
      createdAt: "2026-10-04",
    });
    assert.equal((await store.find("sources", { ownerId: "b" }, 50)).length, 0);
    assert.equal(
      await store.update(
        "sources",
        "source-a",
        { ownerId: "b" },
        { title: "wrong" },
      ),
      false,
    );
    assert.equal(
      await store.remove("sources", "source-a", { ownerId: "b" }),
      false,
    );
    assert.equal(
      await store.update(
        "sources",
        "source-a",
        { ownerId: "a" },
        { title: "Updated plan" },
      ),
      true,
    );
    const results = await Promise.all(
      Array.from({ length: 20 }, () => store.reserve("a", "2026-10-04", 5)),
    );
    assert.equal(results.filter((r) => r > 0).length, 5);
    await store.close();
    store = await new MongoStore(url, "interview_lab_test").init();
    assert.equal(
      (await store.get("sources", "source-a"))?.title,
      "Updated plan",
    );
    assert.equal(await store.reserve("a", "2026-10-04", 5), -1);
    const profile: Profile = {
      role: "Backend Engineer",
      level: "early-career",
      focus: "backend",
      resume: "Synthetic engineer built a MongoDB-backed API with tests.",
      job: "Build reliable backend APIs with authentication and database query optimization.",
    };
    const practice: Interview = {
      id: "interview-a",
      ownerId: "a",
      profile,
      questions: demoPlan(profile).questions,
      cursor: 0,
      pendingFollowUp: null,
      followUpUsed: false,
      turns: [],
      status: "active",
      version: 0,
      createRequestId: "create-a",
      mode: "demo",
      createdAt: "2026-10-04",
      updatedAt: "2026-10-04",
    };
    await store.insert("interviews", practice);
    assert.equal(
      (await store.find("interviews", { ownerId: "b" }, 20)).length,
      0,
    );
    assert.equal(
      await store.update(
        "interviews",
        practice.id,
        { ownerId: "b", version: 0 },
        { cursor: 1 },
      ),
      false,
    );
    const writes = await Promise.all(
      [1, 2].map((cursor) =>
        store.update(
          "interviews",
          practice.id,
          { ownerId: "a", version: 0 },
          { cursor, version: 1 },
        ),
      ),
    );
    assert.equal(writes.filter(Boolean).length, 1);
    await assert.rejects(
      store.insert("interviews", { ...practice, id: "duplicate-create" }),
    );
    await store.close();
    store = await new MongoStore(url, "interview_lab_test").init();
    assert.equal((await store.get("interviews", practice.id))?.version, 1);
    await store.insert("sessions", {
      id: "hash",
      ownerId: "a",
      csrf: "token",
      expiresAt: new Date(),
    });
    assert.ok((await store.get("sessions", "hash"))?.expiresAt instanceof Date);
  } finally {
    await store.close();
    await server.stop();
  }
});
