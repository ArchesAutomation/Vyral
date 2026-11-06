"use client";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from "react";
import Icon from "./icon";
import Editor from "./editor";
import { AppearanceProvider, AppearanceSettings, GlassBackdrop } from "./appearance";
import { browserRender } from "../lib/browser-render";
import { compare, type Composition, type Row } from "../lib/domain";
import {
  estimateImageCost,
  estimateVideoCost,
  allowedDurations,
} from "../vendor/open-higgsfield/models";
import type { ImageModel, VideoModel } from "../vendor/open-higgsfield/types";
type View =
  | "home"
  | "inspiration"
  | "content"
  | "generation"
  | "editor"
  | "experiments"
  | "publishing"
  | "analytics"
  | "intelligence"
  | "assets"
  | "settings";
type State = {
  brands: Row[];
  brandId?: string;
  records: Record<string, Row[]>;
  hasKey: boolean;
  renderMode?: "browser";
  worker: { last_seen: string } | null;
  models: { image: ImageModel[]; video: VideoModel[] };
};
type Field = {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  value?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
};
type Dialog = {
  title: string;
  description?: string;
  fields: Field[];
  submit: string;
  run: (values: Record<string, string>) => Promise<void>;
};
const nav: { id: View; label: string; group?: string }[] = [
  { id: "home", label: "Command Center", group: "WORKSPACE" },
  { id: "inspiration", label: "Inspiration" },
  { id: "content", label: "Content Lab" },
  { id: "generation", label: "AI Generation" },
  { id: "editor", label: "Video Editor" },
  {
    id: "experiments",
    label: "A–Z Experiment Lab",
    group: "DISTRIBUTE & LEARN",
  },
  { id: "publishing", label: "Publishing" },
  { id: "analytics", label: "Analytics" },
  { id: "intelligence", label: "Creative Intelligence" },
  { id: "assets", label: "Assets", group: "MANAGE" },
  { id: "settings", label: "Settings" },
];
const descriptions: Record<View, string> = {
  home: "Your ideas, in motion.",
  inspiration: "Collect what moves you. Make something original.",
  content: "A home for your next great creative.",
  generation: "One prompt. A world of possibilities.",
  editor: "Shape every second.",
  experiments: "Stop guessing. Start learning.",
  publishing: "The right creative, at the right time.",
  analytics: "See what connects with your audience.",
  intelligence: "Turn your results into your next creative move.",
  assets: "Every piece of your creative world.",
  settings: "Make this studio yours.",
};
const emptyRecords: Record<string, Row[]> = {
  project: [],
  inspiration: [],
  asset: [],
  experiment: [],
  variant: [],
  post: [],
  snapshot: [],
  job: [],
  audit: [],
};
async function api(action: string, data: Record<string, unknown> = {}) {
  const r = await fetch("/api/studio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  const b = await r.json();
  if (!r.ok) throw Error(b.error || "Request failed");
  return b.result;
}
const options = (rows: Row[]) =>
  rows.map((x) => ({ value: x.id, label: x.name }));
const date = (s: unknown) =>
  new Date(String(s)).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}
