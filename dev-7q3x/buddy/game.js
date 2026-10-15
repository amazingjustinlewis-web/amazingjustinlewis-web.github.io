/* BALLOON BUDDY - a silly word-guessing game. Every wrong letter pops one of Buddy's balloons and he sinks toward
   the kiddie pool. Guess the word before the last balloon pops (or he gets a soggy, happy splash). Host-side logic + scene. */
(function (root) {
  var MAXB = 7, WORDS = ['PANCAKE', 'NOODLE', 'PENGUIN', 'BUBBLE GUM', 'CACTUS', 'WAFFLE', 'KAZOO', 'PICKLE', 'DINOSAUR', 'TRAMPOLINE', 'SOCK PUPPET', 'BANANA', 'JELLYFISH', 'MARSHMALLOW', 'HICCUP', 'TOASTER', 'LLAMA', 'POPCORN', 'RUBBER DUCK', 'SPAGHETTI'];
  var COLS = ['#ff5a6e', '#3aa8ff', '#5fdc7a', '#ffc93f', '#c77dff', '#ff9f43', '#4dd0e1'];
  function Game(emit) { this.emit = emit; this.pl = []; this.phase = 'lobby'; this.setter = -1; this.word = ''; this.got = {}; this.wrong = []; this.round = 0; this.pops = []; this.log = ''; }
  Game.prototype.add = function (p) { if (this.pl.indexOf(p) < 0) { p.pts = p.pts || 0; this.pl.push(p); } this.push(); };
  Game.prototype.humans = function () { return this.pl.filter(function (p) { return p.on !== false; }); };
  Game.prototype.next = function () {
    var H = this.humans(); this.got = {}; this.wrong = []; this.pops = []; this.round++;
    if (H.length < 2) { this.setter = -1; this.word = WORDS[(Math.random() * WORDS.length) | 0]; this.phase = 'guess'; this.log = 'Buddy picked a word. Guess away!'; }
    else { var idx = this.round % H.length; this.setter = H[idx].seat; this.word = ''; this.phase = 'set'; this.log = H[idx].name + ' is picking a secret word\u2026'; }
    this.push();
  };
  Game.prototype.msg = function (p, m) {
    if (((m.t === 'start' || m.t === 'next') && this.phase === 'lobby') || (m.t === 'next' && (this.phase === 'won' || this.phase === 'lost'))) return this.next();
    if (m.t === 'word' && this.phase === 'set' && p.seat === this.setter) { var w = String(m.w || '').toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24); if (w.replace(/ /g, '').length < 2) return; this.word = w; this.phase = 'guess'; this.log = p.name + ' set a word. Guess letters!'; return this.push(); }
    if (m.t === 'guess' && this.phase === 'guess' && p.seat !== this.setter) {
      var l = String(m.l || '').toUpperCase().slice(0, 1); if (!/[A-Z]/.test(l) || this.got[l] || this.wrong.indexOf(l) >= 0) return;
      if (this.word.indexOf(l) >= 0) { this.got[l] = 1; var n = this.word.split(l).length - 1; p.pts += n; this.log = p.name + ': ' + l + '! \u2714 (+' + n + ')'; if (this.word.split('').every(function (c) { return c === ' ' || this.got[c]; }, this)) { this.phase = 'won'; p.pts += 2; this.log = 'Saved! ' + p.name + ' finished it: ' + this.word; } }
      else { this.wrong.push(l); this.pops.push({ i: MAXB - this.wrong.length, t: Date.now() }); this.log = p.name + ': ' + l + '? POP!'; if (this.wrong.length >= MAXB) { this.phase = 'lost'; var s = this.pl.filter(function (q) { return q.seat === this.setter; }, this)[0]; if (s) s.pts += 3; this.log = 'SPLASH! The word was ' + this.word; } }
      this.push();
    }
  };
  Game.prototype.mask = function () { var g = this.got, end = this.phase === 'won' || this.phase === 'lost'; return this.word.split('').map(function (c) { return c === ' ' ? ' ' : (g[c] || end ? c : '_'); }).join(''); };
  Game.prototype.pub = function () { return { phase: this.phase, mask: this.mask(), wrong: this.wrong, got: Object.keys(this.got), balloons: MAXB - this.wrong.length, setter: this.setter, log: this.log, round: this.round, pl: this.pl.map(function (p) { return { name: p.name, pts: p.pts, seat: p.seat, color: p.color }; }) }; };
  Game.prototype.push = function () { var pub = this.pub(), self = this; this.emit(-1, pub); this.pl.forEach(function (p) { var s = Object.assign({ me: p.seat, word: p.seat === self.setter ? self.word : '' }, pub); self.emit(p, { t: 'st', s: s }); }); };
  // ---------------------------------------------------------------- scene
  var anim = { y: 0, fall: 0, up: 0, popped: {}, parts: [], last: '' };
  function scene(ctx, W, H, s, t) {
    var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#8fd3ff'); sky.addColorStop(1, '#e8f7ff'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; [[.2, .12], [.75, .2], [.5, .07]].forEach(function (c, i) { var x = ((c[0] * W + t * 12 * (i + 1)) % (W + 200)) - 100; ctx.beginPath(); ctx.arc(x, c[1] * H, H * .04, 0, 7); ctx.arc(x + H * .04, c[1] * H - H * .015, H * .05, 0, 7); ctx.arc(x + H * .09, c[1] * H, H * .035, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#7ccf5a'; ctx.fillRect(0, H * .88, W, H * .12);
    var px = W * .5, py = H * .86, pw = Math.min(W * .34, H * .5);
    ctx.fillStyle = '#ff7ab0'; ctx.beginPath(); ctx.ellipse(px, py, pw, H * .07, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.ellipse(px, py - H * .01, pw * .88, H * .05, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd23f'; var dx = px + pw * .5 + Math.sin(t * 1.5) * 8; ctx.beginPath(); ctx.ellipse(dx, py - H * .02, H * .025, H * .018, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(dx + H * .018, py - H * .042, H * .014, 0, 7); ctx.fill(); ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.moveTo(dx + H * .03, py - H * .045); ctx.lineTo(dx + H * .045, py - H * .04); ctx.lineTo(dx + H * .03, py - H * .036); ctx.fill();
    var n = s ? s.balloons : 7, lost = s && s.phase === 'lost', won = s && s.phase === 'won';
    var u = H * .06, e = n / 7, ty = lost ? H * .83 : won ? H * .9 - u * 2 : H * (.36 + (7 - n) * .055), tx = won ? W * .2 : W * .5; if (won) anim.up += 1 / 60; else anim.up = 0;
    if (!anim.y) anim.y = ty; if (!anim.x) anim.x = tx; anim.y += (ty - anim.y) * (lost ? .12 : won ? .08 : .05); anim.x += (tx - anim.x) * .05;
    var landed = won && Math.abs(anim.y - ty) < u * .3, hop = landed ? Math.abs(Math.sin(t * (3 + 6 * e))) * u * 1.1 * e * e : 0, sway = landed ? Math.sin(t * (1.5 + 3 * e)) * u * (.15 + .7 * e) : 0;
    var by = anim.y - hop, bx = anim.x + (won ? sway : Math.sin(t * 1.3) * W * .02), fly = won ? anim.up * anim.up * H * .35 : 0, hx = anim.x, hy = anim.y;
    if (!lost) for (var i = 0; i < 7; i++) {   // balloons
      var a = -1.1 + i * (2.2 / 6), lx = bx + Math.sin(a) * u * 2.4, ly = (won ? hy : by) - u * 3.2 - Math.cos(a) * u * 1.3 + Math.sin(t * 2 + i) * 4 - fly; if (won) lx = hx + Math.sin(a) * u * 2.4 + Math.sin(t + i) * u * .3;
      if (i < n) { ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); if (won) { ctx.moveTo(lx, ly + u * .65); ctx.lineTo(lx + Math.sin(t * 3 + i) * 6, ly + u * 1.8); } else ctx.moveTo(bx, by - u * .9); if (!won) ctx.quadraticCurveTo((bx + lx) / 2 + 6, (by + ly) / 2, lx, ly + u * .65); ctx.stroke();
        ctx.fillStyle = COLS[i]; ctx.beginPath(); ctx.ellipse(lx, ly, u * .55, u * .68, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff6'; ctx.beginPath(); ctx.ellipse(lx - u * .18, ly - u * .25, u * .12, u * .2, -.4, 0, 7); ctx.fill(); }
      else if (!anim.popped[i + ':' + (s ? s.round : 0)]) { anim.popped[i + ':' + (s ? s.round : 0)] = 1; for (var k = 0; k < 14; k++) anim.parts.push({ x: lx, y: ly, vx: (Math.random() - .5) * 9, vy: (Math.random() - .5) * 9, c: COLS[i], l: 1, txt: k === 0 ? 'POP!' : '' }); }
    }
    // buddy
    ctx.save(); ctx.translate(bx, by); if (won) ctx.scale(1.5, 1.5); var wig = landed ? Math.sin(t * (2.5 + 5 * e)) * (.1 + .3 * (1 - e)) : Math.sin(t * (lost ? 2 : 8)) * (n < 3 && !lost ? .15 : .04); ctx.rotate(wig);
    ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = u * .12; ctx.lineCap = 'round';
    var kick = landed ? Math.sin(t * (3 + 6 * e)) * u * (.08 + .55 * e) : Math.sin(t * (n < 4 ? 12 : 4)) * u * .3; ctx.beginPath(); ctx.moveTo(-u * .2, u * .6); ctx.lineTo(-u * .35 - kick * .5, u * 1.3); ctx.moveTo(u * .2, u * .6); ctx.lineTo(u * .35 + kick * .5, u * 1.3); ctx.stroke();
    ctx.beginPath(); if (landed) { var wa = Math.sin(t * (3 + 6 * e)) * (.3 + .9 * e), up = -.6 - 1.4 * e; [-1, 1].forEach(function (k, j) { var an = (j && e < .3 ? .3 : up) + (j ? wa : -wa); ctx.moveTo(k * u * .3, -u * .05); ctx.lineTo(k * u * .3 + k * Math.cos(an) * u * .55, -u * .05 + Math.sin(an) * u * .55); }); } else { ctx.moveTo(-u * .35, -u * .1); ctx.lineTo(0, -u * .9); ctx.lineTo(u * .35, -u * .1); } ctx.stroke();
    ctx.fillStyle = '#ff9f43'; ctx.beginPath(); ctx.roundRect(-u * .42, -u * .2, u * .84, u * .9, u * .3); ctx.fill();
    if (lost) { ctx.fillStyle = '#ff5a6e'; [-1, 1].forEach(function (k) { ctx.beginPath(); ctx.arc(k * u * .5, -u * .05, u * .2, 0, 7); ctx.fill(); }); }
    ctx.fillStyle = '#ffe0bd'; ctx.beginPath(); ctx.arc(0, -u * .55, u * .42, 0, 7); ctx.fill();
    ctx.fillStyle = '#6a3a1a'; ctx.beginPath(); ctx.arc(0, -u * .78, u * .3, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#222'; var eyes = n <= 2 && !won && !lost ? 'big' : 'dot'; [-1, 1].forEach(function (k) { ctx.beginPath(); ctx.arc(k * u * .15, -u * .6, eyes === 'big' ? u * .09 : u * .05, 0, 7); ctx.fill(); });
    ctx.strokeStyle = '#a0303a'; ctx.lineWidth = u * .06; ctx.beginPath(); if (won || lost) ctx.arc(0, -u * .45, u * .16, .2, Math.PI - .2); else if (n <= 3) ctx.ellipse(0, -u * .38, u * .08, u * .1, 0, 0, 7); else ctx.arc(0, -u * .48, u * .12, .3, Math.PI - .3); ctx.stroke();
    ctx.restore();
    if (landed) { var DN = n >= 7 ? 'FULL BOUNCY JIG!' : n >= 5 ? 'Happy hop!' : n >= 3 ? 'Wiggle wiggle' : n === 2 ? 'Noodle sway…' : 'Wobbly one-balloon shuffle'; ctx.font = '700 ' + Math.round(u * .55) + 'px Fredoka,sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.strokeText(DN, hx, hy - u * 2.3); ctx.fillStyle = '#6a3a8a'; ctx.fillText(DN, hx, hy - u * 2.3); ctx.textAlign = 'left'; }
    if (lost) { ctx.fillStyle = '#d0f0ff'; for (var j = 0; j < 6; j++) { ctx.beginPath(); ctx.arc(bx - u + j * u * .4, py - H * .03 - Math.abs(Math.sin(t * 3 + j)) * u * .4, u * .08, 0, 7); ctx.fill(); } }
    if (won) for (var c2 = 0; c2 < 30; c2++) { ctx.fillStyle = COLS[c2 % 7]; ctx.fillRect((c2 * 97 + t * 60) % W, ((c2 * 53) + t * 140 * (1 + c2 % 3)) % H, 8, 12); }
    anim.parts = anim.parts.filter(function (q) { q.x += q.vx; q.y += q.vy; q.vy += .3; q.l -= .025; if (q.txt) { ctx.fillStyle = '#222'; ctx.font = '700 ' + Math.round(u * .6) + 'px Fredoka,sans-serif'; ctx.fillText(q.txt, q.x, q.y); } else { ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, 5, 5); } return q.l > 0; });
  }
  root.Buddy = { Game: Game, scene: scene, MAXB: MAXB };
})(window);
