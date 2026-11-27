/* TV v0.7.10: if a turn makes no progress for N seconds while the game is not
   legitimately paused (recap, vote, auction, or a live card hold), re-kick it:
   apply a pending card, restore the centre prompt, and nudge the AI. */
(function (w) {
  'use strict';
  var IDLE = 8000;
  var lastKey = '', lastAt = 0, kicks = 0, lastKick = 0;

  function game() { return w.RDR && RDR.game; }
  function legitPause(g) {
    if (!g || g.paused) return true;
    if (w.RDRRecap && RDRRecap.playing) return true;
    var cap = document.getElementById('rrecP');
    if (cap && cap.classList.contains('on')) return true;
    var set = document.getElementById('rrecSet');
    if (set && set.classList.contains('on')) return true;
    var t = g.turn;
    if (t && t.auction) return true;
    if (t && t.stage === 'card' && t.card && g.now < t.card.until) return true;
    if (t && t.stage === 'rolling' && t.rollEnd && g.now < t.rollEnd) return true;
    if (t && t.stage === 'moving' && t.moveEnd && g.now < t.moveEnd) return true;
    return false;
  }
  function keyOf(g) {
    var t = g.turn || {};
    return [g.phase, g.round, g.turnCount, t.pid, t.stage, t.buy, !!(t.card), (g.log || []).length].join(':');
  }
  function restorePrompt(g) {
    try {
      if (w.RDRPrompt && RDRPrompt.refresh) RDRPrompt.refresh(g);
    } catch (e) {}
  }
  function kick(why) {
    var g = game(); if (!g || g.phase !== 'play' || !g.turn) return false;
    var t = g.turn, now = g.now || 0, did = false;
    try {
      if (t.stage === 'card') {
        if (t.card && (t.card.until == null || now >= t.card.until - 10)) { g.applyCard(); did = true; }
        else if (!t.card) { t.stage = 'act'; did = true; }
      } else if (t.stage === 'moving' && t.moveEnd != null && now >= t.moveEnd) { g.afterMove(); did = true; }
      else if (t.stage === 'rolling' && t.rollEnd != null && now >= t.rollEnd) { g.afterRoll(); did = true; }
      else if (t.stage === 'ended' && t.endAt != null && now >= t.endAt) { g.tick(now); did = true; }
    } catch (e) {
      if (t.stage === 'card') { t.stage = 'act'; t.card = null; did = true; }
    }
    try {
      var p = g.cur && g.cur();
      if (w.RDRAI && typeof RDRAI.tick === 'function') RDRAI.tick(g);
      if (p && g.isBot && g.isBot(p) && typeof g.intent === 'function') {
        if (t.stage === 'roll') g.intent(p.id, { t: 'roll' });
        else if (t.stage === 'act' && t.buy != null) { /* AI.tick handles buy */ }
        else if (t.stage === 'act' && !t.auction && !t.tab) g.intent(p.id, { t: 'pass' });
        did = true;
      }
    } catch (e2) {}
    restorePrompt(g);
    kicks++; lastKick = Date.now(); lastAt = Date.now(); lastKey = keyOf(g);
    if (w.console) console.info('RDR watchdog kick', why || '', t && t.stage, kicks);
    return did;
  }
  function poll() {
    var g = game();
    if (!g || g.phase !== 'play' || !g.turn) { lastKey = ''; return; }
    if (legitPause(g)) { lastAt = Date.now(); lastKey = keyOf(g); return; }
    var k = keyOf(g), now = Date.now();
    if (k !== lastKey) { lastKey = k; lastAt = now; return; }
    if (!lastAt) { lastAt = now; return; }
    if (now - lastAt >= IDLE && now - lastKick > 2000) kick('idle');
  }
  setInterval(poll, 500);
  w.RDRWatchdog = { kick: kick, idleMs: IDLE, info: function () { return { lastKey: lastKey, lastAt: lastAt, kicks: kicks, lastKick: lastKick }; } };
})(window);
