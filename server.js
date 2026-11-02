import express from "express";
import { createServer } from "node:http";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { hostname } from "node:os";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import wisp from "wisp-server-node";

const PORT = Number(process.env.PORT || 3000);
const PASSWORD = process.env.ACCESS_PASSWORD;
const SECRET = process.env.SESSION_SECRET;
const COOKIE = "nodebrowser_session";
const SESSION_SECONDS = 12 * 60 * 60;

if (!PASSWORD || PASSWORD.length < 12) {
  throw new Error("Set ACCESS_PASSWORD to a password of at least 12 characters.");
}
if (!SECRET || SECRET.length < 32) {
  throw new Error("Set SESSION_SECRET to a random secret of at least 32 characters.");
}
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "8kb" }));

function sign(value) {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function makeSession() {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    nonce: randomBytes(16).toString("hex")
  })).toString("base64url");
  return payload + "." + sign(payload);
}
function validSession(req) {
  const raw = req.headers.cookie || "";
  const item = raw.split(";").map(v => v.trim()).find(v => v.startsWith(COOKIE + "="));
  if (!item) return false;
  const token = decodeURIComponent(item.slice(COOKIE.length + 1));
  const parts = token.split(".");
  if (parts.length !== 2 || !safeEqual(sign(parts[0]), parts[1])) return false;
  try {
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return Number.isFinite(data.exp) && data.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
function requireAuth(req, res, next) {
  if (!validSession(req)) return res.status(401).json({ error: "Authentication required" });
  next();
}

const attempts = new Map();
function loginLimiter(req, res, next) {
  const ip = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const record = attempts.get(ip) || { count: 0, until: now + 10 * 60 * 1000 };
  if (now > record.until) {
    record.count = 0;
    record.until = now + 10 * 60 * 1000;
  }
  if (record.count >= 8) return res.status(429).json({ error: "Too many attempts. Try again later." });
  record.count++;
  attempts.set(ip, record);
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of attempts) if (record.until < now) attempts.delete(ip);
}, 60_000).unref();

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.post("/api/login", loginLimiter, (req, res) => {
  const supplied = typeof req.body?.password === "string" ? req.body.password : "";
  if (!safeEqual(supplied, PASSWORD)) return res.status(401).json({ error: "Incorrect password" });
  res.setHeader("Set-Cookie", COOKIE + "=" + encodeURIComponent(makeSession()) +
    "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + SESSION_SECONDS);
  res.json({ ok: true });
});
app.post("/api/logout", requireAuth, (_req, res) => {
  res.setHeader("Set-Cookie", COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  res.json({ ok: true });
});
app.get("/api/session", (req, res) => res.json({ authenticated: validSession(req) }));

// Every application and proxy asset is private: this is not an anonymous public proxy.
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (!validSession(req)) {
    if (req.path === "/login" || req.path === "/") return res.sendFile(new URL("./public/login.html", import.meta.url).pathname);
    return res.status(401).send("Authentication required");
  }
  next();
});

app.use(express.static(new URL("./public", import.meta.url).pathname, {
  index: "index.html",
  etag: true,
  maxAge: "1h",
  setHeaders(res) { res.setHeader("X-Content-Type-Options", "nosniff"); }
}));
app.use("/uv/", express.static(uvPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

const server = createServer(app);
server.on("upgrade", (req, socket, head) => {
  if (!validSession(req)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  if (req.url === "/wisp/") {
    wisp.routeRequest(req, socket, head);
    return;
  }
  socket.destroy();
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Node Browser listening on port " + PORT + " (" + hostname() + ")");
});
function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
