import serverless from "serverless-http";
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
// Keep browser cookies same-origin while the API uses allowlisted Render egress.
export function createProxy(origin, request = fetch) {
  const target = new URL(origin);
  if (target.protocol !== "https:" || !target.hostname.endsWith(".onrender.com") ||
      target.username || target.password || target.pathname !== "/" || target.search || target.hash)
    throw new Error("API_ORIGIN must be an HTTPS Render service origin");
  return async (event) => {
    let path = event.path || "/";
    if (path.startsWith("/.netlify/functions/api")) {
      const suffix = path.slice("/.netlify/functions/api".length);
      path = suffix === "/health" ? "/health" : "/api" + suffix;
    }
    if (!(path === "/health" || path.startsWith("/api/")) ||
        !["GET", "HEAD", "POST", "DELETE", "OPTIONS"].includes(event.httpMethod))
      return {statusCode:404,body:JSON.stringify({error:"Route not found."})};
    const headers = {};
    for (const [key, value] of Object.entries(event.headers || {}))
      if (["origin", "cookie", "content-type", "x-csrf-token", "x-audio-consent", "x-interview-version"].includes(key.toLowerCase()))
        headers[key] = value;
    const query = new URLSearchParams();
    for (const [key, values] of Object.entries(event.multiValueQueryStringParameters || {}))
      for (const value of values) query.append(key, value);
    if (!event.multiValueQueryStringParameters)
      for (const [key, value] of Object.entries(event.queryStringParameters || {}))
        query.append(key, value);
    try {
      const response = await request(target.origin + path + (query.size ? "?" + query : ""), {
        method:event.httpMethod, headers, redirect:"error", signal:AbortSignal.timeout(55000),
        ...(["GET", "HEAD"].includes(event.httpMethod) ? {} : {
          body:event.isBase64Encoded ? Buffer.from(event.body || "", "base64") : event.body || "",
        }),
      });
      const out = {"Cache-Control":"no-store"};
      for (const key of ["content-type", "content-disposition", "x-request-id", "retry-after"])
        if (response.headers.has(key)) out[key] = response.headers.get(key);
      const cookies = response.headers.getSetCookie();
      return {statusCode:response.status,headers:out,
        ...(cookies.length ? {multiValueHeaders:{"Set-Cookie":cookies}} : {}),
        body:Buffer.from(await response.arrayBuffer()).toString("base64"),isBase64Encoded:true};
    } catch {
      return {statusCode:503,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Retry-After":"5"},
        body:JSON.stringify({error:"The interview server is starting or unavailable. Please retry in a moment."})};
    }
  };
}
let cached;
export async function handler(event, context) {
  try {
    if (process.env.API_ORIGIN) return await createProxy(process.env.API_ORIGIN)(event);
    cached ??= import("../../dist/runtime.js")
      .then(({ initializeRuntime }) => initializeRuntime(true))
      .then(({ app }) => createFunction(app));
    const fn = await cached;
    return await fn(event, context);
  } catch (error) {
    cached = undefined;
    // Classify startup failures without logging messages, URIs or credentials.
    const category = error?.name === "MongoServerSelectionError"
      ? "database_connection"
      : error?.name === "MongoServerError"
        ? "database_operation"
        : "runtime_configuration";
    console.error(JSON.stringify({ event: "function_initialization_failed", category,
      ...(Number.isInteger(error?.code) ? { code: error.code } : {}) }));
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
