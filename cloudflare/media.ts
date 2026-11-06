import { runtime } from "./runtime.ts";
import { db, get, save, transaction } from "./db.ts";
import { mediaMagic } from "../lib/http.ts";
import type { Row } from "../lib/domain.ts";
import { validateComposition, type Composition } from "../lib/domain.ts";
export const uploadLimit = 25_000_000;
const studioLimit = 8_000_000_000;
const extensions: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
};
export function reserve(key: string, bytes: number) {
  transaction(() => {
    const used = Number(
      db
        .prepare("SELECT COALESCE(SUM(bytes),0) AS bytes FROM media_quota")
        .get()?.bytes || 0,
    );
    if (!Number.isFinite(bytes) || bytes < 1 || bytes > uploadLimit)
      throw Error("Demo files must be smaller than 25 MB");
    if (used + bytes > studioLimit)
      throw Error("Demo storage limit reached (8 GB)");
    db.prepare("INSERT INTO media_quota VALUES(?,?)").run(key, bytes);
  });
}
export async function storeMedia(
  brandId: string,
  name: string,
  mime: string,
  bytes: Uint8Array,
  details: Record<string, unknown> = {},
) {
  const ext = extensions[mime];
  if (!ext || !mediaMagic(bytes, mime))
    throw Error("File content does not match a supported media type");
  const file = crypto.randomUUID() + "." + ext;
  reserve(file, bytes.byteLength);
  try {
    await runtime().env.MEDIA.put(file, bytes, {
      httpMetadata: { contentType: mime },
    });
    return save("asset", brandId, {
      name,
      file,
      mime,
      bytes: bytes.byteLength,
      provenance: "user_upload",
      ...details,
    });
  } catch (e) {
    await runtime()
      .env.MEDIA.delete(file)
      .catch(() => {});
    db.prepare("DELETE FROM media_quota WHERE key=?").run(file);
    throw e;
  }
}
export async function serveMedia(req: Request, id: string) {
  const a = get(id);
  if (a.kind !== "asset" || !/^[a-f0-9-]+\.[a-z0-9]+$/.test(String(a.file)))
    return new Response("Media not found", { status: 404 });
  const range = req.headers.get("range");
  const object = await runtime().env.MEDIA.get(
    String(a.file),
    range ? { range: req.headers } : undefined,
  );
  if (!object) return new Response("Media not found", { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": String(a.mime),
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    ETag: object.httpEtag,
  };
  const r = object.range;
  if (r && range) {
    headers["Content-Range"] =
      `bytes ${r.offset}-${r.offset + r.length - 1}/${object.size}`;
    headers["Content-Length"] = String(r.length);
    return new Response(object.body, { status: 206, headers });
  }
  headers["Content-Length"] = String(object.size);
  return new Response(object.body, { headers });
}
export function startBrowserRender(creative: Row) {
  const c = validateComposition(creative.composition as Composition);
  if (!["project", "variant"].includes(creative.kind) || !c.clips.length)
    throw Error("Add source footage before exporting");
  if (c.duration > 60 || c.clips.length > 32)
    throw Error("Browser demo exports support up to 60 seconds and 32 clips");
  for (const clip of c.clips)
    if (get(clip.assetId, creative.brandId).kind !== "asset")
      throw Error("Invalid source");
  const job = save("job", creative.brandId, {
    name: "Browser export",
    type: "browser-render",
    status: "running",
    payload: { id: creative.id, revisionId: creative.revisionId },
    createdAt: new Date().toISOString(),
  });
  return { ...job, composition: c };
}
