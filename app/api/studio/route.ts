import { NextResponse } from "next/server";
import {
  authorized,
  configured,
  checkPassword,
  session,
  sameOrigin,
} from "../../../lib/security.ts";
import { limitedBody } from "../../../lib/http.ts";
import { act, state } from "../../../lib/services.ts";
import { validOwnerUsername } from "../../../lib/owner.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const attempts = new Map<string, { count: number; at: number }>();
export async function GET(req: Request) {
  if (!authorized(req))
    return NextResponse.json(
      {
        error: configured()
          ? "Sign in to your studio"
          : "Set STUDIO_PASSWORD (8–200 characters) and SESSION_SECRET (32+ characters) in .env.local",
        configured: configured(),
      },
      { status: 401 },
    );
  try {
    return NextResponse.json(
      state(new URL(req.url).searchParams.get("brand") || undefined),
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Origin rejected" }, { status: 403 });
  if (Number(req.headers.get("content-length")) > 1_000_000)
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  try {
    const body = JSON.parse(
      Buffer.from(await limitedBody(req, 1_000_000)).toString("utf8"),
    );
    if (body.action === "login") {
      const key = "global";
      const prior = attempts.get(key);
      const a =
        prior && Date.now() - prior.at < 60000
          ? prior
          : { count: 0, at: Date.now() };
      a.count++;
      attempts.set(key, a);
      if (a.count > 10)
        return NextResponse.json(
          { error: "Try again in a minute" },
          { status: 429 },
        );
      if (!validOwnerUsername(body.username) || !checkPassword(String(body.password || "")))
        return NextResponse.json(
          { error: "Incorrect username or password, or missing server configuration" },
          { status: 401 },
        );
      const r = NextResponse.json({ ok: true });
      r.cookies.set("vyral_session", session(), {
        httpOnly: true,
        sameSite: "strict",
        secure: new URL(req.url).protocol === "https:",
        path: "/",
        maxAge: 604800,
      });
      return r;
    }
    if (!authorized(req))
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    if (body.action === "logout") {
      const r = NextResponse.json({ ok: true });
      r.cookies.delete("vyral_session");
      return r;
    }
    return NextResponse.json({ result: act(body.action, body) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

