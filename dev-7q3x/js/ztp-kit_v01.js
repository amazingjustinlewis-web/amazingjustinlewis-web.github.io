/* Zero to Phi shared studio kit v0.1 (dev). One hub for everything that touches leaderboards.
   Each game keeps its own scoring; it hands the final number + stats to ZTP.submitScore().
   Load:  <script src="../js/ztp-kit_v01.js?b=1"></script>   (pulls in minikit/ztp-account_v01.js for sign-in/profile if not loaded)
   ZTP.ready -> Promise   ZTP.player() -> {uid, anon, name, initials}   ZTP.signIn() Google   ZTP.setInitials('ABC')
   ZTP.mode() -> 'family'|'teen'|'mature'   ZTP.setMode(m)   ZTP.sessionMode([m1,m2..]) -> cleanest   (?mode= / venue cap via ZTP.venue({id,name,cap}))
   ZTP.env -> 'dev'|'live' (any page under /dev-7q3x/ = dev; dev scores go to games/{game}-dev/scores, never the live boards)
   ZTP.submitScore({game, version, score, stats, label, lowerIsBetter}) -> Promise({id, rank, total, board, env, local})
   ZTP.toast(text)  ZTP.breakdown({title, score, stats, rank, total, actions:[[label,fn]]})
   ZTP.counts(game) -> Promise({total, byVer:{v0.1:n}})   ZTP.top(game, {env, n}) -> Promise([entries])
   Firestore rules v03 only allow name/score/label/ver/uid/ts/shopId/shopName on a score, so stats stay on the device (breakdown only) for now. */
