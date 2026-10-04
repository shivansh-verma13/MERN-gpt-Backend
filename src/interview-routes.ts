import { raw } from "express";
import type { Express, Request, Response, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Store } from "./types.js";
import type { Config } from "./app.js";
import { HttpError } from "./app.js";
import {
  ProfileInput,
  PlanOutput,
  ReviewOutput,
  validatePlan,
  validateReview,
  demoPlan,
  demoReview,
  activeQuestion,
  practiceReport,
  exportReview,
  FormatInput,
  IntegrityInput,
  TranscriptOutput,
} from "./interview.js";
import type { Interview, ModelRequest } from "./interview.js";

export function registerInterviews(
  app: Express,
  store: Store,
  config: Config,
  protect: RequestHandler,
  wrap: (
    fn: (req: Request, res: Response) => Promise<unknown>,
  ) => RequestHandler,
) {
  const locks = new Set<string>();
  const present = (v: Interview) => ({
    ...v,
    currentQuestion: activeQuestion(v),
    report: practiceReport(v),
  });
  async function own(id: string, ownerId: string) {
    const v = await store.get("interviews", id);
    if (!v || v.ownerId !== ownerId)
      throw new HttpError(404, "Practice session not found.");
    return v;
  }
  async function generate(
    req: Request,
    res: Response,
    input: ModelRequest,
    schema: z.ZodType,
    sessionMode?: "demo" | "live",
  ) {
    const controller = new AbortController();
    const closed = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on("close", closed);
    const timer = setTimeout(() => controller.abort(), config.timeout);
    const started = performance.now();
    try {
      const day = new Date().toISOString().slice(0, 10);
      if ((await store.reserve(res.locals.user.id, day, config.dailyLimit)) < 0)
        throw new HttpError(
          429,
          "Daily practice request limit reached. Try tomorrow.",
        );
      const mode = res.locals.user.demo ? "demo" : (sessionMode ?? config.mode);
      let result;
      if (mode === "demo")
        result = {
          output:
            input.task === "plan"
              ? demoPlan(input.profile)
              : demoReview(input.answer!, input.allowFollowUp ?? false),
          tokens: 0,
        };
      else {
        if (req.body.consent !== true)
          throw new HttpError(
            422,
            "Consent is required before sending interview context to the AI provider.",
          );
        if (
          (await store.reserve(
            "__provider_budget",
            day,
            config.globalDailyLimit ?? 30,
          )) < 0
        )
          throw new HttpError(429, "The daily AI request budget is exhausted.");
        if (!config.interviewGenerate)
          throw new HttpError(503, "AI provider is unavailable.");
        // A timeout must finish the API response even if an injected provider ignores its signal.
        result = await Promise.race([
          config.interviewGenerate(input, schema, controller.signal),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener(
              "abort",
              () => reject(new Error("Aborted")),
              { once: true },
            );
          }),
        ]);
      }
      if (controller.signal.aborted) throw new Error("Aborted");
      console.log(
        JSON.stringify({
          event: "interview_model",
          task: input.task,
          mode,
          latencyMs: Math.round(performance.now() - started),
          tokens: result.tokens,
        }),
      );
      return { ...result, latencyMs: Math.round(performance.now() - started) };
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(
        controller.signal.aborted ? 504 : 502,
        controller.signal.aborted
          ? "Practice request stopped or timed out. Retry with your answer intact."
          : "The AI provider could not return valid feedback. Your answer was not saved.",
      );
    } finally {
      clearTimeout(timer);
      res.off("close", closed);
    }
  }
  app.get(
    "/api/interviews",
    protect,
    wrap(async (req, res) => {
      const limit = Math.min(
        20,
        Math.max(1, Math.trunc(Number(req.query.limit)) || 10),
      );
      const offset = Math.min(
        100,
        Math.max(0, Math.trunc(Number(req.query.offset)) || 0),
      );
      const rows = await store.find(
        "interviews",
        { ownerId: res.locals.user.id },
        limit + 1,
        offset,
      );
      res.json({
        items: rows.slice(0, limit).map((v) => ({
          id: v.id,
          role: v.profile.role,
          focus: v.profile.focus,
          level: v.profile.level,
          status: v.status,
          mode: v.mode,
          answered: v.cursor,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
        })),
        hasMore: rows.length > limit,
      });
    }),
  );
  app.post(
    "/api/interviews",
    protect,
    wrap(async (req, res) => {
      const input = ProfileInput.extend({
        format: FormatInput.default("text"),
        requestId: z.uuid(),
        consent: z.boolean(),
      }).parse(req.body);
      const ownerId = res.locals.user.id;
      const lock = "create:" + ownerId;
      if (locks.has(lock))
        throw new HttpError(409, "Another practice session is being prepared.");
      locks.add(lock);
      try {
        const old = (
          await store.find(
            "interviews",
            { ownerId, createRequestId: input.requestId },
            1,
          )
        )[0];
        if (old) return res.json(present(old));
        if ((await store.find("interviews", { ownerId }, 51)).length >= 50)
          throw new HttpError(
            409,
            "Keep up to 50 sessions. Delete an old session first.",
          );
        if (config.mode === "live" && !res.locals.user.demo && !input.consent)
          throw new HttpError(
            422,
            "Please consent to the AI provider before starting.",
          );
        const profile = ProfileInput.parse(input);
        const result = await generate(
          req,
          res,
          { task: "plan", profile },
          PlanOutput,
        );
        let plan;
        try {
          plan = validatePlan(result.output, profile);
        } catch {
          throw new HttpError(
            502,
            "Question plan failed validation. Please retry.",
          );
        }
        const now = new Date().toISOString();
        const interview: Interview = {
          id: randomUUID(),
          ownerId,
          format: input.format,
          integrity: [],
          profile,
          questions: plan.questions,
          cursor: 0,
          pendingFollowUp: null,
          followUpUsed: false,
          turns: [],
          status: "active",
          version: 0,
          createRequestId: input.requestId,
          mode: res.locals.user.demo ? "demo" : config.mode,
          createdAt: now,
          updatedAt: now,
        };
        await store.insert("interviews", interview);
        res.status(201).json(present(interview));
      } finally {
        locks.delete(lock);
      }
    }),
  );
  app.get(
    "/api/interviews/:id/export",
    protect,
    wrap(async (req, res) => {
      const v = await own(String(req.params.id), res.locals.user.id);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="Interview_Lab_Review.md"',
      );
      res.send(exportReview(v));
    }),
  );
  app.get(
    "/api/interviews/:id",
    protect,
    wrap(async (req, res) =>
      res.json(present(await own(String(req.params.id), res.locals.user.id))),
    ),
  );
  app.delete(
    "/api/interviews/:id",
    protect,
    wrap(async (req, res) => {
      const id = String(req.params.id);
      if (locks.has(id))
        throw new HttpError(
          409,
          "Wait for the current feedback request before deleting.",
        );
      if (
        !(await store.remove("interviews", id, { ownerId: res.locals.user.id }))
      )
        throw new HttpError(404, "Practice session not found.");
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/interviews/:id/events",
    protect,
    wrap(async (req, res) => {
      const input = IntegrityInput.parse(req.body);
      const id = String(req.params.id);
      if (locks.has(id))
        throw new HttpError(
          409,
          "Session update in progress; retry this event.",
        );
      locks.add(id);
      try {
        const v = await own(id, res.locals.user.id);
        if (v.format !== "simulation")
          throw new HttpError(
            422,
            "Integrity events are for simulation sessions.",
          );
        const events = v.integrity ?? [];
        if (events.some((e) => e.id === input.id))
          return res.json({ ok: true });
        if (events.length >= 100)
          throw new HttpError(429, "Integrity log is full.");
        await store.update(
          "interviews",
          id,
          { ownerId: v.ownerId, version: v.version },
          { integrity: [...events, input] },
        );
        res.json({ ok: true });
      } finally {
        locks.delete(id);
      }
    }),
  );
  app.post(
    "/api/interviews/:id/transcribe",
    protect,
    raw({
      type: ["audio/webm", "audio/ogg", "audio/mp4", "audio/wav"],
      limit: "4mb",
    }),
    wrap(async (req, res) => {
      const id = String(req.params.id);
      const v = await own(id, res.locals.user.id);
      if (
        !req.get("X-Interview-Version") ||
        Number(req.get("X-Interview-Version")) !== v.version
      )
        throw new HttpError(
          409,
          "Session changed. Reload before transcribing.",
        );
      if (v.status !== "active")
        throw new HttpError(409, "Session is complete.");
      if (!Buffer.isBuffer(req.body) || req.body.length < 100)
        throw new HttpError(422, "Send an audio clip in a supported format.");
      if (req.get("X-Audio-Consent") !== "true")
        throw new HttpError(422, "Audio processing consent is required.");
      if (v.mode !== "live" || !config.transcribe)
        throw new HttpError(
          503,
          "Live Gemini transcription is unavailable. Use the typed answer.",
        );
      if (locks.has(id))
        throw new HttpError(409, "A session request is already running.");
      locks.add(id);
      const controller = new AbortController();
      const close = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on("close", close);
      const timer = setTimeout(() => controller.abort(), config.timeout);
      const started = performance.now();
      try {
        const day = new Date().toISOString().slice(0, 10);
        if ((await store.reserve(v.ownerId, day, config.dailyLimit)) < 0)
          throw new HttpError(429, "Daily practice request limit reached.");
        if (
          (await store.reserve(
            "__provider_budget",
            day,
            config.globalDailyLimit ?? 30,
          )) < 0
        )
          throw new HttpError(429, "Daily AI budget reached.");
        const result = await Promise.race([
          config.transcribe(
            req.body,
            String(req.get("Content-Type")).split(";")[0],
            controller.signal,
          ),
          new Promise<never>((_, reject) =>
            controller.signal.addEventListener(
              "abort",
              () => reject(new Error("Aborted")),
              { once: true },
            ),
          ),
        ]);
        const output = TranscriptOutput.parse(result);
        if (!output.transcript.trim())
          throw new HttpError(
            422,
            "No intelligible speech found. Retry or type your answer.",
          );
        console.log(
          JSON.stringify({
            event: "transcription",
            latencyMs: Math.round(performance.now() - started),
            tokens: result.tokens,
          }),
        );
        res.json(output);
      } catch (e) {
        if (e instanceof HttpError) throw e;
        throw new HttpError(
          controller.signal.aborted ? 504 : 502,
          "Transcription failed. Your clip stays available for retry.",
        );
      } finally {
        clearTimeout(timer);
        res.off("close", close);
        locks.delete(id);
      }
    }),
  );
  app.post(
    "/api/interviews/:id/answers",
    protect,
    wrap(async (req, res) => {
      const input = z
        .object({
          answer: z.string().trim().min(10).max(5000),
          requestId: z.uuid(),
          version: z.number().int().min(0).max(4),
          consent: z.boolean(),
          environment: z
            .object({
              fullscreen: z.boolean(),
              camera: z.boolean(),
              microphone: z.boolean(),
            })
            .optional(),
        })
        .parse(req.body);
      const id = String(req.params.id);
      const ownerId = res.locals.user.id;
      if (locks.has(id))
        throw new HttpError(409, "Feedback is already in progress.");
      locks.add(id);
      try {
        const interview = await own(id, ownerId);
        if (interview.turns.some((t) => t.requestId === input.requestId))
          return res.json(present(interview));
        if (interview.status === "completed")
          throw new HttpError(
            409,
            "This session is complete. Start another round.",
          );
        if (interview.version !== input.version)
          throw new HttpError(
            409,
            "This session changed. Reload before submitting.",
          );
        if (interview.mode === "live" && !input.consent)
          throw new HttpError(
            422,
            "Please consent before requesting AI feedback.",
          );
        if (
          interview.format === "simulation" &&
          (!input.environment?.fullscreen ||
            !input.environment.camera ||
            !input.environment.microphone)
        )
          throw new HttpError(
            409,
            "Resume fullscreen with your camera and microphone before answering.",
          );
        const question = activeQuestion(interview)!;
        const kind = interview.pendingFollowUp
          ? ("follow-up" as const)
          : ("primary" as const);
        const allowFollowUp = !interview.followUpUsed && kind === "primary";
        const result = await generate(
          req,
          res,
          {
            task: "review",
            profile: interview.profile,
            question,
            answer: input.answer,
            allowFollowUp,
          },
          ReviewOutput,
          interview.mode,
        );
        let review;
        try {
          review = validateReview(result.output, input.answer);
        } catch {
          throw new HttpError(
            502,
            "Feedback evidence failed validation. Your answer was not saved.",
          );
        }
        const followUp = allowFollowUp ? review.followUp : null;
        review = { ...review, followUp };
        const cursor = followUp ? interview.cursor : interview.cursor + 1;
        const now = new Date().toISOString();
        const patch = {
          turns: [
            ...interview.turns,
            {
              requestId: input.requestId,
              question,
              answer: input.answer,
              kind,
              review,
              createdAt: now,
              latencyMs: result.latencyMs,
              tokens: result.tokens,
            },
          ],
          cursor,
          pendingFollowUp: followUp,
          followUpUsed: interview.followUpUsed || Boolean(followUp),
          status: cursor === 3 ? ("completed" as const) : ("active" as const),
          version: interview.version + 1,
          updatedAt: now,
        };
        if (
          !(await store.update(
            "interviews",
            id,
            { ownerId, version: interview.version },
            patch,
          ))
        )
          throw new HttpError(409, "Session changed. Reload before retrying.");
        res.json(present({ ...interview, ...patch }));
      } finally {
        locks.delete(id);
      }
    }),
  );
}
