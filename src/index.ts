import { initializeRuntime } from "./runtime.js";
const { app, store, live, useMongo } = await initializeRuntime();
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
