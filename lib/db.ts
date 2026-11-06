import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Kind, Row } from "./domain.ts";
export const dataDir = resolve(process.env.DATA_DIR || "data");
mkdirSync(dataDir, { recursive: true });
mkdirSync(resolve(dataDir, "media"), { recursive: true });
export const db = new DatabaseSync(resolve(dataDir, "vyral.sqlite"));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,brand TEXT NOT NULL,kind TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS records_brand_kind ON records(brand,kind);
 CREATE TABLE IF NOT EXISTS secrets(name TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS revisions(id TEXT PRIMARY KEY,project TEXT NOT NULL,brand TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS worker_health(id INTEGER PRIMARY KEY,last_seen TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires INTEGER NOT NULL);
`);
export function list(kind: Kind, brand?: string): Row[] {
  return (
    db
      .prepare(
        `SELECT data FROM records WHERE kind=?${brand ? " AND brand=?" : ""} ORDER BY created DESC`,
      )
      .all(...(brand ? [kind, brand] : [kind])) as { data: string }[]
  ).map((x) => JSON.parse(x.data));
}
export function get(id: string, brand?: string): Row {
  const x = db.prepare("SELECT data FROM records WHERE id=?").get(id) as
    | { data: string }
    | undefined;
  if (!x) throw Error("Record not found");
  const r = JSON.parse(x.data);
  if (brand && r.brandId !== brand) throw Error("Record not found");
  return r;
}
export function save(
  kind: Kind,
  brandId: string,
  data: Record<string, unknown>,
  id: string = randomUUID(),
): Row {
  const old = db.prepare("SELECT data FROM records WHERE id=?").get(id) as
    | { data: string }
    | undefined;
  const prior = old ? JSON.parse(old.data) : null;
  if (prior && (prior.brandId !== brandId || prior.kind !== kind))
    throw Error("Record scope mismatch");
  const now = new Date().toISOString();
  const r = {
    ...prior,
    ...data,
    id,
    kind,
    brandId,
    createdAt: prior?.createdAt || now,
    updatedAt: now,
  } as Row;
  db.prepare(
    "INSERT INTO records VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated",
  ).run(id, brandId, kind, JSON.stringify(r), r.createdAt, now);
  return r;
}
export function audit(
  brand: string,
  name: string,
  details: Record<string, unknown> = {},
) {
  return save("audit", brand, { name, ...details });
}
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function enqueue(
  brand: string,
  type: string,
  payload: Record<string, unknown>,
  key: string,
  runAt = new Date().toISOString(),
) {
  const existing = list("job", brand).find((j) => j.key === key);
  if (existing) return existing;
  return save("job", brand, {
    name: type,
    type,
    payload,
    key,
    status: "queued",
    attempts: 0,
    runAt,
  });
}
export function revision(project: Row, composition: unknown) {
  const id = randomUUID();
  db.prepare("INSERT INTO revisions VALUES(?,?,?,?,?)").run(
    id,
    project.id,
    project.brandId,
    JSON.stringify(composition),
    new Date().toISOString(),
  );
  return id;
}
