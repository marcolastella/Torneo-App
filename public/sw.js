const CACHE='torneo-cache-v2'; const ASSETS=['/','/index.html']
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))})
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))})
self.addEventListener('fetch', e=>{ const r=e.request; if(r.method!=='GET') return;
  e.respondWith(caches.match(r).then(c=>c||fetch(r).then(resp=>{const copy=resp.clone(); caches.open(CACHE).then(cc=>cc.put(r,copy)); return resp}).catch(()=>c))) })