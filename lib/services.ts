import { randomUUID } from "node:crypto";
import {
  db,
  get,
  list,
  save,
  audit,
  transaction,
  revision,
  enqueue,
} from "./db.ts";
import {
  emptyComposition,
  validateComposition,
  variants,
  creativeDNA,
  compare,
  type Composition,
  type Row,
} from "./domain.ts";
import { getKey, setKey } from "./security.ts";
import {
  IMAGE_MODELS,
  VIDEO_MODELS,
  estimateImageCost,
  estimateVideoCost,
} from "../vendor/open-higgsfield/models.ts";
type Input = Record<string, unknown>;
const str = (x: unknown, max = 10000) => {
  if (typeof x !== "string" || !x.trim() || x.length > max)
    throw Error("Required text is missing or too long");
  return x.trim();
};
export function brand(id: unknown) {
  const b = get(str(id, 100));
  if (b.kind !== "brand") throw Error("Invalid brand");
  return b;
}
export function state(brandId?: string) {
  const brands = list("brand");
  if (brandId) brand(brandId);
  const b = brandId || brands[0]?.id;
  const kinds = [
    "inspiration",
    "project",
    "asset",
    "experiment",
    "variant",
    "post",
    "snapshot",
    "job",
    "audit",
  ] as const;
  return {
    brands,
    brandId: b,
    records: Object.fromEntries(kinds.map((k) => [k, b ? list(k, b) : []])),
    models: {
      image: IMAGE_MODELS,
      video: VIDEO_MODELS.filter((x) => !x.hidden),
    },
    hasKey: !!getKey(),
    worker:
      db.prepare("SELECT last_seen FROM worker_health WHERE id=1").get() ||
      null,
  };
}
export function act(action: string, input: Input): unknown {
  if (action === "brand.create") {
    const name = str(input.name, 120);
    const id = randomUUID();
    const b = save(
      "brand",
      id,
      {
        name,
        audience: String(input.audience || ""),
        voice: String(input.voice || "Clear, confident, useful"),
        description: String(input.description || ""),
        website: String(input.website || ""),
        claims: String(input.claims || ""),
        restrictedClaims: String(input.restrictedClaims || ""),
      },
      id,
    );
    audit(id, "Brand created");
    return b;
  }
  if (action === "settings.key") {
    setKey(str(input.key, 300));
    return { saved: true };
  }
  const b = brand(input.brandId),
    bid = b.id;
  if (action === "brand.update") {
    return save(
      "brand",
      bid,
      {
        name: str(input.name, 120),
        audience: str(input.audience),
        voice: str(input.voice),
        description: String(input.description || ""),
        website: String(input.website || ""),
        claims: String(input.claims || ""),
        restrictedClaims: String(input.restrictedClaims || ""),
      },
      bid,
    );
  }
  if (action === "inspiration.create") {
    const url = String(input.url || "");
    if (url) {
      const u = new URL(url);
      if (u.protocol !== "https:") throw Error("Use an HTTPS reference link");
    }
    const notes = String(input.notes || "");
    const r = save("inspiration", bid, {
      name: str(input.name, 200),
      url,
      notes,
      collection: String(input.collection || "Saved references"),
      dna: creativeDNA(notes),
    });
    audit(bid, "Reference saved", { record: r.id });
    return r;
  }
  if (action === "project.create") {
    const c = emptyComposition();
    if (input.assetId) {
      const a = get(str(input.assetId), bid);
      if (a.kind !== "asset") throw Error("Invalid asset");
      c.clips.push({
        id: randomUUID(),
        assetId: a.id,
        kind: String(a.mime).startsWith("image/")
          ? "image"
          : String(a.mime).startsWith("audio/")
            ? "audio"
            : "video",
        start: 0,
        end: 10,
        in: 0,
        volume: 1,
      });
    }
    const source = input.sourceId ? get(str(input.sourceId), bid) : null;
    const p = save("project", bid, {
      name: str(input.name, 200),
      stage: "IDEA",
      brief: String(input.brief || ""),
      sourceId: source?.id || null,
      composition: c,
    });
    const rev = revision(p, c);
    return save("project", bid, { revisionId: rev }, p.id);
  }
  if (action === "project.save") {
    const p = get(str(input.id), bid);
    if (!["project", "variant"].includes(p.kind))
      throw Error("Invalid project");
    if (
      list("post", bid).some(
        (post) => post.creativeId === p.id && post.status !== "CANCELLED",
      )
    )
      throw Error(
        "This creative has a publishing plan. Create a new project from its asset to edit a new version.",
      );
    const c = validateComposition(input.composition as Composition);
    for (const clip of c.clips) {
      const asset = get(clip.assetId, bid);
      if (asset.kind !== "asset") throw Error("Invalid media");
    }
    const rev = revision(p, c);
    audit(bid, "Composition saved", { project: p.id, revision: rev });
    return save(
      p.kind,
      bid,
      {
        composition: c,
        revisionId: rev,
        stage: "EDITING",
        outputAssetId: null,
      },
      p.id,
    );
  }
  if (action === "experiment.create") {
    const p = get(str(input.projectId), bid);
    if (!["project", "variant"].includes(p.kind))
      throw Error("Select a project");
    const axis = input.axis === "pacing" ? "pacing" : "hook";
    const levels = input.levels as string[];
    const defs = variants(p.composition as Composition, axis, levels);
    return transaction(() => {
      const e = save("experiment", bid, {
        name: str(input.name, 200),
        projectId: p.projectId || p.id,
        baseCreativeId: p.id,
        baseRevision: p.revisionId,
        hypothesis: str(input.hypothesis, 1000),
        axis,
        metric: "retained_3s",
        minExposure: 100,
        windowHours: 24,
        status: "DRAFT",
        parentId: input.parentId || null,
      });
      for (const d of defs) {
        const v = save("variant", bid, {
          name: `${e.name} · ${d.label}`,
          experimentId: e.id,
          projectId: p.id,
          baseRevision: p.revisionId,
          ...d,
        });
        const rev = revision(v, d.composition);
        save("variant", bid, { revisionId: rev }, v.id);
      }
      audit(bid, "Experiment designed", {
        experiment: e.id,
        variants: defs.length,
      });
      return e;
    });
  }
  if (action === "render") {
    const p = get(str(input.id), bid);
    if (!["project", "variant"].includes(p.kind))
      throw Error("Invalid render source");
    validateComposition(p.composition as Composition);
    return enqueue(
      bid,
      "render",
      { id: p.id, revisionId: p.revisionId },
      `render:${p.id}:${p.revisionId}`,
    );
  }
  if (action === "generation") {
    if (!getKey()) throw Error("Add your OpenRouter key in Settings");
    const model = [...IMAGE_MODELS, ...VIDEO_MODELS].find(
      (x) => x.id === input.model,
    );
    if (!model || ("hidden" in model && model.hidden))
      throw Error("Unknown model");
    const prompt = str(input.prompt);
    const size = String(input.size || "1K");
    const duration = Number(input.duration || 5);
    const resolution = String(input.resolution || "720p");
    const ratio = String(input.aspectRatio || "9:16");
    if (!(model.aspectRatios as string[]).includes(ratio))
      throw Error("Unsupported aspect ratio");
    if (model.kind === "image" && !model.sizes.includes(size as "1K"))
      throw Error("Unsupported image size");
    if (
      model.kind === "video" &&
      !model.resolutions.includes(resolution as "720p")
    )
      throw Error("Unsupported resolution");
    const estimate =
      model.kind === "image"
        ? estimateImageCost(model, size as "1K", 1)
        : estimateVideoCost(model, duration, resolution as "720p");
    if (estimate === undefined || !Number.isFinite(estimate) || estimate < 0)
      throw Error("No cost estimate available for this model");
    if (
      model.kind === "video" &&
      (!Number.isFinite(duration) || duration < 1 || duration > 30)
    )
      throw Error("Invalid duration");
    const refs = (input.referenceIds || []) as string[];
    if (!Array.isArray(refs) || refs.length > 6)
      throw Error("Invalid references");
    for (const id of refs) {
      const a = get(id, bid);
      if (a.kind !== "asset" || !String(a.mime).startsWith("image/"))
        throw Error("References must be image assets");
    }
    if (model.kind === "image" && refs.length > model.caps.maxReferenceImages)
      throw Error("Too many reference images");
    if (model.kind === "video" && refs.length && !model.caps.imageToVideo)
      throw Error("Model does not support image input");
    if (model.kind === "video" && refs.length > 1 && !model.caps.lastFrame)
      throw Error("Model does not support a last frame");
    if (model.kind === "video" && !refs.length && !model.caps.textToVideo)
      throw Error("Select a first frame");
    return transaction(() => {
      const today = new Date().toISOString().slice(0, 10);
      const jobs = list("job").filter(
        (j) =>
          ["generation", "script"].includes(String(j.type)) &&
          j.createdAt.startsWith(today) &&
          j.status !== "cancelled",
      );
      const reserved = jobs.reduce(
        (s, j) => s + Number(j.costUsd ?? j.estimate ?? 0),
        0,
      );
      if (
        reserved + estimate >
        Number(process.env.DAILY_GENERATION_LIMIT_USD || 5)
      )
        throw Error("Daily generation budget reached");
      const j = enqueue(
        bid,
        "generation",
        {
          model: model.id,
          prompt,
          size,
          duration,
          resolution,
          aspectRatio: ratio,
          referenceIds: refs,
          audio: input.audio === true,
        },
        randomUUID(),
      );
      return save("job", bid, { estimate }, j.id);
    });
  }
  if (action === "script") {
    if (!getKey()) throw Error("Add your OpenRouter key in Settings");
    get(str(input.projectId), bid);
    return transaction(() => {
      const today = new Date().toISOString().slice(0, 10);
      const spent = list("job")
        .filter(
          (j) =>
            ["script", "generation"].includes(String(j.type)) &&
            j.createdAt.startsWith(today) &&
            j.status !== "cancelled",
        )
        .reduce((sum, j) => sum + Number(j.costUsd ?? j.estimate ?? 0), 0);
      if (spent + 0.25 > Number(process.env.DAILY_GENERATION_LIMIT_USD || 5))
        throw Error("Daily generation budget reached");
      const j = enqueue(
        bid,
        "script",
        { projectId: str(input.projectId), model: str(input.model, 200) },
        randomUUID(),
      );
      return save("job", bid, { estimate: 0.25 }, j.id);
    });
  }
  if (action === "posts.queue") {
    const v = get(str(input.id), bid);
    if (!["variant", "project"].includes(v.kind) || !v.outputAssetId)
      throw Error("Render the creative before scheduling");
    const when = new Date(str(input.scheduledAt));
    if (!Number.isFinite(when.getTime())) throw Error("Invalid schedule");
    return save("post", bid, {
      name: v.name,
      creativeId: v.id,
      experimentId: v.experimentId || null,
      revisionId: v.revisionId,
      assetId: v.outputAssetId,
      caption: String(input.caption || ""),
      provider: "sandbox",
      trial: input.trial === true,
      status: "NEEDS_APPROVAL",
      scheduledAt: when.toISOString(),
      synthetic: true,
    });
  }
  if (action === "posts.approve") {
    const p = get(str(input.id), bid);
    if (p.kind !== "post" || p.status !== "NEEDS_APPROVAL")
      throw Error("Post is not awaiting approval");
    return transaction(() => {
      const approved = save(
        "post",
        bid,
        { status: "QUEUED", approvedAt: new Date().toISOString() },
        p.id,
      );
      enqueue(
        bid,
        "publish",
        { postId: p.id },
        `publish:${p.id}`,
        String(p.scheduledAt),
      );
      audit(bid, "Sandbox publishing approved", { post: p.id });
      return approved;
    });
  }
  if (action === "posts.cancel") {
    const p = get(str(input.id), bid);
    if (p.kind !== "post" || p.status === "PUBLISHED")
      throw Error("Cannot cancel this post");
    for (const j of list("job", bid).filter(
      (j) => (j.payload as Input).postId === p.id && j.status === "queued",
    ))
      save("job", bid, { status: "cancelled" }, j.id);
    return save("post", bid, { status: "CANCELLED" }, p.id);
  }
  if (action === "metrics.import") {
    const v = get(str(input.variantId), bid);
    if (v.kind !== "variant") throw Error("Select a variant");
    const success = Number(input.success),
      total = Number(input.total),
      hours = Number(input.windowHours);
    if (
      !Number.isInteger(total) ||
      !Number.isInteger(success) ||
      success < 0 ||
      total < success ||
      total <= 0 ||
      !Number.isFinite(hours) ||
      hours <= 0
    )
      throw Error(
        "Use valid retained plays, total plays, and measurement hours",
      );
    return save("snapshot", bid, {
      name: v.name,
      variantId: v.id,
      experimentId: v.experimentId,
      success,
      total,
      windowHours: hours,
      synthetic: input.synthetic === true,
      source: "manual_import",
      collectedAt: new Date().toISOString(),
      raw: input,
    });
  }
  if (action === "job.retry") {
    const j = get(str(input.id), bid);
    if (j.kind !== "job" || j.status !== "failed")
      throw Error("Only failed jobs can retry");
    if (["generation", "script"].includes(String(j.type)))
      throw Error("Submit a new generation explicitly; retry may spend twice");
    return save(
      "job",
      bid,
      {
        status: "queued",
        attempts: 0,
        runAt: new Date().toISOString(),
        error: null,
      },
      j.id,
    );
  }
  if (action === "job.cancel") {
    const j = get(str(input.id), bid);
    if (j.kind !== "job" || j.status !== "queued")
      throw Error("Only queued jobs can cancel");
    return save("job", bid, { status: "cancelled" }, j.id);
  }
  throw Error("Unknown action");
}
export function experimentResult(e: Row) {
  const all = list("variant", e.brandId).filter((v) => v.experimentId === e.id);
  const snapshots = list("snapshot", e.brandId);
  return compare(
    all.map((v) => {
      const s = snapshots.find((s) => s.variantId === v.id);
      return {
        label: String(v.label),
        success: s?.success as number | undefined,
        total: s?.total as number | undefined,
        windowHours: s?.windowHours as number | undefined,
        synthetic: s?.synthetic === true,
      };
    }),
  );
}
