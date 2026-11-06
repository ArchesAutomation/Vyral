import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { authorized, sameOrigin } from "../../../lib/security.ts";
import { dataDir, save } from "../../../lib/db.ts";
import { limitedBody, mediaMagic } from "../../../lib/http.ts";
import { brand } from "../../../lib/services.ts";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!authorized(req) || !sameOrigin(req))
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  try {
    if (Number(req.headers.get("content-length")) > 67_108_864)
      throw Error("Upload limit is 64 MB");
    const body = await limitedBody(req, 68_000_000);
    const form = await new Response(body, {
      headers: { "Content-Type": req.headers.get("content-type") || "" },
    }).formData();
    const f = form.get("file") as File;
    const b = brand(form.get("brandId"));
    if (!f || f.size > 67_108_864) throw Error("Choose a file under 64 MB");
    const types: Record<string, string> = {
      "video/mp4": "mp4",
      "video/webm": "webm",
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/mp4": "m4a",
    };
    const ext = types[f.type];
    if (!ext)
      throw Error("Supported: MP4, WebM, PNG, JPG, WebP, MP3, WAV, M4A");
    const bytes = Buffer.from(await f.arrayBuffer());
    if (!mediaMagic(bytes, f.type))
      throw Error("File contents do not match its media type");
    const file = randomUUID() + "." + ext;
    await writeFile(resolve(dataDir, "media", file), bytes);
    return NextResponse.json(
      save("asset", b.id, {
        name: f.name,
        mime: f.type,
        file,
        bytes: f.size,
        provenance: "user_upload",
      }),
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
