/* TV v0.7.10: keep the host game clock honest when recap (or anything else)
   calls game.setPaused() directly, bypassing host setPause() / pauseOff.
   Also guards tick so a missing t.card cannot kill the turn loop. */
(function (w) {
  'use strict';
  var extraOff = 0, pauseAt = 0, recapHold = false, hooked = false;

  function hook() {
    var g = w.RDR && RDR.game;
    if (!g || hooked || typeof g.setPaused !== 'function' || typeof g.tick !== 'function') return !!g;
    hooked = true;
    var origSet = g.setPaused.bind(g);
    var origTick = g.tick.bind(g);
    g.setPaused = function (on) {
      on = !!on;
      if (on && !this.paused) { pauseAt = (typeof performance !== 'undefined' ? performance.now() : Date.now()); recapHold = true; }
      else if (!on && this.paused && recapHold) {
        var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        extraOff += Math.max(0, now - (pauseAt || now));
        recapHold = false;
      }
      return origSet(on);
    };
    g.tick = function (now) {
      var n = now - extraOff;
      try {
        var t = this.turn;
        if (t && t.stage === 'card' && !t.card) t.stage = 'act';
      } catch (e) {}
      return origTick.call(this, n);
    };
    return true;
  }

  function boot() { if (!hook()) setTimeout(boot, 200); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setInterval(function () { if (!hooked) hook(); }, 400);
  w.RDRPauseShim = { hook: hook, extraOff: function () { return extraOff; } };
})(window);
