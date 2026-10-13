/* DRIFT SIGNAL v0.4 - AI autopilot. Helm can hand the ship to the computer in one of three modes:
   explore   - visits places it hasn't been yet, scans each one, probes the odd ones
   sightsee  - slow impulse cruising toward the prettiest things in the sector, view screen framing them, long lingering looks
   gather    - hops between resource spots (comet tail, mining beacons, the asteroid field, gas giant skim) and fills the hold
   Any helm order (course, all stop, orbit, landing, cave...) takes control straight back. Plugs in through window.SPACE_X. */
(function () {
  'use strict';
  var X = window.SPACE_X; if (!X || !X.ship) return;
  var ship = X.ship, defs = X.defs, C = X.C, say = X.say;
  var SIGHTS = ['neb', 'comet', 'gas', 'bh', 'thal', 'moss', 'ruby', 'vael', 'pulse'];          // scenic order of preference
  var RES = { comet: ['ice', 'ice', 'fuel'], ruby: ['parts', 'iso'], gas: ['fuel', 'fuel', 'iso'], moss: ['rations', 'med'], thal: ['ice', 'rations'], drifter: ['parts'] };
  var MODES = { explore: 'Exploration', sightsee: 'Sightseeing', gather: 'Resource gathering' };
  var A = window.DS_AUTO = { on: false, mode: 'explore', target: null, phase: '', t: 0, linger: 0, visited: {}, last: null, gathered: 0, status: '' };
  var TAKE = /^(course|stop|warp|orbit|site|descend|liftoff|cave|escape|roll|grab)$/;
  X.ACT.auto = 'helm'; X.LABEL.auto = 'AI pilot';
  function safe(d) { return d && d.kind !== 'blackhole' || (A.mode === 'sightsee' && d && d.kind === 'blackhole'); }
  function cargo() { var x = X.v03 && X.v03.cargo; return x; }
  function pick() {
    var ids = C.sector.map(function (d) { return d.id; }).filter(function (id) { return id !== A.last && defs[id] && safe(defs[id]); }), here = ship.pos, pool;
    if (A.mode === 'sightsee') pool = SIGHTS.filter(function (id) { return ids.indexOf(id) >= 0; });
    else if (A.mode === 'gather') pool = Object.keys(RES).filter(function (id) { return ids.indexOf(id) >= 0; });
    else { pool = ids.filter(function (id) { return !A.visited[id]; }); if (!pool.length) { A.visited = {}; pool = ids; } }
    if (!pool.length) return null;
    // nearest-ish with a little randomness, so a long session wanders instead of ping-ponging
    pool.sort(function (a, b) { return X.H.objs[a].position.distanceTo(here) - X.H.objs[b].position.distanceTo(here); });
    return pool[Math.min(pool.length - 1, Math.floor(Math.random() * Math.min(3, pool.length)))];
  }
  function warpFor() { var mx = C.maxWarp(ship.power.engines); return A.mode === 'sightsee' ? Math.min(mx, 1.2) : A.mode === 'gather' ? Math.min(mx, 4) : Math.min(mx, 6); }
  function go() {
    var id = pick(); if (!id) { A.status = 'No destinations'; return; }
    A.target = id; A.phase = 'fly'; A.t = 0; A.last = id; A.driving = true; X.setCourse(id, warpFor()); A.driving = false;
    if (A.mode === 'sightsee') ship.view = false;
    A.status = (A.mode === 'gather' ? 'Heading to gather at ' : A.mode === 'sightsee' ? 'Cruising toward ' : 'Exploring ') + defs[id].name;
    X.dirty();
  }
  function arrived() {
    var d = defs[A.target]; A.phase = 'linger'; A.t = 0; A.visited[A.target] = true;
    if (A.mode === 'sightsee') { A.linger = 45; ship.view = true; A.status = 'Taking in ' + d.name; }
    else if (A.mode === 'gather') { A.linger = 24; A.nextItem = 5; A.status = 'Gathering at ' + d.name; say('Collectors out. Gathering at ' + d.name + '.', 'calm', true); }
    else { A.linger = 18; A.status = 'Surveying ' + d.name; try { X.scan(d.id); if (/signal|nebula|planet/.test(d.kind) && Math.random() < 0.5) X.launchProbe(d.id); } catch (e) {} }
    X.dirty();
  }
  function setOn(on) {
    if (!!on === A.on) return;
    A.on = !!on; A.phase = ''; A.target = null;
    if (A.on) { say('AI pilot engaged. ' + MODES[A.mode] + ' mode. Say the word and the helm is yours.', 'calm'); go(); }
    else { A.status = ''; if (ship.view && A.mode === 'sightsee') ship.view = false; say('Manual helm. The ship is yours.', 'calm', true); }
    X.dirty();
  }
  var preAct = X.act;
  X.act = function (me, m) {
    if (m.a === 'auto') {
      var nm = MODES[m.mode] ? m.mode : null, changed = nm && nm !== A.mode; if (nm) A.mode = nm;
      var want = m.on == null ? (nm ? A.on || true : !A.on) : !!m.on;
      if (want !== A.on) setOn(want); else if (A.on && changed) { say(MODES[A.mode] + ' mode.', 'calm', true); go(); }
      X.dirty(); return true;
    }
    if (A.on && !A.driving && TAKE.test(m.a)) { A.on = false; A.status = ''; X.hudNote('Helm has control. AI pilot off.', 'calm'); X.log('AI pilot off: ' + (me && me.name || 'helm') + ' took the helm.', 'crew'); }
    return preAct ? preAct(me, m) : false;
  };
  var preTick = X.tick;
  X.tick = function (dt) {
    if (preTick) preTick(dt);
    if (!A.on) return;
    var busy = ship.loc !== 'space' || (X.ev().active && /raider|colossus/.test(X.ev().active.def.kind)) || X.fight();
    if (busy) { A.status = ship.loc !== 'space' ? 'Holding: off-world' : 'Holding: contact nearby'; return; }
    A.t += dt;
    if (A.phase === 'fly') {
      if (!ship.course) { if (A.t > 1) arrived(); }                  // pilot() clears the course on arrival
      else if (ship.course.id !== A.target) { A.on = false; A.status = ''; }
      else if (A.mode === 'sightsee') {                                  // gentle: framed on the target as it grows, slow turns
        ship.view = A.t > 6 && ship.course && (A.t % 60) > 40;
      }
    } else if (A.phase === 'linger') {
      if (A.mode === 'gather' && (A.nextItem -= dt) <= 0) {
        A.nextItem = 6; var list = RES[A.target] || ['ice'], it = list[Math.floor(Math.random() * list.length)], cg = cargo();
        if (cg && cg.length < 24) { cg.push(it); A.gathered++; X.hudNote('+1 ' + (C.items[it] ? C.items[it].name : it), 'calm'); X.log('Gathered: ' + (C.items[it] ? C.items[it].name : it), 'sci'); X.dirty(); }
        else if (cg) { A.status = 'Hold full'; A.linger = 0; }
      }
      if (A.t > A.linger) { if (A.mode === 'sightsee') ship.view = false; go(); }
    } else go();
  };
  var preState = X.state;
  X.state = function (base) { if (preState) preState(base); base.auto = { on: A.on, mode: A.mode, status: A.status, n: A.gathered }; };
  window.SPACE && (window.SPACE.auto = { A: A, set: setOn, go: go });
  // a quiet badge on the bridge window
  var b = document.createElement('div'); b.id = 'autoBadge';
  b.style.cssText = 'position:fixed;left:50%;top:9.5vh;transform:translateX(-50%);font:600 1.05vw/1.2 system-ui,sans-serif;letter-spacing:.18em;color:#9fe8ff;background:rgba(6,14,24,.55);border:1px solid rgba(120,220,255,.35);padding:.35em 1em;border-radius:2em;pointer-events:none;opacity:0;transition:opacity .8s;z-index:6;text-transform:uppercase';
  document.body.appendChild(b);
  setInterval(function () { b.style.opacity = A.on ? 1 : 0; if (A.on) b.textContent = 'AI pilot \u00B7 ' + MODES[A.mode] + (A.status ? ' \u00B7 ' + A.status : ''); }, 500);
})();
