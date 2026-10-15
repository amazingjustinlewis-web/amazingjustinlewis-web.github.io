/* ORBIT BRAWL v0.1 - phone-only action replays. Records ~15 fps of the whole fight, keeps the best 3 moments
   (your kills, kill streaks, bombs that catch ships) and plays them back with a chase camera at the end of the round. */
(function (root) {
  'use strict';
  var T = root.THREE, FPS = 15, PRE = 3, POST = 1.6;
  function copy(st) { return { seed: st.seed, ships: st.ships.map(function (s) { return { id: s.id, p: s.p.clone(), q: s.q.clone(), col: s.col, name: s.name, alive: s.alive, sh: s.sh, hit: s.hit }; }),
    bul: st.bul.map(function (b) { return b.slice(); }), bombs: st.bombs.map(function (b) { return b.slice(); }), fx: st.fx.map(function (f) { return f.slice(); }) }; }
  function Recorder() { this.buf = []; this.t = 0; this.acc = 0; this.clips = []; this.wait = []; this.streak = 0; this.lastKill = -9; }
  Recorder.prototype.frame = function (st, dt, G) { this.t += dt; this.acc += dt; if (this.acc >= 1 / FPS) { this.acc = 0; this.buf.push({ t: this.t, s: copy(st) }); var t0 = this.t - 8; while (this.buf.length && this.buf[0].t < t0) this.buf.shift(); }
    var me = this; this.wait = this.wait.filter(function (w) { if (me.t < w.at + POST) return true; me.keep(w); return false; });
    if (G.sim.over) { this.wait.forEach(function (w) { me.keep(w); }); this.wait = []; } };
  Recorder.prototype.keep = function (w) { var me = this, fr = this.buf.filter(function (f) { return f.t >= w.at - PRE && f.t <= w.at + POST; }); if (fr.length < 8) return;
    // merge with an overlapping clip of the same pilot (a streak becomes one clip)
    var ov = this.clips.filter(function (c) { return c.id === w.id && c.at > w.at - PRE - POST; })[0];
    if (ov) { ov.score += w.score; ov.label = w.label; ov.frames = ov.frames.concat(fr.filter(function (f) { return f.t > ov.frames[ov.frames.length - 1].t; })); ov.at = w.at; }
    else this.clips.push({ id: w.id, at: w.at, score: w.score, label: w.label, frames: fr });
    this.clips.sort(function (a, b) { return b.score - a.score; }); this.clips.length = Math.min(this.clips.length, 3); };
  Recorder.prototype.ev = function (e, G) { var meId = G.me && G.me.id, sh = function (id) { return G.sim.ships.filter(function (s) { return s.id === id; })[0]; };
    if (e.e === 'kill' && e.by === meId && e.id !== meId) { this.streak = this.t - this.lastKill < 6 ? this.streak + 1 : 1; this.lastKill = this.t; var v = sh(e.id);
      this.wait.push({ id: meId, at: this.t, score: 3 + this.streak * 2 + (e.kind === 'bomb' ? 2 : 0), label: (this.streak > 1 ? this.streak + 'x STREAK' : e.kind === 'bomb' ? 'BOMB KILL' : 'KILL') + (v ? ' \u00b7 ' + v.name : '') }); }
    else if (e.e === 'boom' && e.hits >= (e.id === meId ? 1 : 2)) { var a = sh(e.id); this.wait.push({ id: e.id, at: this.t, score: (e.id === meId ? 3 : 1) + e.hits * 2 + e.kills * 2, label: 'BIG BOMB \u00b7 ' + (a ? a.name : '') + ' caught ' + e.hits }); }
    else if (e.e === 'kill' && e.id === meId && e.by && e.by !== meId) { var k = sh(e.by); this.wait.push({ id: e.by, at: this.t, score: 1.5, label: 'GOT YOU \u00b7 ' + (k ? k.name : '') }); } };
  function Player(clips, V) { this.clips = clips.slice().sort(function (a, b) { return a.at - b.at; }); this.V = V; this.i = 0; this.t = 0; this.snap = true; }
  Player.prototype.skip = function () { this.i++; this.t = 0; this.snap = true; };
  Player.prototype.step = function (dt) { var c = this.clips[this.i]; if (!c) return null; this.t += dt * .6; var t0 = c.frames[0].t, ft = t0 + this.t, fr = c.frames;
    if (ft > fr[fr.length - 1].t) { this.skip(); return this.step(0); }
    var j = 0; while (j < fr.length - 2 && fr[j + 1].t < ft) j++; var A = fr[j].s, B = fr[j + 1].s, u = Math.max(0, Math.min(1, (ft - fr[j].t) / (fr[j + 1].t - fr[j].t))), Bm = {};
    B.ships.forEach(function (s) { Bm[s.id] = s; });
    var st = { seed: A.seed, ships: A.ships.map(function (s) { var b = Bm[s.id]; if (!b || !b.alive || !s.alive || s.p.distanceTo(b.p) > 40) return s; return { id: s.id, col: s.col, alive: s.alive, sh: s.sh, hit: s.hit, p: s.p.clone().lerp(b.p, u), q: s.q.clone().slerp(b.q, u) }; }), bul: A.bul, bombs: A.bombs, fx: A.fx, dtx: u / FPS };
    var who = st.ships.filter(function (s) { return s.id === c.id; })[0]; if (who) this.V.chase(who, dt, 14, 4, this.snap); this.snap = false;
    this.V.draw(st); return '\u25B6 REPLAY ' + (this.i + 1) + '/' + this.clips.length + ' \u00b7 ' + c.label; };
  root.OrbitReplay = { Recorder: Recorder, Player: Player };
})(window);
