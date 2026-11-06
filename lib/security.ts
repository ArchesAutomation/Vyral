import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./db.ts";
import { validOwnerPassword } from "./owner.ts";
export function configured() {
  return (
    validOwnerPassword(process.env.STUDIO_PASSWORD) &&
    (process.env.SESSION_SECRET?.length || 0) >= 32
  );
}
export function checkPassword(value: string) {
  if (!configured()) return false;
  const a = createHash("sha256").update(value).digest(),
    b = createHash("sha256").update(process.env.STUDIO_PASSWORD!).digest();
  return timingSafeEqual(a, b);
}
export function session() {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES(?,?)").run(
    createHash("sha256").update(token).digest("hex"),
    Date.now() + 7 * 86400000,
  );
  return token;
}
export function authorized(req: Request) {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("vyral_session="))
    ?.slice(14);
  if (!token) return false;
  const row = db
    .prepare("SELECT expires FROM sessions WHERE token=?")
    .get(createHash("sha256").update(token).digest("hex")) as
    | { expires: number }
    | undefined;
  return !!row && row.expires > Date.now();
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.host === req.headers.get("host")
    );
  } catch {
    return false;
  }
}
function key() {
  const k = process.env.ENCRYPTION_KEY;
  if (!k || !/^[a-f0-9]{64}$/i.test(k))
    throw Error("Set ENCRYPTION_KEY to 64 hexadecimal characters");
  return Buffer.from(k, "hex");
}
export function encrypt(value: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv),
    data = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return [
    iv.toString("hex"),
    c.getAuthTag().toString("hex"),
    data.toString("hex"),
  ].join(":");
}
export function decrypt(value: string) {
  const [iv, tag, data] = value.split(":");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "hex"));
  d.setAuthTag(Buffer.from(tag, "hex"));
  return d.update(Buffer.from(data, "hex"), "binary", "utf8") + d.final("utf8");
}
export function getKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  const r = db
    .prepare("SELECT value FROM secrets WHERE name=?")
    .get("openrouter") as { value: string } | undefined;
  return r ? decrypt(r.value) : "";
}
export function setKey(value: string) {
  db.prepare(
    "INSERT INTO secrets VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
  ).run("openrouter", encrypt(value));
}

