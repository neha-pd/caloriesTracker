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
let html = fs.readFileSync(index, "utf8");
html = html.replace(
  "</head>",
  '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#101211"><link rel="apple-touch-icon" href="/icon-192.png"><script src="/pwa-register.js" defer></script></head>',
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
if(e.request.mode==='navigate'){e.respondWith(fetch(e.request,{signal:AbortSignal.timeout(4000)}).catch(()=>caches.match('/index.html')));return;}
if(ASSETS.includes(u.pathname))e.respondWith(caches.match(u.pathname).then(r=>r||fetch(e.request)));});
self.addEventListener('push',e=>{let p={};try{p=e.data.json();}catch{}e.waitUntil(self.registration.showNotification(String(p.title||'Your Fitkin workout').slice(0,80),{body:String(p.body||'A little movement is waiting for you.').slice(0,240),icon:'/icon-192.png',tag:p.tag==='fitkin-rest'?'fitkin-rest':'fitkin-workout',data:{url:'/train'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const c=clients.find(c=>new URL(c.url).origin===self.location.origin);if(c){await c.navigate('/train');return c.focus();}return self.clients.openWindow('/train');}));});`;
fs.writeFileSync(out + "/sw.js", code);
fs.writeFileSync(
  out + "/_redirects",
  "/api/* https://fitlens-api.onrender.com/api/:splat 200\n/* /index.html 200\n",
);
console.log(`PWA ready: ${files.length} offline assets, version ${version}.`);
