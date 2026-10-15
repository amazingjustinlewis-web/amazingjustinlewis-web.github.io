/* STACK ATTACK host logic (matter.js 2D slab). Your tower + 2 easy AI builders beside you; disasters land somewhere random. */
(function (root) {
  var M = root.Matter, B = M.Bodies, Bd = M.Body, GY = root.StackDraw.GY;
  var BUILD = 40, DIS = 8, SETTLE = 3, DZ = [['quake', 'EARTHQUAKE!'], ['tornado', 'TORNADO!'], ['monster', 'BIG LIZARD!']];
  var KINDS = [['rect', 240, 50, '#ff5a6e'], ['rect', 100, 100, '#3aa8ff'], ['rect', 50, 200, '#5fdc7a'], ['rect', 320, 34, '#ffc93f'], ['tri', 150, 120, '#c77dff'], ['rect', 160, 80, '#ff9f43']];
  function Game() {
    this.E = M.Engine.create(); this.W = this.E.world; this.S = { phase: 'build', t: BUILD, round: 0, best: 0, h: 0 }; this.pieces = []; this.holds = {}; this.last = {};
    this.T = [{ x: 500, name: 'You' }, { x: -800, name: 'Bot Bea', ai: 1 }, { x: 1800, name: 'Bot Bob', ai: 1 }]; this.newRound();
  }
  var G = Game.prototype;
  G.newRound = function () { var self = this; this.pieces.forEach(function (b) { M.Composite.remove(self.W, b); }); this.pieces = []; this.holds = {};
    this.T.forEach(function (T) { if (T.g) M.Composite.remove(self.W, T.g); T.g = B.rectangle(T.x, GY, 450, 40, { isStatic: true, friction: 1 }); M.Composite.add(self.W, T.g); T.h = 0; T.next = 1 + Math.random() * 2; });
    var S = this.S; S.phase = 'build'; S.t = BUILD; S.dz = DZ[S.round % 3]; S.round++; this.mon = null; this.tw = null; };
  G.make = function (ki, x, y, owner) { var k = KINDS[ki], o = { friction: .9, restitution: .03, density: .002, frictionAir: .02 };
    var b = k[0] === 'tri' ? B.polygon(x, y, 3, k[1] / 1.7, o) : B.rectangle(x, y, k[1], k[2], o); if (k[0] === 'tri') Bd.setAngle(b, -Math.PI / 2);
    b.k = k; b.owner = owner; this.pieces.push(b); M.Composite.add(this.W, b); return b; };
  G.spawn = function (who, ki, x, y) { if (this.S.phase !== 'build' || this.pieces.length > 60) return; var b = this.make(ki, x, y, 0); this.holds[who] = { b: b, x: x, y: y, ox: 0, oy: 0 }; this.last[who] = b; return b; };
  G.grab = function (who, x, y) { if (this.S.phase !== 'build') return false; var mine = this.pieces.filter(function (b) { return b.owner === 0; }), hit = M.Query.point(mine, { x: x, y: y })[0];
    if (!hit) { var bd = 70; mine.forEach(function (b) { var d = Math.hypot(b.position.x - x, b.position.y - y); if (d < bd) { bd = d; hit = b; } }); }
    if (!hit) return false; this.holds[who] = { b: hit, x: x, y: y, ox: hit.position.x - x, oy: hit.position.y - y }; this.last[who] = hit; return true; };
  G.move = function (who, x, y) { var h = this.holds[who]; if (h) { h.x = x; h.y = y; } };
  G.drop = function (who) { var h = this.holds[who]; if (!h) return; Bd.setVelocity(h.b, { x: h.b.velocity.x * .15, y: Math.min(2, h.b.velocity.y * .15) }); Bd.setAngularVelocity(h.b, 0); delete this.holds[who]; };
  G.rotate = function (who) { var h = this.holds[who], b = h ? h.b : this.last[who]; if (b && this.S.phase === 'build') Bd.setAngle(b, b.angle + Math.PI / 4); };
  G.height = function (i) { var T = this.T[i], top = 1e9, self = this; this.pieces.forEach(function (b) { if (Math.abs(b.position.x - T.g.position.x) > 300 || b.position.y > GY + 30) return; if (Math.hypot(b.velocity.x, b.velocity.y) > 3) return; if (Object.keys(self.holds).some(function (k) { return self.holds[k].b === b; })) return; top = Math.min(top, b.bounds.min.y); }); return top > 1e8 ? 0 : Math.max(0, (GY - 20 - top) / 100); };
  G.ai = function (dt) { var self = this; this.T.forEach(function (T, i) { if (!T.ai) return; T.next -= dt; if (T.next > 0) return; T.next = 2.2 + Math.random() * 1.6;
      var h = self.height(i), b = self.make((Math.random() * KINDS.length) | 0, T.x + (Math.random() - .5) * (h > 2 ? 260 : 120), GY - 40 - h * 100 - 150, i); if (Math.random() < .3) Bd.setAngle(b, Math.PI / 2); }); };
  G.step = function (dt) {
    var S = this.S, self = this; S.t -= dt; S.shake = 0;
    Object.keys(this.holds).forEach(function (k) { var h = self.holds[k], b = h.b; Bd.setVelocity(b, { x: (h.x + h.ox - b.position.x) * .3, y: (h.y + h.oy - b.position.y) * .3 }); Bd.setAngularVelocity(b, b.angularVelocity * .5); });
    if (S.phase === 'build') { this.ai(dt); if (S.t <= 0) { S.phase = 'disaster'; S.t = DIS; this.holds = {}; S.pre = this.height(0); this.T.forEach(function (T, i) { T.pre = self.height(i); });
      var z = S.dz[0]; if (z === 'quake') this.epi = -1200 + Math.random() * 4000; if (z === 'tornado') { this.tdir = Math.random() < .5 ? 1 : -1; this.tw = this.tdir > 0 ? -1700 : 2700; this.twob = Math.random() * 7; }
      if (z === 'monster') { var ti = (Math.random() * 3) | 0; this.mon = { x: this.T[ti].x + 650, y: 700, base: this.T[ti].x, side: Math.random() < .5 ? 1 : -1 }; } } }
    else if (S.phase === 'disaster') {
      var k = 1 - S.t / DIS, z = S.dz[0];
      if (z === 'quake') this.T.forEach(function (T, i) { var amp = 30 * Math.sin(Math.PI * k) * Math.exp(-Math.abs(T.x - self.epi) / 1500), nx = T.x + Math.sin(S.t * 22) * amp; Bd.setPosition(T.g, { x: nx, y: GY }, true); if (i === 0) S.shake = amp / 22; });
      if (z === 'tornado') { this.tw += this.tdir * 4400 / DIS * dt; var tx = this.tw + Math.sin(k * 9 + this.twob) * 120; this.twx = tx;
        this.pieces.forEach(function (b) { var dx = b.position.x - tx; if (Math.abs(dx) < 170) { var f = (1 - Math.abs(dx) / 170) * b.mass * .0007; Bd.applyForce(b, b.position, { x: -Math.sign(dx) * f * .3 + f * .9 * self.tdir, y: -f * .75 }); } }); }
      if (z === 'monster') { var m = this.mon, sd = m.side, off = k < .45 ? 650 - k / .45 * 520 : k < .65 ? 130 + Math.sin(k * 60) * 12 : 130 + (k - .65) / .35 * 600, mx = m.base + sd * off, my = 760 + Math.sin(k * 30) * 40;
        if (!m.body) { m.body = B.circle(mx, my, 85, { isStatic: true }); M.Composite.add(this.W, m.body); } Bd.setPosition(m.body, { x: mx, y: my }, true); m.x = mx - 90; m.y = my; }
      if (S.t <= 0) { S.phase = 'settle'; S.t = SETTLE; this.T.forEach(function (T) { Bd.setPosition(T.g, { x: T.x, y: GY }); }); if (this.mon && this.mon.body) M.Composite.remove(this.W, this.mon.body); this.mon = null; this.tw = null; }
    } else if (S.phase === 'settle' && S.t <= 0) { S.phase = 'score'; this.T.forEach(function (T, i) { T.h = self.height(i); }); S.h = this.T[0].h; S.best = Math.max(S.best, S.h); }
    this.pieces = this.pieces.filter(function (b) { if (b.position.y > 1500) { M.Composite.remove(self.W, b); return false; } return true; });
    M.Engine.update(this.E, dt * 1000);
  };
  G.snap = function () { var self = this, S = this.S, heldB = Object.keys(this.holds).map(function (k) { return self.holds[k].b; }), top = 0;
    this.pieces.forEach(function (b) { if (b.owner === 0 && Math.abs(b.position.x - 500) < 400) top = Math.max(top, GY - b.bounds.min.y); });
    return { b: this.pieces.map(function (b) { return [b.vertices.map(function (v) { return [Math.round(v.x), Math.round(v.y)]; }), b.k[3], heldB.indexOf(b) >= 0 ? 1 : 0, 0].map(function (x, i) { return i === 3 ? (heldB.indexOf(b) >= 0 ? 1 : 0) : x; }); }),
      g: this.T.map(function (T) { return [Math.round(T.g.position.x)]; }), phase: S.phase, dz: S.dz[0], name: S.dz[1], shake: S.shake, tw: this.tw != null ? this.twx : null, mz: this.mon ? [this.mon.x, this.mon.y] : null,
      best: S.best, t: Math.max(0, Math.ceil(S.t)), h: S.h, pre: S.pre, top: top, labels: this.T.map(function (T) { return [T.x, T.name + (S.phase === 'score' ? ' \u00b7 ' + T.h.toFixed(1) + 'm' : '')]; }), res: this.T.map(function (T) { return [T.name, T.h || 0]; }) }; };
  root.StackGame = Game; root.StackKinds = KINDS;
})(window);
