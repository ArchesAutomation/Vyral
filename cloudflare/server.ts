import { DurableObject } from "cloudflare:workers";
import { inStudio, type Env, type StudioContext } from "./runtime.ts";
import { schema, db, list, get, save, audit } from "./db.ts";
import {
  authorized,
  sameOrigin,
  setupRequired,
  setupTokenValid,
  setPassword,
  checkPassword,
  newSession,
  logout,
  loginAllowed,
} from "./security.ts";
import { state, act, brand } from "../lib/services.ts";
import { limitedBody } from "../lib/http.ts";
import {
  validateComposition,
  type Composition,
  type Row,
} from "../lib/domain.ts";
import { storeMedia, serveMedia, startBrowserRender } from "./media.ts";
import { generation, script } from "./providers.ts";
import { client, css, assetVersion } from "./assets.ts";
const json = (
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
const cookie = (token: string) =>
  `vyral_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
export class VyralStudio extends DurableObject<Env> {
  private settingUp = false;
  constructor(ctx: StudioContext, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(schema);
  }
  fetch(req: Request) {
    return inStudio(this.ctx, this.env, async () => {
      try {
        return await this.route(req);
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }
    });
  }
  private async route(req: Request) {
    const url = new URL(req.url);
    if (req.method !== "GET" && !sameOrigin(req))
      return json({ error: "Origin rejected" }, 403);
    if (url.pathname === "/api/studio") {
      if (req.method === "GET") {
        if (!authorized(req))
          return json(
            {
              error: "Sign in to your studio",
              configured: true,
              setupRequired: setupRequired(),
            },
            401,
          );
        return json({
          ...state(url.searchParams.get("brand") || undefined),
          renderMode: "browser",
          worker: { last_seen: new Date().toISOString() },
        });
      }
      if (req.method !== "POST")
        return json({ error: "Method not allowed" }, 405);
      const body = JSON.parse(
        new TextDecoder().decode(await limitedBody(req, 1_000_000)),
      );
      if (["setup", "login"].includes(body.action)) {
        if (!loginAllowed())
          return json({ error: "Try again in a minute" }, 429);
        if (body.action === "setup") {
          if (
            !setupRequired() ||
            this.settingUp ||
            !setupTokenValid(body.token)
          )
            return json(
              { error: "Setup link is invalid or already used" },
              403,
            );
          this.settingUp = true;
          try {
            await setPassword(body.password);
          } finally {
            this.settingUp = false;
          }
        } else if (
          typeof body.password !== "string" ||
          body.password.length > 200 ||
          !(await checkPassword(body.password))
        )
          return json({ error: "Incorrect password" }, 401);
        return json({ ok: true }, 200, { "Set-Cookie": cookie(newSession()) });
      }
      if (!authorized(req)) return json({ error: "Sign in required" }, 401);
      if (body.action === "logout") {
        logout(req);
        return json({ ok: true }, 200, {
          "Set-Cookie":
            "vyral_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
        });
      }
      if (body.action === "render.fail") {
        const j = get(String(body.id), brand(body.brandId).id);
        if (
          j.kind !== "job" ||
          j.type !== "browser-render" ||
          j.status !== "running"
        )
          throw Error("Invalid browser export");
        return json({
          result: save(
            "job",
            j.brandId,
            {
              status: "failed",
              error: String(body.error || "Browser export stopped").slice(
                0,
                500,
              ),
            },
            j.id,
          ),
        });
      }
      if (
        body.action === "job.retry" &&
        get(String(body.id)).type === "browser-render"
      )
        throw Error("Open the creative and export again");
      const result =
        body.action === "render"
          ? startBrowserRender(get(String(body.id), brand(body.brandId).id))
          : act(body.action, body);
      await this.schedule();
      return json({ result });
    }
    if (!authorized(req)) return json({ error: "Sign in required" }, 401);
    if (url.pathname.startsWith("/api/media/") && req.method === "GET")
      return serveMedia(req, decodeURIComponent(url.pathname.slice(11)));
    if (url.pathname === "/api/media" && req.method === "POST") {
      const bytes = await limitedBody(req, 25_100_000);
      const form = await new Response(bytes, {
        headers: { "Content-Type": req.headers.get("content-type") || "" },
      }).formData();
      const file = form.get("file"),
        b = brand(form.get("brandId"));
      if (!(file instanceof File) || !file.size || file.size > 25_000_000)
        throw Error("Choose a file under 25 MB");
      const jobId = form.get("renderJobId");
      let job: Row | undefined, creative: Row | undefined;
      if (jobId) {
        job = get(String(jobId), b.id);
        if (
          job.kind !== "job" ||
          job.type !== "browser-render" ||
          job.status !== "running"
        )
          throw Error("Invalid export job");
        const p = job.payload as Record<string, unknown>;
        creative = get(String(p.id), b.id);
        if (creative.revisionId !== p.revisionId)
          throw Error("Composition changed; export the saved version again");
        if (!file.type.startsWith("video/"))
          throw Error("Export must be video");
      }
      const asset = await storeMedia(
        b.id,
        file.name,
        file.type,
        new Uint8Array(await file.arrayBuffer()),
        job
          ? {
              provenance: "browser_render",
              revisionId: (job.payload as Record<string, unknown>).revisionId,
            }
          : {},
      );
      if (job && creative) {
        const fresh = get(creative.id, b.id);
        if (
          fresh.revisionId ===
          (job.payload as Record<string, unknown>).revisionId
        )
          save(
            fresh.kind,
            b.id,
            { outputAssetId: asset.id, stage: "READY_FOR_REVIEW" },
            fresh.id,
          );
        save(
          "job",
          b.id,
          {
            status: "completed",
            result: { assetId: asset.id },
            completedAt: new Date().toISOString(),
          },
          job.id,
        );
        audit(b.id, "Browser export completed", {
          job: job.id,
          asset: asset.id,
        });
      }
      return json(asset);
    }
    return json({ error: "Not found" }, 404);
  }
  private async schedule() {
    const times = list("job")
      .flatMap((j) =>
        j.status === "queued"
          ? [Date.parse(String(j.runAt))]
          : j.status === "running"
            ? [
                Date.parse(
                  String(
                    j.leaseUntil ||
                      new Date(
                        Date.parse(j.createdAt) + 10 * 60000,
                      ).toISOString(),
                  ),
                ),
              ]
            : [],
      )
      .filter(Number.isFinite);
    if (times.length)
      await this.ctx.storage.setAlarm(
        Math.max(Date.now() + 1000, Math.min(...times)),
      );
    else await this.ctx.storage.deleteAlarm();
  }
  alarm() {
    return inStudio(this.ctx, this.env, async () => {
      const now = Date.now();
      for (const j of list("job").filter(
        (j) =>
          j.status === "running" &&
          Date.parse(
            String(
              j.leaseUntil ||
                new Date(Date.parse(j.createdAt) + 10 * 60000).toISOString(),
            ),
          ) <= now,
      ))
        save(
          "job",
          j.brandId,
          {
            status: j.pollingUrl ? "queued" : "failed",
            error: "Export or provider request interrupted; retry explicitly",
            runAt: new Date().toISOString(),
          },
          j.id,
        );
      const j = list("job")
        .reverse()
        .find(
          (j) => j.status === "queued" && Date.parse(String(j.runAt)) <= now,
        );
      if (j) {
        save(
          "job",
          j.brandId,
          {
            status: "running",
            leaseUntil: new Date(now + 6 * 60000).toISOString(),
            attempts: Number(j.attempts || 0) + 1,
          },
          j.id,
        );
        await this.schedule();
        try {
          let result: Record<string, unknown>;
          if (j.type === "generation") result = await generation(j);
          else if (j.type === "script") result = await script(j);
          else if (j.type === "publish") {
            const p = get(
              String((j.payload as Record<string, unknown>).postId),
              j.brandId,
            );
            if (
              p.provider !== "sandbox" ||
              p.status !== "QUEUED" ||
              !p.approvedAt
            )
              throw Error("Sandbox approval required");
            save(
              "post",
              p.brandId,
              {
                status: "PUBLISHED",
                synthetic: true,
                externalId: "sandbox-" + p.id,
                publishedAt: new Date().toISOString(),
              },
              p.id,
            );
            result = { sandbox: true };
          } else throw Error("Open this creative in the browser to export");
          if (!result.pending)
            save(
              "job",
              j.brandId,
              {
                status: "completed",
                result,
                ...("costUsd" in result ? { costUsd: result.costUsd } : {}),
                completedAt: new Date().toISOString(),
              },
              j.id,
            );
        } catch (e) {
          save(
            "job",
            j.brandId,
            { status: "failed", error: (e as Error).message },
            j.id,
          );
        }
      }
      await this.schedule();
    });
  }
}
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101010"><title>Vyral — Creative Studio</title><link rel="stylesheet" href="/app.css?v=${assetVersion}"></head><body><div id="root"></div><script src="/app.js?v=${assetVersion}" defer></script></body></html>`;
export default {
  async fetch(req: Request, env: Env) {
    const path = new URL(req.url).pathname;
    let r: Response;
    if (path.startsWith("/api/"))
      r = await env.STUDIO.getByName(env.STUDIO_ID || "owner").fetch(req);
    else if (!["GET", "HEAD"].includes(req.method))
      r = new Response("Method not allowed", { status: 405 });
    else if (path === "/app.js")
      r = new Response(client, {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      });
    else if (path === "/app.css")
      r = new Response(css, {
        headers: {
          "Content-Type": "text/css; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      });
    else if (path === "/" || path === "/index.html")
      r = new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    else r = new Response("Not found", { status: 404 });
    const out = new Response(req.method === "HEAD" ? null : r.body, r);
    out.headers.set("X-Content-Type-Options", "nosniff");
    out.headers.set("X-Frame-Options", "DENY");
    out.headers.set("Referrer-Policy", "no-referrer");
    out.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    return out;
  },
};
