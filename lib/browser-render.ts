import { validateComposition, type Composition } from "./domain";
type Source = {
  clip: Composition["clips"][number];
  element: HTMLImageElement | HTMLVideoElement | HTMLAudioElement;
  gain?: GainNode;
  active: boolean;
};
// A foreground, real-time demo renderer. Native FFmpeg remains available locally.
export async function browserRender(
  c: Composition,
  progress: (value: number) => void,
): Promise<{ blob: Blob; extension: string }> {
  validateComposition(c);
  if (c.duration > 60 || c.clips.length > 32)
    throw Error("Demo exports support up to 60 seconds and 32 clips");
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)
    throw Error(
      "This browser cannot export video. Try current Chrome or Edge.",
    );
  if (document.hidden) throw Error("Keep this tab visible while exporting");
  const canvas = document.createElement("canvas"),
    scale = Math.min(1, 720 / c.width);
  canvas.width = Math.round(c.width * scale);
  canvas.height = Math.round(c.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas is unavailable");
  const audio = new AudioContext(),
    destination = audio.createMediaStreamDestination(),
    sources: Source[] = [];
  let stream: MediaStream | undefined, recorder: MediaRecorder | undefined;
  try {
    await audio.resume();
    for (const clip of c.clips) {
      const element =
        clip.kind === "image"
          ? new Image()
          : document.createElement(clip.kind === "audio" ? "audio" : "video");
      const source: Source = { clip, element, active: false };
      sources.push(source);
      if (element instanceof HTMLMediaElement) {
        element.preload = "auto";
        if (element instanceof HTMLVideoElement) element.playsInline = true;
        const gain = audio.createGain();
        gain.gain.value = 0;
        audio
          .createMediaElementSource(element)
          .connect(gain)
          .connect(destination);
        source.gain = gain;
      }
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(Error("Source loading timed out")),
          20000,
        );
        const event = clip.kind === "image" ? "load" : "loadeddata";
        element.addEventListener(
          event,
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
        element.addEventListener(
          "error",
          () => {
            clearTimeout(timeout);
            reject(Error("A source cannot be decoded by this browser"));
          },
          { once: true },
        );
        element.src = "/api/media/" + encodeURIComponent(clip.assetId);
      });
      if (element instanceof HTMLMediaElement) {
        if (clip.in + clip.end - clip.start > element.duration + 0.1)
          throw Error(
            "A trim exceeds its source duration. Shorten the clip in the timeline.",
          );
        if (clip.in > 0)
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(Error("Source seeking timed out")),
              10000,
            );
            element.addEventListener(
              "seeked",
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true },
            );
            element.currentTime = clip.in;
          });
      }
    }
    const type = [
      "video/mp4;codecs=avc1.42001E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm",
    ].find((x) => MediaRecorder.isTypeSupported(x));
    if (!type) throw Error("No supported video encoder in this browser");
    const draw = (time: number) => {
      ctx.filter = "none";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const s of sources) {
        const active = time >= s.clip.start && time < s.clip.end;
        const el = s.element;
        if (el instanceof HTMLMediaElement) {
          if (active && !s.active) {
            el.play().catch(() => {
              recorderError = Error("Browser blocked source playback");
            });
          } else if (!active && s.active) el.pause();
          if (s.gain) s.gain.gain.value = active ? s.clip.volume : 0;
        }
        s.active = active;
        if (!active || s.clip.kind === "audio") continue;
        const visual = el as HTMLImageElement | HTMLVideoElement;
        const w =
            visual instanceof HTMLVideoElement
              ? visual.videoWidth
              : visual.naturalWidth,
          h =
            visual instanceof HTMLVideoElement
              ? visual.videoHeight
              : visual.naturalHeight;
        if (!w || !h) continue;
        const crop = Math.max(canvas.width / w, canvas.height / h),
          eq = s.clip.eq;
        ctx.filter = `brightness(${1 + (eq?.brightness ?? 0)}) contrast(${eq?.contrast ?? 1}) saturate(${eq?.saturation ?? 1})`;
        ctx.drawImage(
          visual,
          (canvas.width - w * crop) / 2,
          (canvas.height - h * crop) / 2,
          w * crop,
          h * crop,
        );
      }
      ctx.filter = "none";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const o of c.overlays.filter(
        (o) => time >= o.start && time < o.end,
      )) {
        const font = o.fontSize * scale;
        ctx.font = `700 ${font}px Arial, sans-serif`;
        const lines: string[] = [];
        let line = "";
        for (const word of o.text.split(/\s+/)) {
          const trial = line ? line + " " + word : word;
          if (ctx.measureText(trial).width > canvas.width * 0.86 && line) {
            lines.push(line);
            line = word;
          } else line = trial;
        }
        if (line) lines.push(line);
        ctx.lineWidth = font * 0.1;
        ctx.strokeStyle = "rgba(0,0,0,.8)";
        ctx.fillStyle = o.color;
        lines.forEach((text, i) => {
          const y =
            o.y * canvas.height + (i - (lines.length - 1) / 2) * font * 1.2;
          ctx.strokeText(text, canvas.width / 2, y, canvas.width * 0.9);
          ctx.fillText(text, canvas.width / 2, y, canvas.width * 0.9);
        });
      }
    };
    draw(0);
    stream = canvas.captureStream(30);
    if (sources.some((s) => s.gain))
      for (const track of destination.stream.getAudioTracks())
        stream.addTrack(track);
    recorder = new MediaRecorder(stream, {
      mimeType: type,
      videoBitsPerSecond: 2_000_000,
      audioBitsPerSecond: 128000,
    });
    const parts: Blob[] = [];
    let size = 0,
      recorderError: Error | undefined;
    recorder.ondataavailable = (e) => {
      if (e.data.size) {
        parts.push(e.data);
        size += e.data.size;
        if (size > 25_000_000)
          recorderError = Error("Export exceeds the 25 MB demo limit");
      }
    };
    const stopped = new Promise<void>((resolve) => {
      recorder!.onstop = () => resolve();
    });
    recorder.onerror = () => {
      recorderError = Error("Browser encoder failed");
    };
    recorder.start(500);
    const start = performance.now();
    await new Promise<void>((resolve, reject) => {
      const frame = () => {
        if (document.hidden || recorderError) {
          reject(
            recorderError ||
              Error(
                "Export stopped because the tab was hidden. Keep it open and try again.",
              ),
          );
          return;
        }
        const time = (performance.now() - start) / 1000;
        draw(Math.min(time, c.duration));
        progress(Math.min(99, Math.round((time / c.duration) * 100)));
        if (time >= c.duration) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    recorder.stop();
    await stopped;
    if (recorderError) throw recorderError;
    progress(100);
    return {
      blob: new Blob(parts, {
        type: type.startsWith("video/mp4") ? "video/mp4" : "video/webm",
      }),
      extension: type.startsWith("video/mp4") ? "mp4" : "webm",
    };
  } finally {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    for (const s of sources) {
      if (s.element instanceof HTMLMediaElement) {
        s.element.pause();
        s.element.removeAttribute("src");
        s.element.load();
      } else s.element.src = "";
    }
    stream?.getTracks().forEach((t) => t.stop());
    await audio.close();
  }
}