function Empty({
  icon,
  title,
  detail,
  button,
  onClick,
}: {
  icon: string;
  title: string;
  detail: string;
  button?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {button && (
        <button className="secondary" onClick={onClick}>
          <Icon name="plus" />
          {button}
        </button>
      )}
    </div>
  );
}
function MediaThumb({ asset }: { asset?: Row }) {
  return asset ? (
    String(asset.mime).startsWith("image") ? (
      <img src={`/api/media/${asset.id}`} alt={asset.name} />
    ) : String(asset.mime).startsWith("video") ? (
      <video src={`/api/media/${asset.id}`} muted preload="metadata" />
    ) : (
      <div className="media-placeholder">
        <Icon name="assets" size={28} />
        <span>Audio</span>
      </div>
    )
  ) : (
    <div className="media-placeholder">
      <Icon name="editor" size={28} />
    </div>
  );
}
export default function Studio() {
  return <AppearanceProvider><StudioWorkspace /></AppearanceProvider>;
}
function StudioWorkspace() {
  const [state, setState] = useState<State | null>(null),
    [view, setView] = useState<View>("home"),
    [brandId, setBrand] = useState(""),
    [projectId, setProject] = useState(""),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [setup, setSetup] = useState(false),
    [search, setSearch] = useState(""),
    [menu, setMenu] = useState(false),
    [inspect, setInspect] = useState<Row | null>(null);
  const [cloudSetup, setCloudSetup] = useState(false),
    [setupToken, setSetupToken] = useState(""),
    [exportProgress, setExportProgress] = useState<number | null>(null);
  const exporting = useRef(false);
  useEffect(() => {
    const token = new URLSearchParams(location.hash.slice(1)).get("setup");
    if (token) {
      setSetupToken(token);
      history.replaceState(null, "", location.pathname + location.search);
    }
  }, []);
  const uploadRef = useRef<HTMLInputElement>(null);
  const records = state?.records || emptyRecords;
  const refresh = useCallback(async () => {
    try {
      const r = await fetch(
        "/api/studio?_=" +
          Date.now() +
          (brandId ? "&brand=" + encodeURIComponent(brandId) : ""),
        { cache: "no-store" },
      );
      const b = await r.json();
      if (r.status === 401) {
        setAuth(true);
        setSetup(!b.configured);
        setCloudSetup(b.setupRequired === true);
        return;
      }
      if (!r.ok) throw Error(b.error);
      setState(b);
      setAuth(false);
      if (!brandId && b.brandId) setBrand(b.brandId);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [brandId]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDialog(null);
        setInspect(null);
        setMenu(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("#global-search")?.focus();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  async function run(action: string, data: Record<string, unknown> = {}) {
    const result = await api(action, { brandId, ...data });
    await refresh();
    return result as Row;
  }
  async function exportCreative(p: Row) {
    if (state?.renderMode !== "browser") return run("render", { id: p.id });
    if (exporting.current) throw Error("An export is already running");
    exporting.current = true;
    setExportProgress(0);
    let job: Row | undefined;
    try {
      job = await api("render", { brandId: p.brandId, id: p.id });
      const output = await browserRender(
        job!.composition as Composition,
        setExportProgress,
      );
      const form = new FormData();
      form.set("brandId", p.brandId);
      form.set("renderJobId", job!.id);
      form.set("file", output.blob, p.name + "." + output.extension);
      const r = await fetch("/api/media", { method: "POST", body: form });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Export upload failed");
      await refresh();
    } catch (e) {
      if (job)
        await api("render.fail", {
          brandId: p.brandId,
          id: job.id,
          error: (e as Error).message,
        }).catch(() => {});
      throw e;
    } finally {
      exporting.current = false;
      setExportProgress(null);
    }
  }
  function task(fn: () => Promise<unknown>, message = "Saved") {
    setError("");
    setBusy(true);
    fn()
      .then(() => setNotice(message))
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }
  function go(v: View) {
    setView(v);
    setMenu(false);
    setSearch("");
  }
  const activeBrand = state?.brands.find((x) => x.id === brandId),
    filtered = (kind: string) =>
      records[kind].filter(
        (x) =>
          !search ||
          JSON.stringify({ name: x.name, notes: x.notes, brief: x.brief })
            .toLowerCase()
            .includes(search.toLowerCase()),
      );
  const createBrand = () =>
    setDialog({
      title: "Give your brand a home",
      description:
        "Voice, audience, assets, and experiments stay scoped to this brand.",
      submit: "Create brand",
      fields: [
        { key: "name", label: "Brand name", placeholder: "Your brand" },
        {
          key: "description",
          label: "What do you do?",
          type: "textarea",
          required: false,
        },
        {
          key: "audience",
          label: "Audience",
          placeholder: "Who are you creating for?",
        },
        {
          key: "voice",
          label: "Brand voice",
          value: "Clear, confident, useful",
        },
      ],
      run: async (values) => {
        const b = await api("brand.create", values);
        setBrand(b.id);
        setNotice("Brand created");
      },
    });
  const createProject = (source?: Row) =>
    setDialog({
      title: "Start with an idea",
      description: "Keep it rough. You can shape the details in Content Lab.",
      submit: "Create project",
      fields: [
        {
          key: "name",
          label: "Project name",
          value: source ? `Inspired by ${source.name}` : "",
        },
        {
          key: "brief",
          label: "Creative brief",
          type: "textarea",
          value: source ? String(source.notes || "") : "",
        },
      ],
      run: async (values) => {
        const p = await run("project.create", {
          ...values,
          sourceId: source?.id,
        });
        setProject(p.id);
        go("content");
      },
    });
  const createInspiration = () =>
    setDialog({
      title: "Save a little inspiration",
      description:
        "Save a reference and describe the hook, pacing, or feeling you want to learn from. Links are bookmarked; restricted videos are never downloaded.",
      submit: "Save reference",
      fields: [
        {
          key: "name",
          label: "Reference title",
          placeholder: "The opening that stopped my scroll",
        },
        {
          key: "url",
          label: "Original link",
          type: "url",
          required: false,
          placeholder: "https://www.instagram.com/reel/…",
        },
        { key: "collection", label: "Collection", value: "Travel & lifestyle" },
        {
          key: "notes",
          label: "Creative observations",
          type: "textarea",
          placeholder:
            "What is the hook? How fast are the cuts? What makes the ending work?",
        },
      ],
      run: async (values) => {
        await run("inspiration.create", values);
        setNotice("Reference saved");
      },
    });
  function experiment(p?: Row, parent?: Row) {
    const projects = p ? [p] : records.project;
    setDialog({
      title: parent
        ? "Design your next experiment"
        : "One creative. Many possibilities.",
      description:
        "Change one variable. Every variant keeps a frozen copy of the base composition.",
      submit: "Create variants",
      fields: [
        {
          key: "projectId",
          label: "Base project",
          type: "select",
          options: options(projects),
          value: p?.id,
        },
        {
          key: "name",
          label: "Experiment name",
          value: parent ? `${parent.name} · round 2` : "",
        },
        {
          key: "hypothesis",
          label: "Hypothesis",
          type: "textarea",
          placeholder: "A question-led hook will keep more people watching.",
        },
        {
          key: "axis",
          label: "Creative variable",
          type: "select",
          options: [
            { value: "hook", label: "Opening hook text" },
            { value: "pacing", label: "Shot segmentation (seconds)" },
          ],
        },
        {
          key: "levels",
          label: "Variant levels · one per line (2–26)",
          type: "textarea",
          placeholder:
            "What if your routine is the edge?\nYour best trade starts before the market opens.\nA little more intention. A little less noise.",
        },
      ],
      run: async (values) => {
        await run("experiment.create", {
          ...values,
          levels: values.levels
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
          parentId: parent?.id,
        });
        go("experiments");
        setNotice("Experiment and editable variants created");
      },
    });
  }
  function schedule(p?: Row) {
    const ready = [...records.variant, ...records.project].filter(
      (v) => v.outputAssetId,
    );
    setDialog({
      title: "Schedule a sandbox post",
      description:
        "This verifies your workflow without publishing to a social account. A separate approval is required after scheduling.",
      submit: "Add to approval queue",
      fields: [
        {
          key: "id",
          label: "Rendered creative",
          type: "select",
          options: options(p ? [p] : ready),
          value: p?.id,
        },
        { key: "caption", label: "Caption", type: "textarea", required: false },
        {
          key: "scheduledAt",
          label: "Publish at · your local time",
          type: "datetime-local",
          value: new Date(
            Date.now() + 3600000 - new Date().getTimezoneOffset() * 60000,
          )
            .toISOString()
            .slice(0, 16),
        },
        {
          key: "trial",
          label: "Distribution",
          type: "select",
          options: [
            { value: "false", label: "Sandbox standard reel" },
            { value: "true", label: "Sandbox Trial Reel" },
          ],
        },
      ],
      run: async (values) => {
        await run("posts.queue", {
          ...values,
          scheduledAt: new Date(values.scheduledAt).toISOString(),
          trial: values.trial === "true",
        });
        go("publishing");
        setNotice("Sandbox post awaits approval");
      },
    });
  }
  function importMetrics(v?: Row) {
    setDialog({
      title: "Add a measurement snapshot",
      description:
        "Import real counts from a platform export or explicitly label test observations as synthetic. Retained plays must be a subset of total plays.",
      submit: "Save measurement",
      fields: [
        {
          key: "variantId",
          label: "Variant",
          type: "select",
          options: options(v ? [v] : records.variant),
          value: v?.id,
        },
        {
          key: "success",
          label: "Plays retained past 3 seconds",
          type: "number",
        },
        { key: "total", label: "Total eligible plays", type: "number" },
        {
          key: "windowHours",
          label: "Observation window (hours)",
          type: "number",
          value: "24",
        },
        {
          key: "synthetic",
          label: "Data source",
          type: "select",
          options: [
            {
              value: "false",
              label: "Real platform counts · manually imported",
            },
            { value: "true", label: "Synthetic · test data only" },
          ],
        },
      ],
      run: async (values) => {
        await run("metrics.import", {
          ...values,
          synthetic: values.synthetic === "true",
        });
        setNotice("Measurement snapshot saved");
      },
    });
  }
  async function upload(files: FileList | File[]) {
    if (!brandId) {
      setError("Create a brand before uploading");
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", f);
        fd.set("brandId", brandId);
        const r = await fetch("/api/media", { method: "POST", body: fd });
        const b = await r.json();
        if (!r.ok) throw Error(b.error);
      }
      await refresh();
      setNotice("Assets uploaded");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const selected =
    [...records.project, ...records.variant].find((p) => p.id === projectId) ||
    records.project[0];
  const selectedId = selected?.id;
  const saveComposition = useCallback(
    async (c: Composition) => {
      const saved = await api("project.save", {
        brandId,
        id: selectedId,
        composition: c,
      });
      setState((prior) =>
        prior
          ? {
              ...prior,
              records: {
                ...prior.records,
                [saved.kind]: prior.records[saved.kind].map((row) =>
                  row.id === saved.id ? saved : row,
                ),
              },
            }
          : prior,
      );
    },
    [brandId, selectedId],
  );
  const latest = records.snapshot.filter(
    (s, i, a) => a.findIndex((x) => x.variantId === s.variantId) === i,
  );
  function result(e: Row) {
    const vs = records.variant.filter((v) => v.experimentId === e.id);
    return compare(
      vs.map((v) => {
        const s = latest.find((s) => s.variantId === v.id);
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
  const workerOnline =
    !!state?.worker && Date.now() - Date.parse(state.worker.last_seen) < 420000;
  if (auth)
    return (
      <div className="auth-page">
        <div className="brandmark">
          v<span>y</span>ral<span className="logo-dot">.</span>
        </div>
        <div className="auth-card">
          <span className="eyebrow">YOUR CREATIVE OPERATING SYSTEM</span>
          <h1>
            A little inspiration.
            <br />A lot of possibility.
          </h1>
          <p>
            {setup || cloudSetup
              ? cloudSetup
                ? "Create a studio password using your one-time setup link."
                : "Finish server setup to open your studio."
              : "Sign in to your private creative workspace."}
          </p>
          {setup ? (
            <div className="setup-help">
              Create <code>.env.local</code> from <code>.env.example</code>,
              then set a studio password, session secret, and encryption key.
              Restart the app after saving.
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                task(async () => {
                  await api(cloudSetup ? "setup" : "login", {
                    password: fd.get("password"),
                    token: setupToken,
                  });
                  setCloudSetup(false);
                  setSetupToken("");
                  await refresh();
                }, "Welcome to your studio");
              }}
            >
              {cloudSetup && (
                <label>
                  One-time setup token
                  <input
                    name="token"
                    type="password"
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </label>
              )}
              <label>
                Studio password
                <input
                  type="password"
                  name="password"
                  required
                  minLength={cloudSetup ? 16 : undefined}
                  autoComplete={
                    cloudSetup ? "new-password" : "current-password"
                  }
                  placeholder="Enter your password"
                />
              </label>
              <button className="primary full" disabled={busy}>
                Enter studio <Icon name="arrow" />
              </button>
            </form>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <small>Private by design. Powered by your ideas.</small>
        </div>
        <div className="auth-orb" />
      </div>
    );
  return (
    <div className="studio-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a
          href="#"
          className="brandmark"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          v<span>y</span>ral<span className="logo-dot">.</span>
        </a>
        <div className="workspace-picker">
          <span className="brand-avatar">
            {activeBrand?.name.slice(0, 1) || "V"}
          </span>
          <div>
            <small>BRAND WORKSPACE</small>
            <select
              aria-label="Brand workspace"
              value={brandId}
              onChange={(e) => {
                if (e.target.value === "new") createBrand();
                else {
                  setBrand(e.target.value);
                  setProject("");
                }
              }}
            >
              {!state?.brands.length && (
                <option value="">Create your first brand</option>
              )}
              {state?.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value="new">＋ Add a brand</option>
            </select>
          </div>
        </div>
        <nav>
          {nav.map((n) => (
            <div key={n.id}>
              {n.group && <span className="nav-group">{n.group}</span>}
              <button
                className={`nav-item ${view === n.id ? "active" : ""}`}
                onClick={() => go(n.id)}
              >
                <Icon name={n.id} />
                {n.label}
                {n.id === "experiments" && records.experiment.length > 0 && (
                  <span className="nav-count">{records.experiment.length}</span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-status">
            <span className={`status-dot ${workerOnline ? "online" : ""}`} />
            {workerOnline ? "Worker online" : "Worker offline"}
            <small>
              {
                records.job.filter((j) =>
                  ["queued", "running"].includes(String(j.status)),
                ).length
              }{" "}
              active jobs
            </small>
          </div>
          <button className="profile" onClick={() => go("settings")}>
            <span className="profile-avatar">
              {activeBrand?.name.slice(0, 1) || "Y"}
            </span>
            <div>
              <strong>Your creative space</strong>
              <small>Personal studio</small>
            </div>
            <Icon name="settings" />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <GlassBackdrop reflect />
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Open navigation"
          >
            ☰
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>
            <strong>{nav.find((n) => n.id === view)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <button className="text-btn appearance-shortcut" onClick={() => go("settings")} aria-label="Customize appearance">Appearance</button>
            <div className="search">
              <Icon name="search" />
              <input
                id="global-search"
                placeholder="Search this workspace"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </div>
            <Badge>PRIVATE STUDIO</Badge>
            <button
              className="avatar"
              onClick={() => go("settings")}
              aria-label="Open studio settings"
            >
              {activeBrand?.name.slice(0, 1) || "V"}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {view === "home"
                  ? "CREATE. TEST. EVOLVE."
                  : activeBrand?.name || "YOUR WORKSPACE"}
              </span>
              <h1>
                {nav.find((n) => n.id === view)?.label}
                <span className="orange">{view === "home" ? "." : ""}</span>
              </h1>
              <p>{descriptions[view]}</p>
            </div>
            <div className="heading-actions">
              {view === "home" && (
                <button
                  className="primary"
                  disabled={!brandId}
                  onClick={() => createProject()}
                >
                  <Icon name="plus" />
                  New creative
                </button>
              )}
              {view === "inspiration" && (
                <button
                  className="primary"
                  disabled={!brandId}
                  onClick={createInspiration}
                >
                  <Icon name="plus" />
                  Save inspiration
                </button>
              )}
              {view === "content" && (
                <button
                  className="primary"
                  disabled={!brandId}
                  onClick={() => createProject()}
                >
                  <Icon name="plus" />
                  New project
                </button>
              )}
              {view === "experiments" && (
                <button
                  className="primary"
                  disabled={!records.project.length}
                  onClick={() => experiment()}
                >
                  <Icon name="experiments" />
                  New experiment
                </button>
              )}
              {view === "publishing" && (
                <button
                  className="primary"
                  disabled={
                    ![...records.project, ...records.variant].some(
                      (v) => v.outputAssetId,
                    )
                  }
                  onClick={() => schedule()}
                >
                  <Icon name="plus" />
                  Schedule sandbox post
                </button>
              )}
              {view === "analytics" && (
                <button
                  className="primary"
                  disabled={!records.variant.length}
                  onClick={() => importMetrics()}
                >
                  <Icon name="plus" />
                  Import measurements
                </button>
              )}
              {view === "assets" && (
                <button
                  className="primary"
                  disabled={!brandId || busy}
                  onClick={() => uploadRef.current?.click()}
                >
                  <Icon name="upload" />
                  Upload assets
                </button>
              )}
            </div>
          </div>
          {state?.renderMode === "browser" && (
            <div className="cloud-demo-note">
              Private shared demo · Uploads up to 25 MB · Exports up to 60
              seconds at 720 px wide · Keep this tab visible during export.
              Social publishing is sandbox only.
            </div>
          )}
          {exportProgress !== null && (
            <div className="cloud-demo-note" role="status">
              Exporting video: {exportProgress}% —{" "}
              {exportProgress === 100
                ? "saving to your media library"
                : "keep this tab visible"}
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <Icon name="close" />
              </button>
            </div>
          )}
          {view === "settings" && !state?.brands.length ? (
            <AppearanceSettings />
          ) : !state ? (
            <div className="loading">Opening your studio…</div>
          ) : !state.brands.length ? (
            <section className="panel onboarding">
                    <GlassBackdrop />
              <span className="eyebrow">
                A BLANK CANVAS, FULL OF POSSIBILITY
              </span>
              <h2>
                Meet your next
                <br />
                creative chapter.
              </h2>
              <p>
                Bring your brand, your footage, and your wildest ideas.
                <br />
                Your studio connects the dots.
              </p>
              <button className="primary" onClick={createBrand}>
                Create your first brand
                <Icon name="arrow" />
              </button>
              <div className="onboard-steps">
                <span>01 / Find inspiration</span>
                <span>02 / Make it yours</span>
                <span>03 / Learn what works</span>
              </div>
            </section>
          ) : (
            <>
              {view === "home" && (
                <>
                  <div className="dashboard-top">
                    <section className="hero-panel">
                      <div className="hero-copy">
                        <span className="eyebrow">
                          FROM SCROLL-STOPPING TO SOMETHING YOURS
                        </span>
                        <h2>
                          Your next great idea
                          <br />
                          starts <em>here.</em>
                        </h2>
                        <p>
                          Find a spark. Shape your story.
                          <br />
                          Test what makes people stay.
                        </p>
                        <button
                          className="light-btn"
                          onClick={createInspiration}
                        >
                          Find your inspiration <Icon name="arrow" />
                        </button>
                      </div>
                      <div className="hero-art" aria-hidden="true">
                        <div className="art-ring r1" />
                        <div className="art-ring r2" />
                        <div className="art-ring r3" />
                        <div className="art-core" />
                        <span className="art-label">IDEAS IN ORBIT ↗</span>
                      </div>
                      <div className="hero-foot">
                        <span className="status-dot online" /> Built for your
                        creative process <span>01 — ∞</span>
                      </div>
                    </section>
                    <section className="panel launchpad">
                    <GlassBackdrop />
                      <div className="panel-head">
                        <h3>Your launchpad</h3>
                        <span className="muted">Make the next move</span>
                      </div>
                      {[
                        {
                          n: "01",
                          icon: "inspiration",
                          title: "Capture a spark",
                          detail: "Save a reel, a link, an idea.",
                          fn: createInspiration,
                        },
                        {
                          n: "02",
                          icon: "generation",
                          title: "Make something original",
                          detail: "Start a script or create an asset.",
                          fn: () => go("generation"),
                        },
                        {
                          n: "03",
                          icon: "experiments",
                          title: "Test your creative",
                          detail: "Turn one idea into many possibilities.",
                          fn: () => go("experiments"),
                        },
                      ].map((x) => (
                        <button
                          className="launch-item"
                          key={x.n}
                          onClick={x.fn}
                        >
                          <span className="launch-icon">
                            <Icon name={x.icon} />
                          </span>
                          <div>
                            <strong>{x.title}</strong>
                            <small>{x.detail}</small>
                          </div>
                          <Icon name="arrow" />
                        </button>
                      ))}
                      <div className="setup-line">
                        <span
                          className={`status-dot ${state.hasKey ? "online" : ""}`}
                        />
                        {state.hasKey
                          ? "OpenRouter ready"
                          : "Connect OpenRouter to unlock AI"}
                        <button onClick={() => go("settings")}>
                          Settings ↗
                        </button>
                      </div>
                    </section>
                  </div>
                  <div className="stats-grid">
                    {[
                      {
                        n: records.project.length,
                        l: "Creatives in your studio",
                        icon: "content",
                      },
                      {
                        n: records.experiment.length,
                        l: "Experiments designed",
                        icon: "experiments",
                      },
                      {
                        n: records.post.filter(
                          (x) => x.status === "NEEDS_APPROVAL",
                        ).length,
                        l: "Awaiting your approval",
                        icon: "publishing",
                      },
                      {
                        n: records.asset.length,
                        l: "Assets in your library",
                        icon: "assets",
                      },
                    ].map((s) => (
                      <div className="stat-card" key={s.l}>
                        <div>
                          <Icon name={s.icon} />
                          <span className="muted">YOUR WORKSPACE</span>
                        </div>
                        <strong>{s.n.toString().padStart(2, "0")}</strong>
                        <small>{s.l}</small>
                      </div>
                    ))}
                  </div>
                  <div className="dashboard-bottom">
                    <section className="panel">
                    <GlassBackdrop />
                      <div className="panel-head">
                        <h3>
                          In the making{" "}
                          <span className="sub-count">
                            {records.project.length}
                          </span>
                        </h3>
                        <button
                          className="text-btn"
                          onClick={() => go("content")}
                        >
                          View all <Icon name="arrow" size={14} />
                        </button>
                      </div>
                      {records.project.length ? (
                        <div className="project-list">
                          {records.project.slice(0, 4).map((p) => (
                            <button
                              className="project-line"
                              key={p.id}
                              onClick={() => {
                                setProject(p.id);
                                go("editor");
                              }}
                            >
                              <div className="project-mini">
                                <Icon name="editor" />
                              </div>
                              <div>
                                <strong>{p.name}</strong>
                                <small>Edited {date(p.updatedAt)}</small>
                              </div>
                              <Badge>
                                {String(p.stage).replaceAll("_", " ")}
                              </Badge>
                              <Icon name="arrow" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Empty
                          icon="content"
                          title="Your next creative belongs here"
                          detail="Start with an idea, then build it into something worth sharing."
                          button="Create a project"
                          onClick={() => createProject()}
                        />
                      )}
                    </section>
                    <section className="panel">
                    <GlassBackdrop />
                      <div className="panel-head">
                        <h3>Studio activity</h3>
                        <Badge>LIVE</Badge>
                      </div>
                      {records.audit.length ? (
                        <div className="activity-list">
                          {records.audit.slice(0, 6).map((a) => (
                            <div className="activity" key={a.id}>
                              <span className="activity-dot" />
                              <div>
                                <strong>{a.name}</strong>
                                <small>{date(a.createdAt)}</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty
                          icon="clock"
                          title="A fresh start"
                          detail="Your creative milestones will show up here."
                        />
                      )}
                    </section>
                  </div>
                </>
              )}
              {view === "inspiration" && (
                <>
                  <div className="filter-strip">
                    <Badge>{records.inspiration.length} REFERENCES</Badge>
                    <span>Save the structure. Create your own story.</span>
                  </div>
                  {filtered("inspiration").length ? (
                    <div className="card-grid">
                      {filtered("inspiration").map((r, i) => (
                        <article className="panel inspiration-card" key={r.id}>
                          <div className={`reference-art ref-${i % 3}`}>
                            <Icon name="inspiration" size={40} />
                            <span>{String(r.collection)}</span>
                          </div>
                          <div className="card-copy">
                            <span className="eyebrow">CREATIVE REFERENCE</span>
                            <h3>{r.name}</h3>
                            <p>{String(r.notes)}</p>
                            <div className="card-actions">
                              <button
                                className="secondary"
                                onClick={() => createProject(r)}
                              >
                                Adapt idea <Icon name="arrow" size={14} />
                              </button>
                              <button
                                className="text-btn"
                                onClick={() => setInspect(r)}
                              >
                                Inspect DNA
                              </button>
                            </div>
                            {r.url ? (
                              <a
                                className="source-link"
                                href={String(r.url)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open original ↗
                              </a>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <section className="panel">
                    <GlassBackdrop />
                      <Empty
                        icon="inspiration"
                        title="Build your inspiration library"
                        detail="Save travel reels, beautiful edits, strong hooks, and creative observations. Take the idea somewhere new."
                        button="Save your first reference"
                        onClick={createInspiration}
                      />
                    </section>
                  )}
                </>
              )}
              {view === "content" && (
                <>
                  {filtered("project").length ? (
                    <div className="card-grid">
                      {filtered("project").map((p) => (
                        <article className="panel project-card" key={p.id}>
                          <div className="project-art">
                            <MediaThumb
                              asset={
                                records.asset.find(
                                  (a) => a.id === p.outputAssetId,
                                ) ||
                                records.asset.find(
                                  (a) =>
                                    a.id ===
                                    (p.composition as Composition)?.clips?.[0]
                                      ?.assetId,
                                )
                              }
                            />
                            <Badge>
                              {String(p.stage).replaceAll("_", " ")}
                            </Badge>
                          </div>
                          <div className="card-copy">
                            <h3>{p.name}</h3>
                            <p>{String(p.brief)}</p>
                            {p.script ? (
                              <details>
                                <summary>Script & storyboard</summary>
                                <pre>{JSON.stringify(p.script, null, 2)}</pre>
                              </details>
                            ) : null}
                            <div className="card-actions">
                              <button
                                className="secondary"
                                onClick={() => {
                                  setProject(p.id);
                                  go("editor");
                                }}
                              >
                                Open editor <Icon name="arrow" size={14} />
                              </button>
                              <button
                                className="text-btn"
                                onClick={() => experiment(p)}
                              >
                                Test variants
                              </button>
                            </div>
                            <button
                              className="text-btn generate-script"
                              disabled={!state.hasKey}
                              onClick={() =>
                                setDialog({
                                  title: "Let’s shape your story",
                                  description:
                                    "Uses your brand voice, audience, approved claims, and brief. Paid model usage requires your OpenRouter key.",
                                  submit: "Generate creative plan",
                                  fields: [
                                    {
                                      key: "model",
                                      label: "OpenRouter text model ID",
                                      placeholder:
                                        "Enter a model from your OpenRouter account",
                                    },
                                  ],
                                  run: async (values) => {
                                    await run("script", {
                                      projectId: p.id,
                                      ...values,
                                    });
                                    setNotice("Creative plan queued");
                                  },
                                })
                              }
                            >
                              ✦ Generate script & storyboard
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <section className="panel">
                    <GlassBackdrop />
                      <Empty
                        icon="content"
                        title="From rough idea to ready to share"
                        detail="Create a project to develop a script, arrange footage, and test original variations."
                        button="New project"
                        onClick={() => createProject()}
                      />
                    </section>
                  )}
                </>
              )}
              {view === "generation" && (
                <Generation
                  state={state}
                  assets={records.asset}
                  busy={busy}
                  submit={(data) =>
                    task(() => run("generation", data), "Generation queued")
                  }
                  settings={() => go("settings")}
                />
              )}
              {view === "editor" && (
                <>
                  {selected ? (
                    <>
                      <div className="editor-toolbar">
                        <label>
                          EDITING
                          <select
                            value={selected.id}
                            onChange={(e) => setProject(e.target.value)}
                          >
                            {[...records.project, ...records.variant].map(
                              (p) => (
                                <option value={p.id} key={p.id}>
                                  {p.name}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <button
                          className="secondary"
                          onClick={() => experiment(selected)}
                        >
                          Create experiment <Icon name="experiments" />
                        </button>
                      </div>
                      <Editor
                        key={selected.id}
                        project={selected}
                        assets={records.asset}
                        onSave={saveComposition}
                        browserMode={state.renderMode === "browser"}
                        rendering={exportProgress !== null}
                        onRender={() =>
                          task(
                            () => exportCreative(selected),
                            state.renderMode === "browser"
                              ? "Video saved to your media library"
                              : "MP4 render queued",
                          )
                        }
                      />
                    </>
                  ) : (
                    <section className="panel">
                    <GlassBackdrop />
                      <Empty
                        icon="editor"
                        title="Every second is yours"
                        detail="Create a project, then add your own video, images, and audio to the timeline."
                        button="Create a project"
                        onClick={() => createProject()}
                      />
                    </section>
                  )}
                </>
              )}
              {view === "experiments" && (
                <>
                  {filtered("experiment").length ? (
                    filtered("experiment").map((e) => {
                      const analysis = result(e),
                        vs = records.variant.filter(
                          (v) => v.experimentId === e.id,
                        );
                      return (
                        <section className="panel experiment-panel" key={e.id}>
                          <div className="panel-head">
                            <div>
                              <span className="eyebrow">
                                {String(e.axis).toUpperCase()} EXPERIMENT ·{" "}
                                {vs.length} VARIANTS
                              </span>
                              <h2>{e.name}</h2>
                              <p className="muted">{String(e.hypothesis)}</p>
                            </div>
                            <Badge>{analysis.status}</Badge>
                          </div>
                          <div className="variant-grid">
                            {vs.map((v) => {
                              const measurement = analysis.rows.find(
                                (r) => r.label === v.label,
                              );
                              return (
                                <article className="variant-card" key={v.id}>
                                  <div className="variant-letter">
                                    {String(v.label)}
                                  </div>
                                  <span className="eyebrow">
                                    {String(e.axis)}
                                  </span>
                                  <h4>
                                    {String(
                                      (v.changes as Record<string, unknown>)
                                        .value,
                                    )}
                                  </h4>
                                  {measurement ? (
                                    <div className="measurement">
                                      <strong>
                                        {(measurement.rate * 100).toFixed(1)}%
                                      </strong>
                                      <small>
                                        retained · {measurement.total} eligible
                                        plays
                                        {measurement.synthetic
                                          ? " · SYNTHETIC"
                                          : ""}
                                      </small>
                                      <div className="confidence">
                                        <span
                                          style={{
                                            left: `${measurement.low * 100}%`,
                                            width: `${(measurement.high - measurement.low) * 100}%`,
                                          }}
                                        />
                                      </div>
                                      <small>
                                        {(measurement.low * 100).toFixed(1)}–
                                        {(measurement.high * 100).toFixed(1)}%
                                        interval
                                      </small>
                                    </div>
                                  ) : (
                                    <p className="muted">No measurement yet</p>
                                  )}
                                  <div className="variant-actions">
                                    <button
                                      className="text-btn"
                                      onClick={() => {
                                        setProject(v.id);
                                        go("editor");
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="text-btn"
                                      onClick={() =>
                                        task(
                                          () => exportCreative(v),
                                          state.renderMode === "browser"
                                            ? "Variant video saved"
                                            : "Variant render queued",
                                        )
                                      }
                                    >
                                      Render
                                    </button>
                                    <button
                                      className="text-btn"
                                      onClick={() => importMetrics(v)}
                                    >
                                      Measure
                                    </button>
                                    {!!v.outputAssetId && (
                                      <button
                                        className="text-btn"
                                        onClick={() => schedule(v)}
                                      >
                                        Schedule
                                      </button>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                          <div className="experiment-foot">
                            <p>{analysis.note}</p>
                            <button
                              className="secondary"
                              onClick={() =>
                                experiment(
                                  records.project.find(
                                    (p) => p.id === e.projectId,
                                  ),
                                  e,
                                )
                              }
                            >
                              Create next experiment{" "}
                              <Icon name="arrow" size={14} />
                            </button>
                          </div>
                        </section>
                      );
                    })
                  ) : (
                    <section className="panel">
                    <GlassBackdrop />
                      <Empty
                        icon="experiments"
                        title="The difference is in the details"
                        detail="Test 2–26 hooks or shot segmentation settings. Keep the base creative fixed and compare equivalent measurement windows."
                        button="Design an experiment"
                        onClick={() =>
                          records.project.length
                            ? experiment()
                            : createProject()
                        }
                      />
                    </section>
                  )}
                </>
              )}
              {view === "publishing" && (
                <>
                  <div className="integration-banner">
                    <Icon name="publishing" />
                    <div>
                      <strong>Sandbox publishing is active</strong>
                      <p>
                        Approval, scheduling, and job execution are functional.
                        No content is sent to Instagram, YouTube, or TikTok.
                      </p>
                    </div>
                    <Badge>NO LIVE ACCOUNTS</Badge>
                  </div>
                  <div className="stats-grid compact">
                    {["NEEDS_APPROVAL", "QUEUED", "PUBLISHED", "CANCELLED"].map(
                      (s) => (
                        <div className="stat-card" key={s}>
                          <strong>
                            {records.post.filter((p) => p.status === s).length}
                          </strong>
                          <small>{s.replaceAll("_", " ")}</small>
                        </div>
                      ),
                    )}
                  </div>
                  <section className="panel">
                    <GlassBackdrop />
                    <div className="panel-head">
                      <h3>Publishing queue</h3>
                      <button
                        className="text-btn"
                        disabled={
                          busy ||
                          !records.post.some(
                            (p) => p.status === "NEEDS_APPROVAL",
                          )
                        }
                        onClick={() =>
                          task(async () => {
                            for (const p of records.post.filter(
                              (p) => p.status === "NEEDS_APPROVAL",
                            ))
                              await run("posts.approve", { id: p.id });
                          }, "Sandbox batch approved")
                        }
                      >
                        Approve sandbox batch
                      </button>
                    </div>
                    {records.post.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Creative</th>
                              <th>Schedule</th>
                              <th>Distribution</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered("post").map((p) => (
                              <tr key={p.id}>
                                <td>
                                  <strong>{p.name}</strong>
                                  <small>{String(p.caption || "")}</small>
                                </td>
                                <td>{date(p.scheduledAt)}</td>
                                <td>
                                  {p.trial
                                    ? "Sandbox Trial"
                                    : "Sandbox standard"}
                                </td>
                                <td>
                                  <Badge>
                                    {String(p.status).replaceAll("_", " ")}
                                  </Badge>
                                </td>
                                <td>
                                  <div className="table-actions">
                                    {p.status === "NEEDS_APPROVAL" && (
                                      <button
                                        className="secondary"
                                        onClick={() =>
                                          task(
                                            () =>
                                              run("posts.approve", {
                                                id: p.id,
                                              }),
                                            "Approved for sandbox execution",
                                          )
                                        }
                                      >
                                        Approve
                                      </button>
                                    )}
                                    {!["PUBLISHED", "CANCELLED"].includes(
                                      String(p.status),
                                    ) && (
                                      <button
                                        className="text-btn"
                                        onClick={() =>
                                          task(
                                            () =>
                                              run("posts.cancel", { id: p.id }),
                                            "Post cancelled",
                                          )
                                        }
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        icon="publishing"
                        title="Your publishing rhythm starts here"
                        detail="Render a project or variant, schedule a sandbox post, and approve it to verify the complete queue."
                      />
                    )}
                  </section>
                </>
              )}
              {view === "analytics" && (
                <>
                  <div className="filter-strip">
                    <Badge>MANUAL IMPORTS</Badge>
                    <span>
                      Latest snapshot per variant · synthetic data is identified
                      separately
                    </span>
                  </div>
                  <div className="stats-grid compact">
                    {[
                      {
                        name: "Real measured plays",
                        value: latest
                          .filter((s) => !s.synthetic)
                          .reduce((n, s) => n + Number(s.total), 0),
                      },
                      {
                        name: "Synthetic test plays",
                        value: latest
                          .filter((s) => s.synthetic)
                          .reduce((n, s) => n + Number(s.total), 0),
                      },
                      { name: "Measured variants", value: latest.length },
                      {
                        name: "Snapshot history",
                        value: records.snapshot.length,
                      },
                    ].map((x) => (
                      <div className="stat-card" key={x.name}>
                        <strong>{x.value.toLocaleString()}</strong>
                        <small>{x.name}</small>
                      </div>
                    ))}
                  </div>
                  <section className="panel">
                    <GlassBackdrop />
                    <div className="panel-head">
                      <h3>Creative performance</h3>
                      <Badge>3-SECOND RETENTION</Badge>
                    </div>
                    {latest.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Variant</th>
                              <th>Source</th>
                              <th>Retained / eligible</th>
                              <th>Rate</th>
                              <th>Window</th>
                              <th>Collected</th>
                            </tr>
                          </thead>
                          <tbody>
                            {latest.map((s) => (
                              <tr key={s.id}>
                                <td>{s.name}</td>
                                <td>
                                  <Badge>
                                    {s.synthetic
                                      ? "SYNTHETIC"
                                      : "REAL · MANUAL"}
                                  </Badge>
                                </td>
                                <td>
                                  {String(s.success)} / {String(s.total)}
                                </td>
                                <td>
                                  <div className="rate-cell">
                                    <span>
                                      {(
                                        (Number(s.success) / Number(s.total)) *
                                        100
                                      ).toFixed(1)}
                                      %
                                    </span>
                                    <div>
                                      <i
                                        style={{
                                          width: `${(Number(s.success) / Number(s.total)) * 100}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td>{String(s.windowHours)}h</td>
                                <td>{date(s.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        icon="analytics"
                        title="Let the evidence come to you"
                        detail="Import comparable measurements for your variants. Missing metrics stay missing; nothing is estimated or invented."
                      />
                    )}
                  </section>
                </>
              )}
              {view === "intelligence" && (
                <>
                  <section className="intelligence-heading">
                    <Icon name="intelligence" size={30} />
                    <h2>Your results. Your next move.</h2>
                    <p>Evidence first. Creative decisions second.</p>
                  </section>
                  {records.experiment.length ? (
                    <div className="card-grid two">
                      {records.experiment.map((e) => {
                        const a = result(e);
                        return (
                          <section className="panel insight-card" key={e.id}>
                            <span className="eyebrow">
                              {a.synthetic
                                ? "SYNTHETIC TEST OBSERVATIONS"
                                : "OBSERVATIONAL EVIDENCE"}
                            </span>
                            <h3>{e.name}</h3>
                            <h2>{a.status}</h2>
                            <p>
                              {a.leading
                                ? `Variant ${a.leading} currently leads among measured variants. `
                                : "There are no comparable measurements yet. "}
                              {a.status === "Supported association"
                                ? "Repeat with fresh footage and comparable distribution to assess consistency."
                                : "Collect at least 100 eligible plays per variant at the same 24-hour window before interpreting differences."}
                            </p>
                            <small>{a.note}</small>
                            <button
                              className="secondary"
                              onClick={() =>
                                experiment(
                                  records.project.find(
                                    (p) => p.id === e.projectId,
                                  ),
                                  e,
                                )
                              }
                            >
                              Design the next test{" "}
                              <Icon name="arrow" size={14} />
                            </button>
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <section className="panel">
                    <GlassBackdrop />
                      <Empty
                        icon="intelligence"
                        title="Great creative gets better with evidence"
                        detail="Your experiment results will inform the next test. Build your first experiment to begin."
                        button="Open Experiment Lab"
                        onClick={() => go("experiments")}
                      />
                    </section>
                  )}
                </>
              )}
              {view === "assets" && (
                <>
                  <div
                    className="upload-zone"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        uploadRef.current?.click();
                    }}
                    onClick={() => uploadRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      upload(e.dataTransfer.files);
                    }}
                  >
                    <Icon name="upload" size={28} />
                    <strong>
                      {busy
                        ? "Uploading your assets…"
                        : "Drop footage, images, or audio here"}
                    </strong>
                    <small>
                      Or click to browse · MP4, WebM, PNG, JPG, WebP, MP3, WAV,
                      M4A · {state.renderMode === "browser" ? 25 : 64} MB per
                      file
                    </small>
                  </div>
                  {filtered("asset").length ? (
                    <div className="asset-grid">
                      {filtered("asset").map((a) => (
                        <article className="panel asset-card" key={a.id}>
                          <div className="asset-preview">
                            <MediaThumb asset={a} />
                          </div>
                          <div className="card-copy">
                            <h4>{a.name}</h4>
                            <small>
                              {String(a.mime)} · {String(a.provenance)}
                            </small>
                            <div className="card-actions">
                              <a
                                className="text-btn"
                                href={`/api/media/${a.id}`}
                                download
                              >
                                Download ↗
                              </a>
                              <button
                                className="text-btn"
                                onClick={() =>
                                  task(async () => {
                                    const p = await run("project.create", {
                                      name: a.name,
                                      assetId: a.id,
                                      brief: "",
                                    });
                                    setProject(p.id);
                                    go("editor");
                                  }, "Project created from asset")
                                }
                              >
                                Use in project
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon="assets"
                      title="Room for all your raw material"
                      detail="Your uploads, AI generations, and finished renders live here."
                    />
                  )}
                </>
              )}
              {view === "settings" && (
                <div className="settings-grid">
                  <AppearanceSettings />
                  <section className="panel">
                    <GlassBackdrop />
                    <div className="panel-head">
                      <h3>Brand brain</h3>
                      <Badge>{activeBrand?.name}</Badge>
                    </div>
                    <p className="muted">
                      Your audience and voice guide AI scripts. Claims define
                      what your content may say.
                    </p>
                    <button
                      className="secondary"
                      onClick={() =>
                        setDialog({
                          title: "Shape your brand brain",
                          submit: "Save brand",
                          fields: [
                            {
                              key: "name",
                              label: "Brand name",
                              value: activeBrand?.name,
                            },
                            {
                              key: "description",
                              label: "Description",
                              type: "textarea",
                              value: String(activeBrand?.description || ""),
                            },
                            {
                              key: "audience",
                              label: "Audience",
                              value: String(activeBrand?.audience || ""),
                            },
                            {
                              key: "voice",
                              label: "Voice & tone",
                              value: String(activeBrand?.voice || ""),
                            },
                            {
                              key: "website",
                              label: "Website",
                              type: "url",
                              required: false,
                              value: String(activeBrand?.website || ""),
                            },
                            {
                              key: "claims",
                              label: "Approved claims",
                              type: "textarea",
                              required: false,
                              value: String(activeBrand?.claims || ""),
                            },
                            {
                              key: "restrictedClaims",
                              label: "Restricted claims",
                              type: "textarea",
                              required: false,
                              value: String(
                                activeBrand?.restrictedClaims || "",
                              ),
                            },
                          ],
                          run: async (values) => {
                            await run("brand.update", values);
                            setNotice("Brand brain updated");
                          },
                        })
                      }
                    >
                      Edit brand guidelines <Icon name="arrow" size={14} />
                    </button>
                    <button className="text-btn block" onClick={createBrand}>
                      ＋ Add another brand
                    </button>
                  </section>
                  <section className="panel">
                    <GlassBackdrop />
                    <div className="panel-head">
                      <h3>OpenRouter</h3>
                      <Badge>
                        {state.hasKey ? "CONFIGURED" : "NOT CONNECTED"}
                      </Badge>
                    </div>
                    <p className="muted">
                      Your key stays on the server and is encrypted at rest.
                      Generation is charged to your OpenRouter account.
                    </p>
                    <button
                      className="secondary"
                      onClick={() =>
                        setDialog({
                          title: "Connect your creative engine",
                          description:
                            "Requires ENCRYPTION_KEY in server configuration. An environment key takes precedence over this saved key.",
                          submit: "Save encrypted key",
                          fields: [
                            {
                              key: "key",
                              label: "OpenRouter API key",
                              type: "password",
                              placeholder: "sk-or-v1-…",
                            },
                          ],
                          run: async (values) => {
                            await api("settings.key", values);
                            await refresh();
                            setNotice("OpenRouter key saved securely");
                          },
                        })
                      }
                    >
                      {" "}
                      {state.hasKey
                        ? "Update API key"
                        : "Add your API key"}{" "}
                      <Icon name="arrow" size={14} />
                    </button>
                    <small className="settings-note">
                      Daily budget is configured server-side. Estimates come
                      from the pinned Open Higgsfield catalog and may differ
                      from final provider charges.
                    </small>
                  </section>
                  <section className="panel wide">
                    <GlassBackdrop />
                    <div className="panel-head">
                      <h3>Social connections</h3>
                      <Badge>EXPORT & SANDBOX</Badge>
                    </div>
                    <div className="connections">
                      {["Instagram Reels", "YouTube Shorts", "TikTok"].map(
                        (n) => (
                          <div className="connection" key={n}>
                            <span className="connection-icon">
                              {n.slice(0, 1)}
                            </span>
                            <div>
                              <strong>{n}</strong>
                              <small>
                                No account connected · live adapter pending
                              </small>
                            </div>
                            <Badge>DISCONNECTED</Badge>
                          </div>
                        ),
                      )}
                    </div>
                    <p className="muted">
                      Export finished MP4s for manual posting. Live OAuth,
                      account capability checks, Trial Reel permissions, and
                      platform metric sync are not yet enabled.
                    </p>
                  </section>
                  <section className="panel wide">
                    <GlassBackdrop />
                    <div className="panel-head">
                      <h3>Background jobs</h3>
                      <Badge>
                        {workerOnline ? "ONLINE" : "START npm run worker"}
                      </Badge>
                    </div>
                    {records.job.length ? (
                      <div className="job-list">
                        {records.job.slice(0, 20).map((j) => (
                          <div className="job-row" key={j.id}>
                            <div>
                              <strong>{j.name}</strong>
                              <small>
                                {j.error ? String(j.error) : date(j.createdAt)}
                              </small>
                            </div>
                            <Badge>{String(j.status).toUpperCase()}</Badge>
                            {j.status === "queued" && (
                              <button
                                className="text-btn"
                                onClick={() =>
                                  task(
                                    () => run("job.cancel", { id: j.id }),
                                    "Queued job cancelled",
                                  )
                                }
                              >
                                Cancel
                              </button>
                            )}
                            {j.status === "failed" &&
                              !["generation", "script"].includes(
                                String(j.type),
                              ) && (
                                <button
                                  className="text-btn"
                                  onClick={() =>
                                    task(
                                      () => run("job.retry", { id: j.id }),
                                      "Job queued again",
                                    )
                                  }
                                >
                                  Retry
                                </button>
                              )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">
                        No jobs yet. AI generation and sandbox publishing run in
                        the worker. Video exports use{" "}
                        {state.renderMode === "browser"
                          ? "your open browser tab"
                          : "FFmpeg"}
                        .
                      </p>
                    )}
                  </section>
                  <button
                    className="text-btn"
                    onClick={() =>
                      task(async () => {
                        await api("logout");
                        setAuth(true);
                      }, "Signed out")
                    }
                  >
                    Sign out of studio
                  </button>
                </div>
              )}
              {view === "generation" && (
                <section className="panel generation-history">
                    <GlassBackdrop />
                  <div className="panel-head">
                    <h3>Generation history</h3>
                    <Badge>
                      {
                        records.job.filter((j) => j.type === "generation")
                          .length
                      }{" "}
                      JOBS
                    </Badge>
                  </div>
                  {records.job.filter((j) => j.type === "generation").length ? (
                    <div className="job-list">
                      {records.job
                        .filter((j) => j.type === "generation")
                        .map((j) => (
                          <div className="job-row" key={j.id}>
                            <div>
                              <strong>
                                {String(
                                  (j.payload as Record<string, unknown>).prompt,
                                ).slice(0, 100)}
                              </strong>
                              <small>
                                {String(
                                  (j.payload as Record<string, unknown>).model,
                                )}{" "}
                                ·{" "}
                                {j.error ? String(j.error) : date(j.createdAt)}
                              </small>
                            </div>
                            <Badge>{String(j.status)}</Badge>
                            {j.costUsd !== undefined && j.costUsd !== null && (
                              <span>${Number(j.costUsd).toFixed(3)}</span>
                            )}
                            {(j.result as Record<string, unknown>)?.assetId ? (
                              <a
                                className="text-btn"
                                href={`/api/media/${(j.result as Record<string, unknown>).assetId}`}
                                download
                              >
                                Download ↗
                              </a>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="muted">
                      Your generations, provider costs, and status will appear
                      here.
                    </p>
                  )}
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              VYRAL <span className="orange">/</span> MAKE SOMETHING THAT MOVES
              PEOPLE.
            </span>
            <small>Your ideas. Your assets. Your studio.</small>
          </footer>
        </main>
      </div>
      <input
        ref={uploadRef}
        type="file"
        multiple
        hidden
        accept="video/mp4,video/webm,image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,audio/mp4"
        onChange={(e) => {
          if (e.target.files) upload(e.target.files);
          e.target.value = "";
        }}
      />
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" />
          {notice}
        </div>
      )}
      {dialog && (
        <DialogForm
          key={dialog.title}
          dialog={dialog}
          close={() => setDialog(null)}
          onError={setError}
        />
      )}{" "}
      {inspect && (
        <div className="modal-backdrop" onClick={() => setInspect(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dna-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <h2 id="dna-title">Creative DNA</h2>
              <button
                className="icon-btn"
                aria-label="Close"
                onClick={() => setInspect(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <p className="muted">
              Notes-based template. Video analysis, shot detection, and OCR have
              not been run.
            </p>
            <pre>{JSON.stringify(inspect.dna, null, 2)}</pre>
          </section>
        </div>
      )}
    </div>
  );
}
function DialogForm({
  dialog,
  close,
  onError,
}: {
  dialog: Dialog;
  close: () => void;
  onError: (x: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>("input,textarea,select,button")
      ?.focus();
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const all = ref.current?.querySelectorAll<HTMLElement>(
        "input,textarea,select,button",
      );
      if (!all?.length) return;
      const first = all[0],
        last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(
        new FormData(e.currentTarget).entries(),
      ) as Record<string, string>;
      await dialog.run(data);
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="panel-head">
          <div>
            <span className="eyebrow">YOUR CREATIVE WORKFLOW</span>
            <h2 id="modal-title">{dialog.title}</h2>
          </div>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            disabled={busy}
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </div>
        {dialog.description && (
          <p className="modal-description">{dialog.description}</p>
        )}
        <form onSubmit={submit}>
          {dialog.fields.map((f) => (
            <label key={f.key}>
              {f.label}
              {f.type === "textarea" ? (
                <textarea
                  name={f.key}
                  defaultValue={f.value}
                  required={f.required !== false}
                  placeholder={f.placeholder}
                />
              ) : f.type === "select" ? (
                <select name={f.key} defaultValue={f.value} required>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={f.key}
                  defaultValue={f.value}
                  required={f.required !== false}
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  autoComplete={f.type === "password" ? "off" : undefined}
                />
              )}
            </label>
          ))}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="text-btn"
              onClick={close}
              disabled={busy}
            >
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Working…" : dialog.submit}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function Generation({
  state,
  assets,
  busy,
  submit,
  settings,
}: {
  state: State;
  assets: Row[];
  busy: boolean;
  submit: (data: Record<string, unknown>) => void;
  settings: () => void;
}) {
  const [kind, setKind] = useState<"image" | "video">("image"),
    [modelId, setModel] = useState(""),
    [prompt, setPrompt] = useState(""),
    [ratio, setRatio] = useState(""),
    [size, setSize] = useState(""),
    [duration, setDuration] = useState(5),
    [resolution, setResolution] = useState(""),
    [first, setFirst] = useState(""),
    [last, setLast] = useState(""),
    [audio, setAudio] = useState(false);
  const models = state.models[kind],
    model = models.find((m) => m.id === modelId) || models[0];
  const isImage = model.kind === "image",
    ar =
      ratio && (model.aspectRatios as string[]).includes(ratio)
        ? ratio
        : model.aspectRatios.includes("9:16")
          ? "9:16"
          : model.aspectRatios[0];
  const imageSize =
    isImage && model.sizes.includes(size as "1K")
      ? size
      : isImage
        ? model.sizes[0]
        : "";
  const res =
    !isImage && model.resolutions.includes(resolution as "720p")
      ? resolution
      : !isImage
        ? model.defaultResolution || model.resolutions[0]
        : "";
  const dur = !isImage
    ? allowedDurations(model).includes(duration)
      ? duration
      : model.defaultDuration
    : 5;
  const estimate = isImage
    ? estimateImageCost(model, imageSize as "1K", 1)
    : estimateVideoCost(model, dur, res as "720p");
  const refs = assets.filter((a) => String(a.mime).startsWith("image/"));
  return (
    <div className="generation-layout">
      <section className="panel generation-form">
                    <GlassBackdrop />
        <div className="segmented">
          <button
            className={kind === "image" ? "selected" : ""}
            onClick={() => {
              setKind("image");
              setModel("");
              setFirst("");
              setLast("");
            }}
          >
            Image
          </button>
          <button
            className={kind === "video" ? "selected" : ""}
            onClick={() => {
              setKind("video");
              setModel("");
              setFirst("");
              setLast("");
            }}
          >
            Video
          </button>
        </div>
        <span className="eyebrow">POWERED BY OPEN HIGGSFIELD</span>
        <h2>
          Imagine it.
          <br />
          Make it real.
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit({
              model: model.id,
              prompt,
              aspectRatio: ar,
              size: imageSize,
              duration: dur,
              resolution: res,
              referenceIds: [first, last].filter(Boolean),
              audio,
            });
          }}
        >
          <label>
            Your prompt
            <textarea
              className="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              placeholder="A slow, cinematic aerial over sunlit sandstone. Warm tones. A feeling of possibility…"
              maxLength={10000}
            />
          </label>
          <label>
            Model
            <select
              value={model.id}
              onChange={(e) => {
                setModel(e.target.value);
                setFirst("");
                setLast("");
              }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.verified ? "" : " · experimental"}
                </option>
              ))}
            </select>
          </label>
          <p className="model-description">{model.description}</p>
          <div className="two-col">
            <label>
              Aspect ratio
              <select value={ar} onChange={(e) => setRatio(e.target.value)}>
                {model.aspectRatios.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            {isImage ? (
              <label>
                Image size
                <select
                  value={imageSize}
                  onChange={(e) => setSize(e.target.value)}
                >
                  {model.sizes.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Resolution
                <select
                  value={res}
                  onChange={(e) => setResolution(e.target.value)}
                >
                  {model.resolutions.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {!isImage && (
            <label>
              Duration
              <select
                value={dur}
                onChange={(e) => setDuration(+e.target.value)}
              >
                {allowedDurations(model).map((x) => (
                  <option key={x} value={x}>
                    {x} seconds
                  </option>
                ))}
              </select>
            </label>
          )}
          {((isImage && model.caps.imageToImage) ||
            (!isImage && model.caps.imageToVideo)) && (
            <label>
              {isImage ? "Reference image" : "First frame"}
              <select value={first} onChange={(e) => setFirst(e.target.value)}>
                <option value="">None · generate from text</option>
                {options(refs).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!isImage && model.caps.lastFrame && (
            <label>
              Last frame
              <select value={last} onChange={(e) => setLast(e.target.value)}>
                <option value="">None</option>
                {options(refs).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!isImage && model.caps.audio && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={audio}
                onChange={(e) => setAudio(e.target.checked)}
              />
              Generate native audio
            </label>
          )}
          <div className="generation-cost">
            <span>Estimated generation cost</span>
            <strong>
              {estimate === undefined
                ? "Unavailable"
                : `~$${estimate.toFixed(3)}`}
            </strong>
          </div>
          <button
            className="primary full"
            disabled={busy || !state.hasKey || estimate === undefined}
          >
            <Icon name="generation" />
            Generate {kind}
            <Icon name="arrow" size={16} />
          </button>
          {!state.hasKey && (
            <button type="button" className="text-btn block" onClick={settings}>
              Add your OpenRouter key to begin ↗
            </button>
          )}
          <small className="cost-note">
            Submitting authorizes this paid generation within your server’s
            daily budget. Model availability and final cost are determined by
            OpenRouter.
          </small>
        </form>
      </section>
      <section className="generation-canvas">
        <div className="generation-spark" aria-hidden="true">
          ✦
        </div>
        <span className="eyebrow">
          YOUR IMAGINATION, WITHOUT THE BLANK PAGE
        </span>
        <h2>
          Make room for
          <br />
          the unexpected.
        </h2>
        <p>
          Describe a scene, bring a reference,
          <br />
          and follow the idea somewhere new.
        </p>
        <div className="prompt-chips">
          {[
            "Golden-hour mountain escape",
            "Quiet moments before the open",
            "A product story in motion",
          ].map((s) => (
            <button
              key={s}
              onClick={() =>
                setPrompt(
                  s +
                    ". Cinematic, natural light, vertical framing, original footage.",
                )
              }
            >
              {s} ↗
            </button>
          ))}
        </div>
        <small>
          Generated assets appear in your library when the worker finishes.
        </small>
      </section>
    </div>
  );
}

