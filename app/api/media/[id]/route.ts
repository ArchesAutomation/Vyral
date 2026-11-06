import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { resolve } from "node:path";
import { authorized } from "../../../../lib/security.ts";
import { get, dataDir } from "../../../../lib/db.ts";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!authorized(req)) return new Response("Access denied", { status: 403 });
  try {
    const { id } = await params;
    const a = get(id);
    if (
      a.kind !== "asset" ||
      !/^[a-f0-9-]+\.(mp4|webm|png|jpg|webp|mp3|wav|m4a)$/.test(String(a.file))
    )
      throw Error("Invalid asset");
    const path = resolve(dataDir, "media", String(a.file)),
      size = (await stat(path)).size;
    const h = {
      "Content-Type": String(a.mime),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    };
    const range = req.headers.get("range");
    if (range) {
      const m = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!m) return new Response(null, { status: 416 });
      const start = +m[1],
        end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
      if (start > end || start >= size)
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      return new Response(
        Readable.toWeb(
          createReadStream(path, { start, end }),
        ) as ReadableStream,
        {
          status: 206,
          headers: {
            ...h,
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${size}`,
          },
        },
      );
    }
    return new Response(
      Readable.toWeb(createReadStream(path)) as ReadableStream,
      { headers: { ...h, "Content-Length": String(size) } },
    );
  } catch {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
}
