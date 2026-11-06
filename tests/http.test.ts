import test from "node:test";
import assert from "node:assert/strict";
import { limitedBody, mediaMagic } from "../lib/http.ts";
test("chunked requests are bounded without a content-length header", async () => {
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(11));
      c.close();
    },
  });
  await assert.rejects(
    () =>
      limitedBody(
        new Request("http://localhost", {
          method: "POST",
          body,
          duplex: "half",
        } as RequestInit),
        10,
      ),
    /size limit/,
  );
});
test("media signatures reject disguised uploads", () => {
  assert.equal(mediaMagic(Buffer.from("not-a-video"), "video/mp4"), false);
  assert.equal(
    mediaMagic(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"),
    true,
  );
  assert.equal(mediaMagic(Buffer.from("RIFF1234WAVE"), "audio/wav"), true);
  assert.equal(mediaMagic(Buffer.from("RIFF1234WEBP"), "image/webp"), true);
  assert.equal(mediaMagic(Buffer.from("<svg/>"), "image/svg+xml"), false);
});
