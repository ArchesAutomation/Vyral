export async function limitedBody(req: Request, max: number) {
  const reader = req.body?.getReader();
  if (!reader) throw Error("Empty request");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    bytes += item.value.length;
    if (bytes > max) {
      await reader.cancel();
      throw Error("Request exceeds size limit");
    }
    chunks.push(item.value);
  }
  const out = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
export function mediaMagic(bytes: Uint8Array, mime: string) {
  const b = Buffer.from(bytes);
  if (mime === "image/png")
    return b
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg") return b[0] === 255 && b[1] === 216;
  if (mime === "image/webp")
    return (
      b.subarray(0, 4).toString() === "RIFF" &&
      b.subarray(8, 12).toString() === "WEBP"
    );
  if (mime === "video/mp4" || mime === "audio/mp4")
    return b.subarray(4, 8).toString() === "ftyp";
  if (mime === "video/webm")
    return b.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
  if (mime === "audio/wav")
    return (
      b.subarray(0, 4).toString() === "RIFF" &&
      b.subarray(8, 12).toString() === "WAVE"
    );
  if (mime === "audio/mpeg")
    return (
      b.subarray(0, 3).toString() === "ID3" ||
      (b[0] === 255 && (b[1] & 224) === 224)
    );
  return false;
}