(function (root) {
  'use strict';
  var me = document.currentScript && document.currentScript.src || '';
  var BASE = me.replace(/js\/ztp-kit_v\d+\.js.*$/, '');
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var MODES = ['family', 'teen', 'mature'];
  var env = /\/dev-7q3x\//.test(location.pathname) || /[?&]env=dev/.test(location.search) ? 'dev' : 'live';
  function jget(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function q(k) { var m = new RegExp('[?&]' + k + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1]) : ''; }

  function loadAcct() {
    if (root.Acct) return Promise.resolve(root.Acct);
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = BASE + 'minikit/ztp-account_v01.js?b=1'; s.onload = function () { res(root.Acct); }; s.onerror = rej; document.head.appendChild(s); });
  }
  var F = {};
  var ready = loadAcct().then(function (A) { return A.ready; }).then(function (S) {
    if (!S.online) return S;
    return Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-firestore.js')]).then(function (m) { F.fs = m[1]; F.db = m[1].getFirestore(m[0].getApp()); return S; });
  }).catch(function (e) { console.warn('[ztp-kit] offline', e); return {}; });

  // ---------- venue + content mode ----------
  var V = jget('ztp:venue', null);
  if (q('shop')) V = { id: q('shop').toLowerCase(), name: q('shopName') || q('shop'), cap: q('cap') || 'family' };
  function venue(v) { if (v !== undefined) { V = v; jset('ztp:venue', v); } return V; }
  function cleanest(list) { var i = 2; list.forEach(function (m) { var k = MODES.indexOf(m); if (k >= 0 && k < i) i = k; }); return MODES[i]; }
  function mode() { var mine = q('mode') || jget('ztp:mode', 'family'); if (MODES.indexOf(mine) < 0) mine = 'family'; return V && V.cap ? cleanest([mine, V.cap]) : mine; }
  function setMode(m) { if (MODES.indexOf(m) >= 0) jset('ztp:mode', m); return mode(); }
  function sessionMode(list) { return cleanest((list || []).concat([mode()])); }

  function player() { var A = root.Acct, u = A && A.user(); return { uid: u && u.uid, anon: !u || u.anon, name: A ? A.myName('') : '', initials: A ? A.initials() : '' }; }
  function board(game, e) { return game + ((e || env) === 'dev' ? '-dev' : ''); }

  // ---------- submit + rank ----------
  function submitScore(o) {
    var game = o.game, b = board(game);
    return ready.then(function () {
      return root.Acct.submit(b, { score: o.score, label: o.label || '', name: o.name, shop: V && V.id ? V : null, buildUrl: o.buildUrl });
    }).then(function (e) {
      var res = { id: e.id, score: e.score, board: b, env: env, local: !!e.local, ver: e.ver, game: game, version: o.version, stats: o.stats || {}, at: Date.now(), shop: V && V.id };
      jset('ztp:last:' + game, res);
      if (e.local || !F.db) return res;
      var c = F.fs.collection(F.db, 'games', b, 'scores');
      return Promise.all([F.fs.getCountFromServer(F.fs.query(c, F.fs.where('score', o.lowerIsBetter ? '<' : '>', e.score))), F.fs.getCountFromServer(c)])
        .then(function (r) { res.rank = r[0].data().count + 1; res.total = r[1].data().count; return res; }).catch(function (err) { res.rankErr = err.code || err.message; return res; });
    }).then(function (res) { if (o.toast !== false) toast(res.rank ? 'Added to leaderboard \u00b7 #' + res.rank.toLocaleString() + ' of ' + res.total.toLocaleString() + (env === 'dev' ? ' (dev)' : '') : 'Score saved on this device'); return res; });
  }
  function counts(game, e) {
    return ready.then(function () { if (!F.db) return { total: 0, byVer: {} };
      return F.fs.getDocs(F.fs.query(F.fs.collection(F.db, 'games', board(game, e), 'scores'), F.fs.limit(2000))).then(function (sn) {
        var by = {}; sn.forEach(function (d) { var v = d.data().ver || 'v?'; by[v] = (by[v] || 0) + 1; }); return { total: sn.size, byVer: by }; }); });
  }
  function top(game, o) { o = o || {};
    return ready.then(function () { if (!F.db) return [];
      return F.fs.getDocs(F.fs.query(F.fs.collection(F.db, 'games', board(game, o.env), 'scores'), F.fs.orderBy('score', o.lowerIsBetter ? 'asc' : 'desc'), F.fs.limit(o.n || 10)))
        .then(function (sn) { var l = []; sn.forEach(function (d) { var x = d.data(); l.push({ id: d.id, name: x.name, score: x.score, label: x.label, ver: x.ver, uid: x.uid, shop: x.shopName, t: x.ts && x.ts.toMillis ? x.ts.toMillis() : 0 }); }); return l; }); });
  }

  // ---------- UI ----------
  var CSS = '#ztpToast{position:fixed;right:14px;bottom:14px;z-index:10001;background:rgba(10,14,28,.82);color:#e9fff8;font:13px system-ui,sans-serif;padding:7px 12px;border-radius:20px;border:1px solid #5ef2c866;opacity:0;transform:translateY(8px);transition:.35s;pointer-events:none}#ztpToast.on{opacity:1;transform:none}' +
    '#ztpBD{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:#0009;font:15px system-ui,sans-serif}#ztpBD .p{width:min(420px,92vw);max-height:86vh;overflow:auto;background:#0b1122;color:#fff;border:2px solid #f5b82e;border-radius:16px;padding:16px 18px;box-shadow:0 10px 50px #000}' +
    '#ztpBD h2{margin:0 0 4px;font-size:20px}#ztpBD .big{font-size:34px;font-weight:800;color:#f5b82e}#ztpBD .rk{opacity:.8;margin-bottom:8px}#ztpBD table{width:100%;border-collapse:collapse}#ztpBD td{padding:4px 2px;border-bottom:1px solid #ffffff14}#ztpBD td:last-child{text-align:right;font-weight:600}#ztpBD .ft{font-size:11px;opacity:.55;margin-top:8px}#ztpBD button{margin:10px 6px 0 0;background:#5ef2c8;color:#012;border:0;border-radius:9px;padding:8px 13px;font:inherit;font-weight:700;cursor:pointer}#ztpBD button.g{background:#ffffff1f;color:#fff}';
  function css() { if (!document.getElementById('ztpKitCss')) { var s = document.createElement('style'); s.id = 'ztpKitCss'; s.textContent = CSS; document.head.appendChild(s); } }
  var tt;
  function toast(t) { css(); var el = document.getElementById('ztpToast'); if (!el) { el = document.createElement('div'); el.id = 'ztpToast'; document.body.appendChild(el); }
    el.textContent = '\uD83C\uDFC6 ' + t; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { el.classList.remove('on'); }, 3800); }
  function nice(k) { return String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); }
  function breakdown(o) { css(); var el = document.getElementById('ztpBD'); if (el) el.remove(); el = document.createElement('div'); el.id = 'ztpBD';
    var st = o.stats || {}, rows = Object.keys(st).map(function (k) { return '<tr><td>' + esc(nice(k)) + '</td><td>' + esc(st[k]) + '</td></tr>'; }).join('');
    el.innerHTML = '<div class="p"><h2>' + esc(o.title || 'Game over') + '</h2><div class="big">' + esc(o.score != null ? Number(o.score).toLocaleString() : '') + '</div>' +
      '<div class="rk">' + (o.rank ? 'Leaderboard #' + o.rank.toLocaleString() + ' of ' + (o.total || 0).toLocaleString() : (o.pending ? 'Posting score\u2026' : 'Saved on this device')) + (env === 'dev' ? ' \u00b7 dev/test board' : '') + '</div>' +
      (rows ? '<table>' + rows + '</table>' : '') + '<div class="actions"></div><div class="ft">' + esc(player().name || 'Anonymous') + ' \u00b7 ' + esc(mode()) + ' mode' + (V && V.name ? ' \u00b7 @ ' + esc(V.name) : '') + '</div></div>';
    var a = el.querySelector('.actions'); (o.actions || [['Close', null]]).forEach(function (x) { var b = document.createElement('button'); b.textContent = x[0]; b.onclick = function () { el.remove(); if (x[1]) x[1](); }; a.appendChild(b); });
    var hb = document.createElement('button'); hb.className = 'g'; hb.textContent = 'Leaderboards'; hb.onclick = function () { location.href = BASE + 'leaderboards/index_v01.html?b=1&g=' + encodeURIComponent(o.game || ''); }; a.appendChild(hb);
    document.body.appendChild(el); return el; }
  // game over in one call: post, then show the breakdown with the rank
  function finish(o) { var p = breakdown(Object.assign({ pending: true }, o)); return submitScore(Object.assign({ toast: true }, o)).then(function (r) { if (document.body.contains(p)) breakdown(Object.assign({}, o, { rank: r.rank, total: r.total })); return r; }); }

  root.ZTP = { v: 'v0.1', ready: ready, env: env, BASE: BASE, MODES: MODES, player: player, signIn: function () { return loadAcct().then(function (A) { return A.signIn(); }); },
    setInitials: function (s) { return root.Acct && root.Acct.setInitials(s); }, mode: mode, setMode: setMode, sessionMode: sessionMode, venue: venue,
    submitScore: submitScore, finish: finish, counts: counts, top: top, toast: toast, breakdown: breakdown, board: board };
})(window);
