import "dotenv/config";
import http from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "redis";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const CONFIG_FILE = path.resolve(process.env.CONFIG_FILE || path.join(ROOT, "data", "config.json"));
const CONFIG_KEY = "tv-dashboard:config";
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
let redisClient;
let storage;

if (upstashUrl && upstashToken) {
  storage = "Upstash Redis REST";
} else if (process.env.REDIS_URL) {
  storage = "Redis";
  redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.on("error", (error) => console.error("Erro no Redis:", error.message));
  await redisClient.connect();
} else {
  storage = `arquivo local (${CONFIG_FILE})`;
}

async function readConfig() {
  if (upstashUrl && upstashToken) {
    const result = await fetch(upstashUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${upstashToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(["GET", CONFIG_KEY]),
    });
    if (!result.ok) throw new Error(`Upstash respondeu ${result.status}`);
    const { result: value } = await result.json();
    return value ? JSON.parse(value) : null;
  }

  if (redisClient) {
    const value = await redisClient.get(CONFIG_KEY);
    return value ? JSON.parse(value) : null;
  }

  try {
    return JSON.parse(await readFile(CONFIG_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeConfig(data) {
  const value = JSON.stringify(data);
  if (upstashUrl && upstashToken) {
    const result = await fetch(upstashUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${upstashToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(["SET", CONFIG_KEY, value]),
    });
    if (!result.ok) throw new Error(`Upstash respondeu ${result.status}`);
    return;
  }

  if (redisClient) {
    await redisClient.set(CONFIG_KEY, value);
    return;
  }

  await mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  const temporaryFile = `${CONFIG_FILE}.${process.pid}.tmp`;
  await writeFile(temporaryFile, value, "utf8");
  await rename(temporaryFile, CONFIG_FILE);
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

async function readRequestBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw Object.assign(new Error("Corpo muito grande"), { status: 413 });
  }
  return JSON.parse(body);
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/config") {
    if (request.method === "GET") {
      try {
        sendJson(response, 200, await readConfig());
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    if (request.method === "PUT") {
      if (!ADMIN_PASSWORD || request.headers["x-admin-key"] !== ADMIN_PASSWORD) {
        sendJson(response, 401, { error: "Senha inválida" });
        return;
      }

      try {
        const body = await readRequestBody(request);
        if (!body || !Array.isArray(body.rooms)) {
          sendJson(response, 400, { error: "Formato inválido" });
          return;
        }
        const data = { rooms: body.rooms, updatedAt: Date.now() };
        await writeConfig(data);
        sendJson(response, 200, { ok: true, updatedAt: data.updatedAt });
      } catch (error) {
        sendJson(response, error.status || 500, { error: error.message });
      }
      return;
    }

    response.writeHead(405, { Allow: "GET, PUT", "Cache-Control": "no-store" });
    response.end();
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(DIST, `.${requestedPath}`);
  if (!filePath.startsWith(`${DIST}${path.sep}`) && filePath !== path.join(DIST, "index.html")) {
    response.writeHead(403);
    response.end();
    return;
  }

  try {
    const stat = await import("node:fs/promises").then(({ stat }) => stat(filePath));
    if (!stat.isFile()) throw new Error("Não é arquivo");
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Content-Length": stat.size,
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    if (path.extname(requestedPath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    createReadStream(path.join(DIST, "index.html")).pipe(response);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Dashboard TV em http://localhost:${PORT}`);
  console.log(`Configuração salva em: ${storage}`);
});
