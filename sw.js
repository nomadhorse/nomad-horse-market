const CACHE='nh-market-v20';
const CORE=['./','./index.html','./styles.css?v=20','./app.js?v=20','./manifest.json?v=20','./icon-192.png?v=20','./icon-512.png?v=20','./icon-maskable-512.png?v=20','./apple-touch-icon.png?v=20'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy)).catch(()=>{});return response;}).catch(()=>caches.match('./index.html')));
    return;
  }
  if(['script','style','manifest','image'].includes(event.request.destination)){
    event.respondWith(caches.match(event.request).then(cached=>{
      const network=fetch(event.request).then(response=>{if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});}return response;}).catch(()=>cached);
      return cached||network;
    }));
  }
});