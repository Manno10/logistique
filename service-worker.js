const CACHE='elms-offline-v2-convois';
const FILES=[
  './',
  './index.html?v=1.1',
  './styles.css?v=1.1',
  './app.js?v=1.1',
  './manifest.json?v=1.1',
  './icon.svg?v=1.1',
  './centres.json?v=2026.1',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(async cache=>{
      for(const file of FILES){
        try{
          await cache.add(file);
        }catch(error){
          console.warn('Échec du cache :',file,error);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(
        keys
          .filter(key=>key!==CACHE)
          .map(key=>caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>{
          cache.put(event.request,copy).catch(()=>{});
        });
        return response;
      })
      .catch(()=>caches.match(event.request))
  );
});
