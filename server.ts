import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { generateReplies, validate, InputError, type MessagesClient } from "./reply.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

// Zugangscodes für zahlende Kunden. Leer = Tool ist für alle offen (z. B. Demo).
export function parseCodes(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(",").map((c) => c.trim()).filter(Boolean));
}

// Einfaches Limit pro IP, damit niemand dein API-Guthaben leerräumt.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = Number(process.env.MAX_PER_HOUR || 30);
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 20_000) throw new InputError("Anfrage zu groß.");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new InputError("Ungültiges JSON.");
  }
}

export function createApp(client: MessagesClient, codes: Set<string>) {
  return createServer(async (req, res) => {
    try {
      if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
        const html = await readFile(path.join(here, "public", "index.html"));
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(html);
      }
      if (req.method === "GET" && req.url === "/api/config") {
        return send(res, 200, { needsCode: codes.size > 0 });
      }
      if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });

      if (req.method === "POST" && req.url === "/api/reply") {
        if (codes.size > 0 && !codes.has(String(req.headers["x-access-code"] ?? "").trim())) {
          return send(res, 401, { error: "Ungültiger Zugangscode." });
        }
        const ip = req.socket.remoteAddress ?? "unknown";
        if (rateLimited(ip)) {
          return send(res, 429, { error: "Zu viele Anfragen. Bitte später erneut versuchen." });
        }
        const input = validate(await readJson(req));
        const replies = await generateReplies(client, input);
        return send(res, 200, { replies });
      }
      send(res, 404, { error: "Nicht gefunden." });
    } catch (err) {
      if (err instanceof InputError) return send(res, 400, { error: err.message });
      if (err instanceof Anthropic.RateLimitError) {
        return send(res, 503, { error: "Gerade ausgelastet. Bitte gleich nochmal versuchen." });
      }
      if (err instanceof Anthropic.AuthenticationError) {
        console.error("Claude API key fehlt oder ist ungültig.");
        return send(res, 500, { error: "Server ist falsch konfiguriert." });
      }
      if (err instanceof Anthropic.APIError) {
        console.error("Claude API error:", err.status, err.message);
        return send(res, 502, { error: "KI-Dienst nicht erreichbar. Bitte erneut versuchen." });
      }
      console.error(err);
      send(res, 500, { error: "Unerwarteter Fehler." });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const codes = parseCodes(process.env.ACCESS_CODES);
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.warn("WARNUNG: ANTHROPIC_API_KEY ist nicht gesetzt. Anfragen an Claude werden fehlschlagen.");
  }
  createApp(new Anthropic(), codes).listen(port, () => {
    console.log(`AntwortProfi läuft auf http://localhost:${port}`);
    console.log(codes.size ? `${codes.size} Zugangscode(s) aktiv.` : "Kein Zugangscode: Tool ist offen.");
  });
}
