/* Zero to Phi open-games list v0.1.
   Hosts call ZTPOpenGames.publish(rec). Join pages call list() / watch() / probe().
   Transport: BroadcastChannel (same browser, including ?local=1 tests), plus Firebase
   Firestore collection `openGames` on project zero-to-phi when the SDK and rules allow.
   If Firebase is blocked or unavailable the list still works locally and the UI stubs cleanly. */
(function (root) {
  'use strict';
  var COL = 'openGames';
  var CH = 'ztp-open-games-v01';
  var FB_CFG = { apiKey: 'AIzaSyAPNpKNKZalEYWSMdao-jMEjgVtkYqsmnU', authDomain: 'zero-to-phi.firebaseapp.com', projectId: 'zero-to-phi',
    storageBucket: 'zero-to-phi.firebasestorage.app', messagingSenderId: '550444003584', appId: '1:550444003584:web:054ad6eb8cbb26315fc3e5' };
  var store = {}, listeners = [], bc = null, fb = { db: null, ok: false, tried: false, why: '' };
  var STALE_MS = 20000;

  function keyOf(r) { return String((r && (r.game || 'game')) + ':' + (r && r.room || '')).toLowerCase(); }
  function fresh(r) { return r && r.at && (Date.now() - r.at) < STALE_MS; }
  function prune() { Object.keys(store).forEach(function (k) { if (!fresh(store[k])) delete store[k]; }); }
  function emit() { prune(); var list = listNow(); listeners.forEach(function (fn) { try { fn(list); } catch (e) {} }); }

  function listNow() {
    prune();
    return Object.keys(store).map(function (k) { return store[k]; })
      .filter(fresh)
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  }

  function put(r, from) {
    if (!r || !r.room) return;
    r = Object.assign({}, r, { at: r.at || Date.now(), src: from || r.src || 'local' });
    store[keyOf(r)] = r;
    emit();
  }
  function drop(r) { delete store[keyOf(typeof r === 'string' ? { game: 'rdr', room: r } : r)]; emit(); }

  try {
    bc = new BroadcastChannel(CH);
    bc.onmessage = function (e) { var m = e.data; if (!m || m.v !== 1) return; if (m.op === 'put') put(m.rec, 'bc'); else if (m.op === 'drop') drop(m.rec); };
  } catch (e) { bc = null; }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error('load fail ' + src)); };
      document.head.appendChild(s);
    });
  }
  function ensureFb() {
    if (fb.tried) return Promise.resolve(fb);
    fb.tried = true;
    if (/[?&]local=1/.test(location.search) || /[?&]nofb=1/.test(location.search)) { fb.why = 'skipped (local or nofb)'; return Promise.resolve(fb); }
    var base = 'https://www.gstatic.com/firebasejs/10.14.1/';
    return loadScript(base + 'firebase-app-compat.js')
      .then(function () { return loadScript(base + 'firebase-firestore-compat.js'); })
      .then(function () {
        if (!root.firebase) throw new Error('firebase global missing');
        var app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(FB_CFG);
        fb.db = firebase.firestore(app);
        fb.ok = true; fb.why = 'ok';
        fb.unsub = fb.db.collection(COL).onSnapshot(function (snap) {
          snap.docChanges().forEach(function (ch) {
            if (ch.type === 'removed') drop(ch.doc.data());
            else put(ch.doc.data(), 'fb');
          });
        }, function (err) { fb.ok = false; fb.why = (err && err.message) || 'listen failed'; });
        return fb;
      })
      .catch(function (err) { fb.ok = false; fb.why = (err && err.message) || 'firebase unavailable'; return fb; });
  }

  function publish(rec) {
    if (!rec || !rec.room) return;
    put(rec, 'self');
    if (bc) try { bc.postMessage({ v: 1, op: 'put', rec: rec }); } catch (e) {}
    ensureFb().then(function () {
      if (!fb.ok || !fb.db) return;
      var id = keyOf(rec).replace(/[^a-z0-9:_-]/g, '_');
      fb.db.collection(COL).doc(id).set(rec, { merge: true }).catch(function (err) {
        fb.ok = false; fb.why = (err && err.message) || 'write denied (rules not deployed?)';
      });
    });
  }
  function unpublish(rec) {
    drop(rec);
    if (bc) try { bc.postMessage({ v: 1, op: 'drop', rec: rec }); } catch (e) {}
    if (fb.ok && fb.db && rec) {
      var id = keyOf(rec).replace(/[^a-z0-9:_-]/g, '_');
      fb.db.collection(COL).doc(id).delete().catch(function () {});
    }
  }

  /* Probe a Red Deer Rich room: connect briefly, send hello, see if a seat is offered. */
  function probeRdr(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var code = String(opts.room || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      if (!code) { resolve({ ok: false, reason: 'no-room' }); return; }
      if (!root.RDRNet) { resolve({ ok: false, reason: 'no-net' }); return; }
      var LOCAL = opts.local || /[?&]local=1/.test(location.search);
      var done = false, client = null, timer;
      function finish(r) {
        if (done) return; done = true; clearTimeout(timer);
        try { if (client && client.destroy) client.destroy(); } catch (e) {}
        resolve(r);
      }
      timer = setTimeout(function () { finish({ ok: false, reason: 'timeout', room: code }); }, opts.ms || 4000);
      var o = {
        code: code,
        onOpen: function () { try { client.send({ t: 'hello', name: opts.name || 'Guest', clientId: 'probe-' + Date.now(), watch: false, probe: 1 }); } catch (e) {} },
        onStatus: function (s) { if (s === 'noroom' || s === 'offline') finish({ ok: false, reason: s, room: code }); },
        onMessage: function (m) {
          if (!m || !m.t) return;
          if (m.t === 'welcome') finish({ ok: true, seat: !m.observer, observer: !!m.observer, room: m.room || code, pid: m.pid });
          else if (m.t === 'reject') finish({ ok: false, reason: m.reason || 'rejected', room: code, full: /full/i.test(m.reason || '') });
        },
        onClose: function () { if (!done) finish({ ok: false, reason: 'closed', room: code }); }
      };
      try { client = LOCAL ? new root.RDRNet.LocalClient(o) : new root.RDRNet.Client(o); }
      catch (e) { finish({ ok: false, reason: (e && e.message) || 'connect-failed', room: code }); }
    });
  }

  root.ZTPOpenGames = {
    publish: publish, unpublish: unpublish, list: listNow,
    watch: function (fn) { listeners.push(fn); fn(listNow()); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; },
    probeRdr: probeRdr, ensureFb: ensureFb,
    firebase: function () { return { ok: fb.ok, why: fb.why }; },
    studioUrl: function () {
      try { return new URL('../../family.html', location.href).href; } catch (e) { return '/family.html'; }
    }
  };
  ensureFb();
  setInterval(prune, 4000);
})(window);
