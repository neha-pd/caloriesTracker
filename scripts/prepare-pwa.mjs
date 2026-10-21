import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
process.chdir(new URL("..", import.meta.url).pathname);
const out = "mobile/dist";
fs.mkdirSync(out + "/exercises", { recursive: true });
for (const f of fs.readdirSync("mobile/src/features/train/data"))
  fs.copyFileSync(
    "mobile/src/features/train/data/" + f,
    out + "/exercises/" + f,
  );
for (const f of fs.readdirSync("mobile/public"))
  fs.copyFileSync("mobile/public/" + f, out + "/" + f);
const index = out + "/index.html";
let html = fs
  .readFileSync(index, "utf8")
  .replace("shrink-to-fit=no", "shrink-to-fit=no, viewport-fit=cover");
html = html.replace(
  "</head>",
  '<style>html,body{background:#101211}#root{min-height:100dvh}input,textarea{font-size:16px!important}#nl-badge-frame{display:none!important}</style><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#101211"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Fitkin"><link rel="apple-touch-icon" href="/icon-192.png"><script src="/pwa-register.js" defer></script></head>',
);
fs.writeFileSync(index, html);
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) walk(p);
    else if (!p.endsWith(".map") && !p.endsWith("/sw.js"))
      files.push("/" + path.relative(out, p).replaceAll("\\", "/"));
  }
}
walk(out);
const version = crypto
  .createHash("sha256")
  .update(
    files
      .map(
        (f) =>
          f +
          crypto
            .createHash("sha256")
            .update(fs.readFileSync(out + f))
            .digest("hex"),
      )
      .join(""),
  )
  .digest("hex")
  .slice(0, 16);
const code = `const CACHE='fitkin-${version}';const ASSETS=${JSON.stringify(files)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fitkin-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/.netlify/'))return;
if(e.request.mode==='navigate'){e.respondWith(caches.match('/index.html').then(r=>r||fetch(e.request)));return;}
if(ASSETS.includes(u.pathname))e.respondWith(caches.match(u.pathname).then(r=>r||fetch(e.request)));});
`;
fs.writeFileSync(out + "/sw.js", code);
fs.writeFileSync(out + "/_redirects", "/* /index.html 200\n");
console.log(`PWA ready: ${files.length} offline assets, version ${version}.`);

fs.writeFileSync(
  out + "/_headers",
  `/sw.js
  Cache-Control: no-cache
/pwa-register.js
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`,
);
