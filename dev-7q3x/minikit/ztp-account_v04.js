/* 0-Phi accounts + leaderboards (dev) v03.
   Founder #: #1 is reserved for Justin (dev claim link). Later Google sign-ups get #2, #3, ... with no cap.
   #1-#100 = gold special badge; #101+ = clean studio badge.
   Google: popup only (linkWithPopup / signInWithPopup), opened synchronously from the user's tap. Never redirect.
   If the popup is blocked, the caller shows "Allow popups for this site, then tap again" plus a retry button.
   If link fails with auth/credential-already-in-use, sign in with that credential (no second popup).
   After a successful Google link, saveProfile claims the next Founder # (or #1 when claimOne is set).
   Classic script; loads the Firebase modular SDK from gstatic on demand.
   Degrades to localStorage if Firebase auth/Firestore is unreachable or not enabled yet (entries then show "local").
   Acct.ready -> Promise(state)    Acct.user() -> {uid, anon, name} | null    Acct.signIn() Google popup only
   Acct.initials() / Acct.setInitials('ABC')    Acct.ver(game) -> Promise('v0.9.44') from ./build.json
   Acct.submit(game, {score, label, name}) -> Promise(entry)    Acct.top(game, {ver}) -> Promise([entries]) top 10
   Acct.watch(isOver, onOver) fires onOver once per false->true edge    Acct.board(game, {mine}) shows the top-10 overlay
   Acct.endPrompt: Exit, Leave arcade initials, or Make a profile. No auto-post.
   Privacy: public entries carry only the chosen initials / display name. Emails are never stored or shown. */
