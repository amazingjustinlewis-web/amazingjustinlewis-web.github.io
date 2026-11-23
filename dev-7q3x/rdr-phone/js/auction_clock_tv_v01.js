/* TV v0.7.8: match the solo auction clock. Same ease-in curve (starts slow, ramps up,
   restarts slow on every bid) but 30% shorter than the v0.8 solo length: about 3.3 s total.
   Shared engine (game.js) stays untouched; this wraps startAuction/bid on this TV's game. */
(function (w) {
  'use strict';
  var C = w.RDR_CONFIG;
  var AUC_K = 3.4, AUC_SQ = Math.sqrt(AUC_K), AUC_AT = Math.atan(AUC_SQ);
  /* v0.8 solo was C.auction.ms * AUC_AT / AUC_SQ (~4.66 s). 30% shorter ≈ 3.26 s. */
  var AUC_T = C.auction.ms * AUC_AT / AUC_SQ * 0.7;

  function game() { return w.RDR && RDR.game; }
  function aucCurve(gm) {
    var a = gm.turn && gm.turn.auction; if (!a) return;
    a.t0 = gm.now; a.T = gm.ms(AUC_T); a.endsAt = a.t0 + a.T;
  }
  function aucLeft(a, now) {
    if (!a) return 0;
    if (a.t0 == null || !a.T) return Math.max(0, Math.min(1, (a.endsAt - now) / (C.auction.ms / ((game() && game().speed) || 1))));
    var tau = Math.max(0, Math.min(1, (now - a.t0) / a.T)), x = Math.tan(tau * AUC_AT) / AUC_SQ;
    return Math.max(0, 1 - x);
  }
  function patch(gm) {
    if (!gm || gm._aucClock078) return;
    gm._aucClock078 = true;
    var sa = gm.startAuction, bd = gm.bid;
    gm.startAuction = function () { var r = sa.apply(this, arguments); aucCurve(this); return r; };
    gm.bid = function () { var r = bd.apply(this, arguments); if (!r) aucCurve(this); return r; };
  }

  function paintBar() {
    var g = game(), a = g && g.turn && g.turn.auction, fill = document.getElementById('aucFill');
    if (!a || !fill) return;
    var f = aucLeft(a, g.now);
    fill.style.width = (f * 100).toFixed(1) + '%';
  }

  function hookSend() {
    var net = w.RDR && typeof RDR.net === 'function' ? RDR.net() : (w.RDR && RDR.net);
    if (!net || !net.send || net._aucClock078) return !!net;
    net._aucClock078 = true;
    var orig = net.send.bind(net);
    net.send = function (conn, m) {
      if (m && m.t === 'state' && m.turn && m.turn.auction) {
        var g = game(), a = g && g.turn && g.turn.auction;
        if (a) {
          m = JSON.parse(JSON.stringify(m));
          var left = a.T ? Math.max(0, (a.t0 + a.T) - g.now) : Math.max(0, a.endsAt - g.now);
          m.turn.auction.left = Math.round(left);
          m.turn.auction.total = Math.round(a.T || g.ms(C.auction.ms));
        }
      }
      return orig(conn, m);
    };
    return true;
  }

  function boot() {
    var g = game();
    if (g) patch(g);
    hookSend();
    paintBar();
  }
  boot();
  setInterval(boot, 400);
  (function loop() { paintBar(); requestAnimationFrame(loop); })();
  w.RDRAuctionClock = { T: AUC_T, left: aucLeft, patch: patch };
})(window);
