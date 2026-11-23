/* RED DEER RICH solo v0.8 - little walking people (canvas port of the 0-Phi proxy avatar: shirt, pants, shoes, hat, skin).
   Same chunky design as the profile avatar (minikit/ztp-account.js avatarSVG) and the arcade showcase proxy guys.
   RDRPeople.draw(ctx, x, y, h, look, o): feet at (x, y), h = full height in the current units.
   o.walk = stride phase (0..1 loops, -1 = standing), o.face = 1 right / -1 left, o.glow = ring colour, o.alpha, o.bob.
   v0.2: o.squash (1 = normal, <1 = squashed flat on a hard landing, >1 = stretched mid-hop), o.tilt (radians, whole body leans about the feet),
   o.swing (0..1 progress of a front-arm smack: wind up overhead, whip down, recover), o.head (radians, head wobble about the neck, the doorstop-spring boing).
   v0.7 (solo v0.7): o.look = { x, y } eyes glance (-1..1; y < 0 looks up, the head tips back a touch), o.mood = 'angry' (brows down, frown, red cheeks)
   or 'happy', o.fist = seconds into a fist shake (front arm up, shaking), o.toss = 0..1 progress of an underarm dice toss,
   o.selfie = an image/canvas: the head becomes a big round ball wrapped in that photo (no hat). */
