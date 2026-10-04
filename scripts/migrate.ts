import "dotenv/config";
import { MongoStore } from "../src/store.js";
if (!process.env.MONGODB_URL)
  throw new Error("Set MONGODB_URL for a NEW dedicated database.");
const store = await new MongoStore(
  process.env.MONGODB_URL,
  process.env.MONGODB_DB ?? "interview_lab_v1",
).init();
try {
  await store.migrate();
  console.log(
    "Migrations v1/v2 complete: unique IDs, owner indexes, session TTL, atomic quota and interview replay indexes. Refer to deployment documentation before running.",
  );
} finally {
  await store.close();
}
