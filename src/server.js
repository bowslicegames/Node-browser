import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { hostname } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import wisp from "wisp-server-node";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicPath = resolve(__dirname, "../public");
const port = Number.parseInt(process.env.PORT || "8080", 10);
const accessPassword = process.env.ACCESS_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET || accessPassword;
const SESSION_SECONDS = 8 * 60 * 60;

if (!accessPassword || accessPassword.length < 12) {
  console.error("ACCESS_PASSWORD is required and must be at least 12 characters. Set it in Render Environment.");
  process.exit(1);
}
if (!sessionSecret || sessionSecret.length < 32) {
  console.error("SESSION_SECRET must be at least 32 characters (or use a 32+ character ACCESS_PASSWORD).");
  process.exit(1);
}

const app = express();
const server = createServer(app);
const loginAttempts = new Map();

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});
app.use(express.json({ limit: "4kb", type: "application/json" }));

app.get("/healthz", (_req, res) => res.status(200).json({ ok: true, service: "node-browser" }));

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function makeSession() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const signature = createHmac("sha256", sessionSecret).update(String(expires)).digest("hex");
  return `${expires}.${signature}`;
}

function validSession(req) {
  const raw = req.headers.cookie || "";
  const cookie = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith("nb_session="));
  if (!cookie) return false;
  const token = decodeURIComponent(cookie.slice("nb_session=".length));
  const [expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000) || !signature) return false;
  const expected = createHmac("sha256", sessionSecret).update(String(expires)).digest("hex");
  return safeEqual(signature, expected);
}

app.post("/api/login", (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, resetAt: now + 10 * 60 * 1000 };
  if (attempts.resetAt <= now) {
    attempts.count = 0;
    attempts.resetAt = now + 10 * 60 * 1000;
  }
  if (attempts.count >= 8) return res.status(429).json({ error: "Too many attempts. Wait ten minutes and try again." });
  attempts.count += 1;
  loginAttempts.set(ip, attempts);

  if (!safeEqual(req.body?.password || "", accessPassword)) {
    return res.status(401).json({ error: "That password was not correct." });
  }

  loginAttempts.delete(ip);
  res.setHeader("Set-Cookie", `nb_session=${encodeURIComponent(makeSession())}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`);
  return res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", "nb_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  res.json({ ok: true });
});

app.get("/login", (_req, res) => res.sendFile(resolve(publicPath, "login.html")));

app.use((req, res, next) => {
  if (validSession(req)) return next();
  if (req.path === "/" || req.path === "/index.html") return res.sendFile(resolve(publicPath, "login.html"));
  return res.status(401).send("Authentication required. Return to the home page and sign in.");
});

app.use(express.static(publicPath, { extensions: ["html"], index: "index.html", fallthrough: true }));
app.use("/uv/", express.static(uvPath, { fallthrough: false, index: false }));
app.use("/epoxy/", express.static(epoxyPath, { fallthrough: false, index: false }));
app.use("/baremux/", express.static(baremuxPath, { fallthrough: false, index: false }));
app.use((_req, res) => res.status(404).send("Not found"));

server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin;
  let originMatches = false;
  try {
    originMatches = Boolean(origin) && new URL(origin).host === req.headers.host;
  } catch {
    originMatches = false;
  }
  if (req.url !== "/wisp/" || !originMatches || !validSession(req)) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  wisp.routeRequest(req, socket, head);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Node Browser listening on port ${port} (${hostname()})`);
});

function shutdown() {
  console.log("Shutting down HTTP server...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
