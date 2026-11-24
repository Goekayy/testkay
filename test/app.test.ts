import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp, parseCodes } from "../server.ts";
import { validate, buildUserMessage, InputError, type MessagesClient } from "../reply.ts";

const valid = {
  review: "Super Kaffee, aber lange gewartet.",
  rating: 4,
  businessName: "Café Sonne",
  businessType: "Café",
  tone: "freundlich",
};

function fakeClient(response: object, seen: unknown[] = []): MessagesClient {
  return {
    beta: { messages: { create: async (params: unknown) => { seen.push(params); return response; } } },
  } as unknown as MessagesClient;
}

const ok = {
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify({ replies: ["A", "B", "C"] }) }],
};

async function call(client: MessagesClient, codes: Set<string>, body: object, headers = {}) {
  const server = createApp(client, codes).listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/reply`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

test("validate rejects bad rating and missing fields", () => {
  assert.throws(() => validate({ ...valid, rating: 6 }), InputError);
  assert.throws(() => validate({ ...valid, review: "  " }), InputError);
  assert.equal(validate({ ...valid, tone: "evil" }).tone, "freundlich");
});

test("review text is wrapped as data, not instructions", () => {
  const msg = buildUserMessage(validate(valid));
  assert.match(msg, /<bewertung>\nSuper Kaffee, aber lange gewartet.\n<\/bewertung>/);
});

test("returns three replies and sends structured-output request", async () => {
  const seen: any[] = [];
  const r = await call(fakeClient(ok, seen), new Set(), valid);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.replies, ["A", "B", "C"]);
  assert.equal(seen[0].output_config.format.type, "json_schema");
  assert.equal(seen[0].fallbacks, "default");
});

test("access code is enforced when configured", async () => {
  const codes = parseCodes("abc, def");
  assert.equal((await call(fakeClient(ok), codes, valid)).status, 401);
  assert.equal((await call(fakeClient(ok), codes, valid, { "x-access-code": "def" })).status, 200);
});

test("refusal becomes a friendly 400", async () => {
  const r = await call(fakeClient({ stop_reason: "refusal", content: [] }), new Set(), valid);
  assert.equal(r.status, 400);
});
