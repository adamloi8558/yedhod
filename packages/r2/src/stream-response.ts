import { Readable } from "node:stream";
import { Agent, request } from "undici";

// Bound media connections independently of Next's fetch/cache machinery.
const mediaAgent = new Agent({
  connections: 64,
  pipelining: 1,
  connectTimeout: 10_000,
  headersTimeout: 15_000,
  bodyTimeout: 60_000,
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 10_000,
});

export async function streamResponse(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<Response> {
  const upstream = await request(url, {
    dispatcher: mediaAgent,
    method: "GET",
    headers,
    signal,
  });
  const responseHeaders = new Headers();
  for (const [name, value] of Object.entries(upstream.headers)) {
    if (value !== undefined) {
      for (const item of Array.isArray(value) ? value : [value]) {
        responseHeaders.append(name, item);
      }
    }
  }

  if ([204, 205, 304].includes(upstream.statusCode)) {
    await upstream.body.dump();
    return new Response(null, { status: upstream.statusCode, headers: responseHeaders });
  }

  // Count bytes, not chunks, so slow clients cannot queue entire videos.
  // Cancelling the web stream destroys the Node stream/upstream socket;
  // the request signal also stops R2 reads when the viewer disconnects.
  const body = Readable.toWeb(upstream.body, {
    strategy: { highWaterMark: 64 * 1024, size: (chunk) => chunk.byteLength },
  }) as ReadableStream<Uint8Array>;
  return new Response(body, { status: upstream.statusCode, headers: responseHeaders });
}
