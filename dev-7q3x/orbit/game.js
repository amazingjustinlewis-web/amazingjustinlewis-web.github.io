/* ORBIT BRAWL v0.1 - host loop (runs on the TV, or on the phone when playing on a phone). Owns the sim, players, bots and rounds. */
(function (root) {
  'use strict';
  function Game(o) {
    var g = this; this.o = o || {}; this.sim = new root.Orbit.Sim(); this.byKey = {}; this.sendT = 0; this.endT = 0; this.round = 1;
    this.sim.fill(root.Orbit.C.FILL);
    if (o.net !== false) this.host = root.Kit.host({ max: root.Orbit.C.MAX - (o.localName ? 1 : 0),
      onJoin: function (p) { var s = g.byKey[p.id]; if (!s || g.sim.ships.indexOf(s) < 0) { s = g.byKey[p.id] = g.sim.add({ key: p.id, name: p.name }); g.sim.fill(root.Orbit.C.FILL); }
        s.name = p.name; g.host.send(p, { t: 'you', ship: s.id }); root.Kit.phase('play'); if (o.onJoin) o.onJoin(p, s); },
      onLeave: function (p) { var s = g.byKey[p.id]; if (s) { g.sim.remove(s); delete g.byKey[p.id]; g.sim.fill(root.Orbit.C.FILL); } },
      onMsg: function (p, m) { var s = g.byKey[p.id]; if (!s) return; if (m.t === 'in') { var a = m.a || []; s.inp.tx = +a[0] || 0; s.inp.tz = +a[1] || 0; s.inp.p = +a[2] || 0; s.inp.y = +a[3] || 0; s.inp.r = +a[4] || 0; s.inp.fire = !!m.f; }
        else if (m.t === 'bomb') g.sim.bomb(s, +m.c || 0); } });
    if (o.localName) { this.me = this.sim.add({ key: 'me', name: o.localName }); this.sim.fill(root.Orbit.C.FILL); }
  }
  Game.prototype.humans = function () { return this.sim.ships.filter(function (s) { return !s.bot; }).length; };
  Game.prototype.step = function (dt) {
    var sim = this.sim, o = this.o, acc = (this.acc || 0) + dt, h = 1 / 60;
    while (acc >= h) { acc -= h; sim.step(h); var ev = sim.ev; sim.ev = []; if (o.onEv) ev.forEach(function (e) { o.onEv(e); }); }
    this.acc = acc;
    if (sim.over) { this.endT += dt; if (this.endT > (o.endHold || 12) && !o.holdEnd) this.next(); }
    if (this.host) { this.sendT += dt; if (this.sendT >= .05) { this.sendT = 0; var snap = sim.snap(); this.host.all(snap); } }
  };
  Game.prototype.next = function () {   // new round, same pilots
    var old = this.sim, sim = this.sim = new root.Orbit.Sim(), map = {}, g = this; this.endT = 0; this.round++;
    old.ships.filter(function (s) { return !s.bot; }).forEach(function (s) { var n = sim.add({ key: s.key, name: s.name }); map[s.id] = n; if (s === g.me) g.me = n; });
    Object.keys(this.byKey).forEach(function (k) { var n = map[g.byKey[k].id]; if (n) g.byKey[k] = n; });
    sim.fill(root.Orbit.C.FILL);
    if (this.host) this.host.players.forEach(function (p) { var s = g.byKey[p.id]; if (s) g.host.send(p, { t: 'you', ship: s.id }); });
    if (this.o.onRound) this.o.onRound();
  };
  Game.prototype.state = function () { var sim = this.sim; return { seed: sim.seed, time: Math.ceil(sim.time), over: sim.over, feed: sim.feed,
    ships: sim.ships.map(function (s) { return { id: s.id, p: s.p, q: s.q, v: s.v, col: s.col, name: s.name, alive: s.alive, sh: s.sh, hull: s.hull, k: s.k, d: s.d, bot: s.bot, hit: s.hitT < .25 }; }),
    bul: sim.bul.map(function (b) { return [b.p.x, b.p.y, b.p.z, b.v.x, b.v.y, b.v.z]; }), bombs: sim.bombs.map(function (b) { return [b.p.x, b.p.y, b.p.z, b.c]; }),
    fx: sim.fx.map(function (f) { return [f.k, f.x, f.y, f.z, f.r, f.t, f.life, f.col]; }) }; };
  root.OrbitGame = Game;
})(window);
