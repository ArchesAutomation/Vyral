import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./db.ts";
import { runtime } from "./runtime.ts";
import { validOwnerPassword } from "../lib/owner.ts";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function secret(name: string) {
  return (
    db.prepare("SELECT value FROM secrets WHERE name=?").get(name) as
      | { value: string }
      | undefined
  )?.value;
}
export function putSecret(name: string, value: string) {
  db.prepare(
    "INSERT INTO secrets VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
  ).run(name, value);
}
function encryptionKey() {
  const k = runtime().env.ENCRYPTION_KEY;
  if (!/^[a-f0-9]{64}$/i.test(k || ""))
    throw Error("Studio encryption is not configured");
  return Buffer.from(k, "hex");
}
export function encrypt(value: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", encryptionKey(), iv),
    bytes = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return [
    iv.toString("hex"),
    c.getAuthTag().toString("hex"),
    bytes.toString("hex"),
  ].join(":");
}
export function decrypt(value: string) {
  const [iv, tag, bytes] = value.split(":");
  const c = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "hex"),
  );
  c.setAuthTag(Buffer.from(tag, "hex"));
  return (
    c.update(Buffer.from(bytes, "hex"), "binary", "utf8") + c.final("utf8")
  );
}
export function getKey() {
  const value = runtime().env.OPENROUTER_API_KEY;
  if (value) return value;
  const stored = secret("openrouter");
  return stored ? decrypt(stored) : "";
}
export function setKey(value: string) {
  putSecret("openrouter", encrypt(value));
}
export function setupRequired() {
  if (validOwnerPassword(runtime().env.STUDIO_PASSWORD)) return false;
  return !secret("owner_password");
}
async function derive(password: string, salt: string) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return Buffer.from(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: Buffer.from(salt, "hex"),
        iterations: 100000,
      },
      material,
      256,
    ),
  ).toString("hex");
}
export async function setPassword(password: string) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 200
  )
    throw Error("Use a password between 8 and 200 characters");
  const salt = randomBytes(16).toString("hex");
  const derived = await derive(password, salt);
  putSecret("owner_password", `${salt}:${derived}`);
}
export async function checkPassword(password: string) {
  if (!validOwnerPassword(password)) return false;
  const configured = runtime().env.STUDIO_PASSWORD;
  if (validOwnerPassword(configured)) {
    return timingSafeEqual(Buffer.from(hash(password), "hex"), Buffer.from(hash(configured), "hex"));
  }
  const stored = secret("owner_password");
  if (!stored) return false;
  const [salt, expected] = stored.split(":");
  const actual = await derive(password, salt);
  return timingSafeEqual(
    Buffer.from(actual, "hex"),
    Buffer.from(expected, "hex"),
  );
}
export function setupTokenValid(value: string) {
  const expected = runtime().env.SETUP_TOKEN_HASH;
  return !!expected && typeof value === "string" && hash(value) === expected;
}
function token(req: Request) {
  return (
    req.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("vyral_session="))
      ?.slice(14) || ""
  );
}
export function authorized(req: Request) {
  const t = token(req);
  if (!t) return false;
  const row = db
    .prepare("SELECT expires FROM sessions WHERE token=?")
    .get(hash(t)) as { expires: number } | undefined;
  return !!row && row.expires > Date.now();
}
export function newSession() {
  const token = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
  db.prepare("INSERT INTO sessions VALUES(?,?)").run(
    hash(token),
    Date.now() + 604800000,
  );
  return token;
}
export function logout(req: Request) {
  db.prepare("DELETE FROM sessions WHERE token=?").run(hash(token(req)));
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}
export function loginAllowed() {
  const data = JSON.parse(secret("login_limit") || '{"at":0,"count":0}');
  const now = Date.now();
  if (now - data.at > 60000) {
    data.at = now;
    data.count = 0;
  }
  data.count++;
  putSecret("login_limit", JSON.stringify(data));
  return data.count <= 10;
}

