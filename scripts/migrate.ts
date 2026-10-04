import "dotenv/config";
import { MongoStore } from "../src/store.js";
if (!process.env.MONGODB_URL)
  throw new Error("Set MONGODB_URL for a NEW dedicated database.");
const store = await new MongoStore(
  process.env.MONGODB_URL,
  process.env.MONGODB_DB ?? "briefcase_v2",
).init();
try {
  await store.migrate();
  console.log(
    "Migration v1 complete: unique IDs, owner indexes, session TTL, atomic quota indexes.",
  );
} finally {
  await store.close();
}
