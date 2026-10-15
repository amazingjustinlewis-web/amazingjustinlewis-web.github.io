/* BROADSIDE - match logic on top of the café Battleship rules (cafe/js/games.js: BS.place / BS.fire / BS.AI).
   Classic = 10x10, five ships. Used by the TV screen and by a phone playing the computer on its own. */
(function (root) {
  var BS = root.CafeGames.BS;
  BS.N = 10; BS.FLEET = [{ n: 'Flagship', s: 5 }, { n: 'Ironclad', s: 4 }, { n: 'Cruiser', s: 3 }, { n: 'Sub', s: 3 }, { n: 'Tugboat', s: 2 }];
  function Match(emit) { this.emit = emit; this.s = []; this.phase = 'lobby'; this.turn = 0; this.log = 'Waiting for captains'; }
  Match.prototype.seat = function (name, ai) { var i = this.s.length; this.s.push({ name: name, ai: !!ai, board: BS.place(), ready: !!ai, view: {}, sunk: 0, shots: 0, brain: ai ? new BS.AI() : null }); return i; };
  Match.prototype.start = function () {
    if (this.s.length === 1) this.seat('Computer', true);
    var self = this; this.phase = 'place'; this.log = 'Place your fleets: shuffle, then Ready';
    this.s.forEach(function (p) { p.board = BS.place(); p.ready = p.ai; p.view = {}; p.sunk = 0; p.shots = 0; if (p.ai) p.brain = new BS.AI(); });
    this.push();
  };
  Match.prototype.msg = function (i, m) {
    var p = this.s[i]; if (!p) return;
    if (m.t === 'shuffle' && this.phase === 'place' && !p.ready) p.board = BS.place();
    else if (m.t === 'ready' && this.phase === 'place') { p.ready = true; if (this.s.every(function (q) { return q.ready; })) { this.phase = 'battle'; this.turn = Math.random() < .5 ? 0 : 1; this.log = this.s[this.turn].name + ' fires first'; this.aiMaybe(); } }
    else if (m.t === 'fire' && this.phase === 'battle' && this.turn === i) this.fire(i, m.c);
    this.push();
  };
  Match.prototype.fire = function (i, c) {
    var me = this.s[i], foe = this.s[1 - i]; if (me.view[c]) return;
    var r = BS.fire(foe.board, c); if (r.r === 'again') return; me.shots++;
    if (r.r === 'miss') me.view[c] = 'm'; else if (r.r === 'hit') me.view[c] = 'h'; else { r.cells.forEach(function (x) { me.view[x] = 's'; }); me.sunk++; }
    if (me.brain) me.brain.learn(c, r);
    this.last = { by: i, c: c, r: r.r }; this.log = me.name + (r.r === 'miss' ? ': splash, a miss' : r.r === 'hit' ? ': HIT!' : ' sank the ' + r.ship + '!');
    if (r.over) { this.phase = 'over'; this.winner = i; this.log = me.name + ' wins in ' + me.shots + ' shots!'; return; }
    this.turn = 1 - i; this.aiMaybe();
  };
  Match.prototype.aiMaybe = function () {
    var self = this, p = this.s[this.turn]; if (!p || !p.ai || this.phase !== 'battle') return;
    setTimeout(function () { if (self.phase === 'battle' && self.s[self.turn] === p) { self.fire(self.turn, p.brain.pick()); self.push(); } }, 900);
  };
  Match.prototype.push = function () {
    var self = this;
    this.s.forEach(function (p, i) { var foe = self.s[1 - i];
      self.emit(i, { t: 'bs', phase: self.phase, seat: i, me: p.name, foe: foe ? foe.name : '', turn: self.turn === i, mine: { grid: p.board.grid, shots: p.board.shots }, view: p.view, ready: p.ready, log: self.log, last: self.last, win: self.phase === 'over' ? self.winner === i : null, sunk: p.sunk, lost: foe ? foe.sunk : 0, shots: p.shots }); });
    this.emit(-1, { phase: this.phase, turn: this.turn, log: this.log, last: this.last, winner: this.winner, s: this.s.map(function (p) { return { name: p.name, ai: p.ai, ready: p.ready, view: p.view, sunk: p.sunk, shots: p.shots }; }) });
  };
  // grid html: kind 'enemy' (view only) or 'mine' (ships + shots)
  function gridHtml(N, cellFn) { var h = ''; for (var c = 0; c < N * N; c++) h += '<i data-c="' + c + '" class="' + cellFn(c) + '"></i>'; return h; }
  root.Broadside = { Match: Match, gridHtml: gridHtml, N: function () { return BS.N; } };
})(window);
