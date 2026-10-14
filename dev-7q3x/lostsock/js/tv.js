/* LOST SOCK v0.1 - TV host: lobby, turn-based sock artillery, 2D canvas rendering, phone networking. */
(function () {
  'use strict';
  var C = window.LS_CONFIG, WD = C.world, W = WD.W, H = WD.H, Q = new URLSearchParams(location.search), $ = function (id) { return document.getElementById(id); };
  var LOCAL = Q.get('local') === '1', NONET = Q.get('nonet') === '1', EMBED = window.parent !== window;
  var WP = {}; C.weapons.forEach(function (w) { WP[w.id] = w; });
  var game = { phase: 'lobby', players: [], bots: Q.get('bots') !== '0', teams: [], socks: [], t: 0, phaseT: 0 };
  window.LS = { game: game };
  var net = null, startedPosted = false, BOTN = ['Hamper Bot', 'Spin Bot', 'Lint Bot', 'Fluff Bot'];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function setPhase(p) { game.phase = p; game.phaseT = 0; window.ZTP_PHASE = p;
    if (p === 'play' && EMBED && !startedPosted) { startedPosted = true; try { parent.postMessage({ ztp: 'started' }, '*'); } catch (e) {} } }
  function humans() { return game.players.filter(function (p) { return !p.ai && !p.left; }); }
  function leader() { return humans().filter(function (p) { return p.connected; })[0] || null; }
  // ================================================================ terrain (1 = cloth, 0 = air)
  var mask = new Uint8Array(W * H), tcv = document.createElement('canvas'); tcv.width = W; tcv.height = H;
  var tcx = tcv.getContext('2d'), timg = null, PAL = null;
  function solid(x, y) { x |= 0; y |= 0; if (x < 0 || x >= W) return false; if (y < 0) return false; if (y >= H) return true; return mask[y * W + x] === 1; }
  function genTerrain() {
    mask.fill(0); var a = [], ph = [rnd(0, 6), rnd(0, 6), rnd(0, 6), rnd(0, 6)];
    for (var x = 0; x < W; x++) { var u = x / W;
      var h = 640 + Math.sin(u * 6.3 + ph[0]) * 140 + Math.sin(u * 15 + ph[1]) * 60 + Math.sin(u * 37 + ph[2]) * 18 - Math.sin(u * Math.PI) * 120;
      if (u < 0.04 || u > 0.96) h += 400; a.push(h); }
    for (x = 0; x < W; x++) for (var y = Math.max(0, a[x] | 0); y < H; y++) mask[y * W + x] = 1;
    for (var i = 0; i < 4; i++) { var cx = rnd(300, W - 300), cy = rnd(280, 470), rw = rnd(110, 220), rh = rnd(26, 50);   // floating cushions
      for (y = cy - rh; y < cy + rh; y++) for (x = cx - rw; x < cx + rw; x++) { var dx = (x - cx) / rw, dy = (y - cy) / rh; if (dx * dx + dy * dy < 1) mask[(y | 0) * W + (x | 0)] = 1; } }
    for (i = 0; i < 5; i++) carve(rnd(250, W - 250), rnd(800, 1000), rnd(40, 80), true);   // caves
    for (y = WD.water; y < H; y++) for (x = 0; x < W; x++) mask[y * W + x] = 0;           // rinse water eats the bottom
    PAL = [rnd(0, 360)]; timg = tcx.createImageData(W, H); paintTerrain(0, 0, W, H);
  }
  function paintTerrain(x0, y0, x1, y1) {
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1)); if (x1 <= x0 || y1 <= y0) return;
    var d = timg.data;
    for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) { var i = y * W + x, o = i * 4;
      if (!mask[i]) { d[o + 3] = 0; continue; }
      var edge = !solid(x, y - 3) || !solid(x - 3, y) || !solid(x + 3, y), top = !solid(x, y - 1) || !solid(x, y - 6);
      var g = ((((x >> 5) + (y >> 5)) & 1) ? 1 : 0) + (((x >> 5) & 1) ? 0.5 : 0) + (((y >> 5) & 1) ? 0.5 : 0);   // gingham quilt
      var r = 120 + g * 30, gg = 70 + g * 22, b = 140 + g * 25;
      if ((x + y * 3) % 11 === 0) { r += 10; gg += 10; b += 10; }
      if (top) { r = 120; gg = 210; b = 110; if (!solid(x, y - 1) && (x % 8 < 4)) { r = 245; gg = 245; b = 220; } }   // felt grass with stitches
      else if (edge) { r *= 0.6; gg *= 0.6; b *= 0.6; }
      d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255; }
    tcx.putImageData(timg, 0, 0, x0, y0, x1 - x0, y1 - y0);
  }
  function carve(cx, cy, r, quiet) {
    for (var y = Math.max(0, cy - r | 0); y < Math.min(WD.water, cy + r); y++) for (var x = Math.max(0, cx - r | 0); x < Math.min(W, cx + r); x++) { var dx = x - cx, dy = y - cy; if (dx * dx + dy * dy < r * r) mask[y * W + x] = 0; }
    if (!quiet) paintTerrain(cx - r - 8, cy - r - 8, cx + r + 8, cy + r + 8);
  }
  function stamp(cx, cy, r) {
    for (var y = Math.max(0, cy - r | 0); y < Math.min(WD.water, cy + r); y++) for (var x = Math.max(0, cx - r | 0); x < Math.min(W, cx + r); x++) { var dx = x - cx, dy = y - cy; if (dx * dx + dy * dy < r * r) mask[y * W + x] = 1; }
    paintTerrain(cx - r - 8, cy - r - 8, cx + r + 8, cy + r + 8);
  }
  function normalAt(x, y) { var nx = 0, ny = 0; for (var a = 0; a < 16; a++) { var t = a / 16 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); if (solid(x + c * 9, y + s * 9)) { nx -= c; ny -= s; } } var m = Math.hypot(nx, ny) || 1; return [nx / m, ny / m]; }
  function los(x0, y0, x1, y1) { var n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4); for (var i = 1; i < n; i++) if (solid(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false; return true; }
  // ================================================================ entities
  var mines = [], cam = { x: 1200, y: 600, z: 1 }, rings = [], projs = [], parts = [], fires = [], washers = [], decoys = [], bubbles = [], pops = [], chunks = [], shake = 0, flashes = [];
  function bubble(s, text, col) { bubbles = bubbles.filter(function (b) { return b.s !== s; }); bubbles.push({ s: s, x: s.x, y: s.y, text: text, t: 2.6, col: col || '#fff' }); }
  function pop(x, y, text, col) { pops.push({ x: x, y: y, text: text, col: col || '#fff', t: 1.6 }); }
  function feed(t) { (game.feed = game.feed || []).push({ t: t, at: performance.now() }); if (game.feed.length > 6) game.feed.shift(); }
  function banner(t, sec) { game.banner = t; game.bannerT = sec || 2; }
  function cond(s) { return !s.alive ? 'lost' : s.hp > 66 ? 'pristine' : s.hp > 33 ? 'tattered' : 'shredded'; }
  function makeSock(team, i, x) { return { team: team, name: C.sockNames[(team.idx * 3 + i) % C.sockNames.length], x: x, y: 0, vx: 0, vy: 0, hp: C.hp, alive: true, face: 1, aim: -0.6, ground: false, dizzy: 0, spin: 0, dying: null, wob: rnd(0, 6), stuffT: 0, maxVy: 0 }; }
  function dropSpot(x) { for (var y = 40; y < WD.water; y++) if (solid(x, y)) return y - 1; return -1; }
  function hurt(s, dmg, src, why) {
    if (!s.alive || s.dying || dmg <= 0) return; dmg = Math.round(dmg);
    var before = cond(s); s.hp -= dmg; pop(s.x, s.y - 50, '-' + dmg, s.team.color);
    if (src && src !== s.team) src.dmg += dmg; s.team.taken += dmg;
    if (s.hp <= 0) { var over = -s.hp; if (src && src !== s.team) src.kos++;
      s.dying = { kind: over <= C.dopeyOverkill ? 'dopey' : 'boom', t: 0 };
      if (s.dying.kind === 'dopey') bubble(s, ['duhhh\u2026', 'is it laundry day?', 'I see lint\u2026', 'mama?'][Math.floor(Math.random() * 4)]);
      feed(s.name + (s.dying.kind === 'dopey' ? ' unravelled' : ' blew into fuzz') + (why ? ' (' + why + ')' : ''));
    } else if (cond(s) !== before) { pop(s.x, s.y - 74, cond(s).toUpperCase() + '!', '#ffe7a0'); if (cond(s) === 'shredded') bubble(s, 'my stuffing!'); }
  }
  function explode(x, y, r, dmg, src, why, soapy) {
    carve(x, y, r); shake = Math.max(shake, r / 5); flashes.push({ x: x, y: y, r: r * 1.8, t: 0.45 }); rings.push({ x: x, y: y, R: r * 2.2, t: 0.45, max: 0.45 });
    for (var sm = 0; sm < r / 8; sm++) parts.push({ x: x + rnd(-r, r) * 0.4, y: y + rnd(-r, r) * 0.4, vx: rnd(-40, 40), vy: rnd(-90, -20), t: rnd(1, 2), k: 'smoke', s: rnd(r * 0.25, r * 0.5) });
    mines.forEach(function (m) { if (Math.hypot(m.x - x, m.y - y) < r + 10 && !m.fuse) m.fuse = 0.15; });
    var n = Math.min(70, r | 0);
    for (var i = 0; i < n; i++) { var a = rnd(0, 6.28), v = rnd(80, 420) * r / 60; parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: rnd(0.6, 1.6), k: soapy ? 'bub' : 'spark', s: rnd(4, 12) * (soapy ? 1.4 : 1) }); }
    for (i = 0; i < Math.min(10, r / 10 | 0); i++) { var b = rnd(-2.6, -0.5); chunks.push({ x: x + rnd(-r, r) * 0.5, y: y - r * 0.3, vx: Math.cos(b) * rnd(100, 340), vy: Math.sin(b) * rnd(150, 420), r: rnd(5, 11), rest: 0 }); }
    game.socks.forEach(function (s) { if (!s.alive) return; var dx = s.x - x, dy = (s.y - 18) - y, d = Math.hypot(dx, dy), R = r * 1.35;
      if (d < R) { var f = 1 - d / R; hurt(s, dmg * (0.35 + 0.65 * f), src, why); s.vx += dx / (d || 1) * 420 * f * r / 60; s.vy += (dy / (d || 1) - 0.8) * 380 * f * r / 60; s.ground = false; } });
    washers.forEach(function (w) { if (Math.hypot(w.x - x, w.y - y) < r + 20) { w.vy -= 200; w.ground = false; } });
  }
  // ================================================================ match
  function startMatch() {
    if (game.phase === 'play') return;
    game.players = game.players.filter(function (p) { return !p.ai && !p.left; });
    var want = clamp(+Q.get('fill') || 2, 2, 4);
    if (game.bots) while (game.players.length < want) game.players.push({ id: 'ai' + game.players.length, ai: true, name: BOTN[game.players.length] });
    if (game.players.length < 2) { game.flash = 'Need at least 2 teams (turn AI fill on)'; game.flashAt = performance.now(); return; }
    genTerrain(); mines = []; projs = []; parts = []; fires = []; washers = []; decoys = []; bubbles = []; pops = []; chunks = []; game.feed = [];
    game.teams = game.players.slice(0, C.maxTeams).map(function (p, i) { var t = { idx: i, p: p, name: p.ai ? p.name : (p.name + "'s " + C.teamNames[i]), color: C.teamColors[i], socks: [], cur: 0, used: {}, dmg: 0, kos: 0, taken: 0, lost: 0 }; p.team = t; return t; });
    game.socks = []; var spots = [];
    var n = game.teams.length * C.socksPerTeam;
    for (var i = 0; i < n; i++) { var x, y, tries = 0; do { x = rnd(160, W - 160); y = dropSpot(x); tries++; } while ((y < 0 || spots.some(function (q) { return Math.abs(q - x) < 120; })) && tries < 200); spots.push(x); }
    spots.sort(function () { return Math.random() - 0.5; });
    game.teams.forEach(function (t, ti) { for (var k = 0; k < C.socksPerTeam; k++) { var s = makeSock(t, k, spots[ti * C.socksPerTeam + k]); s.y = 60; t.socks.push(s); game.socks.push(s); } });
    game.turnTeam = -1; game.wind = 0; setPhase('play'); nextTurn();
  }
  function aliveTeams() { return game.teams.filter(function (t) { return t.socks.some(function (s) { return s.alive; }); }); }
  function nextTurn() {
    var at = aliveTeams(); if (at.length <= 1) { endMatch(at[0]); return; }
    var i = game.turnTeam; do { i = (i + 1) % game.teams.length; } while (!game.teams[i].socks.some(function (s) { return s.alive; }));
    game.turnTeam = i; var t = game.teams[i], k = t.cur;
    for (var j = 0; j < t.socks.length; j++) { k = (k + 1) % t.socks.length; if (t.socks[k].alive) break; } t.cur = k;
    game.active = t.socks[k]; game.state = 'aim'; game.turnT = C.turnSec; game.weapon = game.weapon || 'bazooka'; game.power = 0.6; game.fired = false;
    game.wind = clamp(game.wind * 0.4 + rnd(-0.8, 0.8), -C.windMax, C.windMax);
    if (!t.p.ai) { var w = t.p.weapon || 'bazooka'; game.weapon = canUse(t, w) ? w : 'bazooka'; game.power = t.p.power || 0.6; } else game.weapon = 'bazooka';
    game.ai = isAi(t) ? { t: 0, plan: null } : null;
    banner(game.active.name + ' \u00b7 ' + t.name, 1.6); bubble(game.active, ['my turn!', 'sock it to \u2019em', 'smells like victory', 'ready to rumble'][Math.floor(Math.random() * 4)]);
    if (game.active.dizzy > 0) { bubble(game.active, 'whoaaa, dizzy\u2026'); game.active.dizzy--; game.dizzyNow = true; } else game.dizzyNow = false;
  }
  function isAi(t) { var p = t.p; return p.ai || p.left || (!p.connected && performance.now() - (p.goneAt || 0) > C.aiCoverSec * 1000); }
  function canUse(t, w) { return WP[w] && (!WP[w].limit || (t.used[w] || 0) < WP[w].limit); }
  function endMatch(win) { game.winner = win || null; setPhase('over'); banner(win ? win.name + ' WIN!' : 'Everyone got lost\u2026', 4); showOver(); }
  function toLobby() { setPhase('lobby'); game.players = game.players.filter(function (p) { return !p.ai && !p.left; }); game.players.forEach(function (p) { p.team = null; }); }
  // ================================================================ actions
  function aimVec(s) { return [Math.cos(s.aim) * s.face, Math.sin(s.aim)]; }
  function fire() {
    var s = game.active, t = s.team, w = game.weapon, W0 = WP[w]; if (game.state !== 'aim' || !s || !s.alive || s.dying) return;
    if (!canUse(t, w)) { bubble(s, 'all out of those!'); return; }
    var a = s.aim + (game.dizzyNow ? rnd(-0.25, 0.25) : 0), v = [Math.cos(a) * s.face, Math.sin(a)], px = s.x + v[0] * 26, py = s.y - 24 + v[1] * 26, pw = clamp(game.power, 0.1, 1);
    if (w === 'decoy') { var tgt = nearestEnemy(s, true); if (!tgt) { bubble(s, "can't see anyone to fool!"); return; }
      bubble(s, '*snip snip* *dab dab*'); decoys.push({ x: s.x + s.face * 20, y: s.y, vx: 0, vy: 0, dir: tgt.x > s.x ? 1 : -1, t: 0, team: t, color: t.color, lured: null, ground: false, built: 0 }); }
    else if (w === 'washer') { var wx = s.x + s.face * 46, wy = s.y - 30; washers.push({ x: wx, y: wy, vy: 0, ground: false, team: t, cool: 0, uses: 2, spin: 0 }); bubble(s, 'fresh load!'); }
    else if (w === 'mine') { mines.push({ x: s.x + s.face * 36, y: s.y - 20, vy: 0, ground: false, team: t, t: 0, fuse: 0 }); bubble(s, 'dirty laundry, anyone?'); }
    else if (w === 'airstrike') { var ax0 = clamp(s.x + s.face * (120 + pw * 1000), 80, W - 80); for (var ii = 0; ii < W0.n; ii++) projs.push({ k: 'iron', x: ax0 + (ii - 2) * 46 - s.face * 300, y: -60 - ii * 50, vx: s.face * 160, vy: 200, t: 0.2, team: t, spin: 0 }); banner('IRON AIRSTRIKE!', 1.2); bubble(s, 'pressing matters!'); }
    else if (w === 'mgun') { game.mg = { n: W0.shots, t: 0 }; }
    else if (w === 'drill') { game.drill = { t: W0.dur }; bubble(s, 'SPIN CYCLE!'); }
    else projs.push({ k: w, x: px, y: py, vx: v[0] * W0.speed * pw, vy: v[1] * W0.speed * pw, fuse: W0.fuse || 0, t: 0, team: t, spin: 0 });
    t.used[w] = (t.used[w] || 0) + 1; game.fired = true; game.state = 'retreat'; game.retreatT = C.retreatSec + (w === 'drill' ? WP.drill.dur : w === 'mgun' ? 1.2 : 0);
    if (w === 'holy') banner('HALLELUJAH-ish\u2026', 1.2);
  }
  function nearestEnemy(s, needLos) { var b = null, bd = 1e9; game.socks.forEach(function (o) { if (!o.alive || o.dying || o.team === s.team) return; var d = Math.hypot(o.x - s.x, o.y - s.y); if (d < bd && (!needLos || los(s.x, s.y - 20, o.x, o.y - 20))) { bd = d; b = o; } }); return b; }
  function jump(s) { if (s && s.ground && !s.dying) { s.vx = C.jump[0] * s.face; s.vy = C.jump[1]; s.ground = false; } }
  // ================================================================ simulation
  function moveSock(s, dir, dt) {
    if (!s.ground || !dir) return; s.face = dir > 0 ? 1 : -1;
    var nx = s.x + s.face * C.walk * Math.abs(dir) * dt * (cond(s) === 'shredded' ? 0.55 : 1), ny = null;
    for (var up = -8; up <= 8; up++) if (!solid(nx, s.y + up) && solid(nx, s.y + up + 1)) { ny = s.y + up; break; }
    if (ny === null) { if (!solid(nx, s.y) && !solid(nx, s.y - 20)) { s.x = nx; s.ground = false; } return; }
    if (solid(nx, ny - 26)) return; s.x = nx; s.y = ny;
  }
  function physSock(s, dt) {
    if (s.ground && !solid(s.x, s.y + 1) && !solid(s.x - 4, s.y + 1) && !solid(s.x + 4, s.y + 1)) s.ground = false;
    if (s.ground) return;
    s.vy += C.grav * dt; s.vx *= 0.995;
    var steps = Math.ceil(Math.hypot(s.vx, s.vy) * dt / 3) || 1;
    for (var i = 0; i < steps; i++) {
      var nx = s.x + s.vx * dt / steps, ny = s.y + s.vy * dt / steps;
      if (solid(nx, ny - 14)) { s.vx *= -0.35; nx = s.x; }
      if (solid(nx, ny)) { if (s.vy > 0) { var hit = s.vy; s.vy = 0; s.vx *= 0.3; if (Math.abs(s.vx) < 40) { s.vx = 0; s.ground = true; } while (solid(nx, ny) && ny > 0) ny--; s.x = nx; s.y = ny;
          if (hit > C.fallSafe) hurt(s, (hit - C.fallSafe) * C.fallDmg, null, 'fall'); if (s.ground) return; } else { s.vy = 30; ny = s.y; } }
      s.x = clamp(nx, 4, W - 4); s.y = ny;
    }
    if (s.y > WD.water + 10 && s.alive) { s.alive = false; s.dying = null; s.lostAt = game.t; s.team.lost++; feed(s.name + ' became a LOST SOCK'); pop(s.x, WD.water - 40, 'LOST SOCK!', '#9fd8ff'); s.tomb = false; s.drowned = true; }
  }
  function sim(dt) {
    game.t += dt;
    var s = game.active;
    if (game.state === 'aim' || game.state === 'retreat') {
      if (game.state === 'aim') { game.turnT -= dt; if (game.turnT <= 0) { bubble(s, 'out of time!'); game.state = 'settle'; game.settleT = 0; } }
      else { game.retreatT -= dt; if (game.retreatT <= 0) { game.state = 'settle'; game.settleT = 0; } }
      if (s && s.alive && !s.dying) {
        var inp = game.inp || { mx: 0, ay: 0 };
        if (game.ai) aiStep(dt);
        else { if (!game.drill) moveSock(s, inp.mx, dt); s.aim = clamp(s.aim + inp.ay * 1.6 * dt, -1.5, 1.5); }
      }
      if (s && (!s.alive || s.dying) && game.state !== 'settle') { game.state = 'settle'; game.settleT = 0; }
    }
    if (game.mg && s && s.alive) { game.mg.t -= dt; if (game.mg.t <= 0 && game.mg.n > 0) { game.mg.n--; game.mg.t = 0.08; var v = aimVec(s), a = s.aim + rnd(-0.05, 0.05);
        projs.push({ k: 'mgun', x: s.x + v[0] * 24, y: s.y - 24 + v[1] * 24, vx: Math.cos(a) * s.face * WP.mgun.speed, vy: Math.sin(a) * WP.mgun.speed, t: 0, team: s.team }); } if (game.mg.n <= 0) game.mg = null; }
    if (game.drill && s && s.alive) { game.drill.t -= dt; var dv = aimVec(s); s.ground = false; s.vx = dv[0] * 70; s.vy = dv[1] * 70; s.x = clamp(s.x + s.vx * dt, 10, W - 10); s.y += s.vy * dt; carve(s.x, s.y - 18, 24); s.spin += dt * 20; shake = Math.max(shake, 2);
      if (Math.random() < 0.5) parts.push({ x: s.x, y: s.y - 18, vx: rnd(-150, 150), vy: rnd(-200, -50), t: 0.6, k: 'bub', s: 5 });
      if (game.drill.t <= 0) { game.drill = null; s.vx = 0; s.vy = 0; } }
    game.socks.forEach(function (o) { if (o.alive && !(game.drill && o === s)) physSock(o, dt);
      if (o.dying) { o.dying.t += dt; var D = o.dying;
        if (D.kind === 'boom' && !D.done) { D.done = true; for (var i = 0; i < 40; i++) { var a = rnd(0, 6.28), v = rnd(60, 380); parts.push({ x: o.x, y: o.y - 18, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, t: rnd(1, 2.2), k: 'fuzz', s: rnd(4, 10), c: o.team.color }); } o.dieAt = 0.3; explode(o.x, o.y - 10, 22, 8, null, 'chain'); }
        if (D.t > (D.kind === 'dopey' ? 2.2 : 0.3)) { o.alive = false; o.tomb = true; o.dying = null; o.team.lost++; } }
      if (o.alive && cond(o) === 'shredded') { o.stuffT -= dt; if (o.stuffT <= 0) { o.stuffT = rnd(0.25, 0.6); parts.push({ x: o.x - o.face * 6, y: o.y - 10, vx: rnd(-20, 20), vy: rnd(-30, 0), t: 1.4, k: 'stuff', s: rnd(3, 6) }); } } });
    projs = projs.filter(function (p) { var W0 = WP[p.k === 'blet' ? 'mortar' : p.k === 'iron' ? 'airstrike' : p.k] || {}; p.t += dt;
      if (W0.wind) p.vx += game.wind * C.windAcc * W0.wind * dt; if (p.k !== 'mgun') p.vy += C.grav * dt;
      p.spin += dt * 8;
      var steps = Math.ceil(Math.hypot(p.vx, p.vy) * dt / 3) || 1;
      for (var i = 0; i < steps; i++) { var nx = p.x + p.vx * dt / steps, ny = p.y + p.vy * dt / steps;
        var hitS = p.t > 0.08 && game.socks.some(function (o) { return o.alive && !o.dying && Math.abs(o.x - nx) < 10 && ny < o.y && ny > o.y - 36; });
        if (solid(nx, ny) || hitS) {
          if (p.k === 'holy' && !hitS) { var n = normalAt(nx, ny), d = p.vx * n[0] + p.vy * n[1]; p.vx = (p.vx - 2 * d * n[0]) * 0.55; p.vy = (p.vy - 2 * d * n[1]) * 0.55; break; }
          if (p.k === 'molotov') { explode(nx, ny, W0.r, W0.dmg, p.team, 'hot sauce'); for (var f = 0; f < 9; f++) fires.push({ x: nx + rnd(-30, 30), y: ny - 10, vx: rnd(-120, 120), vy: rnd(-200, -60), life: 3, team: p.team, tick: 0 }); return false; }
          if (p.k === 'dryer') { dryerBlast(nx, ny, p.team); return false; }
          if (p.k === 'mortar') { explode(nx, ny, W0.r, W0.dmg, p.team, 'softener', true); for (var bl = 0; bl < W0.blets; bl++) projs.push({ k: 'blet', x: nx, y: ny - 20, vx: rnd(-260, 260), vy: rnd(-520, -320), t: 0.1, team: p.team, spin: 0 }); return false; }
          if (p.k === 'blet') { explode(nx, ny, WP.mortar.br, WP.mortar.bdmg, p.team, 'softener', true); return false; }
          if (p.k === 'iron') { explode(nx, ny, W0.r, W0.dmg, p.team, 'ironed flat'); for (var st2 = 0; st2 < 10; st2++) parts.push({ x: nx, y: ny, vx: rnd(-120, 120), vy: rnd(-260, -80), t: 1.2, k: 'smoke', s: rnd(8, 18) }); return false; }
          explode(nx, ny, W0.r, W0.dmg, p.team, W0.name.toLowerCase(), p.k === 'bazooka'); if (p.k === 'bazooka') bubbleAt(nx, ny); return false; }
        p.x = nx; p.y = ny; }
      if (p.k === 'holy') { p.fuse -= dt; if (p.fuse <= 0) { explode(p.x, p.y, W0.r, W0.dmg, p.team, 'blessed', true); banner('HALLELUJAH!', 1.5); return false; } }
      if (p.k === 'bazooka' && Math.random() < 0.6) parts.push({ x: p.x, y: p.y, vx: rnd(-20, 20), vy: rnd(-20, 20), t: 0.7, k: 'bub', s: rnd(3, 7) });
      return p.x > -200 && p.x < W + 200 && p.y < H + 50 && p.t < 20; });
    fires.forEach(function (f) { if (f.vy !== 0 || !solid(f.x, f.y + 1)) { f.vy += C.grav * dt; var ny = f.y + f.vy * dt, nx = f.x + f.vx * dt; if (solid(nx, ny)) { f.vy = 0; f.vx = 0; while (solid(nx, ny)) ny--; } f.x = nx; f.y = ny; }
      if (game.state === 'aim' || game.state === 'retreat' || game.state === 'settle') { f.tick -= dt; if (f.tick <= 0) { f.tick = 0.35; game.socks.forEach(function (o) { if (o.alive && !o.dying && Math.abs(o.x - f.x) < 12 && Math.abs(o.y - f.y) < 16) { hurt(o, 3, f.team, 'burnt'); o.vx = (o.x < f.x ? -1 : 1) * 60; o.vy = -120; o.ground = false; } }); } } });
    fires = fires.filter(function (f) { return f.life > 0 && f.y < WD.water; });
    washers.forEach(function (w) { if (!w.ground) { w.vy += C.grav * dt; var ny = w.y + w.vy * dt; if (solid(w.x, ny + 24)) { w.vy = 0; w.ground = true; while (solid(w.x, ny + 24)) ny--; } w.y = ny; } else if (!solid(w.x, w.y + 25)) w.ground = false;
      w.cool -= dt; w.spin += dt * (w.cool > 0 ? 25 : 2);
      if (w.cool <= 0 && w.uses > 0) game.socks.forEach(function (o) { if (w.cool > 0 || !o.alive || o.dying || (o === game.active && game.state === 'aim' && game.fired === false && w.team === o.team && game.t - (w.born || 0) < 0)) return;
        if (Math.abs(o.x - w.x) < 26 && Math.abs((o.y - 18) - w.y) < 34 && (o.ground || o.vy > 0)) { w.cool = 1.2; w.uses--; bubble(o, 'SPIN CYCLE?! nooo\u2026');
          o.x = w.x; o.y = w.y; o.vx = rnd(-1, 1) > 0 ? rnd(260, 420) : -rnd(260, 420); o.vy = -rnd(380, 520); o.ground = false; o.dizzy = 1; hurt(o, WP.washer.dmg, w.team, 'spin-cycled');
          for (var i = 0; i < 24; i++) parts.push({ x: w.x, y: w.y, vx: rnd(-200, 200), vy: rnd(-300, -50), t: 1.2, k: 'bub', s: rnd(4, 9) }); } }); });
    washers = washers.filter(function (w) { return w.y < WD.water && (w.uses > 0 || w.cool > 0); });
    mines.forEach(function (m) { m.t += dt; if (!m.ground) { m.vy += C.grav * dt; var ny = m.y + m.vy * dt; if (solid(m.x, ny + 14)) { m.vy = 0; m.ground = true; while (solid(m.x, ny + 14)) ny--; } m.y = ny; } else if (!solid(m.x, m.y + 15)) m.ground = false;
      if (!m.fuse && m.t > WP.mine.arm && game.socks.some(function (o) { return o.alive && !o.dying && Math.hypot(o.x - m.x, o.y - 14 - m.y) < WP.mine.trig; })) { m.fuse = 1; var vic = game.socks.filter(function (o) { return o.alive && Math.hypot(o.x - m.x, o.y - 14 - m.y) < WP.mine.trig; })[0]; if (vic) bubble(vic, 'is that\u2026 beeping?'); }
      if (m.fuse) { m.fuse -= dt; if (m.fuse <= 0) { m.dead = true; explode(m.x, m.y, WP.mine.r, WP.mine.dmg, m.team, 'hamper mine', true); } } if (m.y > WD.water) m.dead = true; });
    mines = mines.filter(function (m) { return !m.dead; });
    decoys.forEach(function (d) { var pt = d.t; d.t += dt; d.built = Math.min(1, d.t / 1.6);
      if (pt < 0.8 && d.t >= 0.8 && game.active) bubble(game.active, '*dab dab* \uD83C\uDFA8');
      if (pt < 1.6 && d.t >= 1.6) { if (game.active) bubble(game.active, "go get 'em, sweetie"); bubbles.push({ s: null, x: d.x, y: d.y, text: 'hey there \u2665', t: 2, col: '#ffd0e0' }); }
      if (d.built < 1 && Math.random() < 0.5) parts.push({ x: d.x + rnd(-14, 14), y: d.y - rnd(0, 50) * d.built, vx: rnd(-60, 60), vy: rnd(-80, 0), t: 0.6, k: 'paint', s: rnd(3, 6), c: d.color });
      if (!d.ground) { d.vy += C.grav * dt; var ny = d.y + d.vy * dt; if (solid(d.x, ny)) { d.vy = 0; d.ground = true; while (solid(d.x, ny)) ny--; } d.y = ny; }
      else if (d.built >= 1) { var nx = d.x + d.dir * WP.decoy.speed * dt, ok = null; for (var up = -8; up <= 8; up++) if (!solid(nx, d.y + up) && solid(nx, d.y + up + 1)) { ok = d.y + up; break; }
        if (ok !== null && !solid(nx, ok - 26)) { d.x = nx; d.y = ok; } else if (ok === null && !solid(nx, d.y)) { d.x = nx; d.ground = false; } else if (Math.random() < dt) d.dir = -d.dir; }
      if (!d.lured) { var en = null, bd = WP.decoy.lure; game.socks.forEach(function (o) { if (o.alive && !o.dying && o.team !== d.team) { var dd = Math.hypot(o.x - d.x, o.y - d.y); if (dd < bd) { bd = dd; en = o; } } });
        if (en) { d.lured = en; d.fuseT = 1.8; bubble(en, 'MY OTHER HALF!', '#ffd0e0'); game.socks.forEach(function (o) { if (o !== en && o.alive && !o.dying && o.team === en.team && Math.hypot(o.x - en.x, o.y - en.y) < 400) bubble(o, "IT'S A TRAP!", '#ffe7a0'); }); } }
      if (d.lured) { var L = d.lured; if (L.alive && L.ground) { var dir = d.x > L.x ? 1 : -1; moveSock(L, dir * 2.2, dt); } d.fuseT -= dt; if (d.fuseT <= 0) d.dead = true; }
      if (d.t > WP.decoy.fuse + 1.6 || d.y > WD.water) d.dead = true;
      if (d.dead) { explode(d.x, d.y - 16, WP.decoy.r, WP.decoy.dmg, d.team, 'mismatched pair', true); banner('IT WAS A TRAP!', 1.2); } });
    decoys = decoys.filter(function (d) { return !d.dead; });
    chunks.forEach(function (c) { c.vy += C.grav * dt; var nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
      if (solid(nx, ny + c.r)) { var n = normalAt(nx, ny + c.r); c.vy = -Math.abs(c.vy) * 0.25; c.vx = c.vx * 0.7 + n[0] * 60; if (Math.abs(c.vy) < 30) { c.vy = 0; c.vx += n[0] * 120 * dt * 10; c.rest += dt; } ny = c.y; if (solid(nx, ny + c.r)) nx = c.x; }
      c.x = nx; c.y = ny; if (c.rest > 0.5 || (Math.abs(c.vx) < 8 && c.rest > 0.15)) { c.done = true; if (solid(c.x, c.y + c.r + 2) && solid(c.x - c.r, c.y + c.r + 3) && solid(c.x + c.r, c.y + c.r + 3)) stamp(c.x, c.y + 2, c.r * 0.8); } if (c.y > WD.water) c.done = true; });
    chunks = chunks.filter(function (c) { return !c.done; });
    parts.forEach(function (p) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.k === 'bub' ? -40 : p.k === 'smoke' ? -30 : p.k === 'paint' ? 300 : p.k === 'fuzz' || p.k === 'stuff' ? 160 : 500) * dt; p.vx *= 0.98; if ((p.k === 'fuzz' || p.k === 'stuff') && solid(p.x, p.y)) { p.vx = 0; p.vy = 0; } });
    parts = parts.filter(function (p) { return p.t > 0; });
    bubbles.forEach(function (b) { b.t -= dt; }); bubbles = bubbles.filter(function (b) { return b.t > 0; });
    pops.forEach(function (b) { b.t -= dt; b.y -= 30 * dt; }); pops = pops.filter(function (b) { return b.t > 0; });
    rings.forEach(function (r) { r.t -= dt; }); rings = rings.filter(function (r) { return r.t > 0; });
    flashes.forEach(function (f) { f.t -= dt; }); flashes = flashes.filter(function (f) { return f.t > 0; });
    if (game.state === 'settle') { game.settleT += dt;
      var busy = projs.length || decoys.length || mines.some(function (m) { return m.fuse > 0 || !m.ground; }) || game.mg || game.drill || chunks.length || game.socks.some(function (o) { return o.dying || (o.alive && !o.ground); });
      if ((!busy && game.settleT > 0.8) || game.settleT > C.settleMaxSec) { fires.forEach(function (f) { f.life--; }); game.state = 'next'; setTimeout(function () { if (game.phase === 'play') nextTurn(); }, 300); } }
    if (game.bannerT > 0) game.bannerT -= dt;
  }
  function bubbleAt() {}
  function dryerBlast(x, y, team) { var D = WP.dryer; explode(x, y, D.r, D.dmg, team, 'dryer bomb', true); banner('TUMBLE DRY!', 1.2);
    D.rings.forEach(function (R, i) { rings.push({ x: x, y: y, R: R, t: 0.5 + i * 0.15, max: 0.5 + i * 0.15 }); });
    game.socks.forEach(function (s) { if (!s.alive || s.dying) return; var dx = s.x - x, dy = s.y - 18 - y, d = Math.hypot(dx, dy) || 1, i = D.rings.findIndex(function (R) { return d < R; }); if (i < 0) return;
      s.vx += dx / d * D.push[i]; s.vy += (dy / d - 0.6) * D.push[i]; s.ground = false; if (i < 2) { s.size = Math.max(0.5, (s.size || 1) - (i ? 0.15 : 0.3)); bubble(s, 'I SHRANK!'); } }); }
  // ================================================================ AI
  function simShot(x, y, vx, vy, wind, tgt) {
    var dt = 1 / 60, best = 1e9;
    for (var i = 0; i < 360; i++) { vx += wind * dt; vy += C.grav * dt; x += vx * dt; y += vy * dt;
      var d = Math.hypot(x - tgt.x, y - (tgt.y - 18)); if (d < best) best = d;
      if (x < 0 || x > W || y > WD.water) return { d: best + 300, x: x, y: y };
      if (solid(x, y)) return { d: Math.hypot(x - tgt.x, y - (tgt.y - 18)), x: x, y: y }; }
    return { d: best + 200 };
  }
  function aiStep(dt) {
    var A = game.ai, s = game.active; A.t += dt; if (A.t < 1.2) return;
    if (!A.plan) {
      var tgt = nearestEnemy(s, false); if (!tgt) { game.state = 'settle'; game.settleT = 0; return; }
      var best = { d: 1e9 }, wind = game.wind * C.windAcc;
      for (var face = -1; face <= 1; face += 2) for (var a = -1.45; a <= 0.6; a += 0.08) for (var pw = 0.3; pw <= 1.001; pw += 0.05) {
        var v = WP.bazooka.speed * pw, r = simShot(s.x + Math.cos(a) * face * 26, s.y - 24 + Math.sin(a) * 26, Math.cos(a) * face * v, Math.sin(a) * v, wind, tgt);
        if (Math.hypot(r.x - s.x, r.y - s.y) < 70) r.d += 500;   // don't blow yourself up
        if (r.d < best.d) best = { d: r.d, face: face, a: a, pw: pw }; }
      var w = 'bazooka', near = Math.hypot(tgt.x - s.x, tgt.y - s.y), seen = los(s.x, s.y - 20, tgt.x, tgt.y - 20);
      var cluster = game.socks.filter(function (o) { return o.alive && o.team !== s.team && Math.hypot(o.x - tgt.x, o.y - tgt.y) < 140; }).length;
      if (cluster >= 2 && canUse(s.team, 'holy') && best.d < 90) w = 'holy';
      else if (seen && near < 650 && Math.random() < 0.3) { w = 'mgun'; best = { d: 0, face: tgt.x > s.x ? 1 : -1, a: Math.atan2(tgt.y - s.y, Math.abs(tgt.x - s.x)), pw: 1 }; }
      else if (seen && near > 400 && canUse(s.team, 'decoy') && Math.random() < 0.15) w = 'decoy';
      else if (best.d > 120 && canUse(s.team, 'airstrike') && Math.abs(tgt.x - s.x) > 160) { w = 'airstrike'; best = { d: 0, face: tgt.x > s.x ? 1 : -1, a: -0.5, pw: clamp((Math.abs(tgt.x - s.x) - 120) / 1000, 0.05, 1) }; }
      else if (best.d < 100 && cluster >= 1 && Math.random() < 0.35) w = 'mortar';
      else if (best.d > 120 && Math.random() < 0.4) w = Math.random() < 0.5 ? 'washer' : 'mine';
      var err = game.dizzyNow ? 0.12 : 0.04;
      A.plan = { w: w, face: best.face, a: best.a + rnd(-err, err), pw: clamp(best.pw + rnd(-0.03, 0.03), 0.2, 1) };
      if (w === 'holy') A.plan.pw *= 0.85;
    }
    var P = A.plan; s.face = P.face; game.weapon = P.w; game.power = P.pw; s.aim += clamp(P.a - s.aim, -1.2 * dt, 1.2 * dt);
    if (Math.abs(s.aim - P.a) < 0.02 && A.t > 2.2) fire();
  }
  // ================================================================ rendering
  var cv = $('cv'), cx = cv.getContext('2d'), scale = 1, offX = 0, offY = 0, clouds = [];
  for (var ci = 0; ci < 8; ci++) clouds.push({ x: rnd(0, W), y: rnd(60, 360), s: rnd(0.6, 1.4) });
  function resize() { var d = window.devicePixelRatio || 1; cv.width = innerWidth * d; cv.height = innerHeight * d; }
  addEventListener('resize', resize); resize();
  function drawSock(s, x, y, extra) {
    var c = cx, col = s.team.color, cd = s.alive ? cond(s) : 'pristine', D = s.dying, wob = Math.sin(game.t * 3 + s.wob);
    c.save(); c.translate(x, y);
    var lean = cd === 'shredded' ? Math.sin(game.t * 5 + s.wob) * 0.18 + 0.12 * s.face : cd === 'tattered' ? wob * 0.04 : wob * 0.02;
    var sc = (s.size || 1) * 1.3;
    if (D && D.kind === 'dopey') { lean = Math.sin(D.t * 9) * 0.5; sc *= Math.max(0.15, 1 - D.t / 2.2); }
    if (s.spin) { c.rotate(s.spin); }
    c.rotate(lean); c.scale(s.face * sc, sc);
    // foot + leg tube
    c.fillStyle = col; c.strokeStyle = '#1a1020'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-9, -40); c.lineTo(9, -40); c.lineTo(9, -10); c.quadraticCurveTo(9, 0, 20, 0); c.lineTo(20, 0); c.quadraticCurveTo(26, 0, 24, -6);
    c.lineTo(22, -10); c.quadraticCurveTo(14, -12, 12, -16); c.lineTo(-9, -16); c.closePath();
    c.beginPath(); c.moveTo(-9, -42); c.lineTo(-9, -6); c.quadraticCurveTo(-9, 0, -2, 0); c.lineTo(18, 0); c.quadraticCurveTo(25, 0, 24, -6); c.quadraticCurveTo(22, -12, 10, -12); c.lineTo(9, -42); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff8'; c.fillRect(-9, -38, 18, 3); c.fillRect(-9, -32, 18, 3);   // stripes
    c.fillStyle = '#fff'; c.fillRect(13, -6, 11, 6);   // toe cap
    // mouth/puppet head at top
    var open = (game.active === s && game.state === 'aim') ? 3 + Math.abs(Math.sin(game.t * 6)) * 3 : 2;
    c.fillStyle = '#5a1020'; c.beginPath(); c.ellipse(4, -42, 10, open, 0, 0, Math.PI * 2); c.fill();
    // eyes: one button eye, one googly
    c.fillStyle = '#111'; c.beginPath(); c.arc(-2, -30 + (D ? 2 : 0), 3.5, 0, 6.3); c.fill(); c.fillStyle = '#fff6'; c.fillRect(-3, -31, 1, 1); c.fillRect(-1, -31, 1, 1);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(6, -31, 4.2, 0, 6.3); c.fill(); c.fillStyle = '#111';
    var ex = D ? Math.cos(game.t * 12) * 2 : (s.dizzy ? Math.cos(game.t * 8) * 2 : 1.5), ey = D ? Math.sin(game.t * 12) * 2 : 0; c.beginPath(); c.arc(6 + ex, -31 + ey, 1.8, 0, 6.3); c.fill();
    if (cd !== 'pristine') { c.fillStyle = '#2a1a2a'; c.beginPath(); c.arc(-4, -20, 3, 0, 6.3); c.arc(4, -12, 2.4, 0, 6.3); c.fill();
      c.fillStyle = '#e8d7a0'; c.fillRect(-8, -27, 6, 5); c.strokeStyle = '#333'; c.lineWidth = 1; c.beginPath(); c.moveTo(-8, -27); c.lineTo(-2, -22); c.moveTo(-2, -27); c.lineTo(-8, -22); c.stroke(); }
    if (cd === 'shredded') { c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); for (var i = 0; i < 4; i++) { c.moveTo(-9 + i * 5, -2); c.lineTo(-11 + i * 5 + Math.sin(game.t * 4 + i) * 3, 8); } c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-9, -18, 4, 0, 6.3); c.arc(9, -24, 3, 0, 6.3); c.fill(); }
    if (s.dizzy && s.alive) { for (i = 0; i < 3; i++) { var a = game.t * 4 + i * 2.1; c.fillStyle = '#ffe7a0'; c.font = 'bold 10px sans-serif'; c.fillText('\u2605', Math.cos(a) * 14 - 4, -54 + Math.sin(a) * 4); } }
    c.restore();
  }
  function drawTomb(s) { var c = cx; c.save(); c.translate(s.x, s.y);
    c.fillStyle = '#8a8070'; c.beginPath(); c.moveTo(-14, 0); c.lineTo(-14, -20); c.arc(0, -20, 14, Math.PI, 0); c.lineTo(14, 0); c.fill();
    c.fillStyle = s.team.color; c.save(); c.rotate(-0.25); c.fillRect(-6, -38, 9, 22); c.beginPath(); c.ellipse(-1, -16, 8, 4, 0, 0, 6.3); c.fill(); c.restore();   // limp sock draped over it
    c.fillStyle = '#222'; c.beginPath(); c.arc(1, -16, 3.2, 0, 6.3); c.fill(); c.fillStyle = '#888'; c.fillRect(-0.5, -17.5, 1, 1); c.fillRect(2, -17.5, 1, 1);
    c.fillStyle = '#fff'; c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillText('RIP', 0, -6); c.restore(); }
  function drawFuzzPile(s) { var c = cx; c.fillStyle = s.team.color; for (var i = 0; i < 7; i++) { c.beginPath(); c.arc(s.x - 12 + i * 4, s.y - 3 - (i % 3) * 2, 4, 0, 6.3); c.fill(); } }
  var camLast = performance.now();
  function camTarget() {
    var full = { x: W / 2, y: H / 2, z: 1 };
    if (game.phase !== 'play' || !game.active) return full;
    var s = game.active, p = projs.filter(function (q) { return q.k !== 'mgun'; })[0];
    if (p) { if (p.k === 'iron' || p.k === 'blet') { var xs = projs.map(function (q) { return q.x; }); return { x: (Math.min.apply(0, xs) + Math.max.apply(0, xs)) / 2, y: Math.max(p.y, 500), z: 1.35 }; } return { x: p.x + p.vx * 0.25, y: p.y + p.vy * 0.15, z: 1.55 }; }
    var dc = decoys[0]; if (dc) return { x: dc.lured ? (dc.x + dc.lured.x) / 2 : dc.x, y: dc.y - 40, z: 1.8 };
    var fm = mines.filter(function (m) { return m.fuse > 0; })[0]; if (fm) return { x: fm.x, y: fm.y - 30, z: 1.9 };
    var mover = game.socks.filter(function (o) { return o.alive && (!o.ground || o.dying) && o !== s; })[0];
    if (game.state === 'settle' && mover) return { x: mover.x, y: mover.y - 40, z: 1.5 };
    if (game.state === 'settle' || game.state === 'next') return { x: W / 2, y: H / 2, z: 1.1 };
    if (s.alive) { var v = aimVec(s); return { x: s.x + v[0] * 120 * (game.state === 'aim' ? 1 : 0), y: s.y - 50 + v[1] * 60, z: game.drill ? 2.4 : 2.3 }; }
    return full;
  }
  function updateCam() { var now = performance.now(), dt = Math.min(0.1, (now - camLast) / 1000); camLast = now; var T = camTarget(), k = 1 - Math.exp(-dt * (T.z > cam.z ? 2.2 : 1.6));
    cam.z += (T.z - cam.z) * k; cam.x += (T.x - cam.x) * Math.min(1, k * 1.6); cam.y += (T.y - cam.y) * Math.min(1, k * 1.6);
    var S = scale * cam.z, hw = cv.width / 2 / S, hh = cv.height / 2 / S;
    cam.x = hw * 2 >= W ? W / 2 : clamp(cam.x, hw, W - hw); cam.y = hh * 2 >= H ? H / 2 : clamp(cam.y, hh, H - hh); }
  function draw() {
    var d = window.devicePixelRatio || 1; scale = Math.min(cv.width / W, cv.height / H); offX = (cv.width - W * scale) / 2; offY = (cv.height - H * scale) / 2;
    var g = cx.createLinearGradient(0, 0, 0, cv.height); g.addColorStop(0, '#6e8fe0'); g.addColorStop(1, '#f7c6a8'); cx.fillStyle = g; cx.fillRect(0, 0, cv.width, cv.height);
    updateCam(); var S = scale * cam.z; cx.save(); var sh = shake > 0.2 ? shake : 0; cx.translate(cv.width / 2 + rnd(-sh, sh) * S, cv.height / 2 + rnd(-sh, sh) * S); cx.scale(S, S); cx.translate(-cam.x, -cam.y);
    clouds.forEach(function (k) { k.x += game.wind * 0.4 + 0.05; if (k.x > W + 200) k.x = -200; if (k.x < -200) k.x = W + 200; cx.fillStyle = '#ffffffaa'; [[0, 0, 40], [40, -10, 50], [85, 0, 38]].forEach(function (b) { cx.beginPath(); cx.arc(k.x + b[0] * k.s, k.y + b[1] * k.s, b[2] * k.s, 0, 6.3); cx.fill(); }); });
    // clothesline backdrop
    cx.strokeStyle = '#0003'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(0, 200); cx.quadraticCurveTo(W / 2, 290, W, 200); cx.stroke();
    if (game.phase !== 'lobby' && timg) cx.drawImage(tcv, 0, 0);
    // water
    cx.fillStyle = '#5fb7e8cc'; cx.beginPath(); cx.moveTo(0, H); for (var x = 0; x <= W; x += 20) cx.lineTo(x, WD.water + Math.sin(x / 60 + game.t * 2) * 6); cx.lineTo(W, H); cx.fill();
    for (x = 0; x < W; x += 140) { cx.fillStyle = '#ffffff99'; cx.beginPath(); cx.arc(x + (game.t * 20 % 140), WD.water + 10 + Math.sin(x + game.t) * 4, 6, 0, 6.3); cx.fill(); }
    if (game.phase !== 'lobby') {
      chunks.forEach(function (c) { cx.fillStyle = '#a07aa8'; cx.beginPath(); cx.arc(c.x, c.y, c.r, 0, 6.3); cx.fill(); cx.strokeStyle = '#0004'; cx.stroke(); });
      fires.forEach(function (f) { var h = 18 + Math.sin(game.t * 15 + f.x) * 5; cx.fillStyle = '#ff7a1a'; cx.beginPath(); cx.moveTo(f.x - 8, f.y); cx.quadraticCurveTo(f.x, f.y - h * 1.6, f.x + 8, f.y); cx.fill(); cx.fillStyle = '#ffe14a'; cx.beginPath(); cx.moveTo(f.x - 4, f.y); cx.quadraticCurveTo(f.x, f.y - h, f.x + 4, f.y); cx.fill(); });
      washers.forEach(function (w) { cx.save(); cx.translate(w.x, w.y); cx.fillStyle = '#f2f2f2'; cx.strokeStyle = w.team.color; cx.lineWidth = 3; cx.fillRect(-22, -24, 44, 48); cx.strokeRect(-22, -24, 44, 48);
        cx.fillStyle = '#9ad'; cx.beginPath(); cx.arc(0, 4, 14, 0, 6.3); cx.fill(); cx.strokeStyle = '#555'; cx.beginPath(); cx.arc(0, 4, 14, 0, 6.3); cx.stroke();
        cx.rotate(w.spin); cx.fillStyle = '#fff'; for (var i = 0; i < 3; i++) { cx.rotate(2.1); cx.beginPath(); cx.arc(7, 0, 3, 0, 6.3); cx.fill(); } cx.restore();
        cx.fillStyle = '#333'; cx.fillRect(w.x - 16, w.y - 20, 10, 4); });
      mines.forEach(function (m) { cx.save(); cx.translate(m.x, m.y); cx.fillStyle = '#c9a26a'; cx.strokeStyle = '#7a5a2a'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(-15, 14); cx.lineTo(-18, -12); cx.lineTo(18, -12); cx.lineTo(15, 14); cx.closePath(); cx.fill(); cx.stroke();
        for (var hx = -12; hx <= 12; hx += 6) { cx.beginPath(); cx.moveTo(hx, -10); cx.lineTo(hx * 0.85, 12); cx.stroke(); } cx.fillStyle = m.team.color; cx.fillRect(-10, -18, 20, 7);
        var blink = m.fuse > 0 ? (game.t * 12 | 0) % 2 : m.t > WP.mine.arm ? (game.t * 2 | 0) % 2 : 0; cx.fillStyle = blink ? '#ff2a2a' : '#5a1010'; cx.beginPath(); cx.arc(0, -20, 4, 0, 6.3); cx.fill(); cx.restore(); });
      game.socks.forEach(function (s) { if (s.tomb) { drawFuzzPile(s); drawTomb(s); } });
      game.socks.forEach(function (s) { if (s.alive) { drawSock(s, s.x, s.y); if (s.dying && s.dying.kind === 'dopey') { cx.fillStyle = s.team.color; for (var i = 0; i < 5; i++) { cx.beginPath(); cx.arc(s.x - 10 + i * 5, s.y - 2, 2 + s.dying.t * 1.5, 0, 6.3); cx.fill(); } } } });
      decoys.forEach(function (dc) { var fake = { team: { color: dc.color }, alive: true, hp: 100, face: dc.dir, wob: 1, x: dc.x, y: dc.y };
        if (dc.built < 1) { var bt = dc.built; cx.fillStyle = dc.color; cx.strokeStyle = '#0006'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(dc.x - dc.dir * 34, dc.y - 8, 10, 8 * (1 - bt) + 2, 0, 0, 6.3); cx.fill(); cx.stroke();   // fabric bolt unrolling
          cx.fillRect(Math.min(dc.x, dc.x - dc.dir * 34), dc.y - 3, 34, 3);
          cx.save(); cx.beginPath(); cx.rect(dc.x - 50, dc.y - 70 * bt, 100, 70 * bt + 4); cx.clip(); cx.globalAlpha = 0.5 + bt * 0.5; drawSock(fake, dc.x, dc.y); cx.restore();
          var bx2 = dc.x + Math.sin(game.t * 18) * 12, by2 = dc.y - 70 * bt; cx.save(); cx.translate(bx2, by2); cx.rotate(0.6); cx.fillStyle = '#c8873a'; cx.fillRect(-2, -22, 4, 20); cx.fillStyle = '#ddd'; cx.fillRect(-3, -4, 6, 4); cx.fillStyle = dc.color; cx.fillRect(-3, 0, 6, 6); cx.restore();
          cx.strokeStyle = '#ccc'; cx.lineWidth = 2; var sx2 = dc.x - dc.dir * 22, sy2 = dc.y - 30, sa = Math.abs(Math.sin(game.t * 20)) * 0.5; cx.beginPath(); cx.moveTo(sx2, sy2); cx.lineTo(sx2 + Math.cos(sa) * 12, sy2 - Math.sin(sa) * 12); cx.moveTo(sx2, sy2); cx.lineTo(sx2 + Math.cos(-sa) * 12, sy2 - Math.sin(-sa) * 12); cx.stroke(); }
        else drawSock(fake, dc.x, dc.y);
        cx.fillStyle = '#f33'; cx.font = 'bold 14px sans-serif'; cx.textAlign = 'center'; if ((game.t * 4 | 0) % 2) cx.fillText('tick', dc.x, dc.y - 50); cx.fillStyle = '#fffa'; cx.fillText('\u2665', dc.x - 4, dc.y - 20); });
      projs.forEach(function (p) { cx.save(); cx.translate(p.x, p.y);
        if (p.k === 'bazooka') { cx.rotate(Math.atan2(p.vy, p.vx)); cx.fillStyle = '#3ac0ff'; cx.beginPath(); cx.ellipse(0, 0, 11, 7, 0, 0, 6.3); cx.fill(); cx.fillStyle = '#ff5ad0'; cx.beginPath(); cx.ellipse(-3, 0, 6, 7, 0, -1.57, 1.57); cx.fill(); cx.fillStyle = '#fff9'; cx.fillRect(2, -4, 4, 2); }
        else if (p.k === 'mgun') { cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(0, 0, 3, 0, 6.3); cx.fill(); }
        else if (p.k === 'molotov') { cx.rotate(p.spin); cx.fillStyle = '#c0281a'; cx.fillRect(-5, -9, 10, 16); cx.fillStyle = '#fff'; cx.fillRect(-3, -14, 6, 5); cx.fillStyle = '#ffb23f'; cx.fillRect(-4, -3, 8, 4); }
        else if (p.k === 'mortar') { cx.rotate(p.spin * 0.6); cx.fillStyle = '#bfa8ff'; cx.fillRect(-9, -12, 18, 22); cx.fillStyle = '#fff'; cx.fillRect(-4, -17, 8, 6); cx.fillStyle = '#ff9ad5'; cx.fillRect(-9, -4, 18, 6); }
        else if (p.k === 'blet') { cx.fillStyle = '#e0d4ff'; cx.beginPath(); cx.arc(0, 0, 7, 0, 6.3); cx.arc(5, -3, 5, 0, 6.3); cx.fill(); }
        else if (p.k === 'iron') { cx.rotate(0.3); cx.fillStyle = '#d23a3a'; cx.beginPath(); cx.moveTo(-18, 6); cx.lineTo(16, 6); cx.quadraticCurveTo(14, -10, -10, -8); cx.closePath(); cx.fill(); cx.fillStyle = '#ccc'; cx.fillRect(-18, 6, 34, 4); cx.fillStyle = '#ff9'; cx.fillRect(-14, 10, 26, 2); }
        else if (p.k === 'dryer') { cx.rotate(p.spin * 0.5); cx.fillStyle = '#eee'; cx.fillRect(-11, -11, 22, 22); cx.fillStyle = '#556'; cx.beginPath(); cx.arc(0, 2, 6, 0, 6.3); cx.fill(); cx.fillStyle = '#9ef'; cx.fillRect(-9, -15, 8, 5); }
        else if (p.k === 'holy') { cx.rotate(p.spin); cx.fillStyle = '#f5e6c0'; cx.beginPath(); cx.ellipse(0, 0, 9, 12, 0, 0, 6.3); cx.fill(); cx.fillStyle = '#d4a020'; cx.fillRect(-1.5, -10, 3, 16); cx.fillRect(-6, -5, 12, 3);
          cx.rotate(-p.spin); cx.fillStyle = '#fff'; cx.font = 'bold 14px sans-serif'; cx.textAlign = 'center'; cx.fillText(Math.max(0, Math.ceil(p.fuse)), 0, -18); }
        cx.restore(); });
      rings.forEach(function (r) { var k = r.t / r.max; cx.strokeStyle = 'rgba(255,255,255,' + k + ')'; cx.lineWidth = 3 + 8 * k; cx.beginPath(); cx.arc(r.x, r.y, r.R * (1.05 - k * 0.6), 0, 6.3); cx.stroke(); });
      flashes.forEach(function (f) { var k = f.t / 0.35; cx.fillStyle = 'rgba(255,240,200,' + (k * 0.7) + ')'; cx.beginPath(); cx.arc(f.x, f.y, f.r * (1.2 - k * 0.5), 0, 6.3); cx.fill();
        cx.strokeStyle = 'rgba(255,255,255,' + k + ')'; cx.lineWidth = 6; cx.beginPath(); cx.arc(f.x, f.y, f.r * (1.5 - k), 0, 6.3); cx.stroke(); });
      parts.forEach(function (p) { var a = Math.min(1, p.t * 2);
        if (p.k === 'smoke') { cx.fillStyle = 'rgba(235,230,240,' + a * 0.45 + ')'; cx.beginPath(); cx.arc(p.x, p.y, p.s * (1.6 - a * 0.6), 0, 6.3); cx.fill(); }
        else if (p.k === 'paint') { cx.fillStyle = p.c; cx.globalAlpha = a; cx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); cx.globalAlpha = 1; }
        else if (p.k === 'bub') { cx.strokeStyle = 'rgba(255,255,255,' + a + ')'; cx.lineWidth = 2; cx.fillStyle = 'rgba(200,240,255,' + a * 0.35 + ')'; cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.3); cx.fill(); cx.stroke(); }
        else if (p.k === 'spark') { cx.fillStyle = 'rgba(255,' + (150 + p.t * 60 | 0) + ',60,' + a + ')'; cx.beginPath(); cx.arc(p.x, p.y, p.s * 0.6, 0, 6.3); cx.fill(); }
        else { cx.fillStyle = p.k === 'stuff' ? '#fffdf0' : p.c; cx.globalAlpha = a; cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.3); cx.arc(p.x + p.s * 0.7, p.y + 1, p.s * 0.7, 0, 6.3); cx.fill(); cx.globalAlpha = 1; } });
      // active sock: aim + power
      var s = game.active;
      if (game.phase === 'play' && s && s.alive && !s.dying && game.state === 'aim') {
        var v = aimVec(s), ax = s.x, ay = s.y - 24; cx.strokeStyle = '#fff'; cx.lineWidth = 3; cx.setLineDash([6, 6]);
        cx.beginPath(); cx.moveTo(ax + v[0] * 24, ay + v[1] * 24); cx.lineTo(ax + v[0] * (40 + 80 * game.power), ay + v[1] * (40 + 80 * game.power)); cx.stroke(); cx.setLineDash([]);
        cx.fillStyle = '#ff4060'; cx.beginPath(); cx.arc(ax + v[0] * (44 + 80 * game.power), ay + v[1] * (44 + 80 * game.power), 6, 0, 6.3); cx.fill();
        cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(s.x, s.y - 70 + Math.sin(game.t * 5) * 4); cx.lineTo(s.x - 8, s.y - 82); cx.lineTo(s.x + 8, s.y - 82); cx.fill();
        if (game.weapon === 'airstrike') { var mx0 = clamp(s.x + s.face * (120 + game.power * 1000), 80, W - 80); cx.strokeStyle = '#ff4060'; cx.lineWidth = 4; cx.beginPath(); cx.arc(mx0, dropSpot(mx0), 26 + Math.sin(game.t * 6) * 4, 0, 6.3); cx.moveTo(mx0 - 36, dropSpot(mx0)); cx.lineTo(mx0 + 36, dropSpot(mx0)); cx.stroke(); }
        if (game.weapon === 'dryer') { var dxp = s.x + s.face * 30, prep = Math.min(1, (C.turnSec - game.turnT) / 1.5); cx.fillStyle = '#eee'; cx.fillRect(dxp - 13, s.y - 26, 26, 26); cx.fillStyle = '#556'; cx.beginPath(); cx.arc(dxp, s.y - 12, 7, 0, 6.3); cx.fill();
          for (var sh2 = 0; sh2 < 3; sh2++) { var ph2 = (game.t * 1.5 + sh2 / 3) % 1; if (prep < 1 || ph2 < 0.5) { cx.fillStyle = '#9ef'; cx.fillRect(dxp - 6 + sh2 * 4, s.y - 40 + ph2 * 22, 8, 5); } } }
        cx.font = 'bold 16px Fredoka,sans-serif'; cx.textAlign = 'center'; cx.fillStyle = '#fff'; cx.fillText(WP[game.weapon].icon + ' ' + WP[game.weapon].name, s.x, s.y - 88); }
      // names
      cx.font = '700 17px Fredoka,sans-serif'; cx.textAlign = 'center'; cx.lineWidth = 4; cx.strokeStyle = '#000b';
      game.socks.forEach(function (s) { if (!s.alive || s.dying) return; var ny0 = s.y - 62 * (s.size || 1); cx.strokeText(s.name, s.x, ny0); cx.fillStyle = s.team.color; cx.fillText(s.name, s.x, ny0); });
      bubbles.forEach(function (b) { var s = b.s; if (s && (s.alive || s.dying)) { b.x = s.x; b.y = s.y; } var tx = b.text; cx.font = '600 17px Fredoka,sans-serif'; var w = cx.measureText(tx).width + 20, bx = clamp(b.x, w / 2 + 4, W - w / 2 - 4), by = b.y - 100;
        cx.globalAlpha = Math.min(1, b.t * 3); cx.fillStyle = b.col; cx.strokeStyle = '#222'; cx.lineWidth = 2; cx.beginPath(); cx.roundRect ? cx.roundRect(bx - w / 2, by - 16, w, 28, 12) : cx.rect(bx - w / 2, by - 16, w, 28); cx.fill(); cx.stroke();
        cx.beginPath(); cx.moveTo(b.x - 6, by + 12); cx.lineTo(b.x, by + 26); cx.lineTo(b.x + 6, by + 12); cx.fill(); cx.fillStyle = '#222'; cx.fillText(tx, bx, by + 4); cx.globalAlpha = 1; });
      pops.forEach(function (p) { cx.globalAlpha = Math.min(1, p.t); cx.font = 'bold 26px Fredoka,sans-serif'; cx.lineWidth = 4; cx.strokeStyle = '#000a'; cx.strokeText(p.text, p.x, p.y); cx.fillStyle = p.col; cx.fillText(p.text, p.x, p.y); cx.globalAlpha = 1; });
    }
    cx.restore(); shake *= 0.88;
  }
  // ================================================================ DOM UI
  var uiKey = '';
  function ui() {
    var ph = game.phase;
    $('lobby').style.display = ph === 'lobby' ? 'flex' : 'none'; $('over').style.display = ph === 'over' ? 'flex' : 'none';
    $('teams').style.display = $('top').style.display = $('feed').style.display = ph === 'play' ? '' : 'none';
    $('cornerqr').style.display = ph === 'play' && net && net.status === 'online' ? '' : 'none';
    $('banner').style.opacity = game.bannerT > 0 && ph === 'play' ? 1 : 0; if (game.bannerT > 0) $('banner').textContent = game.banner;
    if (ph === 'lobby') { var L = leader(), k = JSON.stringify([humans().map(function (p) { return [p.name, p.connected]; }), game.bots, game.flash, L && L.name]);
      if (k !== uiKey) { uiKey = k;
        $('plist').innerHTML = humans().map(function (p, i) { return '<span style="background:' + C.teamColors[i % 4] + ';opacity:' + (p.connected ? 1 : 0.4) + '">' + esc(p.name) + ' \u00b7 ' + C.teamNames[i % 4] + '</span>'; }).join('') || '<span style="background:#fff3;color:#fff">Waiting for sock wranglers&hellip;</span>';
        $('hint').innerHTML = (L ? '<b>' + esc(L.name) + '</b> starts from their phone' : 'Scan to join (2 to 4 teams)') + ' \u00b7 AI fill ' + (game.bots ? 'ON' : 'OFF') + (game.flash && performance.now() - game.flashAt < 4000 ? '<br><span style="color:#ff9">' + esc(game.flash) + '</span>' : '') + '<br><small>Keyboard: Enter = start, B = AI on/off. In game: arrows move/aim, W jump, 1-7 weapon, hold Space for power, release to fire</small>'; } }
    if (ph === 'play') {
      $('teams').innerHTML = game.teams.map(function (t, i) { return '<div class="' + (i === game.turnTeam ? 'on' : '') + '" style="border-color:' + t.color + '">' + esc(t.name) + (isAi(t) && !t.p.ai ? ' <small>(AI)</small>' : '') + ' ' + t.socks.map(function (s) { return s.alive ? '\uD83E\uDDE6' : '\u271D'; }).join('') + '</div>'; }).join('');
      var s = game.active, wa = Math.round(Math.abs(game.wind) * 5), arrow = game.wind < 0 ? '\u25C0'.repeat(wa) : '\u25B6'.repeat(wa);
      $('top').innerHTML = '<div>\u23F1 ' + (game.state === 'aim' ? Math.ceil(game.turnT) : game.state === 'retreat' ? 'run! ' + Math.ceil(game.retreatT) : '\u2026') + '</div><div>Wind ' + (arrow || 'calm') + '</div>' + (s ? '<div style="color:' + s.team.color + '">' + esc(s.name) + ' \u00b7 ' + WP[game.weapon].icon + ' ' + WP[game.weapon].name + '</div>' : '');
      $('feed').innerHTML = (game.feed || []).filter(function (f) { return performance.now() - f.at < 7000; }).map(function (f) { return '<div>' + esc(f.t) + '</div>'; }).join('');
    }
    if (ph === 'over') { $('pbar').firstChild.style.width = Math.min(100, game.phaseT / C.winHoldSec * 100) + '%'; $('onext').textContent = EMBED ? '' : 'Back to the lobby in ' + Math.max(0, Math.ceil(C.winHoldSec + 2 - game.phaseT)) + 's'; }
  }
  function showOver() {
    var w = game.winner; $('otitle').textContent = w ? w.name.toUpperCase() + ' WIN!' : 'ALL SOCKS LOST'; $('otitle').style.color = w ? w.color : '';
    $('osub').textContent = w ? 'Survivors: ' + w.socks.filter(function (s) { return s.alive; }).map(function (s) { return s.name + ' (' + cond(s) + ')'; }).join(', ') : 'The dryer wins again.';
    var r = game.teams.slice().sort(function (a, b) { return (b === w) - (a === w) || b.dmg - a.dmg; });
    $('otab').innerHTML = '<tr><th></th><th>Damage dealt</th><th>Socks KO\u2019d</th><th>Socks lost</th></tr>' + r.map(function (t) { return '<tr><td style="color:' + t.color + ';font-weight:600">' + esc(t.name) + '</td><td>' + t.dmg + '</td><td>' + t.kos + '</td><td>' + t.lost + '</td></tr>'; }).join('');
  }
  // ================================================================ phones
  function send(conn, m) { if (net && conn) net.send(conn, m); }
  var lastSend = 0;
  function sendStates(now) {
    if (now - lastSend < 150) return; lastSend = now; var L = leader();
    humans().forEach(function (p) { if (!p.conn || !p.connected) return; var t = p.team, m = { t: 'st', phase: game.phase, leader: L === p, bots: game.bots, n: humans().length };
      if (game.phase === 'play' && t) { var my = game.turnTeam === t.idx && !isAi(t);
        m.team = t.name; m.color = t.color; m.socks = t.socks.map(function (s) { return [s.name, cond(s)]; }); m.my = my && (game.state === 'aim' || game.state === 'retreat'); m.aiming = my && game.state === 'aim';
        m.who = game.active ? game.active.name + ' (' + game.active.team.name + ')' : ''; m.timer = Math.ceil(game.state === 'aim' ? game.turnT : game.state === 'retreat' ? game.retreatT : 0); m.state = game.state; m.wind = Math.round(game.wind * 10) / 10;
        m.weapon = game.weapon; m.used = t.used; m.power = game.power; m.dizzy = my && game.dizzyNow; }
      if (game.phase === 'over' && t) { m.won = game.winner === t; m.winner = game.winner ? game.winner.name : ''; m.dmg = t.dmg; m.kos = t.kos; m.lost = t.lost; }
      send(p.conn, m); });
  }
  function myTurn(p) { return game.phase === 'play' && p.team && game.turnTeam === p.team.idx && !game.ai; }
  function onPhoneMessage(conn, m) {
    if (!m || !m.t) return; var p = conn._p;
    if (m.t === 'hello') {
      p = game.players.find(function (q) { return q.token && q.token === m.token; });
      if (!p) { if (humans().length >= C.maxTeams) { send(conn, { t: 'reject', reason: 'All 4 teams are taken' }); return; }
        p = { id: 'p' + Math.random().toString(36).slice(2, 8), token: m.token, name: String(m.name || 'Player').slice(0, 12), weapon: 'bazooka', power: 0.6 };
        game.players.push(p); }
      else if (m.name) p.name = String(m.name).slice(0, 12);
      p.conn = conn; p.connected = true; p.left = false; conn._p = p;
      send(conn, { t: 'welcome', pid: p.id, room: net.code, spectator: game.phase === 'play' && !p.team }); return; }
    if (!p) return;
    if (m.t === 'start' && leader() === p) { if (game.phase === 'lobby') startMatch(); else if (game.phase === 'over') toLobby(); }
    if (m.t === 'bots' && leader() === p && game.phase === 'lobby') game.bots = !game.bots;
    if (m.t === 'wpn' && WP[m.w]) { p.weapon = m.w; if (myTurn(p) && game.state === 'aim') game.weapon = canUse(p.team, m.w) ? m.w : game.weapon; }
    if (m.t === 'pow') { p.power = clamp(+m.v || 0, 0.1, 1); if (myTurn(p)) game.power = p.power; }
    if (!myTurn(p)) return;
    if (m.t === 'in') game.inp = { mx: clamp(+m.mx || 0, -1, 1), ay: clamp(+m.ay || 0, -1, 1) };
    if (m.t === 'jump') jump(game.active);
    if (m.t === 'fire') fire();
    if (m.t === 'leave') { p.left = true; p.connected = false; }
  }
  function onPhoneClose(conn) { var p = conn._p; if (p && p.conn === conn) { p.connected = false; p.goneAt = performance.now(); if (game.phase === 'lobby') setTimeout(function () { if (!p.connected && game.phase === 'lobby') { var i = game.players.indexOf(p); if (i >= 0) game.players.splice(i, 1); } }, 30000); } }
  function controllerUrl(code) { var base = location.protocol === 'file:' ? C.liveControllerUrl : location.href.replace(/[^/]*([?#].*)?$/, '') + 'controller.html'; return base + '?room=' + code + (LOCAL ? '&local=1' : ''); }
  function qrSvg(text) { var q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
  function setNetUi(st, code, detail) {
    if (st === 'online') { var url = window.ZTP_QR || controllerUrl(code); $('code').textContent = code; $('cqcode').textContent = code; $('joinUrl').textContent = url.replace(/^https?:\/\//, ''); $('qr').innerHTML = qrSvg(url); $('cq').innerHTML = qrSvg(url); $('netStatus').textContent = ''; }
    else $('netStatus').textContent = st === 'offline' ? 'Room server offline (' + (detail || '') + ')' : 'Connecting to the room server\u2026';
  }
  window.addEventListener('message', function (e) { var d = e.data; if (e.source !== window.parent || !d || d.ztp !== 'qr' || !d.url) return;
    if (window.ZTP_QR !== d.url) { window.ZTP_QR = d.url; if (net && net.status === 'online') setNetUi('online', net.code); } try { parent.postMessage({ ztp: 'qrok' }, '*'); } catch (x) {} });
  // keyboard (TV testing): drives whichever team is up if it's not an AI turn
  var keys = {}, charging = false;
  window.addEventListener('keydown', function (e) { keys[e.key] = true;
    if (e.key === 'Enter') { if (game.phase === 'lobby') startMatch(); else if (game.phase === 'over') toLobby(); }
    if ((e.key === 'b' || e.key === 'B') && game.phase === 'lobby') game.bots = !game.bots;
    if (game.phase !== 'play' || game.ai) return;
    if (e.key === 'w' || e.key === 'W') jump(game.active);
    var n = +e.key; if (n >= 1 && n <= C.weapons.length && game.state === 'aim') { var w = C.weapons[n - 1].id; if (canUse(game.active.team, w)) game.weapon = w; }
    if (e.key === ' ' && !charging && game.state === 'aim') { charging = true; game.power = 0.1; } });
  window.addEventListener('keyup', function (e) { keys[e.key] = false; if (e.key === ' ' && charging) { charging = false; if (game.phase === 'play' && !game.ai) fire(); } });
  var last = performance.now(), kbUsed = false, SPEED = clamp(+Q.get('speed') || 1, 1, 8) | 0;
  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; game.phaseT += dt;
    if (game.phase === 'play') {
      if (!game.ai && (keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown)) { kbUsed = true; game.inp = { mx: (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ay: (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0) }; }
      else if (kbUsed) { kbUsed = false; game.inp = { mx: 0, ay: 0 }; }
      if (charging) game.power = Math.min(1, game.power + dt * 0.8);
      for (var sp = 0; sp < SPEED; sp++) sim(dt);
    }
    if (game.phase === 'over' && !EMBED && game.phaseT > C.winHoldSec + 2) toLobby();
    draw(); ui(); sendStates(now); requestAnimationFrame(tick);
  }
  var roomQ = (Q.get('room') || Q.get('code') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || null;
  if (LOCAL) net = new window.LSNet.LocalHost({ code: roomQ || 'TEST', onStatus: setNetUi, onMessage: onPhoneMessage, onClose: onPhoneClose });
  else if (!NONET) net = new window.LSNet.Host({ code: roomQ, fixedCode: !!roomQ, onStatus: setNetUi, onMessage: onPhoneMessage, onClose: onPhoneClose });
  setPhase('lobby');
  if (Q.get('autostart') === '1') setTimeout(startMatch, 300);
  window.LS.debug = { startMatch: startMatch, toLobby: toLobby, game: game, fire: fire, explode: explode };
  requestAnimationFrame(tick);
})();
