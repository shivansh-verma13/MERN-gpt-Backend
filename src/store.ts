import { MongoClient } from "mongodb";
import type { Document, Filter } from "mongodb";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import type { Store, Table, Tables } from "./types.js";
export class JsonStore implements Store {
  private rows: Record<Table, Record<string, unknown>> = {
    users: {},
    sources: {},
    threads: {},
    sessions: {},
    usage: {},
  };
  private queue: Promise<void> = Promise.resolve();
  constructor(private file?: string) {}
  async init() {
    if (this.file) {
      try {
        this.rows = JSON.parse(await readFile(this.file, "utf8"));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
    return this;
  }
  private async flush() {
    if (!this.file) return;
    const data = JSON.stringify(this.rows);
    const file = this.file;
    this.queue = this.queue.then(async () => {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file + ".tmp", data, { mode: 0o600 });
      await rename(file + ".tmp", file);
    });
    await this.queue;
  }
  async get<K extends Table>(table: K, id: string) {
    return structuredClone((this.rows[table][id] as Tables[K]) ?? null);
  }
  async find<K extends Table>(
    table: K,
    query: Partial<Tables[K]>,
    limit: number,
    offset = 0,
  ) {
    return structuredClone(
      Object.values(this.rows[table])
        .filter((v) =>
          Object.entries(query).every(
            ([k, val]) => (v as Record<string, unknown>)[k] === val,
          ),
        )
        .sort((a, b) =>
          String((b as Record<string, unknown>).createdAt ?? "").localeCompare(
            String((a as Record<string, unknown>).createdAt ?? ""),
          ),
        )
        .slice(offset, offset + limit) as Tables[K][],
    );
  }
  async insert<K extends Table>(table: K, value: Tables[K]) {
    if (this.rows[table][value.id]) throw new Error("Duplicate ID");
    if (
      table === "users" &&
      Object.values(this.rows.users).some(
        (u) =>
          (u as Tables["users"]).email === (value as Tables["users"]).email,
      )
    )
      throw Object.assign(new Error("Duplicate email"), { code: 11000 });
    (this.rows[table] as Record<string, unknown>)[value.id] =
      structuredClone(value);
    await this.flush();
  }
  async update<K extends Table>(
    table: K,
    id: string,
    query: Partial<Tables[K]>,
    patch: Partial<Tables[K]>,
  ) {
    const v = this.rows[table][id] as Tables[K] | undefined;
    if (
      !v ||
      !Object.entries(query).every(
        ([k, val]) => (v as unknown as Record<string, unknown>)[k] === val,
      )
    )
      return false;
    (this.rows[table] as Record<string, unknown>)[id] = {
      ...v,
      ...structuredClone(patch),
    };
    await this.flush();
    return true;
  }
  async remove<K extends Table>(
    table: K,
    id: string,
    query: Partial<Tables[K]>,
  ) {
    const v = await this.get(table, id);
    if (
      !v ||
      !Object.entries(query).every(
        ([k, val]) => (v as unknown as Record<string, unknown>)[k] === val,
      )
    )
      return false;
    delete this.rows[table][id];
    await this.flush();
    return true;
  }
  async reserve(ownerId: string, day: string, limit: number) {
    const id = ownerId + ":" + day;
    const current = this.rows.usage[id] as Tables["usage"] | undefined;
    const count = current?.count ?? 0;
    if (count >= limit) return -1;
    this.rows.usage[id] = { id, ownerId, day, count: count + 1 };
    await this.flush();
    return count + 1;
  }
  async close() {
    await this.queue;
  }
}
export class MongoStore implements Store {
  private client: MongoClient;
  constructor(
    url: string,
    private dbName: string,
  ) {
    this.client = new MongoClient(url, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
  }
  async init() {
    await this.client.connect();
    return this;
  }
  private collection(table: Table) {
    return this.client.db(this.dbName).collection(table);
  }
  async get<K extends Table>(table: K, id: string) {
    return (await this.collection(table).findOne(
      { id },
      { projection: { _id: 0 } },
    )) as Tables[K] | null;
  }
  async find<K extends Table>(
    table: K,
    query: Partial<Tables[K]>,
    limit: number,
    offset = 0,
  ) {
    return (await this.collection(table)
      .find(query as Filter<Document>, { projection: { _id: 0 } })
      .sort({ createdAt: -1, id: 1 })
      .skip(offset)
      .limit(limit)
      .toArray()) as unknown as Tables[K][];
  }
  async insert<K extends Table>(table: K, value: Tables[K]) {
    await this.collection(table).insertOne({ ...value });
  }
  async update<K extends Table>(
    table: K,
    id: string,
    query: Partial<Tables[K]>,
    patch: Partial<Tables[K]>,
  ) {
    const r = await this.collection(table).updateOne(
      { id, ...query },
      { $set: patch },
    );
    return r.matchedCount === 1;
  }
  async remove<K extends Table>(
    table: K,
    id: string,
    query: Partial<Tables[K]>,
  ) {
    return (
      (await this.collection(table).deleteOne({ id, ...query }))
        .deletedCount === 1
    );
  }
  async reserve(ownerId: string, day: string, limit: number) {
    const id = ownerId + ":" + day;
    try {
      await this.collection("usage").updateOne(
        { id },
        { $setOnInsert: { id, ownerId, day, count: 0 } },
        { upsert: true },
      );
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e;
    }
    const result = await this.collection("usage").findOneAndUpdate(
      { id, count: { $lt: limit } },
      { $inc: { count: 1 } },
      { returnDocument: "after" },
    );
    return (result?.count as number) ?? -1;
  }
  async migrate() {
    const db = this.client.db(this.dbName);
    for (const t of ["users", "sessions", "sources", "threads", "usage"])
      await db.collection(t).createIndex({ id: 1 }, { unique: true });
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db
      .collection("sessions")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db
      .collection("sources")
      .createIndex({ ownerId: 1, createdAt: -1, id: 1 });
    await db
      .collection("threads")
      .createIndex({ ownerId: 1, createdAt: -1, id: 1 });
    await db
      .collection("usage")
      .createIndex({ ownerId: 1, day: 1 }, { unique: true });
    await db
      .collection("migrations")
      .updateOne(
        { version: 1 },
        { $setOnInsert: { version: 1, appliedAt: new Date() } },
        { upsert: true },
      );
  }
  async close() {
    await this.client.close();
  }
}
