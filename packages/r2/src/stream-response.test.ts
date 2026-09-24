import assert from "node:assert/strict";
import { createServer, type RequestListener } from "node:http";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { streamResponse } from "./stream-response";

async function fixture(handler: RequestListener) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => { server.closeAllConnections(); server.close(); },
  };
}

test("preserves range bytes and conditional 304 responses", async () => {
  const server = await fixture((req, res) => {
    if (req.headers["if-none-match"] === '"test"') {
      res.writeHead(304, { etag: '"test"' }).end();
      return;
    }
    assert.equal(req.headers.range, "bytes=2-4");
    res.writeHead(206, { "content-range": "bytes 2-4/10", "content-length": "3" });
    res.end("234");
  });
  try {
    const range = await streamResponse(server.url, { range: "bytes=2-4" });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), "bytes 2-4/10");
    assert.equal(await range.text(), "234");
    const cached = await streamResponse(server.url, { "if-none-match": '"test"' });
    assert.equal(cached.status, 304);
    assert.equal(cached.body, null);
  } finally { server.close(); }
});

for (const mode of ["abort", "cancel"] as const) {
  test(`${mode} closes the upstream video connection`, { timeout: 5000 }, async () => {
    let closed = false;
    const server = await fixture((_req, res) => {
      res.writeHead(200, { "content-type": "video/mp4" });
      const timer = setInterval(() => res.write(Buffer.alloc(1024)), 10);
      res.on("close", () => { clearInterval(timer); closed = true; });
    });
    try {
      const controller = new AbortController();
      const response = await streamResponse(server.url, {}, controller.signal);
      const reader = response.body!.getReader();
      await reader.read();
      if (mode === "abort") {
        controller.abort();
        await assert.rejects(async () => { while (!(await reader.read()).done) {} });
      } else {
        await reader.cancel();
      }
      for (let i = 0; i < 50 && !closed; i++) await delay(20);
      assert.equal(closed, true, "R2 connection must close when viewer leaves");
    } finally { server.close(); }
  });
}

test("slow viewers apply backpressure instead of buffering whole videos", { timeout: 5000 }, async () => {
  let sent = 0;
  const total = 256 * 1024 * 1024;
  const server = await fixture((_req, res) => {
    res.writeHead(200, { "content-length": String(total) });
    const chunk = Buffer.alloc(64 * 1024);
    function pump() {
      while (!res.destroyed && sent < total) {
        sent += chunk.length;
        if (!res.write(chunk)) { res.once("drain", pump); return; }
      }
      if (sent === total) res.end();
    }
    pump();
  });
  try {
    const response = await streamResponse(server.url, {});
    await delay(300);
    assert(sent < 32 * 1024 * 1024, `buffered too much: ${sent} bytes`);
    await response.body!.cancel();
  } finally { server.close(); }
});