(function (root) {
  'use strict';
  var HATS = ['none', 'cap', 'beanie'];
  // ---- v0.8 bobblehead helpers (all in head-local units, centre 0,0)
  function egg(g, rx, ry) {      // a touch wider at the crown than at the chin
    g.beginPath(); g.moveTo(0, -ry);
    g.bezierCurveTo(rx * 0.62, -ry, rx, -ry * 0.6, rx, -ry * 0.05);
    g.bezierCurveTo(rx, ry * 0.5, rx * 0.56, ry, 0, ry);
    g.bezierCurveTo(-rx * 0.56, ry, -rx, ry * 0.5, -rx, -ry * 0.05);
    g.bezierCurveTo(-rx, -ry * 0.6, -rx * 0.62, -ry, 0, -ry); g.closePath();
  }
  var WA = 1.0;
  function wx(u, rx) { return rx * Math.sin((u - 0.5) * 2 * WA) / Math.sin(WA); }     // squeezes the photo's edges round the sides
  function wrapImg(g, im, rx, ry, dx, dy) {
    var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, N = 14;
    for (var i = 0; i < N; i++) { var u0 = i / N, u1 = (i + 1) / N, x0 = wx(u0, rx), x1 = wx(u1, rx); g.drawImage(im, u0 * iw, 0, iw / N, ih, x0 + dx, -ry + dy, x1 - x0 + 0.5, ry * 2); }
  }
  function fp(pt, rx, ry) { return { x: wx(pt.x, rx), y: -ry + pt.y * ry * 2 }; }
  function faceFx(g, S, rx, ry, im) {
    var L = fp(S.pts.le, rx, ry), R = fp(S.pts.re, rx, ry), M = fp(S.pts.mo, rx, ry), d = Math.max(6, Math.hypot(R.x - L.x, R.y - L.y));
    var er = d * 0.36, eh = er * 0.62, k = S.k || 0, ex = S.expr, skin = S.skin || '#e0b48f', lid = S.lid || skin;
    [L, R].forEach(function (E) {
      // glance: the eye's own pixels slide inside its socket; shock pops them bigger
      var big = ex === 'shock' ? 1 + 0.35 * k : 1;
      g.save(); g.beginPath(); g.ellipse(E.x, E.y, er * big, eh * big, 0, 0, 7); g.clip();
      g.translate(E.x, E.y); g.scale(big, big); g.translate(-E.x + (S.gx || 0) * er * 0.38, -E.y + (S.gy || 0) * eh * 0.3);
      wrapImg(g, im, rx, ry, 0, 0); g.restore();
      if (ex === 'shock' && k > 0.05) { g.strokeStyle = 'rgba(255,255,255,' + (0.8 * k) + ')'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(E.x, E.y, er * big, eh * big, 0, 0, 7); g.stroke(); }
      // blink: a skin eyelid drops over the socket with a lash line
      var b = S.blink || 0;
      if (b > 0.02) {
        g.save(); g.beginPath(); g.ellipse(E.x, E.y, er * 1.12, eh * 1.3, 0, 0, 7); g.clip();
        var yb = E.y - eh * 1.3 + eh * 2.6 * b; g.fillStyle = lid; g.fillRect(E.x - er * 1.3, E.y - eh * 1.4, er * 2.6, yb - (E.y - eh * 1.4));
        g.restore();
        g.strokeStyle = '#2a1a14'; g.lineWidth = Math.max(0.9, er * 0.16); g.lineCap = 'round'; g.beginPath(); g.moveTo(E.x - er, yb - eh * 0.1); g.quadraticCurveTo(E.x, yb + eh * 0.35 * b, E.x + er, yb - eh * 0.1); g.stroke();
      }
      // cartoon brows for the big feelings
      if (k > 0.05 && (ex === 'frown' || ex === 'shock')) {
        var side = E.x < 0 ? -1 : 1; g.strokeStyle = 'rgba(42,26,20,' + k + ')'; g.lineWidth = Math.max(1.2, er * 0.28); g.lineCap = 'round'; g.beginPath();
        if (ex === 'frown') { g.moveTo(E.x - side * er * 0.9, E.y - eh * 1.4); g.lineTo(E.x + side * er * 1.0, E.y - eh * 2.3); }
        else { g.moveTo(E.x - er, E.y - eh * 2.1); g.quadraticCurveTo(E.x, E.y - eh * 3.4, E.x + er, E.y - eh * 2.1); }
        g.stroke();
      }
    });
    if (ex && k > 0.02) {
      var mw = d * 1.0, kk = k;
      // hide the photo's own mouth under a soft patch of skin, then draw the cartoon one
      var cg = g.createRadialGradient(M.x, M.y, 0, M.x, M.y, mw * 0.7); cg.addColorStop(0, hexA(skin, 0.97 * kk)); cg.addColorStop(0.65, hexA(skin, 0.85 * kk)); cg.addColorStop(1, hexA(skin, 0));
      g.fillStyle = cg; g.beginPath(); g.ellipse(M.x, M.y, mw * 0.72, mw * 0.5, 0, 0, 7); g.fill();
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (ex === 'smile') {
        var hw = mw * 0.52, dp = mw * 0.55 * kk;
        g.beginPath(); g.moveTo(M.x - hw, M.y - mw * 0.08); g.quadraticCurveTo(M.x, M.y - mw * 0.02 + dp * 0.25, M.x + hw, M.y - mw * 0.08); g.quadraticCurveTo(M.x, M.y + dp, M.x - hw, M.y - mw * 0.08); g.closePath();
        g.fillStyle = '#4a0f16'; g.fill();
        g.save(); g.clip(); g.fillStyle = '#fff'; g.fillRect(M.x - hw, M.y - mw * 0.2, hw * 2, mw * 0.22 + dp * 0.12); g.fillStyle = '#e8546a'; g.beginPath(); g.ellipse(M.x, M.y + dp * 0.85, hw * 0.45, dp * 0.3, 0, 0, 7); g.fill(); g.restore();
        g.strokeStyle = '#7a1f2a'; g.lineWidth = Math.max(1, mw * 0.07); g.stroke();
        g.fillStyle = 'rgba(255,90,110,' + (0.35 * kk) + ')'; [L, R].forEach(function (E) { g.beginPath(); g.ellipse(E.x + (E.x < 0 ? -er * 0.3 : er * 0.3), E.y + eh * 2.4, er * 0.7, eh * 0.6, 0, 0, 7); g.fill(); });   // rosy cheeks
      } else if (ex === 'frown') {
        g.strokeStyle = '#3a0d12'; g.lineWidth = Math.max(1.3, mw * 0.13); g.beginPath(); g.moveTo(M.x - mw * 0.42, M.y + mw * 0.16); g.quadraticCurveTo(M.x, M.y - mw * 0.32 * kk, M.x + mw * 0.42, M.y + mw * 0.16); g.stroke();
      } else if (ex === 'shock') {
        g.fillStyle = '#3a0d12'; g.beginPath(); g.ellipse(M.x, M.y + mw * 0.05, mw * 0.27, mw * 0.4 * kk + 0.5, 0, 0, 7); g.fill();
        g.fillStyle = '#e8546a'; g.beginPath(); g.ellipse(M.x, M.y + mw * 0.05 + mw * 0.24 * kk, mw * 0.17, mw * 0.11 * kk, 0, 0, 7); g.fill();
        g.strokeStyle = '#7a1f2a'; g.lineWidth = Math.max(1, mw * 0.07); g.beginPath(); g.ellipse(M.x, M.y + mw * 0.05, mw * 0.27, mw * 0.4 * kk + 0.5, 0, 0, 7); g.stroke();
      }
    }
  }
  function hexA(hex, a) { var h = String(hex).replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }

  var SKINS = ['#f6d7b8', '#f1c7a1', '#d9a27a', '#b07a52', '#7d5236', '#4f3322'];
  var SHIRTS = ['#3fa7ff', '#ff5d73', '#ffd23f', '#5ef2c8', '#b06bff', '#ff8a3d', '#2e9e4f', '#f4f0ff', '#1d1d24', '#e889b5'];
  var PANTS = ['#2b3550', '#3a3326', '#223a55', '#5a6b85', '#1d1d24', '#6b4b2b', '#7a8a99', '#2e4d2e'];
  var SHOES = ['#ffffff', '#111111', '#d8262f', '#ffd23f', '#3fa7ff', '#8b5a2b', '#5ef2c8'];
  var AV0 = { shirt: '#3fa7ff', pants: '#2b3550', shoes: '#ffffff', hat: '#ff5d73', hatStyle: 'cap', skin: '#f1c7a1' };
  function col(c, d) { c = String(c || '').toLowerCase(); return /^#[0-9a-f]{6}$/.test(c) ? c : d; }
  function clean(a) { a = a || {}; return { shirt: col(a.shirt, AV0.shirt), pants: col(a.pants, AV0.pants), shoes: col(a.shoes, AV0.shoes), hat: col(a.hat, AV0.hat), hatStyle: HATS.indexOf(a.hatStyle) >= 0 ? a.hatStyle : AV0.hatStyle, skin: col(a.skin, AV0.skin) }; }
  function pick(a, r) { return a[Math.floor(r() * a.length) % a.length]; }
  function random(r, shirt) { r = r || Math.random; return clean({ shirt: shirt || pick(SHIRTS, r), pants: pick(PANTS, r), shoes: pick(SHOES, r), hat: pick(SHIRTS, r), hatStyle: pick(HATS, r), skin: pick(SKINS, r) }); }
  // the player's saved 0-Phi profile avatar (local copy only; no sign-in needed)
  function profile() { try { var p = JSON.parse(localStorage.getItem('ztp:profile') || 'null'); return p && p.avatar ? clean(p.avatar) : null; } catch (e) { return null; } }

  function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); } g.fill(); }
  function limb(g, px, py, ang, fn) { g.save(); g.translate(px, py); g.rotate(ang * Math.PI / 180); g.translate(-px, -py); fn(); g.restore(); }

  // drawn in the avatar's 100 x 140 box, feet line y = 129
  function draw(g, x, y, h, look, o) {
    var a = look && look._c ? look : clean(look); o = o || {};
    var w = o.walk == null ? -1 : o.walk, sw = w < 0 ? 0 : Math.sin(w * Math.PI * 2) * 22, s = h / 132, face = o.face || 1;
    var bob = w < 0 ? 0 : Math.abs(Math.sin(w * Math.PI * 2)) * 3;
    var sq = o.squash || 1, sx = sq === 1 ? 1 : 1 / Math.sqrt(sq);
    g.save(); g.translate(x, y); if (o.tilt) g.rotate(o.tilt * face); g.scale(s * face * sx, s * sq); g.translate(-50, -129 - bob);
    if (o.alpha != null) g.globalAlpha *= o.alpha;
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(50, 129 + bob, 26, 6, 0, 0, Math.PI * 2); g.fill();
    if (o.glow) { g.strokeStyle = o.glow; g.lineWidth = 4; g.beginPath(); g.ellipse(50, 129 + bob, 32, 9, 0, 0, Math.PI * 2); g.stroke(); }
    // legs (back leg darker so the stride reads)
    limb(g, 42, 92, sw, function () { g.fillStyle = a.pants; rr(g, 35, 88, 13, 36, 5); g.fillStyle = a.shoes; rr(g, 33, 120, 19, 9, 4); });
    limb(g, 58, 92, -sw, function () { g.fillStyle = a.pants; rr(g, 52, 88, 13, 36, 5); g.fillStyle = a.shoes; rr(g, 52, 120, 19, 9, 4); });
    // arms swing opposite the legs
    limb(g, 30, 54, -sw * 1.2, function () { g.fillStyle = a.shirt; rr(g, 18, 52, 12, 32, 6); g.fillStyle = a.skin; g.beginPath(); g.arc(24, 86, 5, 0, 7); g.fill(); });
    var arm = sw * 1.2, fistR = 5;
    if (o.swing != null && o.swing >= 0 && o.swing < 1) { var q = o.swing; arm = q < 0.32 ? -175 * (q / 0.32) : q < 0.55 ? -175 + 140 * ((q - 0.32) / 0.23) : -35 * (1 - (q - 0.55) / 0.45); }
    else if (o.toss != null && o.toss >= 0 && o.toss < 1) { var tq = o.toss; arm = tq < 0.35 ? 40 * (tq / 0.35) : tq < 0.6 ? 40 - 170 * ((tq - 0.35) / 0.25) : -130 * (1 - (tq - 0.6) / 0.4); }
    else if (o.fist != null && o.fist >= 0) { arm = -150 + Math.sin(o.fist * 26) * 16; fistR = 7; }
    limb(g, 70, 54, arm, function () { g.fillStyle = a.shirt; rr(g, 70, 52, 12, 32, 6); g.fillStyle = a.skin; g.beginPath(); g.arc(76, 86, fistR, 0, 7); g.fill(); if (fistR > 5) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(72, 85); g.lineTo(80, 85); g.stroke(); } });
    g.fillStyle = a.shirt; rr(g, 29, 48, 42, 44, 12);
    if (o.badge) { g.fillStyle = o.badge; rr(g, 41, 60, 18, 14, 4); }
    if (o.head) { g.save(); g.translate(50, 50); g.rotate(o.head); g.translate(-50, -50); }
    var lk = o.look || null, lx = lk ? Math.max(-1, Math.min(1, lk.x || 0)) : 0, ly = lk ? Math.max(-1, Math.min(1, lk.y || 0)) : 0;
    if (ly < 0) { g.save(); g.translate(50, 50); g.rotate(ly * 0.16); g.translate(-50, -50); }
    if (o.selfie) {
      // v0.8: the selfie BOBBLEHEAD: a big, slightly egg-shaped head with the photo wrapped round the front, wobbling on its spring,
      // with cartoon blinks / glances / mouths at the points the player marked (o.selfie = { img, pts, skin, blink, gx, gy, expr, k, wob })
      var S = o.selfie.img ? o.selfie : { img: o.selfie }, im = S.img, rx = 25, ry = 30;
      g.save(); g.translate(50, 50); g.rotate((S.wob || 0) * face);
      g.strokeStyle = '#8a8a96'; g.lineWidth = 2; g.beginPath(); for (var zz = 0; zz < 4; zz++) { g.moveTo(-3, -1 - zz * 1.6); g.lineTo(3, -1.8 - zz * 1.6); } g.stroke();   // the spring neck
      g.translate(0, -ry + 1); g.scale(face, 1);
      egg(g, rx, ry); g.save(); g.clip();
      g.fillStyle = S.skin || a.skin; g.fillRect(-rx, -ry, rx * 2, ry * 2);
      try { wrapImg(g, im, rx, ry, 0, 0); } catch (e) {}
      if (S.pts) faceFx(g, S, rx, ry, im);
      g.restore();
      var sh = g.createRadialGradient(-rx * 0.35, -ry * 0.4, 3, 0, 0, ry * 1.05); sh.addColorStop(0, 'rgba(255,255,255,.38)'); sh.addColorStop(0.42, 'rgba(255,255,255,0)'); sh.addColorStop(0.8, 'rgba(0,0,0,.08)'); sh.addColorStop(1, 'rgba(0,0,0,.42)');
      g.fillStyle = sh; egg(g, rx, ry); g.fill();
      g.strokeStyle = o.mood === 'angry' ? '#e5262f' : 'rgba(255,255,255,.92)'; g.lineWidth = 2.5; g.stroke();
      if (o.mood === 'angry') { g.strokeStyle = '#e5262f'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(rx * 0.7, -ry * 0.85); g.lineTo(rx * 0.95, -ry * 0.65); g.moveTo(rx * 0.95, -ry * 0.88); g.lineTo(rx * 0.75, -ry * 0.62); g.stroke(); }
      g.restore();
    } else {
    g.fillStyle = a.skin; g.beginPath(); g.arc(50, 32, 19, 0, 7); g.fill();
    var ex = lx * 2.6, ey = ly * 2.2;
    if (o.mood === 'angry') { g.fillStyle = 'rgba(229,38,47,.35)'; g.beginPath(); g.arc(41, 40, 4, 0, 7); g.arc(62, 40, 4, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; if (lk) { g.beginPath(); g.arc(46, 33, 3.6, 0, 7); g.arc(58, 33, 3.6, 0, 7); g.fill(); }
    g.fillStyle = '#222'; g.beginPath(); g.arc(46 + ex, 33 + ey, 2.6, 0, 7); g.arc(58 + ex, 33 + ey, 2.6, 0, 7); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath();
    if (o.mood === 'angry') { g.moveTo(47, 44); g.quadraticCurveTo(52, 39, 57, 44); g.stroke(); g.lineWidth = 2.6; g.beginPath(); g.moveTo(41, 26); g.lineTo(49, 29.5); g.moveTo(63, 26); g.lineTo(55, 29.5); g.stroke(); }
    else if (o.mood === 'happy') { g.moveTo(45, 40); g.quadraticCurveTo(52, 48, 59, 40); g.stroke(); }
    else { g.moveTo(46, 41); g.quadraticCurveTo(52, 46, 58, 41); g.stroke(); }
    g.fillStyle = a.hat;
    if (a.hatStyle === 'cap') { g.beginPath(); g.moveTo(30, 28); g.quadraticCurveTo(50, 8, 70, 28); g.closePath(); g.fill(); rr(g, 56, 24, 24, 6, 3); }
    else if (a.hatStyle === 'beanie') { g.beginPath(); g.moveTo(31, 30); g.quadraticCurveTo(50, 4, 69, 30); g.closePath(); g.fill(); rr(g, 29, 26, 42, 8, 4); g.beginPath(); g.arc(50, 9, 5, 0, 7); g.fill(); }
    }
    if (ly < 0) g.restore();
    if (o.head) g.restore();
    g.restore();
  }
  root.RDRPeople = { draw: draw, clean: clean, random: random, profile: profile, HATS: HATS, SKINS: SKINS, SHIRTS: SHIRTS, PANTS: PANTS, SHOES: SHOES, AV0: AV0 };
})(typeof window !== 'undefined' ? window : globalThis);