(function (root) {
  'use strict';
  var CFG = { apiKey: 'AIzaSyAPNpKNKZalEYWSMdao-jMEjgVtkYqsmnU', authDomain: 'zero-to-phi.firebaseapp.com', projectId: 'zero-to-phi',
    storageBucket: 'zero-to-phi.firebasestorage.app', messagingSenderId: '550444003584', appId: '1:550444003584:web:054ad6eb8cbb26315fc3e5' };
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var FOUNDER_SPECIAL = 100, FOUNDER_CAP = 0, GAMES = ['bubble', 'orbit', 'red-deer-rich'];  // CAP 0 = unlimited; SPECIAL = gold badge through this #
  var PROFILE = '/account/index_v03.html';
  var off = /[?&]acct=0/.test(location.search);
  var S = { fb: null, auth: null, db: null, user: null, online: false, why: '' }, M = {};
  function jget(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function clean(s, n) { return String(s || '').replace(/[^\w .'\u00c0-\u017f\u2013-]/g, '').replace(/\s+/g, ' ').trim().slice(0, n || 16); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function initials() { return jget('ztp:initials', ''); }
  function setInitials(s) { s = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); jset('ztp:initials', s); return s; }
  function timeout(p, ms) { return Promise.race([p, new Promise(function (_, r) { setTimeout(function () { r(new Error('timeout')); }, ms); })]); }

  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  function claimFlag() { return ssGet('ztp:claimOne') === '1'; }
  function markAfterSignIn() { ssSet('ztp:afterSignIn', '1'); }
  function consumeAfterSignIn() { var v = ssGet('ztp:afterSignIn') === '1'; if (v) ssDel('ztp:afterSignIn'); return v; }

  function finishGoogleProfile() {
    if (!S.user || S.user.isAnonymous) return Promise.resolve(null);
    var local = jget('ztp:profile', {}) || {};
    return saveProfile({ name: local.name || 'Player', initials: initials() || local.initials || '', avatar: local.avatar, dials: local.dials, claimOne: claimFlag() });
  }

  var ready = off ? Promise.resolve(S) : timeout(Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(function (f) { return import(SDK + f); })), 9000)
    .then(function (mods) {
      M.app = mods[0]; M.auth = mods[1]; M.fs = mods[2];
      S.fb = M.app.initializeApp(CFG); S.auth = M.auth.getAuth(S.fb); S.db = M.fs.getFirestore(S.fb);
      return timeout(new Promise(function (res) { var un = M.auth.onAuthStateChanged(S.auth, function (u) { un(); res(u); }); }), 6000);
    })
    .then(function (u) { if (u) return u; return timeout(M.auth.signInAnonymously(S.auth), 6000).then(function (c) { return c.user; }); })
    .then(function (u) { S.user = u; S.online = true; S.why = ''; return S; })
    .catch(function (e) { S.online = false; S.why = (e && (e.code || e.message)) || 'offline'; console.warn('[ztp-account] local mode:', S.why); return S; })
    .then(function (s) {
      if (S.auth) M.auth.onAuthStateChanged(S.auth, function (v) { S.user = v; S.online = !!(v && S.db); });
      if (S.online && S.user && !S.user.isAnonymous && (consumeAfterSignIn() || claimFlag())) {
        return finishGoogleProfile().catch(function () { return null; }).then(function () { return s; });
      }
      return s;
    });

  function user() { var u = S.user; if (!u) return null; return { uid: u.uid, anon: u.isAnonymous, name: u.isAnonymous ? '' : clean(jget('ztp:dname', '') || 'Player', 16) }; }
  function isPopupBlocked(e) {
    var c = String((e && (e.code || e.message)) || '');
    return /popup-blocked|operation-not-supported/.test(c);
  }
  function signInFailText(e) {
    if (!e) return 'Sign-in failed.';
    if (e.code === 'ztp/not-ready') return 'Sign-in is still loading. Tap again in a moment.';
    if (e.code === 'ztp/offline' || /Sign-in unavailable/.test(e.message || '')) return 'Sign-in unavailable right now (local mode).';
    if (isPopupBlocked(e)) return 'Allow popups for this site, then tap again';
    if (/popup-closed|cancelled/.test(e.code || e.message || '')) return 'Sign-in cancelled.';
    return 'Sign-in failed: ' + (e.message || e.code || 'unknown');
  }
  function googleCredFromError(e) {
    try {
      if (M.auth && M.auth.GoogleAuthProvider && M.auth.GoogleAuthProvider.credentialFromError) {
        var c = M.auth.GoogleAuthProvider.credentialFromError(e);
        if (c) return c;
      }
    } catch (x) {}
    return (e && (e.credential || (e.customData && e.customData.credential))) || null;
  }
  // Must be called directly from a user tap, with no await / .then() before the popup opens.
  function signIn() {
    if (!S.auth || !M.auth) {
      var early = new Error((!S.online && S.why) ? 'Sign-in unavailable right now (local mode)' : 'Sign-in is still loading. Tap again in a moment.');
      early.code = (!S.online && S.why) ? 'ztp/offline' : 'ztp/not-ready';
      return Promise.reject(early);
    }
    var p = new M.auth.GoogleAuthProvider(), cur = S.auth.currentUser;
    markAfterSignIn();
    var go = (cur && cur.isAnonymous)
      ? M.auth.linkWithPopup(cur, p).catch(function (e) {
          if (e && e.code === 'auth/credential-already-in-use') {
            var cred = googleCredFromError(e);
            if (cred) return M.auth.signInWithCredential(S.auth, cred);
          }
          throw e;
        })
      : M.auth.signInWithPopup(S.auth, p);
    return go.catch(function (e) {
      if (isPopupBlocked(e)) {
        var blocked = new Error('Allow popups for this site, then tap again');
        blocked.code = 'auth/popup-blocked';
        throw blocked;
      }
      throw e;
    }).then(function (c) {
      if (c && c.user) { S.user = c.user; S.online = true; S.why = ''; return c.user.getIdToken(true); }
    }).then(function () {
      return finishGoogleProfile().catch(function () { return null; });
    }).then(function () { consumeAfterSignIn(); return user(); });
  }
  function claimFounder1(p) {
    p = p || {};
    ssSet('ztp:claimOne', '1');
    if (p.name) jset('ztp:dname', clean(p.name, 16));
    if (p.initials) setInitials(p.initials);
    return signIn().then(function () {
      var local = jget('ztp:profile', {}) || {};
      return saveProfile({
        name: p.name || local.name || 'Justy Wusty',
        initials: p.initials || initials() || local.initials || 'JAL',
        avatar: p.avatar || local.avatar,
        dials: p.dials || local.dials,
        claimOne: true
      });
    }).then(function (r) { ssDel('ztp:claimOne'); return r; }, function (e) { ssDel('ztp:claimOne'); throw e; });
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

  function fmtScore(n) {
    n = Math.round(Number(n) || 0);
    var a = Math.abs(n);
    var s = a.toLocaleString ? a.toLocaleString() : String(a);
    return (n < 0 ? '\u2212$' : '$') + s;
  }
  function hidKey(g) { return 'ztp:scores-hidden:' + g; }
  function isHidden(g, e) {
    var hid = jget(hidKey(g), []) || [];
    return hid.some(function (h) { return (e.id && h.id === e.id) || (h.t && e.t === h.t && e.name === h.name && e.score === h.score); });
  }
  function scores(game, o) {
    o = o || {};
    var loc = jget(lkey(game), []).map(function (e) { e.local = true; return e; });
    var pack = function (d) { var x = d.data(); return { id: d.id, uid: x.uid, name: x.name, score: x.score, label: x.label, ver: x.ver, shopId: x.shopId, shopName: x.shopName, t: x.ts && x.ts.toMillis ? x.ts.toMillis() : 0 }; };
    var pick = function (l) {
      l = l.filter(function (e) { return !isHidden(game, e); });
      if (o.shop) l = l.filter(function (e) { return e.shopId === o.shop; });
      if (o.ver) l = l.filter(function (e) { return e.ver === o.ver; });
      var seen = {}, out = [];
      l.forEach(function (e) {
        var k = e.id ? 'id:' + e.id : ('t:' + e.t + ':' + e.name + ':' + e.score);
        if (seen[k]) return; seen[k] = 1; out.push(e);
      });
      return out;
    };
    return ready.then(function () {
      if (!S.online || !S.db) return pick(loc);
      var col = M.fs.collection(S.db, 'games', game, 'scores');
      var hi = M.fs.query(col, M.fs.orderBy('score', 'desc'), M.fs.limit(200));
      var lo = M.fs.query(col, M.fs.orderBy('score', 'asc'), M.fs.limit(50));
      return Promise.all([
        timeout(M.fs.getDocs(hi), 8000),
        timeout(M.fs.getDocs(lo), 8000).catch(function () { return { forEach: function () {} }; })
      ]).then(function (snaps) {
        var l = [];
        snaps[0].forEach(function (d) { l.push(pack(d)); });
        if (snaps[1] && snaps[1].forEach) snaps[1].forEach(function (d) { l.push(pack(d)); });
        return pick(l.concat(loc.filter(function (e) { return e.local; })));
      }).catch(function () { return pick(loc); });
    });
  }
  function removeScore(game, e) {
    if (!e) return Promise.resolve(false);
    var hid = jget(hidKey(game), []) || [];
    hid.push({ id: e.id || null, t: e.t, name: e.name, score: e.score });
    jset(hidKey(game), hid.slice(-200));
    var loc = jget(lkey(game), []).filter(function (x) {
      return !((e.id && x.id === e.id) || (e.t && x.t === e.t && x.name === e.name && x.score === e.score));
    });
    jset(lkey(game), loc);
    if (e.id && S.online && S.db) {
      return ready.then(function () {
        return timeout(M.fs.deleteDoc(M.fs.doc(S.db, 'games', game, 'scores', e.id)), 8000);
      }).then(function () { return true; }).catch(function (err) {
        S.lastError = (err && (err.code || err.message)) || 'error';
        console.warn('[ztp-account] score removed locally only:', S.lastError);
        return 'local';
      });
    }
    return Promise.resolve(true);
  }
  function toastPosted(game, e, o) {
    o = o || {};
    var el = document.getElementById('ztpToast');
    if (!el) {
      var st = document.createElement('style');
      st.textContent = '#ztpToast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:10050;background:#0c1226f2;color:#fff;border:1.5px solid #5ef2c8;border-radius:14px;padding:10px 14px;font:600 14px system-ui,sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 8px 28px #0008;max-width:92vw}'
        + '#ztpToast button{font:inherit;font-weight:700;border:0;border-radius:9px;padding:6px 10px;background:#ffd27a;color:#211;cursor:pointer}';
      document.head.appendChild(st);
      el = document.createElement('div'); el.id = 'ztpToast'; document.body.appendChild(el);
    }
    var undone = false;
    el.innerHTML = '<span>Posted as ' + esc(e.name || '???') + ' (' + fmtScore(e.score) + ')</span><button type="button" id="ztpUndo">Undo</button>';
    el.style.display = 'flex';
    el.querySelector('#ztpUndo').onclick = function () {
      if (undone) return; undone = true;
      removeScore(game, e).then(function () {
        el.innerHTML = '<span>Removed from the board</span>';
        setTimeout(function () { el.style.display = 'none'; }, 1800);
        if (o.onUndo) try { o.onUndo(e); } catch (err) {}
      });
    };
    clearTimeout(toastPosted._t);
    toastPosted._t = setTimeout(function () { if (!undone) el.style.display = 'none'; }, o.ms || 8000);
    return el;
  }
  function autoPostPref() {
    var p = jget('ztp:profile', {}) || {};
    if (p.autoPost === true || p.autoPost === false) return !!p.autoPost;
    var raw = jget('ztp:autoPost', false);
    return !!raw;
  }
  function setAutoPost(on) {
    on = !!on;
    jset('ztp:autoPost', on);
    var p = Object.assign({}, jget('ztp:profile', {}) || {}, { autoPost: on });
    jset('ztp:profile', p);
    return saveProfile(p).catch(function () { return p; });
  }

  function watch(isOver, onOver) { var was = false; setInterval(function () { var v = false; try { v = !!isOver(); } catch (e) {} if (v && !was) { try { onOver(); } catch (e) { console.error(e); } } was = v; }, 700); }

  // ---------- shared top-10 overlay ----------
  var css = '#ztpBoard{position:fixed;left:2vw;top:9vh;z-index:9999;width:min(440px,92vw);background:rgba(10,14,28,.94);color:#fff;font:15px system-ui,sans-serif;border:2px solid #5ef2c8;border-radius:14px;padding:14px 16px;box-shadow:0 8px 40px #000a;max-height:86vh;overflow:auto}' +
    '#ztpBoard h3{margin:0 0 6px;font-size:18px;letter-spacing:.04em}#ztpBoard .row{display:flex;gap:8px;padding:3px 4px;border-radius:6px}#ztpBoard .row.me{background:#5ef2c833}#ztpBoard .rk{width:22px;opacity:.6}#ztpBoard .nm{flex:1;font-weight:600}#ztpBoard .sc{min-width:56px;text-align:right}#ztpBoard .lb{opacity:.65;font-size:12px;min-width:52px;text-align:right}#ztpBoard .vr{font-size:11px;padding:1px 5px;border-radius:8px;background:#ffffff1f;opacity:.85}' +
    '#ztpBoard .bar{display:flex;gap:6px;margin:6px 0 8px;flex-wrap:wrap;align-items:center}#ztpBoard button{background:#ffffff1a;color:#fff;border:1px solid #fff4;border-radius:8px;padding:4px 9px;font:inherit;font-size:13px;cursor:pointer}#ztpBoard button.on{background:#5ef2c8;color:#012}#ztpBoard input{width:4.2em;text-transform:uppercase;font:inherit;padding:3px 6px;border-radius:6px;border:1px solid #fff5;background:#0008;color:#fff}#ztpBoard .ft{font-size:11px;opacity:.55;margin-top:6px}#ztpBoard .ztpOcean{margin-top:12px;padding:12px 10px 8px;border-radius:14px;background:linear-gradient(180deg,#9ad7ee 0%,#3a8fb0 42%,#16587a 100%);color:#042433;box-shadow:inset 0 8px 0 #c8eef8aa,0 0 0 2px #7ec8e366;position:relative;overflow:hidden}#ztpBoard .ztpOcean::before{content:\'\';display:block;height:10px;margin:-12px -10px 8px;background:radial-gradient(circle at 12px 10px, transparent 7px, #9ad7ee 8px) 0 0/24px 10px}#ztpBoard .ztpOceanLbl{font:800 13px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#042433;margin:0 0 6px;text-shadow:0 1px 0 #fff6}#ztpBoard .ztpOcean .row{background:#ffffff22;color:#042433}#ztpBoard .ztpOcean .row.me{background:#ffd27a99}#ztpBoard .ztpOcean .rk,#ztpBoard .ztpOcean .lb,#ztpBoard .ztpOcean .vr{opacity:.8}#ztpBoard .sc.neg{color:#7b1d2a;font-weight:800}';
  function board(game, o) {
    o = o || {}; var el = document.getElementById('ztpBoard');
    if (!el) { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); el = document.createElement('div'); el.id = 'ztpBoard'; document.body.appendChild(el); }
    var mode = 'all', mine = o.mine || [];
    function draw() {
      ver(game, o.buildUrl).then(function (cv) { return scores(game, Object.assign(mode === 'this' ? { ver: cv } : {}, o.shop ? { shop: o.shop } : {})).then(function (all) {
        var pos = all.filter(function (e) { return e.score >= 0; }).sort(cmp).slice(0, 10);
        var ocean = all.filter(function (e) { return e.score < 0; }).sort(function (a, b) { return a.score - b.score || (a.t || 0) - (b.t || 0); }).slice(0, 10);
        function row(e, i, oceanRow) {
          var me = mine.some(function (m) { return m && ((m.id && m.id === e.id) || (m.t && m.t === e.t && m.name === e.name)); });
          var sc = o.fmt ? o.fmt(e.score) : fmtScore(e.score);
          return '<div class="row' + (me ? ' me' : '') + '"><span class="rk">' + (oceanRow ? '\u301c' : (i + 1)) + '</span><span class="nm">' + (e.uid ? '<a style="color:inherit;text-decoration:none" target="_blank" href="' + PROFILE + '?u=' + encodeURIComponent(e.uid) + '">' + esc(e.name) + '</a>' : esc(e.name)) + '</span><span class="lb">' + esc(e.label || '') + '</span><span class="sc' + (e.score < 0 ? ' neg' : '') + '">' + esc(sc) + '</span><span class="vr">' + esc(e.ver) + (e.shopName ? ' <b style="color:#ffc83a;font-weight:600">@ ' + esc(e.shopName) + '</b>' : '') + (e.local ? ' \u00b7 local' : '') + '</span></div>';
        }
        var listHtml = pos.length ? pos.map(function (e, i) { return row(e, i, false); }).join('') : (ocean.length ? '' : '<div style="opacity:.6">No scores yet. Be the first!</div>');
        var oceanHtml = ocean.length ? '<div class="ztpOcean"><div class="ztpOceanLbl">The ocean</div>' + ocean.map(function (e, i) { return row(e, i, true); }).join('') + '</div>' : '';
        el.innerHTML = '<h3>' + esc(o.title || 'Top 10') + '</h3><div class="bar"><button data-m="all" class="' + (mode === 'all' ? 'on' : '') + '">All versions</button><button data-m="this" class="' + (mode === 'this' ? 'on' : '') + '">This version (' + esc(cv) + ')</button><span style="flex:1"></span><button data-x>\u2715</button></div>' +
          listHtml + oceanHtml +
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
    var d = { name: clean(p.name, 16) || 'Player', initials: setInitials(p.initials), avatar: cleanAv(p.avatar), dials: (p.dials || []).slice(0, 6).map(function (n) { n = Math.round(Number(n) || 0); return Math.max(0, Math.min(99, n)); }), autoPost: !!p.autoPost };
    jset('ztp:autoPost', d.autoPost);
    var claimOne = !!p.claimOne || claimFlag();
    jset('ztp:dname', d.name);
    return ready.then(function () {
      if (!S.online || !S.user) { var lp = Object.assign(jget('ztp:profile', {}) || {}, d); lp.local = true; lp.why = S.why || 'not signed in'; jset('ztp:profile', lp); return lp; }
      return S.user.getIdToken(true).then(function () {
        var pref = M.fs.doc(S.db, 'profiles', S.user.uid), cref = M.fs.doc(S.db, 'meta', 'founders'), google = !S.user.isAnonymous, uid = S.user.uid;
        return M.fs.runTransaction(S.db, function (tx) {
          return tx.get(pref).then(function (ps) {
            return tx.get(cref).then(function (cs) {
              if (ps.exists()) {
                var old = ps.data(), ih = (old.ih || []).slice(), last = ih.length ? ih[ih.length - 1].split('@')[0] : '';
                var up = { name: d.name, initials: d.initials, dials: d.dials, avatar: d.avatar, autoPost: !!d.autoPost };
                if (d.initials && d.initials !== last && ih.length < 200) { ih.push(d.initials + '@' + today()); up.ih = ih; }
                if (claimOne && google && !(old.founder > 0)) {
                  up.founder = 1;
                  if (cs.exists()) { if (!cs.data().one) tx.update(cref, { one: uid }); }
                  else tx.set(cref, { n: 1, one: uid });
                }
                tx.update(pref, up);
                return Object.assign({}, old, up);
              }
              var n = cs.exists() ? (cs.data().n || 0) : 0, one = cs.exists() ? cs.data().one : '', f = 0;
              if (google && claimOne && !one) {
                f = 1;
                if (cs.exists()) tx.update(cref, { one: uid });
                else tx.set(cref, { n: 1, one: uid });
              } else if (google) {
                if (!cs.exists()) { f = 2; tx.set(cref, { n: 2 }); }
                else { f = n + 1; tx.update(cref, { n: f }); }
              }
              var full = { name: d.name, initials: d.initials, dials: d.dials, avatar: d.avatar, autoPost: !!d.autoPost, ih: d.initials ? [d.initials + '@' + today()] : [], founder: f, ts: M.fs.serverTimestamp() };
              tx.set(pref, full);
              return full;
            });
          });
        });
      }).then(function (r) { r = Object.assign({}, r); delete r.ts; jset('ztp:profile', r); return r; })
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


  // ---------- Founder badge: gold special for #1..FOUNDER_SPECIAL, clean studio style after ----------
  function founderBadge(n, o) {
    n = Math.round(Number(n) || 0); if (n < 1) return '';
    ensureFdCss(); o = o || {}; var special = n <= FOUNDER_SPECIAL, sz = o.size || 'md';
    var cls = 'ztpFd' + (special ? ' gold' : ' mid') + (sz === 'sm' ? ' sm' : sz === 'lg' ? ' lg' : '');
    return '<span class="' + cls + '" title="Founder #' + n + (special ? ' (first ' + FOUNDER_SPECIAL + ')' : '') + '">Founder #' + n + '</span>';
  }
  var FD_CSS = '.ztpFd{display:inline-flex;align-items:center;gap:4px;font:700 12px system-ui,sans-serif;letter-spacing:.02em;border-radius:999px;padding:3px 10px;vertical-align:middle;white-space:nowrap}'
    + '.ztpFd.sm{font-size:11px;padding:2px 8px}.ztpFd.lg{font-size:18px;padding:6px 14px}'
    + '.ztpFd.gold{color:#1a1200;background:linear-gradient(180deg,#ffe9a0,#ffc83a);border:2px solid #ffe7a0;box-shadow:0 0 0 1px #a67c00,0 0 12px #ffc83a88,inset 0 1px 0 #fff8}'
    + '.ztpFd.mid{color:#cfe8ff;background:#ffffff14;border:1.5px solid #5ef2c8aa;box-shadow:none}';
  function ensureFdCss() { if (document.getElementById('ztpFdCss')) return; var st = document.createElement('style'); st.id = 'ztpFdCss'; st.textContent = FD_CSS; document.head.appendChild(st); }

  // ---------- phone-side account chip + panel (pads only; the TV shows boards only) ----------
  function phoneChip(o) {
    o = o || {}; if (document.getElementById('ztpChip')) return; ensureFdCss();
    var st = document.createElement('style'); st.textContent = '#ztpChip{position:fixed;left:10px;top:' + (o.top || 52) + 'px;z-index:60;background:#0c1226d9;color:#fff;border:1px solid #5ef2c8aa;border-radius:18px;padding:4px 10px 4px 4px;font:600 13px system-ui,sans-serif;display:flex;gap:6px;align-items:center}#ztpChip svg{border-radius:50%;background:#ffffff14}' +
      '#ztpPanel{position:fixed;inset:8vh 5vw auto 5vw;z-index:61;background:#0c1226f5;color:#fff;border:2px solid #5ef2c8;border-radius:16px;padding:16px;font:15px system-ui,sans-serif;display:none}#ztpPanel input{font:inherit;width:100%;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid #fff5;background:#0008;color:#fff;margin:4px 0 10px}#ztpPanel button,#ztpPanel a{display:inline-block;font:inherit;font-weight:700;padding:9px 12px;border-radius:9px;border:0;background:#5ef2c8;color:#012;margin:4px 6px 0 0;text-decoration:none}#ztpPanel .alt{background:#ffffff22;color:#fff}#ztpPanel small{opacity:.65}';
    document.head.appendChild(st);
    var chip = document.createElement('div'); chip.id = 'ztpChip'; document.body.appendChild(chip);
    var pan = document.createElement('div'); pan.id = 'ztpPanel'; document.body.appendChild(pan);
    function paint() { var p = jget('ztp:profile', {}) || {}, u = user(); chip.innerHTML = '<span style="display:inline-block;width:26px;height:26px;overflow:hidden;border-radius:50%">' + avatarSVG(avatar(), { size: 26 }) + '</span>' + esc(initials() || (u && !u.anon ? 'Me' : 'Guest')) + (p.founder ? ' ' + founderBadge(p.founder, { size: 'sm' }) : ''); }
    function open() { var p = jget('ztp:profile', {}) || {}, u = user();
      pan.innerHTML = '<b>Your player</b> ' + (p.founder ? founderBadge(p.founder, { size: 'sm' }) + ' ' : '') + '<small>' + (S.online ? (u && !u.anon ? 'signed in with Google' : 'guest (scores still count)') : 'offline: saves on this phone') + '</small><br><br>' +
        'Display name<input id="zpN" maxlength="16" value="' + esc(p.name || localStorage.getItem('ztp-mini-name') || '') + '">Initials<input id="zpI" maxlength="3" style="text-transform:uppercase;width:5em" value="' + esc(initials()) + '">' +
        '<label style="display:flex;gap:8px;align-items:center;margin:4px 0 10px;font-weight:600"><input id="zpAP" type="checkbox" ' + (p.autoPost ? 'checked ' : '') + 'style="width:auto;margin:0">Auto-post my scores</label>' +
        '<button id="zpS">Save</button>' + (u && !u.anon ? '' : '<button class="alt" id="zpG">Sign in with Google</button>') + '<a class="alt" href="' + (o.profile || PROFILE) + '" target="_blank">Avatar + profile</a><button class="alt" id="zpX">Close</button><div id="zpM" style="min-height:1.2em;color:#ffd27a;margin-top:8px"></div><small>Only your name and initials are shown publicly. Auto-post is off unless you turn it on.</small>';
      pan.style.display = 'block';
      pan.querySelector('#zpX').onclick = function () { pan.style.display = 'none'; };
      var g = pan.querySelector('#zpG'); if (g) g.onclick = function () {
        var m = pan.querySelector('#zpM'); m.textContent = 'Opening Google\u2026';
        var rtry = pan.querySelector('#zpRetry'); if (rtry) rtry.style.display = 'none';
        signIn().then(function () { open(); paint(); }).catch(function (e) {
          m.textContent = signInFailText(e);
          if (isPopupBlocked(e) || (e && (e.code === 'ztp/not-ready' || e.code === 'ztp/offline'))) {
            var b = pan.querySelector('#zpRetry');
            if (!b) {
              b = document.createElement('button'); b.id = 'zpRetry'; b.className = 'alt'; b.textContent = 'Try sign-in again';
              m.parentNode.insertBefore(b, m); b.onclick = function () { g.click(); };
            }
            b.style.display = '';
          }
        });
      };
      pan.querySelector('#zpS').onclick = function () { var n = pan.querySelector('#zpN').value, i = pan.querySelector('#zpI').value, ap = !!(pan.querySelector('#zpAP') && pan.querySelector('#zpAP').checked); setInitials(i); if (o.onName) o.onName(clean(n, 12));
        saveProfile(Object.assign({}, p, { name: n, initials: i, avatar: p.avatar, autoPost: ap })).then(function (r) { pan.querySelector('#zpM').textContent = r.local ? 'Saved on this phone (offline: ' + r.why + ')' : 'Saved.'; paint(); })
          .catch(function (e) { pan.querySelector('#zpM').textContent = 'Saved on this phone; online save failed: ' + (e.code || e.message); paint(); }); };
    }
    chip.onclick = open; paint(); ready.then(function () { profile().then(function (p) { if (p) { var q = Object.assign({}, p); delete q.ts; jset('ztp:profile', q); if (p.initials && !initials()) setInitials(p.initials); } paint(); }); });
  }
  // end of game on the phone: posting is always optional. Prefill initials when
  // signed in / stored, one-tap Post + Skip. Auto-post is a profile preference (default off).
  function endPrompt(o) {
    var el = document.getElementById('ztpEnd'); if (el) el.remove(); el = document.createElement('div'); el.id = 'ztpEnd';
    el.style.cssText = 'position:fixed;left:6vw;right:6vw;top:16vh;z-index:70;background:#0c1226f7;color:#fff;border:2px solid #ffc83a;border-radius:16px;padding:18px;font:16px system-ui,sans-serif;text-align:center';
    ensureFdCss(); var u = user(), done = false, pr0 = jget('ztp:profile', {}) || {};
    var pre = initials() || pr0.initials || '';
    if (pre && !initials()) setInitials(pre);
    var btn = 'font:700 16px system-ui;padding:10px 16px;border-radius:10px;border:0;cursor:pointer;min-width:12em';
    el.innerHTML = '<div style="font-size:22px;font-weight:800">' + esc(o.title || 'Game over') + '</div>' + (pr0.founder ? '<div id="zeFd" style="margin:6px 0">' + founderBadge(pr0.founder) + '</div>' : '<div id="zeFd" style="margin:6px 0"></div>') + '<div style="opacity:.75;margin:4px 0 12px">' + esc(o.sub || 'Post your score under your initials if you like, or skip. Nothing is posted unless you choose to.') + '</div>' +
      '<input id="zeI" maxlength="3" placeholder="AAA" value="' + esc(pre) + '" style="font:800 34px monospace;letter-spacing:.3em;width:5.2em;text-align:center;text-transform:uppercase;padding:6px;border-radius:10px;border:2px solid #fff5;background:#0008;color:#fff">' +
      '<label style="display:flex;gap:8px;align-items:center;justify-content:center;margin:12px 0 4px;font-size:14px;font-weight:600"><input id="zeAP" type="checkbox" ' + (autoPostPref() ? 'checked ' : '') + 'style="width:auto">Auto-post my scores</label>' +
      '<div style="opacity:.6;font-size:12px;margin-bottom:8px">Off unless you turn it on. When it’s on, later results post under your initials (win, loss, or bust) with a chance to undo.</div>' +
      '<div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;align-items:center">' +
        '<button id="zeP" style="' + btn + ';background:#ffc83a;color:#211">' + (pre ? 'Post' : 'Post arcade initials') + '</button>' +
        (u && !u.anon ? '' : '<button id="zeG" style="' + btn + ';background:#ffffff1a;color:#fff;border:1px solid #fff5">Make a profile</button>') +
        '<button id="zeX" style="' + btn + ';background:#ffffff14;color:#fff;border:1px solid #fff4">Skip</button>' +
      '</div>' +
      '<div id="zeM" style="font-size:12px;opacity:.7;margin-top:10px">Posting is optional. Skip leaves no score on the board.</div>';
    document.body.appendChild(el);
    var ap = el.querySelector('#zeAP');
    if (ap) ap.onchange = function () { setAutoPost(!!ap.checked); };
    function finish() { if (done) return false; done = true; return true; }
    function post() {
      var v = (el.querySelector('#zeI').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
      if (!v) { el.querySelector('#zeM').textContent = 'Add 1–3 initials to post, or Skip.'; return; }
      if (!finish()) return;
      setInitials(v);
      if (ap) setAutoPost(!!ap.checked);
      var pr = jget('ztp:profile', null); if (pr && v && S.online) saveProfile(Object.assign({}, pr, { initials: v, autoPost: autoPostPref() })).catch(function () {});
      el.querySelector('#zeM').textContent = 'Posting…';
      Promise.resolve(o.post ? o.post(myName(o.fallback)) : { skipped: true }).then(function (e) {
        var pr2 = jget('ztp:profile', {}) || {}; var fd = pr2.founder ? ' ' + founderBadge(pr2.founder, { size: 'sm' }) : '';
        el.querySelector('#zeM').innerHTML = (e && e.local ? 'Saved on this phone only (' + esc(e.err || S.why || 'offline') + ')' : (e && e.skipped ? 'Initials saved on this phone.' : 'Posted as ' + esc((e && e.name) || v) + ' (' + fmtScore(e && e.score) + ')')) + fd;
        if (e && !e.skipped && toastPosted) toastPosted(o.game || 'red-deer-rich', e);
        setTimeout(function () { if (el.parentNode) el.remove(); }, 1800);
      });
    }
    function exit() { if (!finish()) return; if (ap) setAutoPost(!!ap.checked); el.remove(); if (o.exit) try { o.exit(); } catch (e) {} }
    el.querySelector('#zeP').onclick = post;
    el.querySelector('#zeX').onclick = exit;
    var g = el.querySelector('#zeG');
    if (g) g.onclick = function () {
      var v = el.querySelector('#zeI').value; if (v) setInitials(v);
      el.querySelector('#zeM').textContent = 'Opening Google…';
      var hideR = el.querySelector('#zeRetry'); if (hideR) hideR.style.display = 'none';
      signIn().then(function () {
        if (g.parentNode) g.remove();
        var r = el.querySelector('#zeRetry'); if (r) r.remove();
        return profile();
      }).then(function (p) {
        var slot = el.querySelector('#zeFd');
        if (p && p.founder && slot) slot.innerHTML = founderBadge(p.founder);
        if (p && p.initials) {
          setInitials(p.initials);
          var inp = el.querySelector('#zeI'); if (inp && !inp.value) inp.value = p.initials;
          var pb = el.querySelector('#zeP'); if (pb) pb.textContent = 'Post';
        }
        el.querySelector('#zeM').textContent = p && p.founder
          ? ('You are Founder #' + p.founder + '. One tap to post, or Skip.')
          : 'Profile ready. One tap to post, or Skip.';
      }).catch(function (e) {
        el.querySelector('#zeM').textContent = signInFailText(e);
        done = false;
        if (isPopupBlocked(e) || (e && (e.code === 'ztp/not-ready' || e.code === 'ztp/offline'))) {
          var row = el.querySelector('#zeRetry');
          if (!row) {
            row = document.createElement('button');
            row.id = 'zeRetry';
            row.textContent = 'Try sign-in again';
            row.style.cssText = btn + ';background:#ffc83a;color:#211;margin-top:8px';
            var m = el.querySelector('#zeM');
            m.parentNode.insertBefore(row, m);
            row.onclick = function () { g.click(); };
          }
          row.style.display = '';
        }
      });
    };
    return { post: post, exit: exit };
  }

  function myName(fallback) { var p = jget('ztp:profile', null); return clean(initials() || (p && p.name) || fallback || '', 16); }

  root.Acct = { ready: ready, state: S, user: user, signIn: signIn, signOut: signOut, initials: initials, setInitials: setInitials, ver: ver,
    submit: submit, top: top, scores: scores, removeScore: removeScore, toastPosted: toastPosted, fmtScore: fmtScore, autoPostPref: autoPostPref, setAutoPost: setAutoPost, watch: watch, board: board, hide: hide, profile: profile, saveProfile: saveProfile, avatar: avatar, avatarSVG: avatarSVG, cleanAvatar: cleanAv, phoneChip: phoneChip, endPrompt: endPrompt, claimFounder1: claimFounder1, getShop: getShop, isMember: isMember, joinShop: joinShop, createShop: createShop, myName: myName, publicProfile: publicProfile, today: today, PROFILE: PROFILE, FOUNDER_CAP: FOUNDER_CAP, FOUNDER_SPECIAL: FOUNDER_SPECIAL, founderBadge: founderBadge, clean: clean, isPopupBlocked: isPopupBlocked, signInFailText: signInFailText };
})(window);
