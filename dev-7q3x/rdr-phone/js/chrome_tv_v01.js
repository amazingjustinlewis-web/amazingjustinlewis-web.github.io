/* TV v0.7.7: keep the score sidebar and top bar visible whenever the game is actually running.
   The lobby overlay / lobby-cam wrap RDR.startGame, but the TV Start button and phone "start"
   messages call the host's inner startGame(), so those wrappers never run and the lobby hide
   class (opacity:0 on #side and #top) was left on. Sync chrome to game.phase instead. */
(function (w) {
  'use strict';
  var timer = 0;

  function phase() {
    var g = w.RDR && RDR.game;
    return (g && g.phase) || 'lobby';
  }
  function lobbyOpen() {
    var lobby = document.getElementById('lobby');
    return phase() === 'lobby' && lobby && !lobby.hidden;
  }
  function sync() {
    var open = lobbyOpen();
    document.body.classList.toggle('tv075-lobby', open);
    document.body.classList.toggle('tv076-lobby', open);
    document.body.classList.toggle('rdr-play', !open && phase() !== 'lobby');
    var side = document.getElementById('side');
    var top = document.getElementById('top');
    if (!open) {
      if (side) { side.hidden = false; side.style.opacity = ''; side.style.pointerEvents = ''; }
      if (top) { top.hidden = false; top.style.opacity = ''; }
    }
  }
  function boot() {
    sync();
    if (!timer) timer = setInterval(sync, 200);
    var g = w.RDR && RDR.game;
    if (g && typeof g.on === 'function' && !g._tv077Chrome) {
      g._tv077Chrome = true;
      g.on(function (type) {
        if (type === 'start' || type === 'over' || type === 'turn') sync();
      });
    }
  }
  w.RDRChrome = { boot: boot, sync: sync };
})(window);
