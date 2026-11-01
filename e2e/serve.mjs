// Tiny static server for the Expo web export (`dist-e2e/`), used by the
// Playwright webServer. Resolution order for a request path:
//   1. the exact file            (/_expo/static/js/…, /favicon.ico)
//   2. `<path>.html`             (/settings → settings.html)
//   3. `<path>/index.html`       (/kids → kids/index.html)
//   4. a dynamic route sibling   (/game/memory → game/[id].html)
//   5. SPA fallback              (index.html)
// No dependencies on purpose: Node's http + fs only.
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "dist-e2e");
const port = Number(process.argv[3] ?? process.env.E2E_PORT ?? 8099);

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const isFile = (p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

function dynamicSibling(dir) {
  if (!existsSync(dir)) {
    return null;
  }
  const match = readdirSync(dir).find((f) => /^\[[^\]]+\]\.html$/.test(f));
  return match ? join(dir, match) : null;
}

function resolveFile(urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  const abs = join(root, rel);
  if (abs !== root && !abs.startsWith(root + sep)) {
    return null; // path traversal
  }
  const trimmed = abs.replace(/[/\\]+$/, "");
  const candidates = [
    abs,
    `${trimmed}.html`,
    join(trimmed, "index.html"),
    dynamicSibling(join(trimmed, "..")),
  ];
  return candidates.find((c) => c && isFile(c)) ?? join(root, "index.html");
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const file = resolveFile(url.pathname);
  if (!file) {
    res.writeHead(400).end();
    return;
  }
  res.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
  });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`e2e static server: ${root} on :${port}\n`);
});
