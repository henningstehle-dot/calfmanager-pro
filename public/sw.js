const CACHE='calfmanager-shell-v3-4-0';
const PRECACHE_ASSETS = [];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['./', './index.html', ...PRECACHE_ASSETS])));
});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('calfmanager-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;if(req.mode==='navigate'){event.respondWith(fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy))}return response}).catch(()=>caches.match('./index.html')));return;}event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{if(response.ok&&new URL(req.url).pathname.includes('/assets/')){const copy=response.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return response}))) });
