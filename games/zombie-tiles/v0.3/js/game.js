/* =====================================================================
   ZOMBIE TILES - game engine (runs on the TV / host; the host is the authority)
   Phones and the hot-seat pad only send intents: game.intent(playerId, {t:...}).
   Works in the browser and in node (for fast simulation tests).
   ===================================================================== */
(function (root) {
  'use strict';
  var C = root.ZT_CONFIG, TL = root.ZT_TILES, S = C.tileSize;
  var DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  var OPP = { U: 'D', D: 'U', L: 'R', R: 'L' };
  var SIDE_OF_DIR = { U: 0, R: 1, D: 2, L: 3 };
  var SIDE_VEC = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  var SIDE_NAME = ['north', 'east', 'south', 'west'];

  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function key(x, y) { return x + ',' + y; }
  function man(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function ordinal(n) { return n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]); }

  function Game(opts) {
    opts = opts || {};
    this.speed = opts.speed == null ? 1 : opts.speed;
    this.schedule = opts.schedule || function (fn, ms) { setTimeout(fn, ms); };
    this.onChange = opts.onChange || function () {};
    this.onEvent = opts.onEvent || function () {};
    this.players = [];
    this.pidSeq = 0;
    this.gen = 0;
    this.version = 0;
    this.phase = 'lobby';
    this.messages = [];
    this.tiles = []; this.tileMap = {}; this.zombies = []; this.pickups = []; this.gates = {};
    this.plan = []; this.roll = null; this.fight = null; this.place = null;
  }
  var G = Game.prototype;

  // ------------------------------------------------------------ plumbing
  G.later = function (ms, fn) {
    var g = this.gen, self = this;
    this.schedule(function () { if (g === self.gen) fn.call(self); }, Math.round(ms * this.speed));
  };
  G.changed = function () { this.version++; this.onChange(this); };
  G.event = function (type, data) { this.onEvent(type, data || {}, this); };
  G.say = function (msg) { this.messages.push(msg); if (this.messages.length > 6) this.messages.shift(); this.lastMsg = msg; };
  G.r = function () { return this.rand(); };
  G.ri = function (a, b) { return a + Math.floor(this.rand() * (b - a + 1)); };
  G.d6 = function () { return 1 + Math.floor(this.rand() * 6); };
  G.pick = function (arr) { return arr[Math.floor(this.rand() * arr.length)]; };
  G.shuffle = function (arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(this.rand() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };

  // ------------------------------------------------------------ players / lobby
  function freshStats(p) {
    p.hearts = C.startHearts; p.weapon = 'none'; p.ammo = 0;
    p.status = 'alive'; p.place = 0; p.deathRound = null; p.deadOrder = 0; p.zid = null; p.kills = 0;
    if (!p.deadChoice) p.deadChoice = 'zombie';
  }
  G.addPlayer = function (o) {
    if (this.phase !== 'lobby' && this.phase !== 'over') return null;
    if (this.players.length >= C.maxPlayers) return null;
    var used = this.players.map(function (p) { return p.colorIdx; }), ci = 0;
    while (used.indexOf(ci) !== -1) ci++;
    var ai = null, AI = C.ai || { personas: {}, levels: {} };
    if (o.ai) {          // v0.3: computer player { persona, level }
      var per = AI.personas[o.ai.persona] ? o.ai.persona : (AI.order || Object.keys(AI.personas))[this.players.length % 5];
      ai = { persona: per, level: AI.levels[o.ai.level] ? o.ai.level : 'normal' };
      if (!o.name) {
        var taken = this.players.map(function (q) { return q.name; }), opts = (AI.personas[per].names || ['Bot']).filter(function (n) { return taken.indexOf(n) === -1; });
        o.name = opts[0] || ('Bot ' + (this.players.length + 1));
      }
      if (!o.dice) o.dice = AI.personas[per].dice;
    }
    var name = String(o.name || '').replace(/[^\w \-'!.?]/g, '').trim().slice(0, 12) || ('Player ' + (this.players.length + 1));
    var dice = C.dice.some(function (d) { return d.id === o.dice; }) ? o.dice : C.dice[this.players.length % C.dice.length].id;
    var p = { id: ++this.pidSeq, name: name, dice: dice, local: !!o.local, clientId: o.clientId || null, connected: true,
      colorIdx: ci, color: C.playerColors[ci], x: 0, y: 0, ai: ai };
    freshStats(p);
    this.players.push(p);
    this.changed();
    return p;
  };
  G.removePlayer = function (pid) {
    if (this.phase !== 'lobby' && this.phase !== 'over') return;
    this.players = this.players.filter(function (p) { return p.id !== pid; });
    this.changed();
  };
  G.byId = function (pid) { for (var i = 0; i < this.players.length; i++) if (this.players[i].id === pid) return this.players[i]; return null; };
  G.curP = function () { return this.players[this.cur]; };
  G.vip = function () { return this.players[0] || null; };

  // ------------------------------------------------------------ setup
  G.start = function (seed) {
    if (!this.players.length) return;
    this.gen++;
    this.phase = 'starting'; this.results = null;
    this.seed = seed == null ? Math.floor(Math.random() * 1e9) : seed;
    this.rand = mulberry(this.seed);
    this.tiles = []; this.tileMap = {}; this.zombies = []; this.pickups = []; this.gates = {}; this.gateSides = [];
    this.zSeq = 0; this.puSeq = 0; this.tileSeq = 0; this.rollSeq = 0; this.fightSeq = 0;
    this.round = 1; this.escaped = 0; this.deadSeq = 0; this.messages = []; this.lastMsg = '';
    this.plan = []; this.roll = null; this.fight = null; this.lastFight = null; this.place = null; this.movesLeft = 0;
    this.buildDeck();
    this.placeTile('spawn', 0, 0, 0);
    var starts = [[3, 3], [4, 3], [3, 4], [4, 4]];
    this.players.forEach(function (p, i) { freshStats(p); p.x = starts[i][0]; p.y = starts[i][1]; });
    this.cur = 0;
    this.say('The dead are walking. Find the helipad!');
    this.event('start');
    this.beginTurn();
  };
  G.buildDeck = function () {
    var pool = [], self = this;
    TL.pool.forEach(function (e) { for (var i = 0; i < e[1]; i++) pool.push(e[0]); });
    this.shuffle(pool);
    var n = C.deckSize - 1, deck = [];
    while (deck.length < n) { if (!pool.length) { TL.pool.forEach(function (e) { pool.push(e[0]); }); self.shuffle(pool); } deck.push(pool.pop()); }
    var lo = Math.ceil(C.deckSize * C.helipadEarliest), hi = C.deckSize - 1;   // 0-based draw position
    var at = Math.min(hi, this.ri(lo, hi));
    deck.splice(at, 0, 'helipad');
    this.deck = deck;
  };

  // ------------------------------------------------------------ board queries
  G.tileAt = function (tx, ty) { return this.tileMap[key(tx, ty)] || null; };
  G.tileAtSq = function (x, y) { return this.tileMap[key(Math.floor(x / S), Math.floor(y / S))] || null; };
  G.cell = function (x, y) {
    var t = this.tileAtSq(x, y);
    if (!t) return null;
    return t.grid[y - t.ty * S][x - t.tx * S];
  };
  G.walkable = function (x, y) { var c = this.cell(x, y); return !!(c && TL.WALK[c]); };
  G.zombieAt = function (x, y) { for (var i = 0; i < this.zombies.length; i++) { var z = this.zombies[i]; if (z.x === x && z.y === y) return z; } return null; };
  G.zombieById = function (id) { for (var i = 0; i < this.zombies.length; i++) if (this.zombies[i].id === id) return this.zombies[i]; return null; };
  G.livingAt = function (x, y) { return this.players.filter(function (p) { return p.status === 'alive' && p.x === x && p.y === y; }); };
  G.adjacentZombie = function (p) {
    var best = null;
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (man(z, p) === 1 && z.owner !== p.id) { if (!best || z.hp < best.hp) best = z; }
    }
    return best;
  };
  G.isExitSquare = function (x, y, d) {        // standing on an open-side exit, facing out?
    var t = this.tileAtSq(x, y); if (!t) return false;
    var side = SIDE_OF_DIR[d], lx = x - t.tx * S, ly = y - t.ty * S, mid = [S / 2 - 1, S / 2];
    if (!t.open[side]) return false;
    if (side === 0) return ly === 0 && mid.indexOf(lx) !== -1;
    if (side === 2) return ly === S - 1 && mid.indexOf(lx) !== -1;
    if (side === 1) return lx === S - 1 && mid.indexOf(ly) !== -1;
    return lx === 0 && mid.indexOf(ly) !== -1;
  };
  G.canExplore = function (x, y, d) {
    if (!this.deck.length || !this.isExitSquare(x, y, d)) return false;
    return !this.tileAtSq(x + DIRS[d][0], y + DIRS[d][1]);
  };
  G.livingCount = function () { return this.players.filter(function (p) { return p.status === 'alive'; }).length; };

  // ------------------------------------------------------------ tiles
  G.placeTile = function (tplId, rot, tx, ty) {
    var tpl = TL.byId[tplId], grid = TL.rotate(tpl.grid, rot);
    var tile = { id: ++this.tileSeq, tpl: tplId, name: tpl.name, rot: rot, tx: tx, ty: ty, w: S, h: S, grid: grid,
      open: TL.openSides(grid), helipad: !!tpl.helipad, order: this.tiles.length };
    this.tiles.push(tile);
    this.tileMap[key(tx, ty)] = tile;
    if (tile.helipad) this.setupGates(tile);
    this.spawnOn(tile, tpl);
    this.event('tile', { tile: tile });
    return tile;
  };
  G.setupGates = function (tile) {
    var sides = this.shuffle([0, 1, 2, 3]), yes = this.ri(C.gates.minYes, C.gates.maxYes), self = this;
    var sideObjs = [0, 1, 2, 3].map(function (s) { return { tileId: tile.id, side: s, yes: sides.indexOf(s) < yes, revealed: false, squares: [] }; });
    for (var ly = 0; ly < S; ly++) for (var lx = 0; lx < S; lx++) {
      if (tile.grid[ly][lx] !== 'G') continue;
      var s = ly === 1 ? 0 : ly === S - 2 ? 2 : lx === S - 2 ? 1 : 3;
      var gx = tile.tx * S + lx, gy = tile.ty * S + ly;
      sideObjs[s].squares.push([gx, gy]);
      self.gates[key(gx, gy)] = sideObjs[s];
    }
    this.gateSides = (this.gateSides || []).concat(sideObjs);
  };
  G.spawnOn = function (tile, tpl) {
    var self = this, exits = [], free = [], inner = [];
    for (var s = 0; s < 4; s++) if (tile.open[s]) {
      [S / 2 - 1, S / 2].forEach(function (i) {
        exits.push(s === 0 ? [i, 0] : s === 2 ? [i, S - 1] : s === 1 ? [S - 1, i] : [0, i]);
      });
    }
    for (var ly = 0; ly < S; ly++) for (var lx = 0; lx < S; lx++) {
      var c = tile.grid[ly][lx];
      if (!TL.WALK[c]) continue;
      var edge = lx === 0 || ly === 0 || lx === S - 1 || ly === S - 1;
      var isExit = exits.some(function (e) { return e[0] === lx && e[1] === ly; });
      var nearExit = exits.some(function (e) { return Math.abs(e[0] - lx) + Math.abs(e[1] - ly) <= 2; });
      if (tile.helipad) { if (edge && !isExit) free.push([lx, ly]); continue; }
      if (edge) continue;
      if (!nearExit) free.push([lx, ly]);
      inner.push([lx, ly, c]);
    }
    this.shuffle(free);
    var nz = this.ri(tpl.zombies[0], tpl.zombies[1]);
    for (var i = 0; i < nz && free.length; i++) {
      var f = free.pop();
      this.zombies.push({ id: ++this.zSeq, x: tile.tx * S + f[0], y: tile.ty * S + f[1], hp: C.zombie.hp, owner: null });
    }
    // pickups: anywhere inner & free, building floors 3x as likely
    var np = this.ri(tpl.pickups[0], tpl.pickups[1]);
    var cand = inner.filter(function (q) { return !self.zombieAt(tile.tx * S + q[0], tile.ty * S + q[1]); });
    var weighted = [];
    cand.forEach(function (q) { var w = (q[2] === '_' || q[2] === '%') ? 3 : 1; for (var k = 0; k < w; k++) weighted.push(q); });
    var taken = {};
    for (var j = 0; j < np && weighted.length; j++) {
      var q = this.pick(weighted), kq = key(q[0], q[1]);
      if (taken[kq]) { j--; weighted = weighted.filter(function (w) { return key(w[0], w[1]) !== kq; }); continue; }
      taken[kq] = 1;
      this.pickups.push({ id: ++this.puSeq, x: tile.tx * S + q[0], y: tile.ty * S + q[1], kind: this.rollPickup() });
    }
  };
  G.rollPickup = function () {
    var w = C.pickupWeights, tot = 0, k;
    for (k in w) tot += w[k];
    var r = this.r() * tot;
    for (k in w) { r -= w[k]; if (r < 0) return k; }
    return 'heart';
  };
  // empty slots touching an open side of a placed tile
  G.computeSlots = function (exploreSlot, fromSide) {
    var self = this, seen = {}, out = [];
    this.tiles.forEach(function (t) {
      for (var s = 0; s < 4; s++) {
        if (!t.open[s]) continue;
        var nx = t.tx + SIDE_VEC[s][0], ny = t.ty + SIDE_VEC[s][1], k = key(nx, ny);
        if (self.tileAt(nx, ny) || seen[k]) continue;
        seen[k] = 1;
        out.push({ tx: nx, ty: ny });
      }
    });
    var tpl = TL.byId[this.place.tpl];
    out.forEach(function (sl) {
      sl.rots = [];
      for (var rot = 0; rot < 4; rot++) {
        var open = TL.openSides(TL.rotate(tpl.grid, rot)), ok = false, must = true;
        for (var s = 0; s < 4; s++) {
          var nb = self.tileAt(sl.tx + SIDE_VEC[s][0], sl.ty + SIDE_VEC[s][1]);
          if (nb && nb.open[(s + 2) % 4] && open[s]) ok = true;
        }
        if (exploreSlot && sl.tx === exploreSlot.tx && sl.ty === exploreSlot.ty) must = open[(fromSide + 2) % 4];
        if (ok && must) sl.rots.push(rot);
      }
      sl.explore = !!(exploreSlot && sl.tx === exploreSlot.tx && sl.ty === exploreSlot.ty);
      sl.dist = exploreSlot ? Math.abs(sl.tx - exploreSlot.tx) + Math.abs(sl.ty - exploreSlot.ty) : 0;
    });
    out = out.filter(function (sl) { return sl.rots.length; });
    out.sort(function (a, b) { return a.dist - b.dist || a.ty - b.ty || a.tx - b.tx; });
    return out;
  };

  // ------------------------------------------------------------ turns
  G.eligible = function (p) {
    return p.status === 'alive' || (p.status === 'zombie' && !!this.zombieById(p.zid));
  };
  G.beginTurn = function () {
    if (this.checkOver()) return;
    var p = this.curP();
    this.plan = []; this.movesLeft = 0; this.roll = null; this.execSteps = 0; this.place = null; this.placedThisTurn = false;
    if (p.status === 'zombie') {
      this.phase = 'zturn';
      this.say(p.name + ' (zombie) lurches...');
      this.event('turn', { pid: p.id });
      this.changed();
      return;
    }
    var z = this.adjacentZombie(p);
    if (z) {
      this.say('A zombie grabs ' + p.name + '! Fight first.');
      this.event('turn', { pid: p.id });
      this.startFight(p, z, 'turnStart');
      return;
    }
    this.phase = 'roll';
    this.say(p.name + ': roll to move.');
    this.event('turn', { pid: p.id });
    this.changed();
  };
  G.toRoll = function () {
    var p = this.curP();
    var z = this.adjacentZombie(p);
    if (z) { this.startFight(p, z, 'turnStart'); return; }
    this.phase = 'roll'; this.say(p.name + ': roll to move.'); this.changed();
  };
  G.doRoll = function () {
    var p = this.curP(), d = [];
    for (var i = 0; i < C.moveDice; i++) d.push(this.d6());
    var tot = d.reduce(function (a, b) { return a + b; }, 0);
    this.roll = { pid: p.id, d: d, total: tot, seq: ++this.rollSeq, kind: 'move', dice: p.dice };
    this.phase = 'rolling';
    this.event('roll', { pid: p.id });
    this.changed();
    this.later(C.timing.roll, function () {
      this.movesLeft = tot; this.phase = 'plan';
      this.say(p.name + ' rolled ' + tot + '. Plan a path (0-' + tot + ' squares), then EXECUTE.');
      this.changed();
    });
  };
  G.endTurn = function () {
    this.phase = 'between'; this.plan = []; this.changed();
    this.later(C.timing.endTurn, this.nextPlayer);
  };
  G.nextPlayer = function () {
    if (this.checkOver()) return;
    var n = this.players.length, found = -1, wrapped = false;
    for (var k = 1; k <= n; k++) {
      var j = (this.cur + k) % n;
      if (this.cur + k >= n) wrapped = true;
      if (wrapped) break;
      if (this.eligible(this.players[j])) { found = j; break; }
    }
    if (found !== -1) { this.cur = found; this.beginTurn(); return; }
    // end of round
    this.endRound();
    if (this.checkOver()) return;
    for (var i = 0; i < n; i++) if (this.eligible(this.players[i])) { found = i; break; }
    if (found === -1) { this.finish(); return; }
    this.cur = found;
    this.phase = 'roundEnd'; this.changed();
    this.later(C.timing.roundEnd, this.beginTurn);
  };
  G.endRound = function () {
    var self = this, moved = 0;
    var occupied = {};
    this.players.forEach(function (p) { if (p.status === 'alive') { var t = self.tileAtSq(p.x, p.y); if (t) occupied[t.id] = 1; } });
    this.zombies.forEach(function (z) {
      if (z.owner) return;
      var t = self.tileAtSq(z.x, z.y);
      if (t && occupied[t.id]) return;
      if (self.r() >= C.zombie.roundShuffleChance) return;
      var dirs = self.shuffle(['U', 'D', 'L', 'R']);
      for (var i = 0; i < 4; i++) {
        var nx = z.x + DIRS[dirs[i]][0], ny = z.y + DIRS[dirs[i]][1];
        if (self.walkable(nx, ny) && !self.zombieAt(nx, ny) && !self.livingAt(nx, ny).length && !self.anyPlayerAt(nx, ny)) { z.x = nx; z.y = ny; moved++; break; }
      }
    });
    // the fallen rise
    this.players.forEach(function (p) {
      if (p.status === 'dead' && self.round >= p.deathRound + C.riseAfterRounds) self.rise(p);
    });
    this.round++;
    this.say('Round ' + this.round + '. The dead shuffle...');
    this.event('round', { round: this.round, moved: moved });
  };
  G.anyPlayerAt = function (x, y) { return this.players.some(function (p) { return (p.status === 'alive' || p.status === 'dead') && p.x === x && p.y === y; }); };
  G.rise = function (p) {
    var pos = this.freeNear(p.x, p.y);
    var z = { id: ++this.zSeq, x: pos.x, y: pos.y, hp: C.zombie.hp, owner: p.deadChoice === 'zombie' ? p.id : null, name: p.name, color: p.color };
    this.zombies.push(z);
    p.zid = z.id;
    p.status = z.owner ? 'zombie' : 'spectator';
    this.say(p.name + ' rises as a zombie!');
    this.event('rise', { pid: p.id });
  };
  G.freeNear = function (x, y) {
    var q = [[x, y]], seen = {}; seen[key(x, y)] = 1;
    while (q.length) {
      var c = q.shift();
      if (this.walkable(c[0], c[1]) && !this.zombieAt(c[0], c[1]) && !this.livingAt(c[0], c[1]).length) return { x: c[0], y: c[1] };
      for (var d in DIRS) {
        var nx = c[0] + DIRS[d][0], ny = c[1] + DIRS[d][1], k = key(nx, ny);
        if (!seen[k] && this.cell(nx, ny) !== null) { seen[k] = 1; q.push([nx, ny]); }
      }
    }
    return { x: x, y: y };
  };
  G.checkOver = function () {
    if (this.phase === 'over') return true;
    if (this.livingCount() === 0) { this.finish(); return true; }
    return false;
  };
  G.finish = function () {
    this.phase = 'over';
    this.results = this.computeResults();
    this.say(this.escaped ? 'The chopper lifts off!' : 'Nobody made it out. The horde wins.');
    this.event('over');
    this.changed();
  };
  G.computeResults = function () {
    var esc = this.players.filter(function (p) { return p.status === 'escaped'; }).sort(function (a, b) { return a.place - b.place; });
    var rest = this.players.filter(function (p) { return p.status !== 'escaped'; }).sort(function (a, b) { return b.deadOrder - a.deadOrder; });
    var out = [];
    esc.forEach(function (p) { out.push({ pid: p.id, name: p.name, color: p.color, place: p.place, label: ordinal(p.place) + ' - escaped!', escaped: true }); });
    rest.forEach(function (p) {
      out.push({ pid: p.id, name: p.name, color: p.color, place: 0, escaped: false,
        label: p.status === 'zombie' ? 'Joined the horde' : 'Left for dead' });
    });
    return out;
  };

  // ------------------------------------------------------------ planning
  G.planEnd = function () {
    var l = this.plan[this.plan.length - 1], p = this.curP();
    return l ? { x: l.x, y: l.y } : { x: p.x, y: p.y };
  };
  G.addDir = function (d) {
    var last = this.plan[this.plan.length - 1];
    if (last && last.d === OPP[d]) { this.plan.pop(); return 'undo'; }
    if (last && last.kind !== 'step') return false;
    if (this.plan.length >= this.movesLeft) return false;
    var f = this.planEnd(), nx = f.x + DIRS[d][0], ny = f.y + DIRS[d][1];
    var c = this.cell(nx, ny);
    if (c === null) {
      if (this.canExplore(f.x, f.y, d)) { this.plan.push({ x: nx, y: ny, d: d, kind: 'explore' }); return true; }
      return false;
    }
    if (c === 'G') {
      var g = this.gates[key(nx, ny)];
      if (g && !(g.revealed && !g.yes)) { this.plan.push({ x: nx, y: ny, d: d, kind: 'gate' }); return true; }
      return false;
    }
    if (!TL.WALK[c] || this.zombieAt(nx, ny)) return false;
    this.plan.push({ x: nx, y: ny, d: d, kind: 'step' });
    return true;
  };
  G.dangerAt = function (x, y) {     // would stepping here start a fight (with zombies where they are now)?
    var p = this.curP();
    for (var i = 0; i < this.zombies.length; i++) { var z = this.zombies[i]; if (z.owner !== (p && p.id) && Math.abs(z.x - x) + Math.abs(z.y - y) === 1) return true; }
    return false;
  };
  G.execute = function () {
    if (!this.plan.length) { this.say(this.curP().name + ' stays put.'); this.endTurn(); return; }
    this.phase = 'exec';
    this.changed();
    this.stepNext();
  };
  G.stepNext = function () {
    var p = this.curP();
    if (!this.plan.length) { this.endTurn(); return; }
    var s = this.plan.shift();
    if (s.kind === 'explore') { this.startPlacement(s); return; }
    if (s.kind === 'gate') { this.movesLeft--; this.tryGate(p, s); return; }
    if (this.zombieAt(s.x, s.y) || !this.walkable(s.x, s.y)) {
      this.say('Blocked! A zombie is in the way.');
      this.plan = []; this.phase = 'plan'; this.changed(); return;
    }
    p.x = s.x; p.y = s.y; this.movesLeft--; this.execSteps++;
    this.collect(p);
    this.event('step', { pid: p.id });
    this.changed();
    this.later(C.timing.step, function () {
      var z = this.adjacentZombie(p);
      if (z) { this.startFight(p, z, 'move'); return; }
      var lunged = (this.execSteps % C.zombie.lungeEvery === 0) ? this.zombiesLunge(p) : 0;
      if (!lunged) { this.stepNext(); return; }
      this.changed();
      this.later(C.timing.zombieStep, function () {
        var z2 = this.adjacentZombie(p);
        if (z2) this.startFight(p, z2, 'move'); else this.stepNext();
      });
    });
  };
  G.zombiesLunge = function (p) {
    var self = this, t = this.tileAtSq(p.x, p.y), n = 0;
    this.zombies.forEach(function (z) {
      if (z.owner || self.tileAtSq(z.x, z.y) !== t) return;
      var d0 = man(z, p);
      if (d0 <= 1 || d0 > C.zombie.lungeRange) return;
      var best = null;
      for (var d in DIRS) {
        var nx = z.x + DIRS[d][0], ny = z.y + DIRS[d][1];
        if (!self.walkable(nx, ny) || self.zombieAt(nx, ny) || self.anyPlayerAt(nx, ny)) continue;
        var dd = Math.abs(nx - p.x) + Math.abs(ny - p.y);
        if (dd < d0 && (!best || dd < best.dd)) best = { x: nx, y: ny, dd: dd };
      }
      if (best) { z.x = best.x; z.y = best.y; n++; }
    });
    if (n) { this.say(n === 1 ? 'A zombie lurches toward ' + p.name + '!' : n + ' zombies lurch toward ' + p.name + '!'); this.event('lunge', { n: n }); }
    return n;
  };
  G.collect = function (p) {
    var self = this, W = C.weapons;
    this.pickups = this.pickups.filter(function (it) {
      if (it.x !== p.x || it.y !== p.y) return true;
      var k = it.kind;
      if (k === 'heart') {
        if (p.hearts >= C.maxHearts) return true;
        p.hearts++; self.say(p.name + ' patches up (+1 heart).'); self.event('pickup', { pid: p.id, kind: k }); return false;
      }
      if (k === 'ammo') {
        p.ammo = Math.min(C.maxAmmo, p.ammo + C.ammoClipRounds); self.say(p.name + ' grabs an ammo clip.'); self.event('pickup', { pid: p.id, kind: k, private: true }); return false;
      }
      if (W[k]) {
        if (k === p.weapon && W[k].gun) {
          p.ammo = Math.min(C.maxAmmo, p.ammo + W[k].clip); self.say(p.name + ' reloads from a spare ' + W[k].label.toLowerCase() + '.'); self.event('pickup', { pid: p.id, kind: k }); return false;
        }
        if (W[k].rank > W[p.weapon].rank) {
          p.weapon = k; if (W[k].gun) p.ammo = Math.min(C.maxAmmo, p.ammo + W[k].clip);
          self.say(p.name + ' picks up a ' + W[k].label.toLowerCase() + '!'); self.event('pickup', { pid: p.id, kind: k }); return false;
        }
      }
      return true;
    });
  };

  // ------------------------------------------------------------ tile placement
  G.startPlacement = function (step) {
    var p = this.curP(), tpl = this.deck.shift();
    var from = this.tileAtSq(p.x, p.y), exploreSlot = { tx: Math.floor(step.x / S), ty: Math.floor(step.y / S) };
    var fromSide = SIDE_OF_DIR[step.d];   // side of the CURRENT tile we walk out of
    this.place = { tpl: tpl, rot: 0, slots: [], idx: 0, step: step, exploreSlot: exploreSlot, fromSide: fromSide, fromTile: from && from.id };
    this.place.slots = this.computeSlots(exploreSlot, fromSide);
    if (!this.place.slots.length) {
      this.deck.push(tpl); this.place = null; this.say('That tile fits nowhere. It goes to the bottom of the deck.');
      this.plan = []; this.phase = 'plan'; this.changed(); return;
    }
    this.place.idx = 0;
    this.place.rot = this.place.slots[0].rots[0];
    this.phase = 'place';
    this.say(p.name + ' found ' + (tpl === 'helipad' ? 'THE HELIPAD!' : 'a new tile: ' + TL.byId[tpl].name) + ' Rotate it, then place.');
    this.event('draw', { tpl: tpl });
    this.changed();
  };
  G.placeRotate = function (dir) {
    var sl = this.place.slots[this.place.idx], i = sl.rots.indexOf(this.place.rot);
    this.place.rot = sl.rots[(i + dir + sl.rots.length) % sl.rots.length];
    this.changed();
  };
  G.placeSlot = function (dir) {
    var P = this.place, n = P.slots.length;
    P.idx = (P.idx + dir + n) % n;
    var sl = P.slots[P.idx];
    if (sl.rots.indexOf(P.rot) === -1) P.rot = sl.rots[0];
    this.changed();
  };
  G.placeConfirm = function () {
    var P = this.place, sl = P.slots[P.idx];
    var tile = this.placeTile(P.tpl, P.rot, sl.tx, sl.ty);
    this.place = null; this.placedThisTurn = true;     // placing a tile ends the turn (after stepping onto it / any fight there)
    if (sl.explore && (this.zombieAt(P.step.x, P.step.y) || !this.walkable(P.step.x, P.step.y))) {
      this.say('Blocked! A zombie is in the way. ' + this.curP().name + ' stays on the edge. Turn over.');
      this.endTurn();
    } else if (sl.explore) {
      this.plan.unshift({ x: P.step.x, y: P.step.y, d: P.step.d, kind: 'step' });
      this.phase = 'exec';
      this.changed();
      this.later(C.timing.step, this.stepNext);
    } else {
      // Placing a tile always ends the turn (v0.3.1). Placed somewhere other than where you walked? You stay on the
      // edge and can explore it (or go another way) on a later turn.
      this.say('Tile placed. ' + this.curP().name + ' stays on the edge. Turn over.');
      this.endTurn();
    }
    return tile;
  };

  // ------------------------------------------------------------ helipad gates
  G.tryGate = function (p, s) {
    var g = this.gates[key(s.x, s.y)];
    g.revealed = true;
    this.event('gate', { yes: g.yes, side: g.side, pid: p.id });
    if (g.yes) {
      p.status = 'escaped'; p.place = ++this.escaped;
      p.x = s.x; p.y = s.y;
      this.say('The ' + SIDE_NAME[g.side] + ' guard says YES! ' + p.name + ' escapes ' + ordinal(p.place) + '!');
      this.event('escape', { pid: p.id, place: p.place });
      this.phase = 'escape'; this.plan = [];
      this.changed();
      this.later((C.escapeShow && C.escapeShow.ms) || C.timing.banner * 1.4, this.endTurn);   // the TV plays the helicopter cinematic meanwhile
    } else {
      this.say('The ' + SIDE_NAME[g.side] + ' guard says NO! Try another gate.');
      this.plan = []; this.phase = 'plan';
      this.changed();
    }
  };

  // ------------------------------------------------------------ fights
  G.startFight = function (p, z, context, attacker) {
    this.fight = { seq: ++this.fightSeq, pid: p.id, zid: z.id, context: context, stage: 'await',
      attackerPid: attacker ? attacker.id : null, zname: z.owner ? (this.byId(z.owner) || {}).name : null,
      savedPlan: this.plan.slice(), weapon: p.weapon, x: z.x, y: z.y, px: p.x, py: p.y };
    this.plan = [];
    this.phase = 'fight';
    this.say(attacker ? attacker.name + ' (zombie) attacks ' + p.name + '!' : 'FIGHT! ' + p.name + ' vs a zombie.');
    this.event('fightStart', { pid: p.id });
    this.changed();
  };
  G.fightRoll = function () {
    var f = this.fight, p = this.byId(f.pid), z = this.zombieById(f.zid), W = C.weapons, F = C.fight;
    if (!z) { this.fight = null; this.phase = 'plan'; this.changed(); return; }
    var w = W[p.weapon], bonus = w.bonus, used = 0, note = '';
    if (w.gun) {
      if (p.ammo > 0) { used = Math.min(w.ammoPerFight, p.ammo); note = used > 1 ? used + '-round burst' : 'BANG'; }
      else { bonus = 0; note = 'click! no ammo'; }
    }
    var pd = [], zd = [], i;
    for (i = 0; i < F.playerDice; i++) pd.push(this.d6());
    for (i = 0; i < F.zombieDice; i++) zd.push(this.d6());
    var pt = pd.reduce(function (a, b) { return a + b; }, 0) + bonus, zt = zd.reduce(function (a, b) { return a + b; }, 0);
    var margin = pt - zt, weak = p.hearts <= F.weakHearts, clean = weak ? F.cleanMarginWeak : F.cleanMargin, outcome, lost = 0, zdmg = 0;
    if (margin >= clean) { outcome = 'clean'; zdmg = z.hp; }
    else if (margin > 0) { outcome = 'trade'; zdmg = z.hp; lost = 1; }
    else if (margin === 0) { outcome = 'struggle'; zdmg = 1; lost = 1; }
    else { outcome = 'loss'; lost = Math.min(-margin, F.maxHeartsLost); }
    Object.assign(f, { stage: 'rolling', p: pd, z: zd, bonus: bonus, weapon: p.weapon, ammoUsed: used, note: note, ptotal: pt, ztotal: zt,
      margin: margin, weak: weak, clean: clean, outcome: outcome, lost: lost, zdmg: zdmg, dice: p.dice, rollAt: Date.now() });
    this.event('fightRoll', { pid: p.id });
    this.changed();
    this.later(C.timing.roll, function () {
      p.ammo -= used;
      p.hearts = Math.max(0, p.hearts - lost);
      z.hp -= zdmg;
      var zdead = z.hp <= 0;
      if (zdead) {
        this.zombies = this.zombies.filter(function (q) { return q !== z; });
        p.kills++;
        if (z.owner) { var owner = this.byId(z.owner); if (owner) { owner.status = 'spectator'; owner.zid = null; } }
      }
      var texts = {
        clean: 'CLEAN KILL!',
        trade: 'ZOMBIE DOWN... but you got bitten (-1 heart)',
        struggle: 'STRUGGLE! Both hurt (-1 heart). Your move ends.',
        loss: 'OVERWHELMED! -' + lost + ' heart' + (lost === 1 ? '' : 's') + '. Your move ends.'
      };
      f.title = { clean: 'CLEAN KILL!', trade: 'ZOMBIE DOWN!', struggle: 'STRUGGLE!', loss: 'OVERWHELMED!' }[outcome];
      f.text = texts[outcome];
      if (outcome === 'struggle' && zdead) f.text = 'STRUGGLE... and the zombie drops! (-1 heart). Your move ends.';
      f.zdead = zdead;
      if (w.gun && C.dropEmptyGuns && p.ammo <= 0 && used > 0) { f.dropped = p.weapon; p.weapon = 'none'; f.text += ' Out of ammo: ' + w.short + ' tossed.'; }
      if (p.hearts <= 0) f.text = 'LEFT FOR DEAD...';
      f.stage = 'result';
      this.say(p.name + ': ' + f.text);
      this.event('fightResult', { pid: p.id, outcome: outcome });
      this.changed();
      this.later(C.timing.fightResult, this.finishFight);
    });
  };
  G.finishFight = function () {
    var f = this.fight, p = this.byId(f.pid);
    this.lastFight = f; this.fight = null;
    var won = f.outcome === 'clean' || f.outcome === 'trade';
    if (p.hearts <= 0) { this.killPlayer(p); this.changed(); this.later(C.timing.banner, this.endTurn); return; }
    if (f.context === 'zombieAttack') { this.endTurn(); return; }
    if (!won) { this.endTurn(); return; }
    var z = this.adjacentZombie(p);
    if (z) { this.startFight(p, z, f.context); return; }
    if (f.context === 'turnStart') { this.toRoll(); return; }
    if (this.placedThisTurn) { this.endTurn(); return; }          // won on the tile you just placed: the turn still ends
    // won during a move: you get your remaining squares back (the old plan is restored where still valid)
    this.phase = 'plan'; this.plan = [];
    for (var i = 0; i < f.savedPlan.length; i++) { if (this.addDir(f.savedPlan[i].d) !== true) break; }
    if (this.plan.length && this.plan[this.plan.length - 1].d !== f.savedPlan[this.plan.length - 1].d) this.plan.pop();
    this.say(p.name + ' has ' + this.movesLeft + ' moves left. EXECUTE to carry on.');
    this.changed();
  };
  G.shareAmmo = function (from, to, n) {      // v0.3 alliances: hand ammo to a living player on your square or next to you
    n = Math.min(n | 0, from.ammo, C.maxAmmo - to.ammo);
    if (!to || to === from || to.status !== 'alive' || man(from, to) > 1 || n <= 0) return false;
    from.ammo -= n; to.ammo += n;
    this.say(from.name + ' shares ' + n + ' ammo with ' + to.name + '.');
    this.event('share', { pid: from.id, to: to.id, n: n });
    this.changed();
    return true;
  };
  G.killPlayer = function (p) {
    p.status = 'dead'; p.hearts = 0; p.deathRound = this.round; p.deadOrder = ++this.deadSeq; p.weapon = 'none';
    this.say(p.name + ' is left for dead...');
    this.event('death', { pid: p.id });
  };

  // ------------------------------------------------------------ player-zombies
  G.zombieRoll = function () {
    var p = this.curP(), d = this.d6(), z = this.zombieById(p.zid);
    var steps = d <= 3 ? C.zombie.playerZombieSteps[0] : C.zombie.playerZombieSteps[1];
    this.roll = { pid: p.id, d: [d], total: steps, seq: ++this.rollSeq, kind: 'zombie', dice: p.dice };
    this.phase = 'zmoving';
    this.changed();
    this.later(C.timing.roll, function () { this.zombieMove(p, z, steps); });
  };
  G.zombieMove = function (p, z, steps) {
    if (!z || this.zombies.indexOf(z) === -1) { this.endTurn(); return; }
    var target = this.adjacentLiving(z);
    if (target) { this.startFight(target, z, 'zombieAttack', p); return; }
    if (steps <= 0) { this.endTurn(); return; }
    var pref = p.ai ? this.huntTarget(p, z) : null;          // AI zombies hunt in their own style (humans: nearest)
    var path = (pref && this.pathToLiving(z, pref)) || this.pathToLiving(z);
    if (!path || !path.length) { this.say(p.name + ' (zombie) groans. Nobody in reach.'); this.endTurn(); return; }
    z.x = path[0][0]; z.y = path[0][1];
    this.changed();
    this.later(C.timing.step, function () { this.zombieMove(p, z, steps - 1); });
  };
  G.adjacentLiving = function (z) {
    for (var i = 0; i < this.players.length; i++) { var q = this.players[i]; if (q.status === 'alive' && man(q, z) === 1) return q; }
    return null;
  };
  G.huntTarget = function (p, z) {
    var per = C.ai && p.ai && C.ai.personas[p.ai.persona], style = per ? per.hunt : 'nearest', W = C.weapons;
    var living = this.players.filter(function (q) { return q.status === 'alive'; });
    if (!living.length || style === 'nearest') return null;
    var score = style === 'weakest' ? function (q) { return -q.hearts * 10 - man(q, z) * 0.01; }
      : function (q) { return q.hearts + W[q.weapon].rank * 1.5 + q.kills - man(q, z) * 0.01; };
    living.sort(function (a, b) { return score(b) - score(a); });
    return living[0].id;
  };
  G.pathToLiving = function (z, onlyPid) {
    var self = this, goal = {};
    this.players.forEach(function (q) {
      if (q.status !== 'alive' || (onlyPid && q.id !== onlyPid)) return;
      for (var d in DIRS) goal[key(q.x + DIRS[d][0], q.y + DIRS[d][1])] = 1;
    });
    var q = [[z.x, z.y]], prev = {}; prev[key(z.x, z.y)] = null;
    while (q.length) {
      var c = q.shift(), kc = key(c[0], c[1]);
      if (goal[kc] && !(c[0] === z.x && c[1] === z.y)) {
        var path = [], k = kc;
        while (prev[k]) { var xy = k.split(',').map(Number); path.unshift(xy); k = prev[k]; }
        return path;
      }
      for (var d2 in DIRS) {
        var nx = c[0] + DIRS[d2][0], ny = c[1] + DIRS[d2][1], kn = key(nx, ny);
        if (kn in prev) continue;
        if (!self.walkable(nx, ny) || self.zombieAt(nx, ny) || self.anyPlayerAt(nx, ny)) continue;
        prev[kn] = kc; q.push([nx, ny]);
      }
    }
    return null;
  };

  // ------------------------------------------------------------ intents
  G.actorId = function () {
    var p = this.curP();
    switch (this.phase) {
      case 'roll': case 'plan': case 'place': case 'zturn': return p ? p.id : null;
      case 'fight': return this.fight && this.fight.stage === 'await' ? this.fight.pid : null;
      default: return null;
    }
  };
  G.intent = function (pid, m) {
    var p = this.byId(pid);
    if (!p || !m) return false;
    if (m.t === 'dice') { if (C.dice.some(function (d) { return d.id === m.id; })) { p.dice = m.id; this.changed(); } return true; }
    if (m.t === 'name') { if (this.phase === 'lobby') { p.name = String(m.name || '').slice(0, 12) || p.name; this.changed(); } return true; }
    if (m.t === 'deadChoice') {
      if (p.status === 'dead') p.deadChoice = m.v === 'spectate' ? 'spectate' : 'zombie';
      else if (p.status === 'zombie' && m.v === 'spectate') {
        p.deadChoice = 'spectate'; p.status = 'spectator';
        var z = this.zombieById(p.zid); if (z) z.owner = null;
        if (this.phase === 'zturn' && this.curP() === p) this.endTurn();
      }
      this.changed(); return true;
    }
    if (m.t === 'start') { if ((this.phase === 'lobby' || this.phase === 'over') && this.players.length) { this.start(m.seed); return true; } return false; }
    if (m.t === 'share') {     // on your own turn: before rolling, or right after your move
      var mine = (this.actorId() === pid && (this.phase === 'roll' || (this.phase === 'plan' && !this.plan.length))) || (this.phase === 'between' && this.curP() === p && p.status === 'alive');
      return mine && this.shareAmmo(p, this.byId(m.to), m.n);
    }
    if (this.actorId() !== pid) return false;
    switch (this.phase) {
      case 'roll': if (m.t === 'roll' || m.t === 'exec') { this.doRoll(); return true; } return false;
      case 'plan':
        if (m.t === 'dir' && DIRS[m.d]) { var r = this.addDir(m.d); this.changed(); if (!r) this.event('bump', { pid: pid }); return !!r; }
        if (m.t === 'undo') { this.plan.pop(); this.changed(); return true; }
        if (m.t === 'clear') { this.plan = []; this.changed(); return true; }
        if (m.t === 'exec') { this.execute(); return true; }
        return false;
      case 'place':
        if (m.t === 'dir') { if (m.d === 'L' || m.d === 'R') this.placeRotate(m.d === 'R' ? 1 : -1); else this.placeSlot(m.d === 'D' ? 1 : -1); return true; }
        if (m.t === 'rot') { this.placeRotate(m.v || 1); return true; }
        if (m.t === 'exec') { this.placeConfirm(); return true; }
        return false;
      case 'fight': if (m.t === 'roll' || m.t === 'exec') { this.fightRoll(); return true; } return false;
      case 'zturn': if (m.t === 'roll' || m.t === 'exec') { this.zombieRoll(); return true; } return false;
    }
    return false;
  };

  // ------------------------------------------------------------ simple bot (tests + demo): returns a list of dirs to press
  G.botPlan = function () {
    var p = this.curP(), self = this, budget = this.movesLeft;
    if (!p || this.phase !== 'plan') return [];
    // Dijkstra: cost 1 per step, +3 if the square is next to a zombie (try to avoid fights a bit)
    var start = key(p.x, p.y), dist = {}, prev = {}, open = [[0, p.x, p.y, 0]];
    dist[start] = 0;
    var goals = [];
    while (open.length) {
      open.sort(function (a, b) { return a[0] - b[0]; });
      var c = open.shift(), kc = key(c[1], c[2]);
      if (c[0] > dist[kc]) continue;
      for (var d in DIRS) {
        var nx = c[1] + DIRS[d][0], ny = c[2] + DIRS[d][1], kn = key(nx, ny), ch = this.cell(nx, ny);
        if (ch === null) { if (this.canExplore(c[1], c[2], d)) goals.push({ cost: c[0] + 1, steps: c[3] + 1, from: kc, d: d, kind: 'explore' }); continue; }
        if (ch === 'G') { var g = this.gates[kn]; if (g && !(g.revealed && !g.yes)) goals.push({ cost: c[0] + 1 - (g.yes && g.revealed ? 50 : 20), steps: c[3] + 1, from: kc, d: d, kind: 'gate' }); continue; }
        if (!TL.WALK[ch]) continue;
        var nc = c[0] + 1 + (this.dangerAt(nx, ny) ? 3 : 0) + (this.zombieAt(nx, ny) ? 8 : 0);
        if (dist[kn] == null || nc < dist[kn]) { dist[kn] = nc; prev[kn] = { k: kc, d: d }; open.push([nc, nx, ny, c[3] + 1]); }
      }
    }
    if (!goals.length) return [];
    goals.sort(function (a, b) { return a.cost - b.cost; });
    var gl = goals[0], dirs = [gl.d], k = gl.from;
    while (prev[k]) { dirs.unshift(prev[k].d); k = prev[k].k; }
    // stop before any zombie square: walking next to it starts the fight that clears the way
    var x = p.x, y = p.y, out = [];
    for (var i = 0; i < dirs.length && out.length < budget; i++) {
      x += DIRS[dirs[i]][0]; y += DIRS[dirs[i]][1];
      if (this.zombieAt(x, y)) break;
      out.push(dirs[i]);
    }
    return out;
  };

  Game.DIRS = DIRS; Game.OPP = OPP; Game.SIDE_VEC = SIDE_VEC; Game.ordinal = ordinal; Game.key = key;
  root.ZTGame = Game;
})(typeof window !== 'undefined' ? window : globalThis);
