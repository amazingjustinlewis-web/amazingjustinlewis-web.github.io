/* TV v0.7.6: session-only selfie heads, plus profile faces via the RDRProfileLook hook.
   A selfie overrides a profile face for this session. Profile/selfie heads glow in the player colour. */
(function (w) {
  'use strict';
  var faces = {}; /* pid -> { img, url, ready }  session selfies */
  var profiles = {}; /* pid -> { look, face } */
  var MAX = 96;

  function setFace(pid, dataUrl) {
    if (!dataUrl || dataUrl.indexOf('data:image') !== 0) { clear(pid); return; }
    if (dataUrl.length > 120000) return; /* refuse oversized payloads */
    var im = new Image();
    var rec = { img: im, url: dataUrl, ready: false };
    im.onload = function () { rec.ready = true; };
    im.onerror = function () { rec.ready = false; };
    im.src = dataUrl;
    faces[pid] = rec;
  }
  function clear(pid) { delete faces[pid]; }
  function of(pid) { var f = faces[pid]; return f && f.ready ? f : null; }

  function loadFace(dataUrl) {
    if (!dataUrl || String(dataUrl).indexOf('data:image') !== 0) return null;
    if (dataUrl.length > 120000) return null;
    var im = new Image();
    var rec = { img: im, url: dataUrl, ready: false };
    im.onload = function () { rec.ready = true; };
    im.onerror = function () { rec.ready = false; };
    im.src = dataUrl;
    return rec;
  }

  function setProfile(pid, data) {
    var rec = profiles[pid] || (profiles[pid] = { look: null, face: null });
    if (!data) return rec;
    if (data.look) rec.look = data.look;
    if (data.clearFace) rec.face = null;
    else if (data.face) rec.face = loadFace(data.face) || rec.face;
    return rec;
  }
  function profileOf(pid) { return profiles[pid] || null; }

  /* selfie wins; otherwise a profile face / avatar photo */
  function faceFor(p) {
    if (!p) return null;
    var s = of(p.id); if (s) return { rec: s, kind: 'selfie' };
    var hook = pullHookFace(p); if (hook) return hook;
    var pr = profiles[p.id];
    if (pr && pr.face && pr.face.ready) return { rec: pr.face, kind: 'profile' };
    return null;
  }

  function pullHookFace(p) {
    if (typeof w.RDRProfileLook !== 'function') return null;
    try {
      var L = w._rdrPrevProfileLook ? w._rdrPrevProfileLook(p) : null;
      /* our wrapper is RDRProfileLook — read look.face* if the hook provided one */
      L = L || (profiles[p.id] && profiles[p.id].look) || p.look || p.profileLook;
      if (!L) return null;
      var url = L.face || L.img || L.photo || L.faceUrl || L.pic;
      if (typeof url === 'string' && url.indexOf('data:image') === 0) {
        if (!profiles[p.id] || !profiles[p.id].face || profiles[p.id].face.url !== url) setProfile(p.id, { face: url, look: L });
        var f = profiles[p.id] && profiles[p.id].face;
        if (f && f.ready) return { rec: f, kind: 'profile' };
      }
    } catch (e) {}
    return null;
  }

  function hasCustomLook(p) {
    var pr = profiles[p.id];
    if (pr && pr.look) return true;
    if (p.look || p.profileLook) return true;
    return false;
  }

  function hexRgb(h) {
    h = String(h || '#ffd23f').replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h, 16); if (isNaN(n)) return [242, 194, 48];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function drawGlow(c, x, y, r, col) {
    if (!col) return;
    var rgb = hexRgb(col);
    var grd = c.createRadialGradient(x, y, r * 0.85, x, y, r * 1.55);
    grd.addColorStop(0, 'rgba(' + rgb.join(',') + ',0.55)');
    grd.addColorStop(0.55, 'rgba(' + rgb.join(',') + ',0.22)');
    grd.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
    c.fillStyle = grd; c.beginPath(); c.arc(x, y, r * 1.55, 0, 7); c.fill();
  }

  function drawBall(c, x, y, r, img, glow) {
    c.save();
    if (glow) drawGlow(c, x, y, r, glow);
    c.beginPath(); c.arc(x, y, r, 0, 7); c.closePath(); c.clip();
    var d = r * 2.15;
    c.drawImage(img, x - d / 2, y - d / 2, d, d);
    c.restore();
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, 7);
    c.strokeStyle = glow || 'rgba(255,255,255,0.85)'; c.lineWidth = Math.max(2, r * 0.1); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = Math.max(1.2, r * 0.05); c.stroke();
    c.restore();
  }

  /* head sits near local (50, 32) with feet at (x, y) and height h (see RDRPeople.draw) */
  function headPos(x, y, h, face, bob) {
    var s = h / 132;
    return { x: x, y: y - (129 + (bob || 0) - 32) * s };
  }

  function headWorld(x, y, h, o) {
    o = o || {};
    var bob = (o.walk == null || o.walk < 0) ? 0 : Math.abs(Math.sin(o.walk * Math.PI * 2)) * 3 * (h / 132);
    var hp = headPos(x, y, h, o.face, bob);
    if (o.head) {
      var nx = x, ny = y - h * 0.62;
      var dx = hp.x - nx, dy = hp.y - ny;
      var ca = Math.cos(o.head), sa = Math.sin(o.head);
      hp = { x: nx + dx * ca - dy * sa, y: ny + dx * sa + dy * ca };
    }
    return hp;
  }

  function drawFor(c, p, x, y, h, o) {
    o = o || {};
    var ff = faceFor(p);
    var hp = headWorld(x, y, h, o);
    var r = h * 0.22; /* a big round ball, larger than the drawn head */
    var glow = o.glow || (p && p.color) || null;
    c.save();
    if (o.alpha != null) c.globalAlpha *= o.alpha;
    if (ff) drawBall(c, hp.x, hp.y, r, ff.rec.img, glow);
    else if (glow && hasCustomLook(p)) drawGlow(c, hp.x, hp.y, r * 0.85, glow);
    c.restore();
  }

  function afterPeopleDraw() {
    if (afterPeopleDraw._on || !w.RDRPeople || typeof RDRPeople.draw !== 'function') return;
    afterPeopleDraw._on = true;
    var orig = RDRPeople.draw;
    RDRPeople.draw = function (c, x, y, h, look, o) {
      orig.apply(this, arguments);
      var pid = o && o.selfiePid;
      if (pid != null) drawFor(c, { id: pid }, x, y, h, o);
    };
    afterPeopleDraw._orig = orig;
  }

  /* walkers don't pass selfiePid — wrap their draw loop by tagging look draws from vis */
  function wrapWalkers() {
    var W = w.RDRWalkers; if (!W || W._tv076Selfie || typeof W.draw !== 'function') return !!W;
    W._tv076Selfie = true;
    var orig = W.draw.bind(W);
    W.draw = function (rnd, nowWall) {
      var g = w.RDR && RDR.game, PPL = w.RDRPeople;
      if (PPL && !PPL._tv076SelfieWrap) {
        PPL._tv076SelfieWrap = true;
        var pd = PPL.draw;
        PPL.draw = function (c, x, y, h, look, o) {
          pd.apply(this, arguments);
          if (PPL._curPid != null) drawFor(c, { id: PPL._curPid }, x, y, h, o);
        };
      }
      /* sneak the current pid through a side channel while walkers draw each runner */
      if (g && PPL) {
        var list = g.players || [];
        /* wrap is already in place; set _curPid around each by hooking lookFor? easier: draw after orig by re-walking */
        orig(rnd, nowWall);
        var c = rnd.ctx, h = W.heightOf(rnd), tP = performance.now();
        list.forEach(function (p) {
          if (p.bankrupt || (!faceFor(p) && !hasCustomLook(p))) return;
          var v = W.visOf(p); if (!v.shown || (v.scale != null && v.scale <= 0.02)) return;
          var b = v.bonk, stg = b ? W.staggerOf(b, tP) : 0;
          var ox = b ? b.dir * (h * 0.16) * stg : 0, lift = v.lift || 0;
          var it = (tP - v.impact) / 1000, sq = it < 0.55 ? 1 - v.impactAmp * Math.exp(-it * 9) * Math.cos(it * 30) : lift > 4 ? 1.1 : 1;
          var head = b ? W.springHead(b, tP) * b.dir * (v.face || 1) : 0;
          var sc = (v.scale != null && v.scale !== 1) ? v.scale : 1;
          var hh = h * sc * ((g.cur && g.cur() && g.cur().id === p.id) ? 1.08 : 1);
          drawFor(c, p, v.x + ox, v.y - lift, hh, { walk: v.phase, face: v.face, head: head, squash: sq, alpha: 1, glow: p.color });
        });
        return;
      }
      return orig(rnd, nowWall);
    };
    return true;
  }

  function placeholder(pid, label) {
    var cv = document.createElement('canvas'); cv.width = MAX; cv.height = MAX;
    var c = cv.getContext('2d');
    c.fillStyle = '#f1c7a1'; c.beginPath(); c.arc(48, 48, 46, 0, 7); c.fill();
    c.fillStyle = '#3a2415';
    c.beginPath(); c.arc(34, 42, 6, 0, 7); c.arc(62, 42, 6, 0, 7); c.fill();
    c.strokeStyle = '#3a2415'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.arc(48, 54, 14, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.fillStyle = 'rgba(80,50,30,0.35)'; c.font = '800 16px ui-sans-serif'; c.textAlign = 'center';
    c.fillText((label || 'ME').slice(0, 4), 48, 86);
    setFace(pid, cv.toDataURL('image/jpeg', 0.7));
    return faces[pid];
  }

  function downscale(src, cb) {
    var im = new Image();
    im.onload = function () {
      var cv = document.createElement('canvas'); cv.width = MAX; cv.height = MAX;
      var c = cv.getContext('2d');
      var s = Math.max(MAX / im.width, MAX / im.height), w = im.width * s, h = im.height * s;
      c.beginPath(); c.arc(MAX / 2, MAX / 2, MAX / 2, 0, 7); c.closePath(); c.clip();
      c.drawImage(im, (MAX - w) / 2, (MAX - h) / 2, w, h);
      cb(cv.toDataURL('image/jpeg', 0.7));
    };
    im.onerror = function () { cb(null); };
    im.src = src;
  }

  /* clothing + optional face from a player's 0-Phi profile (RDRProfileLook hook). A later
     user-defined hook still wins for clothing; we wrap it so we can pick up a face field. */
  function installProfileHook() {
    if (installProfileHook._on) return;
    installProfileHook._on = true;
    var prev = w.RDRProfileLook;
    if (prev && !w._rdrPrevProfileLook) w._rdrPrevProfileLook = prev;
    w.RDRProfileLook = function (p) {
      if (w._rdrPrevProfileLook) {
        try { var L = w._rdrPrevProfileLook(p); if (L) return L; } catch (e) {}
      }
      var pr = profiles[p && p.id];
      if (pr && pr.look) return pr.look;
      if (p && p.look) return p.look;
      if (p && p.profileLook) return p.profileLook;
      return null;
    };
  }
  installProfileHook();

  w.RDRSelfie = {
    setFace: setFace, clear: clear, of: of, faces: faces, drawFor: drawFor,
    setProfile: setProfile, profileOf: profileOf, faceFor: faceFor, profiles: profiles,
    wrapWalkers: wrapWalkers, afterPeopleDraw: afterPeopleDraw,
    placeholder: placeholder, downscale: downscale, MAX: MAX
  };
})(window);
