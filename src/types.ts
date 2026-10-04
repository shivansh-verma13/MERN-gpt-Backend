export type Source = {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  createdAt: string;
};
export type Citation = {
  sourceId: string;
  title: string;
  chunkId: string;
  quote: string;
};
export type Answer = {
  answer: string;
  citations: Citation[];
  insufficient: boolean;
  mode: "demo" | "live";
  latencyMs: number;
  tokens: number;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  result?: Answer;
};
export type Thread = {
  id: string;
  ownerId: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
};
export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  demo: boolean;
  createdAt: string;
};
export type Session = {
  id: string;
  ownerId: string;
  expiresAt: Date;
  csrf: string;
};
export type Usage = { id: string; ownerId: string; day: string; count: number };
export type Tables = {
  users: User;
  sources: Source;
  threads: Thread;
  sessions: Session;
  usage: Usage;
};
export type Table = keyof Tables;
export interface Store {
  get<K extends Table>(table: K, id: string): Promise<Tables[K] | null>;
  find<K extends Table>(
    table: K,
    query: Partial<Tables[K]>,
    limit: number,
    offset?: number,
  ): Promise<Tables[K][]>;
  insert<K extends Table>(table: K, value: Tables[K]): Promise<void>;
  update<K extends Table>(
    table: K,
    id: string,
    query: Partial<Tables[K]>,
    patch: Partial<Tables[K]>,
  ): Promise<boolean>;
  remove<K extends Table>(
    table: K,
    id: string,
    query: Partial<Tables[K]>,
  ): Promise<boolean>;
  reserve(ownerId: string, day: string, limit: number): Promise<number>;
  close(): Promise<void>;
}
