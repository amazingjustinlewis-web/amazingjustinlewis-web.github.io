/* TV v0.7.6: card leave / shatter takes twice as long; property highlight feather starts sooner
   so names stay readable; danger waypoints oscillate faster on more dangerous tiles. */
(function (w) {
  'use strict';
  var hooked = false;

  function tuneFade() {
    var C = w.RDR_CONFIG; if (!C) return;
    C.fx = C.fx || {};
    if (C.fx.noteFadeMs < 2000) C.fx.noteFadeMs = 2800;
    C.ownerLine = C.ownerLine || {};
    /* start the feather sooner (closer to the edge) so it doesn't cover property names */
    if (C.ownerLine._tv076) return;
    C.ownerLine._tv076 = true;
    C.ownerLine.feather = 0.07;
    C.ownerLine.line = 0.07;
    C.ownerLine.steps = Math.max(4, C.ownerLine.steps || 4);
  }

  function hookShatterHold() {
    if (hookShatterHold._on) return;
    hookShatterHold._on = true;
    var rem = Element.prototype.removeChild;
    Element.prototype.removeChild = function (ch) {
      if (ch && ch.classList && ch.classList.contains('shd') && !ch._tv076Hold) {
        ch._tv076Hold = true;
        var self = this;
        setTimeout(function () { try { rem.call(self, ch); } catch (e) {} }, 520);
        return ch;
      }
      return rem.apply(this, arguments);
    };
  }

  function wrapOwners() {
    var rnd = w.RDR && RDR.render;
    if (!rnd || rnd._tv076Owners || typeof rnd.drawOwners !== 'function') return !!rnd;
    rnd._tv076Owners = rnd.drawOwners.bind(rnd);
    /* steeper falloff so the wash starts fading right at the edge */
    var orig = rnd._tv076Owners;
    rnd.drawOwners = function (c, now) {
      var C = w.RDR_CONFIG, L = C && C.ownerLine;
      var prevF = L && L.feather, prevL = L && L.line;
      if (L) { L.feather = 0.065; L.line = 0.07; }
      var r = orig(c, now);
      if (L) { if (prevF != null) L.feather = prevF; if (prevL != null) L.line = prevL; }
      return r;
    };
    return true;
  }

  function rentOf(g, i, ignoreHock) {
    try {
      if (ignoreHock) {
        var pr0 = g.props[i], S0 = w.RDR_BOARD && RDR_BOARD.SPACES[i];
        if (S0 && S0.rents) return S0.rents[pr0 && pr0.shops || 0] || 0;
      }
      return g.rentFor(i, 7, false) || 0;
    } catch (e) {
      var pr = g.props[i], S = w.RDR_BOARD && RDR_BOARD.SPACES[i];
      if (!pr || pr.owner < 0 || !S || !S.rents) return 0;
      return S.rents[pr.shops || 0] || 0;
    }
  }

  function dangerOf(g, i) {
    var prD = g.props[i];
    var rent = rentOf(g, i, prD && prD.hocked); if (rent <= 0) return 0;
    var cash = 0, n = 0;
    g.players.forEach(function (p) { if (!p.bankrupt) { cash += p.cash; n++; } });
    var typ = n ? cash / n : 200;
    /* 0..1 relative to typical cash and to the game's own rent range */
    var relCash = Math.max(0, Math.min(1, rent / Math.max(80, typ)));
    var relGame = Math.max(0, Math.min(1, rent / 400));
    return Math.max(relCash, relGame * 0.85);
  }

  function drawBoards(c, r) {
    /* a couple of planks nailed across the arrow, like a boarded-up little shop */
    var planks = [
      { x: -r * 0.95, y: -r * 0.18, w: r * 1.9, h: r * 0.34, rot: -0.38 },
      { x: -r * 0.95, y: r * 0.02, w: r * 1.9, h: r * 0.32, rot: 0.46 }
    ];
    planks.forEach(function (pl) {
      c.save(); c.translate(0, r * 0.05); c.rotate(pl.rot);
      c.fillStyle = '#8a5a2b'; c.fillRect(pl.x, pl.y, pl.w, pl.h);
      c.strokeStyle = 'rgba(40,20,8,0.7)'; c.lineWidth = 0.8; c.strokeRect(pl.x, pl.y, pl.w, pl.h);
      c.fillStyle = '#d8d0c4';
      [[pl.x + pl.w * 0.22, 0], [pl.x + pl.w * 0.78, 0]].forEach(function (n) {
        c.beginPath(); c.arc(n[0], pl.y + pl.h / 2, Math.max(0.8, r * 0.07), 0, 7); c.fill();
      });
      c.restore();
    });
  }

  function drawWaypoints(c, rnd, now) {
    var g = w.RDR && RDR.game; if (!g || g.phase !== 'play' || !rnd) return;
    for (var i = 0; i < 40; i++) {
      var pr = g.props[i]; if (!pr || pr.owner < 0) continue;
      var hocked = !!pr.hocked;
      var dng = dangerOf(g, i);
      if (!hocked && dng < 0.12) continue;
      if (hocked && dng < 0.08) dng = 0.08; /* still a calm boarded arrow */
      var rc = rnd.rect(i), x = rnd.bx + rc.x + rc.w / 2, y = rnd.by + rc.y + rc.h * 0.22;
      var freq = 1.2 + dng * 4.8; /* more dangerous = faster oscillation; mortgaged keeps its own danger */
      var bob = Math.sin(now / 1000 * freq * Math.PI * 2 + i) * (3 + dng * 5) * (hocked ? 0.7 : 1);
      var r = Math.max(hocked ? 10 : 4.5, (rnd.w || 24) * (hocked ? 0.2 : (0.11 + 0.1 * dng)));
      var o = g.byId(pr.owner);
      c.save();
      c.globalAlpha = hocked ? 0.8 : (0.35 + 0.45 * dng);
      c.translate(x, y + bob);
      c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.72, r * 0.7); c.lineTo(-r * 0.72, r * 0.7); c.closePath();
      c.fillStyle = o ? o.color : '#ff5d73';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.2; c.stroke();
      if (hocked) drawBoards(c, r);
      c.restore();
    }
  }

  function hookCaught() {
    if (hookCaught._on) return;
    hookCaught._on = true;
    var obs = new MutationObserver(function () {
      var el = document.getElementById('payupBar');
      var on = !!(el && !el.hidden && el.classList.contains('caught'));
      document.body.classList.toggle('rdr-caught', on);
    });
    if (document.body) obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  }

  function boot() {
    tuneFade(); hookShatterHold(); wrapOwners(); hookCaught();
  }

  w.RDRFxTune = { boot: boot, drawWaypoints: drawWaypoints, wrapOwners: wrapOwners, dangerOf: dangerOf };
})(window);
