import { createServer } from "node:http";
import { Readable } from "node:stream";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { createHash } from "node:crypto";
const { default: worker, VyralStudio } = await import(
  "../.cloudflare/test-worker.mjs"
);
const sqlite = new DatabaseSync(":memory:"),
  objects = new Map(),
  secrets = {
    encryption: "ab".repeat(32),
    qaToken: "local-cloudflare-fixture-token",
  };
let studio;
const ctx = {
  storage: {
    sql: {
      exec(sql, ...args) {
        if (sql.split(";").filter((x) => x.trim()).length > 1) {
          sqlite.exec(sql);
          return { toArray: () => [] };
        }
        const rows = sqlite.prepare(sql).all(...args);
        return { toArray: () => rows };
      },
    },
    transactionSync(fn) {
      sqlite.exec("BEGIN");
      try {
        const r = fn();
        sqlite.exec("COMMIT");
        return r;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
    async setAlarm(time) {
      clearTimeout(this.timer);
      this.timer = setTimeout(
        () => studio.alarm(),
        Math.max(1, time - Date.now()),
      );
    },
    async deleteAlarm() {
      clearTimeout(this.timer);
    },
  },
};
const env = {
  ENCRYPTION_KEY: secrets.encryption,
  SETUP_TOKEN_HASH: createHash("sha256").update(secrets.qaToken).digest("hex"),
  STUDIO: {
    getByName() {
      return studio;
    },
  },
  MEDIA: {
    async put(key, bytes) {
      objects.set(key, new Uint8Array(bytes));
    },
    async get(key, options) {
      const all = objects.get(key);
      if (!all) return null;
      let bytes = all,
        range;
      const h = options?.range?.get("range");
      if (h) {
        const m = /bytes=(\d+)-(\d*)/.exec(h);
        if (m) {
          const offset = +m[1],
            end = m[2] ? Math.min(+m[2], all.length - 1) : all.length - 1;
          bytes = all.slice(offset, end + 1);
          range = { offset, length: bytes.length };
        }
      }
      return {
        body: new Blob([bytes]).stream(),
        size: all.length,
        httpEtag: '"fixture"',
        range,
      };
    },
    async delete(key) {
      objects.delete(key);
    },
  },
};
studio = new VyralStudio(ctx, env);
createServer(async (req, res) => {
  try {
    const url = "http://127.0.0.1:3090" + req.url;
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers))
      if (value)
        headers.set(name, Array.isArray(value) ? value.join(",") : value);
    const request = new Request(url, {
      method: req.method,
      headers,
      ...(!["GET", "HEAD"].includes(req.method)
        ? { body: Readable.toWeb(req), duplex: "half" }
        : {}),
    });
    const r = await worker.fetch(request, env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    if (r.body) Readable.fromWeb(r.body).pipe(res);
    else res.end();
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end(String(e));
  }
}).listen(3090, "127.0.0.1", () =>
  console.log("Cloudflare integration fixture listening on 3090"),
);
