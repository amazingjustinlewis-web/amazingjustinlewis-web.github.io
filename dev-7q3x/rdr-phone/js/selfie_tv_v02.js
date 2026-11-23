/* TV v0.7.9: upgrade session selfies to solo-style bobbleheads.
   Accepts { t:'selfie', data, pts, skin, lid } from the phone controller.
   Heads blink, glance (including faces-react looks at smacks / runners / trades)
   and show smile / frown / shock. Falls back to the v0.7.6 round ball if no pts.
   Does not overwrite selfie_tv_v01.js. */
(function (w) {
  'use strict';
  var SF_PTS = { le: { x: 0.37, y: 0.43 }, re: { x: 0.63, y: 0.43 }, mo: { x: 0.5, y: 0.72 } };
  var anim = {}; /* pid -> blink / glance / expr state */
  var lastT = 0;

  function api() { return w.RDRSelfie; }
  function game() { return w.RDR && RDR.game; }

  function recOf(pid) {
    var S = api(); if (!S) return null;
    var f = S.of && S.of(pid);
    return f && f.ready ? f : null;
  }

  function stateOf(pid) {
    var rec = recOf(pid);
    var st = anim[pid] || (anim[pid] = {
      blink: 0, bAt: -1e9, nb: 0, gx: 0, gy: 0, tgx: 0, tgy: 0, ng: 0,
      expr: null, until: 0, k: 0, wob: 0, kick: 0, kickAt: -1e9
    });
    if (rec) {
      st.img = rec.img;
      st.pts = rec.pts || SF_PTS;
      st.skin = rec.skin || st.skin;
      st.lid = rec.lid || rec.skin || st.lid;
    }
    return st;
  }

  function setPts(pid, pts, skin, lid) {
    var S = api(); if (!S || pid == null) return;
    var rec = (S.faces && S.faces[pid]) || recOf(pid);
    if (!rec) return;
    if (pts && pts.le && pts.re && pts.mo) rec.pts = pts;
    if (skin) rec.skin = skin;
    if (lid) rec.lid = lid;
    if (rec.img && rec.img.complete && rec.pts && !rec.skin) sampleSkin(rec);
    var st = stateOf(pid);
    st.nb = performance.now() + 800;
    st.expr = 'smile'; st.until = performance.now() + 2200; st.kickAt = performance.now(); st.kick = 0.32;
  }

  function sampleSkin(rec) {
    try {
      var im = rec.img, P = rec.pts || SF_PTS;
      var cv2 = document.createElement('canvas'); cv2.width = cv2.height = 64;
      var c2 = cv2.getContext('2d'); c2.drawImage(im, 0, 0, 64, 64);
      function px(u, v) {
        var d = c2.getImageData(Math.max(0, Math.min(61, Math.round(u * 64) - 1)), Math.max(0, Math.min(61, Math.round(v * 64) - 1)), 3, 3).data;
        var r = 0, g = 0, b = 0, i;
        for (i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        return [r / 9, g / 9, b / 9];
      }
      function hex(c, m) { return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v * m))).toString(16).padStart(2, '0'); }).join(''); }
      var a = px(P.le.x - 0.02, P.le.y + 0.15), b = px(P.re.x + 0.02, P.re.y + 0.15);
      rec.skin = hex([0, 1, 2].map(function (i) { return (a[i] + b[i]) / 2; }), 1);
      rec.lid = hex([0, 1, 2].map(function (i) { return (a[i] + b[i]) / 2; }), 0.9);
    } catch (e) {}
  }

  function wrapSetFace() {
    var S = api(); if (!S || S._tv079Set) return !!S;
    S._tv079Set = true;
    var orig = S.setFace;
    S.setFace = function (pid, dataUrl, pts, extra) {
      orig.call(S, pid, dataUrl);
      extra = extra || {};
      if (pts || extra.skin || extra.lid) setPts(pid, pts, extra.skin, extra.lid);
      else {
        var rec = S.faces && S.faces[pid];
        if (rec && !rec.pts) rec.pts = SF_PTS;
        if (rec && rec.img) {
          if (rec.img.complete) sampleSkin(rec);
          else rec.img.addEventListener('load', function () { sampleSkin(rec); });
        }
      }
    };
    S.setPts = setPts;
    S.stateOf = stateOf;
    return true;
  }

  function hookNet() {
    var net = w.RDR && RDR.net && RDR.net();
    if (!net || !net.o || hookNet._on) return !!net;
    hookNet._on = true;
    var orig = net.o.onMessage;
    net.o.onMessage = function (conn, m) {
      var r = orig && orig.apply(this, arguments);
      if (m && m.t === 'selfie') {
        var cl = w.RDR && RDR.clients, pid = m.pid;
        if (pid == null && cl) { for (var k in cl) if (cl[k].conn === conn) pid = cl[k].pid; }
        if (m.clear) { delete anim[pid]; }
        else if (m.data) setPts(pid, m.pts, m.skin, m.lid);
      }
      return r;
    };
    return true;
  }

  function expr(pid, kind, ms) {
    if (pid == null || !recOf(pid)) return;
    var st = stateOf(pid), n = performance.now();
    st.expr = kind; st.until = n + (ms || 2000);
    st.kickAt = n; st.kick = kind === 'shock' ? 0.5 : 0.32;
  }

  function onEvent(type, d) {
    if (!d) return;
    if (type === 'buy') expr(d.pid, 'smile', 2400);
    else if (type === 'pay' && typeof d.to === 'number') {
      expr(d.to, 'smile', 2200);
      if (d.amount >= 200) expr(d.from, 'shock', 1900);
      else expr(d.from, 'frown', 2300);
    } else if (type === 'tax') expr(d.pid, 'frown', 2000);
    else if (type === 'caught') { expr(d.pid, 'frown', 2800); expr(d.owner, 'smile', 2200); }
    else if (type === 'roll' && d.dbl) expr(d.pid, 'shock', 1500);
    else if (type === 'auctionWon') expr(d.pid, 'smile', 2000);
    else if (type === 'smack') {
      var hit = d.hit || d.target || d.pid, src = d.from || d.by || d.src;
      if (hit != null) expr(hit, 'shock', 1400);
      if (src != null) expr(src, 'smile', 1200);
    }
  }

  function hookGame() {
    var g = game(); if (!g || g._selfieTv079) return !!g;
    g._selfieTv079 = true;
    if (typeof g.on === 'function') g.on(onEvent);
    return true;
  }

  function hookSmack() {
    var S = w.RDRSmack; if (!S || S._selfieTv079) return !!S;
    S._selfieTv079 = true;
    if (typeof S.on === 'function') S.on(function (d) { onEvent('smack', d); });
    return true;
  }

  function tick(now) {
    var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
    lastT = now;
    var g = game(), S = api();
    var ids = {};
    if (S && S.faces) for (var k in S.faces) ids[k] = 1;
    if (g && g.players) g.players.forEach(function (p) { if (recOf(p.id)) ids[p.id] = 1; });
    var tP = now, W = w.RDRWalkers, gazes = (w.RDRFacesReact && RDRFacesReact.gaze && RDRFacesReact.gaze()) || {};
    Object.keys(ids).forEach(function (pid) {
      if (!recOf(pid)) return;
      var st = stateOf(pid);
      if (tP > st.nb) { st.bAt = tP; st.nb = tP + (Math.random() < 0.18 ? 260 : 2200 + Math.random() * 3200); }
      var bt = tP - st.bAt; st.blink = bt < 190 ? Math.sin(bt / 190 * Math.PI) : 0;
      var gRec = gazes[pid];
      var walking = false, phase = 0, bonk = null;
      if (W && W.visOf && g) {
        var p = g.byId ? g.byId(+pid === +pid ? +pid : pid) : (g.players || []).filter(function (q) { return String(q.id) === String(pid); })[0];
        var v = p && W.visOf(p);
        if (v) {
          walking = v.phase != null && v.phase >= 0 && (v.speed || v.moving || v.busy);
          /* Walkers mark motion via phase increment; treat a moving vis as walking. */
          if (v.moving || v.busy || (v.lift && v.lift > 2) || (v.scale == null && v.phase > 0 && v.tMove)) walking = true;
          if (typeof v.phase === 'number' && v.phase >= 0 && (v.from != null || v.dest != null || v.steps)) walking = true;
          phase = v.phase || 0;
          bonk = v.bonk;
        }
      }
      if (gRec && (gRec.why && gRec.why !== 'idle') && tP < (gRec.until || 0)) {
        st.tgx = gRec.x; st.tgy = gRec.y; st.ng = gRec.until;
      } else if (walking) {
        st.tgx = 0.8; st.tgy = 0;
      } else if (tP > st.ng) {
        var fwd = Math.random() < 0.4;
        st.tgx = fwd ? 0 : Math.random() * 2 - 1;
        st.tgy = fwd ? 0 : Math.random() * 1.2 - 0.6;
        st.ng = tP + 700 + Math.random() * 2000;
      } else if (gRec) {
        st.tgx = gRec.x; st.tgy = gRec.y;
      }
      var kg = 1 - Math.exp(-dt * 14);
      st.gx += (st.tgx - st.gx) * kg;
      st.gy += (st.tgy - st.gy) * kg;
      var want = tP < st.until ? 1 : 0;
      st.k += (want - st.k) * (1 - Math.exp(-dt * (want ? 12 : 6)));
      if (!want && st.k < 0.02) { st.k = 0; st.expr = null; }
      var kt = (tP - st.kickAt) / 1000;
      st.wob = 0.05 * Math.sin(tP / 430) + (walking ? 0.11 * Math.sin(phase * Math.PI * 4) : 0) + st.kick * Math.sin(kt * 15) * Math.exp(-kt * 3.2);
      if (bonk && bonk.at) st.wob += 0.25 * Math.sin(tP / 60) * Math.max(0, 1 - (tP - bonk.at) / 1500);
    });
    requestAnimationFrame(tick);
  }

  var dbg = { draws: 0, hits: 0, lastPid: null };

  function findPid(x, y, o) {
    var PPL = w.RDRPeople, W = w.RDRWalkers, g = game();
    var pid = (o && o.selfiePid != null) ? o.selfiePid : (PPL && PPL._curPid);
    if (pid == null && W && W._curPid != null) pid = W._curPid;
    if (pid != null) return pid;
    if (!W || !W.visOf || !g || !g.players) return null;
    var best = 1e9, hit = null;
    g.players.forEach(function (p) {
      var v = W.visOf(p); if (!v || v.shown === false) return;
      var dx = Math.abs((v.x || 0) - x), dy = Math.abs((v.y || 0) - y);
      var d = Math.min(dx + dy, dx + Math.abs((v.y || 0) - (y + (v.lift || 0))));
      if (d < best) { best = d; hit = p; }
    });
    return (hit && best < 90) ? hit.id : null;
  }

  function innerDraw() {
    if (w.RDRPeopleV04 && typeof RDRPeopleV04.draw === 'function') return RDRPeopleV04.draw;
    var S = api();
    return (S && S.afterPeopleDraw && S.afterPeopleDraw._orig) || (w.RDRPeople && w.RDRPeople._selfieTv079Orig) || null;
  }

  function hookPeople() {
    var PPL = w.RDRPeople; if (!PPL || PPL._selfieTv079 || typeof PPL.draw !== 'function') return !!PPL;
    PPL._selfieTv079 = true;
    var ballWrap = PPL.draw;
    PPL._selfieTv079Orig = (api() && api().afterPeopleDraw && api().afterPeopleDraw._orig) || ballWrap;
    PPL.draw = function (c, x, y, h, look, o) {
      o = o || {};
      dbg.draws++;
      var pid = findPid(x, y, o);
      var rec = pid != null ? recOf(pid) : null;
      if (rec && rec.img) {
        dbg.hits++; dbg.lastPid = pid;
        var st = stateOf(pid);
        var gazes = (w.RDRFacesReact && RDRFacesReact.gaze && RDRFacesReact.gaze()) || {};
        var gRec = gazes[pid];
        var selfie = {
          img: rec.img,
          pts: rec.pts || SF_PTS,
          skin: rec.skin || st.skin,
          lid: rec.lid || rec.skin || st.lid,
          blink: st.blink, gx: st.gx, gy: st.gy, expr: st.expr, k: st.k, wob: st.wob
        };
        if (gRec) { selfie.gx = gRec.x; selfie.gy = gRec.y; }
        if (gRec && !o.look) o = Object.assign({}, o, { look: { x: gRec.x, y: gRec.y } });
        o = Object.assign({}, o, { selfie: selfie, selfiePid: pid });
        /* Skip the v0.7.6 photo-ball overlay when we can draw a real bobblehead. */
        var inner = innerDraw() || PPL._selfieTv079Orig || ballWrap;
        return inner.call(this, c, x, y, h, look, o);
      }
      return ballWrap.call(this, c, x, y, h, look, o);
    };
    return true;
  }

  function hookWalkers() {
    var W = w.RDRWalkers; if (!W || W._selfieTv079 || typeof W.draw !== 'function') return !!W;
    W._selfieTv079 = true;
    var orig = W.draw.bind(W);
    W.draw = function (rnd, nowWall) {
      var g = game(), PPL = w.RDRPeople;
      if (g && PPL && W.visOf) {
        var prev = PPL.draw;
        PPL.draw = function (c, x, y, h, look, o) {
          var hit = null, best = 1e9;
          (g.players || []).forEach(function (p) {
            var v = W.visOf(p); if (!v || !v.shown) return;
            var d = Math.abs((v.x || 0) - x) + Math.abs((v.y || 0) - y);
            if (d < best) { best = d; hit = p; }
          });
          if (hit) { PPL._curPid = hit.id; W._curPid = hit.id; }
          var r = prev.call(this, c, x, y, h, look, o);
          PPL._curPid = null; W._curPid = null;
          return r;
        };
        var out = orig(rnd, nowWall);
        PPL.draw = prev;
        return out;
      }
      return orig(rnd, nowWall);
    };
    return true;
  }

  function boot() {
    wrapSetFace(); hookNet(); hookGame(); hookSmack(); hookPeople(); hookWalkers();
    if (!boot._tick) { boot._tick = true; requestAnimationFrame(tick); }
  }
  function loop() { boot(); setTimeout(loop, 400); }
  loop();

  w.RDRSelfieV02 = { setPts: setPts, stateOf: stateOf, expr: expr, onEvent: onEvent, boot: boot, dbg: function () { return dbg; } };
})(window);
