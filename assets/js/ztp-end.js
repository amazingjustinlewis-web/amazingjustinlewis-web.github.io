/* 0-Phi front door hook: when a game runs inside the TV door (an iframe), tell the door the game is over so the
   screen frees. Does nothing standalone. ZTPEnd.watch(isOver, holdMs): posts once after isOver() has stayed true
   for holdMs (time to see the results); if the game restarts first, the clock resets. */
(function () {
  var embedded = false; try { embedded = window.parent && window.parent !== window; } catch (e) { embedded = true; }
  function end() { if (embedded) try { window.parent.postMessage({ ztp: 'end' }, '*'); } catch (e) {} }
  function watch(isOver, holdMs) {
    if (!embedded) return;
    var since = 0, sent = false;
    setInterval(function () {
      var o = false; try { o = !!isOver(); } catch (e) {}
      if (!o) { since = 0; sent = false; return; }
      if (!since) since = Date.now();
      if (!sent && Date.now() - since >= holdMs) { sent = true; end(); }
    }, 250);
  }
  window.ZTPEnd = { embedded: embedded, end: end, watch: watch };
})();
