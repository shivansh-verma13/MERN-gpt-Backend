import express from "express";
import { join } from "node:path";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Store, User, Session } from "./types.js";
import { hashPassword, checkPassword, secret, digest } from "./auth.js";
import { registerInterviews } from "./interview-routes.js";
import type { InterviewGenerate, Transcribe } from "./interview.js";
export type Config = {
  origin: string;
  production: boolean;
  demo: boolean;
  mode: "demo" | "live";
  dailyLimit: number;
  globalDailyLimit?: number;
  timeout: number;
  interviewGenerate?: InterviewGenerate;
  provider?: string;
  transcribe?: Transcribe;
  webRoot?: string;
};
export class HttpError extends Error {
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
const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  demo: u.demo,
});
export function createApp(store: Store, config: Config) {
  const app = express();
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
    const token = req.cookies.interview_session;
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
    res.cookie("interview_session", token, {
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
      provider: config.provider ?? "Demo",
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
      res.clearCookie("interview_session", {
        httpOnly: true,
        secure: config.production,
        sameSite: "lax",
        path: "/",
      });
      res.json({ ok: true });
    }),
  );
  registerInterviews(app, store, config, protect, wrap);
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
