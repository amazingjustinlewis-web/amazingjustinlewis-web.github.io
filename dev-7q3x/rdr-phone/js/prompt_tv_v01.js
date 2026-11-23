/* TV v0.7.10: clear or refresh the centre / dice-banner prompt the moment the
   turn changes, so the previous player's "X rolled 7. Pass the dice when ready."
   never hangs into the next turn. */
(function (w) {
  'use strict';
  var hooked = false, lastTurn = '';

  function $(id) { return document.getElementById(id); }
  function game() { return w.RDR && RDR.game; }

  function refresh(g) {
    g = g || game();
    var t = g && g.turn, p = t && g.cur && g.cur();
    var banner = $('banner'), who = $('bWho'), what = $('bWhat');
    if (!banner || !who || !what) return;
    if (!g || g.phase !== 'play' || !t || !p) return;
    var C = w.RDR_CONFIG || {}, S = (w.RDR_BOARD && RDR_BOARD.SPACES) || [];
    var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
    var line = t.auction ? 'Auction: ' + ((S[t.auction.sp] || {}).name || 'a deed') + ' (bid on your phone!)' :
      t.tab ? 'Owes ' + money(t.tab.amount) + ': raising cash\u2026' :
      t.buy != null ? 'Buy ' + ((S[t.buy] || {}).name || 'a deed') + '?' :
      t.payup && !t.payup.done ? 'Will they pass the dice before the owner hits PAY UP?' :
      t.canRollAgain ? 'Doubles: roll again!' :
      t.stage === 'roll' ? (p.snow ? 'Stuck: roll doubles, pay the tow or use a pass' : 'Roll the dice!') :
      t.stage === 'card' ? 'Drawing a card\u2026' :
      t.stage === 'moving' || t.stage === 'rolling' ? (who.textContent || '') :
      'Pass the dice when ready';
    if (t.stage === 'roll') {
      who.textContent = "It's " + p.name + "'s turn";
      who.style.color = p.color === '#1d1d24' ? '#ff6a6a' : p.color;
      what.textContent = line;
    } else if (t.stage === 'act' || t.stage === 'card') {
      if (!who.textContent || /rolled \d/.test(who.textContent) && who.textContent.indexOf(p.name) !== 0 && t.stage === 'roll') {
        who.textContent = p.name;
        who.style.color = p.color === '#1d1d24' ? '#ff6a6a' : p.color;
      }
      if (t.stage === 'roll' || t.stage === 'act' || t.stage === 'card') what.textContent = line;
    }
    banner.hidden = false;
  }

  function hook() {
    var g = game(); if (!g || hooked) return !!g;
    hooked = true;
    if (typeof g.on === 'function') {
      g.on(function (type, d) {
        if (type === 'turn' || type === 'passDice' || type === 'start') {
          try { refresh(g); } catch (e) {}
        }
      });
    }
    return true;
  }
  function watch() {
    hook();
    var g = game(); if (!g || !g.turn) return;
    var k = g.turnCount + ':' + (g.turn && g.turn.pid) + ':' + (g.turn && g.turn.stage);
    if (k !== lastTurn) { lastTurn = k; try { refresh(g); } catch (e) {} }
  }
  setInterval(watch, 200);
  w.RDRPrompt = { refresh: refresh, hook: hook };
})(window);
