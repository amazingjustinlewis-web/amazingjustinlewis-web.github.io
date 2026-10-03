/* =====================================================================
   ZOMBIE TILES - AI players (v0.3)
   Personalities + difficulty, path planning, tile placement, ammo sharing, coach hints, reaction lines.
   The AI only sends the same intents a phone would (roll / dir / exec ...), so the rules are the same for everyone.
   Works in the browser and in node (simulation tests).
   ===================================================================== */
(function (root) {
  'use strict';
  var C = root.ZT_CONFIG, TL = root.ZT_TILES, Game = root.ZTGame, A = C.ai, W = C.weapons;
  var DIRS = Game.DIRS, key = Game.key;
  var ARROW = { U: '\u2191', D: '\u2193', L: '\u2190', R: '\u2192' };
  var MAXSTEPS = 400;

  function mulberry(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function man(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  // ------------------------------------------------------------ fight odds (player 2d6 + weapon vs zombie 2d6)
  var DIFF = (function () {
    var d = {}, a, b, c, e;
    for (a = 1; a <= 6; a++) for (b = 1; b <= 6; b++) for (c = 1; c <= 6; c++) for (e = 1; e <= 6; e++) { var k = a + b - c - e; d[k] = (d[k] || 0) + 1 / 1296; }
    return d;
  })();
  function fightOdds(p) {
    var w = W[p.weapon], bonus = w.bonus, F = C.fight;
    if (w.gun && p.ammo <= 0) bonus = 0;
    var clean = p.hearts <= F.weakHearts ? F.cleanMarginWeak : F.cleanMargin, win = 0, cl = 0, lost = 0;
    for (var k in DIFF) {
      var m = +k + bonus, pr = DIFF[k];
      if (m >= clean) cl += pr;
      if (m > 0) win += pr;
      lost += pr * (m >= clean ? 0 : m > 0 ? 1 : m === 0 ? 1 : Math.min(-m, F.maxHeartsLost));
    }
    return { win: win, clean: cl, expLost: lost, bonus: bonus };
  }

  // ------------------------------------------------------------ tiny binary heap for Dijkstra
  function Heap() { this.a = []; }
  Heap.prototype.push = function (n) {
    var a = this.a, i = a.length; a.push(n);
    while (i > 0) { var j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; var t = a[i]; a[i] = a[j]; a[j] = t; i = j; }
  };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; var i = 0;
      for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; var t = a[i]; a[i] = a[m]; a[m] = t; i = m; }
    }
    return top;
  };

  function brain(p) {
    var ai = p.ai || p.aiTakeover || { persona: 'buddy', level: 'normal' };
    return { P: A.personas[ai.persona] || A.personas.buddy, L: A.levels[ai.level] || A.levels.normal, ai: ai };
  }
  function shareable(p, ally) {      // partner has a gun running low, and I have ammo to spare
    return W[ally.weapon].gun && ally.ammo < 6 && (W[p.weapon].gun ? p.ammo >= 6 : p.ammo >= 2);
  }
  function itemValue(p, kind, w) {
    if (kind === 'heart') return p.hearts >= C.maxHearts ? 0 : ((C.maxHearts - p.hearts) * 1.6 + 1) * w.heart;
    if (kind === 'ammo') return p.ammo >= C.maxAmmo ? 0 : (W[p.weapon].gun ? (p.ammo < 6 ? 4.5 : 2) : 1.2) * w.loot;
    var k = W[kind]; if (!k) return 0;
    if (k.rank > W[p.weapon].rank) return (2.5 + (k.rank - W[p.weapon].rank) * 2.5) * w.loot;
    if (kind === p.weapon && k.gun && p.ammo < C.maxAmmo) return 2 * w.loot;
    return 0;
  }

  // ------------------------------------------------------------ path planning
  // returns { dirs: ['U','R',...], why: loot|heart|explore|gate|fight|stay, item, reach: true if the goal is reached this turn }
  function plan(g, p, rng, opts) {
    opts = opts || {};
    var b = brain(p), P = opts.coach ? A.personas.buddy : b.P, L = opts.coach ? A.levels.ruthless : b.L, w = P.w;
    var noise = function () { return L.noise ? 1 + L.noise * (rng() * 2 - 1) : 1; };
    var odds = fightOdds(p), win = clamp01(odds.win + (L.oddsErr ? (rng() * 2 - 1) * L.oddsErr : 0));
    var budget = g.movesLeft, F = C.fight;
    var hurt = p.hearts <= F.weakHearts ? 2.2 : p.hearts <= 3 ? 1.4 : 1;
    var care = L.care == null ? 1 : L.care;
    var risk = (odds.expLost * w.danger * hurt * 2.2 + (p.hearts <= odds.expLost + 0.6 ? 6 * w.danger : 0)) * care;
    var wantFight = win >= P.minOdds && p.hearts > F.weakHearts;
    var fightValue = wantFight ? w.fight * (3 + 7 * (win - 0.5)) : 0;
    var helipad = g.tiles.some(function (t) { return t.helipad; });
    var pickAt = {}; g.pickups.forEach(function (it) { pickAt[key(it.x, it.y)] = it; });
    var ally = !opts.coach && p.ai && p.allyPid ? g.byId(p.allyPid) : null, nearAlly = {};     // walk over to share ammo with a partner who needs it
    if (ally && ally.status === 'alive' && shareable(p, ally) && P.share > 0.25) {
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { nearAlly[key(ally.x + o[0], ally.y + o[1])] = 1; });
    }
    var start = key(p.x, p.y), best = {}, prev = {}, steps = {}, h = new Heap(), cands = [];
    best[start] = 0; steps[start] = 0; h.push([0, p.x, p.y]);
    while (h.a.length) {
      var c = h.pop(), kc = key(c[1], c[2]);
      if (c[0] > best[kc]) continue;
      var st = steps[kc], danger = kc !== start && g.dangerAt(c[1], c[2]);
      if (kc !== start) {
        var it = pickAt[kc], v;
        if (it && (v = itemValue(p, it.kind, w)) > 0) cands.push({ k: kc, cost: c[0], steps: st, v: v * noise(), why: it.kind === 'heart' ? 'heart' : 'loot', item: it.kind });
        if (nearAlly[kc]) cands.push({ k: kc, cost: c[0], steps: st, v: 5 * P.share * noise(), why: 'ally' });
        if (danger && fightValue > 0) cands.push({ k: kc, cost: c[0] - risk, steps: st, v: fightValue * noise(), why: 'fight' });
      }
      if (st >= MAXSTEPS) continue;
      for (var d in DIRS) {
        var nx = c[1] + DIRS[d][0], ny = c[2] + DIRS[d][1], kn = key(nx, ny), ch = g.cell(nx, ny);
        if (ch === null) {
          if (g.canExplore(c[1], c[2], d)) cands.push({ k: kc, d: d, cost: c[0] + 1, steps: st + 1, v: (helipad ? 1 : 4) * w.explore * noise(), why: 'explore' });
          continue;
        }
        if (ch === 'G') {
          var gt = g.gates[kn];
          if (gt && !(gt.revealed && !gt.yes)) cands.push({ k: kc, d: d, cost: c[0] + 1, steps: st + 1, v: (gt.revealed ? 45 : 14) * w.helipad * noise(), why: 'gate' });
          continue;
        }
        if (!TL.WALK[ch] || (g.zombieAt(nx, ny) && !opts.through)) continue;
        var nc = c[0] + 1 + (g.dangerAt(nx, ny) ? risk : 0) + (g.zombieAt(nx, ny) ? 12 : 0);
        if (best[kn] == null || nc < best[kn]) { best[kn] = nc; prev[kn] = { k: kc, d: d }; steps[kn] = st + 1; h.push([nc, nx, ny]); }
      }
    }
    if (!cands.length) {
      if (opts.through) return { dirs: [], why: 'stay', reach: true };
      // boxed in by zombies: plan through them; the move stops next to the zombie and the fight clears the way
      var o2 = {}; for (var ok in opts) o2[ok] = opts[ok]; o2.through = true;
      var r2 = plan(g, p, rng, o2), x = p.x, y = p.y, cut = [];
      for (var q = 0; q < r2.dirs.length; q++) { x += DIRS[r2.dirs[q]][0]; y += DIRS[r2.dirs[q]][1]; if (g.zombieAt(x, y)) break; cut.push(r2.dirs[q]); }
      return { dirs: cut, why: cut.length ? 'fight' : 'stay', reach: false, win: odds.win };
    }
    cands.forEach(function (cd) { cd.score = cd.v * (cd.steps <= budget ? 1 : 0.75) - cd.cost * 0.35; });
    cands.sort(function (a, b2) { return b2.score - a.score; });
    var pickI = 0;
    if (L.slip && rng() < L.slip && cands.length > 1) pickI = 1 + Math.floor(rng() * Math.min(3, cands.length - 1));
    var gl = cands[pickI], dirs = gl.d ? [gl.d] : [], k = gl.k;
    while (prev[k]) { dirs.unshift(prev[k].d); k = prev[k].k; }
    var reach = dirs.length <= budget;
    if (!reach) { dirs = dirs.slice(0, budget); if (gl.d) { /* explore / gate step only counts when actually reached */ } }
    return { dirs: dirs, why: gl.why, item: gl.item, reach: reach, win: odds.win };
  }

  // ------------------------------------------------------------ tile placement: the explore spot, rotated for the most new exits.
  // If the tile can't go where the AI walked, it goes in the nearest open spot (slots come sorted by distance); placing ends the turn either way.
  function placeChoice(g, p, rng) {
    var P = g.place, idx = 0, b = brain(p);
    for (var i = 0; i < P.slots.length; i++) if (P.slots[i].explore) { idx = i; break; }
    var sl = P.slots[idx], tpl = TL.byId[P.tpl], bestRot = sl.rots[0], bestS = -1;
    sl.rots.forEach(function (rot) {
      var open = TL.openSides(TL.rotate(tpl.grid, rot)), s = 0;
      for (var q = 0; q < 4; q++) if (open[q] && !g.tileAt(sl.tx + Game.SIDE_VEC[q][0], sl.ty + Game.SIDE_VEC[q][1])) s++;
      s = s * (b.P.w.explore) + (b.L.noise ? rng() * b.L.noise * 2 : rng() * 0.01);
      if (s > bestS) { bestS = s; bestRot = rot; }
    });
    return { idx: idx, rot: bestRot };
  }

  // ------------------------------------------------------------ reaction lines (kid-friendly)
  var LINES = {
    think: { loot: ['Ooh, shiny!', 'Mine, all mine!', 'Loot time!'], heart: ['I need a bandage.', 'Medkit, please!'], explore: ["What's over there?", 'Onward!', 'New street!'],
      gate: ['Helipad, here I come!', 'Chopper time!'], fight: ['Zombie! Come here!', 'Fight me, stinky!'], stay: ["I'll wait here...", 'Nope. Staying put.'],
      ally: ['Wait up, {ally}!', 'Coming, {ally}!'] },
    charge: ['CHAAARGE!', 'HI-YAH!', 'Take THAT!', 'For pizza!'],
    scream: ['EEEK!', 'AAAH!', 'Help!', 'Not the face!'],
    hit: ['Ouch!', 'Ow ow ow!', 'That stings!'],
    kill: ['Got one!', 'Boom!', 'Yes!!', 'Easy peasy!'],
    share: ['Here {ally}, take some ammo!', 'Ammo for my buddy {ally}!'],
    betray: ['Sorry {ally}, seats for one!', 'Bye {ally}! Ha ha!'],
    loyal: ['Hurry up, {ally}!', 'Save a seat for {ally}!'],
    escape: ['See ya, zombies!', 'Woo-hoo!'],
    death: ['Tell my mum...', 'Bleh...'],
    rise: ['Braaains... I mean, hi!', 'Grrr!'],
    gateNo: ['Aww, come on!', 'Rude!'],
    pickup: ['Nice!', 'Score!']
  };
  var PERSONA_LINES = {
    fighter: { charge: ['CHAAARGE!', 'Smash time!', 'Come here, zombie!'], think: { fight: ['Who wants a punch?', 'Zombie! Yesss!'] }, kill: ['Next!', 'Too easy!'] },
    looter: { think: { loot: ['Treasure!', 'I can carry that.', 'Ooh, for my collection!'] }, scream: ['Eek! Not my stuff!', 'AAAH!'] },
    sprinter: { think: { explore: ['Faster, faster!', 'Gotta go fast!'], gate: ['Last one there is a zombie!'] } },
    sneak: { betray: ['Sorry {ally}, nothing personal!', 'Heh heh. Bye {ally}!'], think: { loot: ['Nobody saw that...'] } },
    buddy: { loyal: ['Come on {ally}, we can do it!'], share: ['Sharing is caring, {ally}!'] }
  };
  function line(p, kind, sub, vars, rng) {
    var b = p.ai || p.aiTakeover, pl = b && PERSONA_LINES[b.persona], arr = null;
    if (pl) arr = sub ? (pl[kind] && pl[kind][sub]) : (Array.isArray(pl[kind]) ? pl[kind] : null);
    if (!arr) arr = sub ? (LINES[kind] && LINES[kind][sub]) : LINES[kind];
    if (!arr || !arr.length) return '';
    var r = rng ? rng() : Math.random(), s = arr[Math.floor(r * arr.length)];
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : ''; });
  }

  // ------------------------------------------------------------ coach hints (a suggestion; the player still decides)
  var ITEM = { heart: 'heart', ammo: 'ammo clip', pipe: 'lead pipe', pistol: 'pistol', mg: 'machine gun' };
  function coach(g, p) {
    if (g.phase === 'fight' && g.fight && g.fight.pid === p.id) {
      var o = fightOdds(p);
      return { text: 'Roll! You win about ' + Math.round(o.win * 100) + '% of fights like this.', dirs: [] };
    }
    if (g.phase === 'roll') return { text: 'Roll the dice to move.', dirs: [] };
    if (g.phase !== 'plan') return null;
    var r = plan(g, p, mulberry(1), { coach: true });
    var what = { loot: (r.reach ? 'grab the ' : 'head for the ') + (ITEM[r.item] || 'loot'), heart: (r.reach ? 'grab the' : 'head for the') + ' heart',
      explore: r.reach ? 'explore a new tile' : 'head for the edge to explore', gate: r.reach ? 'try the helipad gate!' : 'head for the helipad gate',
      fight: 'fight the zombie (you win ~' + Math.round(r.win * 100) + '%)', stay: 'stay put this turn' }[r.why];
    return { dirs: r.dirs, arrows: r.dirs.map(function (d) { return ARROW[d]; }).join(' '), text: (r.dirs.length ? 'Try ' + r.dirs.map(function (d) { return ARROW[d]; }).join(' ') + ' to ' : 'Maybe ') + what + '.' };
  }

  // ------------------------------------------------------------ driver: plays the AI seats through game intents
  function Driver(game, o) {
    o = o || {};
    this.g = game; this.pending = null; this.rngs = {};
    this.controls = o.controls || function (p) { return !!(p && (p.ai || p.aiTakeover)); };
    this.react = o.react || function () {};
  }
  var D = Driver.prototype;
  D.rng = function (p) { var k = p.id + ':' + this.g.seed; return this.rngs[k] || (this.rngs[k] = mulberry(((this.g.seed || 1) * 31 + p.id * 7919) >>> 0)); };
  D.onStart = function () {                  // light alliances: each AI picks a partner for the game
    var g = this.g, self = this;
    g.players.forEach(function (p) {
      p.allyPid = null; p.betrayed = null; p.lastShare = -9;
      if (!p.ai) return;
      var others = g.players.filter(function (q) { return q !== p; });
      if (!others.length) return;
      var rng = self.rng(p), humans = others.filter(function (q) { return !q.ai; });
      var pool = p.ai.persona === 'buddy' && humans.length ? humans : others;
      p.allyPid = pool[Math.floor(rng() * pool.length)].id;
    });
  };
  D.poke = function () {
    var g = this.g;
    if (this.pending && this.pending.gen === g.gen) return;
    this.pending = null;
    var cp = g.phase === 'between' && g.curP();
    if (cp && cp.ai && this.shareTurn !== g.rollSeq + ':' + g.round) {      // just moved next to the partner? hand over ammo
      this.shareTurn = g.rollSeq + ':' + g.round;
      var me = this;
      g.later(80, function () { if (g.phase === 'between' && g.curP() === cp) me.maybeShare(cp, me.rng(cp)); });
    }
    var pid = g.actorId(); if (!pid) return;
    var p = g.byId(pid); if (!this.controls(p)) return;
    var self = this, ph = g.phase, T = A.timing, tok = this.pending = { gen: g.gen, pid: pid, phase: ph }, rng = this.rng(p);
    function ok() { return self.pending === tok && g.actorId() === pid && g.phase === ph && self.controls(g.byId(pid)); }
    function later(ms, fn) { g.later(ms, function () { if (!ok()) { if (self.pending === tok) self.pending = null; self.poke(); return; } fn(); }); }
    function done() { if (self.pending === tok) self.pending = null; self.poke(); }
    if (ph === 'roll') later(T.roll, function () { self.maybeShare(p, rng); if (ok()) g.intent(pid, { t: 'roll' }); done(); });
    else if (ph === 'fight' || ph === 'zturn') later(ph === 'fight' ? T.fight : T.roll, function () { g.intent(pid, { t: 'roll' }); done(); });
    else if (ph === 'place') {
      var target = placeChoice(g, p, rng), guard = 0;
      var step = function () {
        var P = g.place;
        if (P && guard++ < 12 && P.idx !== target.idx) { g.intent(pid, { t: 'dir', d: 'D' }); later(T.place, step); return; }
        if (P && guard < 12 && P.rot !== target.rot) { guard++; g.intent(pid, { t: 'dir', d: 'R' }); later(T.place, step); return; }
        later(T.placeHold, function () { g.intent(pid, { t: 'exec' }); done(); });
      };
      later(T.place, step);
    } else if (ph === 'plan') {
      later(T.think, function () {
        if (g.plan.length) g.intent(pid, { t: 'clear' });
        var r = plan(g, p, rng), i = 0;
        self.react(p, 'think', r);
        var next = function () {
          if (i < r.dirs.length) { g.intent(pid, { t: 'dir', d: r.dirs[i++] }); later(T.dirStep, next); return; }
          later(r.dirs.length ? T.showPlan : T.showPlan * 0.5, function () { g.intent(pid, { t: 'exec' }); done(); });
        };
        next();
      });
    } else this.pending = null;
  };
  D.maybeShare = function (p, rng) {
    var g = this.g, ally = p.allyPid && g.byId(p.allyPid), P = brain(p).P;
    if (!p.ai || !ally || ally.status !== 'alive' || man(p, ally) > 1 || g.round - p.lastShare < 3) return;
    if (!shareable(p, ally) || rng() >= P.share) return;
    var n = W[p.weapon].gun ? Math.floor(p.ammo / 2) : p.ammo;
    if (g.intent(p.id, { t: 'share', to: ally.id, n: n })) { p.lastShare = g.round; this.react(p, 'share', { ally: ally }); }
  };

  root.ZTAI = { Driver: Driver, plan: plan, placeChoice: placeChoice, fightOdds: fightOdds, coach: coach, line: line, mulberry: mulberry, brain: brain, ARROW: ARROW };
})(typeof window !== 'undefined' ? window : globalThis);
