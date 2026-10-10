/* DRIFT SIGNAL v0.3 - weapons + target lock, trading, the sandworm desert (Sere Khamsin), the asteroid cave.
   Plugs into tv.js through window.SPACE_X (hooks: pre/act/pilot/tick/scene/state/hud). */
(function () {
  'use strict';
  var X = window.SPACE_X, T = X.T, C = X.C, ship = X.ship, H = X.H, SFX = window.SSFX, camera = X.camera;
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; }, lerp = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var say = X.say, log = X.log, dirty = X.dirty, IT = C.items, TR = C.traders, DN = C.dunes, WP = C.weapons;
  var glow = H.glow || window.SWorld.glowTex(T);
  // new actions -> stations (anyone can use the emergency escape + restart)
  Object.assign(X.ACT, { lock: 'tac', phaser: 'tac', torpedo: 'tac', tractor: 'tac', trade: 'com', tradeOffer: 'com', tradeAccept: 'com', tradeClose: 'com', cave: 'helm', escape: 'helm', restart: 'helm' });
  Object.assign(X.LABEL, { lock: 'Lock target', phaser: 'Fire phasers', torpedo: 'Fire torpedo', tractor: 'Tractor beam', trade: 'Open trade', tradeOffer: 'Propose trade', tradeAccept: 'Accept counter-offer', tradeClose: 'Close trade', cave: 'Asteroid cave' });

  // ================================================================== ship-wide v0.3 state
  var V = { lock: null, cargo: [], stats: null, over: null, trade: null, beam: null, holds: {}, cracks: [], crackFade: 0, buckle: 0, fx: [], tractor: null };
  function resetGame() {
    V.cargo = C.cargoStart.slice(); for (var i = 0; i < WP.torpedoes; i++) V.cargo.push('torp');
    V.stats = { t0: performance.now(), dist: 0, trades: 0, torps: 0, phasers: 0, worms: 0, landings: 0, caves: 0 };
    Object.keys(TR).forEach(function (k) { V.holds[k] = TR[k].hold.slice(); });
    V.lock = null; V.trade = null; V.beam = null; V.cracks = []; V.buckle = 0;
  }
  resetGame();
  function torps() { return V.cargo.filter(function (c) { return c === 'torp'; }).length; }
  function takeTorp() { var i = V.cargo.indexOf('torp'); if (i < 0) return false; V.cargo.splice(i, 1); V.stats.torps++; return true; }
  var lastPos = ship.pos.clone();

  // ================================================================== targets + lock
  function targetPos(id) {
    if (id === 'worm') return null;
    if (id === '_ev') { var e = X.ev().active; return e && (e.ship || (H.raider.visible ? H.raider : null)) ? (e.ship || H.raider).position : null; }
    if (id === 'cave') return cave ? cave.rock.position : null;
    if (id === 'rock') return X.grab() ? X.grab().rock.position : null;
    return H.objs[id] ? H.objs[id].position : null;
  }
  function targets() {
    if (ship.loc === 'dunes') return W.worms.filter(function (w) { return w.on; }).map(function (w, i) { return { id: 'worm', n: 'Sandworm' + (W.attack ? ' (we are inside it)' : ' \u00B7 under the sand'), d: Math.round(W.attack ? 0 : w.R), k: 'hostile' }; }).slice(0, 1);
    if (ship.loc !== 'space') return [];
    var list = X.contacts().filter(function (c) { return c.tier === 'full' || c.id === '_ev'; }).slice(0, 7).map(function (c) {
      var d = X.defs[c.id], hostile = c.id === '_ev' && !!X.fight();
      return { id: c.id, n: c.name, d: c.d, k: hostile ? 'hostile' : d && (d.trader || d.kind === 'station') ? 'friendly' : 'neutral' }; });
    if (cave) list.unshift({ id: 'cave', n: 'Big asteroid (cave)', d: Math.round(cave.rock.position.distanceTo(ship.pos)), k: 'neutral' });
    if (X.grab()) list.unshift({ id: 'rock', n: 'Grabbed asteroid', d: 120, k: 'neutral' });
    return list;
  }
  function lockOn(id) {
    var t = targets().find(function (q) { return q.id === id; }); if (!t) { say('No such contact on sensors.', 'calm', true); return; }
    V.lock = id; SFX.play('ping'); say('Target locked: ' + t.n + '.', 'calm', true); dirty();
  }
  function lockName() { var t = targets().find(function (q) { return q.id === V.lock; }); return t ? t.n : null; }

  // ---- beams + torpedoes in whichever scene we're looking at
  function curScene() { return ship.loc === 'dunes' && W.scene ? W.scene : X.sceneMain; }
  function beamMesh(col) { var m = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 1, 6, 1, true), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })); m.frustumCulled = false; return m; }
  function placeBeam(m, a, b) { m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(1, a.distanceTo(b), 1); m.lookAt(b); m.rotateX(Math.PI / 2); }
  function muzzle() { return camera.position.clone().add(new T.Vector3(0, -5, -14).applyQuaternion(camera.quaternion)); }
  function fxBeam(to, col, dur, width) { var m = beamMesh(col); m.scale.x = m.scale.z = width || 1; var sc = curScene(); sc.add(m); V.fx.push({ kind: 'beam', m: m, to: to.clone(), t: 0, dur: dur || 0.3, sc: sc, w: width || 1 }); }
  function fxTorp(to, onHit) { var s = new T.Sprite(new T.SpriteMaterial({ map: glow, color: 0xff9a50, blending: T.AdditiveBlending, depthWrite: false })); s.scale.set(14, 14, 1); var sc = curScene(); sc.add(s);
    var from = muzzle(); s.position.copy(from); V.fx.push({ kind: 'torp', m: s, from: from, to: to.clone(), t: 0, dur: clamp(from.distanceTo(to) / 260, 0.9, 2.6), sc: sc, hit: onHit }); SFX.play('torpedo'); }
  function fxBoom(at, size, sc) { var s = new T.Sprite(new T.SpriteMaterial({ map: glow, color: 0xffd090, blending: T.AdditiveBlending, depthWrite: false, transparent: true })); s.position.copy(at); sc = sc || curScene(); sc.add(s); V.fx.push({ kind: 'boom', m: s, t: 0, dur: 1.4, size: size || 120, sc: sc }); SFX.play('boom'); }
  function updateFx(dt) {
    V.fx = V.fx.filter(function (f) { f.t += dt; var k = f.t / f.dur;
      if (f.kind === 'beam') { placeBeam(f.m, muzzle(), f.to); f.m.scale.x = f.m.scale.z = f.w * (1 + Math.sin(f.t * 60) * 0.3); f.m.material.opacity = 0.9 * (1 - k * k); }
      if (f.kind === 'torp') { f.m.position.lerpVectors(f.from, f.to, ease(k)); f.m.position.y += Math.sin(k * Math.PI) * 8; f.m.material.rotation += dt * 6; if (k >= 1) { f.hit && f.hit(); } }
      if (f.kind === 'boom') { var s = f.size * (0.3 + ease(k) * 1.2); f.m.scale.set(s, s, 1); f.m.material.opacity = 1 - k; }
      if (k >= 1) { f.sc.remove(f.m); return false; } return true; });
    if (V.tractor) { V.tractor.t -= dt; var tp = targetPos(V.tractor.id); if (!tp || V.tractor.t <= 0) { curScene().remove(V.tractor.m); V.tractor = null; } else { placeBeam(V.tractor.m, muzzle(), tp); V.tractor.m.material.opacity = 0.35 + Math.sin(X.simT() * 9) * 0.15; } }
  }
  function firePhaser() {
    if (ship.loc === 'dunes') { wormPhaser(); return; }
    if (X.fight() && (!V.lock || V.lock === '_ev')) { V.stats.phasers++; X.firePhasers(); return; }
    if (!V.lock) { say('No target locked. Tap a contact on Tactical first.', 'calm', true); return; }
    var t = targets().find(function (q) { return q.id === V.lock; }), p = targetPos(V.lock); if (!t || !p) { V.lock = null; say('Lost the lock.', 'calm', true); return; }
    if (t.k === 'friendly') { SFX.play('no'); say('Holding fire. ' + t.n + ' is friendly.', 'calm'); return; }
    V.stats.phasers++; SFX.play('phaser'); fxBeam(p, 0xffa040, 0.35);
    say(V.lock === 'rock' || V.lock === 'cave' ? 'Phasers on the asteroid. Sparks, dust, and a slightly smaller rock.' : 'Phasers fired at ' + t.n + '. No effect at this scale.', 'calm', true);
  }
  function fireTorpedo() {
    if (ship.loc === 'dunes') { wormTorpedo(); return; }
    if (!torps()) { SFX.play('no'); say('Torpedo bay empty. Traders sell them.', 'calm'); return; }
    var id = V.lock || (X.fight() ? '_ev' : null); if (!id) { say('No target locked. Tap a contact on Tactical first.', 'calm', true); return; }
    var t = targets().find(function (q) { return q.id === id; }), p = targetPos(id); if (!t || !p) { say('Lost the lock.', 'calm', true); return; }
    if (t.k === 'friendly') { SFX.play('no'); say('Torpedo lock refused. ' + t.n + ' is friendly.', 'calm'); return; }
    if (t.d > 6000 && id !== '_ev') { say('Out of torpedo range.', 'calm', true); return; }
    takeTorp(); say('Torpedo away. ' + torps() + ' left.', 'alert');
    var aim = id === '_ev' ? H.raider.position : p;
    fxTorp(aim, function () { var F = X.fight(); fxBoom(id === '_ev' ? H.raider.position.clone() : aim.clone(), id === '_ev' ? 140 : 260);
      if (F && id === '_ev') { F.hp = Math.max(0, F.hp - rnd(WP.torpDmg[0], WP.torpDmg[1])); F.hits++; say('Direct hit. Raider hull ' + Math.round(F.hp) + '%.', 'alert'); } dirty(); });
  }
  function tractor(me) {
    var e = X.ev().active;
    if ((!V.lock || V.lock === '_ev') && e && e.def.kind === 'distress') { X.tow(me); return; }
    if (!V.lock) { say('Lock a target first, then tractor.', 'calm', true); return; }
    var t = targets().find(function (q) { return q.id === V.lock; }), p = targetPos(V.lock), d = X.defs[V.lock];
    if (!t || !p) { say('Lost the lock.', 'calm', true); return; }
    if (d && /planet|station|blackhole|nebula/.test(d.kind)) { say('Far too massive for the tractor beam.', 'calm'); return; }
    if (t.d > 2500) { say('Out of tractor range. Get within 2,500.', 'calm'); return; }
    if (V.tractor) curScene().remove(V.tractor.m);
    var m = beamMesh(0x7fd8ff); m.scale.x = m.scale.z = 3; curScene().add(m); V.tractor = { id: V.lock, t: 10, m: m }; SFX.play('beam');
    say('Tractor lock on ' + t.n + '. Holding it steady.', 'calm');
  }

  // ================================================================== trading
  function nearTrader() {
    if (ship.loc !== 'space') return null; var best = null;
    C.sector.forEach(function (d) { if (!d.trader) return; var dist = H.objs[d.id].position.distanceTo(ship.pos); if (dist < Math.max(2500, d.r * 8) && (!best || dist < best.dist)) best = { id: d.trader, sid: d.id, dist: dist }; });
    return best;
  }
  function openTrade() {
    var n = nearTrader(); if (!n) { say('No trader in hailing range. Fly closer to a station or a freighter.', 'calm'); return false; }
    var tr = TR[n.id]; V.trade = { tid: n.id, sid: n.sid, name: tr.name, msg: tr.hi, counter: null, rev: 1, mood: 'open' };
    SFX.play('chirp'); log(tr.name + ': ' + tr.hi, 'com'); say('Trade channel open with ' + tr.name + '.', 'calm', true); dirty(); return true;
  }
  function seen(tr, id) { return IT[id].v * (tr.likes[id] || tr.hates[id] || 1); }
  function evalOffer(give, take) {
    var tr = TR[V.trade.tid], my = 0, their = 0;
    give.forEach(function (i) { my += seen(tr, V.cargo[i]); }); take.forEach(function (i) { their += IT[V.holds[V.trade.tid][i]].v * tr.greed; });
    return { my: my, their: their };
  }
  function cleanIdx(arr, len) { var o = []; (arr || []).forEach(function (i) { i = i | 0; if (i >= 0 && i < len && o.indexOf(i) < 0) o.push(i); }); return o; }
  function offer(m) {
    if (!V.trade || V.beam) return; var tr = TR[V.trade.tid], hold = V.holds[V.trade.tid];
    var give = cleanIdx(m.give, V.cargo.length), take = cleanIdx(m.take, hold.length);
    if (!give.length && !take.length) return;
    var e = evalOffer(give, take);
    if (!take.length) { V.trade.msg = 'A gift? ...Accepted. That was kind.'; doTrade(give, take); return; }
    if (e.my >= e.their) { V.trade.msg = tr.yes; doTrade(give, take); return; }
    if (e.my >= e.their * tr.counter) {   // close: they counter with the smallest sweetener that closes the gap
      var gap = e.their - e.my, add = null;
      V.cargo.forEach(function (c, i) { if (give.indexOf(i) >= 0) return; var v = seen(tr, c); if (v >= gap && (!add || v < add.v)) add = { i: i, v: v }; });
      if (add) { V.trade.counter = { give: give.concat([add.i]), take: take }; V.trade.msg = tr.ctr + ' Add your ' + IT[V.cargo[add.i]].name.toLowerCase() + '.'; }
      else { var drop = null; take.forEach(function (i) { var v = IT[hold[i]].v * tr.greed; if (v >= gap && (!drop || v < drop.v)) drop = { i: i, v: v }; });
        if (drop && take.length > 1) { V.trade.counter = { give: give, take: take.filter(function (i) { return i !== drop.i; }) }; V.trade.msg = tr.ctr + ' But we keep the ' + IT[hold[drop.i]].name.toLowerCase() + '.'; }
        else { V.trade.counter = null; V.trade.msg = tr.no; SFX.play('no'); dirty(); return; } }
      V.trade.mood = 'counter'; SFX.play('chirp'); log(tr.name + ': ' + V.trade.msg, 'com'); dirty(); return;
    }
    V.trade.counter = null; V.trade.mood = 'no'; V.trade.msg = tr.no; SFX.play('no'); log(tr.name + ': ' + tr.no, 'com'); dirty();
  }
  function doTrade(give, take) {
    var hold = V.holds[V.trade.tid], out = give.map(function (i) { return V.cargo[i]; }), inn = take.map(function (i) { return hold[i]; });
    V.cargo = V.cargo.filter(function (c, i) { return give.indexOf(i) < 0; }).concat(inn);
    V.holds[V.trade.tid] = hold.filter(function (c, i) { return take.indexOf(i) < 0; }).concat(out);
    V.trade.counter = null; V.trade.mood = 'yes'; V.trade.rev++; V.stats.trades++;
    V.beam = { out: out, inn: inn, t: 0 }; SFX.play('trade'); setTimeout(function () { SFX.play('beam'); }, 500);
    log('TRADE \u203A gave ' + (out.map(function (i) { return IT[i].name; }).join(', ') || 'nothing') + ' \u00B7 got ' + (inn.map(function (i) { return IT[i].name; }).join(', ') || 'nothing'), 'com');
    say('Trade accepted. Transporters engaged.', 'calm'); dirty();
  }
  // the wireframe beaming show on the TV
  function drawCrate(g, cx, cy, s, rot, build, col, icon) {   // isometric wireframe crate; build 0..1 = how much of it exists (from the bottom)
    var P = [], c = Math.cos(rot), sn = Math.sin(rot);
    [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]].forEach(function (v) { var x = v[0] * c - v[2] * sn, z = v[0] * sn + v[2] * c; P.push([cx + x * s, cy - v[1] * s * 0.9 + z * s * 0.35, v[1]]); });
    var E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]], lim = -1 + build * 2;
    g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath();
    E.forEach(function (e) { var a = P[e[0]], b = P[e[1]]; if (a[2] > lim && b[2] > lim) return; var t = 1; if (b[2] > lim && a[2] <= lim && b[2] !== a[2]) t = (lim - a[2]) / (b[2] - a[2]); if (a[2] > lim && b[2] <= lim) { var q = a; a = b; b = q; t = a[2] !== b[2] ? (lim - a[2]) / (b[2] - a[2]) : 1; } g.moveTo(a[0], a[1]); g.lineTo(lerp(a[0], b[0], clamp(t, 0, 1)), lerp(a[1], b[1], clamp(t, 0, 1))); });
    g.stroke(); if (build > 0.6) { g.globalAlpha *= clamp((build - 0.6) * 2.5, 0, 1); g.fillStyle = col; g.textAlign = 'center'; g.font = Math.round(s * 0.9) + 'px system-ui, sans-serif'; g.fillText(icon, cx, cy + s * 0.3); }
  }
  function drawBeam(g, w, h, r, f, dt) {
    var B = V.beam; B.t += dt; var t = B.t, D = 8, cy = (r.y0 + r.y1) * 0.52, s = h * 0.035;
    g.save(); g.globalAlpha = clamp(Math.min(t * 2, D - t), 0, 1);
    g.fillStyle = 'rgba(4,16,24,.55)'; g.fillRect(r.x0 + w * 0.08, cy - h * 0.2, w * 0.84 - r.x0, h * 0.4);
    for (var yy = cy - h * 0.2; yy < cy + h * 0.2; yy += 4) { g.fillStyle = 'rgba(120,230,255,' + (0.03 + 0.02 * Math.sin(yy * 0.4 + t * 10)).toFixed(3) + ')'; g.fillRect(r.x0 + w * 0.08, yy, w * 0.84 - r.x0, 1); }
    g.font = '700 ' + f + 'px Fredoka, system-ui'; g.textAlign = 'center';
    g.fillStyle = '#ffb38a'; g.fillText('\u2191 BEAMING OUT', w * 0.3, cy - h * 0.15); g.fillStyle = '#9fffd8'; g.fillText('\u2193 MATERIALISING ABOARD', w * 0.7, cy - h * 0.15);
    function row(list, x0, outgoing) {
      list.forEach(function (id, i) { var n = list.length, x = x0 + (i - (n - 1) / 2) * s * 3.2, k = outgoing ? 1 - clamp((t - 1.2 - i * 0.25) / 2.6, 0, 1) : clamp((t - 3.4 - i * 0.25) / 2.6, 0, 1), y = cy + s * 0.5 - (outgoing ? (1 - k) * h * 0.08 : 0);
        var a0 = g.globalAlpha; drawCrate(g, x, y, s, X.simT() * 0.8 + i, k, outgoing ? 'rgba(255,180,140,.95)' : 'rgba(160,255,220,.95)', IT[id].icon); g.globalAlpha = a0;
        var dots = outgoing ? 1 - k : k < 1 ? 1 - k : 0; if (dots > 0.02 && k > 0.0) for (var j = 0; j < 22; j++) { var ph = (j * 0.37 + t * (outgoing ? 0.9 : -0.9)) % 1, px = x + Math.sin(j * 12.9) * s * 1.2, py = y + s - ph * s * 4 * (outgoing ? 1 : -0.5) - (outgoing ? 0 : s); g.fillStyle = outgoing ? 'rgba(255,200,170,' + (dots * (1 - ph)).toFixed(2) + ')' : 'rgba(170,255,230,' + (dots * ph).toFixed(2) + ')'; g.fillRect(px, py, 2, 2); }
        g.fillStyle = 'rgba(220,240,255,.8)'; g.font = '500 ' + Math.round(f * 0.8) + 'px Fredoka'; g.globalAlpha = a0 * (outgoing ? 0.4 + k * 0.6 : k); g.fillText(IT[id].name, x, y + s * 2.3); g.globalAlpha = a0; });
      if (!list.length) { g.fillStyle = 'rgba(220,240,255,.5)'; g.font = '500 ' + f + 'px Fredoka'; g.fillText('(nothing)', x0, cy + s); }
    }
    row(B.out, w * 0.3, true); row(B.inn, w * 0.7, false);
    g.restore(); if (t > D) V.beam = null;
  }

  // ================================================================== the asteroid cave
  var cave = null, caveRock = null;
  function buildCaveRock() {
    var grp = new T.Group(), mat = new T.MeshLambertMaterial({ color: 0x5f5850, flatShading: true }), inner = new T.MeshLambertMaterial({ color: 0x6d655c, flatShading: true, side: T.BackSide });
    var nz = function (v) { return 1 + Math.sin(v.x * 0.021 + v.y * 0.013) * 0.08 + Math.cos(v.y * 0.031 - v.z * 0.017) * 0.07 + Math.sin(v.z * 0.05 + v.x * 0.04) * 0.04; };
    function shell(geo, cut, k) {   // displace, then drop triangles inside the mouth cone (+z)
      var pa = geo.attributes.position, v = new T.Vector3(), keep = [];
      for (var i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i); var s = nz(v) * (k || 1); pa.setXYZ(i, v.x * s, v.y * (k ? s : s * 0.86), v.z * s); }
      for (var t = 0; t < pa.count; t += 3) { var cz = 0, cl = 0; for (var j = 0; j < 3; j++) { v.fromBufferAttribute(pa, t + j); cz += v.z; cl += v.length(); } if (cz / cl > cut) continue; for (j = 0; j < 3; j++) { v.fromBufferAttribute(pa, t + j); keep.push(v.x, v.y, v.z); } }
      var g2 = new T.BufferGeometry(); g2.setAttribute('position', new T.Float32BufferAttribute(keep, 3)); g2.computeVertexNormals(); return g2;
    }
    grp.add(new T.Mesh(shell(new T.IcosahedronGeometry(430, 3), 0.975), mat));
    grp.add(new T.Mesh(shell(new T.IcosahedronGeometry(160, 2), 0.86, 1), inner));
    var tg = new T.CylinderGeometry(78, 64, 330, 14, 8, true); tg.rotateX(Math.PI / 2); tg.translate(0, 0, 265);
    var tp = tg.attributes.position, v = new T.Vector3(); for (var i = 0; i < tp.count; i++) { v.fromBufferAttribute(tp, i); var a = Math.atan2(v.y, v.x), s = 1 + Math.sin(a * 3 + v.z * 0.03) * 0.12 + Math.cos(a * 5 - v.z * 0.05) * 0.06; tp.setXYZ(i, v.x * s, v.y * s, v.z); }
    tg.computeVertexNormals(); grp.add(new T.Mesh(tg, inner));
    var cm = [new T.MeshBasicMaterial({ color: 0x7fe8ff }), new T.MeshBasicMaterial({ color: 0xc89bff })], R = C.rng(31);
    for (i = 0; i < 26; i++) { var c = new T.Mesh(new T.OctahedronGeometry(4 + R() * 9, 0), cm[i % 2]), th = R() * 6.283, ph = (R() - 0.5) * 2.6; c.position.set(Math.cos(th) * Math.cos(ph) * 140, Math.sin(ph) * 120, Math.sin(th) * Math.cos(ph) * 140 - 10); if (c.position.z > 90) c.position.z -= 180; c.scale.y = 2.2; c.lookAt(0, 0, 0); grp.add(c); }
    var l1 = new T.PointLight(0x8fdcff, 1.6, 420); l1.position.set(-40, -60, -40); grp.add(l1); var l2 = new T.PointLight(0xc79bff, 1.2, 380); l2.position.set(60, 50, -30); grp.add(l2);
    var l3 = new T.PointLight(0xfff0d0, 0.9, 520); grp.add(l3); grp.userData.flood = l3;
    return grp;
  }
  function caveCmd() {
    if (cave && cave.st !== 'gone') { if (cave.st === 'inside' || cave.st === 'turn') { cave.st = 'exit'; cave.t = 0; cave.p0 = ship.pos.clone(); SFX.play('burn'); say('Easing back out of the cave.', 'calm'); } return; }
    if (ship.loc !== 'space' || X.fight() || X.grab()) { say('Not now.', 'calm', true); return; }
    if (!caveRock) caveRock = buildCaveRock();
    var f = X.fwd(new T.Vector3()), A = ship.pos.clone().addScaledVector(f, 2100).add(new T.Vector3(0, 120, 0));
    caveRock.position.copy(A); caveRock.lookAt(ship.pos); X.sceneMain.add(caveRock);
    var axis = ship.pos.clone().sub(A).normalize();
    cave = { rock: caveRock, A: A, axis: axis, st: 'approach', t: 0, p0: ship.pos.clone() };
    ship.course = null; ship.orbit = null; X.ev().cool = Math.max(X.ev().cool, 400); V.stats.caves++;
    SFX.play('course'); say('Big asteroid ahead with a cave in it. Taking us in, slowly.', 'calm'); dirty();
  }
  var cq = new T.Vector3();
  function cavePilot(dt) {
    if (!cave || cave.st === 'gone') return false; var K = cave; K.t += dt;
    var mouth = cq.copy(K.A).addScaledVector(K.axis, 640);
    if (K.st === 'approach') { var k = ease(K.t / 16); ship.pos.lerpVectors(K.p0, mouth, k); X.faceToward(K.axis.clone().negate(), dt, 3); ship.speed = 40 * (1 - k) + 6; if (K.t > 16) { K.st = 'enter'; K.t = 0; K.p0 = ship.pos.clone(); say('Entering the cave. Floodlights on.', 'calm'); } }
    else if (K.st === 'enter') { var k2 = ease(K.t / 14); ship.pos.lerpVectors(K.p0, K.A.clone().addScaledVector(K.axis, -20), k2); X.faceToward(K.axis.clone().negate(), dt, 3); ship.speed = 14; if (K.t > 14) { K.st = 'turn'; K.t = 0; say('Inside. Turning to look back out.', 'calm'); } }
    else if (K.st === 'turn') { X.faceToward(K.axis, dt, 1.4); ship.speed = 0; if (K.t > 12) { K.st = 'inside'; K.t = 0; say('It is very quiet in here.', 'calm', true); } }
    else if (K.st === 'inside') { X.faceToward(K.axis.clone().add(new T.Vector3(Math.sin(K.t * 0.05) * 0.08, Math.sin(K.t * 0.037) * 0.05, 0)).normalize(), dt, 0.5); ship.speed = 0; }
    else if (K.st === 'exit') { var k3 = ease(K.t / 14); ship.pos.lerpVectors(K.p0, cq.copy(K.A).addScaledVector(K.axis, 900), k3); X.faceToward(K.axis, dt, 2); ship.speed = 18; if (K.t > 14) { K.st = 'gone'; ship.speed = 0; ship.mode = 'idle'; X.ev().cool = 30; say('Back in open space.', 'calm'); dirty(); return false; } }
    K.rock.userData.flood.position.copy(K.rock.worldToLocal(ship.pos.clone()));
    ship.mode = 'cave'; return true;
  }

  // ================================================================== the sandworm desert: Sere Khamsin
  var W = { scene: null, phase: '', t: 0, worms: [], attack: null, nextWorm: 0, camY: 400, yaw: 0, landedT: 0, warned: 0 };
  var HF = 'float hgt(vec2 p){ float h = 9.0*sin(p.x*0.012 + sin(p.y*0.004)*2.0)*cos(p.y*0.009) + 5.0*sin((p.x+p.y)*0.021) + 2.0*sin(p.x*0.05 - p.y*0.03) + 1.2*sin(p.x*0.11+p.y*0.07);\n' +
    ' h *= smoothstep(25.0, 140.0, length(p));\n for (int i = 0; i < 3; i++) { vec4 w = uW[i]; if (w.z <= 0.0) continue; float d = length(p - w.xy); h += w.z * (exp(-d*d/(w.w*w.w)) * 4.0 + 0.9 * sin(d*0.22 - uT*4.0) * exp(-d/55.0)); }\n return h; }\n';
  function hgtJS(x, z) { var h = 9 * Math.sin(x * 0.012 + Math.sin(z * 0.004) * 2) * Math.cos(z * 0.009) + 5 * Math.sin((x + z) * 0.021) + 2 * Math.sin(x * 0.05 - z * 0.03) + 1.2 * Math.sin(x * 0.11 + z * 0.07); var l = Math.hypot(x, z), s = clamp((l - 25) / 115, 0, 1); return h * s * s * (3 - 2 * s); }
  function buildDunes() {
    var S = new T.Scene(), U = { uT: { value: 0 }, uW: { value: [new T.Vector4(), new T.Vector4(), new T.Vector4()] }, uSun: { value: new T.Vector3(-0.5, 0.42, -0.75).normalize() }, uFog: { value: new T.Color(0xf2d2a8) } };
    var seg = X.rung() >= 3 ? 110 : 170, g = new T.PlaneGeometry(4200, 4200, seg, seg); g.rotateX(-Math.PI / 2);
    var sand = new T.Mesh(g, new T.ShaderMaterial({ uniforms: U,
      vertexShader: 'uniform float uT; uniform vec4 uW[3]; varying vec3 vN; varying vec3 vP;\n' + HF +
        'void main(){ vec2 p = position.xz; float h = hgt(p); float e = 3.0; vec3 n = normalize(vec3(hgt(p-vec2(e,0.0)) - hgt(p+vec2(e,0.0)), 2.0*e, hgt(p-vec2(0.0,e)) - hgt(p+vec2(0.0,e))));\n vN = n; vP = vec3(p.x, h, p.y); gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }',
      fragmentShader: 'uniform vec3 uSun; uniform vec3 uFog; uniform float uT; varying vec3 vN; varying vec3 vP;\n' +
        'void main(){ float rip = sin(vP.x*0.9 + sin(vP.z*0.2)*2.0)*0.5+0.5; vec3 n = normalize(vN + vec3(rip*0.06, 0.0, 0.0)); float l = max(dot(n, uSun), 0.0);\n' +
        ' vec3 base = mix(vec3(0.78,0.52,0.30), vec3(0.96,0.76,0.50), rip*0.25 + vP.y*0.02 + 0.45); vec3 col = base*(0.38 + 0.85*l) + vec3(0.05,0.03,0.0);\n' +
        ' float d = length(cameraPosition - vP); col = mix(col, uFog, 1.0 - exp(-d*0.00075)); gl_FragColor = vec4(col, 1.0); }' }));
    S.add(sand); W.sand = sand;
    var sky = new T.Mesh(new T.SphereGeometry(3800, 32, 16), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, uniforms: U,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uSun; uniform vec3 uFog; varying vec3 vD; void main(){ float y = max(vD.y, 0.0); vec3 c = mix(uFog, vec3(0.36,0.55,0.78), pow(y, 0.55)); float s = max(dot(normalize(vD), uSun), 0.0); c += vec3(1.0,0.92,0.75)*(pow(s, 900.0)*2.0 + pow(s, 12.0)*0.3); gl_FragColor = vec4(c, 1.0); }' }));
    sky.frustumCulled = false; S.add(sky); W.sky = sky;
    S.add(new T.HemisphereLight(0xffe2b8, 0x8a5a30, 0.9)); var dl = new T.DirectionalLight(0xffeed8, 0.9); dl.position.copy(U.uSun.value); S.add(dl);
    W.lamp = new T.PointLight(0xffe6c0, 0, 140); S.add(W.lamp);
    // ridge segments of a worm's back that peek through the sand
    var ridgeM = new T.MeshLambertMaterial({ color: 0x8a6440, flatShading: true }); W.ridge = [];
    for (var i = 0; i < 9; i++) { var rs = new T.Mesh(new T.SphereGeometry(12 - i * 0.6, 8, 6), ridgeM); rs.visible = false; S.add(rs); W.ridge.push(rs); }
    // sand spray
    var n = 360, pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    W.spray = { pts: new T.Points(pg, new T.PointsMaterial({ color: 0xe8c59a, size: 3.4, transparent: true, opacity: 0.85, depthWrite: false })), v: new Float32Array(n * 3), life: new Float32Array(n), n: n, next: 0 };
    W.spray.pts.frustumCulled = false; S.add(W.spray.pts);
    W.head = buildHead(); W.head.visible = false; S.add(W.head);
    W.U = U; W.scene = S;
  }
  function buildHead() {
    var g = new T.Group(), L = 420;
    var tube = new T.CylinderGeometry(14, 14, L, 40, 40, true); tube.rotateX(-Math.PI / 2); tube.translate(0, 0, -L / 2);
    var FU = { uT: { value: 0 }, uShield: { value: 0 }, uLamp: { value: 1 } };
    var flesh = new T.Mesh(tube, new T.ShaderMaterial({ side: T.DoubleSide, uniforms: FU,
      vertexShader: 'uniform float uT; varying vec2 vUv; varying vec2 vXY; void main(){ vUv = uv; vec3 p = position; float a = atan(p.y, p.x); vXY = p.xy; float s = 1.0 + 0.10*sin(a*7.0 + uv.y*40.0) + 0.06*sin(uv.y*120.0 - uT*3.0); p.xy *= s; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform float uT; uniform float uShield; uniform float uLamp; varying vec2 vUv; varying vec2 vXY;\n' +
        'void main(){ float vA = atan(vXY.y, vXY.x); float ring = 0.5 + 0.5*sin(vUv.y*260.0 - uT*2.0); float fold = 0.5 + 0.5*sin(vA*9.0 + vUv.y*30.0); vec3 c = mix(vec3(0.32,0.05,0.07), vec3(0.85,0.36,0.38), ring*0.6 + fold*0.3);\n' +
        ' float wet = pow(max(sin(vUv.y*260.0 - uT*2.0 + vA*2.0), 0.0), 16.0); c += vec3(1.0,0.85,0.8)*wet*0.45; float light = uLamp*(0.12 + 1.6*exp(-vUv.y*9.0)) + 0.05; c *= light;\n' +
        ' c += vec3(0.25,0.7,1.0)*uShield*(0.4 + 0.6*fold); gl_FragColor = vec4(c, 1.0); }' }));
    g.add(flesh); g.userData.FU = FU;
    var cap = new T.Mesh(new T.CircleGeometry(16, 24), new T.MeshBasicMaterial({ color: 0x080102 })); cap.position.z = -L + 2; g.add(cap);
    var skin = new T.CylinderGeometry(22, 24, L, 28, 12, true); skin.rotateX(-Math.PI / 2); skin.translate(0, 0, -L / 2);
    var sp = skin.attributes.position, v = new T.Vector3(); for (var i = 0; i < sp.count; i++) { v.fromBufferAttribute(sp, i); var k = 1 + 0.06 * Math.sin(v.z * 0.4); sp.setXYZ(i, v.x * k, v.y * k, v.z); } skin.computeVertexNormals();
    g.add(new T.Mesh(skin, new T.MeshLambertMaterial({ color: 0x9a7350, flatShading: true })));
    var lip = new T.Mesh(new T.RingGeometry(13.5, 22.5, 40, 1), new T.MeshLambertMaterial({ color: 0x6a2e24, side: T.DoubleSide })); g.add(lip);
    var toothM = new T.MeshLambertMaterial({ color: 0xf1e6c8, emissive: 0x2a2418 }), tg = new T.ConeGeometry(1.5, 8, 5); tg.translate(0, 4, 0);
    for (var row = 0; row < 4; row++) for (var j = 0; j < 18; j++) {
      var a = (j + row * 0.5) / 18 * 6.283, t = new T.Mesh(tg, toothM), rr = 13.2 - row * 0.2; t.position.set(Math.cos(a) * rr, Math.sin(a) * rr, -1 - row * 4.5);
      t.lookAt(0, 0, t.position.z + 6); t.rotateX(Math.PI / 2); t.rotateX(-0.9); t.scale.setScalar(1 - row * 0.12); g.add(t); }
    // the flesh tube's look up close: rotate the cone tip toward the axis
    g.children.forEach(function (c) { if (c.geometry === tg) { var p = c.position.clone(); c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(-p.x, -p.y, 9).normalize()); } });
    return g;
  }
  function sprayAt(x, y, z, n, up) { var S = W.spray, pa = S.pts.geometry.attributes.position.array; for (var i = 0; i < n; i++) { var k = S.next++ % S.n; pa[k * 3] = x + rnd(-6, 6); pa[k * 3 + 1] = y; pa[k * 3 + 2] = z + rnd(-6, 6); S.v[k * 3] = rnd(-12, 12); S.v[k * 3 + 1] = rnd(up * 0.5, up); S.v[k * 3 + 2] = rnd(-12, 12); S.life[k] = rnd(1.2, 2.6); } }
  function updateSpray(dt) { var S = W.spray, pa = S.pts.geometry.attributes.position.array; for (var k = 0; k < S.n; k++) { if (S.life[k] <= 0) { pa[k * 3 + 1] = -999; continue; } S.life[k] -= dt; S.v[k * 3 + 1] -= 22 * dt; pa[k * 3] += S.v[k * 3] * dt; pa[k * 3 + 1] += S.v[k * 3 + 1] * dt; pa[k * 3 + 2] += S.v[k * 3 + 2] * dt; } S.pts.geometry.attributes.position.needsUpdate = true; }

  function duneDescend() {
    var land = X.land(); if (land.step < 2) { say('Match orbit and align the descent corridor first.', 'calm'); return; }
    W.phase = 'entry'; W.t = 0; ship.loc = 'dunesEntry'; ship.course = null; ship.speed = 0; ship.orbit = null; ship.view = false; SFX.play('burn');
    say('Beginning descent to Sere Khamsin. It is a hot one.', 'alert'); dirty();
  }
  function enterDunes() {
    if (!W.scene) buildDunes();
    ship.loc = 'dunes'; W.phase = 'descend'; W.t = 0; W.camY = 420; W.yaw = 0; W.worms = []; W.attack = null; W.landedT = 0; W.warned = 0; W.nextWorm = DN.firstWormSec;
    W.head.visible = false; W.ridge.forEach(function (r) { r.visible = false; }); X.resetLand(); dirty();
  }
  function duneLiftoff() {
    if (ship.loc !== 'dunes' || W.attack || W.phase === 'lift') return;
    W.phase = 'lift'; W.t = 0; SFX.play('burn'); SFX.play('gear'); say('Lifting off. Sand pouring off the hull.', 'alert'); dirty();
  }
  function toOrbit(msg) {
    var d = X.defs.dune, pl = H.objs.dune.position, R = X.standoff(d); ship.loc = 'space'; ship.orbit = { id: 'dune', a: 0.6 }; ship.pos.set(pl.x + Math.cos(0.6) * R, pl.y + d.r * 0.25, pl.z + Math.sin(0.6) * R); X.faceNow(pl);
    W.phase = ''; W.attack = null; $('atmo').style.opacity = 0; $('gl').style.transform = ''; ship.shake = 0.2; say(msg || 'Orbit regained. Sere Khamsin below.', 'calm'); dirty();
  }
  function spawnWorm(R, angry, ang) { W.worms.push({ on: true, a: ang != null ? ang : Math.random() * 6.283, R: R, dir: Math.random() < 0.5 ? 1 : -1, hp: DN.wormHp, s: 0, angry: angry, trail: [], scared: 0 }); }
  function wormAttack(w) {
    w = w || W.worms.find(function (q) { return q.on; }); if (!w) { spawnWorm(120, true); w = W.worms[W.worms.length - 1]; }
    W.attack = { w: w, ph: 'rise', t: 0, total: 0, shield: 100, hp: w.hp, cool: 0, liftCool: 0, shots: 0, shotT: 0, beams: [], shards: null };
    W.head.visible = true; SFX.play('rumble'); SFX.play('alarm'); ship.alertManual = 'red'; say('Seismic spike directly ahead! It is coming up!', 'urgent'); dirty();
  }
  function crack(u, v, n, len) {   // a branching crack in window coordinates (0..1)
    for (var b = 0; b < n; b++) { var a = Math.random() * 6.283, pts = [[u, v]], x = u, y = v, segs = 6 + (Math.random() * 8 | 0);
      for (var i = 0; i < segs; i++) { a += rnd(-0.7, 0.7); var l = len * rnd(0.4, 1); x += Math.cos(a) * l; y += Math.sin(a) * l * 1.6; pts.push([x, y]); if (Math.random() < 0.18) V.cracks.push({ p: [[x, y], [x + Math.cos(a + 1.2) * l * 2, y + Math.sin(a + 1.2) * l * 3]], a: 1 }); }
      V.cracks.push({ p: pts, a: 1 }); }
    V.crackFade = 0;
  }
  function updateDunes(dt) {
    var S = W.scene, U = W.U; U.uT.value += dt; W.t += dt; var A = W.attack, cam = camera;
    if (W.phase === 'descend') { var e = ease(W.t / 15); W.camY = lerp(420, 7, 1 - Math.pow(1 - e, 1.4)); ship.shake = Math.max(ship.shake, 0.15 * (1 - e)); $('atmo').style.opacity = clamp(1 - W.t / 3, 0, 1);
      if (W.t > 15) { W.phase = 'landed'; W.t = 0; SFX.play('thud'); ship.shake = 0.5; V.stats.landings++; say('Touchdown on the dunes. Calm air. Long ripples in the sand out there.', 'calm'); dirty(); } }
    if (W.phase === 'lift') { var k = W.t / 9; W.camY = lerp(7, 520, k * k); ship.shake = 0.25 * (1 - k); if (W.t < 2) sprayAt(rnd(-20, 20), 0, -30, 6, 18);
      if (W.t > 6) { $('atmo').style.background = 'linear-gradient(180deg,rgba(255,170,90,.9),rgba(255,210,150,.7))'; $('atmo').style.opacity = clamp((W.t - 6) / 2.5, 0, 1); }
      if (W.t > 9) toOrbit(); }
    if (W.phase === 'landed') {
      W.landedT += dt;
      if (!A && W.landedT > W.nextWorm && W.worms.length < 2) { spawnWorm(W.worms.length ? 1100 : 700, !W.worms.length); W.nextWorm = W.landedT + rnd(DN.attackEvery[0], DN.attackEvery[1]); if (W.worms.length === 1) { SFX.play('rumble'); say('Seismic contact. Something large, moving under the sand. It is circling.', 'alert'); log('SEISMIC \u203A large contact, 700 m, circling', 'sci'); } }
      W.worms.forEach(function (w) { if (!w.on) return; w.s = Math.min(1, w.s + dt * 0.3); w.a += dt * w.dir * 18 / Math.max(80, w.R); if (w.scared > 0) { w.scared -= dt; w.R += dt * 40; } else if (w.angry && !A) w.R = Math.max(0, w.R - dt * 5.5);
        var x = Math.cos(w.a) * w.R, z = Math.sin(w.a) * w.R; w.x = x; w.z = z;
        if (Math.random() < dt * 10) sprayAt(x, hgtJS(x, z) + 1, z, 4, 14);
        if (w.angry && !A && w.R < 300 && W.warned < 1) { W.warned = 1; say('It is closing on us. Two hundred metres and tightening. Recommend lift-off.', 'urgent'); SFX.play('worm'); }
        if (w.angry && !A && w.R < 60) wormAttack(w); });
      var u = U.uW.value; for (var i = 0; i < 3; i++) { var w = W.worms[i]; if (w && w.on && !(A && A.w === w && A.ph !== 'rise')) u[i].set(w.x, w.z, w.s * 1.8, 30); else u[i].set(0, 0, 0, 1); }
      // the back ridge: a few humps breaking the surface behind the leading worm
      var lw = W.worms.find(function (q) { return q.on; }); W.ridge.forEach(function (r, j) { if (!lw || A || lw.R > 900) { r.visible = false; return; } var a = lw.a - lw.dir * (j + 1) * 16 / Math.max(80, lw.R), x2 = Math.cos(a) * lw.R, z2 = Math.sin(a) * lw.R; r.visible = j % 3 !== 2 && Math.sin(U.uT.value * 0.6 + j) > -0.2; r.position.set(x2, hgtJS(x2, z2) - 5 + Math.sin(U.uT.value * 1.3 + j) * 1.2, z2); });
    }
    // ---- the attack: rise, lunge, wrap around the window, shields fight it, shatter, the throat closes, it lands on the hull
    if (A) { A.t += dt; A.total += dt; var h = W.head, FU = h.userData.FU; FU.uT.value += dt;
      var ph = A.ph;
      if (ph === 'rise') { var k1 = ease(A.t / 3.2); h.position.set(0, lerp(-70, 4, k1), -150); h.rotation.set(lerp(-1.3, 0.1, k1), 0, 0); if (Math.random() < 0.5) sprayAt(rnd(-25, 25), 2, -150 + rnd(-20, 20), 8, 40); ship.shake = Math.max(ship.shake, 0.35);
        if (A.t > 3.2) { A.ph = 'lunge'; A.t = 0; SFX.play('worm'); say('It is lunging at us!', 'urgent'); } }
      else if (ph === 'lunge') { var k2 = A.t / 3.0; h.position.set(0, lerp(4, 7, k2), lerp(-150, 6, k2 * k2)); h.rotation.set(lerp(0.1, 0, k2), 0, 0); ship.shake = Math.max(ship.shake, 0.3 + k2 * 0.4);
        if (A.t > 3.0) { A.ph = 'shield'; A.t = 0; SFX.play('shieldHit'); SFX.play('strain'); W.lamp.intensity = 1.6; say('It has us. Shields are holding it off!', 'urgent'); } }
      else if (ph === 'shield') { h.position.set(0, 7, 6 + Math.sin(A.t * 5) * 0.6); var hold = 4 + ship.power.shields * 1.2; A.shield = Math.max(0, 100 * (1 - A.t / hold)); FU.uShield.value = (Math.random() < 0.35 ? 1 : 0.25) * (0.5 + A.shield / 200); ship.shake = Math.max(ship.shake, 0.35);
        if (Math.random() < dt * 2.5) SFX.play('strain'); if (Math.random() < dt * 3) SFX.play('shieldHit');
        if (A.t > hold) { A.ph = 'close'; A.t = 0; FU.uShield.value = 0; ship.shields = 0; SFX.play('shatter'); A.shards = { t: 0, list: [] }; for (var s = 0; s < 40; s++) A.shards.list.push({ x: Math.random(), y: Math.random(), vx: rnd(-1, 1), vy: rnd(-1, 1), r: Math.random() * 6 }); crack(0.5, 0.45, 2, 0.03); SFX.play('crack'); say('Shields down!', 'urgent'); } }
      else if (ph === 'close') { var k3 = ease(A.t / 3.4); h.position.set(0, 7, lerp(6, 14, k3)); h.scale.set(lerp(1, 0.6, k3), lerp(1, 0.6, k3), 1);
        if (A.t > 3.4) { A.ph = 'held'; A.t = 0; SFX.play('thud'); SFX.play('crack'); ship.shake = 1.0; ship.hull = Math.max(10, ship.hull - 12); V.buckle = 1; crack(0.3, 0.2, 3, 0.035); crack(0.72, 0.3, 3, 0.035); crack(0.5, 0.08, 2, 0.03); say('It has landed on the hull. Glass is buckling! Lift off, phasers, or torpedo, now!', 'urgent'); } }
      else if (ph === 'held') { var sq = 0.6 + Math.sin(A.t * 1.6) * 0.04; h.scale.set(sq, sq, 1); h.position.set(0, 7, 14); if (Math.sin(A.t * 1.6) > 0.98 && A.cool <= 0) { A.cool = 1; SFX.play('crack'); ship.shake = 0.6; crack(rnd(0.15, 0.85), rnd(0.1, 0.7), 1, 0.03); ship.hull = Math.max(8, ship.hull - 3); } A.cool -= dt; A.liftCool -= dt;
        if (A.total > DN.escapeSec + 13) { A.ph = 'gulp'; A.t = 0; SFX.play('gulp'); say('We are being swallowed.', 'urgent'); } }
      else if (ph === 'spit') { var k4 = A.t / 3.5; h.position.set(0, lerp(7, -60, k4 * k4), lerp(14, -140, k4)); h.scale.set(lerp(0.6, 1, k4), lerp(0.6, 1, k4), 1); W.camY = lerp(7, 60, ease(k4)); if (A.t < 0.3) sprayAt(0, 5, -10, 30, 60);
        if (A.t > 3.5) { h.visible = false; A.w.on = false; W.attack = null; ship.alertManual = null; V.stats.worms++; W.lamp.intensity = 0; toOrbit('We are clear and climbing. Orbit regained. Hull ' + Math.round(ship.hull) + '%. Repair crews are patching the glass.'); V.crackFade = 0.0001; } }
      else if (ph === 'gulp') { var k5 = A.t / 4; h.scale.set(lerp(0.6, 0.25, k5), lerp(0.6, 0.25, k5), 1); W.lamp.intensity = 1.6 * (1 - k5); FU.uLamp.value = 1 - k5; ship.shake = 0.6; $('atmo').style.background = '#000'; $('atmo').style.opacity = clamp(k5 * 1.2, 0, 1);
        if (A.t > 4.2) gameOver(); }
      // phaser pulses down the throat
      if (A.shots > 0) { A.shotT -= dt; if (A.shotT <= 0) { A.shots--; A.shotT = 0.45; SFX.play('phaser'); A.beams.push({ t: 0.3, x: rnd(-0.08, 0.08) }); hurtWorm(rnd(WP.phaserDmg[0], WP.phaserDmg[1])); } }
      A.beams = A.beams.filter(function (b) { b.t -= dt; return b.t > 0; });
    }
    var inside = !!(A && /shield|close|held|gulp/.test(A.ph)); W.sand.visible = !inside; W.sky.visible = !inside; W.spray.pts.visible = !inside;
    // camera: on the dunes, looking out across the sand
    var sh = ship.shake * ship.shake * 1.4, swayY = Math.sin(U.uT.value * 0.25) * 0.04;
    cam.position.set((Math.random() - 0.5) * sh, W.camY + (Math.random() - 0.5) * sh + (W.phase === 'landed' ? Math.sin(U.uT.value * 0.8) * 0.05 : 0), 0);
    var pitch = W.phase === 'descend' ? lerp(-0.55, -0.06, ease(W.t / 15)) : W.phase === 'lift' ? lerp(-0.06, 0.4, clamp(W.t / 4, 0, 1)) : -0.06;
    if (A && (A.ph === 'rise')) pitch = lerp(-0.06, 0.02, ease(A.t / 3));
    cam.rotation.set(pitch, W.yaw + swayY, (Math.random() - 0.5) * sh * 0.02, 'YXZ'); cam.fov = 62; cam.updateProjectionMatrix();
    W.sky.position.copy(cam.position); W.lamp.position.copy(cam.position);
    updateSpray(dt);
    $('gl').style.transform = V.buckle > 0 ? 'perspective(900px) rotateX(' + (1.4 * V.buckle).toFixed(2) + 'deg) rotateZ(' + (-0.5 * V.buckle).toFixed(2) + 'deg) skewX(' + (0.8 * V.buckle).toFixed(2) + 'deg) scale(' + (1 + 0.02 * V.buckle).toFixed(3) + ')' : '';
  }
  function hurtWorm(d) { var A = W.attack; if (!A || A.ph === 'spit' || A.ph === 'gulp') return; A.hp = Math.max(0, A.hp - d); dirty(); if (A.hp <= 0) spit('It is recoiling! It is spitting us out!'); }
  function spit(msg) { var A = W.attack; A.ph = 'spit'; A.t = 0; SFX.play('worm'); SFX.play('burn'); ship.shake = 0.8; V.buckle = 0.5; say(msg, 'urgent'); dirty(); }
  function escapeOK() { var A = W.attack; return A && (A.ph === 'shield' || A.ph === 'close' || A.ph === 'held' || A.ph === 'lunge'); }
  function wormPhaser() {
    var A = W.attack; if (A) { if (!escapeOK()) return; if (A.shots > 0) return; A.shots = 3; A.shotT = 0; V.stats.phasers++; say('Phasers, point blank, down its throat!', 'urgent'); return; }
    var w = W.worms.find(function (q) { return q.on; }); if (!w) { say('Nothing to shoot at but sand.', 'calm', true); return; }
    V.stats.phasers++; SFX.play('phaser'); var p = new T.Vector3(w.x, hgtJS(w.x, w.z) + 1, w.z); fxBeam(p, 0xffa040, 0.4, 2); sprayAt(w.x, p.y, w.z, 30, 30); w.scared = 6; w.hp -= 10; say('Phasers into the sand. It flinched and dove deeper.', 'alert');
  }
  function wormTorpedo() {
    if (!torps()) { SFX.play('no'); say('Torpedo bay empty.', 'urgent'); return; }
    var A = W.attack;
    if (A) { if (!escapeOK()) return; takeTorp(); say('Torpedo, down the throat!', 'urgent'); var to = camera.position.clone().add(new T.Vector3(0, 0, -120)); fxTorp(to, function () { fxBoom(to, 90, W.scene); ship.shake = 1; hurtWorm(rnd(WP.torpDmg[0], WP.torpDmg[1]) * 1.6); }); return; }
    var w = W.worms.find(function (q) { return q.on; }); if (!w) { say('Nothing to shoot at but sand.', 'calm', true); return; }
    takeTorp(); var p = new T.Vector3(w.x, hgtJS(w.x, w.z), w.z); fxTorp(p, function () { fxBoom(p, 160, W.scene); sprayAt(p.x, p.y, p.z, 80, 60); w.scared = 12; w.angry = false; say('Torpedo detonated in the sand. It is retreating.', 'alert'); });
  }
  function emergencyLift() {
    var A = W.attack; if (!A) { duneLiftoff(); return; } if (!escapeOK()) return;
    if (A.liftCool > 0) { say('Engines still cycling. ' + Math.ceil(A.liftCool) + ' seconds.', 'urgent'); return; }
    var chance = DN.liftChance + (ship.power.engines - 3) * 0.08 + (100 - A.hp) / 220;
    SFX.play('burn'); ship.shake = 0.9;
    if (Math.random() < chance || Q.has('liftok')) spit('Full burn! We are tearing free!');
    else { A.liftCool = 5; hurtWorm(10); say('Full burn, but the throat is holding. Engines cycling. Try again or hit it with weapons.', 'urgent'); }
  }
  var Q = new URLSearchParams(location.search);
  function gameOver() {
    W.attack = null; W.phase = 'over'; ship.loc = 'over'; ship.alertManual = null;
    var s = V.stats, mins = Math.round((performance.now() - s.t0) / 60000);
    V.over = { mins: mins, dist: Math.round(s.dist), trades: s.trades, torps: s.torps, phasers: s.phasers, worms: s.worms, landings: s.landings, caves: s.caves, cargo: V.cargo.length };
    var d = $('v03over'); if (!d) { d = document.createElement('div'); d.id = 'v03over'; document.body.appendChild(d); }
    d.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 45%,#3a0a0c 0%,#090203 70%);color:#ffe6d8;font-family:Fredoka,system-ui,sans-serif;text-align:center;opacity:0;transition:opacity 2.5s';
    var o = V.over, st = [['Time aboard', mins + ' min'], ['Distance flown', (o.dist / 1000).toFixed(1) + 'k km'], ['Trades made', o.trades], ['Torpedoes fired', o.torps], ['Phaser bursts', o.phasers], ['Sandworms escaped', o.worms], ['Landings', o.landings], ['Caves explored', o.caves]];
    d.innerHTML = '<div style="font-size:2.2vw;letter-spacing:.4em;color:#ff8a70">SHIP LOST</div><h1 style="font-size:6vw;margin:.2em 0;font-weight:700">SWALLOWED</h1><p style="font-size:1.6vw;opacity:.8;max-width:60vw">The ' + esc(C.TITLE.toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); })) + ' was swallowed whole by a sandworm on Sere Khamsin. Somewhere under the dunes, it is digesting your coffee machine.</p>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1.2vw 3vw;margin:2.5vw 0;font-size:1.5vw">' + st.map(function (x) { return '<div><div style="opacity:.6;font-size:1.1vw">' + x[0].toUpperCase() + '</div><b style="font-size:2.4vw">' + x[1] + '</b></div>'; }).join('') + '</div>' +
      '<p style="font-size:1.6vw;color:#ffd27a">Tap RESTART on any phone to start a fresh voyage.</p>';
    requestAnimationFrame(function () { d.style.opacity = 1; }); SFX.play('gulp'); say('Ship lost.', 'urgent'); dirty();
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function restart() {
    var d = $('v03over'); if (d) d.remove(); $('atmo').style.opacity = 0; $('gl').style.transform = '';
    W.phase = ''; W.attack = null; if (W.head) W.head.visible = false; V.over = null; resetGame();
    ship.loc = 'space'; ship.hull = 100; ship.shields = 100; ship.fuel = 100; ship.shieldsUp = true; ship.alertManual = null; ship.shake = 0; X.resetLand();
    window.SPACE.jump('home', 3); lastPos.copy(ship.pos); say('A fresh ship, a fresh voyage. Kessler Rest says hello. The coffee is still not coffee.', 'calm'); dirty();
  }

  // ================================================================== hooks
  X.ownsLoc = function () { return ship.loc === 'dunesEntry' || ship.loc === 'dunes' || ship.loc === 'over'; };
  X.scene = function () { return (ship.loc === 'dunes' || ship.loc === 'over') && W.scene ? W.scene : null; };
  X.pilot = function (dt) { return cavePilot(dt); };
  X.pre = function (me, m) {   // runs before station ownership: emergency + restart are for everyone
    if (m.a === 'restart') { if (V.over) restart(); return true; }
    if (m.a === 'escape') { if (!W.attack) return true; if (m.how === 'lift') emergencyLift(); else if (m.how === 'torp') wormTorpedo(); else wormPhaser(); return true; }
    return false;
  };
  X.act = function (me, m) {
    switch (m.a) {
      case 'lock': lockOn(String(m.id || '')); return true;
      case 'phaser': firePhaser(); return true;
      case 'torpedo': fireTorpedo(); return true;
      case 'tractor': tractor(me); return true;
      case 'trade': openTrade(); return true;
      case 'tradeOffer': offer(m); return true;
      case 'tradeAccept': if (V.trade && V.trade.counter) doTrade(V.trade.counter.give, V.trade.counter.take); return true;
      case 'tradeClose': if (V.trade) { log(V.trade.name + ': channel closed.', 'com'); V.trade = null; SFX.play('blip'); } return true;
      case 'hail': if (!X.ev().active && nearTrader()) { openTrade(); return true; } return false;
      case 'cave': caveCmd(); return true;
      case 'fire': if (ship.loc === 'dunes') { wormPhaser(); return true; } V.stats.phasers++; return false;
      case 'descend': if (ship.loc === 'space' && ship.orbit && ship.orbit.id === 'dune') { duneDescend(); return true; } return false;
      case 'liftoff': if (ship.loc === 'dunes') { if (W.attack) emergencyLift(); else duneLiftoff(); return true; } return false;
      case 'orbit': return false;
    }
    return false;
  };
  X.tick = function (dt) {
    if (ship.loc === 'space') { var dd = ship.pos.distanceTo(lastPos); if (dd < 20000) V.stats.dist += dd; }
    lastPos.copy(ship.pos);
    if (ship.loc === 'dunesEntry') { W.t += dt; var pl = H.objs.dune.position, R = X.defs.dune.r, dir = pl.clone().sub(ship.pos).normalize(); X.faceToward(dir, dt, 3); ship.pos.addScaledVector(dir, Math.max(0, ship.pos.distanceTo(pl) - R * 1.02) * dt * 0.45); ship.shake = Math.max(ship.shake, W.t / 7 * 0.3);
      var k = clamp((W.t - 3) / 5, 0, 1), ov = $('atmo'); ov.style.background = 'linear-gradient(180deg,rgba(255,150,70,' + (0.4 + k * 0.5).toFixed(2) + '),rgba(255,215,160,' + (0.5 + k * 0.5).toFixed(2) + '))'; ov.style.opacity = k;
      camera.position.copy(ship.pos); camera.quaternion.copy(ship.quat);
      if (W.t > 8) enterDunes(); }
    if (ship.loc === 'dunes' || ship.loc === 'over') updateDunes(dt);
    if (V.trade && V.trade.sid && ship.loc === 'space' && H.objs[V.trade.sid].position.distanceTo(ship.pos) > 6000) { V.trade = null; log('Trade channel lost (out of range).', 'com'); }
    if (V.lock && !targets().some(function (q) { return q.id === V.lock; })) V.lock = null;
    if (!V.lock && X.fight() && X.fight().hp > 0) V.lock = '_ev';
    if (cave && cave.st === 'gone' && cave.rock.position.distanceTo(ship.pos) > 9000) { X.sceneMain.remove(cave.rock); cave = null; }
    if (V.crackFade > 0 && !W.attack) { V.crackFade += dt; V.buckle = Math.max(0, V.buckle - dt * 0.04); if (V.crackFade > 40) { V.cracks = []; V.crackFade = 0; V.buckle = 0; $('gl').style.transform = ''; } }
    if (V.buckle > 0 && ship.loc === 'space') $('gl').style.transform = 'perspective(900px) rotateX(' + (1.4 * V.buckle).toFixed(2) + 'deg) skewX(' + (0.8 * V.buckle).toFixed(2) + 'deg)';
    updateFx(dt);
  };
  X.state = function (base) {
    var A = W.attack, n = nearTrader();
    if (ship.loc === 'dunes') base.contacts = targets().map(function (t) { return { id: t.id, k: 'life', d: t.d, tier: 'full', n: t.n, l: A ? 'INSIDE IT. ESCAPE!' : 'Seismic contact. Circling.', surf: true }; }).concat([{ id: 'poi:dune', k: 'site', d: 0, tier: 'full', n: 'Landing site: dune flat', l: 'Hot, still, quiet. Too quiet.', surf: true }]);
    var tr = V.trade;
    base.x3 = { lock: V.lock, lockName: lockName(), targets: targets(), torps: torps(), cargo: V.cargo, traderNear: n ? TR[n.id].name : null,
      trade: tr ? { name: tr.name, msg: tr.msg, mine: V.cargo, theirs: V.holds[tr.tid], counter: tr.counter, rev: tr.rev, mood: tr.mood, beaming: !!V.beam } : null,
      worm: ship.loc === 'dunes' ? { phase: W.phase, attack: A ? A.ph : null, hp: A ? Math.round(A.hp) : null, left: A ? Math.max(0, Math.round(DN.escapeSec + 13 - A.total)) : null, near: W.worms.some(function (w) { return w.on; }) } : null,
      cave: cave ? cave.st : null, over: V.over, items: null };
  };
  // ================================================================== TV overlays
  var HC = '#8fe6ff';
  X.hud = function (g, w, h, r, f, dt) {
    var A = W.attack, rw = r.x1 - r.x0, rh = r.y1 - r.y0;
    if (V.trade && !V.beam && ship.loc === 'space') { var bx = r.x0 + w * 0.02, by = r.y0 + h * 0.5, bw = w * 0.26; g.fillStyle = 'rgba(6,22,16,.6)'; g.fillRect(bx, by, bw, h * 0.13); g.strokeStyle = '#7dffb0'; g.strokeRect(bx, by, bw, h * 0.13);
      g.textAlign = 'left'; g.fillStyle = '#7dffb0'; g.font = '700 ' + f + 'px Fredoka'; g.fillText('\u21C4 TRADING \u00B7 ' + V.trade.name.toUpperCase(), bx + 12, by + f * 1.4); g.font = '500 ' + f + 'px Fredoka'; g.fillStyle = '#eafff2'; wrap(g, '\u201C' + V.trade.msg + '\u201D', bx + 12, by + f * 2.9, bw - 24, f * 1.3); }
    if (V.beam) drawBeam(g, w, h, r, f, dt);
    if (V.lock && ship.loc === 'space') { var p = targetPos(V.lock); if (p) { var pr = p.clone().project(camera); if (pr.z < 1 && Math.abs(pr.x) < 0.95 && Math.abs(pr.y) < 0.95) { var x = (pr.x + 1) / 2 * w, y = (1 - pr.y) / 2 * h, s = 30 + Math.sin(X.simT() * 4) * 4;
      g.strokeStyle = '#ff9a5a'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, s, 0, 6.283); g.moveTo(x - s - 10, y); g.lineTo(x - s + 8, y); g.moveTo(x + s + 10, y); g.lineTo(x + s - 8, y); g.moveTo(x, y - s - 10); g.lineTo(x, y - s + 8); g.moveTo(x, y + s + 10); g.lineTo(x, y + s - 8); g.stroke();
      g.fillStyle = '#ffb38a'; g.textAlign = 'center'; g.fillText('LOCKED \u00B7 ' + (lockName() || '').toUpperCase(), x, y + s + f * 1.6); } } }
    if (cave && cave.st !== 'gone') { g.fillStyle = HC; g.textAlign = 'left'; g.fillText({ approach: 'ASTEROID CAVE \u00B7 APPROACH', enter: 'ASTEROID CAVE \u00B7 ENTERING', turn: 'ASTEROID CAVE \u00B7 TURNING TO LOOK OUT', inside: 'INSIDE THE ASTEROID \u00B7 HOLDING', exit: 'LEAVING THE CAVE' }[cave.st] || '', r.x0 + w * 0.02, r.y1 - h * 0.11); }
    if (ship.loc === 'dunes' && !A && W.phase === 'landed') { var lw = W.worms.find(function (q) { return q.on; }); g.textAlign = 'left'; g.fillStyle = lw ? (lw.R < 300 ? '#ff8a70' : '#ffd27a') : HC; g.fillText(lw ? 'SEISMIC CONTACT \u00B7 ' + Math.round(lw.R) + ' m \u00B7 CIRCLING' : 'SEISMIC: QUIET', r.x0 + w * 0.02, r.y0 + h * 0.36); }
    // shields fighting the force: a flickering hex lattice over the glass
    if (A && A.ph === 'shield') { g.save(); g.beginPath(); g.rect(r.x0, r.y0, rw, rh); g.clip(); var hs = 34, t = X.simT();
      for (var yy = r.y0, row = 0; yy < r.y1 + hs; yy += hs * 0.87, row++) for (var xx = r.x0 + (row % 2) * hs * 0.75; xx < r.x1 + hs; xx += hs * 1.5) { var n = Math.sin(xx * 0.013 + t * 7.0) * Math.cos(yy * 0.017 - t * 5.3); if (n < 0.15 - (1 - A.shield / 100) * 0.4) continue; g.strokeStyle = 'rgba(110,210,255,' + (clamp(n, 0, 1) * (Math.random() < 0.2 ? 0.2 : 0.75)).toFixed(2) + ')'; g.lineWidth = 1.5; g.beginPath(); for (var k = 0; k < 6; k++) { var a = k / 6 * 6.283; g[k ? 'lineTo' : 'moveTo'](xx + Math.cos(a) * hs * 0.5, yy + Math.sin(a) * hs * 0.5); } g.closePath(); g.stroke(); }
      g.restore(); g.textAlign = 'center'; g.font = '700 ' + Math.round(f * 1.4) + 'px Fredoka'; g.fillStyle = 'rgba(140,220,255,' + (0.6 + Math.random() * 0.4).toFixed(2) + ')'; g.fillText('SHIELDS ' + Math.round(A.shield) + '% \u00B7 STRAINING', w / 2, r.y0 + h * 0.3); g.font = '500 ' + f + 'px Fredoka'; }
    if (A && A.shards) { A.shards.t += dt; var st = A.shards.t; if (st < 1.6) A.shards.list.forEach(function (s) { var x = r.x0 + (s.x + s.vx * st * 0.4) * rw, y = r.y0 + (s.y + s.vy * st * 0.4 + st * st * 0.2) * rh; g.fillStyle = 'rgba(140,220,255,' + (0.8 * (1 - st / 1.6)).toFixed(2) + ')'; g.save(); g.translate(x, y); g.rotate(s.r + st * 4); g.beginPath(); g.moveTo(0, -12); g.lineTo(10, 8); g.lineTo(-8, 6); g.closePath(); g.fill(); g.restore(); }); }
    // cracked, buckled glass
    if (V.cracks.length) { var fade = V.crackFade > 0 ? clamp(1 - (V.crackFade - 25) / 15, 0, 1) : 1; g.save(); g.beginPath(); g.rect(r.x0, r.y0, rw, rh); g.clip(); g.lineCap = 'round';
      [['rgba(0,0,0,' + (0.45 * fade).toFixed(2) + ')', 3.2, 1.5], ['rgba(235,245,255,' + (0.8 * fade).toFixed(2) + ')', 1.3, 0]].forEach(function (pass) { g.strokeStyle = pass[0]; g.lineWidth = pass[1]; g.beginPath(); V.cracks.forEach(function (c) { c.p.forEach(function (q, i) { g[i ? 'lineTo' : 'moveTo'](r.x0 + q[0] * rw + pass[2], r.y0 + q[1] * rh + pass[2]); }); }); g.stroke(); });
      if (V.buckle > 0) { var gr = g.createRadialGradient(r.x0 + rw * 0.5, r.y0, 10, r.x0 + rw * 0.5, r.y0, rh * 0.6); gr.addColorStop(0, 'rgba(255,255,255,' + (0.12 * V.buckle * fade).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(r.x0, r.y0, rw, rh); }
      g.restore(); }
    if (A && A.beams.length) A.beams.forEach(function (b) { g.strokeStyle = 'rgba(255,170,70,' + (b.t * 3).toFixed(2) + ')'; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2 + (b.x - 0.15) * w, r.y1); g.lineTo(w / 2 + b.x * w * 0.2, (r.y0 + r.y1) * 0.45); g.stroke(); });
    if (A && (A.ph === 'held' || A.ph === 'close' || A.ph === 'shield')) { var left = Math.max(0, DN.escapeSec + 13 - A.total); g.textAlign = 'center'; g.font = '700 ' + Math.round(f * 1.25) + 'px Fredoka'; g.fillStyle = 'rgba(255,110,90,' + (0.7 + 0.3 * Math.sin(X.simT() * 6)).toFixed(2) + ')';
      g.fillText('ESCAPE \u00B7 LIFT OFF \u00B7 PHASERS \u00B7 TORPEDO (' + torps() + ')  \u00B7  ' + Math.ceil(left) + ' s', w / 2, r.y1 - h * 0.13); g.font = '500 ' + f + 'px Fredoka';
      var bw2 = w * 0.2, bx2 = w / 2 - bw2 / 2, by2 = r.y1 - h * 0.11; g.fillStyle = 'rgba(80,20,20,.6)'; g.fillRect(bx2, by2, bw2, 8); g.fillStyle = '#ff6a5a'; g.fillRect(bx2, by2, bw2 * A.hp / 100, 8); g.fillStyle = '#ffb3a8'; g.fillText('SANDWORM ' + Math.round(A.hp) + '%', w / 2, by2 - 6); }
  };
  function wrap(g, text, x, y, mw, lh) { var words = String(text).split(' '), line = ''; for (var i = 0; i < words.length; i++) { var t = line + words[i] + ' '; if (g.measureText(t).width > mw && line) { g.fillText(line, x, y); y += lh; line = words[i] + ' '; } else line = t; } g.fillText(line, x, y); }

  // test hooks
  window.SPACE.v3 = { V: V, W: W, wormAttack: function () { if (ship.loc !== 'dunes') return false; W.landedT = 999; wormAttack(); return true; }, enterDunes: function () { ship.orbit = { id: 'dune', a: 0 }; enterDunes(); W.t = 14.5; }, cave: function () { return cave; }, caveCmd: caveCmd, targets: targets, lockOn: lockOn, openTrade: openTrade, offer: offer, torps: torps, gameOver: gameOver, restart: restart, spawnWorm: spawnWorm };
})();
