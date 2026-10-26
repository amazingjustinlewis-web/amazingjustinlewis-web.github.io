/* 0-Phi accounts + leaderboards (dev). Classic script; loads the Firebase modular SDK from gstatic on demand.
   Degrades to localStorage if Firebase auth/Firestore is unreachable or not enabled yet (entries then show "local").
   Acct.ready -> Promise(state)    Acct.user() -> {uid, anon, name} | null    Acct.signIn() Google popup (redirect fallback)
   Acct.initials() / Acct.setInitials('ABC')    Acct.ver(game) -> Promise('v0.9.44') from ./build.json
   Acct.submit(game, {score, label, name}) -> Promise(entry)    Acct.top(game, {ver}) -> Promise([entries]) top 10
   Acct.watch(isOver, onOver) fires onOver once per false->true edge    Acct.board(game, {mine}) shows the top-10 overlay
   Privacy: public entries carry only the chosen initials / display name. Emails are never stored or shown. */
(function (root) {
  'use strict';
  var CFG = { apiKey: 'AIzaSyAPNpKNKZalEYWSMdao-jMEjgVtkYqsmnU', authDomain: 'zero-to-phi.firebaseapp.com', projectId: 'zero-to-phi',
    storageBucket: 'zero-to-phi.firebasestorage.app', messagingSenderId: '550444003584', appId: '1:550444003584:web:054ad6eb8cbb26315fc3e5' };
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var FOUNDER_CAP = 100, GAMES = ['bubble', 'orbit', 'red-deer-rich'];
  var PROFILE = (document.currentScript && document.currentScript.src || '').replace(/minikit\/ztp-account\.js.*$/, '../../dev-7q3x/profile.html') || '../../../dev-7q3x/profile.html';
  var off = /[?&]acct=0/.test(location.search);
  var S = { fb: null, auth: null, db: null, user: null, online: false, why: '' }, M = {};
  function jget(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function clean(s, n) { return String(s || '').replace(/[^\w .'\u00c0-\u017f\u2013-]/g, '').replace(/\s+/g, ' ').trim().slice(0, n || 16); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function initials() { return jget('ztp:initials', ''); }
  function setInitials(s) { s = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); jset('ztp:initials', s); return s; }
  function timeout(p, ms) { return Promise.race([p, new Promise(function (_, r) { setTimeout(function () { r(new Error('timeout')); }, ms); })]); }

  var ready = off ? Promise.resolve(S) : timeout(Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(function (f) { return import(SDK + f); })), 9000)
    .then(function (mods) {
      M.app = mods[0]; M.auth = mods[1]; M.fs = mods[2];
      S.fb = M.app.initializeApp(CFG); S.auth = M.auth.getAuth(S.fb); S.db = M.fs.getFirestore(S.fb);
      return timeout(new Promise(function (res) { var un = M.auth.onAuthStateChanged(S.auth, function (u) { un(); res(u); }); }), 6000);
    })
    .then(function (u) { if (u) return u; return timeout(M.auth.signInAnonymously(S.auth), 6000).then(function (c) { return c.user; }); })
    .then(function (u) { S.user = u; S.online = true; S.why = ''; return S; })
    .catch(function (e) { S.online = false; S.why = (e && (e.code || e.message)) || 'offline'; console.warn('[ztp-account] local mode:', S.why); return S; })
    .then(function (s) { if (S.auth) M.auth.onAuthStateChanged(S.auth, function (v) { S.user = v; S.online = !!(v && S.db); }); return s; });

  function user() { var u = S.user; if (!u) return null; return { uid: u.uid, anon: u.isAnonymous, name: u.isAnonymous ? '' : clean(jget('ztp:dname', '') || 'Player', 16) }; }
  function signIn() {
    return ready.then(function () {
      if (!S.auth) throw new Error('Sign-in unavailable right now (local mode)');
      var p = new M.auth.GoogleAuthProvider(), cur = S.auth.currentUser;
      var go = cur && cur.isAnonymous ? M.auth.linkWithPopup(cur, p).catch(function (e) { if (e && e.code === 'auth/credential-already-in-use') return M.auth.signInWithPopup(S.auth, p); throw e; }) : M.auth.signInWithPopup(S.auth, p);
      return go.catch(function (e) { if (e && /popup-blocked|operation-not-supported/.test(e.code || '')) return M.auth.signInWithRedirect(S.auth, p); throw e; });
    }).then(function (c) { if (c && c.user) { S.user = c.user; S.online = true; S.why = ''; return c.user.getIdToken(true); } }).then(function () { return user(); });
  }
  function signOut() { return ready.then(function () { if (S.auth) return M.auth.signOut(S.auth); }).then(function () { S.user = null; }); }

  var verCache = {};
  function ver(game, url) { return verCache[game] || (verCache[game] = fetch((url || 'build.json') + '?t=' + Date.now()).then(function (r) { return r.json(); }).then(function (j) { return j.ver; }).catch(function () { return 'v?'; })); }

  // local fallback board (this device only)
  function lkey(g) { return 'ztp:scores:' + g; }
  function localAdd(g, e) { var l = jget(lkey(g), []); l.push(e); l.sort(cmp); jset(lkey(g), l.slice(0, 100)); return e; }
  function cmp(a, b) { return b.score - a.score || (a.t || 0) - (b.t || 0); }
  function submit(game, o) {
    return Promise.all([ready, ver(game, o.buildUrl)]).then(function (r) {
      var e = { name: clean(o.name || initials() || '???', 16) || '???', score: Math.round(Number(o.score) || 0), label: clean(o.label, 24), ver: /^v[0-9.]+$/.test(r[1]) ? r[1] : 'v0', t: Date.now() };
      if (o.shop && o.shop.id) { e.shopId = o.shop.id; e.shopName = o.shop.name; }
      if (!S.online || !S.user) { e.local = true; return localAdd(game, e); }
      var d = { name: e.name, score: e.score, label: e.label, ver: e.ver, uid: S.user.uid, ts: M.fs.serverTimestamp() };
      if (o.shop && o.shop.id) { d.shopId = e.shopId = String(o.shop.id); d.shopName = e.shopName = String(o.shop.name || '').slice(0, 32); }
      return timeout(M.fs.addDoc(M.fs.collection(S.db, 'games', game, 'scores'), d), 8000).then(function (ref) { e.id = ref.id; return e; })
        .catch(function (err) { S.lastError = (err && (err.code || err.message)) || 'error'; console.warn('[ztp-account] score saved locally:', S.lastError); e.local = true; e.err = S.lastError; return localAdd(game, e); });
    });
  }
  function top(game, o) {
    o = o || {}; var n = o.n || 10;
    var loc = jget(lkey(game), []).map(function (e) { e.local = true; return e; });
    var pick = function (l) { if (o.shop) l = l.filter(function (e) { return e.shopId === o.shop; }); if (o.ver) l = l.filter(function (e) { return e.ver === o.ver; }); return l.sort(cmp).slice(0, n); };
    return ready.then(function () {
      if (!S.online) return pick(loc);
      var q = M.fs.query(M.fs.collection(S.db, 'games', game, 'scores'), M.fs.orderBy('score', 'desc'), M.fs.limit(200));
      return timeout(M.fs.getDocs(q), 8000).then(function (snap) { var l = []; snap.forEach(function (d) { var x = d.data(); l.push({ id: d.id, uid: x.uid, name: x.name, score: x.score, label: x.label, ver: x.ver, shopId: x.shopId, shopName: x.shopName, t: x.ts && x.ts.toMillis ? x.ts.toMillis() : 0 }); });
        return pick(l.concat(loc.filter(function (e) { return e.local; }))); }).catch(function () { return pick(loc); });
    });
  }
  function watch(isOver, onOver) { var was = false; setInterval(function () { var v = false; try { v = !!isOver(); } catch (e) {} if (v && !was) { try { onOver(); } catch (e) { console.error(e); } } was = v; }, 700); }

  // ---------- shared top-10 overlay ----------
  var css = '#ztpBoard{position:fixed;left:2vw;top:9vh;z-index:9999;width:min(440px,92vw);background:rgba(10,14,28,.94);color:#fff;font:15px system-ui,sans-serif;border:2px solid #5ef2c8;border-radius:14px;padding:14px 16px;box-shadow:0 8px 40px #000a}' +
    '#ztpBoard h3{margin:0 0 6px;font-size:18px;letter-spacing:.04em}#ztpBoard .row{display:flex;gap:8px;padding:3px 4px;border-radius:6px}#ztpBoard .row.me{background:#5ef2c833}#ztpBoard .rk{width:22px;opacity:.6}#ztpBoard .nm{flex:1;font-weight:600}#ztpBoard .sc{min-width:56px;text-align:right}#ztpBoard .lb{opacity:.65;font-size:12px;min-width:52px;text-align:right}#ztpBoard .vr{font-size:11px;padding:1px 5px;border-radius:8px;background:#ffffff1f;opacity:.85}' +
    '#ztpBoard .bar{display:flex;gap:6px;margin:6px 0 8px;flex-wrap:wrap;align-items:center}#ztpBoard button{background:#ffffff1a;color:#fff;border:1px solid #fff4;border-radius:8px;padding:4px 9px;font:inherit;font-size:13px;cursor:pointer}#ztpBoard button.on{background:#5ef2c8;color:#012}#ztpBoard input{width:4.2em;text-transform:uppercase;font:inherit;padding:3px 6px;border-radius:6px;border:1px solid #fff5;background:#0008;color:#fff}#ztpBoard .ft{font-size:11px;opacity:.55;margin-top:6px}';
  function board(game, o) {
    o = o || {}; var el = document.getElementById('ztpBoard');
    if (!el) { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); el = document.createElement('div'); el.id = 'ztpBoard'; document.body.appendChild(el); }
    var mode = 'all', mine = o.mine || [];
    function draw() {
      ver(game, o.buildUrl).then(function (cv) { return top(game, Object.assign(mode === 'this' ? { ver: cv } : {}, o.shop ? { shop: o.shop } : {})).then(function (l) {
        el.innerHTML = '<h3>' + esc(o.title || 'Top 10') + '</h3><div class="bar"><button data-m="all" class="' + (mode === 'all' ? 'on' : '') + '">All versions</button><button data-m="this" class="' + (mode === 'this' ? 'on' : '') + '">This version (' + esc(cv) + ')</button><span style="flex:1"></span><button data-x>✕</button></div>' +
          (l.length ? l.map(function (e, i) { var me = mine.some(function (m) { return m && ((m.id && m.id === e.id) || (m.t && m.t === e.t && m.name === e.name)); });
            return '<div class="row' + (me ? ' me' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="nm">' + (e.uid ? '<a style="color:inherit;text-decoration:none" target="_blank" href="' + PROFILE + '?u=' + encodeURIComponent(e.uid) + '">' + esc(e.name) + '</a>' : esc(e.name)) + '</span><span class="lb">' + esc(e.label || '') + '</span><span class="sc">' + esc(o.fmt ? o.fmt(e.score) : e.score) + '</span><span class="vr">' + esc(e.ver) + (e.shopName ? ' <b style="color:#ffc83a;font-weight:600">@ ' + esc(e.shopName) + '</b>' : '') + (e.local ? ' · local' : '') + '</span></div>'; }).join('') : '<div style="opacity:.6">No scores yet. Be the first!</div>') +
          '<div style="margin-top:8px;font-size:12px;opacity:.7">Set your name, initials and avatar on your phone (\uD83D\uDC64 button).</div>' +
          '<div class="ft">' + (S.online ? 'Online board' : 'This device only (online board not reachable: ' + esc(S.why) + ')') + (mine.some(function (m) { return m && m.err; }) ? ' · <b style="color:#ffd27a">online save failed: ' + esc(mine.filter(function (m) { return m && m.err; })[0].err) + '</b>' : '') + ' · ' + esc(o.meaning || '') + '</div>';
      }); });
    }
    el.onclick = function (ev) { var b = ev.target.closest('button'); if (!b) return; if (b.hasAttribute('data-x')) { hide(); return; } mode = b.getAttribute('data-m'); draw(); };
    el.oninput = function (ev) { if (ev.target.hasAttribute('data-i')) setInitials(ev.target.value); };
    el.style.display = ''; draw();
    clearTimeout(board._t); if (o.hideAfter) board._t = setTimeout(hide, o.hideAfter);
    return { hide: hide, refresh: draw };
  }
  function hide() { var el = document.getElementById('ztpBoard'); if (el) el.style.display = 'none'; }

  // ---------- profiles ----------
  function profile() {
    return ready.then(function () { if (!S.online || !S.user) return jget('ztp:profile', null);
      return M.fs.getDoc(M.fs.doc(S.db, 'profiles', S.user.uid)).then(function (d) { return d.exists() ? d.data() : null; }).catch(function () { return jget('ztp:profile', null); }); });
  }
  // ---------- shops (cafés / worlds) ----------
  // shops/{id} public doc; shops/{id}/private/join {code} owner-only; shops/{id}/members/{uid} {code,name,ts} (rules check code)
  function needDb() { return ready.then(function () { if (!S.db || !S.user) throw new Error(S.why || 'offline'); return S; }); }
  function getShop(id) { return needDb().then(function () { return M.fs.getDoc(M.fs.doc(S.db, 'shops', id)); }).then(function (d) { return d.exists() ? Object.assign({ id: id }, d.data()) : null; }); }
  function isMember(id) { return needDb().then(function () { return M.fs.getDoc(M.fs.doc(S.db, 'shops', id, 'members', S.user.uid)); }).then(function (d) { return d.exists(); }).catch(function () { return false; }); }
  function joinShop(id, code, name) { return needDb().then(function () { return M.fs.setDoc(M.fs.doc(S.db, 'shops', id, 'members', S.user.uid), { code: String(code), name: clean(name || myName('Bot'), 16) || 'Bot', ts: M.fs.serverTimestamp() }); }); }
  function createShop(id, d, code) { return needDb().then(function () { var b = M.fs.writeBatch(S.db);
    b.set(M.fs.doc(S.db, 'shops', id), { name: clean(d.name, 32), owner: S.user.uid, private: !!d.private, games: d.games || [], pins: d.pins || {}, ts: M.fs.serverTimestamp() });
    b.set(M.fs.doc(S.db, 'shops', id, 'private', 'join'), { code: String(code) });
    b.set(M.fs.doc(S.db, 'shops', id, 'members', S.user.uid), { code: String(code), name: clean(d.ownerName || 'Owner', 16), ts: M.fs.serverTimestamp() }); return b.commit(); }); }
  function today() { return new Date().toISOString().slice(0, 10); }
  // public profile of any player (by uid) + their recent scores across games (no index needed: one equality query per game)
  function publicProfile(uid) {
    return ready.then(function () { if (!S.db) throw new Error(S.why || 'offline');
      return Promise.all([M.fs.getDoc(M.fs.doc(S.db, 'profiles', uid)).then(function (d) { return d.exists() ? d.data() : null; }).catch(function () { return null; })].concat(GAMES.map(function (g) {
        return M.fs.getDocs(M.fs.query(M.fs.collection(S.db, 'games', g, 'scores'), M.fs.where('uid', '==', uid), M.fs.limit(50))).then(function (sn) { var l = []; sn.forEach(function (d) { var x = d.data(); l.push({ game: g, name: x.name, score: x.score, label: x.label, ver: x.ver, t: x.ts && x.ts.toMillis ? x.ts.toMillis() : 0 }); }); return l; }).catch(function () { return []; }); })))
      .then(function (r) { var games = [].concat.apply([], r.slice(1)).sort(function (a, b) { return b.t - a.t; }); return { profile: r[0], scores: games.slice(0, 30) }; }); });
  }
  function saveProfile(p) {
    var d = { name: clean(p.name, 16) || 'Player', initials: setInitials(p.initials), avatar: cleanAv(p.avatar), dials: (p.dials || []).slice(0, 6).map(function (n) { n = Math.round(Number(n) || 0); return Math.max(0, Math.min(99, n)); }) };
    jset('ztp:dname', d.name);
    return ready.then(function () {
      if (!S.online || !S.user) { var lp = Object.assign(jget('ztp:profile', {}) || {}, d); lp.local = true; lp.why = S.why || 'not signed in'; jset('ztp:profile', lp); return lp; }
      return S.user.getIdToken(true).then(function () { var pref = M.fs.doc(S.db, 'profiles', S.user.uid), cref = M.fs.doc(S.db, 'meta', 'founders'), google = !S.user.isAnonymous;
      return M.fs.runTransaction(S.db, function (tx) {
        return tx.get(pref).then(function (ps) {
          if (ps.exists()) { var old = ps.data(), ih = (old.ih || []).slice(), last = ih.length ? ih[ih.length - 1].split('@')[0] : ''; var up = { name: d.name, initials: d.initials, dials: d.dials, avatar: d.avatar };
            if (d.initials && d.initials !== last && ih.length < 200) { ih.push(d.initials + '@' + today()); up.ih = ih; } tx.update(pref, up); return Object.assign(old, up); }
          return tx.get(cref).then(function (cs) {
            var n = cs.exists() ? cs.data().n : 0, f = 0;
            if (google && n < FOUNDER_CAP) { f = n + 1; if (cs.exists()) tx.update(cref, { n: f }); else tx.set(cref, { n: f }); }
            var full = { name: d.name, initials: d.initials, dials: d.dials, avatar: d.avatar, ih: d.initials ? [d.initials + '@' + today()] : [], founder: f, ts: M.fs.serverTimestamp() }; tx.set(pref, full); return full;
          });
        });
      }); }).then(function (r) { r = Object.assign({}, r); delete r.ts; jset('ztp:profile', r); return r; })
        .catch(function (err) { S.lastError = (err && (err.code || err.message)) || 'error'; console.warn('[ztp-account] profile save failed:', S.lastError); throw err; });
    });
  }

  // ---------- avatar ----------
  var AV0 = { shirt: '#3fa7ff', pants: '#2b3550', shoes: '#ffffff', hat: '#ff5d73', hatStyle: 'cap', skin: '#f1c7a1' };
  var HATS = ['none', 'cap', 'beanie'], SKINS = ['#f6d7b8', '#f1c7a1', '#d9a27a', '#b07a52', '#7d5236', '#4f3322'];
  function col(c, d) { c = String(c || '').toLowerCase(); return /^#[0-9a-f]{6}$/.test(c) ? c : d; }
  function cleanAv(a) { a = a || {}; return { shirt: col(a.shirt, AV0.shirt), pants: col(a.pants, AV0.pants), shoes: col(a.shoes, AV0.shoes), hat: col(a.hat, AV0.hat), hatStyle: HATS.indexOf(a.hatStyle) >= 0 ? a.hatStyle : AV0.hatStyle, skin: col(a.skin, AV0.skin) }; }
  function avatar() { var p = jget('ztp:profile', null); return cleanAv(p && p.avatar); }
  // simple chunky proxy character as an SVG string; o.walk = 0..1 stride phase for boards
  function avatarSVG(a, o) { a = cleanAv(a); o = o || {}; var w = o.walk == null ? -1 : o.walk, sw = w < 0 ? 0 : Math.sin(w * Math.PI * 2) * 7, sz = o.size || 120;
    var hat = a.hatStyle === 'cap' ? '<path d="M28 30 Q50 6 72 30 Z" fill="' + a.hat + '"/><rect x="58" y="26" width="24" height="6" rx="3" fill="' + a.hat + '"/>'
      : a.hatStyle === 'beanie' ? '<path d="M29 32 Q50 2 71 32 Z" fill="' + a.hat + '"/><rect x="27" y="28" width="46" height="8" rx="4" fill="' + a.hat + '" opacity=".85"/><circle cx="50" cy="8" r="5" fill="' + a.hat + '"/>' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="' + sz + '" height="' + Math.round(sz * 1.4) + '">' +
      '<ellipse cx="50" cy="134" rx="26" ry="4" fill="#0004"/>' +
      '<g transform="rotate(' + sw + ' 42 92)"><rect x="35" y="88" width="13" height="36" rx="5" fill="' + a.pants + '"/><rect x="31" y="120" width="19" height="9" rx="4" fill="' + a.shoes + '"/></g>' +
      '<g transform="rotate(' + (-sw) + ' 58 92)"><rect x="52" y="88" width="13" height="36" rx="5" fill="' + a.pants + '"/><rect x="51" y="120" width="19" height="9" rx="4" fill="' + a.shoes + '"/></g>' +
      '<g transform="rotate(' + (-sw * 1.3) + ' 30 54)"><rect x="18" y="52" width="12" height="32" rx="6" fill="' + a.shirt + '"/><circle cx="24" cy="86" r="5" fill="' + a.skin + '"/></g>' +
      '<g transform="rotate(' + (sw * 1.3) + ' 70 54)"><rect x="70" y="52" width="12" height="32" rx="6" fill="' + a.shirt + '"/><circle cx="76" cy="86" r="5" fill="' + a.skin + '"/></g>' +
      '<rect x="29" y="48" width="42" height="44" rx="12" fill="' + a.shirt + '"/>' +
      '<circle cx="50" cy="32" r="19" fill="' + a.skin + '"/><circle cx="43" cy="33" r="2.4" fill="#222"/><circle cx="57" cy="33" r="2.4" fill="#222"/><path d="M44 41 Q50 46 56 41" stroke="#222" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      hat + '</svg>'; }

  // ---------- phone-side account chip + panel (pads only; the TV shows boards only) ----------
  function phoneChip(o) {
    o = o || {}; if (document.getElementById('ztpChip')) return;
    var st = document.createElement('style'); st.textContent = '#ztpChip{position:fixed;left:10px;top:' + (o.top || 52) + 'px;z-index:60;background:#0c1226d9;color:#fff;border:1px solid #5ef2c8aa;border-radius:18px;padding:4px 10px 4px 4px;font:600 13px system-ui,sans-serif;display:flex;gap:6px;align-items:center}#ztpChip svg{border-radius:50%;background:#ffffff14}' +
      '#ztpPanel{position:fixed;inset:8vh 5vw auto 5vw;z-index:61;background:#0c1226f5;color:#fff;border:2px solid #5ef2c8;border-radius:16px;padding:16px;font:15px system-ui,sans-serif;display:none}#ztpPanel input{font:inherit;width:100%;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid #fff5;background:#0008;color:#fff;margin:4px 0 10px}#ztpPanel button,#ztpPanel a{display:inline-block;font:inherit;font-weight:700;padding:9px 12px;border-radius:9px;border:0;background:#5ef2c8;color:#012;margin:4px 6px 0 0;text-decoration:none}#ztpPanel .alt{background:#ffffff22;color:#fff}#ztpPanel small{opacity:.65}';
    document.head.appendChild(st);
    var chip = document.createElement('div'); chip.id = 'ztpChip'; document.body.appendChild(chip);
    var pan = document.createElement('div'); pan.id = 'ztpPanel'; document.body.appendChild(pan);
    function paint() { var p = jget('ztp:profile', {}) || {}, u = user(); chip.innerHTML = '<span style="display:inline-block;width:26px;height:26px;overflow:hidden;border-radius:50%">' + avatarSVG(avatar(), { size: 26 }) + '</span>' + esc(initials() || (u && !u.anon ? 'Me' : 'Guest')); }
    function open() { var p = jget('ztp:profile', {}) || {}, u = user();
      pan.innerHTML = '<b>Your player</b> <small>' + (S.online ? (u && !u.anon ? 'signed in with Google' : 'guest (scores still count)') : 'offline: saves on this phone') + '</small><br><br>' +
        'Display name<input id="zpN" maxlength="16" value="' + esc(p.name || localStorage.getItem('ztp-mini-name') || '') + '">Initials<input id="zpI" maxlength="3" style="text-transform:uppercase;width:5em" value="' + esc(initials()) + '">' +
        '<button id="zpS">Save</button>' + (u && !u.anon ? '' : '<button class="alt" id="zpG">Sign in with Google</button>') + '<a class="alt" href="' + (o.profile || '../../../dev-7q3x/profile.html') + '" target="_blank">Avatar + profile</a><button class="alt" id="zpX">Close</button><div id="zpM" style="min-height:1.2em;color:#ffd27a;margin-top:8px"></div><small>Only your name and initials are shown publicly.</small>';
      pan.style.display = 'block';
      pan.querySelector('#zpX').onclick = function () { pan.style.display = 'none'; };
      var g = pan.querySelector('#zpG'); if (g) g.onclick = function () { signIn().then(function () { open(); paint(); }).catch(function (e) { pan.querySelector('#zpM').textContent = 'Sign-in failed: ' + (e.code || e.message); }); };
      pan.querySelector('#zpS').onclick = function () { var n = pan.querySelector('#zpN').value, i = pan.querySelector('#zpI').value; setInitials(i); if (o.onName) o.onName(clean(n, 12));
        saveProfile(Object.assign({}, p, { name: n, initials: i, avatar: p.avatar })).then(function (r) { pan.querySelector('#zpM').textContent = r.local ? 'Saved on this phone (offline: ' + r.why + ')' : 'Saved.'; paint(); })
          .catch(function (e) { pan.querySelector('#zpM').textContent = 'Saved on this phone; online save failed: ' + (e.code || e.message); paint(); }); };
    }
    chip.onclick = open; paint(); ready.then(function () { profile().then(function (p) { if (p) { var q = Object.assign({}, p); delete q.ts; jset('ztp:profile', q); if (p.initials && !initials()) setInitials(p.initials); } paint(); }); });
  }
  // end of game on the phone: enter arcade initials (or sign in) then post. Auto-posts after o.wait s with what's there.
  function endPrompt(o) {
    var el = document.getElementById('ztpEnd'); if (el) el.remove(); el = document.createElement('div'); el.id = 'ztpEnd';
    el.style.cssText = 'position:fixed;left:6vw;right:6vw;top:18vh;z-index:70;background:#0c1226f7;color:#fff;border:2px solid #ffc83a;border-radius:16px;padding:18px;font:16px system-ui,sans-serif;text-align:center';
    var u = user(), n = o.wait || 25, done = false;
    el.innerHTML = '<div style="font-size:22px;font-weight:800">' + esc(o.title || 'You made the board!') + '</div><div style="opacity:.75;margin:4px 0 12px">' + esc(o.sub || '') + '</div>' +
      '<input id="zeI" maxlength="3" placeholder="AAA" value="' + esc(initials()) + '" style="font:800 34px monospace;letter-spacing:.3em;width:5.2em;text-align:center;text-transform:uppercase;padding:6px;border-radius:10px;border:2px solid #fff5;background:#0008;color:#fff">' +
      '<div style="margin-top:12px"><button id="zeP" style="font:700 17px system-ui;padding:10px 18px;border-radius:10px;border:0;background:#ffc83a;color:#211">Post score (<span id="zeN">' + n + '</span>)</button></div>' +
      (u && !u.anon ? '' : '<div style="margin-top:10px"><button id="zeG" style="font:600 14px system-ui;padding:8px 12px;border-radius:9px;border:1px solid #fff5;background:#ffffff1a;color:#fff">Sign in with Google to keep your scores</button></div>') +
      '<div id="zeM" style="font-size:12px;opacity:.7;margin-top:8px">Your initials stay on this score forever, arcade style.</div>';
    document.body.appendChild(el);
    var iv = setInterval(function () { n--; var e = el.querySelector('#zeN'); if (e) e.textContent = n; if (n <= 0) go(); }, 1000);
    function go() { if (done) return; done = true; clearInterval(iv); var v = el.querySelector('#zeI').value; if (v) setInitials(v);
      var pr = jget('ztp:profile', null); if (pr && v && S.online) saveProfile(Object.assign({}, pr, { initials: v })).catch(function () {});
      el.querySelector('#zeM').textContent = 'Posting\u2026'; Promise.resolve(o.post(myName(o.fallback))).then(function (e) { el.querySelector('#zeM').innerHTML = e && e.local ? 'Saved on this phone only (' + esc(e.err || S.why || 'offline') + ')' : 'Posted! ' + (e && e.uid !== undefined ? '' : ''); setTimeout(function () { el.remove(); }, 2500); }); }
    el.querySelector('#zeP').onclick = go;
    el.querySelector('#zeI').oninput = function () { n = Math.max(n, 15); };
    var g = el.querySelector('#zeG'); if (g) g.onclick = function () { n = 99; signIn().then(function () { g.remove(); n = 15; }).catch(function (e) { el.querySelector('#zeM').textContent = 'Sign-in failed: ' + (e.code || e.message); n = 15; }); };
    return { post: go };
  }
  function myName(fallback) { var p = jget('ztp:profile', null); return clean(initials() || (p && p.name) || fallback || '', 16); }

  root.Acct = { ready: ready, state: S, user: user, signIn: signIn, signOut: signOut, initials: initials, setInitials: setInitials, ver: ver,
    submit: submit, top: top, watch: watch, board: board, hide: hide, profile: profile, saveProfile: saveProfile, avatar: avatar, avatarSVG: avatarSVG, cleanAvatar: cleanAv, phoneChip: phoneChip, endPrompt: endPrompt, getShop: getShop, isMember: isMember, joinShop: joinShop, createShop: createShop, myName: myName, publicProfile: publicProfile, today: today, PROFILE: PROFILE, FOUNDER_CAP: FOUNDER_CAP, clean: clean };
})(window);
