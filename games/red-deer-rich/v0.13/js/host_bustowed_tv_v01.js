/* TV v0.7.13: include bustOwed / owed on the phone state so pads can post
   negative ocean scores when the human goes bust, without overwriting host_v074. */
(function (w) {
  function hook() {
    if (!w.RDR || typeof RDR.phoneState !== 'function' || RDR.phoneState._bustowed) return !!w.RDR;
    var orig = RDR.phoneState.bind(RDR);
    RDR.phoneState = function () {
      var st = orig();
      var g = RDR.game;
      if (st && st.me && g && typeof g.byId === 'function') {
        var p = g.byId(st.me.id);
        if (p) {
          st.me.bustOwed = p.bustOwed || 0;
          st.me.bankrupt = !!p.bankrupt;
          if (p.place) st.me.place = p.place;
        }
      }
      return st;
    };
    RDR.phoneState._bustowed = true;
    return true;
  }
  var n = 0, t = setInterval(function () { if (hook() || ++n > 80) clearInterval(t); }, 250);
  hook();
})(window);
