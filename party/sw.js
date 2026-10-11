// Offline safety net for the party arcade: page + card images served from cache if wifi blips.
var C='party-arcade-v1',PRE=['./','index.html','../assets/img/red-deer-rich/cover-card.webp','../assets/img/zombie-tiles/cover-card.webp','../assets/img/walker/cover-card.webp','../assets/img/laser-range/cover-card.webp','../assets/img/charge-hop/cover-card.webp','../cafe/shots/06-screen-c4-midgame.png','../assets/img/space/cover-card.webp'];
self.addEventListener('install',function(e){self.skipWaiting();e.waitUntil(caches.open(C).then(function(c){return Promise.all(PRE.map(function(u){return c.add(u).catch(function(){})}))}))});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',function(e){var u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 var mine=PRE.some(function(p){return new URL(p,location).pathname===u.pathname});if(!mine&&e.request.mode!=='navigate')return;
 e.respondWith(fetch(e.request).then(function(r){if(r.ok&&mine){var cp=r.clone();caches.open(C).then(function(c){c.put(e.request,cp)})}return r}).catch(function(){return caches.match(e.request,{ignoreSearch:true}).then(function(m){return m||Response.error()})}))});
