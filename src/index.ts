import "dotenv/config";
import { resolve } from "node:path";
import { JsonStore, MongoStore } from "./store.js";
import { createApp } from "./app.js";
import {
  geminiInterviewProvider,
  openAIInterviewProvider,
} from "./interview-provider.js";
const production = process.env.NODE_ENV === "production";
const demo = process.env.DEMO_MODE === "true";
const useMongo = process.env.STORE === "mongo";
if (!useMongo && !demo)
  throw new Error("MongoDB is required outside explicit demo mode.");
if (demo && ["openai", "gemini"].includes(process.env.AI_PROVIDER ?? "demo"))
  throw new Error("Public synthetic demo mode cannot spend provider credits.");
if (useMongo && !process.env.MONGODB_URL)
  throw new Error("MONGODB_URL required");
const store = useMongo
  ? await new MongoStore(
      process.env.MONGODB_URL!,
      process.env.MONGODB_DB ?? "interview_lab_v1",
    ).init()
  : await new JsonStore(
      process.env.DEMO_FILE ?? ".data/interview-demo.json",
    ).init();
if (store instanceof MongoStore) await store.migrate();
const provider = process.env.AI_PROVIDER ?? "demo";
if (!["demo", "gemini", "openai"].includes(provider))
  throw new Error("AI_PROVIDER must be demo, gemini, or openai.");
const live = provider !== "demo";
if (provider === "gemini" && !process.env.GEMINI_API_KEY)
  throw new Error("GEMINI_API_KEY required");
if (provider === "openai" && !process.env.OPENAI_API_KEY)
  throw new Error("OPENAI_API_KEY required");
const timeout = Math.min(
  30000,
  Math.max(1000, Number(process.env.AI_TIMEOUT_MS) || 25000),
);
const app = createApp(store, {
  globalDailyLimit: Math.min(
    500,
    Math.max(1, Number(process.env.AI_GLOBAL_DAILY_LIMIT) || 30),
  ),
  webRoot: process.env.WEB_DIST ? resolve(process.env.WEB_DIST) : undefined,
  origin: process.env.APP_ORIGIN ?? "http://localhost:5174",
  production,
  demo,
  mode: live ? "live" : "demo",
  dailyLimit: Math.min(
    50,
    Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 10),
  ),
  timeout,
  provider:
    provider === "gemini"
      ? "Gemini"
      : provider === "openai"
        ? "OpenAI"
        : "Local demo",
  interviewGenerate:
    provider === "gemini"
      ? geminiInterviewProvider(
          process.env.GEMINI_API_KEY!,
          process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
          timeout,
        )
      : provider === "openai"
        ? openAIInterviewProvider(
            process.env.OPENAI_API_KEY!,
            process.env.OPENAI_MODEL ?? "gpt-4o-mini",
            timeout,
          )
        : undefined,
});
const server = app.listen(Number(process.env.PORT) || 5002, "0.0.0.0", () =>
  console.log(
    JSON.stringify({
      event: "ready",
      ai: live ? "live" : "demo",
      storage: useMongo ? "mongo" : "json-demo",
    }),
  ),
);
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => {
    const timer = setTimeout(() => process.exit(1), 10000);
    timer.unref();
    server.close(() => {
      store
        .close()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
  });
