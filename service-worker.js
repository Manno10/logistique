const CACHE='elms-offline-v1.2';
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.json','./icon.svg','./centres.json','https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(async c=>{for(const f of FILES){try{await c.add(f)}catch(_){}}}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match('./index.html'))))});
