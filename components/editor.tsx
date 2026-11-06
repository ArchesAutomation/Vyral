"use client";
import { useEffect, useRef, useState } from "react";
import type { Composition, Row, Clip } from "../lib/domain";
import Icon from "./icon";
type Props = {
  project: Row;
  assets: Row[];
  onSave: (c: Composition) => Promise<void>;
  onRender: () => void;
};
function Media({ clip, time }: { clip: Clip; time: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (
      ref.current &&
      Math.abs(ref.current.currentTime - (time - clip.start + clip.in)) > 0.08
    )
      ref.current.currentTime = time - clip.start + clip.in;
  }, [time, clip]);
  return clip.kind === "image" ? (
    <img
      style={{
        filter: `contrast(${clip.eq?.contrast ?? 1}) brightness(${1 + (clip.eq?.brightness ?? 0)}) saturate(${clip.eq?.saturation ?? 1})`,
      }}
      alt="Timeline source"
      src={`/api/media/${clip.assetId}`}
    />
  ) : (
    <video
      style={{
        filter: `contrast(${clip.eq?.contrast ?? 1}) brightness(${1 + (clip.eq?.brightness ?? 0)}) saturate(${clip.eq?.saturation ?? 1})`,
      }}
      ref={ref}
      src={`/api/media/${clip.assetId}`}
      muted
      playsInline
      preload="auto"
    />
  );
}
export default function Editor({ project, assets, onSave, onRender }: Props) {
  const [c, setC] = useState(project.composition as Composition),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [past, setPast] = useState<Composition[]>([]),
    [future, setFuture] = useState<Composition[]>([]),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState("");
  const current = useRef(c);
  current.current = c;
  useEffect(() => {
    if (!playing) return;
    const started = performance.now(),
      offset = time;
    const timer = setInterval(() => {
      const t = offset + (performance.now() - started) / 1000;
      if (t >= c.duration) {
        setTime(0);
        setPlaying(false);
      } else setTime(t);
    }, 33);
    return () => clearInterval(timer);
  }, [playing, c.duration]);
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      setSaving(true);
      onSave(c)
        .then(() => {
          if (current.current === c) {
            setDirty(false);
            setSaveError("");
          }
        })
        .catch((e) => setSaveError(String(e.message)))
        .finally(() => setSaving(false));
    }, 1200);
    return () => clearTimeout(timer);
  }, [c, dirty, onSave]);
  function change(next: Composition) {
    setPast((x) => [...x.slice(-30), c]);
    setFuture([]);
    setC(next);
    setDirty(true);
  }
  function undo() {
    const prior = past.at(-1);
    if (prior) {
      setFuture([c, ...future]);
      setPast(past.slice(0, -1));
      setC(prior);
      setDirty(true);
    }
  }
  function redo() {
    if (future[0]) {
      setPast([...past, c]);
      setC(future[0]);
      setFuture(future.slice(1));
      setDirty(true);
    }
  }
  function add(a: Row) {
    const kind = String(a.mime).startsWith("image")
      ? "image"
      : String(a.mime).startsWith("audio")
        ? "audio"
        : "video";
    change({
      ...c,
      clips: [
        ...c.clips,
        {
          id: crypto.randomUUID(),
          assetId: a.id,
          kind,
          start: 0,
          end: Math.min(Number(a.duration) || c.duration, c.duration),
          in: 0,
          volume: 1,
        },
      ],
    });
  }
  const active = c.clips.filter(
    (x) => x.kind !== "audio" && time >= x.start && time < x.end,
  );
  return (
    <div className="editor-layout">
      <section className="panel editor-main">
        <div className="panel-head">
          <div>
            <span className="eyebrow">EDITABLE COMPOSITION</span>
            <h3>{project.name}</h3>
          </div>
          <span className="badge">
            {saveError || (saving ? "Saving…" : dirty ? "Unsaved" : "Saved")}
          </span>
        </div>
        <div className="preview-wrap">
          <div
            className="video-preview"
            style={{ aspectRatio: `${c.width}/${c.height}` }}
          >
            {active.map((x) => (
              <Media key={x.id} clip={x} time={time} />
            ))}
            {!active.length && (
              <div className="preview-empty">
                <Icon name="editor" size={40} />
                <span>Add footage to your timeline</span>
              </div>
            )}
            {c.overlays
              .filter((x) => time >= x.start && time < x.end)
              .map((x) => (
                <span
                  key={x.id}
                  className="video-text"
                  style={{
                    top: `${x.y * 100}%`,
                    fontSize: `${(x.fontSize / 1080) * 280}px`,
                    color: x.color,
                  }}
                >
                  {x.text}
                </span>
              ))}
          </div>
        </div>
        <div className="transport">
          <button
            className="icon-btn"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? "Ⅱ" : <Icon name="play" />}
          </button>
          <span className="mono">
            {time.toFixed(1)} / {c.duration.toFixed(1)}s
          </span>
          <input
            aria-label="Scrub timeline"
            type="range"
            min="0"
            max={c.duration}
            step="0.03"
            value={time}
            onChange={(e) => {
              setPlaying(false);
              setTime(+e.target.value);
            }}
          />
          <button className="text-btn" disabled={!past.length} onClick={undo}>
            Undo
          </button>
          <button className="text-btn" disabled={!future.length} onClick={redo}>
            Redo
          </button>
        </div>
        <div className="timeline">
          <div className="ruler">
            {[0, 0.25, 0.5, 0.75, 1].map((n) => (
              <span key={n}>{(n * c.duration).toFixed(1)}s</span>
            ))}
          </div>
          {["video", "image", "audio"].map((kind) => (
            <div className="track" key={kind}>
              <span>{kind.toUpperCase()}</span>
              <div className="track-lane">
                {c.clips
                  .filter((x) => x.kind === kind)
                  .map((x) => (
                    <button
                      key={x.id}
                      className={`timeline-clip ${kind}`}
                      style={{
                        left: `${(x.start / c.duration) * 100}%`,
                        width: `${((x.end - x.start) / c.duration) * 100}%`,
                      }}
                      onClick={() => setTime(x.start)}
                    >
                      {assets.find((a) => a.id === x.assetId)?.name || "Media"}
                    </button>
                  ))}
              </div>
            </div>
          ))}
          <div className="track">
            <span>TEXT</span>
            <div className="track-lane">
              {c.overlays.map((x) => (
                <div
                  className="timeline-clip text"
                  key={x.id}
                  style={{
                    left: `${(x.start / c.duration) * 100}%`,
                    width: `${((x.end - x.start) / c.duration) * 100}%`,
                  }}
                >
                  {x.text}
                </div>
              ))}
            </div>
          </div>
        </div>
        <small className="muted">
          Preview is scrubbed and muted. Export includes original audio and
          audio tracks.
        </small>
      </section>
      <aside className="editor-inspector">
        <section className="panel">
          <h3>Quick edit</h3>
          <label>
            Opening hook
            <textarea
              value={c.overlays.find((x) => x.id === "hook")?.text || ""}
              maxLength={300}
              placeholder="Make the first three seconds count."
              onChange={(e) =>
                change({
                  ...c,
                  overlays: [
                    ...c.overlays.filter((x) => x.id !== "hook"),
                    {
                      id: "hook",
                      text: e.target.value,
                      start: 0,
                      end: Math.min(3, c.duration),
                      y: 0.35,
                      fontSize: 56,
                      color: "#ffffff",
                    },
                  ],
                })
              }
            />
          </label>
          <div className="two-col">
            <label>
              Format
              <select
                value={`${c.width}:${c.height}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split(":").map(Number);
                  change({ ...c, width: w, height: h });
                }}
              >
                <option value="1080:1920">9:16 · Vertical</option>
                <option value="1080:1080">1:1 · Square</option>
                <option value="1080:720">3:2 · Landscape</option>
              </select>
            </label>
            <label>
              Length (seconds)
              <input
                type="number"
                min="1"
                max="180"
                value={c.duration}
                onChange={(e) => {
                  const d = Math.max(1, Math.min(180, +e.target.value));
                  change({
                    ...c,
                    duration: d,
                    clips: c.clips
                      .filter((x) => x.start < d)
                      .map((x) => ({ ...x, end: Math.min(x.end, d) })),
                    overlays: c.overlays
                      .filter((x) => x.start < d)
                      .map((x) => ({ ...x, end: Math.min(x.end, d) })),
                  });
                }}
              />
            </label>
          </div>
          <button
            className="primary full"
            disabled={dirty || saving || !c.clips.length}
            onClick={onRender}
          >
            <Icon name="upload" />
            Render MP4
          </button>
          {project.outputAssetId ? (
            <a
              className="download"
              href={`/api/media/${project.outputAssetId}`}
              download
            >
              Download latest MP4 ↗
            </a>
          ) : null}
        </section>
        <section className="panel">
          <h3>Source library</h3>
          {assets.length ? (
            assets.map((a) => (
              <button className="source-item" key={a.id} onClick={() => add(a)}>
                <Icon name="plus" />
                <span>{a.name}</span>
                <small>{String(a.mime).split("/")[0]}</small>
              </button>
            ))
          ) : (
            <p className="muted">Upload media in Assets to start editing.</p>
          )}
        </section>
      </aside>
      <section className="panel clip-properties">
        <div className="panel-head">
          <h3>Clip timing</h3>
          <span className="muted">Seconds · trim and arrange precisely</span>
        </div>
        {c.clips.map((x, i) => (
          <div
            className="clip-row"
            key={x.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const source = Number(e.dataTransfer.getData("text/plain"));
              const clips = [...c.clips];
              if (
                Number.isInteger(source) &&
                source >= 0 &&
                source < clips.length
              ) {
                const [moved] = clips.splice(source, 1);
                clips.splice(i, 0, moved);
                change({ ...c, clips });
              }
            }}
          >
            <span className="clip-name">
              ⋮⋮ {assets.find((a) => a.id === x.assetId)?.name || "Source"}
            </span>
            {(["start", "end", "in", "volume"] as const).map((k) => (
              <label key={k}>
                {k}
                <input
                  aria-label={`Clip ${i + 1} ${k}`}
                  type="number"
                  step="0.1"
                  min="0"
                  max={k === "volume" ? 2 : c.duration}
                  value={x[k]}
                  onChange={(e) =>
                    change({
                      ...c,
                      clips: c.clips.map((a) =>
                        a.id === x.id ? { ...a, [k]: +e.target.value } : a,
                      ),
                    })
                  }
                />
              </label>
            ))}
            <label>
              COLOR
              <select
                aria-label={`Clip ${i + 1} color`}
                value={
                  x.eq?.saturation === 0
                    ? "mono"
                    : x.eq?.saturation === 1.2
                      ? "warm"
                      : "original"
                }
                onChange={(e) =>
                  change({
                    ...c,
                    clips: c.clips.map((a) =>
                      a.id === x.id
                        ? {
                            ...a,
                            eq:
                              e.target.value === "mono"
                                ? { saturation: 0 }
                                : e.target.value === "warm"
                                  ? {
                                      saturation: 1.2,
                                      contrast: 1.08,
                                      brightness: 0.02,
                                    }
                                  : undefined,
                          }
                        : a,
                    ),
                  })
                }
              >
                <option value="original">Original</option>
                <option value="mono">Mono</option>
                <option value="warm">Vivid</option>
              </select>
            </label>
            <button
              className="text-btn"
              onClick={() => {
                const split = time;
                if (split <= x.start || split >= x.end) return;
                change({
                  ...c,
                  clips: c.clips.flatMap((a) =>
                    a.id === x.id
                      ? [
                          { ...a, end: split },
                          {
                            ...a,
                            id: crypto.randomUUID(),
                            start: split,
                            in: a.in + split - a.start,
                          },
                        ]
                      : [a],
                  ),
                });
              }}
            >
              Split at playhead
            </button>
            <button
              className="icon-btn"
              aria-label={`Remove clip ${i + 1}`}
              onClick={() =>
                change({ ...c, clips: c.clips.filter((a) => a.id !== x.id) })
              }
            >
              <Icon name="close" />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
