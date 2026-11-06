import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { dataDir, get, save } from "../lib/db.ts";
import { resolveClipEq } from "../vendor/weave/eq.ts";
import {
  validateComposition,
  type Composition,
  type Row,
} from "../lib/domain.ts";
export function command(
  exe: string,
  args: string[],
  timeout = 300000,
): Promise<string> {
  return new Promise((ok, no) => {
    const child = spawn(exe, args, { shell: false, windowsHide: true });
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      no(Error("Media process timed out"));
    }, timeout);
    child.stdout.on("data", (b) => {
      out = (out + b).slice(-16000);
    });
    child.stderr.on("data", (b) => {
      out = (out + b).slice(-16000);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      no(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? ok(out)
        : no(Error(out.slice(-2000) || `Media process exited ${code}`));
    });
  });
}
function localAsset(id: string, brand: string) {
  const a = get(id, brand);
  if (a.kind !== "asset" || !/^[a-f0-9-]+\.[a-z0-9]+$/.test(String(a.file)))
    throw Error("Invalid source media");
  return { ...a, path: resolve(dataDir, "media", String(a.file)) };
}
export async function render(record: Row, revisionId: string) {
  const c = validateComposition(record.composition as Composition);
  if (record.revisionId !== revisionId)
    throw Error("Composition changed; request a new render");
  if (!c.clips.some((x) => x.kind !== "audio"))
    throw Error("Add a video or image before rendering");
  const id = randomUUID(),
    temp = resolve(dataDir, `render-${id}`);
  await mkdir(temp);
  const args = [
    "-y",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${c.width}x${c.height}:r=30:d=${c.duration}`,
  ];
  const filters: string[] = [],
    audio: string[] = [];
  let last = "0:v";
  try {
    for (let i = 0; i < c.clips.length; i++) {
      const clip = c.clips[i],
        a = localAsset(clip.assetId, record.brandId),
        idx = i + 1,
        d = clip.end - clip.start;
      if (clip.kind === "image")
        args.push("-loop", "1", "-t", String(d), "-i", a.path);
      else
        args.push(
          "-protocol_whitelist",
          "file,pipe,data",
          "-ss",
          String(clip.in),
          "-t",
          String(d),
          "-i",
          a.path,
        );
      if (clip.kind === "audio") {
        filters.push(
          `[${idx}:a]atrim=duration=${d},asetpts=PTS-STARTPTS,volume=${clip.volume},adelay=${Math.round(clip.start * 1000)}:all=1[a${i}]`,
        );
        audio.push(`[a${i}]`);
        continue;
      }
      const eq = resolveClipEq(clip.eq);
      filters.push(
        `[${idx}:v]eq=contrast=${eq.contrast}:brightness=${eq.brightness}:saturation=${eq.saturation}:gamma=${eq.gamma},scale=${c.width}:${c.height}:force_original_aspect_ratio=increase,crop=${c.width}:${c.height},setsar=1,fps=30,trim=duration=${d},setpts=PTS-STARTPTS+${clip.start}/TB[v${i}]`,
      );
      filters.push(
        `[${last}][v${i}]overlay=eof_action=pass:enable='between(t,${clip.start},${clip.end})'[o${i}]`,
      );
      last = `o${i}`;
      if (clip.kind === "video") {
        const probe = await command(
          process.env.FFPROBE_PATH || "ffprobe",
          [
            "-v",
            "quiet",
            "-protocol_whitelist",
            "file,pipe,data",
            "-show_streams",
            "-of",
            "json",
            a.path,
          ],
          15000,
        );
        const meta = JSON.parse(probe);
        const video = meta.streams.find(
          (x: { codec_type: string }) => x.codec_type === "video",
        );
        if (!video) throw Error("Source has no video");
        if (Number(video.duration) < clip.in + d - 0.1)
          throw Error("Trim exceeds source duration");
        if (
          meta.streams.some(
            (x: { codec_type: string }) => x.codec_type === "audio",
          )
        ) {
          filters.push(
            `[${idx}:a]atrim=duration=${d},asetpts=PTS-STARTPTS,volume=${clip.volume},adelay=${Math.round(clip.start * 1000)}:all=1[a${i}]`,
          );
          audio.push(`[a${i}]`);
        }
      }
    }
    for (let i = 0; i < c.overlays.length; i++) {
      const o = c.overlays[i],
        textName = `text-${i}.txt`;
      await writeFile(resolve(temp, textName), o.text);
      filters.push(
        `[${last}]drawtext=textfile='${textName}':fontcolor=${o.color}:fontsize=${o.fontSize}:x=(w-text_w)/2:y=h*${o.y}:box=1:boxcolor=black@0.35:boxborderw=12:enable='between(t,${o.start},${o.end})'[t${i}]`,
      );
      last = `t${i}`;
    }
    if (audio.length)
      filters.push(
        `${audio.join("")}amix=inputs=${audio.length}:duration=longest:normalize=0,alimiter=limit=0.95[aout]`,
      );
    const file = id + ".mp4",
      out = resolve(dataDir, "media", file);
    args.push("-filter_complex", filters.join(";"), "-map", `[${last}]`);
    if (audio.length)
      args.push("-map", "[aout]", "-c:a", "aac", "-b:a", "192k");
    args.push(
      "-t",
      String(c.duration),
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      out,
    );
    // Use a child working directory for overlay text files; never execute a shell.
    await new Promise<void>((ok, no) => {
      const child = spawn(process.env.FFMPEG_PATH || "ffmpeg", args, {
        cwd: temp,
        shell: false,
        windowsHide: true,
      });
      let error = "";
      const timer = setTimeout(() => {
        child.kill();
        no(Error("Render timeout"));
      }, 300000);
      child.stderr.on("data", (b) => (error = (error + b).slice(-4000)));
      child.on("error", (e) => {
        clearTimeout(timer);
        no(e);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        code === 0 ? ok() : no(Error(error));
      });
    });
    const probe = JSON.parse(
      await command(
        process.env.FFPROBE_PATH || "ffprobe",
        ["-v", "quiet", "-show_streams", "-show_format", "-of", "json", out],
        15000,
      ),
    );
    const v = probe.streams.find(
      (x: { codec_type: string }) => x.codec_type === "video",
    );
    if (
      !v ||
      v.width !== c.width ||
      v.height !== c.height ||
      Math.abs(Number(probe.format.duration) - c.duration) > 0.3
    )
      throw Error("Output validation failed");
    const asset = save("asset", record.brandId, {
      name: record.name + ".mp4",
      file,
      mime: "video/mp4",
      provenance: "render",
      revisionId,
      width: c.width,
      height: c.height,
      duration: c.duration,
    });
    const fresh = get(record.id, record.brandId);
    if (fresh.revisionId === revisionId)
      save(
        fresh.kind,
        fresh.brandId,
        { outputAssetId: asset.id, stage: "READY_FOR_REVIEW" },
        fresh.id,
      );
    return asset;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
