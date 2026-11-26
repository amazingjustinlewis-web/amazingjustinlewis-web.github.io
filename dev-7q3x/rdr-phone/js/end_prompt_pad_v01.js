/* Phone-side end-of-game prompt for Red Deer Rich v0.7.11.
   When the round ends, show Exit / Leave arcade initials / Make a profile.
   Posts this player's net worth (human seats only). The TV shows the board and does not post. */
(function () {
  if (!window.Acct) return;
  var shown = false;
  Acct.watch(function () {
    try {
      var st = window.RDRC && RDRC.state && RDRC.state();
      return !!(st && st.phase === 'over');
    } catch (e) { return false; }
  }, function () {
    if (shown) return;
    var st; try { st = RDRC.state(); } catch (e) { return; }
    if (!st) return;
    var me = st.me;
    if (!me || me.ai || me.observer) return;
    shown = true;
    var r = (st.results || []).filter(function (x) { return x.pid === me.id; })[0];
    var n = (st.players || []).length;
    Acct.endPrompt({
      title: r && r.place === 1 ? 'You are Red Deer Rich!' : 'Game over',
      sub: 'Leave your arcade initials, or make a profile to keep your history.',
      fallback: me.name,
      post: function (name) {
        return Acct.submit('red-deer-rich', {
          name: name,
          score: r && !r.bankrupt ? (r.worth || 0) : 0,
          label: n + ' players'
        });
      }
    });
  });
  Acct.watch(function () {
    try {
      var st = window.RDRC && RDRC.state && RDRC.state();
      return !!(st && st.phase && st.phase !== 'over');
    } catch (e) { return false; }
  }, function () { shown = false; });
})();
