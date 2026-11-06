import { AsyncLocalStorage } from "node:async_hooks";
export interface SqlCursor {
  toArray(): Record<string, unknown>[];
}
export interface StudioStorage {
  sql: { exec(sql: string, ...params: unknown[]): SqlCursor };
  transactionSync<T>(fn: () => T): T;
  setAlarm(time: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}
export interface MediaObject {
  body: ReadableStream;
  size: number;
  httpEtag: string;
  range?: { offset: number; length: number };
  httpMetadata?: { contentType?: string };
}
export interface MediaBucket {
  put(key: string, value: unknown, options?: unknown): Promise<unknown>;
  get(key: string, options?: unknown): Promise<MediaObject | null>;
  delete(key: string): Promise<void>;
}
export interface Env {
  STUDIO: {
    getByName(name: string): { fetch(request: Request): Promise<Response> };
  };
  MEDIA: MediaBucket;
  ENCRYPTION_KEY: string;
  SETUP_TOKEN_HASH: string;
  STUDIO_ID?: string;
  OPENROUTER_API_KEY?: string;
  STUDIO_PASSWORD?: string;
}
export interface StudioContext {
  storage: StudioStorage;
}
const scope = new AsyncLocalStorage<{ ctx: StudioContext; env: Env }>();
export function runtime() {
  const value = scope.getStore();
  if (!value) throw Error("Studio context is unavailable");
  return value;
}
export function inStudio<T>(ctx: StudioContext, env: Env, fn: () => T): T {
  return scope.run({ ctx, env }, fn);
}

