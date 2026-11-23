/* Phone controller v0.7.10: if this seat is being auto-played, say
   "Away, auto-playing" instead of a contradictory disconnected label. */
(function (w) {
  'use strict';
  function paint() {
    try {
      var st = w.RDRC && RDRC.state && RDRC.state(); if (!st || !st.me) return;
      var name = document.getElementById('myName'); if (!name) return;
      var me = st.me;
      var base = me.name + (me.team ? ' \u00b7 ' + me.team : '');
      if (me.aiCover || (st.me && st.me.aiCover)) name.textContent = base + ' (Away, auto-playing)';
    } catch (e) {}
  }
  setInterval(paint, 500);
})(window);
