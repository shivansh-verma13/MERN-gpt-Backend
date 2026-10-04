import serverless from "serverless-http";
import { initializeRuntime } from "../../dist/runtime.js";
export function createFunction(app) {
  const wrapped = serverless(app);
  return async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    const prefix = "/.netlify/functions/api";
    let path = event.path || "/";
    if (path.startsWith(prefix)) {
      const suffix = path.slice(prefix.length);
      path = suffix === "/health" ? "/health" : "/api" + suffix;
    }
    return wrapped({ ...event, path }, context);
  };
}
let cached;
export async function handler(event, context) {
  try {
    cached ??= initializeRuntime(true).then(({ app }) => createFunction(app));
    const fn = await cached;
    return await fn(event, context);
  } catch {
    cached = undefined;
    console.error(JSON.stringify({ event: "function_initialization_failed" }));
    return {
      statusCode: 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({
        error: "Service unavailable. Check server configuration and try again.",
      }),
    };
  }
}
