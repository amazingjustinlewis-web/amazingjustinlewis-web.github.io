/* RED DEER RICH solo v0.2 - little walking people (canvas port of the 0-Phi proxy avatar: shirt, pants, shoes, hat, skin).
   Same chunky design as the profile avatar (minikit/ztp-account.js avatarSVG) and the arcade showcase proxy guys.
   RDRPeople.draw(ctx, x, y, h, look, o): feet at (x, y), h = full height in the current units.
   o.walk = stride phase (0..1 loops, -1 = standing), o.face = 1 right / -1 left, o.glow = ring colour, o.alpha, o.bob.
   v0.2: o.squash (1 = normal, <1 = squashed flat on a hard landing, >1 = stretched mid-hop), o.tilt (radians, whole body leans about the feet),
   o.swing (0..1 progress of a front-arm smack: wind up overhead, whip down, recover), o.head (radians, head wobble about the neck, the doorstop-spring boing). */
(function (root) {
  'use strict';
  var HATS = ['none', 'cap', 'beanie'];
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
    var arm = sw * 1.2;
    if (o.swing != null && o.swing >= 0 && o.swing < 1) { var q = o.swing; arm = q < 0.32 ? -175 * (q / 0.32) : q < 0.55 ? -175 + 140 * ((q - 0.32) / 0.23) : -35 * (1 - (q - 0.55) / 0.45); }
    limb(g, 70, 54, arm, function () { g.fillStyle = a.shirt; rr(g, 70, 52, 12, 32, 6); g.fillStyle = a.skin; g.beginPath(); g.arc(76, 86, 5, 0, 7); g.fill(); });
    g.fillStyle = a.shirt; rr(g, 29, 48, 42, 44, 12);
    if (o.badge) { g.fillStyle = o.badge; rr(g, 41, 60, 18, 14, 4); }
    if (o.head) { g.save(); g.translate(50, 50); g.rotate(o.head); g.translate(-50, -50); }
    g.fillStyle = a.skin; g.beginPath(); g.arc(50, 32, 19, 0, 7); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(46, 33, 2.6, 0, 7); g.arc(58, 33, 2.6, 0, 7); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(46, 41); g.quadraticCurveTo(52, 46, 58, 41); g.stroke();
    g.fillStyle = a.hat;
    if (a.hatStyle === 'cap') { g.beginPath(); g.moveTo(30, 28); g.quadraticCurveTo(50, 8, 70, 28); g.closePath(); g.fill(); rr(g, 56, 24, 24, 6, 3); }
    else if (a.hatStyle === 'beanie') { g.beginPath(); g.moveTo(31, 30); g.quadraticCurveTo(50, 4, 69, 30); g.closePath(); g.fill(); rr(g, 29, 26, 42, 8, 4); g.beginPath(); g.arc(50, 9, 5, 0, 7); g.fill(); }
    if (o.head) g.restore();
    g.restore();
  }
  root.RDRPeople = { draw: draw, clean: clean, random: random, profile: profile, HATS: HATS, SKINS: SKINS, SHIRTS: SHIRTS, PANTS: PANTS, SHOES: SHOES, AV0: AV0 };
})(typeof window !== 'undefined' ? window : globalThis);
