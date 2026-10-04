import express from "express";
import { join } from "node:path";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Store, User, Session, Thread } from "./types.js";
import { hashPassword, checkPassword, secret, digest } from "./auth.js";
import { sampleSources } from "./demo.js";
import { retrieve } from "./retrieval.js";
import { answerQuestion } from "./ai.js";
import type { Generate } from "./ai.js";
export type Config = {
  origin: string;
  production: boolean;
  demo: boolean;
  mode: "demo" | "live";
  dailyLimit: number;
  globalDailyLimit?: number;
  timeout: number;
  generate?: Generate;
  webRoot?: string;
};
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(128),
});
const sourceInput = z.object({
  title: z.string().trim().min(1).max(100),
  content: z.string().trim().min(20).max(16000),
});
const questionInput = z.object({
  question: z.string().trim().min(3).max(1200),
  requestId: z.uuid(),
  consent: z.boolean(),
});
const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  demo: u.demo,
});
export function createApp(store: Store, config: Config) {
  const app = express();
  const inflight = new Set<string>();
  const buckets = new Map<string, { count: number; until: number }>();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.origin, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    const id = randomUUID();
    const start = performance.now();
    res.setHeader("X-Request-ID", id);
    res.setHeader("Cache-Control", "no-store");
    res.on("finish", () =>
      console.log(
        JSON.stringify({
          event: "request",
          id,
          method: req.method,
          status: res.statusCode,
          durationMs: Math.round(performance.now() - start),
        }),
      ),
    );
    next();
  });
  app.use("/api", (req, res, next) => {
    const now = Date.now();
    if (buckets.size > 2000)
      for (const [key, v] of buckets) if (v.until < now) buckets.delete(key);
    const isAuth = req.path.startsWith("/auth/");
    const key = (isAuth ? "auth:" : "api:") + (req.ip ?? "unknown");
    let b = buckets.get(key);
    if (!b || b.until < now) {
      b = { count: 0, until: now + 60000 };
      buckets.set(key, b);
    }
    if (++b.count > (isAuth ? 10 : 100)) {
      res.setHeader("Retry-After", "60");
      return res
        .status(429)
        .json({ error: "Too many requests. Try again in a minute." });
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== config.origin
    )
      return res.status(403).json({ error: "Untrusted request origin" });
    next();
  });
  const wrap =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => {
      fn(req, res).catch(next);
    };
  const auth = wrap(async (req, res) => {
    const token = req.cookies.briefcase_session;
    if (typeof token !== "string") throw new HttpError(401, "Please sign in.");
    const session = await store.get("sessions", digest(token));
    if (!session || new Date(session.expiresAt).getTime() < Date.now())
      throw new HttpError(401, "Session expired. Please sign in.");
    const user = await store.get("users", session.ownerId);
    if (!user) throw new HttpError(401, "Please sign in.");
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-csrf-token"] !== session.csrf
    )
      throw new HttpError(403, "Session validation failed. Refresh and retry.");
    res.locals.user = user;
    res.locals.session = session;
    res.locals.next();
  });
  const protect = (req: Request, res: Response, next: NextFunction) => {
    res.locals.next = next;
    auth(req, res, next);
  };
  const sessionFor = async (res: Response, user: User) => {
    const token = secret();
    const session: Session = {
      id: digest(token),
      ownerId: user.id,
      csrf: secret(),
      expiresAt: new Date(Date.now() + 86400000),
    };
    await store.insert("sessions", session);
    res.cookie("briefcase_session", token, {
      httpOnly: true,
      secure: config.production,
      sameSite: "lax",
      path: "/",
      maxAge: 86400000,
    });
    return { user: publicUser(user), csrf: session.csrf };
  };
  app.get(
    "/health",
    wrap(async (_req, res) => {
      await store.find("users", {}, 1);
      res.json({
        status: "ok",
        ai: config.mode,
        storage: config.demo ? "synthetic-demo" : "persistent",
      });
    }),
  );
  app.get("/api/config", (_req, res) =>
    res.json({
      demoEnabled: config.demo,
      mode: config.mode,
      dailyLimit: config.dailyLimit,
    }),
  );
  app.post(
    "/api/auth/register",
    wrap(async (req, res) => {
      if (config.demo)
        throw new HttpError(
          403,
          "Use the synthetic demo workspace. Account registration requires persistent MongoDB.",
        );
      const input = credentials
        .extend({ name: z.string().trim().min(2).max(70) })
        .parse(req.body);
      const user: User = {
        id: randomUUID(),
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        demo: false,
        createdAt: new Date().toISOString(),
      };
      try {
        await store.insert("users", user);
      } catch (e) {
        if ((e as { code?: number }).code === 11000)
          throw new HttpError(
            409,
            "An account with this email already exists.",
          );
        throw e;
      }
      res.status(201).json(await sessionFor(res, user));
    }),
  );
  app.post(
    "/api/auth/login",
    wrap(async (req, res) => {
      const { email, password } = credentials.parse(req.body);
      const user = (await store.find("users", { email }, 1))[0];
      const hash =
        user?.passwordHash ?? (await hashPassword("not-a-real-password"));
      const ok = await checkPassword(password, hash);
      if (!user || !ok || user.demo)
        throw new HttpError(401, "Email or password is incorrect.");
      res.json(await sessionFor(res, user));
    }),
  );
  app.post(
    "/api/auth/demo",
    wrap(async (_req, res) => {
      if (!config.demo) throw new HttpError(404, "Demo is disabled.");
      if ((await store.find("users", {}, 201)).length >= 200)
        throw new HttpError(429, "Demo workspace capacity reached.");
      const user: User = {
        id: randomUUID(),
        name: "Alex Morgan",
        email: randomUUID() + "@demo.invalid",
        passwordHash: "",
        demo: true,
        createdAt: new Date().toISOString(),
      };
      await store.insert("users", user);
      for (const s of sampleSources)
        await store.insert("sources", {
          ...s,
          id: randomUUID(),
          ownerId: user.id,
          createdAt: new Date().toISOString(),
        });
      res.status(201).json(await sessionFor(res, user));
    }),
  );
  app.get(
    "/api/auth/me",
    protect,
    wrap(async (_req, res) =>
      res.json({
        user: publicUser(res.locals.user),
        csrf: res.locals.session.csrf,
      }),
    ),
  );
  app.post(
    "/api/auth/logout",
    protect,
    wrap(async (_req, res) => {
      await store.remove("sessions", res.locals.session.id, {
        ownerId: res.locals.user.id,
      });
      res.clearCookie("briefcase_session", {
        httpOnly: true,
        secure: config.production,
        sameSite: "lax",
        path: "/",
      });
      res.json({ ok: true });
    }),
  );
  const page = (req: Request) => ({
    limit: Math.min(50, Math.max(1, Math.trunc(Number(req.query.limit)) || 20)),
    offset: Math.min(
      500,
      Math.max(0, Math.trunc(Number(req.query.offset)) || 0),
    ),
  });
  app.get(
    "/api/sources",
    protect,
    wrap(async (req, res) => {
      const { limit, offset } = page(req);
      const items = await store.find(
        "sources",
        { ownerId: res.locals.user.id },
        limit + 1,
        offset,
      );
      res.json({ items: items.slice(0, limit), hasMore: items.length > limit });
    }),
  );
  app.post(
    "/api/sources",
    protect,
    wrap(async (req, res) => {
      const ownerId = res.locals.user.id;
      if (inflight.has("source:" + ownerId))
        throw new HttpError(409, "Source save in progress.");
      inflight.add("source:" + ownerId);
      try {
        if ((await store.find("sources", { ownerId }, 51)).length >= 50)
          throw new HttpError(
            409,
            "This release supports up to 50 sources per workspace.",
          );
        const input = sourceInput.parse(req.body);
        const item = {
          ...input,
          id: randomUUID(),
          ownerId,
          createdAt: new Date().toISOString(),
        };
        await store.insert("sources", item);
        res.status(201).json(item);
      } finally {
        inflight.delete("source:" + ownerId);
      }
    }),
  );
  app.delete(
    "/api/sources/:id",
    protect,
    wrap(async (req, res) => {
      if (
        !(await store.remove("sources", String(req.params.id), {
          ownerId: res.locals.user.id,
        }))
      )
        throw new HttpError(404, "Source not found.");
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/threads",
    protect,
    wrap(async (req, res) => {
      const { limit, offset } = page(req);
      const items = await store.find(
        "threads",
        { ownerId: res.locals.user.id },
        limit + 1,
        offset,
      );
      res.json({
        items: items.slice(0, limit).map(({ messages, ...t }) => ({
          ...t,
          messageCount: messages.length,
        })),
        hasMore: items.length > limit,
      });
    }),
  );
  app.post(
    "/api/threads",
    protect,
    wrap(async (req, res) => {
      const title = z.string().trim().min(1).max(100).parse(req.body.title);
      const ownerId = res.locals.user.id;
      if ((await store.find("threads", { ownerId }, 101)).length >= 100)
        throw new HttpError(409, "Conversation limit reached.");
      const now = new Date().toISOString();
      const t: Thread = {
        id: randomUUID(),
        ownerId,
        title,
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      await store.insert("threads", t);
      res.status(201).json(t);
    }),
  );
  app.get(
    "/api/threads/:id",
    protect,
    wrap(async (req, res) => {
      const t = await store.get("threads", String(req.params.id));
      if (!t || t.ownerId !== res.locals.user.id)
        throw new HttpError(404, "Conversation not found.");
      res.json(t);
    }),
  );
  app.delete(
    "/api/threads/:id",
    protect,
    wrap(async (req, res) => {
      if (
        !(await store.remove("threads", String(req.params.id), {
          ownerId: res.locals.user.id,
        }))
      )
        throw new HttpError(404, "Conversation not found.");
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/threads/:id/questions",
    protect,
    wrap(async (req, res) => {
      const { question, requestId, consent } = questionInput.parse(req.body);
      const ownerId = res.locals.user.id;
      const id = String(req.params.id);
      const thread = await store.get("threads", id);
      if (!thread || thread.ownerId !== ownerId)
        throw new HttpError(404, "Conversation not found.");
      const existing = thread.messages.find(
        (m) => m.id === requestId + ":answer",
      );
      if (existing) return res.json(existing.result);
      if (thread.messages.length >= 40)
        throw new HttpError(
          409,
          "Start a new conversation to keep context bounded.",
        );
      const mode = res.locals.user.demo ? "demo" : config.mode;
      if (mode === "live" && !consent)
        throw new HttpError(
          422,
          "Please consent before sending your question and excerpts to OpenAI.",
        );
      if (inflight.has(id))
        throw new HttpError(409, "A question is already in progress.");
      inflight.add(id);
      const controller = new AbortController();
      const cancel = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on("close", cancel);
      const timeout = setTimeout(() => controller.abort(), config.timeout);
      try {
        const count = await store.reserve(
          ownerId,
          new Date().toISOString().slice(0, 10),
          config.dailyLimit,
        );
        if (count < 0)
          throw new HttpError(
            429,
            "Daily question limit reached. Try tomorrow.",
          );
        const sources = await store.find("sources", { ownerId }, 50);
        const chunks = retrieve(question, sources);
        if (mode === "live" && chunks.length) {
          const reserved = await store.reserve(
            "__provider_budget",
            new Date().toISOString().slice(0, 10),
            config.globalDailyLimit ?? 100,
          );
          if (reserved < 0)
            throw new HttpError(
              429,
              "The workspace AI budget is exhausted for today. Try tomorrow.",
            );
        }

        let result;
        try {
          result = await answerQuestion(
            question,
            chunks,
            mode,
            config.generate,
            controller.signal,
          );
        } catch {
          throw new HttpError(
            controller.signal.aborted ? 504 : 502,
            controller.signal.aborted
              ? "Request cancelled or timed out. Your question was not saved."
              : "The AI provider could not produce a valid, cited answer. Please retry.",
          );
        }
        if (controller.signal.aborted)
          throw new HttpError(504, "Request cancelled.");
        const now = new Date().toISOString();
        const messages = [
          ...thread.messages,
          {
            id: requestId,
            role: "user" as const,
            content: question,
            createdAt: now,
          },
          {
            id: requestId + ":answer",
            role: "assistant" as const,
            content: result.answer,
            createdAt: now,
            result,
          },
        ];
        if (
          !(await store.update(
            "threads",
            id,
            { ownerId, updatedAt: thread.updatedAt },
            {
              messages,
              updatedAt: now,
              title: thread.messages.length
                ? thread.title
                : question.slice(0, 70),
            },
          ))
        )
          throw new HttpError(
            409,
            "Conversation changed. Reload before retrying.",
          );
        console.log(
          JSON.stringify({
            event: "answer",
            mode,
            latencyMs: result.latencyMs,
            tokens: result.tokens,
            citations: result.citations.length,
          }),
        );
        res.json(result);
      } finally {
        clearTimeout(timeout);
        res.off("close", cancel);
        inflight.delete(id);
      }
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  if (config.webRoot) {
    app.use(express.static(config.webRoot, { index: false }));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(join(config.webRoot!, "index.html")),
    );
  }
  app.use((_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof z.ZodError)
        return res.status(422).json({
          error: "Please check the supplied fields.",
          fields: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      const status =
        error instanceof HttpError
          ? error.status
          : [400, 413].includes((error as { status?: number }).status ?? 0)
            ? (error as { status: number }).status
            : 500;
      if (status === 500)
        console.error(
          JSON.stringify({
            event: "request_error",
            type: (error as Error).name ?? "Unknown",
          }),
        );
      if (!res.headersSent)
        res.status(status).json({
          error:
            error instanceof HttpError
              ? error.message
              : status === 413
                ? "Request too large."
                : "The request could not be completed.",
        });
    },
  );
  return app;
}
